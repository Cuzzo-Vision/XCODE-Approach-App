importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD024BD5q9F2JWO8QYtwG8CnuCWrCoNXsc",
  authDomain: "approach-673e0.firebaseapp.com",
  projectId: "approach-673e0",
  storageBucket: "approach-673e0.firebasestorage.app",
  messagingSenderId: "815257292796",
  appId: "1:815257292796:web:d2bef3f761cbb9f0e76c79",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', // Replace with your app icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
