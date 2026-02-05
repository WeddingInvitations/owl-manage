import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
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
      createdAt: serverTimestamp(),
    });
  }

  const updated = await getDoc(userRef);
  return updated.data().role || "RECEPTION";
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
    if (user) {
      role = await ensureUserProfile(user);
    }
    setAuthUI(ui, user, role);
    await onAuthChange(user, role);
  });
}
