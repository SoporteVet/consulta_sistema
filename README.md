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
- `#labEstado` está **duplicado**: el alta lab (pendiente/procesando/reportado…) y el modal legacy `openLabSheetModal` (en proceso / pendiente reportar / reportados). `getElementById('labEstado')` siempre lee el del alta.
- Tras flecha en la búsqueda lab, un re-render **no** resetea `selectedIndex`: Enter puede elegir otra fila (o ninguna) aunque el primero se vea `.keyboard-selected`.
- El checkbox “servicio realizado” solo hace `stopPropagation` en el `<input>`. Click en el **nombre** abre el editor y, si el rol es `admin`, el check se ve cambiado pero **no** se persiste.
- Las razas lab son listas hardcodeadas. Una raza fuera de esa lista no queda `selected` en edición y el save falla (“Raza es requerido”).
- Sin chip `.filter-btn.active`, la búsqueda de sala cae a `espera`; los listeners `child_*` caen a `todos`.
- En **Crear Consulta**, flechas del teclado **no** mueven el cursor: cambian de campo (grilla 2 columnas). En un textarea (motivo) flecha abajo salta a otro input. El form de lab **no** tiene este hijack.
- Abrir **Horario** (onclick + listener) **siempre** pone `#fechaHorario` = hoy. Salir y volver pierde el día que se estaba viendo; Exportar día usa esa fecha reseteada.
- Tras elegir un cliente lab, el dropdown se oculta (`display:none`) **sin** vaciar el DOM ni resetear `selectedIndex`. Enter (foco aún en `#labClienteSearch`) puede rellenar el form con **otra** fila de la lista vieja. Un `value` de `tickets` vuelve a **mostrar** el dropdown porque el input quedó en `Nombre - mascota` (≥2 chars).
- `#labSearchInput` filtra por `textContent` de la tarjeta (estado, “Cliente:”, “Realizado”, prioridad), no por campos. `formatMedicoWithLineBreak` mete `<br>` antes del apellido: buscar “Gustavo Gonzalez” (con espacio) **no** coincide.
- Las tarjetas de stats lab **no** particionan: `internos` es departamento; un ticket interno pendiente suma en Pendientes **y** en Internos.
- Ediciones “semana” = domingo **local** → **hoy**. Estadísticas “semana” = domingo–sábado con `new Date('YYYY-MM-DD')` (UTC). No son el mismo recorte.

## Novedades de esta revisión (2026-11-16)

El source en `main` sigue en `d412bc2`. Esta pasada re-verifica los docs contra `index.js` / `laboratorio.js` / `index.html` y cubre huecos que el draft del 2026-11-09 no tenía. Los fallos de `closeModal` / `#adminUsersModal`, `#labEstado`, `selectedIndex` en re-query y `numFactura` numérico siguen vigentes ([runbook](docs/runbook.md)).

- Tras `selectCliente`, el dropdown queda `display:none` con los ítems **aún en el DOM** y `selectedIndex` intacto. Enter (foco en `#labClienteSearch`) llama `selectCliente(items[selectedIndex])` de esa lista oculta y pisa el form. Un `value` de `tickets` ve `Nombre - mascota` (≥2 chars) y **vuelve a mostrar** resultados (`clientesDataUpdated` inmediato + `updateActiveClienteSearch` a 300 ms).
- Flechas en `#ticketForm` (inline + `index.js` ~L4079): grilla `cols = 2`, `preventDefault` también en textareas. Motivo/llegada no bajan de línea; el caret de `#nombre` no se mueve. Lab no registra este handler.
- `navigateToSection('horarioSection')` y el listener de `#horarioBtn` escriben `#fechaHorario = hoy` **siempre**. Reentrar a Horario pierde el día; `exportarDia` lee esa fecha ya reseteada.
- `formatMedicoWithLineBreak` inserta `<br>` antes del apellido. `#labSearchInput` hace `textContent.toLowerCase().includes(searchTerm)`: “gustavo gonzalez” (espacio) no matchea; “gonzalez” sí. El placeholder habla de “tipo de examen”; también matchean “pendiente”, “cliente”, “realizado”, “urgente”.
- `updateLabStats`: `internos` cuenta `departamento === 'internos'` **además** del cubo de estado. Sumar las 8 tarjetas ≠ `#totalLabTickets`.
- Ediciones `case 'semana'`: `getLocalDateString(domingo)` → `getLocalDateString(hoy)` contra `ticket_edits.fecha` (UTC). Stats `semana`: `new Date(fechaConsulta)` UTC, domingo–sábado. Un edit del domingo CR de noche puede caer en el lunes UTC y **no** salir en Ediciones “hoy”/“semana” del domingo.
- `resetLabForm` / `form.reset()` **no** ponen `currentSearchTerm` ni `currentFilterCategory` a `''`. En la siguiente visita a Crear Lab, `loadAllServices()` pinta todo el catálogo, pero un `change` de `#categoryFilter` re-aplica el término viejo (input ya vacío). `setupServiceEventListeners` se vuelve a registrar: cada visita duplica el debounce de búsqueda.
