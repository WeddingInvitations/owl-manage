import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import { app } from "./firebase.js";

const functions = getFunctions(app);
const createUserCallable = httpsCallable(functions, "createUserWithRole");

export async function createUserWithRole(email, tempPassword, role) {
  try {
    const result = await createUserCallable({ email, tempPassword, role });
    return result.data;
  } catch (error) {
    const code = error?.code || "";

    if (code === "functions/permission-denied") {
      throw new Error("No tienes permisos para crear usuarios. Solo OWNER puede hacerlo.");
    }

    if (code === "functions/not-found") {
      throw new Error("La función createUserWithRole no está desplegada. Ejecuta: firebase deploy --only functions");
    }

    if (code === "functions/already-exists") {
      throw new Error("Ya existe un usuario con ese email.");
    }

    if (code === "functions/invalid-argument") {
      throw new Error(error?.message || "Datos inválidos. Revisa email y contraseña temporal (mínimo 6 caracteres).");
    }

    throw new Error(error?.message || "No se pudo crear el usuario. Revisa la configuración de Firebase Functions.");
  }
}
