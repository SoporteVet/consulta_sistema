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
- `closeModal` anima 300 ms antes de `remove()`. El **primer** `.edit-modal` del DOM es el HTML estático `#adminUsersModal`. `editTicket` (consulta) lo borra al abrir. `editLabTicket`, `deleteTicketByFirebaseKey`, `endConsultationByFirebaseKey` y `deleteLabTicket` **no** llaman `closeModal` al montar: el primer Cancelar (o el `closeModal` de éxito) cierra el de usuarios y **deja** el confirm/editor. Abrir otro modal en esa ventana deja dos overlays; Cancelar no suelta el listener de `ticket_edits`.
- `showLoadingButton` hace `querySelector` global (`.btn-save`, `.btn-delete`, `.btn-submit`), **borra el `<i>` del innerHTML** y `hideLoadingButton` **no lo restaura**. El spinner de Guardar/Terminar puede caer en “Crear usuario”; el de Eliminar, en el primer `.btn-delete` de Horario (sigue en el DOM aunque la sección esté `hidden`).
- El chip **Lista** se inyecta tarde: `filterBtns` (NodeList de parse time) no lo incluye. Tras Lista, Espera/Todos dejan **dos** chips activos. Click en una fila de Lista **no** abre el modal.
- `#editFecha` **sí** se guarda (`fechaConsulta`). `#editHora` no. Mover la fecha saca el ticket de la cola de hoy.
- `#labFechaFiltro` (búsqueda de clientes) y `#labFecha` (fecha de servicio persistida) son inputs **distintos** y no se sincronizan.
- `#adminUsersBtn` es `admin-btn`, no `admin-only`: `applyRoleBasedUI` **nunca** lo muestra. El JS de alta de usuarios no está en este repo.
- Estadísticas → periodo “Personalizado” **sin** ambas fechas pinta **todo** el histórico (el `<select>` llama `updateStatsGlobal` al cambiar; “Aplicar filtros” sí valida).
- `editTicket` interpola nombre/mascota/motivo en `innerHTML` **sin escapar**. Una comilla en el nombre rompe el modal.
- Alta de usuarios guarda rol `recepcion` (sin tilde). La hora de cita se muestra solo a `admin` / `recepción` / `quirofano`: recepción **nunca** ve `#hora`.
- El alta lab ofrece estados `reportado` / `reportado_cliente` y **no** sella `fechaReportado*`. El chip `reportado_cliente` con `<br>` activo hace que el siguiente `renderLabTickets` caiga a filtro `todos`.

## Novedades de esta revisión (2026-11-02)

El source en `main` sigue en `d412bc2`. Esta pasada re-verifica los docs contra `index.js` / `laboratorio.js` / `index.html` y cubre huecos que el draft del 2026-10-26 no tenía:

- La colisión de `closeModal` / `#adminUsersModal` **no** es solo del editor lab. `deleteTicketByFirebaseKey`, `endConsultationByFirebaseKey` y `deleteLabTicket` montan otro `.edit-modal` **sin** cerrar el de usuarios. Cancelar o el `closeModal()` de éxito quitan `#adminUsersModal` y **dejan** el confirm. Hay que pulsar Cancelar otra vez.
- `confirmDeleteByFirebaseKey` usa `document.querySelector('.btn-delete')`. Si Horario ya se pintó, el primer hit es el basurero de una **fila**, no el del confirm. `showLoadingButton` le quita el `<i>` y lo `disabled`; `hideLoadingButton` **no** restaura el HTML. En sala, esa fila de Horario queda rota hasta `mostrarHorario()` o F5.
- `confirmEndConsultationByFirebaseKey` / `saveEditedTicket` / `saveEditedLabTicket` usan `querySelector('.btn-save')` → “Crear usuario” mientras `#adminUsersModal` siga en el árbol.
- `showLoadingButton` muta `innerHTML` (saca el icono). Tras el primer alta, **Agregar Consulta** y **Crear Ticket de Laboratorio** quedan sin `<i>` hasta recargar.
- `renderTickets` con filtro desconocido (`fecha`, o `data-filter` nulo) **incluye** `terminado` / `cliente_se_fue`. Eso no es `todos` (ese sí los excluye). `canViewSchedule` llama `renderTickets('fecha', today)` al iniciar (lista aún vacía).
- Por Facturar llama `ticket.numFactura.trim()`. Sala y Ediciones llaman `.toLowerCase()` sobre `idPaciente` / `numFactura`. Un valor **numérico** en Firebase tira TypeError y tumba esa vista.
- Historial admin del modal: la columna Factura pinta `ticket.numFactura` **actual**, no el valor del `ticket_edits`.
- Tarjetas de sala (`canDeleteTickets`): se interpola un `</button>` huérfano (sin apertura) antes de los action buttons.
- Alta lab: `#labEstado` incluye `reportado` / `reportado_cliente` / `cliente_no_contesta` y el submit **no** escribe `fechaReportado*`. Esos tickets nacen “reportados” sin marca de tiempo.
- `#labSearchInput` solo hace `display:none` en las tarjetas. Si todas se ocultan, **no** hay empty state (“No hay tickets…”).
- Hover en un resultado de cliente pone clase `.selected` y **no** toca `selectedIndex`. Enter sigue mirando el índice (−1 hasta flecha). `.keyboard-selected` y `.selected` son clases distintas.
- Click en el `<br>` de “Por reportar al cliente” deja `active` en el salto. `saveEditedLabTicket` / el listener `value` leen `data-filter` nulo y pintan **todos**.
- Rol `recepcion` (alta de usuarios, sin tilde) no entra en `["admin", "recepción", "quirofano"]`: no ve hora de cita en alta ni en edición.
