
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Message, User } from '../types';
import { sendNotification } from '../services/notificationService';

export const ChatConversation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: targetUserId } = useParams();
  const { currentUser, userData } = useAuth();
  
  const [chatUser, setChatUser] = useState<User | null>(location.state?.user || null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch target user info if missing
  useEffect(() => {
    if (!chatUser && targetUserId) {
        const fetchUser = async () => {
            try {
                const snap = await getDoc(doc(db, 'users', targetUserId));
                if (snap.exists()) {
                    setChatUser({ ...snap.data(), id: snap.id } as User);
                }
            } catch (err) {
                console.error("Error fetching chat user", err);
            }
        };
        fetchUser();
    }
  }, [chatUser, targetUserId]);

  // Initialize Chat and Listen
  useEffect(() => {
    if (!currentUser || !targetUserId) return;

    const ids = [currentUser.uid, targetUserId].sort();
    const matchId = ids.join('_');
    const matchDocRef = doc(db, 'matches', matchId);
    
    let unsubscribe: (() => void) | null = null;

    const initChatListener = () => {
        unsubscribe = onSnapshot(matchDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const loadedMessages = (data.messages || []).map((msg: any) => ({
                    id: msg.id,
                    text: msg.text,
                    sender: msg.senderId === currentUser.uid ? 'me' : 'other',
                    createdAt: msg.createdAt
                }));
                
                // Sort messages by time
                loadedMessages.sort((a: any, b: any) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                setMessages(loadedMessages);
                setError(null);
            } else {
                // If doc doesn't exist yet (navigated directly), we wait for send to create it
                // or just show empty.
                setMessages([]);
            }
        }, (err) => {
            console.error("Snapshot error:", err);
            if (err.code === 'permission-denied') {
                setError("You do not have permission to view this chat.");
            } else {
                 setError("Connection error. Please try again.");
            }
        });
    };

    initChatListener();

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [currentUser, targetUserId]);

  // Auto-scroll
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !currentUser || !targetUserId) return;

    const textToSend = messageText;
    setMessageText(''); // Clear input for speed

    const ids = [currentUser.uid, targetUserId].sort();
    const matchId = ids.join('_');
    const matchDocRef = doc(db, 'matches', matchId);

    // Create a unique message object
    // Note: serverTimestamp() is not supported inside arrayUnion elements in some SDK versions/rules configs,
    // so we use ISO string for the message array timestamp.
    const newMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        text: textToSend,
        senderId: currentUser.uid,
        createdAt: new Date().toISOString()
    };

    try {
        // Use setDoc with merge: true to handle both creation (if missing) and update
        // This ensures the match document exists and adds the message to the array
        await setDoc(matchDocRef, {
            participants: ids,
            users: ids, // Redundancy
            lastMessage: textToSend,
            lastUpdated: serverTimestamp(),
            messages: arrayUnion(newMessage)
        }, { merge: true });

        // Send notification
        if (targetUserId) {
            const myName = userData?.username || userData?.name || 'Someone';
            sendNotification(targetUserId, `New message from ${myName}`, textToSend);
        }

    } catch (err: any) {
        console.error("Send error:", err);
        setMessageText(textToSend); // Restore text on failure
        if (err.code === 'permission-denied') {
            alert("Permission denied. Could not send message.");
        } else {
            alert("Failed to send message. Check your connection.");
        }
    }
  };

  const formatMessageTime = (createdAt?: string) => {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return isToday ? timeStr : `${date.toLocaleDateString()} ${timeStr}`;
  };

  if (!chatUser && !targetUserId) return <Layout><div className="p-4 text-white">Loading...</div></Layout>;

  return (
    <Layout showNav={false} disableScroll={true}>
      <div className="flex flex-col h-full bg-black">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black sticky top-0 z-10 shadow-sm">
          <button 
            onClick={() => navigate(-1)} 
            className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="text-red-500" size={24} />
          </button>
          <div className="flex flex-col items-center">
             <h2 className="text-red-500 font-bold text-lg">
                {chatUser ? (chatUser.username || chatUser.name) : 'Loading...'}
             </h2>
          </div>
          <div className="w-6" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth">
          {error && (
              <div className="bg-red-900/20 border border-red-800 p-3 rounded text-red-400 text-sm text-center">
                  {error}
              </div>
          )}
          
          {messages.length === 0 && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-60 mt-10">
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs">Say hello!</p>
              </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${
                msg.sender === 'me' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`p-3 rounded-xl text-sm break-words shadow-sm ${
                  msg.sender === 'me'
                    ? 'bg-red-600 text-white rounded-br-none'
                    : 'bg-white text-black rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
              <span className={`text-[10px] text-zinc-500 mt-1 px-1 ${msg.sender === 'me' ? 'text-right' : 'text-left'}`}>
                  {formatMessageTime(msg.createdAt)}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-2 md:p-3 bg-black border-t border-zinc-800 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={!!error}
            className="flex-1 bg-zinc-900 text-white placeholder-gray-500 rounded-full px-4 py-2.5 md:py-3 focus:outline-none focus:ring-1 focus:ring-red-500 transition-shadow disabled:opacity-50 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || !!error}
            className="bg-red-600 p-3 md:p-4 rounded-2xl text-white hover:bg-red-700 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
            aria-label="Send message"
          >
            <Send size={18} className="md:w-5 md:h-5" />
            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">Send</span>
          </button>
        </div>
      </div>
    </Layout>
  );
};
