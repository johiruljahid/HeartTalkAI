
export type UserRole = 'guest' | 'free' | 'premium' | 'admin';

export type Mood = 'happy' | 'romantic' | 'calm' | 'excited' | 'sad' | 'intense' | 'default';

export interface Subscription {
  planId: string;
  planName: string;
  startDate: number;
  expiryDate: number | 'unlimited';
  status: 'active' | 'expired' | 'pending';
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'meeting' | 'anniversary' | 'other';
}

export interface Routine {
  id: string;
  time: string;
  activity: string;
}

export interface Reminder {
  id: string;
  message: string;
  time: string;
  timestamp: number;
  isCompleted: boolean;
}

export interface UserMemory {
  notes: string[];
  events: CalendarEvent[];
  routines: Routine[];
  emotions: string[];
  reminders: Reminder[];
}

export interface UserProfile {
  id: string;
  name: string;
  age: string;
  email?: string;
  phone?: string; 
  role: UserRole;
  subscription?: Subscription;
  guestUsageCount?: number;
  memory?: UserMemory; 
  preferences?: {
    theme?: 'dark' | 'light';
    language?: 'bangla' | 'hindi' | 'english';
  };
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  planId: string;
  amount: number;
  txnId: string;
  senderNumber: string;
  referName?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  durationDays: number | 'unlimited';
}

export const PLANS: Plan[] = [
  { id: '1m', name: '1 Month Plan', price: 200, durationDays: 30 },
  { id: '3m', name: '3 Months Plan', price: 400, durationDays: 90 },
  { id: '6m', name: '6 Months Plan', price: 650, durationDays: 180 },
  { id: '1y', name: '1 Year Plan', price: 1000, durationDays: 365 },
  { id: 'life', name: 'Lifetime Plan', price: 4999, durationDays: 'unlimited' },
];
