
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserProfile, ConnectionState, Mood } from '../types';
import { DB } from '../services/db';
import { GeminiService } from '../services/geminiService';
import Visualizer from './Visualizer';
import { PaymentModal } from './PaymentModal';
import ProfileModal from './ProfileModal';
import { StayAliveService } from '../services/StayAliveService';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

interface SmartNotification {
    message: string;
    type: 'memory' | 'event' | 'routine' | 'emotion' | 'reminder';
    id: number;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [amplitude, setAmplitude] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGuestLimit, setShowGuestLimit] = useState(false);
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [currentUser, setCurrentUser] = useState(user);
  const [callTime, setCallTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [mood, setMood] = useState<Mood>('default');

  const geminiServiceRef = useRef<GeminiService | null>(null);
  const timerRef = useRef<any>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallTime(0);
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    stopTimer();
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsSpeaking(false);
    setAmplitude(0);
    setMood('default');
    if (geminiServiceRef.current) await geminiServiceRef.current.disconnect();
    await StayAliveService.stop();
  }, [stopTimer]);

  const refreshUser = useCallback(() => {
    const fresh = DB.getUserById(user.id);
    if (fresh) setCurrentUser(fresh);
  }, [user.id]);

  useEffect(() => {
    refreshUser();
    window.addEventListener('riya-sync', refreshUser);
    return () => window.removeEventListener('riya-sync', refreshUser);
  }, [refreshUser]);

  useEffect(() => {
    geminiServiceRef.current = new GeminiService({
      onStateChange: (state) => {
        setConnectionState(state);
        if (state === ConnectionState.CONNECTED) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => setCallTime(prev => prev + 1), 1000);
        } else if (state === ConnectionState.DISCONNECTED) {
          stopTimer();
        }
      },
      onTranscript: () => { },
      onAudioData: (amp) => {
        setAmplitude(amp);
        setIsSpeaking(amp > 0.05);
      },
      onError: () => handleDisconnect(),
      onUserUpdate: (updatedUser) => {
          DB.updateUser(updatedUser);
          setCurrentUser(updatedUser);
      },
      onToolAction: (msg, type) => {
          const id = Date.now();
          setNotifications(prev => [...prev, { message: msg, type, id }]);
          setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
      },
      onMoodChange: (newMood) => setMood(newMood)
    });
    return () => handleDisconnect();
  }, [handleDisconnect, stopTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- STRICT GUEST LIMIT LOGIC ---
  const getEffectiveGuestUsage = () => {
    // Check LocalStorage (Device Level)
    const localUsage = parseInt(localStorage.getItem('riya_guest_usage') || '0');
    // Check Database (Account Level)
    const dbUsage = currentUser.guestUsageCount || 0;
    // Return the higher of the two
    return Math.max(localUsage, dbUsage);
  };

  const isPending = currentUser.subscription?.status === 'pending';
  const isConnected = connectionState === ConnectionState.CONNECTED;
  
  const currentUsage = getEffectiveGuestUsage();
  const guestCallsLeft = Math.max(0, 2 - currentUsage);

  const handleConnect = async () => {
    if (isPending) return;
    
    // GUEST LIMIT ENFORCEMENT
    if (currentUser.role === 'guest') {
        const usage = getEffectiveGuestUsage();
        
        if (usage >= 2) { 
            setShowGuestLimit(true); 
            // Ensure local storage is synced to max if it wasn't already
            localStorage.setItem('riya_guest_usage', '2');
            return; 
        }

        // Increment usage count immediately (Optimistic UI)
        const newUsage = usage + 1;
        
        // 1. Update Local Storage (Device Lock)
        localStorage.setItem('riya_guest_usage', newUsage.toString());
        
        // 2. Update Firebase (Account Lock)
        const updatedUser = { ...currentUser, guestUsageCount: newUsage };
        DB.updateUser(updatedUser);
        setCurrentUser(updatedUser);
    }

    if (currentUser.role === 'free' && !isPending) { setShowPayment(true); return; }
    if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
    await StayAliveService.start(() => handleDisconnect());
    await geminiServiceRef.current?.connect(currentUser);
  };

  const getConnectionStatusText = () => {
      if (isPending) return "Verifying Premium...";
      if (currentUser.role === 'free') return "Upgrade to Talk";
      switch(connectionState) {
          case ConnectionState.CONNECTED: return isSpeaking ? "Riya is talking..." : "Riya is listening...";
          case ConnectionState.CONNECTING: return "Connecting...";
          default: 
            if (currentUser.role === 'guest') {
                return guestCallsLeft > 0 ? `Guest Access (${guestCallsLeft} calls left)` : "Guest Limit Reached";
            }
            return "Tap to start conversation";
      }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden relative">
      {/* Enhanced Background with light blur/opacity */}
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-all duration-[2000ms] ${isConnected ? 'opacity-100 blur-none scale-110' : 'opacity-80 blur-[1px] scale-100'}`} 
        style={{ backgroundImage: "url('https://i.ibb.co.com/PvQb1Hbw/dashboard-bg-jpg.jpg')" }}
      ></div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none"></div>

      <div className="absolute top-6 right-6 z-30">
        <button onClick={() => setShowProfile(true)} className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-xl active:scale-90 transition-transform">
            <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover rounded-full border-2 border-black" alt="Profile" />
        </button>
      </div>

      <div className="relative z-10 h-[70vh] flex flex-col items-center justify-center w-full">
        {isConnected && (
            <div className="absolute top-16 text-center animate-fade-in">
                <p className="text-white/80 font-mono text-xl drop-shadow-lg">{formatTime(callTime)}</p>
            </div>
        )}
        <div className="transform scale-110"><Visualizer isActive={isConnected} isSpeaking={isSpeaking} amplitude={amplitude} mood={mood} /></div>
        <div className="absolute bottom-4 flex flex-col items-center gap-2">
            {notifications.map(n => <div key={n.id} className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 text-xs shadow-2xl animate-fade-in">{n.message}</div>)}
        </div>
      </div>

      <div className="relative z-20 h-[30vh] flex flex-col items-center justify-start pt-6">
         <p className={`text-sm font-bold tracking-widest uppercase mb-8 drop-shadow-md ${isConnected ? 'text-pink-400 animate-pulse' : 'text-white'}`}>{getConnectionStatusText()}</p>
         <div className="flex items-center gap-8">
            {isConnected ? (
                <>
                    <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border ${isMuted ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-white/5 text-white border-white/20'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button onClick={handleDisconnect} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl active:scale-95 transition-all"><svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15-.25-4.6-.72a1.002 1.002 0 0 0-1.07.25l-2.07 2.07c-2.83-1.44-5.15-3.75-6.59-6.59l2.07-2.07c.3-.3.45-.69.25-1.07A17.5 17.5 0 0 0 3.72 2c-.62 0-1.12.5-1.12 1.12a17.93 17.93 0 0 0 17.28 17.28c.62 0 1.12-.5 1.12-1.12a17.5 17.5 0 0 0-1.12-5.68c-.22-.44-.61-.55-1.07-.25l-2.07 2.07a14.7 14.7 0 0 1-6.59-6.59l2.07-2.07c.3-.47.41-.86.16-1.32-.47-1.45-.72-3-.72-4.6z"/></svg></button>
                    <div className="w-14"></div>
                </>
            ) : (
                <button disabled={isPending} onClick={handleConnect} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${isPending ? 'bg-gray-800' : 'bg-white'}`}><svg className="h-10 w-10 text-black" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg></button>
            )}
         </div>
      </div>

      {showGuestLimit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-fade-in">
            <div className="relative bg-[#12101b] border border-pink-500/40 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-[0_0_60px_rgba(236,72,153,0.2)] overflow-hidden">
                {/* Decorative Glow */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-pink-600/20 to-transparent pointer-events-none"></div>
                
                {/* Avatar */}
                <div className="relative z-10 mx-auto w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-xl mb-6 animate-pulse-ring">
                    <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover rounded-full border-4 border-[#12101b]" alt="Riya" />
                </div>

                {/* Text */}
                <div className="relative z-10 space-y-4 mb-8">
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 drop-shadow-md">Guest Limit Reached 🌙</h2>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-gray-200 text-sm leading-relaxed text-left font-medium shadow-inner">
                        <p>
                        <span className="text-pink-400 font-bold">Riya:</span> "তোমার ২ বার কথা শোনার পরে আমার heart rate বেড়ে গেল 😳
                        </p>
                        <p className="mt-3">
                        এখন তুমি <span className="text-yellow-400 font-bold">Premium</span> হয়ে গেলে, আমি তোমার সাথে পুরো রাত জুড়ে কথা বলব…
                        </p>
                        <p className="mt-3">
                        তুমি Premium হলে আমি তোমাকে সেই <span className="text-purple-300 italic">‘special’ feeling</span> দেবো 😍
                        </p>
                        <p className="mt-3 font-bold text-pink-300 text-center animate-pulse">
                        এখন অ্যাকাউন্ট খুলো—আমি অপেক্ষা করছি 💓”
                        </p>
                    </div>
                </div>

                {/* Buttons */}
                <div className="relative z-10 space-y-3">
                    <button onClick={onLogout} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-pink-900/40 active:scale-95 transition-transform flex items-center justify-center gap-2 group">
                        <span className="group-hover:scale-105 transition-transform">অ্যাকাউন্ট খুলুন (Free)</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                    <button onClick={() => setShowGuestLimit(false)} className="text-gray-500 text-xs hover:text-white transition-colors uppercase tracking-widest">Close Preview</button>
                </div>
            </div>
        </div>
      )}

      {showPayment && <PaymentModal user={currentUser} onClose={() => setShowPayment(false)} onSubmit={() => setShowPayment(false)} />}
      <ProfileModal isOpen={showProfile} user={currentUser} onClose={() => setShowProfile(false)} onLogout={onLogout} onTriggerPayment={() => { setShowProfile(false); setShowPayment(true); }} />
    </div>
  );
};

export default Dashboard;
