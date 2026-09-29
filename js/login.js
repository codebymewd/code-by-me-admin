import { login } from "./admin-auth.js";
import { auth, onAuthStateChanged } from "./admin-firebase.js";
import { isOwner } from "./admin-firebase.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((err) => console.error("SW registration failed:", err));
}

// If already signed in as a verified owner, skip straight to the dashboard.
onAuthStateChanged(auth, async (user) => {
  if (user && (await isOwner(user.uid))) {
    window.location.href = "index.html";
  }
});

if (new URLSearchParams(location.search).get("denied") === "1") {
  document.getElementById("denied-notice").style.display = "block";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("login-btn");
  const errorEl = document.getElementById("login-error");
  errorEl.style.display = "none";

  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    await login(email, password);
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Incorrect email or password.";
    errorEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});
