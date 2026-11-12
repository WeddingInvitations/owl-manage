# Reservas de clases de The Nest

Esta guía describe el portal de reservas de Pilates y Barre dentro de OwlManage.

## Quién puede entrar

- **Alumnas:** crean una cuenta con email y contraseña. El email debe estar en su ficha de Pilates/Barre y deben verificarlo desde el correo que reciben. La cuenta queda limitada a las dos vistas de reservas.
- **Profesoras externas:** OWNER o TEAM_LEADER registra su nombre, email y disciplina en **Equipo → Profesores**. Después crean una cuenta usando ese mismo email y lo verifican. Solo podrán ver la lista y marcar asistencia en las disciplinas autorizadas.
- **Personal de OwlManage:** OWNER, RECEPTION, COACH y TEAM_LEADER pueden entrar desde el menú **Usuarios → Reservas · Pilates** o **Reservas · Barre**. En las clases pueden ver la lista y asistencia; OWNER/recepción y los demás roles internos también pueden reservar en nombre de una alumna usando el email de su ficha.

Una cuenta sin ficha vinculada queda en **Acceso pendiente** y no puede consultar las áreas internas de OwlManage.

## Preparar el alta de alumnas existentes

Antes de que una alumna se registre, su ficha de The Nest necesita un correo correcto y único:

1. En **Usuarios → The Nest**, usa el icono del sobre de la fila para introducir o corregir el correo; o importa un CSV que incluya una columna `correo` o `email`.
2. Para nuevas alumnas, el formulario de alta solicita el correo.
3. Al crear la cuenta, la alumna debe utilizar y verificar exactamente ese correo.

En el editor de la ficha se pueden marcar por separado **The Nest Pilates** y **The Nest Barre**. Cada disciplina conserva su propia mensualidad; guardar una no sustituye la cuota de la otra. Si una ficha antigua no muestra una de sus disciplinas porque la cuota anterior fue sobrescrita, recepción puede marcar ambas en ese editor.

La ficha se asocia a la cuenta por email; la reserva no se autoriza solo por tener una cuenta. Si no se encuentra la ficha, hay duplicados o el email no coincide, recepción debe corregir los datos antes de habilitar el acceso.

## Reservar una clase

1. Abre **Reservas · Pilates** o **Reservas · Barre** y consulta las próximas cuatro semanas. Usa los botones de periodo para ver otras fechas.
2. Pulsa **Reservar plaza** en una sesión disponible. El sistema confirma la plaza inmediatamente.
3. Cada clase admite un máximo de **6 reservas**. El último asiento se asigna de forma segura aunque varias personas intenten reservar al mismo tiempo.
4. Solo se puede reservar en la disciplina cuya tarifa está activa y pagada para el mes de la clase.
5. La tarifa mensual establece el máximo de reservas de ese mes: **Reformer/Barre 4, 8 o 12**. Una cancelación hecha al menos **2 horas antes** de empezar libera la plaza y devuelve una sesión al límite mensual.
6. Si la clase está completa, no se puede reservar. No hay lista de espera en esta primera versión.

En móvil, la reserva muestra un mini calendario mensual laboral (lunes a viernes) con marcas en los días reservados, una tira de los cinco días laborables y debajo las clases del día elegido. En ordenador, la semana también aparece de lunes a viernes en cinco columnas. Cada clase presenta sus seis plazas como avatares: al reservar, se ocupa una plaza; las vacías quedan disponibles. Si una alumna no tiene foto, se muestra la inicial de su nombre.

Cada persona puede abrir **Mi perfil** y añadir o quitar su foto. La imagen se reduce en el dispositivo y se guarda en su perfil; no es necesario subirla para poder reservar.

## Para el personal y las profesoras

- Las clases usan los horarios semanales ya configurados para Pilates y Barre, incluidas las franjas personalizadas existentes.
- Una profesora abre **Ver lista y asistencia** para consultar las reservas y marcar quién asistió.
- Para reservar en nombre de una alumna, el personal usa **Reservar para alumna**, busca su nombre y pulsa **Reservar** en su ficha. El correo se muestra solo para distinguir nombres iguales; no hay que escribirlo y también se pueden elegir fichas sin correo. Las alumnas ya inscritas aparecen como **Ya reservada**. Se aplican las mismas reglas de pago, tarifa y aforo.
- Este selector requiere publicar **getNestBookingAthletes** y actualizar **bookNestClass** antes del push del frontend. El listado completo solo se entrega al personal interno; alumnas y profesoras externas no tienen acceso. No requiere cambiar reglas ni índices de Firestore.
- Cambiar el email de una ficha desvincula el acceso del correo anterior. La alumna debe volver a entrar con el correo actualizado.

## Activación y puesta en marcha

### Rendimiento de reservas

- La navegación reutiliza el mes cargado durante **30 segundos**, con un máximo de seis entradas por navegador y claves separadas por cuenta, disciplina y mes. Peticiones simultáneas del mismo mes comparten una carga. El botón **Actualizar** fuerza una consulta nueva, también en móvil.
- Tras reservar o cancelar, el servidor devuelve los contadores confirmados de aforo y bono. La interfaz actualiza el mes ya cargado sin otra consulta completa. Si se usa una versión antigua del backend, se mantiene la recarga como alternativa compatible.
- Las lecturas independientes del calendario se ejecutan en paralelo. El historial propio se consulta solo para la disciplina y el periodo visible, y se reutiliza sin releer cada reserva individual. Los perfiles de compañeras se solicitan solo con su foto.
- No se cachean en el backend permisos, pagos, bonos ni aforos para autorizar reservas: las transacciones siguen comprobando los datos vigentes. Las plazas mostradas pueden variar por acciones de otras usuarias durante los 30 segundos de caché; el servidor siempre decide si hay plaza real.
- Para activar estas optimizaciones deben publicarse primero los índices de Firestore y esperar a que estén listos, después **getNestBookingSchedule**, **bookNestClass**, **cancelNestBooking**, **refreshNestPortalAccess**, y finalmente el Hosting **nest-reservas**. Los pushes publican App Engine y el Hosting de reservas; los cambios de backend y Firestore siguen siendo independientes.
- Las regresiones locales cubren 20 lecturas simultáneas, competición por seis plazas, peticiones duplicadas, límites mensuales, cancelaciones, caducidad y navegación. Usan Firestore simulado con aislamiento transaccional: no equivalen a una prueba de carga real ni miden latencia de producción. La interfaz se prueba con [tests/serve-booking-performance.mjs](tests/serve-booking-performance.mjs), que sustituye Firebase por datos ficticios.

Las funciones actuales están en **us-central1**. La latencia de red y los arranques en frío pueden seguir afectando a la primera petición. Mantener instancias calientes reduciría esa demora, pero supone coste recurrente y no se ha activado automáticamente.

El código ya contempla las funciones de servidor, las vistas y las reglas de acceso; para utilizarlas en producción hay que desplegar Functions, reglas e índices de Firestore y Hosting. Además, hay que rellenar los emails de las alumnas existentes y dar acceso de disciplina a las profesoras en sus fichas.

### Publicación automática al hacer push

El trigger **webapp** de Cloud Build, en **europe-west1**, se activa con pushes a **main** y detecta [cloudbuild.yaml](cloudbuild.yaml). Cada push ejecuta:

1. **OwlManage en App Engine**, usando [app.yaml](app.yaml), como hasta ahora.
2. **The Nest Reservas (https://the-nest-reservas.web.app)**, publicando el target **hosting:nest-reservas** desde la carpeta [public-reservas](public-reservas/index.html). Incluye HTML, JavaScript, CSS, imágenes y la guía PDF. Se ejecuta en paralelo con App Engine.
3. **Verificación del Hosting de reservas**, comparando por SHA-256 todos los archivos publicados con los del commit. Si el despliegue no confirma éxito o algún archivo no coincide, el build falla.

El despliegue de reservas ejecuta [scripts/deploy-firebase.sh](scripts/deploy-firebase.sh) en Node 22 con Firebase CLI **14.22.0**, usando las credenciales ADC de la cuenta de servicio de Cloud Build. No necesita iniciar sesión manualmente ni configurar `FIREBASE_TOKEN`. La cuenta del trigger debe tener permisos de Firebase Hosting en **owl-manage**; actualmente usa **owl-manage@appspot.gserviceaccount.com** con el rol existente **Editor**, sin cambios de IAM.

La comprobación ejecuta [scripts/verify-hosting.mjs](scripts/verify-hosting.mjs) con el argumento **nest-reservas**, para no comprobar el sitio independiente de Firebase Hosting de OwlManage que este pipeline no publica. Sin argumento, el script conserva la comprobación de ambos sitios.

**No se despliegan automáticamente Cloud Functions, reglas ni índices de Firestore, ni el target de Firebase Hosting owlmanage.** Los cambios de backend y Firestore se publican por separado antes del push del frontend que dependa de ellos. Tampoco se instalan dependencias ni se ejecutan pruebas de Functions en el push.

Incluye la configuración actualizada en el commit y haz push a **main**. Comprueba que el build termine con estado **Correcto**; los builds que ya estén en ejecución no cambian sus pasos por esta modificación.

El calendario administrativo anterior conserva listas recurrentes de alumnas. Antes de activar las reservas para una clase, el personal debe contrastar esa lista con las reservas nuevas y acordar desde qué fecha se considera el aforo de seis plazas; el portal nuevo no convierte automáticamente las asignaciones antiguas en reservas individuales.

No se deben dar permisos Firestore directos de lectura a las cuentas de alumnas/profesoras. Las reservas pasan por Cloud Functions para verificar identidad, mensualidad, cupo y límite del bono de forma atómica.
