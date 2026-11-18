// Roles que pueden crear fichas. Debe coincidir con la validación de la API (api/records/index.js, POST).
export const RECORD_CREATOR_ROLES = ['admin', 'docente', 'jefatura', 'coordinacion'];
export const canCreateRecords = role => RECORD_CREATOR_ROLES.includes(role);

// Nombre visible de cada rol (mismo orden que en Administración → Usuarios y roles).
export const ROLE_LABELS = { docente: 'Docente', estudiante: 'Estudiante', panol: 'Pañol', prevencion: 'Prevención', gerencia: 'Dirección / Gerencia', jefatura: 'Jefatura', coordinacion: 'Coordinación', admin: 'Administrador' };
export const roleLabel = role => ROLE_LABELS[role] || role || '';
