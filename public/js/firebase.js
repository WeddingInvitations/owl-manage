import { firebaseConfig } from "./firebaseConfig.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, disableNetwork, enableNetwork } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Función para limpiar cache pendiente de Firestore
export async function clearFirestorePendingWrites() {
  try {
    console.log('Limpiando escrituras pendientes de Firestore...');
    await disableNetwork(db);
    await enableNetwork(db);
    console.log('Cache de Firestore limpiado');
  } catch (error) {
    console.error('Error limpiando cache:', error);
  }
}
