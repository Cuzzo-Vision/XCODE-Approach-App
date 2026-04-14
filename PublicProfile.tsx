
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { ArrowLeft, UserPlus, MessageCircle, Check, ImageIcon, Film, X, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';
import { sendNotification } from '../services/notificationService';

export const PublicProfile: React.FC = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|mov|webm|quicktime)/) || url.includes('.mp4?');
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!username || !currentUser) return;
      setLoading(true);
      setError('');
      try {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          const idSnap = await getDoc(doc(db, 'users', username));
          if (idSnap.exists()) {
             setUser({ ...idSnap.data(), id: idSnap.id } as User);
          } else {
             setError('User not found');
          }
        } else {
          const userData = querySnapshot.docs[0].data() as User;
          setUser({ ...userData, id: querySnapshot.docs[0].id });
        }
        const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (myDoc.exists()) setCurrentUserData({ ...myDoc.data(), id: myDoc.id } as User);
      } catch (err) { setError('Could not load profile.'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [username, currentUser]);

  const handleFollowRequest = async () => {
    if (!currentUser || !user) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { sentRequests: arrayUnion(user.id) });
      await updateDoc(doc(db, 'users', user.id), { receivedRequests: arrayUnion(currentUser.uid) });
      
      // Send notification
      const myName = currentUserData?.username || currentUserData?.name || 'Someone';
      const isMutual = user.sentRequests?.includes(currentUser.uid);
      
      if (isMutual) {
        sendNotification(user.id, "New Match! 🔥", `${myName} followed you back! You can now chat.`);
      } else {
        sendNotification(user.id, "New Follower! ✨", `${myName} just followed you.`);
      }

      if (currentUserData) {
          setCurrentUserData({ ...currentUserData, sentRequests: [...(currentUserData.sentRequests || []), user.id] });
      }
    } catch (error) { alert("Failed to send request."); }
    finally { setActionLoading(false); }
  };

  if (loading) return <Layout><div className="p-8 text-center animate-pulse font-bold text-zinc-500 uppercase tracking-widest">Loading Profile...</div></Layout>;
  if (error || !user) return <Layout><div className="p-8 text-center text-red-500 font-bold">{error || "User not found"}</div></Layout>;

  const isMe = currentUser?.uid === user.id;
  const isFollowing = currentUserData?.following?.includes(user.id);
  const isRequested = currentUserData?.sentRequests?.includes(user.id);

  return (
    <Layout>
      <div className="flex flex-col min-h-screen bg-black">
        {/* Navigation Header */}
        <div className="sticky top-0 z-50 p-4 bg-black/80 backdrop-blur-xl border-b border-white/5 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 bg-white/5 text-white rounded-full border border-white/10 shadow-xl hover:bg-white/10 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-black text-white uppercase tracking-widest">@{user.username || user.name}</h1>
          </div>
        </div>

        {/* Gallery Section */}
        <div className="p-4 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-white">{user.username || user.name}'s Gallery</h1>
                <ImageIcon className="text-red-600" size={24} />
            </div>
            
            {/* Massive Grid Gallery */}
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setSelectedImage(user.picture)}
                className="w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-950 relative group active:scale-[0.99] transition-all"
              >
                {isVideoUrl(user.picture) ? (
                  <>
                    <video src={user.picture} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                    <div className="absolute top-4 left-4 p-2 bg-black/60 backdrop-blur-md rounded-xl text-white z-10">
                      <Film size={16} />
                    </div>
                  </>
                ) : (
                  <img src={user.picture} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Main" />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Sparkles className="text-white/50" size={32} />
                </div>
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                {user.photos?.map((url, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedImage(url)}
                    className="w-full aspect-square rounded-2xl overflow-hidden border border-zinc-800 shadow-lg bg-zinc-950 relative group active:scale-[0.98] transition-all"
                  >
                    {isVideoUrl(url) ? (
                      <>
                        <video src={url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                        <div className="absolute top-2 left-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white z-10">
                          <Film size={12} />
                        </div>
                      </>
                    ) : (
                      <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={`Gallery ${i}`} />
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Sparkles className="text-white/30" size={20} />
                    </div>
                  </button>
                ))}
                
                {(!user.photos || user.photos.length === 0) && (
                    <div className="col-span-2 py-12 flex flex-col items-center justify-center bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-800 opacity-20">
                        <ImageIcon size={48} />
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-4">No additional photos</p>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Minimalist Bottom Bar */}
        <div className="sticky bottom-0 bg-black/90 backdrop-blur-xl border-t border-white/5 p-6 flex gap-4 mt-auto">
          {isMe ? (
            <button 
              onClick={() => navigate('/profile')} 
              className="flex-1 bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 transition-colors uppercase tracking-widest text-xs"
              aria-label="Edit your own profile"
            >
              Edit My Profile
            </button>
          ) : isFollowing ? (
            <button 
              onClick={() => navigate(`/chats/conversation/${user.id}`, { state: { user } })} 
              className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-red-600/20 uppercase tracking-widest text-xs"
              aria-label={`Start a chat with ${user.username || user.name}`}
            >
              <MessageCircle size={18} /> Chat Now
            </button>
          ) : isRequested ? (
            <button 
              disabled 
              className="flex-1 bg-zinc-800 text-zinc-500 font-black py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed uppercase tracking-widest text-xs"
              aria-label="Follow request already sent"
            >
              <Check size={18} /> Requested
            </button>
          ) : (
            <button 
              onClick={handleFollowRequest} 
              disabled={actionLoading} 
              className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-red-600/20 active:scale-95 transition-transform uppercase tracking-widest text-xs"
              aria-label={`Send follow request to ${user.username || user.name}`}
            >
              {actionLoading ? "Processing..." : <><UserPlus size={18} /> Follow</>}
            </button>
          )}
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
      </div>
    </Layout>
  );
};
