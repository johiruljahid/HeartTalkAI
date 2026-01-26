
import React, { useState } from 'react';
import { CREDIT_PACKAGES, PaymentRequest, UserProfile } from '../types';
import { DB } from '../services/db';

export const PaymentModal: React.FC<{ user: UserProfile; onClose: () => void; onSubmit: () => void; }> = ({ user, onClose, onSubmit }) => {
  const [selectedPackId, setSelectedPackId] = useState('100c');
  const [txnId, setTxnId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pack = CREDIT_PACKAGES.find(p => p.id === selectedPackId)!;
    DB.createPaymentRequest({
      id: `pay_${Date.now()}`, userId: user.id, userName: user.name,
      packageId: pack.id, amount: pack.price, txnId: txnId.trim(),
      senderNumber: senderNumber.trim(), status: 'pending', timestamp: Date.now()
    });
    setIsSuccess(true);
  };

  if (isSuccess) return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
        <div className="glass-card w-full max-w-sm rounded-[3rem] p-10 text-center border-pink-500/30">
           <div className="text-6xl mb-6 animate-bounce">💎</div>
           <h2 className="text-2xl font-black text-white mb-2">Request Sent!</h2>
           <p className="text-white/60 text-sm leading-relaxed mb-8">Admin verification ongoing. Credits will be added to your account instantly after approval. 😉</p>
           <button onClick={onSubmit} className="w-full bg-pink-600 text-white font-black py-4 rounded-2xl shadow-xl">Perfect</button>
        </div>
      </div>
  );

  const activePack = CREDIT_PACKAGES.find(p => p.id === selectedPackId)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-card w-full max-w-lg rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl bg-black/60 border-white/10">
        <div className="bg-white/5 p-8 text-center border-b border-white/10">
           <h2 className="text-2xl font-black text-white uppercase tracking-tight">Refill Diamonds 💎</h2>
           <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Unlock Sex, Health & Mastery</p>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-3 gap-3 mb-8">
            {CREDIT_PACKAGES.map(p => (
              <div key={p.id} onClick={() => setSelectedPackId(p.id)} className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center gap-1 ${selectedPackId === p.id ? 'border-pink-500 bg-pink-500/20' : 'border-white/5 bg-white/5'}`}>
                <div className="text-[10px] font-black text-white/40 uppercase">{p.credits} CR</div>
                <div className="text-xl font-black text-white">৳{p.price}</div>
              </div>
            ))}
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 mb-8 text-center">
            <p className="text-amber-400 font-black text-xs uppercase mb-2">Send Money (bKash)</p>
            <div className="text-2xl font-black text-white tracking-widest bg-black/40 py-3 rounded-2xl border border-white/10">01915344445</div>
            <p className="text-white/40 text-[10px] mt-2 font-bold uppercase">Send ৳{activePack.price} to refill {activePack.credits} Credits</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" required value={txnId} onChange={e => setTxnId(e.target.value)} className="glass-input w-full rounded-2xl px-6 py-4 font-black text-sm" placeholder="TRANSACTION ID" />
            <input type="text" required value={senderNumber} onChange={e => setSenderNumber(e.target.value)} className="glass-input w-full rounded-2xl px-6 py-4 font-black text-sm" placeholder="YOUR BKASH NUMBER" />
            <div className="flex gap-4 pt-4">
                <button type="button" onClick={onClose} className="flex-1 py-4 text-white/40 font-black uppercase text-xs">Back</button>
                <button type="submit" className="flex-[2] bg-white text-black font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-widest">Verify Refill</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
