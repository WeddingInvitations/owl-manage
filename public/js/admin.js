import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import { app } from "./firebase.js";

const functions = getFunctions(app);
const createUserCallable = httpsCallable(functions, "createUserWithRole");

export async function createUserWithRole(email, tempPassword, role) {
  const result = await createUserCallable({ email, tempPassword, role });
  return result.data;
}
