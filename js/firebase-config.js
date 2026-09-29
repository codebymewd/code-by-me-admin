// =====================================================================
// FIREBASE CONFIG — standalone copy for the CBM Owner Dashboard.
// These values identify the project only; they are not secrets. Access
// control is enforced by Firestore Security Rules (firestore.rules),
// not by hiding this file.
//
// NOTE: this is the SAME Firebase project the public CBM website uses.
// Keeping the config identical in both places is what lets this
// dashboard manage the same Firestore data — it's a separate deployment,
// not a separate backend.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, getCountFromServer, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDURpUWg06T_Vozq6IStAJkukTseJklsZc",
  authDomain: "codebyme-2d414.firebaseapp.com",
  projectId: "codebyme-2d414",
  storageBucket: "codebyme-2d414.firebasestorage.app",
  messagingSenderId: "19698503295",
  appId: "1:19698503295:web:edfc948d0c04e14cc9794a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Firebase Cloud Messaging Web Push VAPID public key.
export const VAPID_KEY = "BKc6bZK0A-DGBy4BqRWTc8tB86gMH8YJddQt_y0DRL1NuXFszQezo0rwtnjQy_isvPjh460ThCYyViSAESnznkA";

export {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, getCountFromServer, onSnapshot,
  onAuthStateChanged, signInWithEmailAndPassword, signOut
};
