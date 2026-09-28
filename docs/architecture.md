# Arquitectura

SPA de una sola página (`index.html`). El JS es global (sin bundler, sin módulos ES). Firebase Realtime Database es la fuente de verdad; la UI se actualiza con listeners `child_added` / `child_changed` / `child_removed`.

La autorización observada en este checkout es **solo cliente** (`sessionStorage.userRole` + `hasPermission`). No hay reglas de RTDB ni mapa `PERMISSIONS` en el repo; no inventarlos.

## Arranque

Orden de scripts en `index.html`:

1. Firebase compat 9.22.0 (`app`, `auth`, `database`) + Chart.js (sin pin)
2. `firebase-config.js` — debe dejar `firebase` inicializado y, para laboratorio, `window.database`
3. `services-data.js` — debe definir `SERVICIOS_LABORATORIO`
4. `auth.js` — debe definir `checkAuth`, `hasPermission`, `PERMISSIONS`, `signOut`
5. `laboratorio.js`
6. `consentimientos-module.js` + `debug-consentimientos.js`
7. `index.js`
8. Parches: `fix-wait-time.js`, `admin-users.js`, `debug-lab-search.js`, `fix-lab-search.js`, `test-lab-functionality.js`
9. `lab.js` — **no** está en el HTML; `index.js` lo inyecta con `document.createElement('script')`

`index.js` en `DOMContentLoaded`:

1. `window.noRedirectOnAuth = true`
2. `checkAuth()` → si no hay usuario, redirect a `home.html`
3. `applyRoleBasedUI(role)` — **loguea `JSON.stringify(PERMISSIONS.admin)`**. Si `PERMISSIONS` no existe, lanza `ReferenceError` **antes** de aplicar visibilidad de laboratorio / consentimientos / logout
4. `initAuth()` — `firebase.auth().onAuthStateChanged`; si hay user, resuelve. Si no hay user, redirige a `home.html` y **la Promise no se resuelve ni se rechaza**
5. `loadTickets()` y, si existe, `initLaboratorioSystem()`
6. Muestra `crearTicketSection` (no la sala de espera)

Hay **varios** `DOMContentLoaded` (inicio de `index.js`, ~L3919, `index.html` inline, y un listener al final). El handler de `canViewSchedule` llama `renderTickets('fecha', today)` **antes** de que `loadTickets` termine; el segundo argumento `date` **se ignora** (siempre lee `#filterDate`). El filtro `fecha` no existe y cae al `else` (solo recorta por día). Luego el flujo autenticado pinta `todos`/`espera`.

El script inline de `index.html` y el `DOMContentLoaded` ~L3919 de `index.js` **repiten** la misma lógica: ocultar hora de cita, crear otro `#urgenciaDesc`, y navegación por flechas del formulario. Quedan ids duplicados y listeners dobles.

### Navegación duplicada (sidebar)

Los botones del menú tienen `onclick` en el HTML **y** `safeAddEventListener` en `index.js`. Un click dispara ambos.

| Botón | `onclick` (HTML) | Listener extra (`index.js`) | Efecto |
|---|---|---|---|
| `#crearTicketBtn` | `navigateToSection('crearTicketSection', …)` | `showSection` + `setActiveButton` | Dos transiciones; suele ser inocuo |
| `#verTicketsBtn` | `navigateToConsultas()` | Mismo reset de filtro + `showSection` | `renderTickets` dos veces |
| `#horarioBtn` | `navigateToSection('horarioSection', …)` → `mostrarHorario()` | Otra vez `mostrarHorario()` | Horario se pinta dos veces |
| `#estadisticasBtn` | `navigateToEstadisticas()` → `updateStatsGlobal()` (periodo) | `updateStatsGlobal()` y, a los 200 ms, `renderizarGraficos*(tickets)` **sin filtrar** | Los canvas de espera / personal / servicios muestran **todo el histórico**, no el periodo |

`#administrativoCategory` tiene clase `admin-only`. Aunque `hasPermission('canViewSchedule')` o `canViewStats` sea true, el padre se oculta si el rol no es `admin`. Esas flags solo servirían si el HTML se reestructura.

Globals que **este repo usa y no define** (deben venir de `firebase-config.js` / `auth.js` / parches):

- `ticketsRef` → `firebase.database().ref('tickets')`
- `settingsRef` → contador `currentTicketId`
- `window.database` → usado por `laboratorio.js` (`lab_tickets`, lectura de `tickets`)
- `PERMISSIONS`, `hasPermission(flag)`
- `checkAuth()`, `signOut()`
- `setupExamenRegaliaAndFirma()`, `setupEditExamenRegaliaAndFirma()`, `forceReloadClientesData()`, `diagnoseLaboratorySearch()` — invocados desde `laboratorio.js` y **no definidos** aquí. `forceUpdateClientesData()` sí está en este archivo (otro nombre). Si `setupExamenRegaliaAndFirma` lanza, `initLaboratorioSystem` aborta **después** de enganchar el form y **antes** de `setDefaultLabDate` / `setupClientesDataListener`. Si `setupEditExamenRegaliaAndFirma` lanza al abrir un ticket, no corre `initEditServiceSelection`.

`laboratorio.js` se carga **antes** que `index.js`. No llama a `generateRandomId` / `getLocalDateString` / `showNotification` en parse time; las usa después, cuando `index.js` ya definió esas funciones (hoisting de `function` + init en `DOMContentLoaded`).

`laboratorio.js` no usa `ticketsRef` global: crea `window.database.ref('tickets')` y `window.database.ref('lab_tickets')`.

`window.tickets` se reasigna tras cada carga/cambio para que consentimientos y lab lean el mismo array.

`window.ticketsRef` **nunca se asigna**. El listener legacy de `renderLabResults` (`if (typeof window.ticketsRef !== 'undefined')`) no se engancha aunque existiera el HTML.

Al parsear `index.js` hay un `renderTickets('espera')` suelto (~L1247) antes de autenticar: vacía `#ticketContainer` con la lista aún vacía.

## Mapa de módulos (código presente)

```
index.html          UI: consultas, lab, consentimientos, horario, stats, ediciones
index.js            Consultas + stats + horario + auditoría + hojas lab legacy
laboratorio.js      Tickets lab independientes (nodo lab_tickets)
```

Hay **tres caminos de laboratorio**. No están unificados.

| Camino | Dónde | Nodo Firebase | Estado en este checkout |
|---|---|---|---|
| Tickets lab (vigente) | `laboratorio.js` | `lab_tickets` | UI y listeners en HTML/JS presentes |
| Hojas / resultados (legacy) | `index.js` `openLabSheetModal` | `lab_sheets/{ticket.id}` | Función en `window`; **cero callers** en este checkout. Clave = `id` **visual del día** (colisiona entre días). Estados propios: `en proceso`, `pendiente reportar`, `reportados` |
| Filtro “Laboratorio” / lista de hojas | `renderLabResults`, `renderLabSheets` | Filtra `tickets` por substring de `tipoServicio` (`panel`, `perfil`, `hemograma`, `quimica`, `test`, `analito`, `laboratorio`) | JS busca `#labFilterBtn`, `#labResultsContainer`, `#labContainer`, `#labSheetBtn` — **no existen** en `index.html` |

Un ticket `lab_tickets` **no** cambia el estado de la consulta, salvo el intento de copiar número de factura (ver workflows).

## Firebase Realtime Database

Rutas observadas en el código presente:

| Path | Escritor | Contenido |
|---|---|---|
| `tickets` | `index.js` (`ticketsRef.push/update/remove`) | Consultas de sala de espera |
| `tickets` (lectura) | `laboratorio.js` | Autocompletar cliente / historial de consultas |
| `lab_tickets` | `laboratorio.js` | Tickets de laboratorio |
| `ticket_edits` | `index.js` al guardar edición | Auditoría de cambios de consulta |
| `settings` (vía `settingsRef`) | `loadTickets` | `{ currentTicketId }` — máximo **global**, no diario |
| `lab_sheets/{consulta.id}` | `openLabSheetModal` | Hoja legacy (estado + texto de exámenes) |

`cargarHistorialEdiciones` usa `ticket_edits.orderByChild('fecha')`. En RTDB eso exige índice `.indexOn: "fecha"` (o descarga el árbol completo y avisa en consola). Ese índice **no** está versionado aquí.

### Poda automática en `loadTickets`

Al cargar, **borra de Firebase** cualquier hijo de `tickets` que no tenga `id != null` **y** `mascota`. El mismo criterio aplica en `child_added`. No escribir registros de prueba incompletos en `tickets`.

`lab_tickets` **no** se poda.

`child_changed` solo actualiza si la `firebaseKey` **ya está** en el array local. Un nodo que se creó incompleto, se podó, y luego se completó en Firebase no reaparece hasta recargar.

`loadTickets` registra listeners cada vez que se llama. Una segunda llamada duplica `child_added` / `child_changed` / `child_removed`.

### Listeners duplicados sobre `tickets`

`index.js` (`loadTickets`) y `laboratorio.js` (`setupClientesDataListener`) escuchan el mismo nodo. En lab el orden de registro es:

1. `once('value')` → `updateClientesDataFromSnapshot` (incluye `consultas[]`)
2. `on('value')` → rebuild completo
3. `on('child_added')` / `on('child_changed')` → `addClienteFromTicket` (`updateClienteFromTicket` es un alias)

`addClienteFromTicket` **reescribe** el cliente **sin** `consultas`. Tras cualquier alta o edición, ese cliente deja de pasar el filtro de fecha hasta el próximo rebuild por `value`.

Tras rebuild, `notifyClientesDataUpdated()` dispara `document` event `clientesDataUpdated` (`detail.count`, `detail.timestamp`). `setupClienteSearch` lo escucha y, si `#labClienteSearch` tiene ≥2 caracteres, relanza `searchClientes` a los 300 ms.

## Modelo: consulta (`tickets`)

Creado en `addTicket()`:

| Campo | Notas |
|---|---|
| `id` | Entero visual: `max(id del día) + 1` según `fechaConsulta` |
| `randomId` | 16 chars alfanuméricos; clave de UI/edición |
| `nombre`, `cedula`, `mascota`, `tipoMascota` | Cliente / paciente |
| `idPaciente` | ID clínico |
| `motivo`, `motivoLlegada` | Textos |
| `estado` | Ver [estados de consulta](#estados-de-consulta) |
| `urgencia` | `consulta` \| `prequirurgico` \| `emergencia` \| `urgencia` \| `leve` (se guarda en minúsculas) |
| `tipoServicio` | Valor del `<select>` (p. ej. `consulta`, `hemograma`, `panel_plus`) |
| `medicoAtiende` | `"Dr. …, Tec. …"` concatenado |
| `numFactura`, `porCobrar`, `expediente` | Facturación / Argus |
| `fecha` | ISO timestamp de creación |
| `fechaConsulta` | `YYYY-MM-DD` del formulario. **Obligatoria para Ver Consultas**: todos los filtros de sala comparan solo este campo (sin fallback a `fecha`) |
| `horaCreacion`, `horaLlegada` | `HH:MM` local al crear (`toLocaleTimeString('es-ES')`) |
| `horaConsulta` | Hora de cita del formulario (`#hora`), si el rol ve el campo y se envió. En **edición** el input `#editHora` **no se lee** |
| `horaAtencion` | En el camino vivo (`saveEditedTicket`) solo se escribe si el estado pasa de `espera` a `consultorio*` y el campo está vacío. `rayosx` / `quirofano` no la setean. El input de hora de atención del modal **no tiene `id`**; el código busca `#editHoraAtencion` (inexistente), así que no hay preview |

Campos que aparecen en edición / listados, no siempre en el alta:

- `listoParaFacturar` (boolean; el checkbox escribe en Firebase al cambiar, sin esperar submit)
- `sinCosto` (boolean; el filtro “Por Facturar” excluye `sinCosto === true`). **Este repo no lo escribe** — solo lo lee
- `editCount` (incrementa en cada save si el rol es `consulta_externa`, incluso si el formulario no cambió)
- `firebaseKey` — **solo en memoria**; se elimina antes de `update`

`saveEditedTicket` arma un objeto **parcial** (sin `randomId`, `fecha`, `horaLlegada`, `horaCreacion`, `horaConsulta`) y hace `update` (merge). Esos campos no se borran. `getTicketDiff` solo compara keys del objeto nuevo (`!==`, sin coerción).

El `<select id="estado">` de **alta** no incluye `cliente_se_fue`. Ese valor solo se asigna al cambiar estado.

El HTML ya trae `#urgenciaDesc`; `index.js` y el script inline **crean otro** `div#urgenciaDesc` (ids duplicados). Las descripciones inline no cubren `prequirurgico`. Si falta `urgencia` en un ticket viejo, `editTicket` defaulta a `'normal'`, valor que **no** está en el `<select>`.

`#editModal` y `#statusModal` del HTML no se usan: edición y cambio de estado crean un `.edit-modal` en el DOM.

Búsqueda de sala (`#ticketSearchInput`): `nombre`, `mascota`, `idPaciente`, `numFactura`. **No** incluye `cedula`.

El modal de edición incluye casi el mismo catálogo de `tipoServicio` que el alta, más un valor extra `prequirurgico` (en alta eso es urgencia, no servicio) y `test_sida_leucemia` duplicado.

### Médicos hardcodeados (listas que no coinciden)

| Superficie | `Dr. Gustavo …` |
|---|---|
| Alta (`#doctorAtiende`), lab (`#labMedicoSolicita`), filtro lab (`#labMedicoFilter`) | `Dr. Gustavo Gonzalez` (sin tilde) |
| Modal de edición (`#editDoctorAtiende`) | `Dr. Gustavo González` (con tilde) |

`editTicket` parte `medicoAtiende` por coma y asigna al `<select>` solo si el string **es idéntico**. Un ticket creado con `Gonzalez` no preselecciona doctor. Guardar sin reelegirlo deja `editDoctorAtiende === ''` y el update escribe solo el técnico (o vacío).

`getNombreServicio` no traduce `test_distemper`, `test_parvovirus` ni `rx_control` (sí están en el alta). En estadísticas esos labels salen crudos.

### Estados de consulta

| Valor | UI |
|---|---|
| `espera` | En Sala de Espera |
| `consultorio1` … `consultorio5` | Consultorio N |
| `rayosx` | En Rayos X |
| `quirofano` | En Quirófano |
| `cliente_se_fue` | Cliente se fue |
| `terminado` | Consulta Terminada |

Camino vivo (click en la tarjeta → `#editEstado` → `saveEditedTicket`):

- `horaAtencion`: solo `espera` → `consultorio1`–`5` si el campo está vacío. No aplica a `rayosx` / `quirofano`, ni a un consultorio que no venía de `espera`.
- `horaFinalizacion`: se escribe si el estado pasa a `terminado` / `cliente_se_fue` y aún no existía.
- El filtro de sala activo se conserva.

`changeStatus` (solo consola) **no tiene callers**. Si se invoca a mano: `consultorio*` (cualquier origen) setea `horaAtencion`; `terminado` / `cliente_se_fue` hace `update` y `return` **sin** `closeModal()`; cualquier otro estado fuerza el filtro `terminado`.

`endConsultationByFirebaseKey` sí cierra el confirm, escribe `horaFinalizacion` y, si faltaba, `horaAtencion`.

## Modelo: ticket de laboratorio (`lab_tickets`)

Creado en `handleLabTicketSubmit()`:

| Campo | Notas |
|---|---|
| `id`, `randomId` | `id` = máximo global en `lab_tickets` + 1 (no se reinicia por día); `randomId` de 16 chars (`generateRandomId` de `index.js`, ya cargado al submit) |
| Cliente / paciente | `nombre`, `cedula`, `mascota`, `tipoMascota`, `edad`, `raza`, `peso`, `sexo`, `idPaciente` |
| `fecha` | Fecha de servicio |
| `fechaCreacion`, `horaCreacion` | Alta |
| `serviciosSeleccionados` | Array de objetos del catálogo (incl. `realizado` al marcar) |
| `serviciosIds`, `serviciosNombres`, `totalServicios` | Denormalizado |
| `prioridad` | `rutina` \| `urgente` \| `emergencia` |
| `medicoSolicita`, `departamento` | `consulta_externa` \| `internos` |
| `examenRegalia` | `si` \| `no` — el campo solo se muestra si el médico es `Dr. Luis Coto` o `Dr. Randall Azofeifa` |
| `firmaDigital` | Base64; UI de firma espera `setupExamenRegaliaAndFirma` (ausente aquí). En edición, el contenedor de firma solo se pinta si `examenRegalia === 'si'` **y** el rol es `admin` |
| `observaciones`, `notasLaboratorio` | |
| `paquete` | `no_aplica` \| `castracion` \| `limpieza` |
| `correo`, `telefono`, `factura` | Contacto / factura |
| `estado` | Ver abajo |

Validación al crear:

- Servicios: al menos uno (`selectedServices.length > 0`)
- JS (`validateLabTicketData`): `nombre`, `cedula`, `mascota`, `raza`, `sexo`, `idPaciente`, `medicoSolicita`, `departamento`
- HTML `required` **además**: `peso`, `telefono`, `correo`, `fecha`, `prioridad`, `paquete`, `estado`, `#labFechaFiltro`
- Cédula: `/^\d{8,12}$/` sobre el valor sin `-` ni espacios
- El correo **no** se valida en JS (el HTML lo marca `required` pero acepta cualquier texto)

`currentLabTicketId` se recalcula en el listener `value` de `lab_tickets` (`max(id)+1`). Dos altas concurrentes pueden chocar el `id` visual; `randomId` y la key de Firebase siguen siendo únicos.

El listener de `lab_tickets` solo vuelve a pintar la lista si `#verLabSection` **no** está `hidden`. Al abrir Ver Tickets Lab, `showLabSection` renderiza el filtro por defecto (`admin` → `todos`, resto → `pendiente`) **sin** sincronizar la clase `active` de `.lab-filter-btn`. Si el usuario había dejado otro filtro marcado, el botón y la lista pueden discrepar.

El click de `.lab-filter-btn` lee `e.target` (no `currentTarget`) y también hace `e.target.classList.add('active')`. El botón `reportado_cliente` trae un `<br>` interno (`index.html`); click en el texto o el `<br>` deja `filter === null` **y** puede marcar `active` en el `<br>` (el chip visible pierde el estado).

Búsqueda de clientes (`searchClientes`):

- Texto: `Nombre`, `Identificacion` (cédula), `nombre mascota`, `Id`, o cualquier palabra del query en nombre/mascota
- Fecha obligatoria: `cliente.consultas[].fecha === #labFechaFiltro`
- Orden: coincidencia exacta (nombre/mascota empieza por el query), luego `ultimaActualizacion` desc
- Tope: **8** resultados

`fechaReportado` / `fechaReportadoCliente` solo se escriben en `changeLabStatus`, que **no tiene callers**. El camino vivo (`editLabTicket` → `#editLabEstado` → `saveEditedLabTicket`) cambia `estado` **sin** sellar esas fechas. Los filtros de fecha de `reportado_cliente` / `cliente_no_contesta` pueden ignorar tickets recién reportados por el modal.

Las tarjetas de stats (`#totalLabTickets`, etc.) cuentan **todo** `labTickets`, no el filtro activo.

Estados lab:

| Valor | Filtro UI |
|---|---|
| `pendiente` | Pendiente |
| `procesando` | En proceso |
| `reportado` | Reportados Lab (`fechaReportado` / `horaReportado` al transicionar) |
| `reportado_cliente` | Por reportar al cliente (`fechaReportadoCliente` / `horaReportadoCliente`) |
| `laboratorio_externo` | Laboratorio externo |
| `cliente_no_contesta` | Cliente no contesta |

El botón de filtro **Internos** no es un estado: `ticket.departamento === 'internos'`.

Tickets viejos pueden traer `tipoExamen` en lugar de `serviciosSeleccionados`; la UI aún lo muestra.

El índice de clientes (`clientesData`) guarda cada consulta con `medicoAtiene` (sin la **d**). El campo real del ticket es `medicoAtiende`. Ese historial no se usa para pintar el médico en la búsqueda.

`updateClientesDataFromSnapshot` usa `ticket.fechaConsulta || ticket.fecha` como `consultas[].fecha`. `ticket.fecha` es ISO (`2026-09-14T…`); `#labFechaFiltro` es `YYYY-MM-DD`. Un ticket sin `fechaConsulta` **nunca** coincide con el filtro de fecha.

`selectCliente` rellena nombre, cédula, mascota, ID y tipo. **No** llama `updateRazasSelect()`: asignar `labTipoMascota.value` no dispara `change`, así que el `<select>` de razas puede seguir mostrando la lista canina por defecto.

## Auditoría (`ticket_edits`)

En cada `saveEditedTicket` con diff no vacío:

```
{ idTicket, usuario, email, fecha, hora, cambios: { campo: { antes, despues } }, randomId? }
```

`firebaseKey` no entra en el diff. `fecha` del log usa `toISOString().split('T')[0]` (**UTC**, no `getLocalDateString`).

`cargarHistorialEdiciones` une cada fila con `tickets.find(t => t.id === edit.idTicket)`: el `id` es **visual del día**, así que un edit del ticket #3 de ayer puede mostrar cliente/mascota del #3 de hoy.

La tabla HTML tiene **9** columnas (incluye Factura); las filas pintan **8** (Fecha, Hora, Usuario, Email, ID, Cliente, Mascota, Cambios). La búsqueda sí filtra por `numFactura`; la columna no se renderiza. Empty/loading usan `colspan="8"`.

La sección `#edicionesSection` existe (paginada, 25 filas), pero **no hay botón** `#edicionesBtn` en el sidebar: la vista no es alcanzable por navegación. Atajo de consola: `navigateToSection('edicionesSection', 'verTicketsBtn')` y luego `cargarHistorialEdiciones()`. El historial en vivo del modal de edición (solo `admin`, `window._ticketEdicionesListener`) sí une por `randomId`.

## Roles (observados en este código)

El mapa `PERMISSIONS` vive en `auth.js` (ausente). Lo que **sí** está hardcodeado aquí:

| Rol | Laboratorio (nav) | Consentimientos | Vista consultas | Notas en este repo |
|---|---|---|---|---|
| `admin` | Sí | Sí | Filtro “Todos”; borra lab y consultas según `hasPermission` | Único rol que ve el bloque Administrativo (`admin-only`) |
| `consulta_externa` | Sí | Sí | Default “En espera” | Tras 7 `saveEditedTicket` se deshabilita Guardar; botón “Terminar Consulta” aunque no tenga `canDeleteTickets` |
| `internos` | Sí | Sí | Default espera | |
| `quirofano` | Sí | Sí | Default espera | Ve hora de cita en edición (`admin`, `recepción`, `quirofano`) |
| `laboratorio` | Sí | Sí | Default espera | Único rol que **persiste** el checkbox “servicio realizado” (`toggleServiceStatus`) |
| `visitas` | No | No | Vista reducida (`canViewFullTicket`); sin búsqueda ni filtro Lista | Sidebar colapsable (`#menuToggleBtn`) |
| `recepcion` / `recepción` | Nav lab: no (no está en `allowedLabRoles`) | Sí | | `recepcion` no edita “Por cobrar”; `recepción` (con tilde) controla hora de cita |

El formulario de alta de usuarios en el HTML **no** ofrece `admin` ni `laboratorio`.

Flags usados (definidos fuera de este repo): `canCreateTickets`, `canViewStats`, `canViewSchedule`, `canExportData`, `canViewFullTicket`, `canDeleteTickets`, `canEditTickets`.

El contenedor `#dateFilterContainer` (fecha en sala de espera) solo se muestra si `hasPermission('canViewSchedule')`. Horario y Estadísticas del sidebar, no: el padre es `admin-only`.

`exportarDia` exige `canExportData`. **`exportarMes` y `backupData` no comprueban permiso** (los botones viven en bloques `admin-only` del HTML).

En estadísticas, “En Consulta” (`#pacientesConsulta`) cuenta solo `consultorio1`–`5`. `rayosx` y `quirofano` no entran. “Atendidos” es solo `terminado`; `cliente_se_fue` tiene contador aparte si existe `#clientesSeFueron`.

`renderizarGraficosPersonalServicios` lee `#filtroPersonal` y `#filtroServicio`. **Ninguno existe** en `index.html`. `llenarSelectorPersonal()` es no-op. No hay filtro de médico/servicio usable en la UI.

### Allowlists de laboratorio (no coinciden)

Cuatro listas distintas en el código presente:

| Superficie | Roles |
|---|---|
| Nav + `hasLabAccess()` | `admin`, `consulta_externa`, `internos`, `quirofano`, `laboratorio` |
| `.filter-btn[data-filter="laboratorio"]` | `admin`, `laboratorio`, `consulta_externa` |
| `#labFilterBtn` (`renderLabResults`) | `admin`, `consulta_externa`, `internos`, `laboratorio` (**sin** `quirofano`) |
| `#labSheetBtn` (hoja legacy) | `consulta_externa`, `laboratorio`, `admin` |

`quirofano` ve el módulo vigente y **no** las superficies legacy (aunque esas superficies no tienen HTML en este checkout).

## Catálogo de servicios lab

`laboratorio.js` lee `SERVICIOS_LABORATORIO`: objeto de categorías con `{ titulo, servicios: [{ id, nombre, descripcion, precio }] }`. Precios en colones; la UI avisa que pueden no coincidir con el sistema de facturación.

## Superficie pública (funciones globales útiles)

Definidas o asignadas a `window` en el código presente:

- Consultas (UI viva): `addTicket`, `editTicket`, `saveEditedTicket`, `endConsultationByRandomId`, `deleteTicketByRandomId`, `renderTickets`, `navigateToSection`, `navigateToConsultas`
- Consultas (sin callers en este checkout): `changeStatus`
- Lab (UI viva): `initLaboratorioSystem`, `showLabSection`, `editLabTicket`, `saveEditedLabTicket`, `toggleServiceStatus`, `navigateToLab`, `forceUpdateClientesData`
- Lab (sin callers / nombre distinto al HTML): `changeLabStatus`; el empty state llama `forceReloadClientesData` (no existe; la definida es `forceUpdateClientesData`)
- Legacy (sin callers / sin HTML): `openLabSheetModal`, `renderLabResults`
- Utilidad: `showNotification`, `getLocalDateString`, `window.tickets`, `window.noRedirectOnAuth`, `window.laboratorioInitialized`
- Evento DOM: `clientesDataUpdated` (índice de clientes lab reconstruido)

`window.updateConsultaTicketFactura` y `window.syncFacturaBetweenSystems` son **invocados** desde laboratorio al copiar factura y **no están definidos** en los archivos de este repo.

`openLabSheetModal` usa `userRole` **sin** `sessionStorage.getItem` (no es un `const` local). El botón Eliminar de la hoja solo aparece si existe un global `userRole === 'admin'`. No hay `onclick` ni llamada en los archivos de este repo.

`#menuToggle` del HTML no está enganchado. El toggle de visitas es `#menuToggleBtn` (`setupVisitasSidebarToggle`). `#conejoImg` no existe; los listeners de conejo son no-op.
