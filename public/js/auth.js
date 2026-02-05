import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      role: "RECEPTION",
      mustChangePassword: false,
      createdAt: serverTimestamp(),
    });
  }

  const updated = await getDoc(userRef);
  const data = updated.data() || {};
  return {
    role: data.role || "RECEPTION",
    mustChangePassword: Boolean(data.mustChangePassword),
  };
}

export async function changePassword(user, newPassword) {
  await updatePassword(user, newPassword);
}

export function bindAuth(ui, onAuthChange, setAuthUI) {
  ui.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signInWithEmailAndPassword(
      auth,
      ui.loginEmail.value,
      ui.loginPassword.value
    );
    ui.loginForm.reset();
  });

  ui.googleLoginBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  });

  ui.logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async (user) => {
    let role = "RECEPTION";
    let mustChangePassword = false;
    if (user) {
      const profile = await ensureUserProfile(user);
      role = profile.role;
      mustChangePassword = profile.mustChangePassword;
    }
    setAuthUI(ui, user, role);
    await onAuthChange(user, { role, mustChangePassword });
  });
}
