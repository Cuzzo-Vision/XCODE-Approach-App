
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, CheckCircle, AlertCircle, Copy, Upload, Wand2, Loader2, Trash2, ShieldAlert, X } from 'lucide-react';
import { signOut, deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    username: '',
    city: '',
    state: '',
    zip: '',
    gender: '',
    preference: ''
  });
  const [originalSettings, setOriginalSettings] = useState({
    username: '',
    city: '',
    state: '',
    zip: '',
    gender: '',
    preference: ''
  });
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // App Icon Upload State
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      const loadSettings = async () => {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          if (data.access && data.access.toLowerCase() === 'admin') {
            setIsAdmin(true);
          }

          const loadedData = {
            username: data.username || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || '',
            gender: data.gender || '',
            preference: data.preference || ''
          };
          setSettings(loadedData);
          setOriginalSettings(loadedData);
        }
      };
      loadSettings();
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'username') {
        const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setSettings({ ...settings, [e.target.name]: sanitized });
    } else {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    }
  };

  const copyIconUrl = () => {
    if (uploadedIconUrl) {
        navigator.clipboard.writeText(uploadedIconUrl);
        setStatusMsg({ type: 'success', text: 'Icon URL copied!' });
        setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0] || !currentUser) return;
      
      const file = e.target.files[0];
      setUploadingIcon(true);
      setStatusMsg(null);

      try {
          const processedDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = (event) => {
                  const img = new Image();
                  img.src = event.target?.result as string;
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      if(!ctx) { reject("Canvas error"); return; }
                      ctx.drawImage(img, 0, 0);
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const data = imageData.data;
                      const threshold = 240; 
                      for(let i = 0; i < data.length; i += 4) {
                          const r = data[i], g = data[i+1], b = data[i+2];
                          if (r > threshold && g > threshold && b > threshold) data[i + 3] = 0;
                      }
                      ctx.putImageData(imageData, 0, 0);
                      resolve(canvas.toDataURL('image/png'));
                  };
                  img.onerror = () => reject("Image load error");
              };
              reader.onerror = () => reject("File read error");
          });

          const storagePath = `profilePictures/system/app_logo_${Date.now()}.png`;
          const storageRef = ref(storage, storagePath);
          await uploadString(storageRef, processedDataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(storageRef);
          setUploadedIconUrl(downloadUrl);
          setStatusMsg({ type: 'success', text: 'Logo uploaded successfully!' });
      } catch (err: any) {
          setStatusMsg({ type: 'error', text: 'Upload failed: ' + err.message });
      } finally {
          setUploadingIcon(false);
          e.target.value = '';
      }
  };

  const handleSave = async () => {
    if(!currentUser) return;
    setSaving(true);
    setStatusMsg(null);

    try {
        if (settings.username && settings.username !== originalSettings.username) {
            const q = query(collection(db, 'users'), where('username', '==', settings.username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && querySnapshot.docs.some(d => d.id !== currentUser.uid)) {
                setStatusMsg({ type: 'error', text: 'Username is already taken.' });
                setSaving(false);
                return;
            }
        }

        const docRef = doc(db, 'users', currentUser.uid);
        await updateDoc(docRef, {
            ...settings,
            updatedAt: new Date().toISOString()
        });
        setOriginalSettings(settings); 
        setStatusMsg({ type: 'success', text: 'Settings saved!' });
        setTimeout(() => setStatusMsg(null), 3000);
    } catch(e) {
        setStatusMsg({ type: 'error', text: 'Error saving settings' });
    } finally {
        setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setDeleting(true);
    setStatusMsg(null);

    try {
        // 1. Delete user data from Firestore
        const docRef = doc(db, 'users', currentUser.uid);
        await deleteDoc(docRef);

        // 2. Delete user from Firebase Auth
        try {
            await deleteUser(currentUser);
            navigate('/', { replace: true });
        } catch (authErr: any) {
            // If re-authentication is required
            if (authErr.code === 'auth/requires-recent-login') {
                const provider = new GoogleAuthProvider();
                try {
                    await reauthenticateWithPopup(currentUser, provider);
                    await deleteUser(currentUser);
                    navigate('/', { replace: true });
                } catch (reAuthErr: any) {
                    setStatusMsg({ type: 'error', text: 'Re-authentication failed. Please log out and log back in to delete your account.' });
                    setDeleting(false);
                    setShowDeleteConfirm(false);
                    return;
                }
            } else {
                throw authErr;
            }
        }
    } catch (e: any) {
        console.error("Error deleting account:", e);
        setStatusMsg({ type: 'error', text: 'Failed to delete account: ' + (e.message || 'Unknown error') });
        setDeleting(false);
        setShowDeleteConfirm(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24 w-full space-y-8 md:space-y-10">
        <div>
            <h2 className="text-red-500 font-bold text-center text-lg md:text-xl mb-4 md:mb-6 tracking-tight uppercase">Account Settings</h2>

            <div className="flex flex-col gap-4 md:gap-5">
              <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ml-1">Username</label>
                  <input
                      name="username"
                      placeholder="choose_username"
                      value={settings.username}
                      onChange={handleChange}
                      className="w-full p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white focus:border-red-600 outline-none transition-all font-mono text-sm"
                  />
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ml-1">Gender</label>
                    <select
                        name="gender"
                        value={settings.gender}
                        onChange={handleChange}
                        className="w-full p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white appearance-none focus:border-red-600 outline-none text-sm"
                    >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ml-1">Interested In</label>
                    <select
                        name="preference"
                        value={settings.preference}
                        onChange={handleChange}
                        className="w-full p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white appearance-none focus:border-red-600 outline-none text-sm"
                    >
                        <option value="">Everyone</option>
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                    </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ml-1">Location Details</label>
                  <input
                      name="city"
                      placeholder="City"
                      value={settings.city}
                      onChange={handleChange}
                      className="w-full p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white focus:border-red-600 outline-none mb-2 text-sm"
                  />
                  <div className="flex gap-3 md:gap-4">
                      <input
                          name="state"
                          placeholder="State"
                          value={settings.state}
                          onChange={handleChange}
                          className="w-1/3 p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white focus:border-red-600 outline-none text-sm"
                      />
                      <input
                          name="zip"
                          placeholder="Zip"
                          value={settings.zip}
                          onChange={handleChange}
                          className="w-2/3 p-3.5 md:p-4 border border-zinc-800 rounded-2xl bg-zinc-900/50 text-white focus:border-red-600 outline-none text-sm"
                      />
                  </div>
              </div>

              {statusMsg && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${statusMsg.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-800/30' : 'bg-red-900/20 text-red-400 border border-red-800/30'}`}>
                      {statusMsg.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                      <span className="text-xs font-bold">{statusMsg.text}</span>
                  </div>
              )}

              <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-red-600 text-white font-black py-5 rounded-[2rem] transition-all hover:bg-red-700 border border-red-500 disabled:opacity-50 flex flex-col justify-center items-center gap-1 uppercase tracking-widest text-[10px] shadow-2xl shadow-red-900/40"
                  aria-label={saving ? 'Saving changes...' : 'Save all account changes'}
              >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  <span>{saving ? 'Processing...' : 'Save All Changes'}</span>
              </button>
            </div>
        </div>

        {/* App Customization Section - Admin Only */}
        {isAdmin && (
            <div className="border-t border-zinc-800 pt-8">
                <h3 className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <Wand2 size={14} className="text-red-600" /> Admin Tools
                </h3>
                
                <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
                    <p className="text-[10px] text-zinc-600 mb-4 uppercase tracking-widest leading-relaxed">
                        Update Brand Logo (Transparent PNG Auto-Generator)
                    </p>
                    
                    <div className="flex items-center gap-4">
                        <label 
                            className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border border-dashed border-zinc-800 cursor-pointer hover:border-red-600/50 transition-all ${uploadingIcon ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-label="Upload new brand logo"
                        >
                            {uploadingIcon ? <Loader2 className="animate-spin text-red-500" size={18} /> : <Upload className="text-zinc-700" size={18} />}
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                {uploadingIcon ? 'Processing...' : 'Upload Logo'}
                            </span>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleLogoUpload}
                                disabled={uploadingIcon}
                            />
                        </label>
                    </div>

                    {uploadedIconUrl && (
                        <div className="mt-6 bg-black rounded-2xl p-4 border border-zinc-800">
                            <div className="flex items-center gap-4">
                                <img src={uploadedIconUrl} alt="New Icon" className="w-12 h-12 object-contain bg-zinc-900 rounded-lg p-1" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <code className="bg-zinc-900 text-zinc-500 text-[8px] p-2 rounded-lg flex-1 truncate font-mono">
                                            {uploadedIconUrl}
                                        </code>
                                        <button 
                                            onClick={copyIconUrl}
                                            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white transition-colors"
                                            aria-label="Copy logo URL to clipboard"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                    <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">
                                        Update constants.ts: APP_BRAND_IMAGE
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        <button
            onClick={handleLogout}
            className="w-full flex flex-col items-center justify-center gap-1 bg-zinc-900 text-white font-black py-5 rounded-[2rem] border border-zinc-800 hover:bg-zinc-800 transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl"
            aria-label="Securely log out of your account"
        >
            <LogOut size={20} />
            <span>Secure Log Out</span>
        </button>

        <div className="pt-4 border-t border-zinc-900/50">
            <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex flex-col items-center justify-center gap-1 bg-black text-red-600 font-black py-5 rounded-[2rem] border border-red-900/20 hover:bg-red-900/10 transition-all uppercase tracking-[0.2em] text-[10px]"
                aria-label="Permanently delete your account and data"
            >
                <Trash2 size={20} />
                <span>Delete Account Permanently</span>
            </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                <div className="bg-zinc-950 border border-red-900/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl shadow-red-900/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
                    
                    <button 
                        onClick={() => !deleting && setShowDeleteConfirm(false)}
                        className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
                        disabled={deleting}
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="p-5 bg-red-900/20 rounded-3xl border border-red-900/30">
                            <ShieldAlert size={40} className="text-red-600" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Final Warning</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                This action is <span className="text-red-500 font-bold">irreversible</span>. All your photos, messages, and profile data will be permanently erased from our servers.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 w-full pt-4">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] transition-all disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                {deleting ? 'Erasing Data...' : 'Confirm Deletion'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};
