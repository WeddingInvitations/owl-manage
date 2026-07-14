const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth requerida");
  }

  // Determinar el rol del que llama igual que en las reglas de Firestore:
  // si no hay documento o no tiene rol, se considera OWNER por defecto.
  const callerRef = admin.firestore().collection("users").doc(context.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.exists ? callerSnap.data() || {} : {};
  const callerRole = callerData.role || "OWNER";

  if (callerRole !== "OWNER") {
    throw new functions.https.HttpsError("permission-denied", "Solo OWNER");
  }

  const email = String(data.email || "").trim();
  const tempPassword = String(data.tempPassword || "");
  const role = String(data.role || "RECEPTION");

  if (!email || tempPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Datos inválidos");
  }
  try {
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
  } catch (error) {
    console.error("createUserWithRole error", error);

    // Errores típicos de Firebase Auth
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "Ya existe un usuario con ese email."
      );
    }

    if (error.code === "auth/invalid-password") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña temporal no es válida."
      );
    }

    if (error.code === "auth/invalid-email") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "El email no tiene un formato válido."
      );
    }

    // Cualquier otro error
    throw new functions.https.HttpsError(
      "internal",
      "Error interno al crear el usuario."
    );
  }
});

// Proxy para la API de WodBuster (solución CORS)
exports.wodBusterProxy = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida");
  }

  const endpoint = data.endpoint || '/api/users/Get';
  const method = data.method || 'GET';
  const body = data.body || null;
  
  const WODBUSTER_CONFIG = {
    apiKey: 'abc97d4d-2378-4d97-b39e-90b7ce54522c',
    baseUrl: 'https://owl.wodbuster.com',
  };

  const url = `${WODBUSTER_CONFIG.baseUrl}${endpoint}`;

  try {
    console.log(`WodBuster Proxy: ${method} ${url}`);
    console.log('API Key (primeros 10 chars):', WODBUSTER_CONFIG.apiKey.substring(0, 10) + '...');
    if (body) {
      console.log('Request body:', JSON.stringify(body));
    }
    
    // Configurar headers y body según el método
    const fetchOptions = {
      method: method,
      headers: {
        'API_ACCESS_KEY': WODBUSTER_CONFIG.apiKey,
        'Accept': 'application/json'
      },
    };
    
    // Añadir body para métodos que lo soportan
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, fetchOptions);
    
    console.log('Headers enviados: X-API-Key y API-Key');

    console.log('WodBuster Response Status:', response.status, response.statusText);
    
    // Leer la respuesta siempre (incluso si hay error)
    const responseText = await response.text();
    console.log('WodBuster Response Body:', responseText);
    
    if (!response.ok) {
      // Si la respuesta es JSON con error, parsearlo
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText || response.statusText };
      }
      
      console.error(`WodBuster API Error ${response.status}:`, errorData);
      
      // Retornar el error de forma estructurada para el cliente
      return {
        EsOk: false,
        errorCode: response.status,
        errorMessage: errorData.errorMessage || errorData.message || errorData.error || response.statusText,
        errorDetails: errorData
      };
    }

    // Parsear respuesta exitosa
    const responseData = JSON.parse(responseText);
    console.log('WodBuster API Success:', responseData);
    
    return responseData;
  } catch (error) {
    console.error('Error en proxy WodBuster:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      "internal",
      `Error al conectar con WodBuster: ${error.message}`
    );
  }
});
