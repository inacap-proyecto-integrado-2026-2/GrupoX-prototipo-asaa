# Cuentas de prueba

Una cuenta por perfil para la demostración y la evaluación.

- **URL de presentación:** https://prototipo-asaa.vercel.app
- **Cómo se crean:** un administrador las crea en **Administración → Usuarios y roles**. Firebase envía un correo para definir la contraseña, por lo que cada correo debe existir (se pueden usar alias de Gmail, p. ej. `usuario+docente@gmail.com`).
- **Asistencia QR:** el estudiante no inicia sesión; escanea el QR y escribe su matrícula de la nómina importada.

> Pendiente: completar correos y contraseñas una vez creadas las cuentas en la URL de presentación.

| Perfil | Correo | Contraseña | Qué puede hacer |
|---|---|---|---|
| Docente (`docente`) | _por definir_ | _por definir_ | Crea, edita y cierra sus propias fichas; toma asistencia QR; solicita correcciones. |
| Docente Dos (`docente`) | _por definir_ | _por definir_ | Segundo docente, para comprobar que un docente no ve ni edita fichas ajenas. |
| Estudiante (`estudiante`) | _por definir_ | _por definir_ | Perfil mínimo: sin acceso a fichas, usuarios, auditoría ni nómina; solo puede cerrar sesión. Marca asistencia por el enlace QR público. |
| Pañol (`panol`) | _por definir_ | _por definir_ | Perfil mínimo, igual que estudiante (acceso deshabilitado hasta definir permisos). |
| Prevención (`prevencion`) | _por definir_ | _por definir_ | Consulta todas las fichas; no puede crear ni editar. |
| Dirección / Gerencia (`gerencia`) | _por definir_ | _por definir_ | Consulta fichas y auditoría; no puede crear ni editar. |
| Jefatura (`jefatura`) | _por definir_ | _por definir_ | Consulta fichas y decide solicitudes de corrección. |
| Coordinación (`coordinacion`) | _por definir_ | _por definir_ | Igual que jefatura. |
| Administrador (`admin`) | _por definir_ | _por definir_ | Administra cuentas, roles e importación de asignaturas y nóminas. |
