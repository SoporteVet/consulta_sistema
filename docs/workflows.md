# Flujos de trabajo

## Consulta (sala de espera)

Tras autenticarse, la app abre **Crear Consulta** (`crearTicketSection`), no la lista.

Los botones del sidebar tienen `onclick` **y** listeners en `index.js`. Un click en Ver Consultas / Horario / Estadísticas corre el flujo dos veces. En Estadísticas el segundo paso pisa los gráficos: [architecture.md](architecture.md#navegación-duplicada-sidebar).

### Crear

1. Navegación: Consultas → Crear Consulta (`crearTicketSection`).
2. Campos obligatorios en HTML: cliente, cédula, mascota, tipo, ID paciente, fecha, estado, urgencia, tipo de servicio, motivo de llegada.
3. `hora` (cita) solo se muestra si el rol es `admin`, `recepción` (con tilde) o `quirofano`. El resto, incluido `visitas` y `recepcion` sin tilde, no ve el campo.
4. Flechas del teclado mueven el foco en una grilla de 2 columnas. La misma lógica está en `index.html` (inline) **y** en `index.js` (~L4079): listeners dobles.
5. Submit → `addTicket()`:
   - Calcula `id` del día con los tickets ya cargados en memoria (`fechaConsulta`).
   - Genera `randomId`.
   - `horaLlegada` = ahora. Si el estado inicial es `consultorio1`–`consultorio5`, también `horaAtencion`.
   - `ticketsRef.push(...)`.
6. Tras éxito: reset del form (fecha = hoy) y pasa a Ver Consultas (delay 1.5 s).

El `id` no es único global: se reutiliza cada día. Para operaciones usar `randomId` o `firebaseKey`.

El alta no ofrece `cliente_se_fue` (solo aparece al cambiar estado).

`#horaAtencion` no existe en el form de alta; el código lo lee por si acaso.

El alta guarda `Dr. Gustavo Gonzalez` (sin tilde). El modal de edición usa `Dr. Gustavo González`. Ver [architecture.md](architecture.md#médicos-hardcodeados-listas-que-no-coinciden).

### Ver y filtrar

`renderTickets(filter, date)` aplica **siempre** la fecha de `#filterDate` (hoy por defecto) contra **`fechaConsulta` solamente**. El argumento `date` **se ignora**. Tickets sin `fechaConsulta` (solo `fecha` ISO) no salen en ninguna cola de sala. Horario sí hace fallback a `fecha`.

Ese input de fecha solo es visible con `canViewSchedule`.

| Filtro | Criterio |
|---|---|
| `todos` | Día seleccionado, excluye `terminado` y `cliente_se_fue` |
| `espera` | `estado === 'espera'` |
| `consultorio` | Consultorios 1–5, `rayosx`, `quirofano` |
| `terminado` | `terminado` o `cliente_se_fue` |
| `porFacturar` | Sin `numFactura` y `sinCosto !== true`. `sinCosto` **no se escribe** en este repo |
| `lista` | **Todo** el día en tabla (incluye terminados); no `visitas`; se inyecta el botón en JS. Columnas: #, ticket, cliente, mascota, ID, estado, horas, médico, urgencia, motivo. No pinta cédula ni factura |
| `urgentes` | `urgencia === 'alta'` — **no coincide** con los valores del form (`emergencia`, `urgencia`, …) |
| `fecha` (u otro desconocido) | Solo recorta por `fechaConsulta`; se llama al cargar si hay `canViewSchedule` |

Búsqueda (roles ≠ `visitas`): cliente (`nombre`), mascota, ID paciente, factura. **No busca cédula.**

Default al abrir Ver Consultas: `admin` → `todos`; resto → `espera`. El botón “Todos” se oculta si el rol no es `admin`.

Orden: “Terminados” por `id` descendente; el resto por `horaLlegada` (fallback `horaCreacion`, luego `id`).

Rol sin `canViewFullTicket` (pensado para `visitas`): tarjeta reducida (mascota, icono, urgencia, estado).

### Editar

Click en el ticket → `editTicket(randomId)`.

- “Por cobrar”: historial de solo lectura + textarea para **añadir**. Cada entrada se concatena con `--- {fecha hora} ({userName}) ---`. No se reescribe el texto viejo.
- `recepcion` no puede añadir “Por cobrar”.
- `consulta_externa`: `editCount` se incrementa en memoria **antes** de `saveEditedTicket`. Si el `update` falla, el contador local ya subió. Un save sin cambios también consume un cupo. Con `editCount >= 7` el botón Guardar se deshabilita por completo (“Límite de ediciones alcanzado”), no solo el campo “Por cobrar”.
- Checkbox “Listo para facturar”: escribe `listoParaFacturar` en Firebase al cambiar, sin esperar el submit.
- Guardar → `saveEditedTicket`: `update` en `tickets/{firebaseKey}` (sin la propiedad `firebaseKey`) y, si hay diff, `ticket_edits.push`. Conserva el filtro de sala activo.
- El payload **omite** `randomId`, `fecha`, `horaLlegada`, `horaCreacion`, `horaConsulta`. El merge de Firebase los conserva.
- `#editHora` (hora de cita, roles `admin` / `recepción` / `quirofano`) **no se lee** en el submit. Cambiar la cita en el modal no persiste.
- El input de hora de atención no tiene `id`. El preview al cambiar `#editEstado` busca `#editHoraAtencion` y no hace nada.
- El modal de admin muestra historial en vivo de `ticket_edits` filtrado por `randomId` (`window._ticketEdicionesListener`).

Si el ticket tiene `Dr. Gustavo Gonzalez` y se guarda sin reelegir doctor, el médico desaparece del campo concatenado.

El `<select>` de tipo de servicio en edición tiene un valor extra `prequirurgico` (en alta eso es urgencia) y `test_sida_leucemia` dos veces. Guardar un ticket cuyo servicio no esté en la lista puede cambiarlo al primer option.

### Cambiar estado

Camino vivo: click en la tarjeta (roles ≠ `visitas`) abre `editTicket`. El estado se cambia en `#editEstado` y se guarda con el resto del formulario. No hay botón “Cambiar estado” en la tarjeta (comentario en código: se quitaron).

Efectos laterales en ese camino: [architecture.md](architecture.md#estados-de-consulta). `horaAtencion` solo se escribe si el ticket pasaba de `espera` a `consultorio*`.

`changeStatus` queda en `index.js` **sin callers**. Si se llama desde consola: estados que no son fin de consulta fuerzan el filtro Terminados; `terminado` / `cliente_se_fue` no cierran el modal.

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
2. Buscar cliente (`#labClienteSearch`): índice en memoria desde `tickets`, clave `cedula` o `idPaciente` (un cliente = última mascota vista). Mínimo 2 caracteres. Máximo **8** resultados; coincidencias que empiezan por el query primero, luego `ultimaActualizacion`.
3. `#labFechaFiltro` es **obligatorio** en la búsqueda: solo muestra clientes con una consulta en esa fecha (`cliente.consultas[].fecha`). Si el input está vacío, se rellena con hoy y **sale sin buscar** (hay que teclear de nuevo).
4. Tras un rebuild de `tickets`, el evento `clientesDataUpdated` relanza la búsqueda activa (delay 300 ms).
5. Elegir un resultado **no** refresca razas: `selectCliente` cambia `labTipoMascota` sin `change`. Si el paciente no es perro, reabrir el tipo o cambiarlo a mano para cargar `razasFelinas` / `razasOtras`.
6. Marcar ≥1 servicio. Total en colones (orientativo).
7. Examen de regalía: visible y auto-`si` solo para `Dr. Luis Coto` y `Dr. Randall Azofeifa`.
8. Submit → validación → `labTicketsRef.push`. Default de estado en el form: `pendiente`.
9. Éxito → limpia form y abre Ver Tickets Lab (filtro por defecto, no el que hubiera quedado activo).

Factura (`#labFactura`): al escribir ≥3 caracteres, busca consultas del mismo cliente **sin** factura y llama `window.updateConsultaTicketFactura`. Esa función **no está en este repo**; el aviso de “Factura sincronizada” puede mostrarse y el nodo `tickets` no actualizarse.

En edición, el mismo campo espera `window.syncFacturaBetweenSystems` (tampoco está aquí).

Si la búsqueda no encuentra nada, `displaySearchResults` interpola `${query}`, que **no existe** en ese scope (`queryLower` sí). Eso lanza `ReferenceError` en el empty state. Los botones “Diagnosticar” / “Recargar” llaman `diagnoseLaboratorySearch` y `forceReloadClientesData`. Aquí solo existe `forceUpdateClientesData()` (otro nombre); desde consola se puede llamar esa.

### Ver tickets lab

Default al **entrar** a la sección: `admin` → filtro `todos`; otros → `pendiente`. `showLabSection` **no** marca el botón correspondiente. Si se entra desde Crear Lab después de haber usado otro filtro, el botón activo y la lista pueden no coincidir. Recalcar el filtro deseado.

El click de los chips usa `e.target` (no `currentTarget`) y pone `active` en ese target. En “Por reportar al cliente” hay un `<br>`; click en el salto o el texto interno deja `data-filter` nulo y puede dejar `active` en el `<br>`. Pulsar el padding del botón (no el texto) sí funciona.

El listener `value` de `lab_tickets` solo re-renderiza si `#verLabSection` está visible. Los contadores de abajo son globales (todos los tickets), no del filtro.

Filtro de **fecha** (`#labFilterDate`): el contenedor solo se muestra en `reportado_cliente` y `cliente_no_contesta`. Pendiente, procesando, lab externo, internos y reportado lab **ignoran** la fecha. El match acepta `fechaCreacion`, `fecha`, `fechaReportado` o `fechaReportadoCliente`. `filterLabTicketsByDate` existe pero **no se usa**; el `change` de `#labFilterDate` llama `renderLabTickets`.

Filtro de **médico**: visible en `reportado`, `reportado_cliente` y `cliente_no_contesta`. En los demás estados, un valor en `#labMedicoFilter` no se aplica (aunque el `<select>` tenga valor). El match es `medicoSolicita.includes(...)`.

Búsqueda (`#labSearchInput`): filtra por `textContent` de las tarjetas ya renderizadas (no relanza `renderLabTickets`).

Click en la tarjeta (fuera de Eliminar) → `editLabTicket`. El submit se engancha **antes** de `setupEditExamenRegaliaAndFirma(ticket)`. Esa función no está en este repo: si lanza, no corre `initEditServiceSelection` (catálogo de edición vacío) aunque el formulario ya se pueda enviar. Eliminar solo se pinta si `userRole === 'admin'`.

`getUserReportOption` hoy devuelve **todas** las opciones de reporte a cualquier rol (comentario: “mostrar todas las opciones”).

### Marcar servicio realizado

Checkboxes visibles para `laboratorio` y `admin`. `toggleServiceStatus` **rechaza** cualquier rol distinto de `laboratorio` (admin ve el control y recibe error al usarlo).

Cambiar a `reportado` / `reportado_cliente` **desde el modal de edición no sella** `fechaReportado*`. Esas marcas solo viven en `changeLabStatus` (sin callers). Para que el filtro de fecha las vea, hay que escribir las fechas a mano en Firebase o recuperar esa función.

---

## Administrativo (admin)

El bloque `#administrativoCategory` es `admin-only`. Un rol no-admin con `canViewSchedule` / `canViewStats` **no** ve Horario ni Estadísticas en el menú.

Sidebar “Administrativo”:

- **Horario**: tabla del día (`mostrarHorario`). Tickets sin `fechaConsulta` se comparan con `new Date(fecha).toISOString().split('T')[0]` (UTC; puede desalinear el día). Ordena solo si **ambos** tickets tienen `horaConsulta`; si falta, el relative queda `0`. Cada fila pinta editar y borrar; el delete sigue exigiendo `canDeleteTickets`.
- **Export CSV**:
  - Día: exige `canExportData`. Fallback UTC de `fecha` como Horario.
  - Mes: **no** comprueba permiso. Parsea `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC; el día 1 local puede caer en el mes anterior).
  - Separador `;`, BOM UTF-8 (`\uFEFF`) — Excel en locale es-CR/es-ES. Columnas: ID, cliente, mascota, tipo, cédula, ID paciente, médico, fecha, hora (`horaConsulta` o `horaCreacion`), estado, urgencia, factura, motivos, por cobrar.
- “Exportar a Google” abre Google Sheets y muestra un aviso; **no hay integración**.
- **Estadísticas**:
  - Contadores del periodo (`hoy` / semana / mes / año / personalizado) vía `updateStatsGlobal` → `filtrarTicketsPorPeriodoGlobal`.
  - “Hoy” usa `getLocalDateString`. Semana / mes / año / personalizado parsean `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC).
  - “En Consulta” = solo `consultorio1`–`5` (no `rayosx` / `quirofano`). “Atendidos” = `terminado`.
  - Chart.js de tiempo de espera (`horaLlegada` vs `horaFinalizacion` o `horaAtencion`) y gráficos por personal/servicio. Semana = domingo–sábado.
  - Click en `#estadisticasBtn` (sidebar): `onclick` pinta el periodo; el listener de `index.js` **200 ms después** llama `renderizarGraficos*(tickets)` con **todos** los tickets. Los canvas no respetan el periodo. Los números de las tarjetas sí (se escriben antes).
  - `#filtroPersonal` / `#filtroServicio` no existen en el HTML; no hay filtro de médico/servicio en la UI.
- **Ediciones**: historial `ticket_edits` (paginado, 25) — sección en HTML, **sin entrada de menú**. Join por `id` visual diario; la columna Factura del `<thead>` no se pinta en las filas. `orderByChild('fecha')` necesita índice RTDB.
- **Respaldo / limpieza**: ver [runbook.md](runbook.md). `backupData` no llama `hasPermission`.

`adminUsersBtn` abre el modal de alta de usuarios; la lógica está en `admin-users.js` (ausente). Roles del `<select>`: `recepcion`, `consulta_externa`, `quirofano`, `internos`, `visitas`.

---

## Consentimientos

UI en `consentimientosSection`: búsqueda de cliente + plantillas (`anestesia`, `cirugia`, `emergencias`, `internamiento`, `transfusion`, `cesarea`, `eutanasia`, `alta_voluntaria`) cargadas en un iframe. El módulo `consentimientos-module.js` no está en el repo; la sección se muestra para todos los roles salvo `visitas`.

Un listener al final de `index.js` busca `#btn-consentimientos-container` / `#btn-consentimientos`. Esos ids **no están** en el HTML; el menú real usa `#consentimientosBtn`.
