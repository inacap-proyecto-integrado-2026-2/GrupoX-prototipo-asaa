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

## Firebase y Vercel

El proyecto Firebase `asaa-inacap` y su app web ya están creados. Authentication tiene habilitado el acceso por correo y contraseña. La base Firestore predeterminada está en `southamerica-west1` (Santiago), con protección contra borrado; sus reglas deniegan el acceso directo del navegador. Los índices compuestos están declarados en `firestore.indexes.json`. La ubicación es una decisión permanente de Firestore.

Vercel está enlazado al repositorio `inacap-proyecto-integrado-2026-2/GrupoX-prototipo-asaa`. Las variables públicas del SDK web están en Production, Preview y Development. La API usa una cuenta de servicio dedicada con permisos de Firebase Auth y Firestore; su clave se almacena como secreto de Vercel. No se guarda una clave de servicio en el repositorio.

Para desplegar cambios de Firebase usa `firebase deploy --only auth,firestore:rules,firestore:indexes`. Para habilitar el primer acceso, crea en Firebase Authentication un usuario cuyo correo coincida con `INITIAL_ADMIN_EMAIL` en Vercel. En el primer inicio de sesión, la API aprovisiona el perfil administrador y cierra el bootstrap inicial. Las cuentas siguientes se crean desde Administración.

No subas `.env`, claves de servicio ni credenciales a GitHub. Las variables `VITE_*` son configuración pública de cliente; nunca pongas una clave privada bajo ese prefijo.

## Desarrollo y publicación

```sh
npm install
npm run dev       # Vercel CLI local para ejecutar funciones API y el frontend
npm run build     # compilación de producción
npm run preview   # vista previa del frontend compilado
```

La raíz de Vercel es este directorio, el comando de build es `npm run build` y la salida `dist`. Las funciones API se publican desde `api/`. Cada push a `main` inicia un despliegue de Production.

El override de `jwks-rsa` en `package.json` mantiene Firebase Admin compatible con el cargador CommonJS de Vercel. La versión 4 carga `jose` como ESM mediante `require()` y provoca `ERR_REQUIRE_ESM` en la función de autenticación; al actualizar dependencias, verifica también el arranque de las funciones en Vercel.

## Permisos y datos

- Roles incluidos: docente, estudiante, pañol, Prevención, Gerencia, jefatura, coordinación y administrador.
- Docente: crea y edita fichas abiertas propias, las cierra, consulta sus registros y solicita correcciones post-cierre.
- Jefatura/coordinación/administración: consultan fichas y deciden solicitudes de corrección. La ficha vuelve al docente para editarse y se vuelve a cerrar sobre el mismo documento.
- Prevención: consulta fichas. Gerencia puede consultar auditoría y fichas según la regla amplia recogida en el informe.
- El acceso de estudiante (QR/autoservicio) y pañol permanece deshabilitado hasta concretar la nómina institucional y los permisos pendientes. Las reglas del informe para roles distintos de docente/Prevención son amplias; la app aplica restricción mínima mientras no exista una matriz aprobada por rol.
- La importación de asignaturas y nóminas está disponible solo para administradores desde “Importar datos”. Recibe CSV UTF-8: asignaturas (`codigo_asignatura,nombre,sede,carrera`) y matrículas (`matricula,nombre_estudiante,codigo_asignatura,seccion,periodo`); el endpoint limita a 1.000 filas y upsertea en `subjects` y `enrollments`. La nómina se guarda por matrícula/asignatura/sección/período para poder validar futuras confirmaciones QR.
- Asistencia QR: la ficha práctica guarda `subjectCode`, `sectionCode` y `period`, que deben coincidir con la nómina importada. En el formulario se eligen desde listas: `GET api/imports` entrega a docentes, jefatura, coordinación y administración las asignaturas importadas y las combinaciones sección/período presentes en la nómina, con la cantidad de inscritos (sin matrículas ni nombres). Si aún no hay datos importados, el formulario vuelve a campos de texto. Al elegir la sección, el paso “Charla y asistencia” se precarga con los estudiantes de esa nómina como *Pendiente* (`GET api/imports?subject=&section=&period=`, auditado como `roster.read`); si se cambia de sección, se quitan los pendientes de la nómina anterior y se conserva lo marcado o agregado a mano. Desde el detalle de una ficha abierta, el docente responsable inicia una sesión QR (`/registros/:id/qr`): se precarga la nómina como *Pendiente*, el código cambia cada 30 s (se aceptan hasta ~90 s para escribir la matrícula) y la sesión dura 20 min. El estudiante abre `/qr/:sesión` sin iniciar sesión y escribe su matrícula; el endpoint público `api/qr/checkin` valida el código, la sesión y la nómina, y bloquea la sesión tras 60 matrículas fallidas. Las marcas se guardan en `attendanceSessions/{id}/checkins` y pasan a la ficha como *Presente* (método QR) al finalizar la sesión, al consultarla vencida o al cerrar la ficha; no sobrescriben un estado que el docente ya marcó. Al terminar la sesión, quienes siguen *Pendiente* en la nómina quedan *Ausente* (método QR); si marcan en una sesión QR posterior pasan a *Presente*. Atrasos y otros ajustes los decide el docente. Mientras la sesión está activa, la ficha no se puede editar, salvo confirmar la charla: desde el detalle de una ficha práctica abierta, el botón “Se realizó la charla” marca `talkDone` sin pasar por el formulario. Limitación conocida: un estudiante presente que conozca la matrícula de otro podría marcarlo.
- Generación y archivo oficial de PDF: La exportación de fichas (`api/records/[recordId]/export.js`) genera documentos PDF server-side con PDFKit, incorporando código ASAA, trazabilidad, análisis de seguridad, etapas, charla y nómina de asistencia. El archivo se audita inmutablemente en Firestore y actualiza la metadata de exportación (`lastExportedAt`, `exportCount`).
- Modo taller sin conexión (Offline) y sincronización: Permite crear y editar fichas y listas de asistencia sin acceso a internet. Los datos locales se cifran en reposo con AES-GCM (256 bits) mediante la Web Crypto API. Al restablecer la conectividad, un motor de sincronización (`syncEngine.js`) procesa la cola de operaciones aplicando resolución automática de concurrencia (merge tridireccional por campo y protección contra sobrescritura de fichas cerradas).
- Las fichas no tienen operación de borrado. Las consultas, exportaciones, cierres, cambios de datos, correcciones y administración de cuentas generan eventos de auditoría.

## Alcance que falta para operación productiva

El flujo de creación, edición, cierre, consulta, administración básica de cuentas, exportación oficial PDF, modo offline cifrado, asistencia QR e importación de datos usa Firebase/Vercel. Antes de usarlo con datos reales en producción institucional faltan: despliegue y validación en el proyecto del cliente; validación en terreno de la asistencia QR con la red institucional; revisión campo a campo de la plantilla oficial con el comité de seguridad; y aprobación institucional de retención, permisos y respaldos.
