
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  Gift, CreditCard, CheckCircle2, X,
  Loader2, Sparkles, Trophy, Heart, Search, Users, MapPin,
  ChevronRight, ShieldCheck, Terminal, Bug, Lock, ArrowLeft,
  ExternalLink, AlertTriangle
} from 'lucide-react';

import {
  doc, updateDoc, arrayUnion, getDoc,
  collection, addDoc, getDocs, query, where
} from 'firebase/firestore';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { EmojiGift, GiftTransaction, User } from '../types';
import { sendNotification } from '../services/notificationService';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

/* ---------------- GIFT CATALOG ---------------- */
const GIFTS: EmojiGift[] = [
  { id: '0', emoji: '❤️', name: 'Free Heart', price: 0, description: 'A small token of appreciation.', rarity: 'Common' },
  { id: '1', emoji: '🔥', name: 'Hot Approach', price: 0.99, description: 'Instant chemistry.', rarity: 'Common' },
  { id: '2', emoji: '💎', name: 'Diamond Intro', price: 4.99, description: 'Premium attention.', rarity: 'Legendary' },
  { id: '3', emoji: '🌹', name: 'Classic Rose', price: 1.99, description: 'Timeless gesture.', rarity: 'Rare' },
  { id: '4', emoji: '🥂', name: 'Cheers!', price: 2.99, description: 'Celebrate the moment.', rarity: 'Rare' },
  { id: '5', emoji: '⚡', name: 'Electric Spark', price: 0.99, description: 'Instant vibe.', rarity: 'Common' },
  { id: '6', emoji: '👑', name: 'Royal Greeting', price: 9.99, description: 'Command attention.', rarity: 'Legendary' }
];

const GIFT_STRIPE_LINKS: Record<string, string> = {
  /* ---------------- Hot Emoji------------------- */
  '1': 'https://buy.stripe.com/28E8wReEee5jcBG7zE6Vq01',

  /* ---------------- Diamond Emoji--------------- */
  '2': 'https://buy.stripe.com/14AeVf8fQ0etatydY26Vq02',

  /* ---------------- Rose Emoji------------------ */
  '3': 'https://buy.stripe.com/aFa9AV53E6CRbxC8DI6Vq03',

  /* ---------------- Cheers Emoji---------------- */
  '4': 'https://buy.stripe.com/9B6cN72Vwf9n45a9HM6Vq04',

  /* ---------------- Electric Spark Emoji-------- */
  '5': 'https://buy.stripe.com/9B63cx2Vw6CRdFKaLQ6Vq05',

  /* ---------------- Royal Crown Emoji----------- */
  '6': 'https://buy.stripe.com/9B6aEZ8fQd1f59e07c6Vq06'
};

/* ---------------- STRIPE INIT ---------------- */
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51SuoAFImBzc6m9zaSjGhv5qb4WVGE3Bf7S1z98yceSzuuu3WFDOgJNId4iWa3naazTmlAZ90a8eEISYwu7BuBOZG00vm7DVPvT';
const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

/* ---------------- STRIPE CHECKOUT FORM ---------------- */
interface StripeFormProps {
  isAdmin: boolean;
  selectedGift: EmojiGift;
  recipient: User;
  currentUser: any;
  onSuccess: () => void;
  addLog: (msg: string, type?: any) => void;
  simulateDispatch: boolean;
}

const StripeCheckoutForm: React.FC<StripeFormProps> = ({ isAdmin, selectedGift, recipient, currentUser, onSuccess, addLog, simulateDispatch }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const price = (isAdmin || simulateDispatch) ? 0 : (selectedGift?.price || 0);
  const stripeLink = GIFT_STRIPE_LINKS[selectedGift.id] || '#';

  const handleVerify = async () => {
    addLog('SYSTEM: Initializing verification sequence...', 'info');
    if (!currentUser) return addLog('AUTH_ERROR: No active session found.', 'error');
    setIsProcessing(true);
    setVerificationError('');

    try {
      if (price === 0 || isAdmin || simulateDispatch) {
        addLog(simulateDispatch ? 'SIMULATION_MODE: Dispatch simulated' : 'ADMIN_BYPASS: Zero-value transaction authorized', 'security');
      } else {
        addLog('VERIFICATION_PHASE: Scanning global ledger...', 'info');
        const paymentsRef = collection(db, 'gift_payments');
        const q = query(
          paymentsRef, 
          where('email', '==', currentUser.email.toLowerCase()),
          where('giftId', '==', selectedGift.id),
          where('status', 'in', ['succeeded', 'paid'])
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("No payment record found for this gift. If you just paid, please wait 30 seconds for the Stripe relay to sync.");
        }
        addLog('STRIPE_SUCCESS: Payment verified', 'success');
      }

      // ---------------- RECORD GIFT IN FIRESTORE ----------------
      addLog('DATABASE_PHASE: Indexing gift...', 'info');
      const senderSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const senderName = senderSnap.data()?.username || 'User';

      await addDoc(collection(db, 'gifts'), {
        senderId: currentUser.uid,
        senderName,
        recipientId: recipient.id,
        recipientName: recipient.username || recipient.name,
        emoji: selectedGift.emoji,
        emojiId: selectedGift.id,
        timestamp: new Date().toISOString()
      } as Omit<GiftTransaction, 'id'>);

      // Send notification
      sendNotification(recipient.id, "New Gift! 🎁", `${senderName} sent you a ${selectedGift.emoji} ${selectedGift.name}!`);

      addLog('DATABASE_SUCCESS: Gift recorded', 'success');
      onSuccess();
    } catch (err: any) {
      addLog(`CRITICAL_FAILURE: ${err.message}`, 'error');
      setVerificationError(err.message);
    } finally {
      setIsProcessing(false);
      addLog('SYSTEM: Process terminated.', 'info');
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
          <span>Payment Required</span>
          <ShieldCheck size={14} className="text-red-600" />
        </div>
        
        {price > 0 && !isAdmin && !simulateDispatch && (
          <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-4">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
              To send this premium gift, please complete the secure checkout via Stripe.
            </p>
            <a 
              href={`${stripeLink}?prefilled_email=${encodeURIComponent(currentUser.email || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl hover:bg-zinc-200 transition-all uppercase tracking-widest text-[10px]"
            >
              Pay ${price.toFixed(2)} via Stripe <ExternalLink size={14} />
            </a>
          </div>
        )}

        {verificationError && (
          <div className="bg-red-600/10 border border-red-900/30 p-4 rounded-2xl flex items-start gap-3 text-red-500 text-left">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-[9px] font-black uppercase tracking-widest">Verification Failed</h4>
              <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed opacity-70">
                {verificationError}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <button 
          disabled={isProcessing} 
          onClick={handleVerify} 
          className="w-full bg-red-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-red-900/40 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50 border border-red-500"
          aria-label={price === 0 || isAdmin || simulateDispatch ? 'Send Gift' : "Verify payment and send gift"}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={24} />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={24} />
              <span>{price === 0 || isAdmin || simulateDispatch ? 'Send Gift' : "I've Paid, Send Gift"}</span>
            </>
          )}
        </button>
        <p className="text-[9px] text-zinc-600 text-center uppercase tracking-widest font-bold">
          {price === 0 ? 'Free transaction' : 'Encrypted transaction secured by Stripe'}
        </p>
      </div>
    </div>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
export const EmojiGifts: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialRecipientId = searchParams.get('to');

  const [recipient, setRecipient] = useState<User | null>(null);
  const [selectedGift, setSelectedGift] = useState<EmojiGift | null>(null);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'recipient_selection' | 'checkout' | 'success'>('selection');
  const [isAdmin, setIsAdmin] = useState(false);
  const [simulateDispatch, setSimulateDispatch] = useState(false);

  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'nearby' | 'matches'>('matches');

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'security' = 'info') => {
    const icon = { info: '🔹', success: '✅', error: '❌', security: '🔐' };
    const entry = `[${new Date().toLocaleTimeString()}] ${icon[type]} ${msg}`;
    setDebugLogs(prev => [entry, ...prev].slice(0, 40));
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists() && snap.data().access === 'admin') {
        setIsAdmin(true);
        addLog('Admin privileges enabled', 'security');
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (!initialRecipientId) return;
    getDoc(doc(db, 'users', initialRecipientId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as User;
        setRecipient({ ...data, id: snap.id });
        addLog(`Target identity confirmed: ${data.username || data.name}`, "success");
      }
    });
  }, [initialRecipientId]);

  const fetchPotentialRecipients = async () => {
    if (!currentUser || (nearbyUsers.length > 0 && connectedUsers.length > 0)) return;
    setListLoading(true);
    addLog("PHASE 1: Scanning peer network...", "info");
    try {
      const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const myData = myDoc.data() as User;
      const following = myData.following || [];

      const snap = await getDocs(collection(db, 'users'));
      const nearby: User[] = [];
      const matches: User[] = [];

      snap.forEach(d => {
        if (d.id === currentUser.uid) return;
        const u = { ...d.data(), id: d.id } as User;
        if (following.includes(d.id)) matches.push(u);
        if (myData.location && u.location) {
          const dist = calculateDistance(
            myData.location.latitude, 
            myData.location.longitude, 
            u.location.latitude, 
            u.location.longitude
          );
          if (dist <= 10) nearby.push(u);
        }
      });

      setNearbyUsers(nearby);
      setConnectedUsers(matches);
      addLog(`Discovery sync complete. [Nearby: ${nearby.length}, Matches: ${matches.length}]`, "success");
    } catch (err: any) {
      addLog(`Discovery error: ${err.message}`, "error");
    } finally {
      setListLoading(false);
    }
  };

  const filteredRecipients = useMemo(() => {
    const list = activeTab === 'nearby' ? nearbyUsers : connectedUsers;
    if (!recipientSearchQuery.trim()) return list;
    return list.filter(u => 
      (u.username || u.name || '').toLowerCase().includes(recipientSearchQuery.toLowerCase())
    );
  }, [nearbyUsers, connectedUsers, activeTab, recipientSearchQuery]);

  const selectRecipient = (user: User) => {
    setRecipient(user);
    setPaymentStep('checkout');
    addLog(`Recipient locked: ${user.username || user.name}`, "info");
  };

  const handleGiftClick = (gift: EmojiGift) => {
    setSelectedGift(gift);
    if (recipient) {
      setPaymentStep('checkout');
    } else {
      setPaymentStep('recipient_selection');
      fetchPotentialRecipients();
    }
  };

  const closeOverlay = () => {
    setSelectedGift(null);
    setPaymentStep('selection');
    if (paymentStep === 'success' && initialRecipientId) navigate(-1);
  };

  return (
    <Layout>
      <div className="p-6 pb-32 max-w-2xl mx-auto flex flex-col gap-8 text-left relative min-h-full">
        {/* --- GIFT CATALOG GRID --- */}
        <div className="grid grid-cols-2 gap-4">
          {GIFTS.map((gift) => (
            <button 
              key={gift.id} 
              className="p-4 bg-zinc-900 rounded-2xl flex flex-col items-center cursor-pointer hover:bg-zinc-800 transition-all border-none" 
              onClick={() => handleGiftClick(gift)}
              aria-label={`Select ${gift.name} gift for ${gift.price > 0 ? `$${gift.price.toFixed(2)}` : 'free'}`}
            >
              <span className="text-5xl" role="img" aria-label={gift.name}>{gift.emoji}</span>
              <span className="mt-2 text-xs font-bold text-zinc-300 uppercase">{gift.name}</span>
              <span className="text-[10px] text-zinc-500 mt-1">{gift.price > 0 ? `$${gift.price.toFixed(2)}` : 'Free'}</span>
            </button>
          ))}
        </div>

        {/* --- MY GIFTS LINK --- */}
        <div className="flex justify-center mt-4">
          <button 
            onClick={() => navigate('/received-gifts')}
            className="flex flex-col items-center gap-1 bg-red-600 text-white font-black text-[10px] px-12 py-5 rounded-[2rem] border border-red-500 hover:bg-red-700 transition-all uppercase tracking-widest shadow-2xl shadow-red-900/40"
            aria-label="View your received gifts"
          >
            <Gift size={20} />
            <span>My Gifts</span>
          </button>
        </div>

        {/* --- FULL PAGE PURCHASE OVERLAY --- */}
        {selectedGift && paymentStep !== 'selection' && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center overflow-y-auto">
            <div className={`w-full max-w-lg min-h-screen md:min-h-0 bg-zinc-950 border border-zinc-900 md:rounded-[3rem] p-6 md:p-12 relative shadow-2xl overflow-hidden transition-all duration-300 flex flex-col pb-[calc(env(safe-area-inset-bottom)+2rem)] ${paymentStep === 'recipient_selection' ? 'h-full md:h-[80vh]' : ''}`}>
              
              {/* Back Button */}
              <button 
                onClick={closeOverlay} 
                className="fixed top-[calc(env(safe-area-inset-top)+1.25rem)] left-5 md:absolute md:top-8 md:left-8 p-3 bg-zinc-900 hover:bg-zinc-800 rounded-full text-white md:text-zinc-400 md:hover:text-white transition-all z-[110] shadow-2xl border border-zinc-800"
                aria-label="Go back to gift selection"
              >
                <ArrowLeft size={20} />
              </button>

              {/* STEP: CHECKOUT */}
              {paymentStep === 'checkout' && recipient && selectedGift && (
                <div className="flex flex-col h-full gap-10 mt-24 md:mt-12">
                  <div className="text-center space-y-6">
                    <span className="text-8xl">{selectedGift.emoji}</span>
                    <h2 className="text-3xl font-black text-white">{selectedGift.name}</h2>
                    <p className="text-zinc-400 text-sm">To: @{recipient.username || recipient.name}</p>
                  </div>
                  <div className="p-1 rounded-xl bg-zinc-900/50 border border-zinc-800 shadow-inner">
                    <Elements stripe={stripePromise}>
                      <StripeCheckoutForm
                        isAdmin={isAdmin}
                        selectedGift={selectedGift}
                        recipient={recipient}
                        currentUser={currentUser}
                        onSuccess={() => setPaymentStep('success')}
                        addLog={addLog}
                        simulateDispatch={simulateDispatch}
                      />
                    </Elements>
                  </div>
                </div>
              )}

              {/* STEP: SUCCESS */}
              {paymentStep === 'success' && selectedGift && recipient && (
                <div className="flex flex-col items-center justify-center gap-6 mt-20 text-center">
                  <CheckCircle2 size={64} className="text-green-500 animate-bounce" />
                  <h2 className="text-3xl font-black text-white uppercase tracking-widest">Gift Sent!</h2>
                  <p className="text-zinc-400 text-sm">
                    {selectedGift.emoji} {selectedGift.name} successfully delivered to @{recipient.username || recipient.name}.
                  </p>
                  <button 
                    onClick={closeOverlay} 
                    className="mt-6 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-500"
                    aria-label="Close success message"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* STEP: RECIPIENT SELECTION */}
              {paymentStep === 'recipient_selection' && (
                <div className="mt-24 md:mt-12 flex flex-col gap-4">
                  <div className="flex gap-3 justify-center mb-4">
                    <button 
                      onClick={() => setActiveTab('matches')} 
                      className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'matches' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                      aria-label="Show matches"
                    >
                      Matches
                    </button>
                    <button 
                      onClick={() => setActiveTab('nearby')} 
                      className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'nearby' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                      aria-label="Show nearby users"
                    >
                      Nearby
                    </button>
                  </div>
                  <input type="text" value={recipientSearchQuery} onChange={(e) => setRecipientSearchQuery(e.target.value)} placeholder="Search recipients..." className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 placeholder-zinc-500 text-white" />
                  {listLoading ? (
                    <div className="flex justify-center py-10 text-zinc-500"><Loader2 className="animate-spin" size={24} /></div>
                  ) : filteredRecipients.length === 0 ? (
                    <p className="text-zinc-500 text-center mt-10">No recipients found</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {filteredRecipients.map((user) => (
                        <button 
                          key={user.id} 
                          className="p-4 bg-zinc-800 rounded-2xl flex flex-col items-center cursor-pointer hover:bg-zinc-700 transition-all border-none" 
                          onClick={() => selectRecipient(user)}
                          aria-label={`Select ${user.username || user.name} as recipient`}
                        >
                          <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center text-xl">{user.username?.charAt(0).toUpperCase() || 'U'}</div>
                          <span className="mt-2 text-xs font-bold uppercase text-zinc-300">{user.username || user.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DEBUG PANEL */}
              {isAdmin && showDebug && (
                <div className="mt-6 max-h-40 overflow-y-auto p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-[9px] font-mono text-zinc-400">
                  {debugLogs.map((log, idx) => <div key={idx}>{log}</div>)}
                </div>
              )}

              {isAdmin && (
                <div className="mt-auto flex justify-between items-center gap-4">
                  <button 
                    onClick={() => setShowDebug(!showDebug)} 
                    className="text-[8px] uppercase font-black tracking-widest text-zinc-500 hover:text-zinc-300"
                    aria-label={showDebug ? 'Hide debug logs' : 'Show debug logs'}
                  >
                    {showDebug ? 'Hide Logs' : 'Show Logs'}
                  </button>
                  <button 
                    onClick={() => setSimulateDispatch(!simulateDispatch)} 
                    className={`text-[8px] uppercase font-black tracking-widest ${simulateDispatch ? 'text-green-500' : 'text-zinc-500'} hover:text-green-400`}
                    aria-label={simulateDispatch ? 'Disable dispatch simulation' : 'Enable dispatch simulation'}
                  >
                    {simulateDispatch ? 'Simulate ON' : 'Simulate OFF'}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
