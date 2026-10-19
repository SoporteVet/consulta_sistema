# Sistema de Consultas — Veterinaria San Martín de Porres

Aplicación web de sala de espera, consultas clínicas y tickets de laboratorio. Corre en el navegador contra **Firebase Authentication** y **Firebase Realtime Database**. No hay servidor propio en este repositorio.

## Estado de este repositorio

Este repo **no es un checkout completo**. `index.html` y `index.js` cargan módulos, estilos y assets que **no están versionados aquí**. Sin esos archivos la app no arranca o arranca a medias.

Un `<script src>` que 404 **no bloquea** los scripts siguientes (tags clásicos, sin `async`/`defer`). El fallo aparece después, cuando un global esperado (`checkAuth`, `ticketsRef`, `SERVICIOS_LABORATORIO`, `PERMISSIONS`) no existe.

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
| `home.html` | Login; `index.js` redirige aquí si no hay sesión (comentario menciona `login.html`, no se usa) |
| `firebase-config.js` | Inicialización de Firebase y, en la práctica, `window.database` / `ticketsRef` / `settingsRef` |
| `auth.js` | `checkAuth`, `hasPermission`, `PERMISSIONS`, `signOut` |
| `services-data.js` | Catálogo `SERVICIOS_LABORATORIO` |
| `consentimientos-module.js` + `consentimientos.css` | Formularios de consentimiento |
| `debug-consentimientos.js` | Debug del módulo de consentimientos |
| `admin-users.js` | Modal “Administrar usuarios” |
| `lab.js` | Inyectado al final de `index.js` (`document.body.appendChild`); hojas lab legacy |
| `empresa.jpg` | Logo / favicon |
| `fix-wait-time.js`, `fix-lab-search.js`, `debug-lab-search.js`, `test-lab-functionality.js` | Parches. `laboratorio.js` llama `setupExamenRegaliaAndFirma` / `setupEditExamenRegaliaAndFirma` y `forceReloadClientesData`, que **no están definidos** aquí. Sí existe `forceUpdateClientesData()`. El vacío de resultados también llama `diagnoseLaboratorySearch()` |

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
- Chart.js **sin pin de versión** (`cdn.jsdelivr.net/npm/chart.js`) — un major nuevo puede romper estadísticas
- Font Awesome 6.0.0

## Documentación

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Módulos, Firebase, modelos de datos, roles |
| [docs/workflows.md](docs/workflows.md) | Flujos de consultas y laboratorio |
| [docs/runbook.md](docs/runbook.md) | Operación, backup, limpieza y fallos frecuentes |

## Convención rápida

- Identidad de sesión: `sessionStorage` (`userRole`, `userName`, `userEmail`). La autorización que se ve en este repo es **solo cliente**; no hay reglas de RTDB versionadas aquí.
- Identidad de registro: `randomId` (16 caracteres, `crypto.getRandomValues`); el `id` numérico de consulta es **visual y se reinicia por día**.
- Fechas de negocio: `YYYY-MM-DD` en zona local (`getLocalDateString`), no UTC de `toISOString()`.
- Sala de espera filtra solo por `fechaConsulta`. Tickets viejos con únicamente `fecha` (ISO) **no aparecen** en Ver Consultas; Horario sí tiene fallback.
- Búsqueda de consultas: cliente, mascota, ID paciente, factura. **No** busca cédula.
- Tras login, la pantalla por defecto es **Crear Consulta**, no la sala de espera.
- Cambiar estado de una consulta: click en la tarjeta → modal de edición (`#editEstado`). `changeStatus` existe en `index.js` pero **no tiene callers**.
- Cambiar estado lab: click en la tarjeta → `editLabTicket`. `changeLabStatus` (el único sitio que sella `fechaReportado*`) **no tiene callers**.
- El sidebar Administrativo es `admin-only`. `canViewSchedule` / `canViewStats` no abren Horario ni Estadísticas si el rol no es `admin`.
- En el modal de edición, `#editHora` (hora de cita) se pinta pero **no se envía**. `saveEditedTicket` hace `update` (merge): el valor viejo de `horaConsulta` se queda.
- `selectedServices` es un **único array global** compartido por crear y editar lab. Abrir un ticket existente pisa la selección del alta.
- `setupLabFacturaSyncForCreate()` existe y **nunca se llama**. El alta de lab no sincroniza factura hacia consultas.
- `canEditTickets` **no** abre ni cierra el modal: cualquier rol ≠ `visitas` edita la consulta. La flag solo habilita el textarea “Por cobrar”.
- El filtro “Por Facturar” no exige estado terminado: incluye espera/consultorio sin `numFactura`.
- Alta de consulta permite estado inicial `terminado` (sin `horaFinalizacion`).
- `Tec. Jimena Urtecho`: el alta guarda un espacio; el `<option>` de edición compara con **dos** espacios y no preselecciona.
- `formatDate` y `getEstadoLabel` están declaradas en **los dos** JS. Tras el load order, gana `index.js`. Las fechas lab `YYYY-MM-DD` **no** sesgan un día; un `fecha` ISO en el historial de búsqueda sale **garbled**.
- `closeModal` anima 300 ms antes de `remove()`. Abrir otro modal en esa ventana deja dos overlays; Cancelar no suelta el listener de `ticket_edits`.
- Estadísticas → periodo “Personalizado” **sin** ambas fechas pinta **todo** el histórico (el `<select>` llama `updateStatsGlobal` al cambiar; “Aplicar filtros” sí valida).
- `editTicket` interpola nombre/mascota/motivo en `innerHTML` **sin escapar**. Una comilla en el nombre rompe el modal.

## Novedades de esta revisión (2026-10-19)

El source en `main` sigue en `d412bc2`. Esta pasada re-verifica los docs contra `index.js` / `laboratorio.js` / `index.html` y cubre huecos que el draft del 2026-10-12 no tenía:

- Colisión de nombres: `laboratorio.js` define `formatDate` (UTC) y `getEstadoLabel` (“En Espera”); `index.js` las vuelve a declarar (split local / “En sala de espera”) **después**. En la SPA combinada gana `index.js`. `lab.js` (404 aquí) se inyecta al final de `index.js` y, si existiera y redefiniera esas funciones, ganaría él.
- Etiquetas lab `YYYY-MM-DD` (`ticket.fecha`, `#labFechaFiltro`): **no** hay sesgo UTC en esta página. El draft del 12-oct describía el `formatDate` de `laboratorio.js`, que queda muerto tras cargar `index.js`.
- `consultas[].fecha` ISO (`ticket.fecha` cuando falta `fechaConsulta`) pasa por el splitter de `index.js` y se pinta como `05T15:00:00.000Z/10/2026`.
- `closeModal` no hace `remove()` inmediato: añade `modal-closing` y espera 300 ms. `editTicket` cierra y abre en el mismo tick: hay dos `.edit-modal` durante la animación. `querySelector` siempre toma el más viejo; Cancelar en el nuevo puede “cerrar” el que ya salía y dejar el editor colgado.
- El listener admin de `ticket_edits` (`window._ticketEdicionesListener`) solo se `off()` en la X (`.close-modal`). Cancelar llama `closeModal()` y **no** desuscribe: el `on('value')` del árbol entero sigue vivo.
- Periodo “personalizado”: `filtrarTicketsPorPeriodoGlobal` sin `#fechaInicioEstadisticasGlobal` / `#fechaFinEstadisticasGlobal` hace `return tickets`. El `change` del `<select>` ya disparó `updateStatsGlobal()`; el botón “Aplicar filtros” llega tarde.
- Campos de cliente/paciente en el modal de consulta, filas de Horario y tarjetas lab van a `innerHTML` sin escape. `"` rompe `value="…"`; markup en motivo se interpreta.
- Búsqueda lab: el primer resultado recibe `.first-result` + `.keyboard-selected`, pero `selectedIndex` sigue en `-1`. Enter no elige hasta pulsar flecha abajo. El input debouncea 200 ms; cambiar `#labFechaFiltro` relanza enseguida.
- El textarea “Por cobrar” nace **vacío** (el historial es un `<div>` aparte). El guardia de Backspace (`originalLength`) es no-op.
- `saveEditedTicket`, si la sección activa no es Ver Consultas ni Horario, llama `renderTickets()` sin filtro → default `todos`.
- `applyRoleBasedUI` pone `body.{role}-role` (CSS de visitas / admin / botón Terminar) y reengancha `#logoutBtn` cada vez que corre.
