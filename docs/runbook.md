# Runbook operativo y desarrollo

## Backup de consultas

Botón “Generar respaldo” (`backupData` en `index.js`):

- Descarga `backup_veterinaria_YYYY-MM-DD.json`.
- Contenido: `{ tickets, currentTicketId, timestamp, version: '1.0' }`.
- Cada ticket **sin** `firebaseKey`.
- **No** incluye `lab_tickets`, `ticket_edits` ni `lab_sheets`.

No hay restore en la app. Restaurar implica reescribir Firebase a mano (o un script externo). Un `push` masivo regeneraría keys y duplicaría `id` visuales.

## Limpieza de consultas antiguas

Hay **dos** declaraciones `function cleanOldData()` en `index.js`:

1. ~L2061: pide confirmación y borra `tickets` con `estado === 'terminado'` cuya `ticket.fecha` (ISO de **creación**, no `fechaConsulta`) tiene más de **3 meses**. No toca lab, ediciones ni `cliente_se_fue`.
2. ~L3887: `alert('Función de limpieza no implementada.')`.

En JS gana la **última** declaración. El botón “Limpiar datos antiguos” (`#cleanDataBtn`) ejecuta el alert. El borrado de 3 meses **no corre** con el código actual.

`fixDuplicateTicketIds()` reasigna `id` globalmente cuando hay duplicados (no es por día). No hay botón en el HTML; llamarla a mano puede romper la numeración diaria.

## Contador visual de tickets

`id` de consulta es `max(id del día) + 1`. `settings.currentTicketId` se lee/escribe en `loadTickets` pero el alta usa el cálculo por día, no ese settings de forma exclusiva.

## Fallos frecuentes

### Página en blanco / redirect infinito a `home.html`

`index.html` exige `home.html`, `firebase-config.js` y `auth.js`. Si faltan, el arranque falla o `initAuth` / `checkAuth` redirigen. Comprobar Network y que Firebase Auth tenga un usuario persistido.

`initAuth` no rechaza la Promise cuando no hay user: solo redirige. Si el redirect no ocurre (p. ej. `home.html` 404), el `then` de `loadTickets` nunca corre.

### `ticketsRef is not defined` / `Error con la base de datos`

`addTicket` y `loadTickets` usan el global `ticketsRef`. Debe asignarse al inicializar Firebase. Laboratorio usa `window.database`; si solo existe uno de los dos, un módulo vive y el otro no.

Un script ausente **no** detiene los siguientes. El error aparece al usar el global, no en el 404.

### Tickets desaparecidos al recargar

`loadTickets` **elimina** nodos de `tickets` sin `id` y `mascota`. No guardar stubs. Backups incompletos reimportados así se auto-destruyen.

### Laboratorio no aparece en el menú

Rol fuera de `admin | consulta_externa | internos | quirofano | laboratorio`. `recepcion` y `visitas` no ven el módulo.

Si el rol ve el menú pero no una lista/hoja legacy, revisar las [allowlists distintas](architecture.md#allowlists-de-laboratorio-no-coinciden).

### “Sistema de laboratorio no disponible”

`initLaboratorioSystem` no está en el scope (script `laboratorio.js` no cargó) o `hasLabAccess()` es falso. Si `window.database` es null, el init retorna sin listeners.

### Búsqueda de clientes lab vacía / “Cargando datos…” / empty state roto

`initLaboratorioSystem` llama `setupLabEventListeners` → `setupExamenRegaliaAndFirma()`. Esa función **no está** en este repo. Si lanza, el `catch` de init **omite** `setupClientesDataListener` y el índice `clientesData` queda vacío.

El botón “recargar” llama `forceReloadClientesData()`, también **indefinida** aquí. El fallback interno usa `window.database.ref('tickets').once`.

La búsqueda exige `#labFechaFiltro` y una consulta ese día en `cliente.consultas`. `addClienteFromTicket` (listener `child_added`) **sobrescribe** el cliente sin `consultas`; si corre después del snapshot `value`, el filtro de fecha deja de encontrar a ese cliente hasta el próximo rebuild.

Si hay datos pero **cero** matches, `displaySearchResults` usa `${query}` (variable inexistente) y lanza `ReferenceError`. El empty state no se pinta. “Diagnosticar” llama `diagnoseLaboratorySearch()`, tampoco definida aquí.

### Catálogo de servicios vacío

`SERVICIOS_LABORATORIO` sale de `services-data.js`. Sin ese archivo, `getAllServices()` lanza al enumerar `Object.keys`.

### Checkbox de servicio lab no guarda (admin)

La UI muestra el checkbox a `admin` y `laboratorio`; el handler solo acepta `laboratorio`. Usar una cuenta con rol `laboratorio` para marcar `realizado`.

### Factura de lab no llega a la consulta

`syncLabFacturaToConsultaByClienteData` depende de `window.updateConsultaTicketFactura`, no definido en este repo. Mientras tanto, copiar el número a mano en la consulta.

### Filtro de fecha en lab “no funciona”

Diseño actual: la fecha solo recorta `reportado_cliente` y `cliente_no_contesta`. El resto de colas muestra el histórico completo. El input ni siquiera se muestra en las otras colas.

### Filtro “Urgentes” vacío

`renderTickets('urgentes')` busca `urgencia === 'alta'`. El formulario guarda `emergencia` / `urgencia` / `leve` / `consulta` / `prequirurgico`. El botón de ese filtro no está en el HTML base (sí `todos`, `espera`, `consultorio`, `terminado`, `porFacturar`).

### Cambio de estado deja la lista en “Terminados” (o el modal abierto)

`changeStatus` para estados que **no** son fin de consulta llama `renderTickets('terminado')` y marca ese filtro. Volver a En espera / Consultorio a mano.

Si el nuevo estado **es** `terminado` o `cliente_se_fue`, el modal **no se cierra**. “Terminar Consulta” no tiene ese bug.

### `consulta_externa` ve “Límite de ediciones alcanzado”

Tras 7 guardados de ese rol (`editCount`). El submit del modal se deshabilita entero. El límite no se resetea en la UI.

### Horas de espera en cero en estadísticas

El gráfico usa `horaLlegada` y (`horaFinalizacion` o `horaAtencion`) como `HH:MM` locales. Tickets sin esas marcas no entran. Cruce de midnight da negativo y se descarta (`tiempoTotal >= 0`). Periodos distintos de “hoy” parsean `fechaConsulta` con `new Date('YYYY-MM-DD')` (UTC). Chart.js viene **sin pin**; un breaking change del CDN puede tumbar los canvas.

### Exportar a Google Sheets

Placeholder: abre `https://docs.google.com/spreadsheets`. No hay API configurada.

### Historial de ediciones no aparece en el menú

`#edicionesSection` está en el HTML. No hay `#edicionesBtn` en el sidebar. Para verlo hace falta `navigateToSection` / quitar `hidden` a mano.

### Hojas `lab_sheets` mezclan días

`openLabSheetModal` escribe `lab_sheets/{ticket.id}`. `id` se reinicia cada día: la hoja del ticket #3 de hoy pisa la del #3 de ayer.

El botón Eliminar de esa hoja mira un `userRole` global, no `sessionStorage`. Si no hay global, el botón no se pinta aunque el usuario sea admin.

### Consentimientos / usuarios / logo / `lab.js` rotos

Módulos y assets no versionados: `consentimientos-module.js`, `consentimientos.css`, `debug-consentimientos.js`, `admin-users.js`, `empresa.jpg`, `lab.js`.

### Modal de usuarios no crea admin ni laboratorio

El `<select id="newUserRole">` solo lista `recepcion`, `consulta_externa`, `quirofano`, `internos`, `visitas`. Crear `admin` / `laboratorio` implica editar Firebase (o el JS ausente) a mano.

## Qué no inventar al operar Firebase

- No borrar a ciegas `tickets`: la app ya poda incompletos.
- No usar `id` como clave primaria (se repite cada día). Preferir la key de Firebase o `randomId`.
- No escribir `firebaseKey` dentro del nodo (es metadato de cliente).
- `lab_tickets` y `tickets` son árboles distintos; unirse por `cedula` / `idPaciente`, no por `id`.
- No asumir que “Limpiar datos antiguos” borra nada: hoy solo muestra un alert.
- No inventar el mapa `PERMISSIONS` ni el contenido de `firebase-config.js`: no están en este repo.

## Checklist de developer al completar el checkout

1. Recuperar los JS/HTML/CSS/imagen listados en el [README](../README.md), incluido `lab.js`, `debug-consentimientos.js` y los parches que definen `setupExamenRegaliaAndFirma` / `forceReloadClientesData` / `diagnoseLaboratorySearch`.
2. Confirmar que `firebase-config.js` no se commitea con secretos innecesarios en branches públicas; las reglas de RTDB deben impedir lecturas anónimas.
3. Verificar en consola: `firebase.apps.length`, `window.database`, `typeof hasPermission`, `typeof SERVICIOS_LABORATORIO`, `typeof setupExamenRegaliaAndFirma`.
4. Probar un ciclo: login → crear consulta (espera) → pasar a consultorio → terminar (comprobar que el modal de estado se cierra) → crear lab desde el mismo cliente (con fecha de consulta = `#labFechaFiltro`) → marcar servicio con rol `laboratorio`.
5. Confirmar que una búsqueda lab sin matches no tira `ReferenceError` en consola (empty state de `query`).
