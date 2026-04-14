
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Landmark, ShieldCheck, Lock, AlertCircle, CheckCircle2, Loader2, Save, Info, Terminal, Bug, UserPlus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BankDetails } from '../types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export const BankingSettings: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [banking, setBanking] = useState<BankDetails>({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'Checking',
    verified: false,
    updatedAt: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual Membership Override State
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{email: string, name: string}[]>([]);
  const [searching, setSearching] = useState(false);

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'security' = 'info') => {
    const time = new Date().toLocaleTimeString();
    const icons = { info: '🔹', success: '✅', error: '❌', security: '🔐' };
    const logEntry = `[${time}] ${icons[type]} ${msg}`;
    setDebugLogs(prev => [logEntry, ...prev].slice(0, 50));
    console.log(`[Banking-Security] ${msg}`);
  };

  useEffect(() => {
    // For demo purposes, you can load the current banking info via your Cloud Function if needed
    setLoading(false);
  }, []);

  const handleSave = async () => {
    if (!currentUser) return;

    setSaving(true);
    setStatus(null);

    addLog("--- STARTING SECURITY OVERRIDE: PAYOUT UPDATE ---", "security");
    addLog(`Operator UID: ${currentUser.uid}`, "info");

    try {
      // Validation
      addLog(`Validating payload: Bank[${banking.bankName}], Type[${banking.accountType}]`, "info");

      if (!banking.bankName || !banking.accountNumber || !banking.routingNumber) {
        throw new Error("Missing critical financial identifiers.");
      }

      addLog("Preparing encrypted transaction via Cloud Function...", "info");

      // Get callable function
      const functions = getFunctions();
      const updateBanking = httpsCallable(functions, 'updateBanking');

      const result = await updateBanking({
        bankName: banking.bankName,
        accountHolder: banking.accountHolder,
        accountNumber: banking.accountNumber,
        routingNumber: banking.routingNumber,
        accountType: banking.accountType,
      });

      addLog("Cloud Function executed successfully.", "success");

      // Fix: Cast data to any to access properties safely on unknown type
      const resultData = result.data as any;

      // Update local state with server response
      if (resultData?.success) {
        setBanking(prev => ({ ...prev, verified: true, updatedAt: new Date().toISOString() }));
        setStatus({ type: 'success', text: resultData.message || 'Payout account updated successfully!' });
        addLog("Registry synchronized. Closing transaction.", "success");
      } else {
        throw new Error(resultData?.message || "Unknown error from Cloud Function");
      }

      setTimeout(() => setStatus(null), 3000);

    } catch (err: any) {
      addLog(`TRANSACTION ABORTED: ${err.message}`, "error");
      setStatus({ type: 'error', text: err.message || 'Failed to update banking info.' });
      setShowDebug(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'));
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({
        email: doc.data().email,
        name: doc.data().name
      }));
      setSearchResults(results);
      if (results.length === 0) {
        addLog(`No users found matching "${searchQuery}"`, "error");
      } else {
        addLog(`Found ${results.length} potential matches for "${searchQuery}"`, "success");
      }
    } catch (err: any) {
      addLog(`Search failed: ${err.message}`, "error");
    } finally {
      setSearching(false);
    }
  };

  const handleManualMembership = async (email: string) => {
    if (!email) return;
    setOverrideLoading(true);
    setOverrideStatus(null);
    addLog(`MANUAL OVERRIDE: Provisioning membership for ${email}`, "security");

    try {
      const paymentsRef = collection(db, 'membership_payments');
      await addDoc(paymentsRef, {
        email: email.toLowerCase(),
        status: 'paid',
        amount: 2000, // Default $20.00
        currency: 'usd',
        timestamp: serverTimestamp(),
        manualOverride: true,
        overriddenBy: currentUser?.uid
      });

      setOverrideStatus({ type: 'success', text: `Membership record created for ${email}` });
      addLog(`SUCCESS: ${email} is now authorized for registration.`, "success");
      setOverrideEmail('');
    } catch (err: any) {
      setOverrideStatus({ type: 'error', text: err.message });
      addLog(`OVERRIDE FAILED: ${err.message}`, "error");
    } finally {
      setOverrideLoading(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="p-20 text-center animate-pulse text-zinc-600 font-black uppercase tracking-widest">
          Securing Connection...
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="p-6 pb-24 max-w-2xl mx-auto flex flex-col gap-8">
        <div className="text-center space-y-3 mt-4">
          <div className="flex justify-center relative">
            <div className="bg-red-600/20 p-4 rounded-full border border-red-500/30">
              <Landmark className="text-red-500" size={32} />
            </div>
            {userData?.access?.toLowerCase() === 'admin' && (
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className={`absolute top-0 right-0 p-2 rounded-full transition-all border ${showDebug ? 'bg-red-600 text-white border-red-500 shadow-lg' : 'bg-zinc-950 text-zinc-600 border-zinc-900'}`}
                aria-label={showDebug ? 'Hide debug logs' : 'Show debug logs'}
              >
                <Bug size={14} />
              </button>
            )}
          </div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">Payout Registry</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Secure Banking Integration for Earnings</p>
        </div>

        {showDebug && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-top duration-300">
            <div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Financial Audit Log</span>
              </div>
              <button onClick={() => setDebugLogs([])} className="text-[10px] text-zinc-700 font-black uppercase hover:text-white transition-colors">Clear</button>
            </div>
            <div className="p-4 h-48 overflow-y-auto font-mono text-[9px] space-y-1.5 bg-black/60">
              {debugLogs.length === 0 ? (
                <div className="text-zinc-800 italic text-center py-10 uppercase tracking-widest">No transaction history...</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className={`pb-1 border-b border-zinc-900/30 last:border-0 ${log.includes('🔐') ? 'text-red-400 font-bold' : log.includes('❌') ? 'text-red-600 font-bold' : 'text-zinc-500'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck size={120} className="text-red-500" />
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
             <div className="bg-red-600/10 p-2 rounded-lg">
                <Lock size={16} className="text-red-500" />
             </div>
             <div className="flex-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">End-to-End Encryption</h3>
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50">Your financial data is never stored on our local servers.</p>
             </div>
          </div>

          <div className="grid gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Full Legal Name (Account Holder)</label>
              <input
                placeholder="JOHN DOE"
                value={banking.accountHolder}
                onChange={(e) => setBanking({ ...banking, accountHolder: e.target.value.toUpperCase() })}
                className="w-full bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-bold text-white focus:border-red-600 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Bank Name</label>
              <input
                placeholder="CHASE / WELLS FARGO / ETC"
                value={banking.bankName}
                onChange={(e) => setBanking({ ...banking, bankName: e.target.value })}
                className="w-full bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-bold text-white focus:border-red-600 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Routing Number</label>
                <input
                  placeholder="000000000"
                  maxLength={9}
                  value={banking.routingNumber}
                  onChange={(e) => setBanking({ ...banking, routingNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-mono text-white focus:border-red-600 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Account Number</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={banking.accountNumber}
                  onChange={(e) => setBanking({ ...banking, accountNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-mono text-white focus:border-red-600 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Account Type</label>
              <div className="flex gap-4 p-1 bg-black rounded-2xl border border-zinc-900">
                {(['Checking', 'Savings'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBanking({ ...banking, accountType: type })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      banking.accountType === type ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {status && (
            <div className={`p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300 border ${
              status.type === 'success' ? 'bg-green-600/10 border-green-900/30 text-green-400' : 'bg-red-600/10 border-red-900/30 text-red-500'
            }`}>
              {status.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest">{status.type === 'success' ? 'Registry Updated' : 'System Error'}</h4>
                <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed opacity-70">{status.text}</p>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4">
             <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-red-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-red-900/40 flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Update Payout Info</>}
            </button>
            
            <div className="flex items-center justify-center gap-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest">
              <Info size={10} />
              Updates may take up to 24 hours to reflect in settlement cycles.
            </div>
          </div>
        </div>

        {/* MANUAL MEMBERSHIP OVERRIDE SECTION */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <UserPlus size={120} className="text-red-500" />
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
             <div className="bg-red-600/10 p-2 rounded-lg">
                <ShieldCheck size={16} className="text-red-500" />
             </div>
             <div className="flex-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Membership Override</h3>
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50">Manually authorize users who paid via external channels.</p>
             </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Search for User (e.g. Will Sims)</label>
              <div className="flex gap-2">
                <input
                  placeholder="SEARCH NAME..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-bold text-white focus:border-red-600 outline-none transition-all"
                />
                <button 
                  onClick={handleSearchUser}
                  disabled={searching}
                  className="bg-zinc-900 p-4 rounded-2xl text-white hover:bg-zinc-800 transition-all disabled:opacity-50"
                  aria-label="Search for user"
                >
                  {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => setOverrideEmail(res.email)}
                      className="flex items-center justify-between p-4 bg-black border border-zinc-900 rounded-xl hover:border-red-600 transition-all group"
                      aria-label={`Select user ${res.name}`}
                    >
                      <div className="text-left">
                        <div className="text-[10px] font-black text-white uppercase">{res.name}</div>
                        <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{res.email}</div>
                      </div>
                      <UserPlus size={14} className="text-zinc-800 group-hover:text-red-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-zinc-900/50 w-full" />

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-4">Target Email Address</label>
              <input
                placeholder="USER@EXAMPLE.COM"
                value={overrideEmail}
                onChange={(e) => setOverrideEmail(e.target.value.toLowerCase())}
                className="w-full bg-black border border-zinc-900 rounded-2xl p-4 text-sm font-bold text-white focus:border-red-600 outline-none transition-all"
              />
            </div>

            {overrideStatus && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
                overrideStatus.type === 'success' ? 'bg-green-600/10 border-green-900/30 text-green-400' : 'bg-red-600/10 border-red-900/30 text-red-500'
              }`}>
                {overrideStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <div className="space-y-1">
                  <h4 className="text-[9px] font-black uppercase tracking-widest">{overrideStatus.type === 'success' ? 'Override Complete' : 'Override Failed'}</h4>
                  <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">{overrideStatus.text}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => handleManualMembership(overrideEmail)}
              disabled={overrideLoading || !overrideEmail}
              className="w-full bg-zinc-100 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-2 hover:bg-white transition-all active:scale-[0.98] disabled:opacity-30"
              aria-label="Authorize membership manually"
            >
              {overrideLoading ? <Loader2 className="animate-spin" size={16} /> : <><UserPlus size={16} /> Authorize Membership</>}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
