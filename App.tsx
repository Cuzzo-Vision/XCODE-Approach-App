
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Home } from './pages/Home';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { UserHome } from './pages/UserHome';
import { Following } from './pages/Following';
import { Approaches } from './pages/Approaches';
import { ChatList } from './pages/ChatList';
import { ChatConversation } from './pages/ChatConversation';
import { UserProfile } from './pages/UserProfile';
import { PublicProfile } from './pages/PublicProfile';
import { Settings } from './pages/Settings';
import { UserGallery } from './pages/UserGallery';
import { EmojiGifts } from './pages/EmojiGifts';
import { BankingSettings } from './pages/BankingSettings';
import { ReceivedGifts } from './pages/ReceivedGifts';
import { Subscribers } from './pages/Subscribers';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { currentUser, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-black uppercase tracking-widest animate-pulse">Establishing Link...</div>;

  if (!currentUser) {
    return <Navigate to={`/signin?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Check for membership status
  if (userData && userData.membershipActive === false && location.pathname !== '/signup') {
    return <Navigate to="/signup" replace />;
  }

  // Check for admin status
  if (adminOnly && userData?.access?.toLowerCase() !== 'admin') {
    return <Navigate to="/home" replace />;
  }
  
  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { currentUser, userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-black uppercase tracking-widest animate-pulse">Establishing Link...</div>;
  
  if (currentUser) {
    if (userData && userData.membershipActive === false) {
      return <Navigate to="/signup" replace />;
    }
    return <Navigate to="/home" replace />;
  }
  
  return <Home />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          
          <Route path="/home" element={<ProtectedRoute><UserHome /></ProtectedRoute>} />
          <Route path="/approaches" element={<ProtectedRoute><Approaches /></ProtectedRoute>} />
          <Route path="/following" element={<ProtectedRoute><Following /></ProtectedRoute>} />
          <Route path="/gifts" element={<ProtectedRoute><EmojiGifts /></ProtectedRoute>} />
          <Route path="/received-gifts" element={<ProtectedRoute><ReceivedGifts /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
          <Route path="/chats/conversation/:id" element={<ProtectedRoute><ChatConversation /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin/banking" element={<ProtectedRoute adminOnly={true}><BankingSettings /></ProtectedRoute>} />
          <Route path="/admin/subscribers" element={<ProtectedRoute adminOnly={true}><Subscribers /></ProtectedRoute>} />
          <Route path="/gallery/:id" element={<ProtectedRoute><UserGallery /></ProtectedRoute>} />
          <Route path="/u/:username" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
