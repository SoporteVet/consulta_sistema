# Sistema de Consultas — Veterinaria San Martín de Porres

Aplicación web de sala de espera, consultas clínicas y tickets de laboratorio. Corre en el navegador contra **Firebase Authentication** y **Firebase Realtime Database**. No hay servidor propio en este repositorio.

## Estado de este repositorio

Este repo **no es un checkout completo**. `index.html` y `index.js` cargan módulos, estilos y assets que **no están versionados aquí**. Sin esos archivos la app no arranca o arranca a medias.

Archivos presentes:

| Archivo | Rol |
|---|---|
| `index.html` | Shell de la SPA: navegación, formularios y secciones |
| `index.css` | Estilos de consultas, horario, estadísticas y layout |
| `index.js` | Consultas, filtros, horario, estadísticas, auditoría y hojas lab legacy |
| `laboratorio.js` | Tickets de laboratorio, búsqueda de clientes y servicios |
| `laboratorio.css` | Estilos del módulo de laboratorio |

Archivos referenciados y **ausentes** (bloqueo o degradación):

| Referencia | Usado para |
|---|---|
| `home.html` | Login; `index.js` redirige aquí si no hay sesión |
| `firebase-config.js` | Inicialización de Firebase y, en la práctica, `window.database` / refs globales |
| `auth.js` | `checkAuth`, `hasPermission`, `PERMISSIONS`, `signOut` |
| `services-data.js` | Catálogo `SERVICIOS_LABORATORIO` |
| `consentimientos-module.js` + `consentimientos.css` | Formularios de consentimiento |
| `admin-users.js` | Modal “Administrar usuarios” |
| `lab.js` | Inyectado al final de `index.js` (`document.body.appendChild`); hojas lab legacy |
| `empresa.jpg` | Logo / favicon |
| `fix-wait-time.js`, `fix-lab-search.js`, `debug-*.js`, `test-lab-functionality.js` | Parches. `laboratorio.js` llama `setupExamenRegaliaAndFirma` y `forceReloadClientesData`, que **no están definidos** en los archivos de este repo |

Detalles y contrato esperado de esos módulos: [docs/architecture.md](docs/architecture.md).

## Cómo servir en local (cuando el checkout esté completo)

Es una app estática. Hace falta un HTTP server (Firebase Auth y RTDB no funcionan bien con `file://`).

```bash
# Python 3
python3 -m http.server 8080

# o Node
npx --yes serve -l 8080
```

Abrir `http://localhost:8080/home.html` (login) y, tras autenticarse, `index.html`.

Requisitos de runtime (CDNs, no npm):

- Firebase JS SDK **9.22.0** compat: `firebase-app`, `firebase-auth`, `firebase-database`
- Chart.js (estadísticas)
- Font Awesome 6.0.0

## Documentación

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Módulos, Firebase, modelos de datos, roles |
| [docs/workflows.md](docs/workflows.md) | Flujos de consultas y laboratorio |
| [docs/runbook.md](docs/runbook.md) | Operación, backup, limpieza y fallos frecuentes |

## Convención rápida

- Identidad de sesión: `sessionStorage` (`userRole`, `userName`, `userEmail`).
- Identidad de registro: `randomId` (16 caracteres, `crypto.getRandomValues`); el `id` numérico de consulta es **visual y se reinicia por día**.
- Fechas de negocio: `YYYY-MM-DD` en zona local (`getLocalDateString`), no UTC de `toISOString()`.
- Tras login, la pantalla por defecto es **Crear Consulta**, no la sala de espera.
