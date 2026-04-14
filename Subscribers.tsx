
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Layout } from '../components/Layout';
import { User } from '../types';
import { Users, Calendar, TrendingUp, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Subscribers: React.FC = () => {
  const [stats, setStats] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubscribers = async () => {
      try {
        const q = query(collection(db, 'users'), where('membershipActive', '==', true));
        const querySnapshot = await getDocs(q);
        const subscribers = querySnapshot.docs.map(doc => doc.data() as User);

        const now = new Date();
        
        const counts = {
          daily: 0,
          weekly: 0,
          monthly: 0,
          yearly: 0,
          total: subscribers.length
        };

        subscribers.forEach(sub => {
          if (sub.membershipDate) {
            const subDate = new Date(sub.membershipDate);
            const diffMs = now.getTime() - subDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) counts.daily++;
            if (diffDays <= 7) counts.weekly++;
            if (diffDays <= 30) counts.monthly++;
            if (diffDays <= 365) counts.yearly++;
          }
        });

        setStats(counts);
      } catch (error) {
        console.error("Error fetching subscribers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscribers();
  }, []);

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto flex flex-col min-h-full">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-zinc-900 rounded-2xl text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-white uppercase tracking-widest">Subscribers</h1>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Platform Growth Analytics</p>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-red-600" size={32} />
            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Analyzing Data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard 
              label="Daily New" 
              value={stats.daily} 
              icon={<Calendar className="text-red-500" size={24} />} 
              period="Last 24 Hours"
            />
            <StatCard 
              label="Weekly New" 
              value={stats.weekly} 
              icon={<TrendingUp className="text-red-500" size={24} />} 
              period="Last 7 Days"
            />
            <StatCard 
              label="Monthly New" 
              value={stats.monthly} 
              icon={<Users className="text-red-500" size={24} />} 
              period="Last 30 Days"
            />
            <StatCard 
              label="Yearly New" 
              value={stats.yearly} 
              icon={<Calendar className="text-red-500" size={24} />} 
              period="Last 365 Days"
            />
            <div className="sm:col-span-2 mt-4 p-8 bg-zinc-950 border border-red-600/20 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-red-900/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users size={120} className="text-red-600" />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Active Subscribers</p>
                <h2 className="text-5xl font-black text-white">{stats.total}</h2>
              </div>
              <div className="relative z-10 bg-red-600 p-5 rounded-3xl shadow-xl shadow-red-900/40">
                <Users className="text-white" size={32} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; period: string }> = ({ label, value, icon, period }) => (
  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-[2rem] hover:border-red-600/30 transition-all group relative overflow-hidden">
    <div className="flex items-center justify-between mb-6">
      <div className="p-4 bg-zinc-900 rounded-2xl group-hover:bg-red-600/10 transition-colors border border-zinc-800 group-hover:border-red-600/20">
        {icon}
      </div>
      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
        {period}
      </span>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-4xl font-black text-white">{value}</h3>
    <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-600/5 blur-3xl rounded-full -mr-12 -mb-12 group-hover:bg-red-600/10 transition-all"></div>
  </div>
);
