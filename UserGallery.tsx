
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, deleteField, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { ArrowLeft, Heart, ImageIcon, MapPin, CheckCircle2, UserMinus, Loader2, AlertCircle, HelpCircle, Share2, Check, Film, Gift, Trophy, X, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User, GiftTransaction } from '../types';
import { sendNotification } from '../services/notificationService';

export const UserGallery: React.FC = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [receivedGifts, setReceivedGifts] = useState<GiftTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [unfollowSuccess, setUnfollowSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|mov|webm|quicktime)/) || url.includes('.mp4?');
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId || !currentUser) return;
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data() as User;
          setUser({ ...data, id: userDoc.id });
          
          // Fetch Public Gifts for this user
          const giftsRef = collection(db, 'gifts');
          const q = query(giftsRef, where('recipientId', '==', userId));
          const giftSnap = await getDocs(q);
          const fetchedGifts = giftSnap.docs.map(d => d.data() as GiftTransaction);
          setReceivedGifts(fetchedGifts);

          const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (myDoc.exists()) {
            const myData = myDoc.data() as User;
            setIsRequested(myData.sentRequests?.includes(userId) || false);
            setIsConnected(myData.following?.includes(userId) || false);
          }
        } else {
          setError('User not found');
        }
      } catch (err) {
        setError('Failed to load gallery');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [userId, currentUser]);

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const handleApproach = async () => {
    if (!currentUser || !user || isRequested || isConnected) return;
    setActionLoading(true);
    try {
      const myId = currentUser.uid;
      const targetId = user.id;
      const myRef = doc(db, 'users', myId);
      const targetRef = doc(db, 'users', targetId);

      // Check if they already sent a request to us (mutual = match)
      const isMutual = user.sentRequests?.includes(myId);
      
      if (isMutual) {
        // It's a match!
        await updateDoc(myRef, { 
          following: arrayUnion(targetId),
          sentRequests: arrayUnion(targetId) 
        });
        await updateDoc(targetRef, { 
          following: arrayUnion(myId),
          receivedRequests: arrayUnion(myId)
        });

        // Create match document
        const matchId = [myId, targetId].sort().join('_');
        await setDoc(doc(db, 'matches', matchId), {
          participants: [myId, targetId],
          users: [myId, targetId],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          messages: []
        }, { merge: true });

        setIsConnected(true);
        const myName = userData?.username || userData?.name || 'Someone';
        sendNotification(targetId, "New Match! 🔥", `${myName} followed you back! You can now chat.`);
      } else {
        // Standard follow request
        await updateDoc(myRef, { sentRequests: arrayUnion(targetId) });
        await updateDoc(targetRef, { receivedRequests: arrayUnion(myId) });
        
        const myName = userData?.username || userData?.name || 'Someone';
        sendNotification(targetId, "New Follower! ✨", `${myName} just followed you.`);
        setIsRequested(true);
      }
    } catch (err: any) {
      console.error("Approach failed:", err);
      alert("Failed to send request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser || !user || !isConnected) return;
    if (!confirmUnfollow) {
      setConfirmUnfollow(true);
      return;
    }
    setActionLoading(true);
    try {
      const myId = currentUser.uid;
      const targetId = user.id;
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
      
      setIsConnected(false);
      setIsRequested(false);
      setConfirmUnfollow(false);
      setUnfollowSuccess(true);
      
      // Instead of navigating away, we stay on the page so the user sees the "Approach" button again
      setTimeout(() => {
        setUnfollowSuccess(false);
      }, 3000);
    } catch (err: any) {
      alert(`Unfollow failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout showNav={false}>
        <div className="flex-1 flex items-center justify-center bg-black">
          <Loader2 className="animate-spin text-red-600" size={40} />
        </div>
      </Layout>
    );
  }

  if (error || !user) {
    return (
      <Layout showNav={false}>
        <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 text-center">
          <p className="text-red-500 font-bold mb-4">{error || "User not found"}</p>
          <button onClick={() => navigate(-1)} className="text-white underline font-black uppercase text-xs">Go Back</button>
        </div>
      </Layout>
    );
  }

  const allPhotos = [user.picture, ...(user.photos || [])];

  return (
    <Layout showNav={false} disableScroll={false}>
      <div className="flex flex-col min-h-screen bg-black pb-60">
        {/* Header */}
        <div className="sticky top-0 z-50 p-5 flex justify-between items-center bg-black/80 backdrop-blur-xl border-b border-white/5">
          <button 
            onClick={() => navigate(-1)} 
            className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white border border-white/10 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-red-600 font-black uppercase tracking-[0.25em] text-[10px] mb-0.5">Collection</h1>
            <p className="text-white font-black text-sm">@{user.username || user.name}</p>
          </div>
          <button 
            onClick={handleShare} 
            className={`p-3 rounded-full border transition-all ${shareSuccess ? 'bg-green-600 text-white border-green-500' : 'bg-white/5 text-zinc-500 border-white/10'}`}
            aria-label={shareSuccess ? "Profile link copied" : "Share this profile"}
          >
            {shareSuccess ? <Check size={18} /> : <Share2 size={18} />}
          </button>
        </div>

        {/* Info Area */}
        <div className="px-6 pt-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <MapPin className="text-red-500" size={16} />
            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{user.city || 'Nearby'}</span>
          </div>
          <p className="text-sm text-zinc-300 italic bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800/50">"{user.approachStyle || "Just say hi!"}"</p>
        </div>

        {/* Digital Trophies / Gifts Section */}
        {receivedGifts.length > 0 && (
          <div className="px-6 mt-10">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="text-yellow-500" size={18} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Digital Trophies</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {receivedGifts.map((gift, i) => (
                <button 
                  key={i} 
                  onClick={() => navigate(`/gallery/${gift.senderId}`)}
                  className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center justify-center text-2xl shadow-lg hover:border-red-600/50 transition-all active:scale-95" 
                  title={`From ${gift.senderName}`}
                >
                  {gift.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="mt-10 px-3">
          <div className="grid grid-cols-2 gap-2">
            {allPhotos.map((url, index) => (
              <button 
                key={index} 
                onClick={() => setSelectedImage(url)}
                className="relative overflow-hidden aspect-square rounded-2xl border border-zinc-900 bg-zinc-950 group active:scale-[0.98] transition-all"
              >
                {isVideoUrl(url) ? (
                  <video src={url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                ) : (
                  <img src={url} alt={`Coll ${index}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Sparkles className="text-white/50" size={24} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Image Preview Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative w-full max-w-2xl aspect-square md:aspect-auto md:max-h-[80vh] flex items-center justify-center">
              <button 
                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                onClick={() => setSelectedImage(null)}
              >
                <X size={32} />
              </button>
              {isVideoUrl(selectedImage) ? (
                <video 
                  src={selectedImage} 
                  className="w-full h-full object-contain rounded-3xl shadow-2xl" 
                  controls 
                  autoPlay 
                  loop 
                />
              ) : (
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="w-full h-full object-contain rounded-3xl shadow-2xl" 
                />
              )}
            </div>
          </div>
        )}

        {/* Fixed Action Footer */}
        <div className="fixed bottom-6 md:bottom-10 left-4 right-4 z-40 max-w-md mx-auto flex flex-col gap-2 md:gap-3 pb-[env(safe-area-inset-bottom)]">
           {unfollowSuccess ? (
             <div className="w-full py-4 md:py-5 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-4 animate-in zoom-in-95 duration-300 shadow-2xl shadow-green-900/40">
               <CheckCircle2 size={20} className="md:w-[22px] md:h-[22px]" /> Successfully Unfollowed
             </div>
           ) : (
             <>
               <button 
                 onClick={() => navigate(`/gifts?to=${user.id}`)}
                 className="w-full py-4 md:py-5 bg-red-600 border border-red-500 rounded-[2rem] text-white font-black uppercase tracking-widest text-[10px] md:text-xs flex flex-col items-center justify-center gap-1 hover:bg-red-700 transition-all shadow-xl"
                 aria-label="Send a premium gift to this user"
               >
                 <Gift size={18} className="md:w-5 md:h-5" />
                 <span>Send Premium Gift</span>
               </button>

                {!isConnected ? (
                <button 
                  onClick={handleApproach}
                  disabled={actionLoading || isRequested}
                  className={`w-full py-5 md:py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs md:text-sm flex flex-col items-center justify-center gap-1 transition-all shadow-2xl ${isRequested ? 'bg-zinc-900 text-zinc-600 border border-zinc-800' : 'bg-red-600 text-white shadow-red-900/40 hover:bg-red-700'}`}
                  aria-label={isRequested ? 'Approach request pending' : 'Approach this user'}
                >
                  {actionLoading ? <Loader2 className="animate-spin md:w-[22px] md:h-[22px]" size={20} /> : isRequested ? <><CheckCircle2 size={20} className="md:w-[22px] md:h-[22px]" /> <span>Pending</span></> : <><Heart size={20} className="md:w-[22px] md:h-[22px]" fill="currentColor" /> <span>Approach</span></>}
                </button>
               ) : (
                <button 
                  onClick={handleUnfollow}
                  disabled={actionLoading}
                  className={`w-full py-5 md:py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs md:text-sm flex flex-col items-center justify-center gap-1 transition-all shadow-2xl ${confirmUnfollow ? 'bg-red-600 text-white' : 'bg-red-600 text-white border border-red-500 hover:bg-red-700'}`}
                  aria-label={confirmUnfollow ? 'Confirm unfollow' : 'Unfollow this user'}
                >
                  {actionLoading ? <Loader2 className="animate-spin md:w-[22px] md:h-[22px]" size={20} /> : confirmUnfollow ? <span>Confirm Unfollow?</span> : <><UserMinus size={20} className="md:w-[22px] md:h-[22px]" /> <span>Unfollow</span></>}
                </button>
               )}
             </>
           )}
        </div>
      </div>
    </Layout>
  );
};
