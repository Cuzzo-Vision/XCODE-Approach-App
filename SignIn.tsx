import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Layout } from '../components/Layout';
import { APP_BRAND_IMAGE } from '../constants';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      const searchParams = new URLSearchParams(location.search);
      const from = searchParams.get('from') || '/home';
      navigate(from, { replace: true });

    } catch (err: any) {
      console.error("Login Error Catch:", err.code, err.message);
      
      // Better mapping for the new unified Firebase error code
      switch (err.code) {
        case 'auth/invalid-credential':
          setError('Invalid login details. Check your email/password or create a new account.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email. Please sign up instead.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/invalid-email':
          setError('The email address provided is not valid.');
          break;
        case 'auth/too-many-requests':
          setError('Security lockout: Too many attempts. Try again in a few minutes.');
          break;
        case 'auth/network-request-failed':
          setError('Connection error. Please check your internet and try again.');
          break;
        default:
          setError('Failed to sign in. Please verify your credentials.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <div className="w-full max-w-[200px] aspect-square flex items-center justify-center mb-10">
             <img src={APP_BRAND_IMAGE} alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(220,38,38,0.2)]" />
        </div>

        <h2 className="text-2xl md:text-3xl font-black mb-8 md:mb-10 text-white tracking-[0.1em] uppercase">Sign In</h2>

        <form onSubmit={handleLogin} className="w-full max-w-xs flex flex-col gap-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="bg-red-600/10 border border-red-900/30 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
               <AlertCircle size={18} className="flex-shrink-0" />
               <span className="flex-1 leading-tight">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-black py-4 md:py-5 rounded-2xl md:rounded-[2rem] mt-4 md:mt-6 transition-all disabled:opacity-50 active:scale-[0.98] shadow-2xl shadow-red-900/40 uppercase tracking-[0.2em] text-xs flex flex-col items-center justify-center gap-1 border border-red-500"
            aria-label={loading ? 'Signing in...' : 'Sign in to your account'}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin md:w-6 md:h-6" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} className="md:w-6 md:h-6" />
                <span>Approach</span>
              </>
            )}
          </button>
        </form>
        
        <button 
          onClick={() => navigate('/signup')}
          className="mt-12 text-zinc-600 hover:text-white text-[11px] font-black uppercase tracking-widest transition-colors"
          aria-label="Go to sign up page"
        >
          New to the app? <span className="text-red-500 ml-1">Create Account</span>
        </button>
      </div>
    </Layout>
  );
};