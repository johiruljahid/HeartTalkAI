
import React, { useState } from 'react';
import { PLANS, PaymentRequest, UserProfile } from '../types';
import { DB } from '../services/db';

interface PaymentModalProps {
  user: UserProfile;
  onClose: () => void;
  onSubmit: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ user, onClose, onSubmit }) => {
  const [selectedPlanId, setSelectedPlanId] = useState('1m');
  const [txnId, setTxnId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [referName, setReferName] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnId || !senderNumber) return;

    const plan = PLANS.find(p => p.id === selectedPlanId)!;
    
    const request: PaymentRequest = {
      id: `pay_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      planId: plan.id,
      amount: plan.price,
      txnId: txnId.trim(),
      senderNumber: senderNumber.trim(),
      referName: referName.trim() || undefined,
      status: 'pending',
      timestamp: Date.now()
    };

    DB.createPaymentRequest(request);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <div className="bg-gray-900 border border-pink-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(236,72,153,0.2)] relative overflow-hidden">
           <div className="text-6xl mb-4 animate-bounce">🎉</div>
           <h2 className="text-2xl font-bold text-white mb-2">পেমেন্ট রিসিভড!</h2>
           
           <div className="space-y-4 text-gray-300 text-sm leading-relaxed mb-8 mt-4">
              <p>আপনার তথ্য আমাদের কাছে পৌঁছে গেছে 🚀</p>
              <p>এখন আমরা ঝটপট ভেরিফাই করছি—একদম superhero speed 🦸‍♂️⚡</p>
              <p className="text-yellow-400 font-medium bg-yellow-900/20 py-1 rounded">⏳ সাধারণত খুব দ্রুতই প্রিমিয়াম অন হয়ে যায়।</p>
              <p className="italic text-pink-300">"একটু ধৈর্য ধরুন, আমি কিন্তু অপেক্ষা করছি আপনার জন্য 😉"</p>
           </div>

           <button 
              onClick={onSubmit} 
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
           >
              ঠিক আছে
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-pink-900 p-6 text-center">
           <h2 className="text-2xl font-bold text-white">Upgrade to Premium 💎</h2>
           <p className="text-pink-200 text-sm mt-1">Unlock Voice, Memory & Unlimited Chat</p>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {/* Plans Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {PLANS.map(plan => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPlanId === plan.id ? 'border-pink-500 bg-pink-500/10' : 'border-gray-700 bg-gray-800'}`}
              >
                <div className="text-sm font-semibold text-white">{plan.name}</div>
                <div className="text-xl font-bold text-pink-400">৳{plan.price}</div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-6">
            <h3 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
              bKash Payment (Send Money)
            </h3>
            <p className="text-gray-300 text-sm mb-1">Send <strong>৳{PLANS.find(p => p.id === selectedPlanId)?.price}</strong> to:</p>
            <div className="bg-black/40 rounded p-2 text-center text-xl font-mono text-white tracking-wider border border-white/10 select-all">
              01915344445
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
               <label className="block text-xs text-gray-400 mb-1">Transaction ID (TxnID)</label>
               <input 
                  type="text" required value={txnId} onChange={e => setTxnId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-pink-500 outline-none"
                  placeholder="e.g. 9H7G6F5D"
               />
            </div>
            <div>
               <label className="block text-xs text-gray-400 mb-1">Sender bKash Number</label>
               <input 
                  type="text" required value={senderNumber} onChange={e => setSenderNumber(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-pink-500 outline-none"
                  placeholder="017xxxxxxxx"
               />
            </div>
            <div>
               <label className="block text-xs text-gray-400 mb-1">Refer Name (Optional)</label>
               <input 
                  type="text" value={referName} onChange={e => setReferName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-pink-500 outline-none"
                  placeholder="Who referred you?"
               />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 py-3 text-gray-400 hover:text-white transition">Cancel</button>
              <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl shadow-lg">Submit Verification</button>
            </div>
          </form>
        </div>
      </div>
    );
  };
