
export type UserRole = 'guest' | 'free' | 'premium' | 'admin';
export type UserGender = 'male' | 'female';
export type Mood = 'happy' | 'romantic' | 'calm' | 'excited' | 'sad' | 'intense' | 'default';
export type ConversationMode = 'mentor' | 'doctor' | 'dirty' | 'default';

export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    price: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
    { id: '100c', name: 'Lite Pack', credits: 100, price: 100 },
    { id: '300c', name: 'Pro Pack', credits: 300, price: 280 },
    { id: '500c', name: 'Elite Pack', credits: 500, price: 450 },
];

export interface ExclusiveContent {
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    price: number;
    description: string;
    category: string; // e.g. 'buda', 'boobs', 'face', 'body'
}

export interface MedicalPrescription {
    id: string;
    timestamp: number;
    department: string;
    problem: string;
    history: string;
    medicines: {
        name: string;
        purpose: string;
        dose: string;
        timing: 'Before Food' | 'After Food';
        duration: string;
    }[];
    advice: string;
}

export interface MentorReport {
    id: string;
    timestamp: number;
    mistakes: { original: string; better: string; }[];
    vocabulary: string[];
    advice: string;
}

export interface UserMemory {
  unlockedContent: string[]; // IDs of exclusive content purchased
  prescriptions: MedicalPrescription[];
  mentorReports: MentorReport[];
}

export interface UserProfile {
  id: string;
  name: string;
  age: string;
  gender: UserGender;
  email?: string;
  role: UserRole;
  credits: number; // Current credit balance
  memory?: UserMemory;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  packageId: string;
  amount: number;
  txnId: string;
  senderNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}
