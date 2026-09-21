# Runbook operativo y desarrollo

## Backup de consultas

Botón “Generar respaldo” (`backupData` en `index.js`):

- Descarga `backup_veterinaria_YYYY-MM-DD.json`.
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

### Tickets desaparecidos al recargar

`loadTickets` **elimina** nodos de `tickets` sin `id` y `mascota`. No guardar stubs. Backups incompletos reimportados así se auto-destruyen.

Tickets **con** `id`+`mascota` pero **sin** `fechaConsulta` no se borran, pero **no aparecen** en Ver Consultas (todos los filtros exigen ese campo). Sí pueden verse en Horario (fallback UTC de `fecha`). Completar `fechaConsulta` o filtrar en Horario.

`child_changed` no inserta keys nuevas. Un ticket que se podó y luego se editó en Firebase no vuelve hasta F5.

### Laboratorio no aparece en el menú

Rol fuera de `admin | consulta_externa | internos | quirofano | laboratorio`. `recepcion` y `visitas` no ven el módulo.

Si el rol ve el menú pero no una lista/hoja legacy, revisar las [allowlists distintas](architecture.md#allowlists-de-laboratorio-no-coinciden).

Si el menú falta **y** hay `PERMISSIONS is not defined`, el throw de `applyRoleBasedUI` cortó la visibilidad.

### “Sistema de laboratorio no disponible”

`initLaboratorioSystem` no está en el scope (script `laboratorio.js` no cargó) o `hasLabAccess()` es falso. Si `window.database` es null, el init retorna sin listeners.

### Búsqueda de clientes lab vacía / “Cargando datos…” / empty state roto

`initLaboratorioSystem` llama `setupLabEventListeners` → `setupExamenRegaliaAndFirma()`. Esa función **no está** en este repo. Si lanza, el `catch` de init **omite** `setupClientesDataListener` y el índice `clientesData` queda vacío.

El botón “recargar” llama `forceReloadClientesData()`, **indefinida** aquí. La función real se llama `forceUpdateClientesData()`. Desde consola: `forceUpdateClientesData()`. El fallback interno usa `window.database.ref('tickets').once`.

La búsqueda exige `#labFechaFiltro` y una consulta ese día en `cliente.consultas`. Dos causas extra de “cero resultados” aunque el cliente exista:

1. `addClienteFromTicket` (listener `child_added` / `child_changed`, **después** del `value`) **borra** `consultas`. Tras crear o editar una consulta, ese cliente no pasa el filtro de fecha hasta el próximo rebuild por `value`.
2. `consultas[].fecha` se llena con `fechaConsulta || fecha`. `fecha` es ISO; el filtro es `YYYY-MM-DD`. Tickets viejos sin `fechaConsulta` no matchean.

Si hay datos pero **cero** matches, `displaySearchResults` usa `${query}` (variable inexistente) y lanza `ReferenceError`. El empty state no se pinta. “Diagnosticar” llama `diagnoseLaboratorySearch()`, tampoco definida aquí.

### Tras elegir un cliente lab, las razas son de perro

`selectCliente` asigna `labTipoMascota` sin disparar `change`. `updateRazasSelect` no corre. Cambiar el tipo a mano (o volver a “Perro” y al tipo real) recarga `razasFelinas` / `razasOtras`.

### Catálogo de servicios vacío

`SERVICIOS_LABORATORIO` sale de `services-data.js`. Sin ese archivo, `getAllServices()` lanza al enumerar `Object.keys`.

### Checkbox de servicio lab no guarda (admin)

La UI muestra el checkbox a `admin` y `laboratorio`; el handler solo acepta `laboratorio`. Usar una cuenta con rol `laboratorio` para marcar `realizado`.

### Factura de lab no llega a la consulta

`syncLabFacturaToConsultaByClienteData` depende de `window.updateConsultaTicketFactura`, no definido en este repo. Mientras tanto, copiar el número a mano en la consulta.

### Filtro de fecha en lab “no funciona”

Diseño actual: la fecha solo recorta `reportado_cliente` y `cliente_no_contesta`. El resto de colas muestra el histórico completo. El input ni siquiera se muestra en las otras colas.

Si el ticket se reportó **desde el modal de edición**, no tiene `fechaReportado` / `fechaReportadoCliente` (solo `changeLabStatus` las escribe, y no se llama). Esos tickets no entran en el recorte por fecha aunque el estado sea el correcto.

### Ver Lab muestra “Todos” / “Pendiente” pero el botón activo es otro

`showLabSection('verLabSection')` pinta el filtro por defecto y **no** actualiza `.lab-filter-btn.active`. Volver a pulsar el filtro deseado.

Los números de stats de abajo no siguen el filtro: son totales de `labTickets`.

### Click en “Por reportar al cliente” no filtra

El handler usa `e.target.getAttribute('data-filter')`. Ese botón tiene un `<br>` y texto en más de un nodo. Click en el texto o el salto no hereda `data-filter`. Pulsar el borde/padding del botón (el elemento con la clase) sí.

### Abrir un ticket lab no carga servicios / lanza en consola

`editLabTicket` llama `setupEditExamenRegaliaAndFirma(ticket)` (ausente aquí) **antes** de `initEditServiceSelection`. Si lanza, el catálogo de edición no se inicializa. El submit ya está enganchado: se puede guardar con `selectedServices` residual del alta. Recuperar esa función o envolverla en `typeof === 'function'`.

### Filtro “Urgentes” vacío

`renderTickets('urgentes')` busca `urgencia === 'alta'`. El formulario guarda `emergencia` / `urgencia` / `leve` / `consulta` / `prequirurgico`. El botón de ese filtro no está en el HTML base (sí `todos`, `espera`, `consultorio`, `terminado`, `porFacturar`).

### No encuentro un cliente por cédula en sala de espera

`#ticketSearchInput` no incluye `cedula`. Buscar por nombre, mascota, ID paciente o factura. La cédula sí entra en la búsqueda de **laboratorio**.

### Cambio de estado no registra hora de atención

El camino vivo es el modal de edición, no `changeStatus` (sin callers). `saveEditedTicket` solo escribe `horaAtencion` en el tránsito `espera` → `consultorio1`–`5`. Pasar a `rayosx` / `quirofano`, o a consultorio desde otro estado, deja el campo vacío. El input del modal es `disabled` y su preview no se envía.

“Terminar Consulta” sí rellena `horaFinalizacion` y, si faltaba, `horaAtencion`.

`changeStatus` (solo consola) sí fuerza el filtro Terminados en estados que no son fin de consulta, y no cierra el modal en `terminado` / `cliente_se_fue`.

### `consulta_externa` ve “Límite de ediciones alcanzado”

Tras 7 guardados de ese rol (`editCount`). El submit del modal se deshabilita entero. El límite no se resetea en la UI.

### Horas de espera en cero / “En Consulta” bajo

El gráfico usa `horaLlegada` y (`horaFinalizacion` o `horaAtencion`) como `HH:MM` locales. Tickets sin esas marcas no entran (típico si se movió a rayos/quirófano o a consultorio sin venir de `espera`). Cruce de midnight da negativo y se descarta (`tiempoTotal >= 0`). Periodos distintos de “hoy” parsean `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC). Chart.js viene **sin pin**; un breaking change del CDN puede tumbar los canvas.

`#pacientesConsulta` no cuenta `rayosx` ni `quirofano`. Esos pacientes siguen en el filtro de sala “En Consultorio”.

### Export CSV / mes sin permiso

El CSV usa `;` y BOM UTF-8 (Excel). Abrirlo con coma como separador parte mal las columnas.

`exportarMes` **no** llama `hasPermission('canExportData')`. El botón de mes es visible para admin (clase `admin-only` / export controls). Un rol con horario visible pero sin export no debería llegar al botón; si el HTML se muestra, el mes igual descarga.

El mes clasifica con `new Date('YYYY-MM-DD')` (UTC). Un ticket del día 1 en Costa Rica puede caer en el mes anterior.

### Exportar a Google Sheets

Placeholder: abre `https://docs.google.com/spreadsheets`. No hay API configurada.

### Historial de ediciones no aparece en el menú / columnas raras / cliente equivocado

`#edicionesSection` está en el HTML. No hay `#edicionesBtn` en el sidebar. Para verlo: `navigateToSection('edicionesSection', 'verTicketsBtn'); cargarHistorialEdiciones();` en consola (o quitar `hidden` a mano).

La cabecera tiene columna Factura; las filas no la pintan (8 celdas vs 9 headers). El join con `tickets` es por `id` visual del día: un edit viejo del #3 puede mostrar el paciente del #3 de hoy. El historial del modal de edición (admin) une por `randomId` y es el fiable. `ticket_edits.fecha` se guarda en UTC (`toISOString()`), no con `getLocalDateString`.

### Hojas `lab_sheets` mezclan días

`openLabSheetModal` escribe `lab_sheets/{ticket.id}`. `id` se reinicia cada día: la hoja del ticket #3 de hoy pisa la del #3 de ayer. En este checkout **nadie llama** esa función (ni hay `#labSheetBtn`).

El botón Eliminar de esa hoja mira un `userRole` global, no `sessionStorage`. Si no hay global, el botón no se pinta aunque el usuario sea admin.

`window.ticketsRef` no se asigna: el refresh “en vivo” de `renderLabResults` nunca se suscribe.

### Consentimientos / usuarios / logo / `lab.js` rotos

Módulos y assets no versionados: `consentimientos-module.js`, `consentimientos.css`, `debug-consentimientos.js`, `admin-users.js`, `empresa.jpg`, `lab.js`.

### Modal de usuarios no crea admin ni laboratorio

El `<select id="newUserRole">` solo lista `recepcion`, `consulta_externa`, `quirofano`, `internos`, `visitas`. Crear `admin` / `laboratorio` implica editar Firebase (o el JS ausente) a mano.

## Qué no inventar al operar Firebase

- No borrar a ciegas `tickets`: la app ya poda incompletos.
- No usar `id` como clave primaria (se repite cada día). Preferir la key de Firebase o `randomId`. `cargarHistorialEdiciones` aún une por `id`; no fiarse de cliente/mascota en esa tabla.
- No escribir `firebaseKey` dentro del nodo (es metadato de cliente).
- `lab_tickets` y `tickets` son árboles distintos; unirse por `cedula` / `idPaciente`, no por `id`.
- No asumir que “Limpiar datos antiguos” borra nada: hoy solo muestra un alert.
- No inventar el mapa `PERMISSIONS` ni el contenido de `firebase-config.js`: no están en este repo.
- No tratar `sessionStorage.userRole` como control de servidor: en este checkout la UI decide visibilidad; las reglas de RTDB no están versionadas.

## Checklist de developer al completar el checkout

1. Recuperar los JS/HTML/CSS/imagen listados en el [README](../README.md), incluido `lab.js`, `debug-consentimientos.js` y los parches que definen `setupExamenRegaliaAndFirma` / `setupEditExamenRegaliaAndFirma` / `forceReloadClientesData` / `diagnoseLaboratorySearch`.
2. Confirmar que `firebase-config.js` no se commitea con secretos innecesarios en branches públicas; las reglas de RTDB deben impedir lecturas anónimas.
3. Verificar en consola: `firebase.apps.length`, `window.database`, `typeof hasPermission`, `typeof PERMISSIONS`, `typeof SERVICIOS_LABORATORIO`, `typeof setupExamenRegaliaAndFirma`, `typeof setupEditExamenRegaliaAndFirma`, `typeof forceUpdateClientesData`.
4. Probar un ciclo: login → crear consulta (espera) → click tarjeta → `#editEstado` a consultorio → guardar (comprobar `horaAtencion` y que el filtro de sala no salta a Terminados) → Terminar Consulta → crear lab desde el mismo cliente (fecha = `#labFechaFiltro`) → si el paciente no es perro, refrescar razas a mano → marcar servicio con rol `laboratorio` → editar el ticket lab a `reportado` y comprobar que **no** aparecen `fechaReportado*`.
5. Confirmar que una búsqueda lab sin matches no tira `ReferenceError` en consola (empty state de `query`). Recargar clientes con `forceUpdateClientesData()`, no con el botón que llama `forceReloadClientesData`.
6. Confirmar que buscar por cédula en sala de espera no encuentra nada (esperado) y que sí funciona en lab.
7. Tras editar una consulta, repetir la búsqueda lab del mismo cliente el mismo día; si desaparece, es el overwrite de `addClienteFromTicket`.
8. En Ver Lab, pulsar el texto de “Por reportar al cliente” y luego el padding del botón: solo el segundo debe filtrar.
