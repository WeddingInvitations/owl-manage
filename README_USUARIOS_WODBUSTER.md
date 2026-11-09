# Guía de usuarios de WodBuster en OwlManage

Esta guía explica cómo consultar y mantener la lista de personas asociadas a WodBuster desde OwlManage. Está escrita para el uso diario, sin necesidad de conocimientos técnicos.

## Antes de empezar: hay dos tipos de usuarios

En OwlManage, la palabra «usuario» puede referirse a dos cosas diferentes:

1. **Miembro de WodBuster:** una persona que entrena o tiene una tarifa, clase o bono. Aparece en la pantalla **Usuarios WodBuster**.
2. **Cuenta de OwlManage:** una persona que puede iniciar sesión en la aplicación, por ejemplo, recepción o un entrenador. Se administra en **Admin → Roles**.

Dar de alta a un miembro en **Usuarios WodBuster** no crea una cuenta para que esa persona entre en OwlManage. Del mismo modo, crear una cuenta desde **Admin → Roles** no añade a esa persona a la lista de WodBuster.

## Abrir la pantalla

En el menú, entra en **Usuarios → Usuarios WodBuster**. La pantalla muestra una lista con información como nombre, email, tarifa, precio, estado y fecha hasta la que está pagado.

De forma predeterminada se muestran **Solo Activos**. Puedes cambiar el filtro a **Todos** o **Solo Inactivos**, y buscar por nombre, email o tarifa.

### Qué significa «Activo» en esta pantalla

Para aparecer como activo, la ficha debe estar marcada como alumno y tener una fecha válida de pago hasta hoy o una fecha posterior. Por eso, una ficha que diga «Activo» pero no tenga una fecha de pago válida puede aparecer como inactiva. La fecha es importante también para los bonos.

El resumen mensual ayuda a consultar las cifras mostradas, pero seleccionar otro mes no cambia la regla de actividad: esta se calcula con respecto a la fecha de hoy.

## Añadir un miembro manualmente

1. Pulsa **+ Añadir Usuario**.
2. Escribe el nombre y el email. El teléfono es opcional.
3. Elige el **Tipo de Alta**:
   - **Tarifa Mensual:** indica la tarifa, el estado y la fecha hasta la que está pagado. La aplicación calcula el precio cuando tiene un precio configurado para esa tarifa.
   - **Clase Suelta:** registra una clase suelta. Si no se indica una fecha de pago, la persona puede quedar fuera de la lista de activos.
   - **Bono 10 Clases:** indica la fecha de alta del bono. La aplicación añade diez clases y calcula una vigencia de seis meses desde esa fecha.
4. Completa los campos que aparezcan y guarda.

**Importante:** este alta crea la ficha en OwlManage. No crea ni registra automáticamente a la persona en WodBuster. Si necesitas que también figure en WodBuster, sigue el procedimiento de alta de esa plataforma.

## Editar una ficha

Pulsa el icono del lápiz en la fila de la persona, cambia los datos y guarda. Si la ficha tiene un identificador de WodBuster, OwlManage también intenta enviar los cambios a WodBuster. Si ese envío no funciona, el cambio local puede haberse guardado igualmente; revisa el aviso que aparece y confirma los datos en ambas plataformas si es necesario.

Al editar un bono, puedes usar **Eliminar Bono** para quitar el bono de la ficha. Esto pone a cero las clases y elimina la fecha del bono; si la ficha está vinculada con WodBuster, también se intenta actualizar allí.

La opción **Eliminar** borra la ficha de OwlManage. No equivale a eliminar a la persona en WodBuster, así que comprueba la plataforma antes de usarla.

## Sincronizar la lista con WodBuster

Usa **🔄 Sincronizar con WodBuster** para consultar WodBuster y actualizar la lista de OwlManage.

En términos sencillos, la aplicación compara las personas por email:

- Si encuentra el mismo email, actualiza la información que recibe de WodBuster y conserva otros datos que se mantienen en OwlManage, como el nombre o el teléfono.
- Si el email no existe todavía en OwlManage, crea una ficha local.
- Esta sincronización no elimina automáticamente de OwlManage a las personas que ya no aparezcan en la respuesta de WodBuster.

La sincronización importa los registros recibidos de WodBuster; el filtro **Solo Activos** de la tabla solo controla lo que ves después. Si una persona no aparece en pantalla, prueba con **Todos** y búscala por email.

## Sincronizar datos desde Excel o CSV

Esta opción sirve para completar o actualizar fichas existentes con la información de un archivo.

1. Si quieres incluir también fichas inactivas, cambia primero el filtro a **Todos**. La carga trabaja con la lista que está seleccionada/visible en ese momento.
2. Pulsa **📊 Sincronizar con Excel/CSV** y elige el archivo.
3. Puedes usar archivos Excel (`.xlsx` o `.xls`) o CSV. El email es necesario para reconocer a cada persona; procura que coincida con el email de la ficha.
4. Revisa el resultado y descarga el informe si lo necesitas.

Solo se actualizan las personas que se han podido emparejar por email. Las que no se encuentran se informan en el resultado, pero no se crean ni se guardan como sincronizadas mediante este proceso. Si faltan coincidencias, comprueba los emails y vuelve a intentarlo.

## Descargar información y actualizar precios

- **📥 Descargar Excel** exporta la lista según los filtros actuales y una hoja con discrepancias.
- **💰 Actualizar Precios** calcula precios para registros locales que todavía no tengan uno. Comprueba el resultado después de usarlo.
- El informe que se ofrece al terminar **Sincronizar con Excel/CSV** es distinto del Excel general descargado desde **📥 Descargar Excel**.

## Dar acceso a una persona a OwlManage

Para crear una cuenta que pueda iniciar sesión, ve a **Admin → Roles** y usa el formulario **Crear usuario**. Este proceso es distinto de añadir un miembro a WodBuster.

La creación de cuentas está reservada a personas con rol **OWNER**. Se asigna una contraseña temporal y, en el primer acceso, la persona deberá cambiarla. Si no tienes permiso para crear cuentas, solicita ayuda a quien administre OwlManage.

## Si algo no funciona

- **No encuentro a una persona:** cambia el filtro a **Todos** y busca por email.
- **Aparece inactiva:** comprueba que esté marcada como alumno y que tenga una fecha de pago válida y vigente.
- **No puedo guardar:** la pantalla puede estar disponible para consulta aunque el rol no permita modificar datos. Solicita ayuda a **OWNER** o **RECEPTION**.
- **La persona existe en una plataforma, pero no en la otra:** los cambios no siempre se replican en ambas direcciones. Comprueba en cuál se hizo el alta y usa la sincronización correspondiente.
- **El email no coincide al importar un Excel:** corrige el email del archivo o de la ficha y vuelve a ejecutar la sincronización.
- **La actualización con WodBuster da un aviso de error:** revisa si el dato se guardó localmente y confirma el resultado en WodBuster antes de repetir cambios.

## Resumen rápido

| Lo que quieres hacer | Dónde hacerlo |
| --- | --- |
| Consultar o editar miembros de WodBuster | **Usuarios → Usuarios WodBuster** |
| Añadir una ficha local de un miembro | **+ Añadir Usuario** |
| Traer o actualizar datos desde WodBuster | **🔄 Sincronizar con WodBuster** |
| Completar fichas con un archivo | **📊 Sincronizar con Excel/CSV** |
| Crear una cuenta para entrar en OwlManage | **Admin → Roles → Crear usuario** |
