import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || "",
      firstName: "",
      lastName: "",
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
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    displayName: data.displayName || "",
    email: data.email || user.email,
  };
}

export async function updateUserProfile(userId, firstName, lastName) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    firstName,
    lastName,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserProfile(userId) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function logout() {
  await signOut(auth);
}

export function bindAuth(ui, onAuthChange, setAuthUI) {
  setPersistence(auth, browserLocalPersistence).then(() => {
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
      setAuthUI(ui, user, role, mustChangePassword);
      await onAuthChange(user, { role, mustChangePassword });
    });
  });
}
