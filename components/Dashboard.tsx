
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserProfile, ConnectionState, ConversationMode, MedicalPrescription, MentorReport, CREDIT_PACKAGES, ExclusiveContent } from '../types';
import { DB } from '../services/db';
import { GeminiService } from '../services/geminiService';
import Visualizer from './Visualizer';
import { PaymentModal } from './PaymentModal';
import ProfileModal from './ProfileModal';
import { StayAliveService } from '../services/StayAliveService';
import { GoogleGenAI, Type } from "@google/genai";

const Dashboard: React.FC<{ user: UserProfile; onLogout: () => void }> = ({ user, onLogout }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [amplitude, setAmplitude] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);
  const [callTime, setCallTime] = useState(0);
  const [selectedMode, setSelectedMode] = useState<ConversationMode>('dirty');
  const [transcripts, setTranscripts] = useState<{ text: string, isUser: boolean }[]>([]);
  
  const [activePrescription, setActivePrescription] = useState<MedicalPrescription | null>(null);
  const [activeMentorReport, setActiveMentorReport] = useState<MentorReport | null>(null);
  const [exclusiveContent, setExclusiveContent] = useState<ExclusiveContent[]>([]);
  const [lockedContent, setLockedContent] = useState<ExclusiveContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const geminiServiceRef = useRef<GeminiService | null>(null);
  const timerRef = useRef<any>(null);
  const creditDeductionRef = useRef<any>(null);

  useEffect(() => {
    const sync = async () => {
        const fresh = await DB.getUserById(user.id);
        if (fresh) setCurrentUser(fresh);
    };
    window.addEventListener('riya-sync', sync);
    DB.getAllExclusiveContent().then(setExclusiveContent);
    return () => window.removeEventListener('riya-sync', sync);
  }, [user.id]);

  const handleDisconnect = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (creditDeductionRef.current) clearInterval(creditDeductionRef.current);
    setCallTime(0);
    setConnectionState(ConnectionState.DISCONNECTED);
    if (geminiServiceRef.current) await geminiServiceRef.current.disconnect();
    await StayAliveService.stop();
  }, []);

  const startCreditTimer = () => {
    if (creditDeductionRef.current) clearInterval(creditDeductionRef.current);
    creditDeductionRef.current = setInterval(async () => {
        try {
            await DB.deductCredits(currentUser.id, 1);
        } catch (e) {
            alert("Credits Exhausted! Connection terminated.");
            handleDisconnect();
        }
    }, 60000); // 1 credit per minute
  };

  useEffect(() => {
    geminiServiceRef.current = new GeminiService({
      onStateChange: (s) => {
        setConnectionState(s);
        if (s === ConnectionState.CONNECTED) {
            timerRef.current = setInterval(() => setCallTime(prev => prev + 1), 1000);
            startCreditTimer();
        }
      },
      onTranscript: (text, isUser) => {
        setTranscripts(p => [...p, { text, isUser }]);
        // Randomly suggest exclusive content in dirty mode
        if (!isUser && selectedMode === 'dirty' && Math.random() > 0.7) {
            const randomContent = exclusiveContent[Math.floor(Math.random() * exclusiveContent.length)];
            if (randomContent) setLockedContent(randomContent);
        }
      },
      onAudioData: (amp) => { setAmplitude(amp); setIsSpeaking(amp > 0.08); },
      onUserUpdate: (u) => { DB.updateUser(u); setCurrentUser(u); },
      onToolAction: () => {}, onMoodChange: () => {}, onError: () => {}
    });
    return () => handleDisconnect();
  }, [selectedMode, exclusiveContent]);

  const handleConnect = async () => {
    if (currentUser.credits < 1) { setShowPayment(true); return; }
    setTranscripts([]); setActivePrescription(null); setActiveMentorReport(null);
    await StayAliveService.start(() => handleDisconnect());
    await geminiServiceRef.current?.connect(currentUser, selectedMode);
  };

  const generateOutput = async () => {
    const cost = selectedMode === 'doctor' ? 15 : 10;
    if (currentUser.credits < cost) { alert(`You need ${cost} credits for this.`); return; }
    
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const conv = transcripts.map(t => `${t.isUser ? 'User' : 'AI'}: ${t.text}`).join('\n');

    try {
        if (selectedMode === 'doctor') {
            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Generate professional medical prescription in JSON: ${conv}`,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { department: {type: Type.STRING}, problem: {type: Type.STRING}, history: {type: Type.STRING}, medicines: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: {type: Type.STRING}, purpose: {type: Type.STRING}, dose: {type: Type.STRING}, timing: {type: Type.STRING}, duration: {type: Type.STRING} } } }, advice: {type: Type.STRING} } } }
            });
            const data = JSON.parse(res.text);
            const rx = { ...data, id: `rx_${Date.now()}`, timestamp: Date.now() };
            setActivePrescription(rx);
            await DB.deductCredits(currentUser.id, 15);
            DB.updateUser({ ...currentUser, memory: { ...currentUser.memory!, prescriptions: [rx, ...currentUser.memory!.prescriptions] } });
        } else {
            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', contents: `Language mentor report JSON: ${conv}`,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { mistakes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: {type: Type.STRING}, better: {type: Type.STRING} } } }, vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } }, advice: {type: Type.STRING} } } }
            });
            const data = JSON.parse(res.text);
            const rep = { ...data, id: `rep_${Date.now()}`, timestamp: Date.now() };
            setActiveMentorReport(rep);
            await DB.deductCredits(currentUser.id, 10);
            DB.updateUser({ ...currentUser, memory: { ...currentUser.memory!, mentorReports: [rep, ...currentUser.memory!.mentorReports] } });
        }
    } catch (e) { alert("Failed to generate report."); } finally { setIsGenerating(false); }
  };

  const unlockContent = async (c: ExclusiveContent) => {
    if (currentUser.credits < c.price) { setShowPayment(true); return; }
    await DB.deductCredits(currentUser.id, c.price);
    const updatedUnlocked = [...(currentUser.memory?.unlockedContent || []), c.id];
    DB.updateUser({ ...currentUser, memory: { ...currentUser.memory!, unlockedContent: updatedUnlocked } });
    setLockedContent(null);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden bg-slate-950 text-white">
      
      {/* Header with Credits */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
            <div className="glass-panel px-5 py-2 rounded-full border-white/20 flex items-center gap-3">
                <span className="text-amber-400 text-lg">💎</span>
                <span className="text-xl font-black tabular-nums">{currentUser.credits}</span>
                <button onClick={() => setShowPayment(true)} className="ml-2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs hover:bg-white/20 transition-all">+</button>
            </div>
        </div>
        <button onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden shadow-lg">
            <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=100&auto=format&fit=crop" className="w-full h-full object-cover" />
        </button>
      </div>

      {/* Mode Switcher */}
      {!isConnected && !isConnecting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <div className="w-full max-w-sm glass-card p-8 rounded-[3rem] border-white/10 shadow-2xl">
                <h3 className="text-xl font-black text-center mb-8 uppercase tracking-widest text-white/40">Select Specialty</h3>
                <div className="flex flex-col gap-3">
                    {[
                        { id: 'mentor', label: 'Mentor', sub: 'Teacher Persona', icon: '🎓', color: 'blue' },
                        { id: 'doctor', label: 'Doctor', sub: 'Medical Expert', icon: '🩺', color: 'emerald' },
                        { id: 'dirty', label: 'Dirty Talk', sub: 'Hot Partner (18+)', icon: '🔞', color: 'pink' }
                    ].map(m => (
                        <button key={m.id} onClick={() => setSelectedMode(m.id as any)} className={`p-5 rounded-[2rem] border-2 transition-all flex items-center gap-5 ${selectedMode === m.id ? `bg-${m.color}-500/20 border-${m.color}-400 shadow-[0_0_20px_rgba(0,0,0,0.4)]` : 'bg-white/5 border-white/5 opacity-40'}`}>
                            <span className="text-3xl">{m.icon}</span>
                            <div className="text-left">
                                <div className="font-black text-lg text-white">{m.label}</div>
                                <div className="text-[10px] font-bold opacity-60 uppercase">{m.sub}</div>
                            </div>
                        </button>
                    ))}
                    <button onClick={handleConnect} className="mt-4 w-full bg-white text-black font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">Connect Link</button>
                </div>
            </div>
        </div>
      )}

      {/* Main UI */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Visualizer isActive={isConnected || isConnecting} isSpeaking={isSpeaking} amplitude={amplitude} userGender={currentUser.gender} />
        
        {isConnected && (
            <div className="mt-12 text-center animate-fade-in">
                <p className="text-5xl font-black tracking-tighter tabular-nums mb-6">{Math.floor(callTime/60)}:{(callTime%60).toString().padStart(2,'0')}</p>
                <div className="flex gap-3">
                    {selectedMode !== 'dirty' && (
                        <button onClick={generateOutput} disabled={isGenerating} className="px-10 py-4 bg-white/10 border border-white/20 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                            {isGenerating ? 'Analyzing...' : `Get ${selectedMode === 'doctor' ? 'RX (15c)' : 'Report (10c)'}`}
                        </button>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Exclusive Content Popup */}
      {lockedContent && (
        <div className="fixed bottom-32 left-6 right-6 z-[60] glass-card p-6 rounded-[2.5rem] border-pink-500/30 flex flex-col items-center gap-4 animate-fade-in-up">
            <div className="w-24 h-24 rounded-2xl bg-pink-500/20 flex items-center justify-center text-4xl blur-sm select-none">🔞</div>
            <div className="text-center">
                <h4 className="font-black text-pink-400">"{user.gender === 'male' ? 'Jan, amar buda dekhbe?' : 'Tomar figure ta khub sexi!'}"</h4>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Unlock Exclusive {lockedContent.category} ({lockedContent.price} Credits)</p>
            </div>
            <div className="flex gap-3 w-full">
                <button onClick={() => setLockedContent(null)} className="flex-1 py-3 text-white/40 font-bold uppercase text-[10px]">Ignore</button>
                <button onClick={() => unlockContent(lockedContent)} className="flex-[2] bg-pink-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Unlock Now</button>
            </div>
        </div>
      )}

      {/* Modals for RX/Reports (Reuse from existing code with credit logic applied) */}
      {activePrescription && <PrescriptionPad rx={activePrescription} user={currentUser} onClose={() => setActivePrescription(null)} />}
      
      {/* Footer Nav */}
      <div className="p-8 flex justify-center gap-6 z-30">
        <button onClick={() => setShowProfile(true)} className="p-4 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 text-xs font-black uppercase">Vault</button>
        <button onClick={handleDisconnect} className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all shadow-2xl ${isConnected ? 'bg-rose-500 shadow-rose-500/40' : 'bg-white text-black'}`}>
            {isConnected ? 'END' : 'CALL'}
        </button>
      </div>

      {showPayment && <PaymentModal user={currentUser} onClose={() => setShowPayment(false)} onSubmit={() => setShowPayment(false)} />}
      <ProfileModal isOpen={showProfile} user={currentUser} onClose={() => setShowProfile(false)} onLogout={onLogout} onTriggerPayment={() => setShowPayment(true)} />
    </div>
  );
};

// Internal Components for RX Display
const PrescriptionPad = ({ rx, user, onClose }: any) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
        <div className="bg-white rounded-[2.5rem] w-full max-w-xl text-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 p-8 text-white flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Consultant: {user.gender === 'male' ? 'Dr. Riya' : 'Dr. Rian'}</h2>
                    <p className="text-[10px] font-bold uppercase opacity-80">{rx.department} Specialist</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full">✕</button>
            </div>
            <div className="p-10 flex-1 overflow-y-auto space-y-8">
                <div className="flex justify-between border-b border-slate-200 pb-4 text-[10px] font-black uppercase text-slate-400">
                    <span>Patient: {user.name}</span>
                    <span>Age: {user.age}</span>
                    <span>Date: {new Date(rx.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-2">Diagnosis / Problem</h4>
                        <p className="text-sm font-bold text-slate-700">{rx.problem}</p>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-emerald-600">💊 PRESCRIPTIONS</h3>
                        <div className="space-y-3">
                            {rx.medicines.map((m: any, i: number) => (
                                <div key={i} className="flex justify-between items-center p-5 bg-emerald-50 rounded-2xl border border-emerald-100 group hover:bg-emerald-100 transition-all">
                                    <div className="flex-1">
                                        <div className="font-black text-emerald-800 text-lg">{m.name}</div>
                                        <div className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">{m.purpose}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-slate-700">{m.dose}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">{m.timing} • {m.duration}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-800 text-white p-8 rounded-[2rem] shadow-xl">
                        <h4 className="text-[10px] font-black uppercase opacity-60 mb-2">Medical Advice</h4>
                        <p className="text-sm font-medium leading-relaxed italic">"{rx.advice}"</p>
                    </div>
                </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => window.print()} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-widest">Download Pad (JPG/PDF)</button>
            </div>
        </div>
    </div>
);

export default Dashboard;
