# Flujos de trabajo

## Consulta (sala de espera)

Tras autenticarse, la app abre **Crear Consulta** (`crearTicketSection`), no la lista.

### Crear

1. Navegación: Consultas → Crear Consulta (`crearTicketSection`).
2. Campos obligatorios en HTML: cliente, cédula, mascota, tipo, ID paciente, fecha, estado, urgencia, tipo de servicio, motivo de llegada.
3. `hora` (cita) solo se muestra si el rol es `admin`, `recepción` (con tilde) o `quirofano`. El resto, incluido `visitas` y `recepcion` sin tilde, no ve el campo.
4. Flechas del teclado mueven el foco en una grilla de 2 columnas (`index.html` + `index.js`).
5. Submit → `addTicket()`:
   - Calcula `id` del día con los tickets ya cargados en memoria (`fechaConsulta`).
   - Genera `randomId`.
   - `horaLlegada` = ahora. Si el estado inicial es `consultorio1`–`consultorio5`, también `horaAtencion`.
   - `ticketsRef.push(...)`.
6. Tras éxito: reset del form (fecha = hoy) y pasa a Ver Consultas.

El `id` no es único global: se reutiliza cada día. Para operaciones usar `randomId` o `firebaseKey`.

El alta no ofrece `cliente_se_fue` (solo aparece al cambiar estado).

### Ver y filtrar

`renderTickets(filter)` aplica **siempre** la fecha de `#filterDate` (hoy por defecto). Ese input solo es visible con `canViewSchedule`.

| Filtro | Criterio |
|---|---|
| `todos` | Día seleccionado, excluye `terminado` y `cliente_se_fue` |
| `espera` | `estado === 'espera'` |
| `consultorio` | Consultorios 1–5, `rayosx`, `quirofano` |
| `terminado` | `terminado` o `cliente_se_fue` |
| `porFacturar` | Sin `numFactura` y `sinCosto !== true` |
| `lista` | **Todo** el día en tabla (incluye terminados); no `visitas`; se inyecta el botón en JS |
| `urgentes` | `urgencia === 'alta'` — **no coincide** con los valores del form (`emergencia`, `urgencia`, …) |
| `fecha` (u otro desconocido) | Solo recorta por `fechaConsulta`; se llama al cargar si hay `canViewSchedule` |

Búsqueda (roles ≠ `visitas`): cliente, mascota, ID paciente, factura.

Default al abrir Ver Consultas: `admin` → `todos`; resto → `espera`. El botón “Todos” se oculta si el rol no es `admin`.

Orden: “Terminados” por `id` descendente; el resto por `horaLlegada` (fallback `horaCreacion`, luego `id`).

Rol sin `canViewFullTicket` (pensado para `visitas`): tarjeta reducida (mascota, icono, urgencia, estado).

### Editar

Click en el ticket → `editTicket(randomId)`.

- “Por cobrar”: historial de solo lectura + textarea para **añadir**. Cada entrada se concatena con `--- {fecha hora} ({userName}) ---`. No se reescribe el texto viejo.
- `recepcion` no puede añadir “Por cobrar”.
- `consulta_externa`: `editCount` sube en cada guardado. Con `editCount >= 7` el botón Guardar se deshabilita por completo (“Límite de ediciones alcanzado”), no solo el campo “Por cobrar”.
- Checkbox “Listo para facturar”: escribe `listoParaFacturar` en Firebase al cambiar, sin esperar el submit.
- Guardar → `saveEditedTicket`: `update` en `tickets/{firebaseKey}` (sin la propiedad `firebaseKey`) y, si hay diff, `ticket_edits.push`.

### Cambiar estado

`changeStatus(randomId)` abre un select con los estados de consulta (modal dinámico; `#statusModal` del HTML no se usa). Efectos laterales de hora: ver [architecture.md](architecture.md#estados-de-consulta).

Tras un cambio de estado **que no es** `terminado` / `cliente_se_fue`, la vista de consultas se fuerza a filtro `terminado` (incluso si el nuevo estado no es terminado).

Si el nuevo estado **sí** es `terminado` o `cliente_se_fue`, el handler hace `update` y `return` **sin** `closeModal()`. El modal queda abierto; `renderTickets('terminado')` solo corre si `#verTicketsSection` tiene clase `active`.

Terminar consulta (`endConsultationByFirebaseKey`) sí conserva el filtro activo y cierra el confirm.

### Borrar y terminar

- Eliminar: `deleteTicketByFirebaseKey` exige `hasPermission('canDeleteTickets')`.
- Terminar consulta: botón en la tarjeta si `canDeleteTickets` **o** rol `consulta_externa`, y el estado no es ya `terminado` / `cliente_se_fue`. Confirma y pasa a `terminado`.
- En Horario, las filas siempre pintan el botón borrar; el handler sigue exigiendo `canDeleteTickets`.

---

## Laboratorio

Visible en el sidebar si el rol está en `admin`, `consulta_externa`, `internos`, `quirofano`, `laboratorio`. `initLaboratorioSystem()` sale si `hasLabAccess()` es falso (misma lista). Otras superficies lab usan listas distintas: [architecture.md](architecture.md#allowlists-de-laboratorio-no-coinciden).

### Crear ticket lab

1. Crear Ticket Lab → `showLabSection('crearLabSection')` → `initServiceSelection()` (necesita `SERVICIOS_LABORATORIO`).
2. Buscar cliente (`#labClienteSearch`): índice en memoria desde `tickets`, clave `cedula` o `idPaciente` (un cliente = última mascota vista). Mínimo 2 caracteres. Máximo **8** resultados, exactos primero.
3. `#labFechaFiltro` es **obligatorio** en la búsqueda: solo muestra clientes con una consulta en esa fecha (`cliente.consultas[].fecha`). Si el input está vacío, se rellena con hoy y **sale sin buscar** (hay que teclear de nuevo).
4. Elegir tipo de mascota → razas (`razasCaninas` / `razasFelinas` / `razasOtras` en `laboratorio.js`).
5. Marcar ≥1 servicio. Total en colones (orientativo).
6. Examen de regalía: visible y auto-`si` solo para `Dr. Luis Coto` y `Dr. Randall Azofeifa`.
7. Submit → validación → `labTicketsRef.push`. Default de estado en el form: `pendiente`.
8. Éxito → limpia form y abre Ver Tickets Lab.

Factura (`#labFactura`): al escribir ≥3 caracteres, busca consultas del mismo cliente **sin** factura y llama `window.updateConsultaTicketFactura`. Esa función **no está en este repo**; el aviso de “Factura sincronizada” puede mostrarse y el nodo `tickets` no actualizarse.

En edición, el mismo campo espera `window.syncFacturaBetweenSystems` (tampoco está aquí).

Si la búsqueda no encuentra nada, `displaySearchResults` interpola `${query}`, que **no existe** en ese scope (`queryLower` sí). Eso lanza `ReferenceError` en el empty state. Los botones “Diagnosticar” / “Recargar” llaman `diagnoseLaboratorySearch` y `forceReloadClientesData` (ausentes aquí).

### Ver tickets lab

Default: `admin` → filtro `todos`; otros → `pendiente`.

Filtro de **fecha** (`#labFilterDate`): el contenedor solo se muestra en `reportado_cliente` y `cliente_no_contesta`. Pendiente, procesando, lab externo, internos y reportado lab **ignoran** la fecha. El match acepta `fechaCreacion`, `fecha`, `fechaReportado` o `fechaReportadoCliente`.

Filtro de **médico**: visible en `reportado`, `reportado_cliente` y `cliente_no_contesta`. En los demás estados, un valor en `#labMedicoFilter` no se aplica (aunque el `<select>` tenga valor).

Búsqueda (`#labSearchInput`): filtra por `textContent` de las tarjetas ya renderizadas (no relanza `renderLabTickets`).

Click en la tarjeta (fuera de Eliminar) → `editLabTicket`. Eliminar solo se pinta si `userRole === 'admin'`.

`getUserReportOption` hoy devuelve **todas** las opciones de reporte a cualquier rol (comentario: “mostrar todas las opciones”).

### Marcar servicio realizado

Checkboxes visibles para `laboratorio` y `admin`. `toggleServiceStatus` **rechaza** cualquier rol distinto de `laboratorio` (admin ve el control y recibe error al usarlo).

Al transicionar a `reportado` o `reportado_cliente` se sellan fecha/hora de reporte.

---

## Administrativo (admin)

Sidebar “Administrativo” (clase `admin-only`):

- **Horario**: tabla del día (`mostrarHorario`). Tickets sin `fechaConsulta` se comparan con `new Date(fecha).toISOString().split('T')[0]` (UTC; puede desalinear el día). Export CSV día/mes si `canExportData`. “Exportar a Google” abre Google Sheets y muestra un aviso; **no hay integración**.
- **Estadísticas**: conteos del periodo (`hoy` / semana / mes / año / personalizado), Chart.js de tiempo de espera (usa `horaLlegada` vs `horaFinalizacion` o `horaAtencion`) y gráficos por personal/servicio. Semana = domingo–sábado. Periodos distintos de “hoy” parsean `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC).
- **Ediciones**: historial `ticket_edits` (paginado) — sección en HTML, **sin entrada de menú**.
- **Respaldo / limpieza**: ver [runbook.md](runbook.md).

`adminUsersBtn` abre el modal de alta de usuarios; la lógica está en `admin-users.js` (ausente). Roles del `<select>`: `recepcion`, `consulta_externa`, `quirofano`, `internos`, `visitas`.

---

## Consentimientos

UI en `consentimientosSection`: búsqueda de cliente + plantillas (`anestesia`, `cirugia`, `emergencias`, `internamiento`, `transfusion`, `cesarea`, `eutanasia`, `alta_voluntaria`) cargadas en un iframe. El módulo `consentimientos-module.js` no está en el repo; la sección se muestra para todos los roles salvo `visitas`.

Un listener al final de `index.js` busca `#btn-consentimientos-container` / `#btn-consentimientos`. Esos ids **no están** en el HTML; el menú real usa `#consentimientosBtn`.
