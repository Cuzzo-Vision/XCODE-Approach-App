
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Users, Heart, Settings, UserCircle, ShoppingBag } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string; icon: any; label: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`flex flex-col items-center justify-center w-full py-2 transition-all duration-300 ${
        isActive(path) 
          ? 'text-white bg-red-600 rounded-xl shadow-lg shadow-red-900/40 scale-110' 
          : 'text-zinc-500 hover:text-white'
      }`}
      aria-label={`Navigate to ${label}`}
    >
      <Icon size={20} strokeWidth={isActive(path) ? 3 : 2} />
      <span className="text-[8px] mt-1 font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-zinc-900 w-full flex justify-around items-center px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden z-[100]">
      <NavItem path="/home" icon={UserCircle} label="Me" />
      <NavItem path="/approaches" icon={Heart} label="Approachers" />
      <NavItem path="/gifts" icon={ShoppingBag} label="Shop" />
      <NavItem path="/following" icon={Users} label="Matches" />
      <NavItem path="/settings" icon={Settings} label="Settings" />
    </div>
  );
};
