const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth requerida");
  }

  const callerRef = admin.firestore().collection("users").doc(context.auth.uid);
  const callerSnap = await callerRef.get();
  const callerRole = callerSnap.data()?.role;

  if (callerRole !== "OWNER") {
    throw new functions.https.HttpsError("permission-denied", "Solo OWNER");
  }

  const email = String(data.email || "").trim();
  const tempPassword = String(data.tempPassword || "");
  const role = String(data.role || "RECEPTION");

  if (!email || tempPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Datos inválidos");
  }

  const userRecord = await admin.auth().createUser({
    email,
    password: tempPassword,
    emailVerified: false,
  });

  await admin.firestore().collection("users").doc(userRecord.uid).set({
    email,
    role,
    mustChangePassword: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  });

  return { uid: userRecord.uid };
});
