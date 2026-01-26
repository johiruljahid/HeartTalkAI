
import React, { useState } from 'react';
import { UserProfile, UserGender } from '../types';
import { DB } from '../services/db';
// Fix: AdminPanel is a named export in AdminPanel.tsx, so it must be imported using curly braces.
import { AdminPanel } from './AdminPanel';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showAdmin, setShowAdmin] = useState(false);

  const handleGuestAccess = async () => {
    setLoading(true);
    setError('');
    try {
        const guestUser = await DB.loginAsGuest();
        onLogin(guestUser);
    } catch (err: any) {
        if (err.code === 'auth/operation-not-allowed') {
            setError("Admin Error: Enable Anonymous sign-in.");
        } else {
            setError(`Guest login failed: ${err.message}`);
        }
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        if (mode === 'login') {
            const user = await DB.login(email, password);
            onLogin(user);
        } else {
            if (!name || !age || !email || !password) {
                throw new Error('All fields are required');
            }
            const newUser = await DB.register(email, password, {
                name: name.trim(),
                age: age.trim(),
                gender: gender,
            });
            onLogin(newUser);
        }
    } catch (err: any) {
        setError(err.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Main Card */}
      <div className="w-full max-w-[400px] animate-fade-in-up relative z-10">
        
        {/* Logo/Brand */}
        <div className="text-center mb-8">
           <div className="w-24 h-24 mx-auto rounded-[2rem] bg-white/10 backdrop-blur-md p-2 shadow-2xl mb-4 border border-white/20 animate-float">
              <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative">
                 <img src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Logo" />
              </div>
           </div>
           <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">HeartTalk</h1>
           <p className="text-white/60 text-sm font-bold tracking-widest uppercase mt-2">AI Soulmate Interface</p>
        </div>

        {/* Glass Form - Dark Glass */}
        <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl">
          
          {/* Toggle */}
          <div className="flex bg-black/40 p-1.5 rounded-2xl mb-6 border border-white/10">
            <button 
              onClick={() => setMode('login')} 
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${mode === 'login' ? 'bg-white/20 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setMode('register')} 
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${mode === 'register' ? 'bg-white/20 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="animate-fade-in-up space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="glass-input w-full rounded-2xl px-5 py-3.5 text-sm font-bold outline-none" placeholder="Name" />
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="glass-input w-full rounded-2xl px-5 py-3.5 text-sm font-bold outline-none" placeholder="Age" />
                </div>
                <div className="flex gap-3">
                    <button type="button" onClick={() => setGender('male')} className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all ${gender === 'male' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-transparent border-white/10 text-white/40 hover:bg-white/5'}`}>MALE</button>
                    <button type="button" onClick={() => setGender('female')} className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all ${gender === 'female' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-transparent border-white/10 text-white/40 hover:bg-white/5'}`}>FEMALE</button>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none" placeholder="Email Address" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none" placeholder="Password" />
            </div>

            {error && <div className="text-white text-xs font-bold text-center bg-rose-500/80 py-3 rounded-xl shadow-lg animate-pulse">{error}</div>}

            <button type="submit" disabled={loading} className="mt-4 w-full bg-white text-black font-black text-sm py-4 rounded-2xl hover:bg-gray-200 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center uppercase tracking-wider">
              {loading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : (mode === 'login' ? 'Start Journey' : 'Create Bond')}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10"></div>
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Or</span>
              <div className="h-px flex-1 bg-white/10"></div>
          </div>

          <button onClick={handleGuestAccess} disabled={loading} className="mt-4 w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-widest border border-white/10 shadow-sm">
             Enter as Guest
          </button>
        </div>
        
        <p className="text-center mt-8">
            <button onClick={() => setShowAdmin(true)} className="text-[10px] text-white/30 hover:text-white/60 font-black uppercase tracking-[0.2em] transition-colors">
                System Access
            </button>
        </p>
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

export default Login;
