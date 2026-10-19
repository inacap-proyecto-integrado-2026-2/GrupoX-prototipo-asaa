# ASAA

Aplicación React para gestionar fichas de actividades académicas seguras. La aceptación del flujo por parte del cliente se reportó verbalmente en reunión; este proyecto no inventa una firma escrita ni una fecha de aprobación.

## Estructura

```text
src/
  auth/              Firebase Authentication y perfil de sesión
  components/        navegación, campos ASAA y estados compartidos
  lib/               inicialización del SDK web
  pages/             una pantalla por ruta
  services/          cliente autenticado de la API
api/
server/              Firebase Admin, validación, permisos y auditoría
  auth/               perfil de sesión y aprovisionamiento inicial
  records/            fichas, cierres, correcciones y exportación
  users/              administración de cuentas y roles
  audit/              consulta de auditoría
```

El navegador se autentica con Firebase Authentication. Los datos pasan por funciones API de Vercel y Firebase Admin; las reglas de Firestore deniegan el acceso directo desde clientes. La cuenta inicial se aprovisiona una sola vez mediante `INITIAL_ADMIN_EMAIL`; los siguientes usuarios se crean desde Administración. Los secretos de Firebase Admin se guardan solo en variables de servidor de Vercel.

## Preparar Firebase

1. Crea o selecciona un proyecto Firebase y registra una app web.
2. Activa el proveedor **Correo electrónico/contraseña** en Authentication.
3. Crea Firestore en modo producción y publica `firestore.rules` (`firebase deploy --only firestore:rules`).
4. Crea en Authentication una cuenta para el correo que será administrador inicial.
5. En Vercel, agrega las variables de `.env.example`. Copia la configuración pública de la app web a las variables `VITE_FIREBASE_*`; configura `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` únicamente como variables server-side. Define `INITIAL_ADMIN_EMAIL` con el correo anterior.
6. Inicia sesión con esa cuenta una vez. La primera llamada autenticada crea su perfil administrador y cierra el aprovisionamiento inicial.

No subas `.env`, claves de servicio ni credenciales a GitHub. Las variables `VITE_*` son configuración pública de cliente; nunca pongas una clave privada bajo ese prefijo.

## Desarrollo y publicación

```sh
npm install
npm run dev       # Vercel CLI local para ejecutar funciones API y el frontend
npm run build     # compilación de producción
npm run preview   # vista previa del frontend compilado
```

Conecta el repositorio a Vercel con la raíz del proyecto `ES2/prototipo-asaa`, comando de build `npm run build` y salida `dist`. Añade las variables a los entornos Preview y Production. Las funciones API se publican desde `api/`.

## Permisos y datos

- Roles incluidos: docente, estudiante, pañol, Prevención, Gerencia, jefatura, coordinación y administrador.
- Docente: crea y edita fichas abiertas propias, las cierra, consulta sus registros y solicita correcciones post-cierre.
- Jefatura/coordinación/administración: consultan fichas y deciden solicitudes de corrección. La ficha vuelve al docente para editarse y se vuelve a cerrar sobre el mismo documento.
- Prevención: consulta fichas. Gerencia puede consultar auditoría y fichas según la regla amplia recogida en el informe.
- El acceso de estudiante (QR/autoservicio) y pañol permanece deshabilitado hasta concretar la nómina institucional y los permisos pendientes. Las reglas del informe para roles distintos de docente/Prevención son amplias; la app aplica restricción mínima mientras no exista una matriz aprobada por rol.
- Las fichas no tienen operación de borrado. Las consultas, exportaciones, cierres, cambios de datos, correcciones y administración de cuentas generan eventos de auditoría.

## Alcance que falta para operación productiva

El flujo de creación, edición, cierre, consulta, administración básica de cuentas y correcciones usa Firebase/Vercel cuando se configuran las cuentas. Antes de usarlo con datos reales faltan: despliegue y validación en el proyecto del cliente; importación de nóminas y asignaturas; confirmación QR ligada a matrícula y sesión de corta duración; almacenamiento offline cifrado y sincronización con resolución de conflictos; revisión campo a campo de la plantilla oficial, incluidos los datos por etapa; y aprobación institucional de retención, permisos y respaldos. El botón de PDF usa la impresión del navegador; no es aún un archivo PDF generado y archivado por servidor.
