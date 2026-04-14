
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInAnonymously, signOut } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { APP_BRAND_IMAGE } from '../constants';
import { ShieldCheck, CreditCard, ExternalLink, X, Loader2, CheckCircle2, AlertTriangle, Radar } from 'lucide-react';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bypassActive, setBypassActive] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (userData && userData.membershipActive === false) {
      setShowPaymentModal(true);
      setFormData(prev => ({
        ...prev,
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || ''
      }));
    }
  }, [userData]);

  const stripeLink = useMemo(() => {
    const baseUrl = import.meta.env.VITE_STRIPE_MEMBERSHIP_LINK || "https://buy.stripe.com/fZu28tgMmgdr9pu6vA6Vq00";
    if (formData.email) {
      return `${baseUrl}?prefilled_email=${encodeURIComponent(formData.email)}`;
    }
    return baseUrl;
  }, [formData.email]);

  const triggerPaymentGate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    
    setShowPaymentModal(true);
  };

  const verifyAndSignUp = async () => {
    setVerifying(true);
    setVerificationError('');
    
    try {
      if (currentUser && userData && userData.membershipActive === false) {
        // Handle verification for an existing but unpaid user
        await handleExistingUserVerification();
      } else {
        // We proceed to create the account first. 
        await handleFinalSignUp();
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setVerificationError(err.message || "Unable to verify payment status.");
    } finally {
      setVerifying(false);
    }
  };

  const handleExistingUserVerification = async () => {
    if (!currentUser || !userData) return;
    
    let isPaid = bypassActive;
    if (!bypassActive) {
      const paymentsRef = collection(db, 'membership_payments');
      const q = query(paymentsRef, where('email', '==', userData.email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const paymentDoc = querySnapshot.docs[0].data();
        if (paymentDoc.status === 'succeeded' || paymentDoc.status === 'paid') {
          isPaid = true;
        }
      }
    }

    if (isPaid) {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        membershipActive: true,
        membershipDate: new Date().toISOString()
      });
      setShowPaymentModal(false);
      navigate('/home', { replace: true });
    } else {
      throw new Error("No payment record found for this email. If you just paid, please wait 30 seconds for the Stripe relay to sync.");
    }
  };

  const handleFinalSignUp = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Create the Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Check for payment record (now authenticated as the real user)
      let isPaid = bypassActive;
      if (!bypassActive) {
        try {
          const paymentsRef = collection(db, 'membership_payments');
          const q = query(paymentsRef, where('email', '==', formData.email.toLowerCase()));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const paymentDoc = querySnapshot.docs[0].data();
            if (paymentDoc.status === 'succeeded' || paymentDoc.status === 'paid') {
              isPaid = true;
            }
          }
        } catch (permErr: any) {
          console.error("Firestore Permission Error during check:", permErr);
          setVerificationError("Database access denied. Please ensure your Firestore Security Rules allow reading 'membership_payments'.");
          setLoading(false);
          return; // Stop the signup process if we can't verify payment
        }
      }

      // 3. Create the user document
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        status: 'Open To Being Approached',
        approachStyle: 'Just say hi!',
        picture: `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}&background=random`,
        following: [],
        sentRequests: [],
        receivedRequests: [],
        membershipActive: isPaid,
        membershipDate: isPaid ? new Date().toISOString() : null
      });

      if (isPaid) {
        setShowPaymentModal(false);
        const searchParams = new URLSearchParams(location.search);
        const from = searchParams.get('from') || '/home';
        navigate(from, { replace: true });
      } else {
        // If not paid, we keep the modal open and show an error
        // The user is created but inactive.
        throw new Error("No payment record found for this email. If you just paid, please wait 30 seconds for the Stripe relay to sync.");
      }
      
    } catch (err: any) {
      console.error(err);
      // If it's an auth error (e.g. email already in use), we show it on the main form
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
        setShowPaymentModal(false);
      } else if (err.code?.startsWith('auth/')) {
        setError(err.message);
        setShowPaymentModal(false);
      } else {
        // Otherwise it's likely a payment verification error
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-full p-6 relative">
        <div className="w-full max-w-[150px] aspect-square flex items-center justify-center mb-6">
             <img src={APP_BRAND_IMAGE} alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(220,38,38,0.2)]" />
        </div>

        <h2 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-white uppercase tracking-widest">Create Account</h2>
        <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-6 md:mb-8">Join the elite network</p>

        <form onSubmit={triggerPaymentGate} className="w-full max-w-xs flex flex-col gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Personal Identity</label>
            <div className="flex gap-2">
              <input name="firstName" placeholder="First" onChange={handleChange} className="w-1/2 p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm" required />
              <input name="lastName" placeholder="Last" onChange={handleChange} className="w-1/2 p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm" required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Email Access</label>
            <input name="email" type="email" placeholder="you@example.com" onChange={handleChange} className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm" required />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Security Key</label>
            <input name="password" type="password" placeholder="••••••••" onChange={handleChange} className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm" required />
          </div>

          {error && (
            <div className="bg-red-600/10 border border-red-900/30 p-3 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-black py-4 md:py-5 rounded-2xl md:rounded-[2rem] mt-4 md:mt-6 transition-all disabled:opacity-50 active:scale-[0.98] shadow-2xl shadow-red-900/40 uppercase tracking-[0.2em] text-xs flex flex-col items-center justify-center gap-1 border border-red-500"
            aria-label={loading ? 'Creating account...' : 'Create account and proceed to payment'}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin md:w-6 md:h-6" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={20} className="md:w-6 md:h-6" />
                <span>Secure Sign Up</span>
              </>
            )}
          </button>
        </form>

        <button 
          onClick={() => navigate('/signin')}
          className="mt-8 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
          aria-label="Go to sign in page"
        >
          Have an account? <span className="text-red-500 ml-1">Sign In</span>
        </button>

        {/* PAYMENT POPUP OVERLAY */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => !verifying && setShowPaymentModal(false)} />
            
            <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <ShieldCheck size={120} className="text-red-600" />
              </div>

              <div className="flex flex-col items-center text-center gap-6">
                <div className="relative">
                  <div className="bg-red-600/20 p-4 rounded-full border border-red-500/30 relative z-10">
                    <CreditCard className={`${verifying ? 'animate-pulse text-white' : 'text-red-500'}`} size={32} />
                  </div>
                  {verifying && (
                    <div className="absolute inset-[-10px] rounded-full border-2 border-red-600/50 border-t-transparent animate-spin" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest italic">
                    {verifying ? 'Verifying Payment' : 'Membership Required'}
                  </h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed">
                    {verifying 
                      ? `Scanning global ledger for ${formData.email}...` 
                      : 'To maintain a high-quality, verified community, a one-time activation fee is required to join Approach.'}
                  </p>
                </div>

                {verificationError && (
                  <div className="w-full bg-red-600/10 border border-red-900/30 p-4 rounded-2xl flex items-start gap-3 text-red-500 text-left animate-in slide-in-from-top-2">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-black uppercase tracking-widest">Verification Failed</h4>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed opacity-70">
                        {verificationError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="w-full space-y-4">
                  {!verifying && (
                    <a 
                      href={stripeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-zinc-200 transition-all uppercase tracking-widest text-[11px]"
                    >
                      Activate Membership <ExternalLink size={16} />
                    </a>
                  )}

                  <button 
                    onClick={verifyAndSignUp}
                    disabled={verifying}
                    className="w-full bg-zinc-900 text-zinc-400 font-black py-4 rounded-2xl border border-zinc-800 hover:text-white hover:bg-zinc-800 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                    aria-label={verifying ? 'Verifying payment status...' : 'Check payment status and continue'}
                  >
                    {verifying ? (
                      <>Checking Relay... <Loader2 className="animate-spin" size={14} /></>
                    ) : (
                      <>I've Paid, Continue <CheckCircle2 size={14} /></>
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-4 items-center">
                  {/* Debug bypass only for admins or special cases - currently disabled for production feel */}
                  {/* <button 
                    onClick={() => setBypassActive(!bypassActive)}
                    className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${bypassActive ? 'bg-red-600 text-white border-red-400' : 'bg-zinc-800 text-zinc-700 border-zinc-900'}`}
                  >
                    {bypassActive ? 'Bypass: Active' : 'Debug: Bypass Verification'}
                  </button> */}

                  {!verifying && (
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="text-zinc-700 hover:text-zinc-500 text-[9px] font-black uppercase tracking-widest transition-colors"
                      aria-label="Cancel registration and close modal"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
