
import { UserProfile, PaymentRequest, PLANS } from '../types';

/**
 * 🔥 PERMANENT DATA KEYS - V4 🔥
 * These keys ensure that updates to the app logic do not affect stored user data.
 */
const STABLE_USERS_KEY = 'RIYA_STABLE_USERS_V4_CORE'; 
const STABLE_PAYMENTS_KEY = 'RIYA_STABLE_PAYMENTS_V4_CORE';
const SHADOW_BACKUP_KEY = 'RIYA_STABLE_BACKUP_V4';

const safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const notify = () => {
  window.dispatchEvent(new Event('riya-sync'));
  window.dispatchEvent(new Event('storage'));
};

const ensureSchemaIntegrity = (user: UserProfile): UserProfile => {
  const defaultMemory = { notes: [], events: [], routines: [], emotions: [], reminders: [] };
  const defaultPreferences = { theme: 'dark', language: 'bangla' };
  
  return {
    ...user,
    role: user.role || 'free',
    guestUsageCount: user.guestUsageCount ?? 0,
    memory: {
      ...defaultMemory,
      ...(user.memory || {}),
    },
    preferences: {
      ...defaultPreferences,
      ...(user.preferences || {})
    }
  } as UserProfile;
};

const initializeDatabase = () => {
  let masterUserList = safeParse(STABLE_USERS_KEY, null);
  let masterPaymentList = safeParse(STABLE_PAYMENTS_KEY, null);

  // Recovery from shadow backup
  if (!masterUserList || masterUserList.length === 0) {
    const backup = safeParse(SHADOW_BACKUP_KEY, null);
    if (backup?.users) {
      masterUserList = backup.users;
      masterPaymentList = backup.payments || [];
      localStorage.setItem(STABLE_USERS_KEY, JSON.stringify(masterUserList));
    }
  }

  // Migrate from all previous versions
  const legacyKeys = ['RIYA_STABLE_USERS_CORE_V3', 'RIYA_STABLE_USERS_CORE', 'RIYA_PROD_USERS_CORE'];
  legacyKeys.forEach(k => {
    const oldData = safeParse(k, null);
    if (oldData && Array.isArray(oldData)) {
      if (!masterUserList) masterUserList = [];
      oldData.forEach(u => {
        if (!masterUserList.find((m: any) => m.id === u.id)) {
          masterUserList.push(u);
        }
      });
    }
  });

  const validated = (masterUserList || []).map(ensureSchemaIntegrity);
  localStorage.setItem(STABLE_USERS_KEY, JSON.stringify(validated));
  localStorage.setItem(STABLE_PAYMENTS_KEY, JSON.stringify(masterPaymentList || []));
  
  // Always update Shadow Backup on init
  localStorage.setItem(SHADOW_BACKUP_KEY, JSON.stringify({
    users: validated,
    payments: masterPaymentList || [],
    timestamp: Date.now()
  }));
};

initializeDatabase();

const getUsers = (): UserProfile[] => safeParse(STABLE_USERS_KEY, []).map(ensureSchemaIntegrity);
const getPayments = (): PaymentRequest[] => safeParse(STABLE_PAYMENTS_KEY, []);

const persist = (users: UserProfile[], payments: PaymentRequest[]) => {
  const validated = users.map(ensureSchemaIntegrity);
  localStorage.setItem(STABLE_USERS_KEY, JSON.stringify(validated));
  localStorage.setItem(STABLE_PAYMENTS_KEY, JSON.stringify(payments));
  localStorage.setItem(SHADOW_BACKUP_KEY, JSON.stringify({
    users: validated,
    payments: payments,
    timestamp: Date.now()
  }));
  notify();
};

export const DB = {
  register: (user: UserProfile): UserProfile => {
    const users = getUsers();
    if (user.phone && users.find(u => u.phone?.trim() === user.phone?.trim())) {
      throw new Error('This phone number is already registered.');
    }
    const clean = ensureSchemaIntegrity(user);
    users.push(clean);
    persist(users, getPayments());
    return clean;
  },

  login: (phone: string, pass: string): UserProfile | null => {
    return getUsers().find(u => u.phone === phone && u.password === pass) || null;
  },

  updateUser: (updatedUser: UserProfile) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === updatedUser.id);
    if (idx !== -1) {
      users[idx] = ensureSchemaIntegrity({ ...users[idx], ...updatedUser });
      persist(users, getPayments());
    }
  },

  getUserById: (id: string): UserProfile | null => {
    const u = getUsers().find(u => u.id === id);
    return u ? ensureSchemaIntegrity(u) : null;
  },

  getAllUsers: () => getUsers(),
  getAllPayments: () => getPayments(),
  getPaymentsByUserId: (uid: string) => getPayments().filter(p => p.userId === uid),

  createPaymentRequest: (req: PaymentRequest) => {
    const payments = getPayments();
    if (payments.find(p => p.txnId === req.txnId)) return;
    payments.push(req);
    
    const users = getUsers();
    const user = users.find(u => u.id === req.userId);
    if (user) {
      user.subscription = {
        planId: req.planId,
        planName: PLANS.find(p => p.id === req.planId)?.name || 'Plan',
        startDate: Date.now(),
        expiryDate: 0,
        status: 'pending'
      };
    }
    persist(users, payments);
  },

  approvePayment: (paymentId: string) => {
    const payments = getPayments();
    const p = payments.find(pay => pay.id === paymentId);
    if (!p) return;
    p.status = 'approved';
    const users = getUsers();
    const user = users.find(u => u.id === p.userId);
    if (user) {
      const plan = PLANS.find(pl => pl.id === p.planId);
      if (plan) {
        user.role = 'premium';
        user.subscription = {
          planId: plan.id,
          planName: plan.name,
          startDate: Date.now(),
          expiryDate: plan.durationDays === 'unlimited' ? 'unlimited' : Date.now() + (plan.durationDays * 86400000),
          status: 'active'
        };
      }
    }
    persist(users, payments);
  },

  rejectPayment: (paymentId: string) => {
    const payments = getPayments();
    const p = payments.find(pay => pay.id === paymentId);
    if (!p) return;
    p.status = 'rejected';
    const users = getUsers();
    const user = users.find(u => u.id === p.userId);
    if (user && user.subscription?.status === 'pending') user.subscription = undefined;
    persist(users, payments);
  },

  clearAll: () => {
    if (confirm("This will WIPE all accounts. Use only for testing!")) {
      localStorage.clear();
      window.location.reload();
    }
  }
};
