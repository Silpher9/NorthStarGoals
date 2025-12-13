import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration for NorthStarGoals
const firebaseConfig = {
  apiKey: "AIzaSyCjm62OU-GrzVO14oPvhLHHiaim06lpLS8",
  authDomain: "northstargoals-4e83c.firebaseapp.com",
  projectId: "northstargoals-4e83c",
  storageBucket: "northstargoals-4e83c.firebasestorage.app",
  messagingSenderId: "501283794426",
  appId: "1:501283794426:web:45b16f587b5cd72c38c843"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
