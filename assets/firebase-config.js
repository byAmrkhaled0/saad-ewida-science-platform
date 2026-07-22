// Firebase configuration for Saad Ewida Science Platform.
// These web identifiers are public. Protection is provided by Authentication,
// Firestore/Storage Rules and Cloud Functions. App Check/reCAPTCHA is disabled.
window.MF_FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyDG5LHrXBeyKFaN1Tmq5HjOX-nOv2z_BBA",
  authDomain: "saad-ewida-science-platform.firebaseapp.com",
  projectId: "saad-ewida-science-platform",
  storageBucket: "saad-ewida-science-platform.firebasestorage.app",
  messagingSenderId: "459812644202",
  appId: "1:459812644202:web:0b02982aab7f74fdcf7113",
  measurementId: "G-684QSBGEZQ",
  functionsRegion: "europe-west1",
  // Paste the Firebase Console > Cloud Messaging > Web Push public VAPID key
  // here to receive booking notifications while the teacher app is closed.
  messagingVapidKey: "BDQTb-JGSPJeRkC9TvxTd9G3UmmgSa7dDF6Aq0D22u89HvuEx4y-lq5WPjoQR-97YyYG6jqlWTDkqYP6pZOZTI8",
  useSecureFunctions: true
};
