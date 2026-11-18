# Plan de pruebas — resultados de ejecución

Casos definidos en el informe (sección 16, CP-01 a CP-15), ejecutados contra el sistema desplegado.

- **Ambiente:** https://asaa-pruebas.vercel.app (Vercel + Firebase de pruebas), rama `anibal`.
- **Fecha de ejecución:** 18-11-2026.
- **Responsable:** Anibal San Martín.
- **Método:** llamadas directas a la API publicada con las cuentas de `docs/cuentas-prueba.md` (script automatizado), más revisión del PDF exportado. CP-10 requiere ejecución manual.
- **Estados:** Aprobado · Parcial (funciona, pero falta parte del resultado esperado) · Fallido · Pendiente.

## Resumen

| Estado | Casos |
|---|---|
| Aprobado | CP-01 a CP-09, CP-11 a CP-15 (14) |
| Pendiente (manual) | CP-10 (1) |

## Resultados

| ID | Tipo | Caso | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| CP-01 | Funcional | Iniciar sesión con cuenta docente activa | Sesión iniciada y acceso a funciones del rol docente | Login correcto; `/api/auth/me` 200 con rol `docente` | Aprobado |
| CP-02 | Funcional | Crear actividad práctica con nómina cargada | Ficha práctica creada con campos requeridos y código generado al inicio | Ficha creada (201) con código `ASAA-SANTIAGO-TALLER1-DOCENTEP-20261118-…`; asignatura y sección elegidas desde la nómina; asistencia precargada con los 5 estudiantes | Aprobado |
| CP-03 | Funcional | Crear actividad teórica | Se registra sin crear ASAA ni charla | Teórica creada (201) y cerrada sin charla (200) | Aprobado |
| CP-04 | Funcional | Registrar charla y declarar realización | Charla asociada a la ficha correcta y persistida | Tema guardado (200); botón "Se realizó la charla" (200); al volver a leer la ficha, `talkDone = true` | Aprobado |
| CP-05 | Funcional | Proyectar QR y confirmar desde un dispositivo de la nómina | Confirmación asociada a la sesión y hora registrada | Sesión QR creada (201); confirmación (200); al finalizar el estudiante queda Presente, método QR, con hora; los 4 que no marcaron quedan Ausente | Aprobado |
| CP-06 | Funcional | Docente registra asistencia manual e indica motivo | Participación marcada por el docente y acción auditada | Marca manual guardada (Presente, "Registro docente") con motivo "Sin teléfono"; el cambio queda auditado (`record.update`, con antes/después que incluye el motivo) | Aprobado |
| CP-07 | Funcional | Registrar atraso y charla individual | Atraso y entrega individual de charla registrados sin alterar a los demás | Estudiante en Atraso con "Charla individual entregada" y su hora; el resto de la nómina no cambia. En el detalle de la ficha se ve "Charla individual entregada · hh:mm" o "pendiente". Además, quien marca por QR después de la hora de la charla + 15 min queda en Atraso automáticamente (verificado: charla hace 60 min → Atraso; dentro de la tolerancia o charla futura → Presente) | Aprobado |
| CP-08 | Funcional | Docente cierra ficha completa | Estado cerrado, edición bloqueada, cierre auditado | Cierre (200); edición posterior rechazada (409); auditado `record.close` | Aprobado |
| CP-09 | Funcional | Crear otra ficha con mismo taller/docente/fecha | Clave técnica no colisiona; código legible único | Dos fichas con los mismos datos obtienen códigos distintos (terminan en el ID único de Firestore). No hay correlativo legible corto, pendiente de definir según el informe. | Aprobado |
| CP-10 | Integración/offline | Desconectar red, completar ficha, reconectar | Datos locales que sincronizan sin duplicarse | Pendiente de ejecución manual en navegador o celular (desconectar la red, crear ficha, reconectar y verificar que aparece una sola vez) | Pendiente |
| CP-11 | Integración/PDF | Exportar ficha autorizada | PDF con todos los campos ASAA y descarga auditada | PDF generado por el servidor (200, `%PDF`); contiene datos generales, riesgos, EPP, etapas, LOTO, FAR, charla, nómina con estado/método/hora y cierre; auditado `record.export`. | Aprobado |
| CP-12 | Seguridad | Repetir confirmación QR desde el mismo dispositivo | Segundo intento rechazado o derivado; evento auditado | Mismo dispositivo y misma matrícula: no duplica (`already: true`) y se audita `attendance.qr.duplicate`. Mismo dispositivo con otra matrícula: rechazado (409) con el mensaje de pedir registro manual al docente, auditado `attendance.qr.device_reused`. Sin identificador de dispositivo: 400. Matrícula fuera de nómina: 404 | Aprobado |
| CP-13 | Seguridad | Usuario sin permiso consulta historial ajeno por API | API deniega acceso sin filtrar datos | Docente abriendo ficha de otro docente: 403; su historial solo trae fichas propias; estudiante listando historial: 403 | Aprobado |
| CP-14 | Seguridad | Modificar ficha cerrada por API directa | API deniega y conserva datos e historial | PATCH directo: 409; datos y asistencia intactos | Aprobado |
| CP-15 | Seguridad | Docente aprueba su propia corrección; luego jefatura aprueba | Primera denegada; segunda permitida y auditada con antes/después, actor y motivo | Solicitud (201); docente aprueba la suya: 403; jefatura aprueba: 200; corrección aplicada y la ficha vuelve a cerrada; auditoría con antes/después, actor y nota | Aprobado |

## Casos de seguridad de la rúbrica (CP-S1 a CP-S4)

Ejecutados contra la misma URL. Ningún caso devolvió error 500.

| ID | Qué se probó | Resultado |
|---|---|---|
| CP-S1 Autenticación | Endpoints sin sesión, token falsificado, header mal formado, cuenta desactivada (login y token previo), acceso directo a Firestore desde el cliente | 15/15 rechazados (401/403) |
| CP-S2 Control de roles | Estudiante y pañol en fichas, usuarios, auditoría y nómina; docente viendo usuarios, auditoría, subiéndose a admin, creando usuarios, importando y tocando fichas ajenas; prevención, gerencia y jefatura editando fichas | 29/29 según la matriz de roles |
| CP-S3 Inmutabilidad de cerrados | Editar campos o asistencia, confirmar charla, cerrar de nuevo, iniciar QR, edición por admin; datos intactos; solicitud de corrección permitida | 9/9 |
| CP-S4 Datos malformados | Texto de 20.000 caracteres, comillas/HTML/emoji, JSON inválido, cuerpo vacío/texto/arreglo/null, tipos incorrectos, fecha inválida, objetos anidados, IDs con barra, largos o con comillas, motivo/charla individual con tipos o largos inválidos, importaciones basura, correos y roles inválidos, QR con datos basura | Todo responde 4xx, sin errores 500 (tras corregir la validación de IDs en `server/auth.js`) |
