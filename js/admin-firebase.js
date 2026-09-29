// =====================================================================
// ADMIN-FIREBASE.JS — single import point for every dashboard page.
// Uses its own local firebase-config.js (same Firebase project as the
// public CBM website, but no file dependency on that codebase — this
// is a standalone deployment), plus an isOwner() check used by
// admin-auth.js.
//
// Owner authorization model: a Firebase Auth user is only treated as
// the CBM owner if a document exists at admins/{their uid}. This keeps
// "who can write" enforced in Firestore Security Rules (deployed via
// the Firebase console — see firestore.rules in the public website
// project), not just in the dashboard's own UI — logging in with a
// random Firebase account is not enough on its own.
// =====================================================================

export {
  app, db, auth, VAPID_KEY,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, getCountFromServer, onSnapshot,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "./firebase-config.js";

import { db, doc, getDoc } from "./firebase-config.js";

export async function isOwner(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (err) {
    console.error("Owner check failed:", err);
    return false;
  }
}
