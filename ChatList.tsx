import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageCircle, Users } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';

interface ChatPreview {
    chatId: string;
    user: User;
    lastMessage?: string;
    lastUpdated?: any;
}

export const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      if (!currentUser) return;

      try {
        // Query matches where current user is a participant
        // Using 'matches' collection as per Firestore rules
        const matchesRef = collection(db, 'matches');
        const q = query(matchesRef, where('participants', 'array-contains', currentUser.uid));
        
        const querySnapshot = await getDocs(q);
        
        const previews: ChatPreview[] = [];

        // Map through matches and fetch other user's details
        const promises = querySnapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const participants: string[] = chatData.participants || [];
            
            // Find the other user's ID
            const otherUserId = participants.find(id => id !== currentUser.uid);
            
            if (otherUserId) {
                try {
                    const userDocSnap = await getDoc(doc(db, 'users', otherUserId));
                    if (userDocSnap.exists()) {
                        const otherUser = { ...userDocSnap.data(), id: otherUserId } as User;
                        previews.push({
                            chatId: chatDoc.id,
                            user: otherUser,
                            lastMessage: chatData.lastMessage || '',
                            lastUpdated: chatData.lastUpdated
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to fetch user ${otherUserId}`, e);
                }
            }
        });

        await Promise.all(promises);

        // Client-side sort by lastUpdated desc
        previews.sort((a, b) => {
            const timeA = a.lastUpdated?.toMillis ? a.lastUpdated.toMillis() : 0;
            const timeB = b.lastUpdated?.toMillis ? b.lastUpdated.toMillis() : 0;
            return timeB - timeA;
        });

        setChatPreviews(previews);
        
      } catch (error) {
        console.error("Error fetching chats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [currentUser]);

  return (
    <Layout>
      <div className="p-4 pb-20 h-full flex flex-col">
        <h2 className="text-red-500 font-bold text-center text-xl mb-6">Chats</h2>

        {loading ? (
           <div className="text-center text-gray-500 mt-10 animate-pulse">Loading chats...</div>
        ) : (
            <div className="flex flex-col gap-3">
              {chatPreviews.map(({ chatId, user, lastMessage, lastUpdated }) => (
                <button
                  key={chatId}
                  onClick={() => navigate(`/chats/conversation/${user.id}`, { state: { user } })}
                  className="bg-zinc-900 border border-zinc-800 w-full rounded-xl p-3 flex items-center shadow-sm hover:bg-zinc-800 transition-colors"
                  aria-label={`Open chat with ${user.username || user.name}`}
                >
                  <img 
                    src={user.picture || "https://ui-avatars.com/api/?background=random"} 
                    alt={user.name} 
                    className="w-14 h-14 rounded-full mr-4 object-cover border border-zinc-700" 
                  />
                  
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-white font-bold text-lg truncate">{user.username || user.name}</h3>
                        {lastUpdated && (
                             <span className="text-[10px] text-gray-500 ml-2">
                                 {new Date(lastUpdated.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                        )}
                    </div>
                    <p className={`text-sm truncate ${lastMessage ? 'text-gray-300' : 'text-gray-500 italic'}`}>
                        {lastMessage || "No messages yet"}
                    </p>
                  </div>
                  
                  <ChevronRight className="text-gray-500 flex-shrink-0 ml-2" size={20} />
                </button>
              ))}
              
              {chatPreviews.length === 0 && (
                <div className="flex flex-col items-center justify-center mt-20 opacity-60">
                    <MessageCircle size={48} className="text-gray-600 mb-4" />
                    <p className="text-gray-400 text-center font-medium">No active conversations.</p>
                    <p className="text-gray-500 text-sm text-center mt-2 px-6">
                        Start a chat from your 'Matches' list.
                    </p>
                    <button 
                        onClick={() => navigate('/following')}
                        className="mt-6 flex flex-col items-center gap-1 bg-red-600 text-white font-black text-[10px] px-8 py-4 rounded-2xl border border-red-500 hover:bg-red-700 transition-all uppercase tracking-widest shadow-xl"
                        aria-label="Go to matches page"
                    >
                        <Users size={18} />
                        <span>Go to Matches</span>
                    </button>
                </div>
              )}
            </div>
        )}
      </div>
    </Layout>
  );
};