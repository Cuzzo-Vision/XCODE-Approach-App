
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Gift, Calendar, User as UserIcon, Heart, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { GiftTransaction } from '../types';

export const ReceivedGifts: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [gifts, setGifts] = useState<GiftTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // REAL-TIME LISTENER: No refresh required
    const giftsRef = collection(db, 'gifts');
    const q = query(
      giftsRef, 
      where('recipientId', '==', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedGifts = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as GiftTransaction));
      // Sort client-side to avoid index requirement
      fetchedGifts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setGifts(fetchedGifts);
      setLoading(false);
    }, (err) => {
      console.error("Inbox listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <Layout>
      <div className="p-6 pb-24 max-w-2xl mx-auto flex flex-col gap-8">
        <div className="flex justify-start">
          <button 
            onClick={() => navigate(-1)} 
            className="p-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-xl flex flex-col items-center justify-center gap-1 border border-red-500"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">Back</span>
          </button>
        </div>
        <div className="text-center space-y-2 md:space-y-3 mt-2 md:mt-4">
          <div className="flex justify-center relative">
            <div className="bg-red-600/20 p-3 md:p-4 rounded-full border border-red-500/30">
              <Gift className="text-red-500 md:w-8 md:h-8" size={24} />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">Gift Inbox</h1>
          <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Live digital tokens from other users</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-red-600" size={32} />
            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Scanning Uplink...</span>
          </div>
        ) : gifts.length === 0 ? (
          <div className="py-20 text-center bg-zinc-950 border border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center">
            <Heart size={48} className="mb-4 text-zinc-800" />
            <p className="text-xs font-black uppercase tracking-widest">No signals received yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {gifts.map((gift) => (
              <div key={gift.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl md:rounded-3xl p-4 md:p-6 flex items-center gap-4 md:gap-6 shadow-xl hover:border-red-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10">
                   <Sparkles size={40} className="md:w-[60px] md:h-[60px] text-red-500" />
                </div>
                
                <div className="text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300 z-10">{gift.emoji}</div>
                <div className="flex-1 space-y-0.5 md:space-y-1 z-10">
                  <div className="flex items-center gap-2 text-zinc-500 font-bold uppercase tracking-widest text-[8px] md:text-[10px]">
                    <UserIcon size={10} className="md:w-3 md:h-3 text-red-600" />
                    Sent by <button 
                      onClick={() => navigate(`/gallery/${gift.senderId}`)}
                      className="text-red-500 hover:text-red-400 font-black transition-colors"
                      aria-label={`View profile of ${gift.senderName}`}
                    >
                      @{gift.senderName}
                    </button>
                  </div>
                  <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">Premium Icebreaker</h3>
                  <div className="flex items-center gap-2 text-zinc-600 text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                    <Calendar size={8} className="md:w-[10px] md:h-[10px]" />
                    {new Date(gift.timestamp).toLocaleDateString()} at {new Date(gift.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
