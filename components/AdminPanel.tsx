
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { PaymentRequest, UserProfile, CREDIT_PACKAGES, ExclusiveContent } from '../types';

export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'payments' | 'content' | 'users'>('payments');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [content, setContent] = useState<ExclusiveContent[]>([]);

  const [newContent, setNewContent] = useState<Partial<ExclusiveContent>>({ type: 'image', price: 50 });

  const load = async () => {
    setUsers(await DB.getAllUsers());
    setPayments(await DB.getAllPayments());
    setContent(await DB.getAllExclusiveContent());
  };

  useEffect(() => {
    if (isAuthenticated) { load(); }
  }, [isAuthenticated]);

  const handleUpload = () => {
    if (!newContent.url || !newContent.category) return;
    DB.uploadContent({
        ...newContent,
        id: `cnt_${Date.now()}`,
        timestamp: Date.now()
    } as any);
    alert("Content Published!");
    load();
  };

  if (!isAuthenticated) return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl">
      <div className="w-full max-w-sm glass-card p-10 rounded-[3rem] shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-8 text-center uppercase tracking-tighter">Nexus Console</h2>
        <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} className="glass-input w-full rounded-2xl p-4 text-center text-white mb-4" placeholder="ACCESS KEY" />
        <button onClick={() => passcode === 'Mishela' && setIsAuthenticated(true)} className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-lg">Authenticate</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col md:flex-row text-white font-sans overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-72 border-r border-white/5 p-8 flex flex-col shrink-0 bg-black/20">
            <h1 className="text-2xl font-black mb-10 text-emerald-400">Admin_Terminal</h1>
            <nav className="flex flex-col gap-2">
                {['payments', 'content', 'users'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t as any)} className={`p-4 rounded-2xl text-left font-black uppercase text-xs tracking-widest transition-all ${activeTab === t ? 'bg-emerald-500 text-black' : 'hover:bg-white/5 text-white/40'}`}>
                        {t}
                    </button>
                ))}
            </nav>
            <button onClick={onClose} className="mt-auto p-4 text-rose-500 font-black uppercase text-xs">Exit Channel</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            {activeTab === 'payments' && (
                <div className="space-y-6">
                    <h2 className="text-3xl font-black uppercase tracking-tighter mb-8">Refill Verification Queue</h2>
                    {payments.filter(p => p.status === 'pending').map(p => (
                        <div key={p.id} className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 flex items-center justify-between group">
                            <div>
                                <p className="text-xl font-black">{p.userName}</p>
                                <p className="text-xs font-bold text-white/40 uppercase mt-1">bKash: {p.senderNumber} • Txn: {p.txnId}</p>
                                <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black">{p.packageId}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => DB.rejectPayment(p.id)} className="px-6 py-3 border border-rose-500/30 text-rose-500 rounded-xl font-black text-[10px] uppercase">Deny</button>
                                <button onClick={() => DB.approvePayment(p.id)} className="px-8 py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20">Approve</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'content' && (
                <div className="space-y-12">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Content Production</h2>
                    <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Direct URL (Image/Video)" value={newContent.url} onChange={e => setNewContent({...newContent, url: e.target.value})} className="glass-input p-4 rounded-2xl" />
                            <input type="text" placeholder="Category (e.g. buda, boobs)" value={newContent.category} onChange={e => setNewContent({...newContent, category: e.target.value})} className="glass-input p-4 rounded-2xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Price (Credits)" value={newContent.price} onChange={e => setNewContent({...newContent, price: Number(e.target.value)})} className="glass-input p-4 rounded-2xl" />
                            <select value={newContent.type} onChange={e => setNewContent({...newContent, type: e.target.value as any})} className="glass-input p-4 rounded-2xl bg-black">
                                <option value="image">Image</option>
                                <option value="video">Video</option>
                            </select>
                        </div>
                        <button onClick={handleUpload} className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest">Publish to Vault</button>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {content.map(c => (
                            <div key={c.id} className="relative group rounded-3xl overflow-hidden border border-white/10 aspect-square">
                                <img src={c.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-6 text-center">
                                    <p className="font-black text-lg uppercase">{c.category}</p>
                                    <p className="text-emerald-400 font-bold">{c.price} Credits</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
