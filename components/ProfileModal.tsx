
import React, { useState, useEffect } from 'react';
import { UserProfile, PaymentRequest } from '../types';
import { DB } from '../services/db';

interface ProfileModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onLogout: () => void;
  onTriggerPayment: () => void;
}

type ViewState = 'menu' | 'memory' | 'reminders' | 'routines' | 'billing' | 'settings';

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, user, onClose, onLogout, onTriggerPayment }) => {
  const [activeView, setActiveView] = useState<ViewState>('menu');
  const [history, setHistory] = useState<PaymentRequest[]>([]);
  
  const [editName, setEditName] = useState(user.name);
  const [editAge, setEditAge] = useState(user.age);

  useEffect(() => {
    if (isOpen) {
        setHistory(DB.getPaymentsByUserId(user.id).reverse());
        setActiveView('menu');
        setEditName(user.name);
        setEditAge(user.age);
    }
  }, [isOpen, user.id, user.name, user.age]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!editName.trim()) return;
    DB.updateUser({ ...user, name: editName, age: editAge });
    setActiveView('menu');
  };

  const deleteReminder = (id: string) => {
    const memory = user.memory || { notes: [], events: [], routines: [], emotions: [], reminders: [] };
    const updatedReminders = memory.reminders.filter(r => r.id !== id);
    DB.updateUser({ ...user, memory: { ...memory, reminders: updatedReminders } });
  };

  const FeatureBtn = ({ icon, label, onClick }: any) => (
    <button 
        onClick={onClick} 
        className="flex flex-col items-center justify-center bg-white/5 border border-white/5 p-6 rounded-[2.5rem] active:scale-95 transition-all hover:bg-white/10 hover:border-pink-500/30"
    >
        <span className="text-4xl mb-2">{icon}</span>
        <span className="text-sm font-bold text-white tracking-wide">{label}</span>
    </button>
  );

  const memory = user.memory || { notes: [], events: [], routines: [], emotions: [], reminders: [] };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0c29] flex flex-col overflow-hidden animate-slide-up">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-2xl mx-auto w-full">
            
            {activeView === 'menu' && (
                <div className="space-y-10 animate-fade-in pt-4 pb-20">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-black text-white">My Space</h2>
                            <p className="text-gray-400 text-sm mt-1">Manage your bond with Riya</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-all border border-white/5"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-6 bg-gradient-to-br from-white/10 to-transparent p-6 rounded-[3rem] border border-white/10 shadow-2xl">
                        <div className="relative">
                            <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=200&auto=format&fit=crop" className="w-20 h-20 rounded-full border-2 border-pink-500 object-cover" />
                            {user.role === 'premium' && <div className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full border border-black shadow-lg">PRO</div>}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white text-2xl tracking-tight">{user.name}</h3>
                            <p className="text-xs text-pink-400 font-black uppercase tracking-[0.2em] mt-1">{user.role} Partner</p>
                        </div>
                        <button 
                            onClick={onLogout} 
                            className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <FeatureBtn icon="🧠" label="Memory" onClick={() => setActiveView('memory')} />
                        <FeatureBtn icon="⏰" label="Reminders" onClick={() => setActiveView('reminders')} />
                        <FeatureBtn icon="📅" label="Routines" onClick={() => setActiveView('routines')} />
                        <FeatureBtn icon="📜" label="Billing" onClick={() => setActiveView('billing')} />
                        <FeatureBtn icon="⚙️" label="Settings" onClick={() => setActiveView('settings')} />
                        <FeatureBtn icon="💎" label="Upgrade" onClick={onTriggerPayment} />
                    </div>

                    <div className="text-center pt-8">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Riya AI Companion • Version 4.0 Stable</p>
                    </div>
                </div>
            )}

            {activeView !== 'menu' && (
                <div className="animate-fade-in pt-4 pb-20">
                    <div className="flex items-center gap-4 mb-10">
                        <button 
                            onClick={() => setActiveView('menu')} 
                            className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h2 className="text-2xl font-black text-white capitalize tracking-tight">{activeView}</h2>
                    </div>

                    {activeView === 'settings' && (
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-xs text-gray-500 font-black uppercase tracking-widest ml-1">Your Name</label>
                                <input 
                                    type="text" value={editName} onChange={e => setEditName(e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-white text-lg focus:border-pink-500 outline-none transition-all" 
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs text-gray-500 font-black uppercase tracking-widest ml-1">Your Age</label>
                                <input 
                                    type="number" value={editAge} onChange={e => setEditAge(e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-white text-lg focus:border-pink-500 outline-none transition-all" 
                                />
                            </div>
                            <button onClick={handleSave} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black py-5 rounded-[1.5rem] shadow-2xl active:scale-95 transition-all text-lg">Save Profile</button>
                        </div>
                    )}

                    {activeView === 'memory' && (
                        <div className="space-y-4">
                            {memory.notes.length === 0 && memory.events.length === 0 ? (
                                <p className="text-center py-20 opacity-40">No notes or events yet.</p>
                            ) : (
                                <>
                                    {memory.notes.map((n, i) => (
                                        <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/5 italic text-gray-300">"{n}"</div>
                                    ))}
                                    {memory.events.map((e) => (
                                        <div key={e.id} className="bg-pink-500/10 p-5 rounded-2xl border border-pink-500/20 flex justify-between">
                                            <div><p className="font-bold text-white">{e.title}</p><p className="text-xs text-pink-300 capitalize">{e.type}</p></div>
                                            <p className="font-bold text-white">{e.date}</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {activeView === 'reminders' && (
                        <div className="space-y-4">
                            {memory.reminders.length === 0 ? (
                                <p className="text-center py-20 opacity-40">No active reminders.</p>
                            ) : (
                                memory.reminders.map(r => (
                                    <div key={r.id} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                                        <div><p className="font-bold text-white">{r.message}</p><p className="text-xs text-pink-400">{r.time}</p></div>
                                        <button onClick={() => deleteReminder(r.id)} className="text-red-500 p-2">✕</button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeView === 'routines' && (
                        <div className="space-y-4">
                            {memory.routines.length === 0 ? (
                                <p className="text-center py-20 opacity-40">No routines set.</p>
                            ) : (
                                memory.routines.map(r => (
                                    <div key={r.id} className="bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20 flex items-center gap-4">
                                        <div className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold">{r.time}</div>
                                        <p className="text-white font-medium">{r.activity}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeView === 'billing' && (
                        <div className="space-y-4">
                            {history.map(p => (
                                <div key={p.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex justify-between items-center shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center font-bold">৳</div>
                                        <div><p className="font-black text-white uppercase text-sm tracking-widest">{p.planId} Plan</p><p className="text-[10px] text-gray-500 mt-0.5">{new Date(p.timestamp).toLocaleDateString()}</p></div>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-wider ${p.status === 'approved' ? 'bg-green-500 text-black' : 'bg-yellow-500 text-black'}`}>{p.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default ProfileModal;
