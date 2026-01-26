
import { UserProfile, PaymentRequest, CREDIT_PACKAGES, ExclusiveContent } from '../types';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, Database, update, push } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDGgSqp4Fi5C0ZZ_zVgC7R69MnJXySE3G8",
  authDomain: "hearttalkai-bec2d.firebaseapp.com",
  databaseURL: "https://hearttalkai-bec2d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hearttalkai-bec2d",
  storageBucket: "hearttalkai-bec2d.firebasestorage.app",
  messagingSenderId: "967489891910",
  appId: "1:967489891910:web:184556e84c5944e28be447"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const auth = getAuth(app);

const ensureSchema = (u: any): UserProfile => ({
    ...u,
    credits: u.credits ?? 0,
    memory: { 
        unlockedContent: u.memory?.unlockedContent || [],
        prescriptions: u.memory?.prescriptions || [],
        mentorReports: u.memory?.mentorReports || []
    }
});

export const DB = {
  login: async (e: string, p: string) => {
    const cred = await signInWithEmailAndPassword(auth, e, p);
    const snap = await get(ref(db, `users/${cred.user.uid}`));
    return ensureSchema(snap.val());
  },
  register: async (e: string, p: string, data: any) => {
    const cred = await createUserWithEmailAndPassword(auth, e, p);
    const user = { ...data, id: cred.user.uid, email: e, role: 'free', credits: 10 };
    await set(ref(db, `users/${cred.user.uid}`), user);
    return ensureSchema(user);
  },
  loginAsGuest: async () => {
    const cred = await signInAnonymously(auth);
    const user = { id: cred.user.uid, name: 'Guest', age: '25', gender: 'male', role: 'guest', credits: 5 };
    await set(ref(db, `users/${cred.user.uid}`), user);
    return ensureSchema(user);
  },
  logout: () => signOut(auth),
  subscribeToAuth: (cb: any) => onAuthStateChanged(auth, async (u) => {
    if (u) { const s = await get(ref(db, `users/${u.uid}`)); cb(ensureSchema(s.val())); } else cb(null);
  }),
  updateUser: (u: UserProfile) => {
    set(ref(db, `users/${u.id}`), u);
    window.dispatchEvent(new CustomEvent('riya-sync'));
  },
  deductCredits: async (uid: string, amount: number) => {
    const snap = await get(ref(db, `users/${uid}/credits`));
    const current = snap.val() || 0;
    if (current < amount) throw new Error("Insufficient Credits");
    await set(ref(db, `users/${uid}/credits`), current - amount);
    window.dispatchEvent(new CustomEvent('riya-sync'));
  },
  createPaymentRequest: async (req: PaymentRequest) => {
    await set(ref(db, `payments/${req.id}`), req);
  },
  approvePayment: async (id: string) => {
    const snap = await get(ref(db, `payments/${id}`));
    if (snap.exists()) {
      const p = snap.val() as PaymentRequest;
      const pack = CREDIT_PACKAGES.find(cp => cp.id === p.packageId);
      if (pack) {
        const uSnap = await get(ref(db, `users/${p.userId}`));
        const user = uSnap.val();
        await update(ref(db, `users/${p.userId}`), { credits: (user.credits || 0) + pack.credits });
        await update(ref(db, `payments/${id}`), { status: 'approved' });
        window.dispatchEvent(new CustomEvent('riya-sync'));
      }
    }
  },
  rejectPayment: (id: string) => update(ref(db, `payments/${id}`), { status: 'rejected' }),
  getAllExclusiveContent: async (): Promise<ExclusiveContent[]> => {
    const snap = await get(ref(db, 'content'));
    return snap.exists() ? Object.values(snap.val()) : [];
  },
  uploadContent: (c: ExclusiveContent) => set(ref(db, `content/${c.id}`), c),
  getUserById: async (id: string) => {
    const s = await get(ref(db, `users/${id}`));
    return s.exists() ? ensureSchema(s.val()) : null;
  },
  getAllUsers: async () => {
    const s = await get(ref(db, 'users'));
    return s.exists() ? Object.values(s.val()) : [];
  },
  getAllPayments: async () => {
    const s = await get(ref(db, 'payments'));
    return s.exists() ? Object.values(s.val()) : [];
  }
};
