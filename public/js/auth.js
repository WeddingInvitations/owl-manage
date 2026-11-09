import { auth, db, functions } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
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
      role: "PENDING",
      mustChangePassword: false,
      createdAt: serverTimestamp(),
    });
  }

  const updated = await getDoc(userRef);
  const data = updated.data() || {};
  return {
    role: data.role || "PENDING",
    mustChangePassword: Boolean(data.mustChangePassword),
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    displayName: data.displayName || "",
    email: data.email || user.email,
    photoUrl: data.photoUrl || user.photoURL || "",
    athleteId: data.athleteId || "",
    nestFamilies: data.nestFamilies || [],
    accessMessage: "",
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

    ui.nestSignupForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (ui.nestSignupStatus)
        ui.nestSignupStatus.textContent = "Creando cuenta y comprobando el correo…";
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          ui.nestSignupEmail.value.trim().toLowerCase(),
          ui.nestSignupPassword.value
        );
        await sendEmailVerification(credential.user);
        await signOut(auth);
        ui.nestSignupForm.reset();
        if (ui.nestSignupStatus)
          ui.nestSignupStatus.textContent = "Te hemos enviado un correo de verificación. Confírmalo y después inicia sesión para comprobar tu ficha.";
      } catch (error) {
        console.error("Error creating The Nest account:", error);
        if (ui.nestSignupStatus)
          ui.nestSignupStatus.textContent = error.message || "No se pudo crear la cuenta.";
      }
    });

    ui.googleLoginBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    });

    ui.logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
    });
    ui.pendingAccessLogout?.addEventListener("click", async () => {
      await signOut(auth);
    });

    onAuthStateChanged(auth, async (user) => {
      let profile = {
        role: "PENDING",
        mustChangePassword: false,
        firstName: "",
        lastName: "",
        displayName: "",
        email: "",
        photoUrl: "",
        nestFamilies: [],
      };

      if (user) {
        profile = await ensureUserProfile(user);
        if (profile.role === "PENDING") {
          try {
            const registerPortalAccount = httpsCallable(
              functions,
              "registerNestPortalAccount"
            );
            await registerPortalAccount({});
            profile = await ensureUserProfile(user);
          } catch (error) {
            profile = {
              ...profile,
              accessMessage: error.message || "Tu cuenta todavía no está habilitada.",
            };
          }
        }
        if (profile.role === "NEST_STUDENT" || profile.role === "NEST_INSTRUCTOR") {
          try {
            const refreshPortalAccess = httpsCallable(functions, "refreshNestPortalAccess");
            await refreshPortalAccess({});
            profile = await ensureUserProfile(user);
          } catch (error) {
            profile = {
              ...profile,
              accessMessage: error.message || "No se pudo verificar el acceso al portal The Nest.",
            };
          }
        }
      }

      setAuthUI(ui, user, profile.role, profile.mustChangePassword);
      await onAuthChange(user, profile);
    });
  });
}
