# Ejemplo de Estructura del Archivo Excel BBDD_OWL

## Formato recomendado

El archivo Excel debe tener una estructura como la siguiente en la primera hoja:

| email | nombre | apellidos | telefono |
|-------|--------|-----------|----------|
| juan.perez@example.com | Juan | Pérez García | 612345678 |
| maria.lopez@example.com | María | López Martínez | 698765432 |
| carlos.ruiz@example.com | Carlos | Ruiz Sánchez | 655123456 |

## Variaciones aceptadas de nombres de columnas

El sistema detecta automáticamente diferentes variaciones, por ejemplo:

### Para Email:
- email
- Email
- correo
- Correo electrónico
- e-mail
- E-mail
- mail

### Para Nombre:
- nombre
- Nombre
- name
- first name
- primer nombre

### Para Apellidos:
- apellidos
- Apellidos
- apellido
- surname
- last name

### Para Teléfono:
- telefono
- teléfono
- Teléfono
- phone
- Phone
- movil
- móvil
- celular

## Notas importantes

1. **Primera fila**: Debe contener los encabezados de columnas
2. **Email obligatorio**: Cada fila debe tener un email para poder mapear con WodBuster
3. **Formato de teléfono**: Puede incluir espacios o guiones, se guardará tal cual está
4. **Caracteres especiales**: Los nombres y apellidos pueden contener acentos y ñ
5. **Celdas vacías**: Si una celda está vacía, se mostrará como "-" en el informe

## Ejemplo con columnas adicionales

Puedes tener columnas adicionales que serán ignoradas en la sincronización:

| email | nombre | apellidos | telefono | fecha_alta | notas | direccion |
|-------|--------|-----------|----------|------------|-------|-----------|
| juan.perez@example.com | Juan | Pérez García | 612 345 678 | 2024-01-15 | VIP | Calle Mayor 1 |
| maria.lopez@example.com | María | López Martínez | 698-765-432 | 2024-02-20 | | Avenida Central 45 |

Solo se utilizarán las columnas: email, nombre, apellidos, y telefono.

## Validaciones

- ✅ El archivo debe ser .xlsx o .xls
- ✅ Debe tener al menos una hoja
- ✅ Debe tener al menos una fila de datos (además de los encabezados)
- ✅ La columna de email es obligatoria y debe tener valores únicos
