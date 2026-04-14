import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { APP_BRAND_IMAGE } from '../constants';
import { useAuth } from '../context/AuthContext';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUser) {
      navigate('/home', { replace: true });
    }
  }, [currentUser, loading, navigate]);

  if (loading) {
     return (
        <Layout showNav={false}>
           <div className="flex items-center justify-center min-h-full bg-black">
              {/* Silent loading state or spinner could go here */}
           </div>
        </Layout>
     );
  }

  return (
    <Layout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
        
        <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight uppercase">
          YOU'RE Welcome to
        </h1>
        <h2 className="text-4xl md:text-6xl font-black text-red-600 mb-8 tracking-tighter uppercase italic">
          Approach
        </h2>

        {/* Brand Logo Container */}
        <div className="w-full max-w-[300px] md:max-w-[400px] aspect-square flex items-center justify-center mb-10 group border-2 border-red-600 rounded-3xl p-6 bg-black shadow-2xl shadow-red-900/30">
             <img 
               src={APP_BRAND_IMAGE} 
               alt="Approach Logo" 
               className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(220,38,38,0.3)] group-hover:scale-105 transition-transform duration-500"
             />
        </div>
        
        <p className="text-gray-300 italic mb-12 text-lg md:text-xl">
          "Love Starts With An Introduction"
        </p>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full justify-center items-center">
          <button
            onClick={() => navigate('/signin')}
            className="bg-red-600 hover:bg-red-700 text-white font-black py-5 px-10 rounded-[2rem] w-full max-w-[280px] sm:w-40 md:w-48 transition-all active:scale-95 shadow-2xl shadow-red-900/40 flex flex-col items-center justify-center gap-1 uppercase tracking-widest text-[10px] border border-red-500"
            aria-label="Navigate to login page"
          >
            <span>Login</span>
          </button>
          
          <button
            onClick={() => navigate('/signup')}
            className="bg-red-600 hover:bg-red-700 text-white font-black py-5 px-10 rounded-[2rem] w-full max-w-[280px] sm:w-40 md:w-48 transition-all active:scale-95 shadow-2xl shadow-red-900/40 flex flex-col items-center justify-center gap-1 uppercase tracking-widest text-[10px] border border-red-500"
            aria-label="Navigate to sign up page"
          >
            <span>Sign Up</span>
          </button>
        </div>
      </div>
    </Layout>
  );
};