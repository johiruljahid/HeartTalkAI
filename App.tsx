
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
// Fix: Import UserProfile from types.ts
import { UserProfile } from './types';
import { DB } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const sessionUserId = localStorage.getItem('riya_session_id');
    if (sessionUserId) {
      const dbUser = DB.getUserById(sessionUserId);
      if (dbUser) setUser(dbUser);
      else localStorage.removeItem('riya_session_id');
    }

    const sync = () => {
      const id = localStorage.getItem('riya_session_id');
      if (id) {
        const fresh = DB.getUserById(id);
        if (fresh) setUser(fresh);
      } else {
        setUser(null);
      }
    };

    window.addEventListener('storage', sync);
    window.addEventListener('riya-sync', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('riya-sync', sync);
    };
  }, []);

  const handleLogin = (newUser: UserProfile) => {
    localStorage.setItem('riya_session_id', newUser.id);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('riya_session_id');
    setUser(null);
  };

  return (
    <div className="antialiased text-gray-100 font-quicksand">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
