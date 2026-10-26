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
- `closeModal` anima 300 ms antes de `remove()`. El **primer** `.edit-modal` del DOM es el HTML estático `#adminUsersModal`. `editTicket` (consulta) lo borra al abrir. `editLabTicket` **no** llama `closeModal` al montar: el primer Cancelar del lab cierra el de usuarios y **deja** el formulario. Abrir otro modal en esa ventana deja dos overlays; Cancelar no suelta el listener de `ticket_edits`.
- El chip **Lista** se inyecta tarde: `filterBtns` (NodeList de parse time) no lo incluye. Tras Lista, Espera/Todos dejan **dos** chips activos. Click en una fila de Lista **no** abre el modal.
- `#editFecha` **sí** se guarda (`fechaConsulta`). `#editHora` no. Mover la fecha saca el ticket de la cola de hoy.
- `#labFechaFiltro` (búsqueda de clientes) y `#labFecha` (fecha de servicio persistida) son inputs **distintos** y no se sincronizan.
- `#adminUsersBtn` es `admin-btn`, no `admin-only`: `applyRoleBasedUI` **nunca** lo muestra. El JS de alta de usuarios no está en este repo.
- Estadísticas → periodo “Personalizado” **sin** ambas fechas pinta **todo** el histórico (el `<select>` llama `updateStatsGlobal` al cambiar; “Aplicar filtros” sí valida).
- `editTicket` interpola nombre/mascota/motivo en `innerHTML` **sin escapar**. Una comilla en el nombre rompe el modal.

## Novedades de esta revisión (2026-10-26)

El source en `main` sigue en `d412bc2`. Esta pasada re-verifica los docs contra `index.js` / `laboratorio.js` / `index.html` y cubre huecos que el draft del 2026-10-19 no tenía:

- `#adminUsersModal` vive en el HTML con clase `edit-modal` y `display:none`. `closeModal()` hace `querySelector('.edit-modal')` → **ese** nodo, y a los 300 ms lo `remove()`. `editTicket` (consulta) llama `closeModal()` al abrir, así que el alta de usuarios desaparece al editar la primera consulta. `editLabTicket` **no** cierra nada al montar: el primer Cancelar/X del lab apunta al modal de usuarios y **deja** el editor lab; el segundo Cancelar sí lo cierra (y ya no hay `#adminUsersModal` hasta F5). El botón `#adminUsersBtn` (`admin-btn` + `style="display:none"`) **no** lo enciende `applyRoleBasedUI` (solo itera `.admin-only`).
- `document.querySelector('.btn-save')` (loading de `saveEditedTicket` / `saveEditedLabTicket`) apunta al “Crear usuario” de ese modal mientras siga en el DOM.
- El botón **Lista** se crea en `DOMContentLoaded` **después** de `const filterBtns = document.querySelectorAll('.filter-btn')`. Los chips estáticos solo se quitan `active` entre ellos: Lista + Espera pueden quedar ambos marcados. `querySelector('.filter-btn.active')` (child_added / `saveEditedTicket`) toma el **primero** del DOM, no Lista.
- Vista Lista: tabla HTML, `return` **antes** del `addEventListener` de click → no hay edición. Columna Estado pinta el valor crudo (`consultorio1`). `innerHTML` sin escape. No aplica el sort por `horaLlegada`.
- El payload de `saveEditedTicket` **incluye** `fechaConsulta` (`#editFecha`). Cambiar el día mueve el ticket de cola. Sigue **sin** enviar `horaConsulta`.
- Tarjeta sin `canViewFullTicket` (visitas): no es solo mascota/urgencia/estado. También pinta nombre, médico, ID paciente, motivo de llegada y horas. Oculta cédula, motivo de consulta, factura y por cobrar. El click no abre el modal.
- Alta lab: `#labFechaFiltro` filtra el autocompletar; `#labFecha` es la fecha de servicio que se persiste. `setDefaultLabDate` pone hoy en las dos, pero no las mantiene iguales.
- `backupData` nombra el JSON con `toISOString().split('T')[0]` (**UTC**). En Costa Rica el archivo puede llevar el día anterior.
