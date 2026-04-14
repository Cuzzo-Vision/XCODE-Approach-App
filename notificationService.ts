import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const requestNotificationPermission = async (userId: string) => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BIsS-X_Y_Z_PLACEHOLDER_VAPID_KEY' // You need to generate this in Firebase Console
      });

      if (token) {
        await updateDoc(doc(db, 'users', userId), {
          fcmToken: token
        });
        return token;
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
  return null;
};

export const sendNotification = async (targetUserId: string, title: string, body: string, data?: any) => {
  try {
    const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
    if (!targetUserDoc.exists()) return;

    const targetUserData = targetUserDoc.data();
    const token = targetUserData.fcmToken;

    if (!token) {
      console.log(`No FCM token for user ${targetUserId}`);
      return;
    }

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        title,
        body,
        data
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return;
  return onMessage(messaging, callback);
};
