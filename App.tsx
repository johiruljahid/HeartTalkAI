
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { UserProfile } from './types';
import { DB } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth State
    const unsubscribe = DB.subscribeToAuth((authUser) => {
        // If authUser is found via listener, update state.
        // If it returns null (e.g. initial load or logout), set null.
        setUser(authUser);
        setLoading(false);
    });

    // Also listen for profile updates (e.g. admin approval)
    const sync = () => {
        if (user) {
            const fresh = DB.getUserById(user.id);
            if (fresh) setUser(fresh);
        }
    };
    window.addEventListener('riya-sync', sync);

    return () => {
        unsubscribe();
        window.removeEventListener('riya-sync', sync);
    };
  }, [user?.id]); // Re-bind sync if user ID changes (login/logout)

  const handleLogout = () => {
    DB.logout();
    setUser(null);
  };

  const handleLoginSuccess = (u: UserProfile) => {
    setUser(u);
    setLoading(false);
  };

  if (loading) {
    return (
        <div className="h-screen w-full bg-black flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-t-pink-500 border-r-transparent border-b-purple-500 border-l-transparent animate-spin"></div>
                <p className="text-pink-500 font-mono text-xs tracking-widest uppercase">Connecting to Riya...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="antialiased text-gray-100 font-quicksand">
      {!user ? (
        <Login onLogin={handleLoginSuccess} /> 
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
