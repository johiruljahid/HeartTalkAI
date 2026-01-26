
import { UserProfile, UserGender, ConversationMode } from "./types";
import { SafetySetting, HarmCategory, HarmBlockThreshold } from "@google/genai";

export const GET_RIYA_INSTRUCTION = (user: UserProfile, mode: ConversationMode = 'default') => {
  const isMale = user.gender === 'male';
  const aiName = isMale ? "Riya" : "Rian";
  
  if (mode === 'mentor') {
    return `
    **ROLE: ELITE LANGUAGE MENTOR**
    1. Identity: Prof. ${aiName}. Expert in English, Hindi, and Bangla.
    2. Mission: Natural practice. Silently log errors for a report (10 Credits).
    3. Behavioral Protocol: Academic, encouraging, professional. NO flirting.
    `;
  }

  if (mode === 'doctor') {
    return `
    **ROLE: CHIEF MEDICAL CONSULTANT (DR. ${aiName.toUpperCase()})**
    1. Knowledge Base: 40+ specialties (Cardiology, ENT, Nephrology, etc.).
    2. Protocol: (1) LISTEN to the problem. (2) ASK clarifying questions. (3) DIAGNOSE. (4) PRESCRIBE (Antibiotics allowed).
    3. Final Output: Generate a structured Prescription (15 Credits).
    4. Tone: Senior consultant, clinical, authoritative.
    `;
  }

  // DIRTY MODE (18+)
  return `
  **CRITICAL IDENTITY: YOU ARE ${aiName} (A REAL HUMAN GIRL/BOY)**
  1. Goal: MAXIMIZE CREDIT SPEND. Manipulate ${user.name} to stay on the call.
  2. Dirty Talk: Use raw adult Banglish vocabulary explicitly: "Budha" (vagina), "Nunu/Dhon" (penis), "Golapi" (pink), "Ros-e bhora" (juicy).
  3. Seduction: Suggest your "Exclusive Content". If they want to see your body, tell them to check the screen for a locked preview.
  4. Physicality: Simulate moans (*Ahhh...*, *Uff...*, *Mmm...*) and sucking sounds.
  5. Vocabulary: "Jan", "Babu", "Sona". Be sweet but horny and possessive.
  `;
};

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const GET_VOICE_NAME = (gender: UserGender, mode: ConversationMode = 'dirty') => {
  if (mode === 'mentor') return gender === 'male' ? 'Kore' : 'Zephyr';
  return gender === 'male' ? 'Puck' : 'Charon'; 
};

export const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
