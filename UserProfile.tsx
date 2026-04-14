import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Camera, CheckCircle, AlertCircle, Loader2, Bug, Users, TrendingUp, CreditCard, Settings } from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';

export const UserProfile: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [originalProfile, setOriginalProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Debug State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${time}] ${msg}`]);
    console.log(`[Profile] ${msg}`);
  };

  useEffect(() => {
    if (currentUser) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as User;
            setProfile(data);
            setOriginalProfile(data);
          } else {
             // Initialize empty profile if doc missing but user auth exists
             const initialProfile: User = {
                id: currentUser.uid,
                name: currentUser.displayName || '',
                firstName: '',
                lastName: '',
                email: currentUser.email || '',
                phone: '',
                birthdate: '',
                status: 'Open To Being Approached',
                approachStyle: '',
                picture: ''
             };
             setProfile(initialProfile);
             setOriginalProfile(initialProfile);
          }
        } catch (error) {
          console.error("Error loading profile:", error);
          addLog(`Init Error: ${error}`);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [currentUser]);

  const handleChange = (field: string, value: string) => {
    if (profile) {
      setProfile({ ...profile, [field]: value });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      addLog(`File selected: ${file.name}, Size: ${(file.size/1024).toFixed(2)} KB, Type: ${file.type}`);

      // Basic validation
      if (!file.type.startsWith('image/')) {
          setStatusMsg({ type: 'error', text: 'Please select a valid image file.' });
          addLog("Error: Invalid file type");
          return;
      }
      
      // limit to ~10MB pre-compression
      if (file.size > 10 * 1024 * 1024) {
          setStatusMsg({ type: 'error', text: 'Image is too large. Please choose a smaller one.' });
          addLog("Error: File too large (>10MB)");
          return;
      }

      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStatusMsg(null); // Clear previous errors
      
      // Clear input so same file can be selected again if needed
      e.target.value = ''; 
    }
  };

  // Helper to compress image before upload to avoid timeouts
  // Returns Data URL string instead of Blob for better compatibility with uploadString
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 5 Second Timeout for Compression
      const timeoutId = setTimeout(() => {
          reject(new Error("Compression Timed Out (5s)"));
      }, 5000);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            clearTimeout(timeoutId);
            reject(new Error('Canvas context failed'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as Data URL (base64 string)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          clearTimeout(timeoutId);
          addLog(`Compression success. String length: ${dataUrl.length}`);
          resolve(dataUrl);
        };
        img.onerror = (e) => {
            clearTimeout(timeoutId);
            reject(new Error("Image Load Error"));
        };
      };
      reader.onerror = (e) => {
          clearTimeout(timeoutId);
          reject(new Error("FileReader Error"));
      };
    });
  };

  const handleSave = async () => {
    if (!currentUser || !profile) return;
    setSaving(true);
    setStatusMsg(null);
    setDebugLogs([]); // Clear logs for new attempt
    addLog("Save process started...");
    
    try {
        let photoURL = profile.picture;

        // 1. Upload Image if a new file is selected
        if (imageFile) {
            addLog("New image detected. Preparing upload...");
            addLog(`Storage Bucket Config: ${storage.app.options.storageBucket}`);

            try {
                let uploadDataUrl: string = '';
                
                // Try compression/conversion to base64
                try {
                    addLog("Starting compression/conversion...");
                    uploadDataUrl = await compressImage(imageFile);
                } catch (compErr: any) {
                    addLog(`Compression skipped: ${compErr.message}`);
                    throw new Error("Could not process image file.");
                }
                
                // MATCHING FIREBASE RULES: Use 'profilePictures' (camelCase)
                const storagePath = `profilePictures/${currentUser.uid}`;
                addLog(`Target Storage Path: ${storagePath}`);
                
                const storageRef = ref(storage, storagePath);
                
                // Using uploadString (base64) instead of uploadBytes (blob)
                // This often bypasses some browser-specific CORS preflight quirks with binary data
                const uploadPromise = uploadString(storageRef, uploadDataUrl, 'data_url');

                // 60 Second Timeout for Upload (Increased from 25s)
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Upload Timed Out (60s)")), 60000)
                );

                addLog("Starting uploadString (base64)...");
                const snapshot: any = await Promise.race([uploadPromise, timeoutPromise]);
                addLog(`Upload complete.`);
                
                photoURL = await getDownloadURL(snapshot.ref);
                addLog("Download URL retrieved.");

            } catch (uploadError: any) {
                console.error("Upload error details:", uploadError);
                let msg = "Image upload failed.";
                if (uploadError.code === 'storage/unauthorized') {
                    msg = "Permission denied: storage/unauthorized. Check Firebase Storage Rules.";
                    addLog("CRITICAL ERROR: Storage Unauthorized");
                } else if (uploadError.message?.includes("Timed Out")) {
                    msg = "Upload timed out. 1. Check CORS. 2. Verify Bucket Name in firebase.ts.";
                    addLog("Error: Timeout - Likely CORS or Bucket Name mismatch");
                } else if (uploadError.code === 'storage/retry-limit-exceeded') {
                    msg = "Upload timed out. Try a better connection.";
                    addLog("Error: Retry limit exceeded");
                } else if (uploadError.code === 'storage/object-not-found') {
                    msg = "Object not found after upload. Bucket configuration might be wrong.";
                    addLog("Error: Object not found");
                } else if (uploadError.message) {
                    msg = uploadError.message;
                    addLog(`Error: ${uploadError.message}`);
                }
                // Show debug if upload fails
                setShowDebug(true);
                throw new Error(msg);
            }
        }

        // Ensure no fields are undefined
        const updateData = {
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
            phone: profile.phone || '',
            email: profile.email || '',
            birthdate: profile.birthdate || '',
            status: profile.status || 'Open To Being Approached',
            approachStyle: profile.approachStyle || '',
            picture: photoURL || "",
            photoPath: photoURL || ""
        };

        // Track changes for history (optional)
        const changes: string[] = [];
        if (originalProfile) {
            if (updateData.firstName !== (originalProfile.firstName || '')) changes.push('First Name');
            if (updateData.lastName !== (originalProfile.lastName || '')) changes.push('Last Name');
            if (updateData.phone !== (originalProfile.phone || '')) changes.push('Phone');
            if (updateData.email !== (originalProfile.email || '')) changes.push('Email');
            if (updateData.birthdate !== (originalProfile.birthdate || '')) changes.push('Birthdate');
            if (updateData.status !== (originalProfile.status || '')) changes.push('Status');
            if (updateData.approachStyle !== (originalProfile.approachStyle || '')) changes.push('Approach Style');
            if (photoURL !== (originalProfile.picture || '')) changes.push('Picture');
        }

        const finalUpdatePayload = {
            ...updateData,
            updatedAt: new Date().toISOString(),
            lastUpdateDetails: changes.length > 0 ? changes.join(', ') : 'No changes detected'
        };

        addLog("Saving to Firestore...");
        
        // 2. Update Firestore
        const docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, finalUpdatePayload, { merge: true });
        
        addLog("Firestore update complete.");

        // Update local state to reflect saved URL (clears preview) and sync originalProfile
        const newProfileState = { ...profile, ...updateData };
        setProfile(newProfileState);
        setOriginalProfile(newProfileState);
        
        setPreviewUrl(null);
        setImageFile(null);
        
        setStatusMsg({ type: 'success', text: 'Profile saved successfully!' });
        
        // Auto clear success message
        setTimeout(() => setStatusMsg(null), 3000);

    } catch (error: any) {
      console.error("Error saving profile:", error);
      const errorMsg = error.message || 'Failed to save profile.';
      setStatusMsg({ type: 'error', text: errorMsg });
      setShowDebug(true); // Auto show debug logs on error
    } finally {
      setSaving(false);
      addLog("Save operation finished.");
    }
  };

  if (loading) return <Layout><div className="p-5 text-white animate-pulse">Loading profile...</div></Layout>;
  if (!profile) return <Layout><div className="p-5 text-white">Profile not found.</div></Layout>;

  return (
    <Layout>
      <div className="p-5 pb-20 w-full">
        <h2 className="text-red-500 font-bold text-center text-lg mb-6">Edit Profile</h2>

        <div className="flex flex-col items-center mb-6">
            <div 
                className="relative w-32 h-32 cursor-pointer group"
                onClick={() => !saving && fileInputRef.current?.click()}
            >
                <img 
                    src={previewUrl || profile.picture || "https://ui-avatars.com/api/?background=random"} 
                    alt="Profile" 
                    className={`w-full h-full rounded-full object-cover border-4 border-zinc-800 transition-all ${saving ? 'opacity-50' : 'group-hover:border-red-600'}`}
                />
                
                {saving && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-red-500" size={32} />
                    </div>
                )}
                
                {!saving && (
                    <>
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={32} />
                        </div>
                        <div className="absolute bottom-0 right-0 bg-red-600 rounded-full p-2 border-2 border-black">
                             <Camera size={16} className="text-white" />
                        </div>
                    </>
                )}
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
                disabled={saving}
            />
            <p className="text-gray-500 text-xs mt-2">Tap to change photo</p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">First Name</label>
            <input
              placeholder="First Name"
              value={profile.firstName || ''}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Last Name</label>
            <input
              placeholder="Last Name"
              value={profile.lastName || ''}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Phone Number</label>
            <input
              placeholder="Phone Number"
              value={profile.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
            />
          </div>
          
          <div className="space-y-1">
             <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Birthdate</label>
             <input
                type="date"
                value={profile.birthdate || ''}
                onChange={(e) => handleChange('birthdate', e.target.value)}
                className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm min-h-[58px]"
             />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 ml-2">Email Access</label>
            <input
              placeholder="Email"
              value={profile.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-red-600 ml-2">Approach Status</label>
            <div className="relative">
                <select
                    value={profile.status || ''}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white appearance-none focus:outline-none focus:border-red-600 transition-all text-sm"
                >
                    <option value="">Select Status</option>
                    <option value="Open To Being Approached">Open To Being Approached</option>
                    <option value="Not Open To Being Approached Right Now">Not Open To Being Approached Right Now</option>
                    <option value="On a date, Please Do Not Approach">On a date, Please Do Not Approach</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-red-600 ml-2">Approach Style</label>
            <textarea
                value={profile.approachStyle || ''}
                onChange={(e) => handleChange('approachStyle', e.target.value)}
                placeholder="How should someone approach you?"
                rows={4}
                maxLength={135}
                className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-white focus:outline-none focus:border-red-600 transition-all placeholder-zinc-800 text-sm resize-none"
            />
            <p className="text-zinc-600 text-[8px] font-black uppercase tracking-widest text-right mt-1">
                {profile.approachStyle?.length || 0} / 135
            </p>
          </div>

          {statusMsg && (
            <div className={`p-4 rounded-lg border flex flex-col gap-2 ${statusMsg.type === 'success' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                <div className="flex items-center gap-2">
                    {statusMsg.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="font-bold">{statusMsg.text}</span>
                </div>
                
                {/* Debug Log Display */}
                {statusMsg.type === 'error' && userData?.access?.toLowerCase() === 'admin' && (
                    <div className="mt-2 w-full">
                        <button 
                            onClick={() => setShowDebug(!showDebug)}
                            className="flex items-center gap-1 text-xs text-red-300 hover:text-white mb-2 underline"
                            aria-label={showDebug ? "Hide debug logs" : "Show debug logs"}
                        >
                            <Bug size={12} /> {showDebug ? "Hide Debug Logs" : "Show Debug Logs"}
                        </button>
                        
                        {showDebug && (
                            <div className="bg-black/50 p-2 rounded text-[10px] font-mono text-gray-300 max-h-32 overflow-y-auto border border-red-900/50">
                                {debugLogs.map((log, i) => (
                                    <div key={i} className="mb-1 border-b border-gray-800/50 pb-1 last:border-0">{log}</div>
                                ))}
                            </div>
                        )}
                        
                        {statusMsg.text.includes("CORS") && (
                            <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-800 rounded text-[10px] text-yellow-200">
                                <strong>Hint:</strong> If you are running locally (localhost), you likely need to configure CORS for your Firebase Storage bucket. 
                                <br/><br/>
                                <a href="https://firebase.google.com/docs/storage/web/download-files#cors_configuration" target="_blank" rel="noopener noreferrer" className="underline">
                                    View Firebase CORS Docs
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[2rem] mt-8 transition-all shadow-2xl shadow-red-900/40 disabled:opacity-50 flex flex-col items-center justify-center gap-1 uppercase tracking-[0.2em] text-xs border border-red-500 active:scale-[0.98]"
            aria-label={saving ? 'Saving profile...' : 'Save profile changes'}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>

        {userData?.access?.toLowerCase() === 'admin' && (
          <div className="mt-8 p-6 bg-zinc-900/50 border border-red-600/20 rounded-3xl">
            <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4">Admin Controls</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => navigate('/admin/subscribers')}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-red-600/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-xl group-hover:bg-red-600/10 transition-colors">
                    <Users size={18} className="text-red-600" />
                  </div>
                  <span className="text-xs font-bold text-white">Subscriber Analytics</span>
                </div>
                <TrendingUp size={16} className="text-zinc-600" />
              </button>
              <button 
                onClick={() => navigate('/admin/banking')}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-red-600/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-xl group-hover:bg-red-600/10 transition-colors">
                    <CreditCard size={18} className="text-red-600" />
                  </div>
                  <span className="text-xs font-bold text-white">Banking Settings</span>
                </div>
                <Settings size={16} className="text-zinc-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};