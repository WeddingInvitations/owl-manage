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

La ficha se asocia a la cuenta por email; la reserva no se autoriza solo por tener una cuenta. Si no se encuentra la ficha, hay duplicados o el email no coincide, recepción debe corregir los datos antes de habilitar el acceso.

## Reservar una clase

1. Abre **Reservas · Pilates** o **Reservas · Barre** y consulta las próximas cuatro semanas. Usa los botones de periodo para ver otras fechas.
2. Pulsa **Reservar plaza** en una sesión disponible. El sistema confirma la plaza inmediatamente.
3. Cada clase admite un máximo de **6 reservas**. El último asiento se asigna de forma segura aunque varias personas intenten reservar al mismo tiempo.
4. Solo se puede reservar en la disciplina cuya tarifa está activa y pagada para el mes de la clase.
5. La tarifa mensual establece el máximo de reservas de ese mes: **Reformer/Barre 4, 8 o 12**. Una cancelación hecha al menos **2 horas antes** de empezar libera la plaza y devuelve una sesión al límite mensual.
6. Si la clase está completa, no se puede reservar. No hay lista de espera en esta primera versión.

En móvil, la reserva muestra un mini calendario mensual con marcas en los días reservados, una tira para elegir el día de la semana y debajo las clases de ese día. Cada clase presenta sus seis plazas como avatares: al reservar, se ocupa una plaza; las vacías quedan disponibles. Si una alumna no tiene foto, se muestra la inicial de su nombre.

Cada persona puede abrir **Mi perfil** y añadir o quitar su foto. La imagen se reduce en el dispositivo y se guarda en su perfil; no es necesario subirla para poder reservar.

## Para el personal y las profesoras

- Las clases usan los horarios semanales ya configurados para Pilates y Barre, incluidas las franjas personalizadas existentes.
- Una profesora abre **Ver lista y asistencia** para consultar las reservas y marcar quién asistió.
- Para reservar en nombre de una alumna, el personal usa **Reservar para alumna** y escribe el email que aparece en su ficha. Se aplican las mismas reglas de pago, tarifa y aforo.
- Cambiar el email de una ficha desvincula el acceso del correo anterior. La alumna debe volver a entrar con el correo actualizado.

## Activación y puesta en marcha

El código ya contempla las funciones de servidor, las vistas y las reglas de acceso; para utilizarlas en producción hay que desplegar Functions, reglas e índices de Firestore y Hosting. Además, hay que rellenar los emails de las alumnas existentes y dar acceso de disciplina a las profesoras en sus fichas.

El calendario administrativo anterior conserva listas recurrentes de alumnas. Antes de activar las reservas para una clase, el personal debe contrastar esa lista con las reservas nuevas y acordar desde qué fecha se considera el aforo de seis plazas; el portal nuevo no convierte automáticamente las asignaciones antiguas en reservas individuales.

No se deben dar permisos Firestore directos de lectura a las cuentas de alumnas/profesoras. Las reservas pasan por Cloud Functions para verificar identidad, mensualidad, cupo y límite del bono de forma atómica.
