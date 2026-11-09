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
- `TEAM_LEADER`: gestión de equipo
- `NEST_STUDENT` y `NEST_INSTRUCTOR`: acceso limitado al portal de reservas The Nest
- `PENDING`: cuenta sin acceso hasta que el personal la autorice

> Los roles viven en `users/{uid}.role` y se controlan en `firestore.rules`.

## Colecciones
- `users`, `payments`, `expenses`, `checkins`, `trainings`, `athletes`
- `nest_bookings`, `nest_class_sessions`, `nest_monthly_usage` (reservas de The Nest; solo se modifican desde Cloud Functions)

## Alta de usuarios (OWNER)
Para crear usuarios con contraseña temporal desde la UI necesitas desplegar **Firebase Functions**.

```powershell
firebase deploy --only functions
```

Luego desde **Roles** puedes crear usuarios y se marcarán con `mustChangePassword = true`.
Al iniciar sesión por primera vez, el usuario verá el modal para cambiar su contraseña.

## Notas
- Las cuentas sin un perfil de rol empiezan como `PENDING`; no obtienen acceso interno automáticamente.
- Las alumnas y profesoras de The Nest usan el portal limitado documentado en [README_RESERVAS_THE_NEST.md](README_RESERVAS_THE_NEST.md).
- Las reservas verifican la mensualidad y el aforo en Cloud Functions; despliega Functions, reglas e índices de Firestore al publicar cambios.
