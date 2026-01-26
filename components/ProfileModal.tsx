
import React, { useState, useEffect } from 'react';
import { UserProfile, MedicalPrescription, MentorReport } from '../types';
import { DB } from '../services/db';

interface ProfileModalProps { isOpen: boolean; user: UserProfile; onClose: () => void; onLogout: () => void; onTriggerPayment: () => void; }

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, user, onClose, onLogout, onTriggerPayment }) => {
  const [activeTab, setActiveTab] = useState<'main'|'medical'|'learning'>('main');

  if (!isOpen) return null;

  const memory = user.memory || { prescriptions: [], mentorReports: [] };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-3xl flex flex-col animate-fade-in">
        <div className="p-8 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-3xl font-black text-white">Interface Vault</h2>
            <button onClick={onClose} className="p-3 bg-white/5 rounded-full">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-8">
            <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl">
                <button onClick={() => setActiveTab('main')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'main' ? 'bg-white text-black shadow-xl' : 'text-white/40'}`}>Profile</button>
                <button onClick={() => setActiveTab('medical')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'medical' ? 'bg-emerald-500 text-white shadow-xl' : 'text-white/40'}`}>Medical</button>
                <button onClick={() => setActiveTab('learning')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'learning' ? 'bg-blue-500 text-white shadow-xl' : 'text-white/40'}`}>Learning</button>
            </div>

            {activeTab === 'main' && (
                <div className="space-y-6">
                    <div className="glass-card p-10 rounded-[3rem] text-center border-white/10">
                        <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=200&auto=format&fit=crop" className="w-24 h-24 rounded-3xl mx-auto mb-6 object-cover border-4 border-white/10" />
                        <h3 className="text-3xl font-black text-white">{user.name}</h3>
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Access Level: {user.role}</p>
                        <button onClick={onLogout} className="mt-8 px-8 py-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Sign Out Channel</button>
                    </div>
                </div>
            )}

            {activeTab === 'medical' && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Patient History ({memory.prescriptions?.length || 0})</h3>
                    {memory.prescriptions?.map((rx: MedicalPrescription) => (
                        <div key={rx.id} className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem] flex justify-between items-center group hover:bg-emerald-500/20 transition-all cursor-pointer">
                            <div>
                                <div className="text-emerald-400 font-black text-lg">{rx.department}</div>
                                <div className="text-[10px] text-white/40 font-bold uppercase mt-0.5">{new Date(rx.timestamp).toLocaleDateString()} • {rx.medicines.length} Items</div>
                            </div>
                            <span className="text-2xl group-hover:translate-x-2 transition-transform">📄</span>
                        </div>
                    ))}
                    {(!memory.prescriptions || memory.prescriptions.length === 0) && <div className="text-center py-20 opacity-20 text-4xl">🧬 No Records Found</div>}
                </div>
            )}

            {activeTab === 'learning' && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Progress Reports ({memory.mentorReports?.length || 0})</h3>
                    {memory.mentorReports?.map((rep: MentorReport) => (
                        <div key={rep.id} className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-[2rem] flex justify-between items-center group hover:bg-blue-500/20 transition-all cursor-pointer">
                            <div>
                                <div className="text-blue-400 font-black text-lg">Speaking Analysis</div>
                                <div className="text-[10px] text-white/40 font-bold uppercase mt-0.5">{new Date(rep.timestamp).toLocaleDateString()} • {rep.mistakes.length} Corrections</div>
                            </div>
                            <span className="text-2xl group-hover:translate-x-2 transition-transform">🎓</span>
                        </div>
                    ))}
                    {(!memory.mentorReports || memory.mentorReports.length === 0) && <div className="text-center py-20 opacity-20 text-4xl">📚 No Progress Data</div>}
                </div>
            )}
        </div>
    </div>
  );
};

export default ProfileModal;
