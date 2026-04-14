
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Users, Heart, Settings, UserCircle, LogOut, ShoppingBag, Landmark, Inbox } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { APP_BRAND_IMAGE } from '../constants';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (currentUser) {
      const checkAdmin = async () => {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists() && snap.data().access?.toLowerCase() === 'admin') {
          setIsAdmin(true);
        }
      };
      checkAdmin();
    }
  }, [currentUser]);

  const NavItem = ({ path, icon: Icon, label }: { path: string; icon: any; label: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all group ${
        isActive(path) 
          ? 'bg-red-600/10 text-red-500 font-black' 
          : 'text-zinc-500 hover:bg-zinc-950 hover:text-white'
      }`}
      aria-label={`Navigate to ${label}`}
    >
      <Icon size={22} strokeWidth={isActive(path) ? 3 : 2} className="transition-transform group-hover:scale-110" />
      <span className="text-sm font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-6 bg-black border-r border-zinc-900">
      <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => navigate('/home')}>
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-red-600 bg-black p-1">
             <img src={APP_BRAND_IMAGE} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-xl font-black tracking-[0.2em] text-white uppercase">Approach</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        <NavItem path="/home" icon={UserCircle} label="My Profile" />
        <NavItem path="/approaches" icon={Heart} label="Approachers" />
        <NavItem path="/following" icon={Users} label="Matches" />
        <NavItem path="/gifts" icon={ShoppingBag} label="Gift Shop" />
        <NavItem path="/received-gifts" icon={Inbox} label="My Gifts" />
        <NavItem path="/settings" icon={Settings} label="Settings" />
        {isAdmin && <NavItem path="/admin/banking" icon={Landmark} label="Payouts" />}
      </nav>

      <button 
        onClick={handleLogout}
        className="flex items-center gap-4 w-full p-4 text-red-600 hover:bg-red-950/20 rounded-2xl transition-colors mt-auto font-black uppercase tracking-widest text-xs"
        aria-label="Securely log out"
      >
        <LogOut size={20} />
        <span>Log Out</span>
      </button>
    </div>
  );
};
