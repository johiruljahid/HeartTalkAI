import { UserProfile, PaymentRequest, PLANS } from '../types';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, Database } from 'firebase/database';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  Auth,
  User
} from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

// 🔥 FIREBASE CONFIGURATION 🔥
const firebaseConfig = {
  apiKey: "AIzaSyDGgSqp4Fi5C0ZZ_zVgC7R69MnJXySE3G8",
  authDomain: "hearttalkai-bec2d.firebaseapp.com",
  databaseURL: "https://hearttalkai-bec2d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hearttalkai-bec2d",
  storageBucket: "hearttalkai-bec2d.firebasestorage.app",
  messagingSenderId: "967489891910",
  appId: "1:967489891910:web:184556e84c5944e28be447",
  measurementId: "G-93NXYGMHMD"
};

// Internal Cache for Admin/Sync
let CACHE_USERS: UserProfile[] = [];
let CACHE_PAYMENTS: PaymentRequest[] = [];
let db: Database;
let auth: Auth;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
try { getAnalytics(app); } catch (e) {}

db = getDatabase(app);
auth = getAuth(app);
console.log("🔥 Firebase Auth & DB Connected");

// Helper: Ensure Schema
const ensureSchemaIntegrity = (user: UserProfile): UserProfile => {
  const defaultMemory = { notes: [], events: [], routines: [], emotions: [], reminders: [] };
  const defaultPreferences = { theme: 'dark', language: 'bangla' };
  
  return {
    ...user,
    role: user.role || 'free',
    guestUsageCount: user.guestUsageCount ?? 0,
    memory: { ...defaultMemory, ...(user.memory || {}) },
    preferences: { ...defaultPreferences, ...(user.preferences || {}) }
  } as UserProfile;
};

// --- REALTIME LISTENERS (For Admin & caching) ---
onValue(ref(db, 'users'), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    CACHE_USERS = Object.values(data).map((u: any) => ensureSchemaIntegrity(u));
    window.dispatchEvent(new Event('riya-sync'));
  }
});

onValue(ref(db, 'payments'), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    CACHE_PAYMENTS = Object.values(data);
    window.dispatchEvent(new Event('riya-sync'));
  }
});

// --- EXPORTED API ---

export const DB = {
  // --- AUTHENTICATION ---
  
  // Login with Email/Pass
  login: async (email: string, pass: string): Promise<UserProfile> => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    
    // Fetch profile immediately
    const snapshot = await get(ref(db, `users/${uid}`));
    if (snapshot.exists()) {
        return ensureSchemaIntegrity(snapshot.val());
    } else {
        throw new Error("Profile not found");
    }
  },

  // Register with Email/Pass
  register: async (email: string, pass: string, profileData: Omit<UserProfile, 'id' | 'role'>): Promise<UserProfile> => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    const newUser: UserProfile = {
        ...profileData,
        id: uid,
        email: email,
        role: 'free',
        guestUsageCount: 0,
        memory: { notes: [], events: [], routines: [], emotions: [], reminders: [] }
    };

    await set(ref(db, `users/${uid}`), newUser);
    return ensureSchemaIntegrity(newUser);
  },

  // Guest Access (Anonymous Auth)
  loginAsGuest: async (): Promise<UserProfile> => {
    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    
    const snapshot = await get(ref(db, `users/${uid}`));
    if (snapshot.exists()) {
        return ensureSchemaIntegrity(snapshot.val());
    } else {
        // Create Guest Profile
        const guestUser: UserProfile = {
            id: uid,
            name: 'Guest User',
            age: '25',
            role: 'guest',
            guestUsageCount: 0,
            memory: { notes: [], events: [], routines: [], emotions: [], reminders: [] }
        };
        await set(ref(db, `users/${uid}`), guestUser);
        return guestUser;
    }
  },

  logout: async () => {
    await signOut(auth);
  },

  // Auth State Observer
  subscribeToAuth: (callback: (user: UserProfile | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));
            if (snapshot.exists()) {
                callback(ensureSchemaIntegrity(snapshot.val()));
            } else {
                // Edge case: Auth exists but DB record missing
                callback(null); 
            }
        } else {
            callback(null);
        }
    });
  },

  // --- DATABASE OPERATIONS ---

  updateUser: (updatedUser: UserProfile) => {
    // Only update if ID exists
    if (!updatedUser.id) return;
    const clean = ensureSchemaIntegrity(updatedUser);
    set(ref(db, `users/${updatedUser.id}`), clean).catch(e => console.error("Sync Error", e));
  },

  getUserById: (id: string): UserProfile | null => {
    const u = CACHE_USERS.find(u => u.id === id);
    return u ? ensureSchemaIntegrity(u) : null;
  },

  getAllUsers: () => [...CACHE_USERS],
  getAllPayments: () => [...CACHE_PAYMENTS],
  getPaymentsByUserId: (uid: string) => CACHE_PAYMENTS.filter(p => p.userId === uid),

  createPaymentRequest: (req: PaymentRequest) => {
    set(ref(db, `payments/${req.id}`), req);

    // Optimistic user update
    const user = CACHE_USERS.find(u => u.id === req.userId);
    if (user) {
      user.subscription = {
        planId: req.planId,
        planName: PLANS.find(p => p.id === req.planId)?.name || 'Plan',
        startDate: Date.now(),
        expiryDate: 0,
        status: 'pending'
      };
      set(ref(db, `users/${user.id}`), user);
    }
  },

  approvePayment: (paymentId: string) => {
    const p = CACHE_PAYMENTS.find(pay => pay.id === paymentId);
    if (!p) return;
    
    const updatedPayment = { ...p, status: 'approved' as const };
    set(ref(db, `payments/${paymentId}`), updatedPayment);

    const user = CACHE_USERS.find(u => u.id === p.userId);
    if (user) {
      const plan = PLANS.find(pl => pl.id === p.planId);
      if (plan) {
        const updatedUser: UserProfile = {
            ...user,
            role: 'premium',
            subscription: {
                planId: plan.id,
                planName: plan.name,
                startDate: Date.now(),
                expiryDate: plan.durationDays === 'unlimited' ? 'unlimited' : Date.now() + (plan.durationDays * 86400000),
                status: 'active'
            }
        };
        set(ref(db, `users/${user.id}`), updatedUser);
      }
    }
  },

  rejectPayment: (paymentId: string) => {
    const p = CACHE_PAYMENTS.find(pay => pay.id === paymentId);
    if (!p) return;
    
    set(ref(db, `payments/${paymentId}`), { ...p, status: 'rejected' });

    const user = CACHE_USERS.find(u => u.id === p.userId);
    if (user && user.subscription?.status === 'pending') {
       // Remove pending status
       const updatedUser = { ...user, subscription: undefined };
       set(ref(db, `users/${user.id}`), updatedUser);
    }
  },

  clearAll: () => {
    alert("Please use Firebase Console to wipe data. Local cache will be cleared on refresh.");
    localStorage.clear();
    window.location.reload();
  }
};
