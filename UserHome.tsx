
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Loader2, Camera, Trash2, Edit2, ShieldCheck, Film, RefreshCw, X, Share2, Check, LayoutGrid, AlertCircle, Package } from 'lucide-react';
import { doc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { User } from '../types';
import JSZip from 'jszip';

export const UserHome: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const fetchUserData = async () => {
    if (!currentUser) return;
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data() as User);
      }
    } catch (err) { 
      console.error("Error fetching user data:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [currentUser]);

  const handleShare = () => {
    if (!currentUser) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#/gallery/${currentUser.uid}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const compressImageFromBase64 = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const maxWidth = 1000;
          const maxHeight = 1000;
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
          if (!ctx) return reject(new Error('Canvas context failed'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('Image failed to load for compression'));
    });
  };

  const compressImage = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        compressImageFromBase64(base64).then(resolve).catch(reject);
      };
      reader.onerror = reject;
    });
  };

  const checkVideoDuration = (file: File | Blob): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser || !userData) return;
    const zipFile = e.target.files[0];
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(zipFile);
      const photoUrls: string[] = [...(userData.photos || [])];
      
      const fileNames = Object.keys(content.files).filter(name => 
        !content.files[name].dir && 
        (name.toLowerCase().match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/))
      );

      if (fileNames.length === 0) throw new Error("No compatible media found in zip.");
      if (photoUrls.length + fileNames.length > 20) {
        alert("Zip contains too many files. Max gallery capacity is 20.");
        return;
      }

      for (const name of fileNames) {
        const blob = await content.files[name].async("blob");
        const isVideo = name.toLowerCase().match(/\.(mp4|mov|webm)$/);
        const extension = isVideo ? 'mp4' : 'jpg';
        const storagePath = `profilePictures/${currentUser.uid}/zip_${Date.now()}_${name.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
        const storageRef = ref(storage, storagePath);

        let downloadUrl = '';
        if (isVideo) {
          const duration = await checkVideoDuration(blob);
          if (duration <= 31) {
            const snapshot = await uploadBytes(storageRef, blob);
            downloadUrl = await getDownloadURL(snapshot.ref);
          }
        } else {
          const compressedDataUrl = await compressImage(blob);
          const snapshot = await uploadString(storageRef, compressedDataUrl, 'data_url');
          downloadUrl = await getDownloadURL(snapshot.ref);
        }

        if (downloadUrl) photoUrls.push(downloadUrl);
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { photos: photoUrls });
      setUserData(prev => prev ? { ...prev, photos: photoUrls } : null);
      alert(`Imported ${fileNames.length} items from archive.`);

    } catch (err: any) {
      console.error("Zip error:", err);
      alert("Failed to process zip archive: " + err.message);
    } finally {
      setIsZipping(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleCollectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser || !userData) return;
    const file = e.target.files[0];
    const isVideo = file.type.startsWith('video/');
    
    const isReplacing = replacingIndex !== null;
    const slotIndex = isReplacing ? replacingIndex : (userData?.photos?.length || 0);
    
    setUploadingSlot(slotIndex);
    
    try {
      let downloadUrl = '';
      const extension = isVideo ? 'mp4' : 'jpg';
      const storagePath = `profilePictures/${currentUser.uid}/collection_${Date.now()}.${extension}`;
      const storageRef = ref(storage, storagePath);

      if (isVideo) {
        const duration = await checkVideoDuration(file);
        if (duration > 31) {
          alert("Videos must be 30 seconds or less.");
          setUploadingSlot(null);
          setReplacingIndex(null);
          return;
        }
        const snapshot = await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(snapshot.ref);
      } else {
        const compressedDataUrl = await compressImage(file);
        const snapshot = await uploadString(storageRef, compressedDataUrl, 'data_url');
        downloadUrl = await getDownloadURL(snapshot.ref);
      }
      
      const userRef = doc(db, 'users', currentUser.uid);
      let updatedPhotos = [...(userData.photos || [])];
      
      if (isReplacing) {
        const oldUrl = updatedPhotos[slotIndex];
        if (oldUrl && oldUrl.includes('firebasestorage.googleapis.com')) {
           try {
             await deleteObject(ref(storage, oldUrl));
           } catch (e) { console.warn("Cleanup non-critical fail", e); }
        }
        updatedPhotos[slotIndex!] = downloadUrl;
      } else {
        updatedPhotos.push(downloadUrl);
      }

      await updateDoc(userRef, { photos: updatedPhotos });
      setUserData(prev => prev ? { ...prev, photos: updatedPhotos } : null);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Failed to update collection.");
    } finally {
      setUploadingSlot(null);
      setReplacingIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (index: number | null = null) => {
    setReplacingIndex(index);
    setConfirmDeleteIndex(null);
    fileInputRef.current?.click();
  };

  const handleDeletePhoto = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation(); 
    if (!currentUser || !userData || !userData.photos) return;

    const photoUrl = userData.photos[index];

    if (confirmDeleteIndex !== index) {
      setConfirmDeleteIndex(index);
      return;
    }
    
    setDeletingPhoto(photoUrl);
    setConfirmDeleteIndex(null);
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        photos: arrayRemove(photoUrl)
      });

      setUserData(prev => {
        if (!prev || !prev.photos) return prev;
        return { ...prev, photos: prev.photos.filter((_, i) => i !== index) };
      });

      if (photoUrl.includes('firebasestorage.googleapis.com')) {
         try {
            await deleteObject(ref(storage, photoUrl));
         } catch (storageErr: any) { 
            console.warn("Storage purge warning", storageErr);
         }
      }
    } catch (err: any) {
      alert("Failed to remove item. Force-refresh required.");
      fetchUserData();
    } finally {
      setDeletingPhoto(null);
    }
  };

  const isVideoUrl = (url: string) => {
    return url.toLowerCase().match(/\.(mp4|mov|webm|quicktime)/) || url.includes('.mp4?');
  };

  if (loading) return <Layout><div className="flex items-center justify-center min-h-screen text-red-500 font-black uppercase tracking-widest animate-pulse">Establishing Link...</div></Layout>;

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto flex flex-col gap-10">
        
        {/* Profile Command Center */}
        <div className="relative bg-zinc-950 border border-zinc-900 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-8 pt-12 md:pt-16 shadow-2xl mt-8 md:mt-12 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-900 to-transparent" />
          
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6 md:mb-8 group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-zinc-900 shadow-2xl shadow-black/80 transition-transform group-hover:scale-105 duration-500">
                <img 
                  src={userData?.picture || "https://ui-avatars.com/api/?background=random"} 
                  alt="Identity" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <button 
                onClick={() => navigate('/profile')}
                className="absolute bottom-2 right-2 bg-red-600 text-white p-3 rounded-2xl border-4 border-zinc-950 hover:bg-red-700 transition-all shadow-xl active:scale-90"
                aria-label="Update profile picture"
              >
                <Camera size={20} />
              </button>
            </div>

            <div className="space-y-1 mb-6 md:mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-white flex items-center justify-center gap-3 italic">
                {userData?.username || userData?.name}
                {userData?.access?.toLowerCase() === 'admin' && <ShieldCheck size={20} className="text-red-500 md:w-6 md:h-6" />}
              </h2>
              <div className="flex items-center justify-center gap-2 text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">
                <MapPin size={10} className="text-red-600 md:w-3 md:h-3" />
                {userData?.city ? `${userData.city}, ${userData.state}` : 'Location Hidden'}
              </div>
            </div>

            <div className="w-full grid grid-cols-1 gap-4 text-left">
              <div className="bg-zinc-900/40 p-5 rounded-[2rem] border border-zinc-900">
                <span className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1.5 block">Status</span>
                <p className={`text-base font-bold ${userData?.status?.includes('Not Open') ? 'text-zinc-500' : 'text-white'}`}>
                  {userData?.status || 'Undefined'}
                </p>
              </div>

              <div className="bg-zinc-900/40 p-5 rounded-[2rem] border border-zinc-900">
                <span className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1.5 block">Approach Style</span>
                <p className="text-sm font-bold text-zinc-300 italic">
                  "{userData?.approachStyle || 'No logic defined.'}"
                </p>
              </div>
            </div>

            <div className="mt-8 md:mt-10 flex flex-row flex-wrap justify-center gap-3 md:gap-4">
              <button 
                onClick={() => navigate('/profile')}
                className="flex-1 min-w-[140px] flex flex-col items-center gap-1 text-[9px] md:text-[10px] font-black text-white bg-red-600 border border-red-500 px-4 md:px-8 py-3 md:py-4 rounded-2xl hover:bg-red-700 transition-all uppercase tracking-[0.2em] shadow-xl"
                aria-label="Edit your profile details"
              >
                <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                <span>Update Profile</span>
              </button>

              <button 
                onClick={handleShare}
                className={`flex-1 min-w-[140px] flex flex-col items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-4 md:px-8 py-3 md:py-4 rounded-2xl transition-all shadow-xl ${
                  shareSuccess 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white hover:bg-red-700 border border-red-500'
                }`}
                aria-label="Share your profile link"
              >
                {shareSuccess ? <Check size={16} className="md:w-[18px] md:h-[18px]" /> : <Share2 size={16} className="md:w-[18px] md:h-[18px]" />}
                <span>{shareSuccess ? 'Packet Copied' : 'Profile Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collection Grid */}
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-4 px-2">
            <h3 className="text-base font-black uppercase tracking-widest flex items-center gap-3">
              <LayoutGrid className="text-red-500" size={20} /> Media Collection
              <span className="text-zinc-700 text-[10px] font-mono mt-1">[{userData?.photos?.length || 0}/20]</span>
            </h3>
            <button 
              onClick={() => zipInputRef.current?.click()}
              disabled={isZipping}
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 px-4 py-2 rounded-xl transition-all border border-zinc-800"
              aria-label="Import media from a zip archive"
            >
              {isZipping ? <Loader2 className="animate-spin" size={12} /> : <Package size={12} />}
              Import .zip
            </button>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,video/*" 
            onChange={handleCollectionUpload} 
          />
          <input 
            type="file" 
            ref={zipInputRef} 
            className="hidden" 
            accept=".zip" 
            onChange={handleZipImport} 
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {userData?.photos?.map((url, i) => {
              const isSlotUploading = uploadingSlot === i;
              const isSlotDeleting = deletingPhoto === url;
              const isConfirming = confirmDeleteIndex === i;

              return (
                <div key={`${url}-${i}`} className="aspect-square rounded-2xl overflow-hidden border border-zinc-900 relative group bg-zinc-950 shadow-xl">
                  {isVideoUrl(url) ? (
                    <video src={url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                  ) : (
                    <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt={`Node ${i}`} />
                  )}
                  
                  {(isSlotUploading || isSlotDeleting) && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center">
                      <Loader2 className="animate-spin text-red-500" size={24} />
                    </div>
                  )}

                  {!isSlotUploading && !isSlotDeleting && (
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-20 flex flex-col items-center justify-end pb-4 gap-3 transition-all ${isConfirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {isConfirming && (
                         <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="bg-red-600 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-red-400">Confirm Deletion</span>
                         </div>
                      )}
                      
                      <div className="flex gap-2">
                        {!isConfirming && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); triggerUpload(i); }}
                            className="p-3 bg-zinc-900/80 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-black transition-all border border-white/10"
                            aria-label={`Replace media at index ${i + 1}`}
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleDeletePhoto(e, i)}
                          className={`p-3 rounded-xl text-white transition-all border ${
                            isConfirming 
                            ? 'bg-red-600 border-red-400 scale-110 z-40' 
                            : 'bg-red-600/80 backdrop-blur-md border-red-900/20 hover:bg-red-600'
                          }`}
                          aria-label={isConfirming ? `Confirm deletion of media at index ${i + 1}` : `Delete media at index ${i + 1}`}
                        >
                          {isConfirming ? <AlertCircle size={14} /> : <Trash2 size={14} />}
                        </button>
                        {isConfirming && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); setConfirmDeleteIndex(null); }}
                             className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all border border-zinc-700"
                             aria-label="Cancel deletion"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isVideoUrl(url) && (
                    <div className="absolute top-3 left-3 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white z-10 border border-white/10">
                      <Film size={12} />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 text-[9px] font-mono text-white/40 p-1 bg-black/40 rounded italic">#{i+1}</div>
                </div>
              );
            })}

            {/* Empty slots logic */}
            {Array.from({ length: Math.max(0, 20 - (userData?.photos?.length || 0)) }).map((_, i) => {
              const absIndex = (userData?.photos?.length || 0) + i;
              const isSlotUploading = uploadingSlot === absIndex;

              return (
                <button 
                  key={`empty-${i}`} 
                  onClick={() => !isSlotUploading && triggerUpload(null)}
                  disabled={isSlotUploading}
                  className="aspect-square rounded-2xl border-2 border-dashed border-zinc-900 flex flex-col items-center justify-center text-zinc-800 hover:text-red-500 hover:border-red-900/30 transition-all gap-2 bg-zinc-950/40 group shadow-inner"
                  aria-label={`Upload media to slot ${absIndex + 1}`}
                >
                  {isSlotUploading ? (
                    <Loader2 className="animate-spin text-red-600" size={24} />
                  ) : (
                    <>
                      <Plus size={20} className="group-hover:scale-125 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-center px-2">Initialize</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};
