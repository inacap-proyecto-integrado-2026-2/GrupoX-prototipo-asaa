# Prototipo ASAA

Demo web estática y autocontenida para recorrer el flujo principal del registro ASAA. Abre `index.html` directamente en un navegador para usarla localmente.

## Publicar en Vercel

1. Sube la carpeta `ES2/prototipo-asaa` al repositorio de GitHub.
2. En Vercel, importa el repositorio y define `ES2/prototipo-asaa` como **Root Directory**.
3. Deja los comandos de build y output vacíos; Vercel servirá `index.html` como sitio estático.
4. Abre la URL asignada desde otro dispositivo para comprobar que carga y recorre el flujo.

No requiere dependencias, instalación ni variables de entorno. También se puede publicar con GitHub Pages apuntando a esa carpeta o copiando su contenido a la raíz de un repositorio dedicado.

## Alcance de esta demo

- Login docente de demostración. Credenciales visibles en la pantalla de acceso: `docente@inacap.cl` / `demo123`.
- Actividad práctica con ficha ASAA y actividad teórica sin ASAA ni charla.
- Datos representativos para riesgos, controles, EPP y etapas. La implementación productiva debe incorporar y validar todos los campos de la plantilla ASAA oficial.
- Sugerencias de riesgos/controles por palabras clave de especialidad y actividad; el docente las revisa y decide si agregarlas.
- Charla, confirmación de ejemplo, asistencia manual, atraso, cierre y simulación de corrección post-cierre.
- Impresión de la ficha completada y de una ficha ASAA en blanco para actividades en terreno sin tableta; luego se puede marcar como transcripción desde papel. Ambas usan el diálogo de impresión del navegador.
- Guardado local mediante `localStorage`, impresión del registro y simulación visual del estado offline.

El login y las sugerencias son demostrativos. No incluye backend, validación de identidad, generación real de QR por sesión, sincronización entre dispositivos, roles aplicados por servidor ni persistencia institucional. Los datos se guardan solo en el navegador donde se ingresan. Usa información ficticia en esta demostración.
