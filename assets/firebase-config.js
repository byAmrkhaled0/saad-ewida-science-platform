// Firebase configuration for Saad Ewida Science Platform.
// These web identifiers are public. Protection is provided by Authentication,
// Firestore/Storage Rules and Cloud Functions. App Check/reCAPTCHA are not used.
window.MF_FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyANU2fln6kuYCtdm1WRMtG-AD5pUwV9a4g",
  authDomain: "saad-ewida-science-platform.firebaseapp.com",
  projectId: "saad-ewida-science-platform",
  storageBucket: "saad-ewida-science-platform.firebasestorage.app",
  messagingSenderId: "805108517684",
  appId: "1:805108517684:web:68c0cb7e506a583e3a7361",
  measurementId: "G-V5MR9BGCJQ",
  functionsRegion: "europe-west1",
  // Paste the Firebase Console > Cloud Messaging > Web Push public VAPID key
  // here to receive booking notifications while the teacher app is closed.
  messagingVapidKey: "",
  useSecureFunctions: true
};
