
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Heart, X, SendHorizontal, Loader2, CheckCircle2, Edit2, ShieldCheck, Users, Search, Terminal, Bug, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, arrayRemove, deleteField, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';
import { sendNotification } from '../services/notificationService';
import { UserMinus } from 'lucide-react';

export const Approaches: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userData: authUserData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [userData, setUserData] = useState<User | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cardComments, setCardComments] = useState<Record<string, string>>({});
  const [sessionComments, setSessionComments] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  
  // Debug & Admin State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Derived states from authUserData for real-time updates
  const following = authUserData?.following || [];
  const sentRequests = authUserData?.sentRequests || [];
  const isAdmin = useMemo(() => authUserData?.access?.toLowerCase() === 'admin', [authUserData]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'security' = 'info') => {
    const time = new Date().toLocaleTimeString();
    const icons = { info: '🔹', success: '✅', error: '❌', security: '🔐' };
    const logEntry = `[${time}] ${icons[type]} ${msg}`;
    setDebugLogs(prev => [logEntry, ...prev].slice(0, 50));
    console.log(`[Discovery-Debug] ${msg}`);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!currentUser) return;
    const initialize = async () => {
      setIsLocating(true);
      addLog(`Initializing discovery for UID: ${currentUser.uid}...`);
      
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as User;
          setUserData(data);
          
          const accessValue = data.access;
          if (accessValue?.toLowerCase() === 'admin') {
            addLog(`ADMIN ACCESS VERIFIED: Access field is set to "${accessValue}"`, 'security');
          } else {
            addLog(`Standard access detected: Access field is "${accessValue || 'undefined'}"`, 'info');
          }

          if (data.sentIntroComments) {
            setSessionComments(data.sentIntroComments);
          }
        }

        if ('geolocation' in navigator) {
          addLog("Requesting GPS coordinates...");
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              addLog(`Location acquired: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'success');
              await setDoc(doc(db, 'users', currentUser.uid), { location: { latitude, longitude } }, { merge: true });
              
              // Refresh user data locally after setting location
              setUserData(prev => prev ? { ...prev, location: { latitude, longitude } } : null);
              setIsLocating(false);
            },
            (err) => {
              addLog(`Location denied: ${err.message}`, 'error');
              setLocationError("Location access denied. Please enable location to find people nearby.");
              setIsLocating(false);
            }
          );
        } else {
          addLog("Geolocation API not supported by browser", 'error');
          setIsLocating(false);
        }
      } catch (err: any) {
        addLog(`Init failed: ${err.message}`, 'error');
      }
    };
    initialize();
  }, [currentUser]);

  useEffect(() => {
    const fetchUsers = async () => {
      addLog("Fetching all registered users from Firestore...");
      try {
        const snap = await getDocs(collection(db, 'users'));
        const fetched: User[] = [];
        snap.forEach(d => {
          if (d.id !== currentUser?.uid) {
            fetched.push({ ...d.data(), id: d.id } as User);
          }
        });
        addLog(`Retrieved ${fetched.length} potential connections.`, 'info');
        setUsers(fetched);
      } catch (err: any) {
        addLog(`Fetch failed: ${err.message}`, 'error');
      }
    };
    fetchUsers();
  }, [currentUser]);

  const handleFollowRequest = async (targetUserId: string) => {
    if (!currentUser || !targetUserId) return;
    const comment = cardComments[targetUserId] || "";
    
    setIsUpdating(targetUserId);
    try {
      const myId = currentUser.uid;
      const targetId = targetUserId;
      const myUserRef = doc(db, 'users', myId);
      const targetUserRef = doc(db, 'users', targetId);
      
      const targetUser = users.find(u => u.id === targetId);
      if (!targetUser) throw new Error("Target user not found");

      // Check if they already sent a request to us (mutual = match)
      const isMutual = targetUser.sentRequests?.includes(myId);
      
      const myUpdates: any = {};
      if (isMutual) {
        myUpdates.following = arrayUnion(targetId);
      }
      myUpdates.sentRequests = arrayUnion(targetId);

      if (comment.trim()) {
        myUpdates[`sentIntroComments.${targetId}`] = comment.trim();
        setSessionComments(prev => ({ ...prev, [targetId]: comment.trim() }));
      }

      await updateDoc(myUserRef, myUpdates);

      // Update target user
      const targetUpdates: any = {
        receivedRequests: arrayUnion(myId)
      };
      if (isMutual) {
        targetUpdates.following = arrayUnion(myId);
      }
      await updateDoc(targetUserRef, targetUpdates);

      if (isMutual) {
        // Create match document
        const matchId = [myId, targetId].sort().join('_');
        await setDoc(doc(db, 'matches', matchId), {
          participants: [myId, targetId],
          users: [myId, targetId],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          messages: []
        }, { merge: true });
      }

      // Send notification
      const myName = authUserData?.username || authUserData?.name || 'Someone';
      if (isMutual) {
        sendNotification(targetId, "New Match! 🔥", `${myName} followed you back! You can now chat.`);
      } else if (comment.trim()) {
        sendNotification(targetId, "New Message! 💬", `${myName} left a message under your photo: "${comment.trim()}"`);
      } else {
        sendNotification(targetId, "New Follower! ✨", `${myName} just followed you.`);
      }
      
      setCardComments(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setEditingCardId(null);
      addLog(`Approach sent to user ${targetId}`, 'success');
    } catch (e: any) {
      addLog(`Failed to send approach: ${e.message}`, 'error');
      alert("Permission denied or connection error. Try again.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!currentUser || !targetUserId) return;
    setIsUpdating(targetUserId);
    addLog(`Initiating unfollow for user ${targetUserId}...`, 'info');
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
      
      addLog(`Successfully unfollowed user ${targetUserId}`, 'success');
    } catch (err: any) {
      addLog(`Unfollow failed: ${err.message}`, 'error');
      alert(`Unfollow failed: ${err.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const startEditing = (userId: string, currentComment: string) => {
    setEditingCardId(userId);
    setCardComments(prev => ({ ...prev, [userId]: currentComment }));
  };

  const displayUsers = useMemo(() => {
    addLog(`Recalculating display list (Admin Status: ${isAdmin})...`, 'info');
    
    return users.filter(user => {
      const matchesSearch = 
        (user.username || user.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (isAdmin) {
        return true;
      }

      if (following.includes(user.id)) return false;

      if (userData?.preference) {
        const pref = userData.preference;
        if (pref === 'Men' && user.gender !== 'Male') return false;
        if (pref === 'Women' && user.gender !== 'Female') return false;
      }

      if (!userData?.location || !user.location) {
        return false;
      }

      const dist = calculateDistance(
        userData.location.latitude, 
        userData.location.longitude, 
        user.location.latitude, 
        user.location.longitude
      );

      return dist <= 5;
    });
  }, [users, authUserData, searchTerm, following, isAdmin]);

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8">
          <h2 className="text-red-500 font-black text-2xl text-center tracking-[0.15em] uppercase flex items-center gap-3">
             {isAdmin && <ShieldCheck className="text-red-600" size={28} />}
             {isAdmin ? "Admin Directory" : "Approachers Nearby"}
          </h2>
          
          <div className="flex flex-col items-center gap-2 mt-2">
            <button 
              onClick={() => navigate('/received-gifts')}
              className="text-[10px] text-zinc-400 hover:text-red-500 font-black uppercase tracking-widest flex items-center gap-2 mb-2 transition-colors"
              aria-label="View gifts you have received"
            >
              <Gift size={12} /> View My Received Gifts
            </button>
            {isAdmin && (
              <div className="flex gap-2">
                <span className="text-[10px] bg-red-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-red-900/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Global View Active
                </span>
                <button 
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showDebugPanel ? 'bg-zinc-800 text-red-500 border border-red-500/30' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
                  aria-label={showDebugPanel ? 'Hide debug panel' : 'Show debug panel'}
                >
                  <Bug size={12} /> {showDebugPanel ? 'Hide Logs' : 'Debug Logic'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Debug Panel */}
        {isAdmin && showDebugPanel && (
          <div className="mb-10 bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-top duration-300">
            <div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-900 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">System Logic Trace</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
                    <span className="text-[8px] font-black text-zinc-500 uppercase">Admin: {isAdmin ? 'YES' : 'NO'}</span>
                 </div>
                 <button onClick={() => setDebugLogs([])} className="text-[9px] font-black text-zinc-700 hover:text-white uppercase">Clear</button>
              </div>
            </div>
            <div className="p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1 bg-black/40">
              {debugLogs.length === 0 ? (
                <div className="text-zinc-800 italic text-center py-10">Awaiting system events...</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className={`pb-1 border-b border-zinc-900/30 last:border-0 ${log.includes('🔐') ? 'text-red-400 font-bold' : log.includes('❌') ? 'text-red-600' : 'text-zinc-500'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="mb-10 relative max-w-md mx-auto w-full group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-red-500 transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text"
              placeholder="Filter by name or username..."
              className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-red-600 transition-all shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
        
        {isLocating && !isAdmin ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <Loader2 className="animate-spin text-red-600" size={40} />
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Scanning Local Area...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {displayUsers.map(user => {
              const isSent = sentRequests.includes(user.id);
              const isMatch = following.includes(user.id);
              const myComment = sessionComments[user.id];
              const isCurrentlyUpdating = isUpdating === user.id;
              const isEditing = editingCardId === user.id || !myComment;
              
              const distance = userData?.location && user.location 
                ? calculateDistance(userData.location.latitude, userData.location.longitude, user.location.latitude, user.location.longitude)
                : null;

              return (
                <div key={user.id} className={`bg-zinc-950 border ${isSent ? 'border-red-900/40' : 'border-zinc-900'} rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-all hover:border-zinc-800`}>
                  <div className="cursor-pointer" onClick={() => navigate(`/gallery/${user.id}`)}>
                    <div className="relative aspect-[3/4]">
                      <img src={user.picture} className={`w-full h-full object-cover transition-all ${isSent ? 'opacity-40 grayscale' : 'opacity-100'}`} alt={user.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 text-white">
                        <h4 className="text-sm font-black truncate">{user.username || user.name}</h4>
                        <p className="text-[10px] font-bold opacity-80 flex items-center gap-1.5 uppercase tracking-widest">
                          <MapPin size={10} className="text-red-500" /> 
                          {distance !== null ? `${distance.toFixed(1)} mi` : 'Location Private'}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-950 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Status</span>
                          <p className={`text-xs font-black uppercase tracking-widest ${user.status.includes('Not Open') ? 'text-zinc-600' : 'text-green-500'}`}>
                            {user.status}
                          </p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Approach Style</span>
                        <p className="text-sm text-zinc-400 italic line-clamp-2">"{user.approachStyle || "Just come say hi!"}"</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex border-t border-zinc-900 h-20">
                    <button 
                      onClick={() => setUsers(prev => prev.filter(u => u.id !== user.id))} 
                      className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors border-r border-red-500/30"
                      aria-label="Dismiss this user"
                    >
                      <X size={20} />
                      <span className="text-[10px] uppercase font-black mt-1">Dismiss</span>
                    </button>
                    <button 
                      onClick={() => navigate(`/gifts?to=${user.id}`)} 
                      className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors border-r border-red-500/30"
                      aria-label="Send gift to this user"
                    >
                      <Gift size={20} />
                      <span className="text-[10px] uppercase font-black mt-1">Gift</span>
                    </button>
                    {!isSent && !isMatch ? (
                      <button 
                        onClick={() => handleFollowRequest(user.id)} 
                        disabled={isCurrentlyUpdating}
                        className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                        aria-label="Send approach request"
                      >
                        {isCurrentlyUpdating ? <Loader2 className="animate-spin" size={20} /> : <Heart size={20} />}
                        <span className="text-[10px] uppercase font-black mt-1">Approach</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleUnfollow(user.id)} 
                        disabled={isCurrentlyUpdating}
                        className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                        aria-label="Unfollow this user"
                      >
                        {isCurrentlyUpdating ? <Loader2 className="animate-spin" size={20} /> : <UserMinus size={20} />}
                        <span className="text-[10px] uppercase font-black mt-1">Unfollow</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};
