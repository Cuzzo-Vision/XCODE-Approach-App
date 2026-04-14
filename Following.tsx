
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  deleteField,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';
import { MapPin, Loader2, X, Gift, UserMinus } from 'lucide-react';

export const Following: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [matches, setMatches] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleUnfollow = async (targetUserId: string) => {
    if (!currentUser || !targetUserId) return;
    setIsUpdating(targetUserId);
    try {
      const myId = currentUser.uid;
      const targetId = targetUserId;
      
      await updateDoc(doc(db, 'users', myId), {
        following: arrayRemove(targetId),
        sentRequests: arrayRemove(targetId),
        [`sentIntroComments.${targetId}`]: deleteField()
      });
      
      await updateDoc(doc(db, 'users', targetId), {
        following: arrayRemove(myId),
        receivedRequests: arrayRemove(myId)
      });
      
      const matchId = [myId, targetId].sort().join('_');
      await deleteDoc(doc(db, 'matches', matchId));
      
    } catch (err: any) {
      console.error("Unfollow failed:", err);
      alert(`Unfollow failed: ${err.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  // Real-time listener for the User document to track mutual matches
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = onSnapshot(doc(db, 'users', currentUser.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const followingIds: string[] = data.following || [];

        if (followingIds.length === 0) {
          setMatches([]);
        } else {
          try {
            // Fetch profile details for everyone in the following list
            const profileSnaps = await Promise.all(
              followingIds.map(id => getDoc(doc(db, 'users', id)))
            );
            const fetchedMatches = profileSnaps
              .filter(s => s.exists())
              .map(s => ({ ...s.data(), id: s.id } as User));
            setMatches(fetchedMatches);
          } catch (err) {
            console.error("Error fetching match profiles:", err);
          }
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("User document listener error:", err);
      setLoading(false);
    });

    return () => {
      userDocRef();
    };
  }, [currentUser]);

  const UserCard: React.FC<{ user: User }> = ({ user }) => {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden flex flex-col relative group transition-all shadow-xl">
        <div className="cursor-pointer" onClick={() => navigate(`/gallery/${user.id}`)}>
          <div className="relative aspect-[3/4]">
            <img 
              src={user.picture} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              alt={user.username || user.name} 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-6 left-6 text-white">
              <h4 className="font-black text-lg">{user.username || user.name}</h4>
              <p className="text-xs flex items-center gap-1.5 font-bold uppercase tracking-widest opacity-70 mt-1">
                <MapPin size={14} className="text-red-600" /> {user.city || 'Nearby'}
              </p>
            </div>
          </div>
          
          <div className="p-5 flex flex-col gap-4 bg-zinc-950">
            <div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1.5 block">Status</span>
              <p className={`text-xs font-black uppercase tracking-widest ${user.status?.includes('Not Open') ? 'text-zinc-600' : 'text-green-500'}`}>
                {user.status}
              </p>
            </div>
            
            <div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1.5 block">Approach Style</span>
              <p className="text-sm text-zinc-400 italic leading-relaxed">
                "{user.approachStyle || "Just come say hi!"}"
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex border-t border-zinc-900 h-20">
           <button 
             onClick={() => navigate('/received-gifts')}
             className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 border-r border-red-500/30 text-[10px] font-black uppercase tracking-widest transition-colors"
             aria-label="View your received gifts"
           >
             <Gift size={18} />
             <span className="mt-1">My Gifts</span>
           </button>
           <button 
             onClick={() => navigate(`/gifts?to=${user.id}`)}
             className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 border-r border-red-500/30 gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
             aria-label={`Send a gift to ${user.username || user.name}`}
           >
             <Gift size={18} />
             <span>Send Gift</span>
           </button>
           <button 
             onClick={() => handleUnfollow(user.id)}
             disabled={isUpdating === user.id}
             className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 gap-1 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
             aria-label={`Unfollow ${user.username || user.name}`}
           >
             {isUpdating === user.id ? <Loader2 className="animate-spin" size={18} /> : <UserMinus size={18} />}
             <span>Unfollow</span>
           </button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto pb-24">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-red-500 font-black text-3xl text-center tracking-[0.2em] uppercase">Matches</h2>
          <div className="h-1 w-20 bg-red-600 mt-2 rounded-full opacity-50" />
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
             <Loader2 className="animate-spin text-red-600" size={40} />
             <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Syncing Matches...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {matches.map(u => (
                <UserCard key={u.id} user={u} />
              ))}
              
              {matches.length === 0 && !loading && (
                <div className="col-span-full py-32 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-20 flex flex-col items-center justify-center">
                  <X size={48} className="mb-4 text-zinc-800" />
                  <p className="font-black uppercase tracking-widest text-xs">No active connections</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
