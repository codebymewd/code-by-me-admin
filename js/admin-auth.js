// =====================================================================
// ADMIN-AUTH.JS
// login.html calls login(). Every protected page (index.html) calls
// requireAuth() before rendering anything, so there is no page that
// shows real data before an owner check has completed.
// =====================================================================

import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, isOwner } from "./admin-firebase.js";

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
  window.location.href = "login.html";
}

/**
 * Resolves once with the authenticated + verified-owner user, or redirects
 * to login.html and never resolves (the caller's page navigates away).
 * Call this before rendering any dashboard content.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const ownerOk = await isOwner(user.uid);
      if (!ownerOk) {
        // Authenticated with Firebase, but not listed in admins/{uid}.
        // Sign out rather than leaving a half-authenticated session sitting
        // in front of a dashboard it isn't authorized to use.
        await signOut(auth);
        window.location.href = "login.html?denied=1";
        return;
      }
      resolve(user);
    });
  });
}
