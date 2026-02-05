# OwlManage MVP (Firebase)

MVP interno para gestión de box de CrossFit.

## Stack
- HTML + CSS + JS (todo en un módulo)
- Firebase Auth + Firestore
- Firebase Hosting

## Estructura
- `public/index.html`
- `public/css/styles.css`
- `public/js/*.js`

## Configuración rápida
1) Crea un proyecto en Firebase.
2) Habilita **Auth (Email/Password)** y **Firestore**.
3) Habilita el proveedor **Google** en Auth si quieres login con Gmail.
3) Crea una app web y copia la configuración en `firebaseConfig.js`.
4) Instala Firebase CLI si no la tienes.

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
```

## Ejecutar en local
```powershell
firebase emulators:start
```

Luego abre `http://localhost:5000`.

## Despliegue
```powershell
firebase deploy
```

## Roles
- `OWNER`: todo
- `COACH`: entrenamientos + fichajes
- `RECEPTION`: pagos + atletas + fichajes

> Los roles viven en `users/{uid}.role` y se controlan en `firestore.rules`.

## Colecciones
- `users`, `payments`, `expenses`, `checkins`, `trainings`, `athletes`

## Notas
- La primera vez que un usuario entra se crea en `users` con rol `RECEPTION`.
- Cambia el rol manualmente desde Firestore Console.
