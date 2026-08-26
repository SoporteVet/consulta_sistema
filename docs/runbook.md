# Runbook operativo y desarrollo

## Backup de consultas

Botón “Generar respaldo” (`backupData` en `index.js`):

- Descarga `backup_veterinaria_YYYY-MM-DD.json`.
- Contenido: `{ tickets, currentTicketId, timestamp, version: '1.0' }`.
- Cada ticket **sin** `firebaseKey`.
- **No** incluye `lab_tickets`, `ticket_edits` ni `lab_sheets`.

No hay restore en la app. Restaurar implica reescribir Firebase a mano (o un script externo). Un `push` masivo regeneraría keys y duplicaría `id` visuales.

## Limpieza de consultas antiguas

“Limpiar datos antiguos” (`cleanOldData`):

- Pide confirmación.
- Borra de `tickets` los registros con `estado === 'terminado'` cuya `ticket.fecha` (ISO de **creación**, no `fechaConsulta`) tiene más de **3 meses**.
- No toca lab, ediciones ni tickets no terminados (incluidos `cliente_se_fue`).
- Irreversible.

## Contador visual de tickets

`id` de consulta es `max(id del día) + 1`. `settings.currentTicketId` se lee/escribe en `loadTickets` pero el alta usa el cálculo por día, no ese settings de forma exclusiva.

`fixDuplicateTicketIds()` reasigna `id` globalmente cuando hay duplicados (no es por día). Usarla con cuidado: puede romper la numeración diaria.

## Fallos frecuentes

### Página en blanco / redirect infinito a `home.html`

`index.html` exige `home.html`, `firebase-config.js` y `auth.js`. Si faltan, el arranque falla o `initAuth` / `checkAuth` redirigen. Comprobar Network y que Firebase Auth tenga un usuario persistido.

### `ticketsRef is not defined` / `Error con la base de datos`

`addTicket` y `loadTickets` usan el global `ticketsRef`. Debe asignarse al inicializar Firebase. Laboratorio usa `window.database`; si solo existe uno de los dos, un módulo vive y el otro no.

### Tickets desaparecidos al recargar

`loadTickets` **elimina** nodos de `tickets` sin `id` y `mascota`. No guardar stubs. Backups incompletos reimportados así se auto-destruyen.

### Laboratorio no aparece en el menú

Rol fuera de `admin | consulta_externa | internos | quirofano | laboratorio`. `recepcion` y `visitas` no ven el módulo.

### “Sistema de laboratorio no disponible”

`initLaboratorioSystem` no está en el scope (script `laboratorio.js` no cargó) o `hasLabAccess()` es falso. Si `window.database` es null, el init retorna sin listeners.

### Catálogo de servicios vacío

`SERVICIOS_LABORATORIO` sale de `services-data.js`. Sin ese archivo, `getAllServices()` lanza al enumerar `Object.keys`.

### Checkbox de servicio lab no guarda (admin)

La UI muestra el checkbox a `admin` y `laboratorio`; el handler solo acepta `laboratorio`. Usar una cuenta con rol `laboratorio` para marcar `realizado`.

### Factura de lab no llega a la consulta

`syncLabFacturaToConsultaByClienteData` depende de `window.updateConsultaTicketFactura`, no definido en este repo. Mientras tanto, copiar el número a mano en la consulta.

### Filtro de fecha en lab “no funciona”

Diseño actual: la fecha solo recorta `reportado_cliente` y `cliente_no_contesta`. El resto de colas muestra el histórico completo.

### Filtro “Urgentes” vacío

`renderTickets('urgentes')` busca `urgencia === 'alta'`. El formulario guarda `emergencia` / `urgencia` / `leve` / `consulta` / `prequirurgico`. El botón de ese filtro no está en el HTML base (sí `todos`, `espera`, `consultorio`, `terminado`, `porFacturar`).

### Cambio de estado deja la lista en “Terminados”

`changeStatus` tras guardar llama `renderTickets('terminado')`. Volver al filtro En espera / Consultorio a mano.

### `consulta_externa` ve “Límite de ediciones alcanzado”

Tras 7 guardados de ese rol (`editCount`). El submit del modal se deshabilita entero. El límite no se resetea en la UI.

### Horas de espera en cero en estadísticas

El gráfico usa `horaLlegada` y (`horaFinalizacion` o `horaAtencion`) como `HH:MM` locales. Tickets sin esas marcas no entran. Cruce de medianoche da negativo y se descarta (`tiempoTotal >= 0`).

### Exportar a Google Sheets

Placeholder: abre `https://docs.google.com/spreadsheets`. No hay API configurada.

### Consentimientos / usuarios / logo rotos

Módulos y assets no versionados: `consentimientos-module.js`, `consentimientos.css`, `admin-users.js`, `empresa.jpg`.

## Qué no inventar al operar Firebase

- No borrar a ciegas `tickets`: la app ya poda incompletos.
- No usar `id` como clave primaria (se repite cada día). Preferir la key de Firebase o `randomId`.
- No escribir `firebaseKey` dentro del nodo (es metadato de cliente).
- `lab_tickets` y `tickets` son árboles distintos; unirse por `cedula` / `idPaciente`, no por `id`.

## Checklist de developer al completar el checkout

1. Recuperar los JS/HTML/CSS/imagen listados en el [README](../README.md).
2. Confirmar que `firebase-config.js` no se commitea con secretos innecesarios en branches públicas; las reglas de RTDB deben impedir lecturas anónimas.
3. Verificar en consola: `firebase.apps.length`, `window.database`, `typeof hasPermission`, `typeof SERVICIOS_LABORATORIO`.
4. Probar un ciclo: login → crear consulta (espera) → pasar a consultorio → terminar → crear lab desde el mismo cliente → marcar servicio con rol `laboratorio`.
