
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { DB } from '../services/db';
import AdminPanel from './AdminPanel';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  
  // State to toggle Admin Panel
  const [showAdmin, setShowAdmin] = useState(false);

  const handleGuestAccess = () => {
    // Generate or retrieve a stable guest ID for this device
    let guestId = localStorage.getItem('riya_stable_guest_id');
    if (!guestId) {
      guestId = `guest_${Date.now()}`;
      localStorage.setItem('riya_stable_guest_id', guestId);
    }

    // Attempt to retrieve or register guest in persistent DB
    let guestUser = DB.getUserById(guestId);
    if (!guestUser) {
      guestUser = {
        id: guestId,
        name: 'Guest',
        age: '25',
        role: 'guest',
        guestUsageCount: 0
      };
      DB.register(guestUser);
    }
    onLogin(guestUser);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const user = DB.login(phone, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid phone or password. Check spaces?');
      }
    } else {
      if (!name || !age || !phone || !password) {
        setError('All fields are required');
        return;
      }
      try {
        const newUser: UserProfile = {
          id: `user_${Date.now()}`,
          name: name.trim(),
          age: age.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role: 'free'
        };
        DB.register(newUser);
        onLogin(newUser);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-black overflow-hidden relative">
      {/* Background Image - Updated with provided URL */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-80 blur-[1px] transition-all duration-1000 scale-105"
        style={{ backgroundImage: "url('https://i.ibb.co.com/0VzDsHWv/login-bg-jpg.jpg')" }}
      ></div>

      {/* Light Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-0"></div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo Area */}
        <div className="mb-8 text-center">
           <div className="mx-auto w-24 h-24 rounded-full border-2 border-pink-400/30 overflow-hidden mb-4 shadow-[0_0_30px_rgba(236,72,153,0.3)] animate-pulse-ring">
              <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-purple-200 tracking-tight">Riya</h1>
          <p className="text-pink-200/80 text-sm tracking-widest uppercase mt-2 font-semibold">Personal AI Companion</p>
        </div>

        {/* Card */}
        <div className="w-full bg-black/40 border border-white/20 rounded-3xl p-8 backdrop-blur-md shadow-2xl">
          <div className="flex mb-6 border-b border-white/10 pb-2">
            <button 
              onClick={() => setMode('login')} 
              className={`flex-1 pb-2 text-center font-medium transition-colors ${mode === 'login' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-gray-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setMode('register')} 
              className={`flex-1 pb-2 text-center font-medium transition-colors ${mode === 'register' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-gray-400'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <>
                <input 
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                  placeholder="Your Name"
                />
                <input 
                  type="number" value={age} onChange={(e) => setAge(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                  placeholder="Age"
                />
              </>
            )}
            
            <input 
              type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
              placeholder="Mobile Number"
            />
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
              placeholder="Password"
            />

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button 
              type="submit"
              className="mt-2 w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              {mode === 'login' ? 'Unlock Riya' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
             <div className="h-px bg-white/10 flex-1"></div>
             <span className="px-4 text-xs text-gray-500">OR</span>
             <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <button 
            onClick={handleGuestAccess}
            className="mt-6 w-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Continue as Guest (Limited)
          </button>
        </div>
      </div>

      {/* ADMIN BUTTON (Discrete) */}
      <button 
        onClick={() => setShowAdmin(true)}
        className="absolute bottom-6 right-6 text-gray-500 hover:text-gray-300 text-xs uppercase tracking-widest z-20 flex items-center gap-2 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Admin Panel
      </button>

      {/* Render Admin Panel Overlay */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

export default Login;
