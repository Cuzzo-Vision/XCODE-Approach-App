
import React from 'react';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  disableScroll?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  showNav = true, 
  disableScroll = false 
}) => {
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col md:flex-row overflow-hidden">
      
      {/* Desktop Sidebar - Hidden on Mobile */}
      {showNav && (
        <aside className="hidden md:flex w-72 h-full flex-shrink-0 z-20">
          <Sidebar />
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        <div className={`flex-1 w-full flex flex-col relative ${disableScroll ? 'overflow-hidden' : 'overflow-y-auto scroll-smooth overscroll-contain'}`}>
           {/* Center content on large screens with a max-width constraint for readability */}
           <div className={`w-full max-w-2xl mx-auto flex flex-col md:border-x md:border-zinc-900 px-4 md:px-0`}>
             {children}
           </div>
        </div>

        {/* Mobile Bottom Nav - Placeholder to maintain flex flow if needed, but the component is fixed */}
        {showNav && (
          <div className="md:hidden flex-shrink-0 z-50 h-[calc(64px+env(safe-area-inset-bottom))]">
             <BottomNav />
          </div>
        )}
      </main>
    </div>
  );
};
