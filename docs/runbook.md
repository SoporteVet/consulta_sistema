# Runbook operativo y desarrollo

## Backup de consultas

Botón “Generar respaldo” (`backupData` en `index.js`):

- Descarga `backup_veterinaria_YYYY-MM-DD.json`. El día del nombre sale de `toISOString()` (**UTC**), no de `getLocalDateString()`. En Costa Rica (UTC−6) un respaldo de noche puede llevar la fecha del día siguiente; de madrugada, la del día anterior.
- Contenido: `{ tickets, currentTicketId, timestamp, version: '1.0' }`.
- Cada ticket **sin** `firebaseKey`.
- **No** incluye `lab_tickets`, `ticket_edits` ni `lab_sheets`.
- **No** llama `hasPermission`. El botón está en un bloque `admin-only` del HTML.

No hay restore en la app. Restaurar implica reescribir Firebase a mano (o un script externo). Un `push` masivo regeneraría keys y duplicaría `id` visuales.

## Limpieza de consultas antiguas

Hay **dos** declaraciones `function cleanOldData()` en `index.js`:

1. ~L2061: pide confirmación y borra `tickets` con `estado === 'terminado'` cuya `ticket.fecha` (ISO de **creación**, no `fechaConsulta`) tiene más de **3 meses**. No toca lab, ediciones ni `cliente_se_fue`.
2. ~L3887: `alert('Función de limpieza no implementada.')`.

En JS gana la **última** declaración. El botón “Limpiar datos antiguos” (`#cleanDataBtn`) ejecuta el alert. El borrado de 3 meses **no corre** con el código actual.

`fixDuplicateTicketIds()` reasigna `id` globalmente cuando hay duplicados (no es por día). No hay botón en el HTML; llamarla a mano puede romper la numeración diaria.

## Contador visual de tickets

`id` de consulta es `max(id del día) + 1`. `settings.currentTicketId` se lee/escribe en `loadTickets` como máximo **global**. El alta usa el cálculo por día. Si settings es menor que el max global, `loadTickets` lo sobrescribe; el `DOMContentLoaded` posterior vuelve a poner `currentTicketId` al max del día.

## Fallos frecuentes

### Página en blanco / redirect infinito a `home.html`

`index.html` exige `home.html`, `firebase-config.js` y `auth.js`. Si faltan, el arranque falla o `initAuth` / `checkAuth` redirigen. Comprobar Network y que Firebase Auth tenga un usuario persistido.

`initAuth` no rechaza la Promise cuando no hay user: solo redirige. Si el redirect no ocurre (p. ej. `home.html` 404), el `then` de `loadTickets` nunca corre.

Si `auth.js` no define `PERMISSIONS`, `applyRoleBasedUI` lanza en `JSON.stringify(PERMISSIONS.admin)` **antes** de mostrar lab, consentimientos o enganchar logout. En consola: `PERMISSIONS is not defined`.

### `ticketsRef is not defined` / `Error con la base de datos`

`addTicket` y `loadTickets` usan el global `ticketsRef`. Debe asignarse al inicializar Firebase. Laboratorio usa `window.database`; si solo existe uno de los dos, un módulo vive y el otro no.

Un script ausente **no** detiene los siguientes. El error aparece al usar el global, no en el 404.

El checkbox “Listo para facturar” escribe con `firebase.database().ref('tickets')`, no con `ticketsRef`. Puede guardar aunque el alias falle.

### Tickets desaparecidos al recargar

`loadTickets` **elimina** nodos de `tickets` sin `id` y `mascota`. No guardar stubs. Backups incompletos reimportados así se auto-destruyen.

Tickets **con** `id`+`mascota` pero **sin** `fechaConsulta` no se borran, pero **no aparecen** en Ver Consultas (todos los filtros exigen ese campo). Sí pueden verse en Horario (fallback UTC de `fecha`). Completar `fechaConsulta` o filtrar en Horario.

`child_changed` no inserta keys nuevas. Un ticket que se podó y luego se editó en Firebase no vuelve hasta F5.

### Laboratorio no aparece en el menú

Rol fuera de `admin | consulta_externa | internos | quirofano | laboratorio`. `recepcion` y `visitas` no ven el módulo.

Si el rol ve el menú pero no una lista/hoja legacy, revisar las [allowlists distintas](architecture.md#allowlists-de-laboratorio-no-coinciden).

Si el menú falta **y** hay `PERMISSIONS is not defined`, el throw de `applyRoleBasedUI` cortó la visibilidad.

Horario / Estadísticas tampoco aparecen para no-admin: el padre `#administrativoCategory` es `admin-only`, aunque `canViewSchedule` / `canViewStats` sean true.

### “Sistema de laboratorio no disponible”

`initLaboratorioSystem` no está en el scope (script `laboratorio.js` no cargó) o `hasLabAccess()` es falso. Si `window.database` es null, el init retorna sin listeners.

### Búsqueda de clientes lab vacía / “Cargando datos…” / empty state roto

`initLaboratorioSystem` llama `setupLabEventListeners` → `setupExamenRegaliaAndFirma()`. Esa función **no está** en este repo. Si lanza, el `catch` de init **omite** `setupClientesDataListener` y el índice `clientesData` queda vacío.

El botón “recargar” llama `forceReloadClientesData()`, **indefinida** aquí. La función real se llama `forceUpdateClientesData()`. Desde consola: `forceUpdateClientesData()`. El fallback interno usa `window.database.ref('tickets').once`.

La búsqueda exige `#labFechaFiltro` y una consulta ese día en `cliente.consultas`. Causas extra de “cero resultados” aunque el cliente exista:

1. `addClienteFromTicket` (listener `child_added` / `child_changed`, **después** del `value`) **borra** `consultas`. Tras crear o editar una consulta, ese cliente no pasa el filtro de fecha hasta el próximo rebuild por `value` (entonces se dispara `clientesDataUpdated` y, si el input tiene ≥2 chars, se relanza **dos veces**: inmediato + 300 ms). El match es `cedula` **o** `idPaciente`: una cédula vacía puede pisar la fila de otro cliente.
2. `consultas[].fecha` se llena con `fechaConsulta || fecha`. `fecha` es ISO; el filtro es `YYYY-MM-DD`. Tickets viejos sin `fechaConsulta` no matchean.
3. `ultimaActualizacion` no es la fecha del ticket: el rebuild la sella con `Date.now()`. No usar el punto “reciente” ni el orden como señal de “última visita”.

Si hay datos pero **cero** matches, `displaySearchResults` usa `${query}` (variable inexistente) y lanza `ReferenceError`. El empty state no se pinta. “Diagnosticar” llama `diagnoseLaboratorySearch()`, tampoco definida aquí.

`loadClientesData()` vuelve a registrar listeners. No llamarla en consola “para recargar”: duplica `value` / `child_*`. Usar `forceUpdateClientesData()`.

### Enter en la búsqueda lab no elige el primer cliente

`selectedIndex` empieza en `-1`. El primer resultado **se ve** seleccionado (`.keyboard-selected` / `.first-result`); Enter igual no lo toma. Flecha abajo (pasa a índice 0) y luego Enter, o click. Debounce del input: 200 ms. Cambiar `#labFechaFiltro` relanza enseguida. No es un fallo de datos.

### La fecha del ticket lab se ve un día antes / sale `05T15:00:00.000Z/10/2026`

En la SPA combinada **no** corre el `formatDate` de `laboratorio.js` (UTC). Gana el de `index.js` (split `-`, sin `Date`): [architecture.md](architecture.md#colisión-de-nombres-globales-formatdate-getestadolabel).

- Etiqueta `YYYY-MM-DD` (alta lab, `#labFechaFiltro`, `ticket.fecha` de servicio): día **correcto**. Si ves un día menos, `index.js` no cargó o un `lab.js` recuperado redefinió `formatDate`.
- Etiqueta tipo `05T15:00:00.000Z/10/2026` en el historial de búsqueda lab: `consultas[].fecha` es el ISO de `ticket.fecha` (consulta sin `fechaConsulta`). Completar `fechaConsulta` en el nodo; no restar un día a mano.
- Valor persistido (`ticket.fecha`, `#labFechaFiltro`) no se toca al pintar. No “corregir” restando un día.

### El médico del filtro lab no encuentra el ticket que acabo de editar

El modal de edición es texto libre (`#editLabMedico`). El filtro es `includes` contra las opciones del `<select>`. Si el nombre no coincide (typo, tilde, orden), el ticket desaparece de `reportado` / `reportado_cliente` / `cliente_no_contesta` con médico activo. Reescribir el nombre igual que en el filtro, o vaciar `#labMedicoFilter`.

### Desmarcar y volver a marcar un servicio lab perdió el check “realizado”

`toggleEditServiceSelection` reinserta el objeto del catálogo, sin `realizado`. Volver a marcar el checkbox del servicio en la tarjeta (rol `laboratorio`) o setear `realizado: true` en Firebase.

### El catálogo de edición no se marca / se marca el de Crear Lab

`querySelector('[data-service-id]')` toma el primer nodo (el grid de alta, aunque esté `hidden`). El modal y el alta comparten ids. Tratarlo como bug de UI: el array `selectedServices` es el que se guarda.

### Borré un ticket lab desde consola sin ser admin

`deleteLabTicket` / `confirmDeleteLabTicket` no miran el rol. El botón solo se oculta en la tarjeta. Las reglas RTDB (ausentes aquí) son el único freno real.

### Desapareció “Administrar usuarios” / el botón no aparece

`#adminUsersBtn` es `admin-btn` con `style="display:none"`. `applyRoleBasedUI` solo muestra `.admin-only`. Con el checkout actual el botón **nunca** se enciende (el JS ausente `admin-users.js` es el que se esperaría que lo hiciera).

El modal `#adminUsersModal` ya está en el HTML con clase `edit-modal`. `closeModal()` toma el **primer** `.edit-modal` y a los 300 ms lo `remove()`. `editTicket` (consulta) llama `closeModal()` al montar → el de usuarios se borra. `editLabTicket` no: el **primer** Cancelar del lab cierra usuarios y deja el formulario; el segundo sí cierra lab. Tras un `closeModal` efectivo hace falta F5 para recuperar el alta de usuarios.

Mientras ese modal siga en el árbol, `querySelector('.btn-save')` es el “Crear usuario” oculto: el spinner de Guardar de la consulta/lab no se ve.

### Lista y Espera quedan los dos marcados / no puedo editar desde Lista

El chip Lista se inyecta tarde; los chips del HTML no le quitan `active`. Pulsar Espera/Todos/etc. después de Lista deja dos botones pintados. `child_added` y Guardar leen el **primer** `.filter-btn.active` del DOM (casi nunca Lista). Para editar: volver a tarjetas (Espera/Todos) y click en la tarjeta. Las filas de Lista no tienen handler. Recalcar Lista limpia los otros chips.

### Cambié la fecha en el modal y el ticket “desapareció” de hoy

Esperado: `#editFecha` se persiste como `fechaConsulta`. Ver Consultas filtra solo ese campo contra `#filterDate`. Poner `#filterDate` (o Horario) en el día nuevo, o devolver la fecha original.

### El alta lab guardó otra fecha que la de la búsqueda

`#labFechaFiltro` recorta clientes; `#labFecha` es la fecha de servicio. Alinearlos a mano antes de enviar, o aceptar que el ticket quede con `fecha` ≠ día de la consulta.

### Quedó un modal lab/consulta tapando la pantalla

`closeModal` marca el **primer** `.edit-modal` con `modal-closing` y lo `remove()` a los 300 ms. Ese primero suele ser `#adminUsersModal` (oculto) si nadie lo ha borrado: Cancelar en el **primer** editor lab “no hace nada” (cerró el de usuarios). Abrir otro editor/confirm en la ventana de 300 ms deja dos nodos. En consola: `document.querySelectorAll('.edit-modal').forEach(m => m.remove())` (también elimina el de usuarios).

Si un admin abrió una consulta y pulsó Cancelar, `ticket_edits` puede seguir con `on('value')` (`window._ticketEdicionesListener`). En consola: `firebase.database().ref('ticket_edits').off('value', window._ticketEdicionesListener)`.

### El modal de edición sale en blanco / los campos no se pueden guardar

`editTicket` mete `nombre`, `mascota`, `motivo`, etc. en `innerHTML` sin escape. Una comilla (`O'Connor`, `José "Pepe"`) rompe el atributo `value`. Markup en motivo se interpreta. Cerrar con F5 (o el snippet de `.edit-modal` de arriba) y editar el nodo en Firebase, o quitar las comillas del nombre a mano. Horario y tarjetas lab interpolan igual: un `<` en observaciones se vuelve HTML.

### Estadísticas “Personalizado” muestra todo el histórico

El `<select id="filtroPeriodoGlobal">` llama `updateStatsGlobal()` al cambiar. Sin `#fechaInicioEstadisticasGlobal` y `#fechaFinEstadisticasGlobal`, `filtrarTicketsPorPeriodoGlobal` hace `return tickets`. El botón “Aplicar filtros” sí valida, pero los números/canvas ya se pintaron. Elegir las dos fechas (cada `change` vuelve a pintar; con una sola fecha sigue el array completo) o volver a “Hoy”. Esto se suma al overwrite de canvas del sidebar (~200 ms, array completo).

### Tras elegir un cliente lab, faltan raza / peso / contacto

`selectCliente` asigna `labTipoMascota` sin disparar `change`. `updateRazasSelect` no corre. Tampoco copia edad, peso, sexo, correo ni teléfono (el índice no los guarda). Completar esos campos a mano. Cambiar el tipo (o volver a “Perro” y al tipo real) recarga `razasFelinas` / `razasOtras`.

### Catálogo de servicios vacío

`SERVICIOS_LABORATORIO` sale de `services-data.js`. Sin ese archivo, `getAllServices()` lanza al enumerar `Object.keys`.

### Crear Lab trae servicios de otro ticket

`selectedServices` es global. Abrir un ticket lab (`initEditServiceSelection`) pisa el array. Cerrar el modal no lo restaura. Volver a Crear Ticket Lab llama `initServiceSelection`, que **no** vacía el array: checkboxes y total muestran los servicios del ticket editado. Quitarlos a mano o enviar un alta dummy que pase por `resetLabForm`, o en consola: `selectedServices = [];` y reabrir Crear Lab.

### Checkbox de servicio lab no guarda (admin)

La UI muestra el checkbox a `admin` y `laboratorio`; el handler solo acepta `laboratorio`. Usar una cuenta con rol `laboratorio` para marcar `realizado`.

### Factura de lab no llega a la consulta

En el **alta**, no hay listener: `setupLabFacturaSyncForCreate` nunca se llama. Copiar el número a mano en la consulta.

En **edición**, `setupLabFacturaSyncForEdit` espera `window.syncFacturaBetweenSystems`, no definido en este repo. Mismo workaround.

### Edité los servicios de un ticket lab y el total / nombres no cambian

`saveEditedLabTicket` persiste `serviciosSeleccionados` y deja `serviciosIds`, `serviciosNombres` y `totalServicios` como en el alta. Cualquier lector de esos campos denormalizados (fuera de la tarjeta, que usa `serviciosSeleccionados`) verá datos viejos. Recalcularlos a mano en Firebase o alinear el save.

### Filtro de fecha en lab “no funciona”

Diseño actual: la fecha solo recorta `reportado_cliente` y `cliente_no_contesta`. El resto de colas muestra el histórico completo. El input ni siquiera se muestra en las otras colas.

Si el ticket se reportó **desde el modal de edición**, no tiene `fechaReportado` / `fechaReportadoCliente` (solo `changeLabStatus` las escribe, y no se llama). Esos tickets no entran en el recorte por fecha aunque el estado sea el correcto.

### Ver Lab muestra “Todos” / “Pendiente” pero el botón activo es otro

`showLabSection('verLabSection')` pinta el filtro por defecto y **no** actualiza `.lab-filter-btn.active`. Volver a pulsar el filtro deseado.

Los números de stats de abajo no siguen el filtro: son totales de `labTickets`.

Cambiar de chip **borra** el médico seleccionado en `#labMedicoFilter`.

`#labSearchInput` solo oculta tarjetas ya pintadas. Un re-render (otro filtro, un `value` de `lab_tickets`) las vuelve a mostrar todas aunque el input tenga texto. Volver a teclear.

### Click en “Por reportar al cliente” no filtra

El handler usa `e.target.getAttribute('data-filter')` y `e.target.classList.add('active')`. Ese botón tiene un `<br>` y texto en más de un nodo. Click en el texto o el salto no hereda `data-filter` y puede dejar `active` en el `<br>`. Pulsar el borde/padding del botón (el elemento con la clase) sí.

### Abrir un ticket lab no carga servicios / lanza en consola

`editLabTicket` llama `setupEditExamenRegaliaAndFirma(ticket)` (ausente aquí) **antes** de `initEditServiceSelection`. Si lanza, el catálogo de edición no se inicializa. El submit ya está enganchado: se puede guardar con `selectedServices` residual del alta. Recuperar esa función o envolverla en `typeof === 'function'`.

### Filtro “Urgentes” vacío

`renderTickets('urgentes')` busca `urgencia === 'alta'`. El formulario guarda `emergencia` / `urgencia` / `leve` / `consulta` / `prequirurgico`. El botón de ese filtro no está en el HTML base (sí `todos`, `espera`, `consultorio`, `terminado`, `porFacturar`).

### No encuentro un cliente por cédula en sala de espera

`#ticketSearchInput` no incluye `cedula`. Buscar por nombre, mascota, ID paciente o factura. La cédula sí entra en la búsqueda de **laboratorio**.

### Visitas ve nombre del dueño / médico / ID

Esperado. Sin `canViewFullTicket` la tarjeta **no** es anónima: oculta cédula, motivo de consulta, factura y por cobrar, pero pinta nombre, médico, ID paciente, motivo de llegada y horas. El click no abre el editor.

### Cambio de estado no registra hora de atención

El camino vivo es el modal de edición, no `changeStatus` (sin callers). `saveEditedTicket` solo escribe `horaAtencion` en el tránsito `espera` → `consultorio1`–`5`. Pasar a `rayosx` / `quirofano`, o a consultorio desde otro estado, deja el campo vacío.

El input de hora de atención del modal **no tiene `id`**. El listener de `#editEstado` busca `#editHoraAtencion` y no corre: no hay preview. El valor que se persiste sale de `ticket.horaAtencion` en memoria + la regla `espera` → `consultorio*`.

“Terminar Consulta” sí rellena `horaFinalizacion` y, si faltaba, `horaAtencion`.

`changeStatus` (solo consola) sí fuerza el filtro Terminados en estados que no son fin de consulta, y no cierra el modal en `terminado` / `cliente_se_fue`.

### Cambié la hora de cita en el modal y no se guardó

`#editHora` se pinta para `admin` / `recepción` / `quirofano` y **no se lee** en el submit. `saveEditedTicket` hace `update` sin `horaConsulta`, así que Firebase conserva el valor viejo. Para cambiar la cita hay que editar el nodo a mano o crear de nuevo.

### Al editar a un paciente de Gustavo se pierde el doctor

Alta y lab guardan `Dr. Gustavo Gonzalez`. El modal ofrece `Dr. Gustavo González`. El `<select>` no preselecciona. Guardar sin volver a elegir al doctor escribe solo el técnico (o vacío). Reelegir el nombre **con tilde** en el modal, o alinear las tres listas.

El mismo síntoma con **Jimena**: el alta guarda `Tec. Jimena Urtecho` (un espacio). El modal compara contra `"Tec.  Jimena Urtecho"` (dos). No queda `selected`. Reelegirla en el `<select>` (el `value` sí tiene un espacio) y guardar.

### Un rol sin `canEditTickets` igual cambia la consulta

Esperado con el código actual. `editTicket` no mira esa flag. Click en la tarjeta o el lápiz de Horario abre el modal. `canEditTickets` solo muestra el textarea “Por cobrar”. Para impedir edición hay que ocultar la UI o endurecer reglas RTDB (no están en este repo).

### `consulta_externa` sigue marcando “Listo para facturar” con el límite alcanzado

El checkbox escribe al cambiar y no toca `editCount`. El tope de 7 solo deshabilita Guardar. Deshacer el flag implica volver a pulsar el checkbox o editar el nodo a mano.

### “Por Facturar” llena de tickets que aún están en sala

El filtro no exige `terminado`. Cualquier ticket del día sin `numFactura` y sin `sinCosto` entra, incluido espera/consultorio. No es un fallo de datos.

### Creé una consulta ya “Terminada” y no tiene hora de fin

El `<select>` de alta incluye `terminado`. `addTicket` no sella `horaFinalizacion`. El gráfico de espera la ignora. Poner el estado en `espera`/`consultorio*` al crear, o escribir `horaFinalizacion` a mano.

### Ediciones: sección vacía aunque quite `hidden`

`navigateToSection('edicionesSection')` no llama `cargarHistorialEdiciones()`. Después de mostrar la sección: `cargarHistorialEdiciones();` o pulsar “Aplicar filtros” / una página.

### `consulta_externa` ve “Límite de ediciones alcanzado”

Tras 7 guardados de ese rol (`editCount`), incluido un save sin cambios. El submit del modal se deshabilita entero. El límite no se resetea en la UI.

### Horas de espera en cero / “En Consulta” bajo / gráficos que no respetan el periodo

El gráfico usa `horaLlegada` y (`horaFinalizacion` o `horaAtencion`) como `HH:MM` locales. Tickets sin esas marcas no entran (típico si se movió a rayos/quirófano o a consultorio sin venir de `espera`). Cruce de midnight da negativo y se descarta (`tiempoTotal >= 0`). Periodos distintos de “hoy” parsean `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC). Chart.js viene **sin pin**; un breaking change del CDN puede tumbar los canvas.

`#pacientesConsulta` no cuenta `rayosx` ni `quirofano`. Esos pacientes siguen en el filtro de sala “En Consultorio”.

El gráfico de espera, además, usa `horaFinalizacion` cuando existe: el número **no** es solo cola (llegada → atención), es llegada → fin de consulta.

Al abrir Estadísticas desde el sidebar, los **números** de las tarjetas sí usan el periodo (`updateStatsGlobal`). Los **canvas** se vuelven a pintar ~200 ms después con `tickets` completo (handler duplicado). El mismo overwrite ocurre en cada `child_added` / `child_changed` / `child_removed` mientras la sección está `active`. Para ver gráficos del periodo, llamar `updateStatsGlobal()` en consola **después** de ese timeout / del último cambio en vivo, o no usar el botón del menú.

`#filtroPersonal` / `#filtroServicio` no están en el HTML: no hay filtro de médico/servicio que ajustar.

### Export CSV / mes sin permiso

El CSV usa `;` y BOM UTF-8 (Excel). Abrirlo con coma como separador parte mal las columnas.

`exportarMes` **no** llama `hasPermission('canExportData')`. El botón de mes es visible para admin (clase `admin-only` / export controls). Un rol con horario visible pero sin export no debería llegar al botón; si el HTML se muestra, el mes igual descarga.

El mes clasifica con `new Date('YYYY-MM-DD')` (UTC). Un ticket del día 1 en Costa Rica puede caer en el mes anterior.

### Exportar a Google Sheets

Placeholder: abre `https://docs.google.com/spreadsheets`. No hay API configurada.

### Historial de ediciones no aparece en el menú / columnas raras / cliente equivocado

`#edicionesSection` está en el HTML. No hay `#edicionesBtn` en el sidebar. Para verlo: `navigateToSection('edicionesSection', 'verTicketsBtn'); cargarHistorialEdiciones();` en consola (o quitar `hidden` a mano).

La cabecera tiene columna Factura; las filas no la pintan (8 celdas vs 9 headers). El join con `tickets` es por `id` visual del día: un edit viejo del #3 puede mostrar el paciente del #3 de hoy. El historial del modal de edición (admin) une por `randomId` y es el fiable, pero escucha `ticket_edits` con `on('value')` sin `orderByChild`: en un nodo grande es lento. `ticket_edits.fecha` se guarda en UTC (`toISOString()`), no con `getLocalDateString`.

`orderByChild('fecha')` (sección Ediciones) necesita `.indexOn: "fecha"` en las reglas de `ticket_edits`. Sin índice, la consola de Firebase avisa y la carga puede ser lenta.

### Hojas `lab_sheets` mezclan días

`openLabSheetModal` escribe `lab_sheets/{ticket.id}`. `id` se reinicia cada día: la hoja del ticket #3 de hoy pisa la del #3 de ayer. En este checkout **nadie llama** esa función (ni hay `#labSheetBtn`).

El botón Eliminar de esa hoja mira un `userRole` global, no `sessionStorage`. Si no hay global, el botón no se pinta aunque el usuario sea admin.

`window.ticketsRef` no se asigna: el refresh “en vivo” de `renderLabResults` nunca se suscribe.

### Consentimientos / usuarios / logo / `lab.js` rotos

Módulos y assets no versionados: `consentimientos-module.js`, `consentimientos.css`, `debug-consentimientos.js`, `admin-users.js`, `empresa.jpg`, `lab.js`.

### Modal de usuarios no crea admin ni laboratorio / el modal ya no está

El `<select id="newUserRole">` solo lista `recepcion`, `consulta_externa`, `quirofano`, `internos`, `visitas`. Crear `admin` / `laboratorio` implica editar Firebase (o el JS ausente) a mano.

Si el modal ni siquiera abre: el botón no se muestra (`admin-btn` + `display:none`) y, si ya se editó un ticket en esta carga, `#adminUsersModal` fue `remove()` por `closeModal`. Ver [Desapareció “Administrar usuarios”](#desapareció-administrar-usuarios--el-botón-no-aparece).

### Por Facturar no excluye un ticket “sin costo”

`sinCosto` solo se lee. Este checkout no tiene checkbox ni writer. Marcar un ticket como sin costo implica setear `sinCosto: true` en Firebase a mano.

## Qué no inventar al operar Firebase

- No borrar a ciegas `tickets`: la app ya poda incompletos.
- No usar `id` como clave primaria (se repite cada día). Preferir la key de Firebase o `randomId`. `cargarHistorialEdiciones` aún une por `id`; no fiarse de cliente/mascota en esa tabla.
- No escribir `firebaseKey` dentro del nodo (es metadato de cliente).
- `lab_tickets` y `tickets` son árboles distintos; unirse por `cedula` / `idPaciente`, no por `id`.
- No asumir que “Limpiar datos antiguos” borra nada: hoy solo muestra un alert.
- No inventar el mapa `PERMISSIONS` ni el contenido de `firebase-config.js`: no están en este repo.
- No tratar `sessionStorage.userRole` como control de servidor: en este checkout la UI decide visibilidad; las reglas de RTDB no están versionadas.
- No asumir que editar `#editHora` cambia `horaConsulta`: el submit no lo envía. `#editFecha` **sí** cambia `fechaConsulta`.
- No tratar `#labFechaFiltro` y `#labFecha` como el mismo campo: uno busca clientes, el otro se persiste.
- No fiarse de que “Administrar usuarios” siga en el DOM después de abrir un ticket: `closeModal` borra `#adminUsersModal`. El botón `#adminUsersBtn` no lo enciende este checkout.
- No asumir que escribir `#labFactura` en el alta copia el número a la consulta: el listener de sync no está enganchado.
- No tratar `serviciosIds` / `totalServicios` como fuente de verdad tras una edición: solo se escriben en el alta.
- No asumir que `canEditTickets === false` bloquea el modal de consulta: solo oculta “Por cobrar”.
- No usar las etiquetas `formatDate` como fuente de verdad del día: en esta SPA el splitter de `index.js` pinta bien `YYYY-MM-DD` y **rompe** timestamps ISO. El sesgo UTC de `laboratorio.js` solo aplica si `index.js` no llegó a cargar.
- No fiarse de que Cancelar suelte listeners de Firebase: el `on('value')` de `ticket_edits` del modal admin sigue hasta la X, otra apertura o F5.
- No tratar el primer resultado lab resaltado como “ya elegido” para Enter.
- No fiarse de `consultas[].medicoAtiene` ni de un match OR cédula/idPaciente en el índice incremental.
- No asumir que una fila de **Lista** abre el editor: no hay click handler; el chip tampoco entra en el NodeList estático `filterBtns`.
- No tratar la tarjeta de `visitas` como anónima: oculta cédula/factura/motivo consulta, no el nombre ni el ID paciente.

## Checklist de developer al completar el checkout

1. Recuperar los JS/HTML/CSS/imagen listados en el [README](../README.md), incluido `lab.js`, `debug-consentimientos.js` y los parches que definen `setupExamenRegaliaAndFirma` / `setupEditExamenRegaliaAndFirma` / `forceReloadClientesData` / `diagnoseLaboratorySearch`.
2. Confirmar que `firebase-config.js` no se commitea con secretos innecesarios en branches públicas; las reglas de RTDB deben impedir lecturas anónimas. Si se usa Ediciones, indexar `ticket_edits.fecha`.
3. Verificar en consola: `firebase.apps.length`, `window.database`, `typeof hasPermission`, `typeof PERMISSIONS`, `typeof SERVICIOS_LABORATORIO`, `typeof setupExamenRegaliaAndFirma`, `typeof setupEditExamenRegaliaAndFirma`, `typeof forceUpdateClientesData`, `typeof setupLabFacturaSyncForCreate`.
4. Probar un ciclo: login → crear consulta (espera) → click tarjeta → `#editEstado` a consultorio → guardar (comprobar `horaAtencion` y que el filtro de sala no salta a Terminados) → cambiar `#editHora` y guardar de nuevo (la cita **no** debe cambiar) → Terminar Consulta → crear lab desde el mismo cliente (fecha = `#labFechaFiltro`) → si el paciente no es perro, refrescar razas a mano → completar peso/sexo/teléfono a mano → marcar servicio con rol `laboratorio` → editar el ticket lab a `reportado` y comprobar que **no** aparecen `fechaReportado*`.
5. Confirmar que una búsqueda lab sin matches no tira `ReferenceError` en consola (empty state de `query`). Recargar clientes con `forceUpdateClientesData()`, no con el botón que llama `forceReloadClientesData`. Enter sin flecha abajo no debe elegir cliente.
6. Confirmar que buscar por cédula en sala de espera no encuentra nada (esperado) y que sí funciona en lab.
7. Tras editar una consulta, repetir la búsqueda lab del mismo cliente el mismo día; si desaparece, es el overwrite de `addClienteFromTicket`.
8. En Ver Lab, pulsar el texto de “Por reportar al cliente” y luego el padding del botón: solo el segundo debe filtrar.
9. Crear una consulta con `Dr. Gustavo Gonzalez` + `Tec. Jimena Urtecho`, abrir el modal y guardar sin tocar personal: médico y Jimena deben desaparecer (bugs actuales). Reelegir `Dr. Gustavo González` y Jimena (un espacio) los reescribe.
10. Abrir Estadísticas, elegir periodo “hoy” y esperar 300 ms: las tarjetas deben ser del día y los canvas del histórico completo. Crear o editar una consulta con Estadísticas abierta: los canvas se vuelven a pintar con todo el histórico. Luego `updateStatsGlobal()` en consola para realinear gráficos. Un ticket **terminado** debe contar espera+consulta, no solo cola. Cambiar el periodo a “Personalizado” **sin** fechas: números y canvas deben pasar a **todo** el histórico; “Aplicar filtros” debe avisar y no pintar hasta tener ambas.
11. Escribir ≥3 caracteres en `#labFactura` del **alta**: no debe haber sync ni toast de factura (función no enganchada). En el modal de edición, el listener sí se registra y pasa `randomId` (no `firebaseKey`).
12. Abrir un ticket lab, cambiar servicios, guardar, y leer el nodo: `serviciosSeleccionados` nuevo, `totalServicios` viejo. Cerrar y abrir Crear Ticket Lab: el catálogo debe salir precargado con esos servicios. Desmarcar/remarcár un servicio en el modal: `realizado` debe perderse.
13. Crear una consulta con estado inicial `terminado`: no debe haber `horaFinalizacion`. Abrir “Por Facturar” con un ticket en espera sin factura: debe aparecer.
14. `navigateToSection('edicionesSection', 'verTicketsBtn')` sin `cargarHistorialEdiciones()`: tabla vacía. Después de llamar la carga, deben salir filas.
15. Con rol ≠ admin, en consola `deleteLabTicket('<randomId>')`: el confirm aparece (no hay guardia JS). No confirmar en datos reales.
16. Crear una consulta con nombre `Test "Comillas"` y abrir el modal: el formulario debe romperse (comilla en `value`). F5 y borrar el nodo de prueba.
17. En Ver Lab, el primer resultado de búsqueda (≥2 chars) debe verse marcado; Enter no lo elige hasta flecha abajo. `formatDate` de una consulta **con** `fechaConsulta` debe ser `DD/MM/YYYY`; una sin `fechaConsulta` (solo ISO) debe verse garbled en el historial del dropdown.
18. Abrir edición de consulta (admin), pulsar Cancelar, y en consola inspeccionar listeners de `ticket_edits`: el `on('value')` sigue. Abrir otro modal y pulsar la X: debe hacer `off`.
19. Click rápido en dos tarjetas de consulta (menos de 300 ms): pueden quedar dos `.edit-modal`; Cancelar una vez puede no cerrar el de arriba.
20. Antes de abrir un ticket, `document.getElementById('adminUsersModal')` debe existir. Tras `editTicket` (consulta) y 300 ms, debe ser `null`. Tras `editLabTicket`, el nodo **sigue** hasta el primer Cancelar; ese Cancelar lo borra y deja el editor lab. `#adminUsersBtn` sigue `display:none` para admin.
21. Inyectar Lista, pulsar Lista y luego Espera: ambos chips `active`. Click en una fila de Lista no abre el modal; click en una tarjeta de Espera sí.
22. Editar `#editFecha` a otro día, guardar: el ticket desaparece de la cola de hoy y aparece en Horario/sala de esa fecha.
23. En Crear Lab, poner `#labFechaFiltro` = hoy y `#labFecha` = mañana, elegir cliente y enviar: `lab_tickets.fecha` es mañana; la búsqueda usó consultas de hoy.
24. `backupData()` de madrugada en CR: el filename puede llevar el `YYYY-MM-DD` UTC del día anterior.
