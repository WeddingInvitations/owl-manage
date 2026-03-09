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
    const isPasswordUser = Array.isArray(user.providerData)
      ? user.providerData.some((p) => p && p.providerId === "password")
      : false;

    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || "",
      firstName: "",
      lastName: "",
      role: "RECEPTION",
      // Si es un usuario de email/contraseña creado fuera del flujo de Roles,
      // obligamos a cambiar la contraseña en el primer acceso.
      mustChangePassword: isPasswordUser,
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
    photoUrl: data.photoUrl || user.photoURL || "",
  };
}

export async function updateUserProfile(userId, firstName, lastName, photoUrl) {
  const userRef = doc(db, "users", userId);
  const payload = {
    firstName,
    lastName,
    updatedAt: serverTimestamp(),
  };
  if (typeof photoUrl === "string") {
    payload.photoUrl = photoUrl;
  }
  await updateDoc(userRef, payload);
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
      let profile = {
        role: "RECEPTION",
        mustChangePassword: false,
        firstName: "",
        lastName: "",
        displayName: "",
        email: "",
        photoUrl: "",
      };

      if (user) {
        profile = await ensureUserProfile(user);
      }

      setAuthUI(ui, user, profile.role, profile.mustChangePassword);
      await onAuthChange(user, profile);
    });
  });
}
