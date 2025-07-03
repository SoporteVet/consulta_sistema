// laboratorio.js - Sistema de tickets de laboratorio
// Sistema de Tickets de Laboratorio para Veterinaria

// Variables globales del sistema de laboratorio
let labTickets = [];
let currentLabTicketId = 1;
let labTicketsRef = null;
let clientesData = []; // Para almacenar los datos de clientes

// Variables globales para el sistema de servicios
let selectedServices = [];
let currentFilterCategory = '';
let currentSearchTerm = '';

// Listas de razas por tipo de mascota
const razasCaninas = [
    "Ainu", "Airedale terrier", "Akita", "Akita Inu", "Alaskan Malamute",
    "American Black and Tan Coonhound", "American Bull Terrier", "American Pit Bull Terrier",
    "American Staffordshire terrier", "American Water Spaniel", "Apso Tibetano", "Barzoi", 
    "Basenji", "Basset Hound", "Beagle", "Bichon Frise", "Bloodhound", "Bobtail", 
    "Border Collie", "Boston Terrier", "Bouvier des Flandres", "Boxer", "Bull terrier", 
    "Bull Terrier Miniatura", "Bulldog Americano", "Bulldog Francés", "Bulldog Inglés", 
    "Bullmastiff", "Cavalier King Charles Spaniel", "Chihuahua", "Chow Chow", 
    "Cocker Spaniel Americano", "Cocker Spaniel Inglés", "Collie", "Collie Escocés", 
    "Dachshund", "Dálmata", "Doberman", "Doberman Pincher", "Dogo Alemán", 
    "Dogo Argentino", "Dogo de Burdeos", "French Poodle", "Galgo Español", 
    "Galgo Inglés-español", "Golden Retriever", "Gran Danés", "Greyhound", 
    "Husky Siberiano", "Jack Russell Terrier", "Labrador Retriever", "Maltés", 
    "Pastor Alemán", "Pequinés", "Pomerania", "Pug", "Rottweiler", "Samoyedo", 
    "San Bernardo", "Schnauzer", "Shih Tzu", "SRD", "Yorkshire Terrier", "Weimaraner", "Fila Brasileiro"
];

const razasFelinas = [
    "Abisinio", "American Bobtail", "Angora Turco", "Azul Ruso", "Balinés", 
    "Bengalí", "Bobtail japonés", "Bombay", "British Shorthair", "Burmés", 
    "Carey", "Común Europeo", "Exótico", "Himalayo", "Javanés", 
    "Oriental", "Persa", "Sagrado de Birmania", "Siamés", "Siberiano", 
    "Silvestre", "SRD"
];

const razasOtras = [
    "SRD", "Mestizo", "Común", "Otra"
];

// Inicializar el sistema de laboratorio
function initLaboratorioSystem() {
    console.log('Inicializando sistema de laboratorio...');
    
    // Verificar acceso al módulo de laboratorio
    if (!hasLabAccess()) {
        console.log('Usuario sin acceso al módulo de laboratorio');
        return;
    }
    
    try {
        // Configurar referencia de Firebase
        if (window.database) {
            labTicketsRef = window.database.ref('lab_tickets');
            console.log('Referencia de Firebase configurada para laboratorio');
            setupLabFirebaseListeners();
        } else {
            console.error('Base de datos no disponible');
            return;
        }
        
        // Configurar event listeners primero
        setupLabEventListeners();
          // Establecer fecha por defecto
        setDefaultLabDate();
        
        // Configurar actualización en tiempo real de clientes
        console.log('Configurando actualización en tiempo real de clientes...');
        setupClientesDataListener();
        
        console.log('Sistema de laboratorio inicializado correctamente');
        
    } catch (error) {
        console.error('Error inicializando sistema de laboratorio:', error);
    }
}

// Cargar datos de clientes desde Firebase tickets y configurar actualización en tiempo real
function setupClientesDataListener() {
    try {
        console.log('Configurando listener de clientes en tiempo real...');
        
        if (!window.database) {
            console.error('Base de datos no disponible');
            return;
        }

        const ticketsRef = window.database.ref('tickets');
        
        // PRIMERA CARGA: Obtener datos iniciales una sola vez
        ticketsRef.once('value')
            .then((snapshot) => {
                console.log('Carga inicial de datos de clientes...');
                updateClientesDataFromSnapshot(snapshot);
                console.log(`Datos iniciales cargados: ${clientesData.length} clientes`);
            })
            .catch((error) => {
                console.error('Error en carga inicial de clientes:', error);
            });
        
        // Configurar listener en tiempo real para tickets (para cambios futuros)
        ticketsRef.on('value', (snapshot) => {
            console.log('Actualizando datos de clientes en tiempo real...');
            updateClientesDataFromSnapshot(snapshot);
        });
        
        // También escuchar cambios específicos para optimizar
        ticketsRef.on('child_added', (snapshot) => {
            console.log('Nuevo ticket añadido, actualizando clientes...');
            const ticket = snapshot.val();
            if (ticket) {
                addClienteFromTicket(ticket);
            }
        });
        
        ticketsRef.on('child_changed', (snapshot) => {
            console.log('Ticket modificado, actualizando clientes...');
            const ticket = snapshot.val();
            if (ticket) {
                updateClienteFromTicket(ticket);
            }
        });
        
    } catch (error) {
        console.error('Error configurando listener de clientes:', error);
    }
}

// Actualizar datos de clientes desde snapshot completo
function updateClientesDataFromSnapshot(snapshot) {
    try {
        const ticketsData = snapshot.val() || {};
        
        // Extraer información de clientes con historial de fechas
        const clientesMap = new Map();
        
        Object.values(ticketsData).forEach(ticket => {
            if (ticket.nombre && (ticket.cedula || ticket.idPaciente)) {
                const clienteId = ticket.cedula || ticket.idPaciente;
                
                // Si el cliente ya existe, actualizar con nueva información
                let clienteInfo = clientesMap.get(clienteId) || {
                    Id: ticket.idPaciente || clienteId,
                    Nombre: ticket.nombre,
                    Identificacion: ticket.cedula || '',
                    'nombre mascota': ticket.mascota || '',
                    Especie: ticket.tipoMascota === 'perro' ? 'Canino' : 
                            ticket.tipoMascota === 'gato' ? 'Felino' : 
                            ticket.tipoMascota === 'conejo' ? 'Conejo' : 'Otro',
                    ultimaActualizacion: new Date().getTime(),
                    consultas: [] // Historial de consultas
                };
                
                // Añadir información de la consulta actual
                if (ticket.fechaConsulta || ticket.fecha) {
                    const fechaConsulta = ticket.fechaConsulta || ticket.fecha;
                    const consultaExistente = clienteInfo.consultas.find(c => 
                        c.fecha === fechaConsulta && c.randomId === ticket.randomId
                    );
                    
                    if (!consultaExistente) {
                        clienteInfo.consultas.push({
                            fecha: fechaConsulta,
                            randomId: ticket.randomId,
                            estado: ticket.estado,
                            medicoAtiene: ticket.medicoAtiene,
                            motivoLlegada: ticket.motivoLlegada,
                            tipoServicio: ticket.tipoServicio,
                            horaLlegada: ticket.horaLlegada,
                            horaAtencion: ticket.horaAtencion
                        });
                    }
                }
                
                // Mantener la información más reciente del cliente
                if (ticket.nombre) clienteInfo.Nombre = ticket.nombre;
                if (ticket.mascota) clienteInfo['nombre mascota'] = ticket.mascota;
                if (ticket.cedula) clienteInfo.Identificacion = ticket.cedula;
                
                clientesMap.set(clienteId, clienteInfo);
            }
        });
        
        const previousCount = clientesData.length;
        clientesData = Array.from(clientesMap.values());
        
        console.log(`Clientes actualizados: ${previousCount} → ${clientesData.length}`);
        
        // Notificar que los datos de clientes han sido actualizados
        notifyClientesDataUpdated();
        
    } catch (error) {
        console.error('Error actualizando datos de clientes:', error);
    }
}

// Añadir cliente individual desde ticket nuevo
function addClienteFromTicket(ticket) {
    try {
        if (!ticket.nombre || (!ticket.cedula && !ticket.idPaciente)) {
            return;
        }
        
        const clienteId = ticket.cedula || ticket.idPaciente;
        
        // Verificar si el cliente ya existe
        const existingClienteIndex = clientesData.findIndex(c => 
            c.Identificacion === ticket.cedula || c.Id === ticket.idPaciente
        );
        
        const nuevoCliente = {
            Id: ticket.idPaciente || clienteId,
            Nombre: ticket.nombre,
            Identificacion: ticket.cedula || '',
            'nombre mascota': ticket.mascota || '',
            Especie: ticket.tipoMascota === 'perro' ? 'Canino' : 
                    ticket.tipoMascota === 'gato' ? 'Felino' : 
                    ticket.tipoMascota === 'conejo' ? 'Conejo' : 'Otro',
            ultimaActualizacion: new Date().getTime()
        };
        
        if (existingClienteIndex === -1) {
            // Cliente nuevo
            clientesData.push(nuevoCliente);
            console.log(`Nuevo cliente añadido: ${nuevoCliente.Nombre}`);
        } else {
            // Actualizar cliente existente
            clientesData[existingClienteIndex] = nuevoCliente;
            console.log(`Cliente actualizado: ${nuevoCliente.Nombre}`);
        }
        
        notifyClientesDataUpdated();
        
    } catch (error) {
        console.error('Error añadiendo cliente individual:', error);
    }
}

// Actualizar cliente individual desde ticket modificado
function updateClienteFromTicket(ticket) {
    // Usa la misma lógica que addClienteFromTicket ya que maneja tanto nuevos como actualizaciones
    addClienteFromTicket(ticket);
}

// Notificar que los datos de clientes han sido actualizados
function notifyClientesDataUpdated() {
    try {
        // Emitir evento personalizado para notificar la actualización
        const event = new CustomEvent('clientesDataUpdated', {
            detail: {
                count: clientesData.length,
                timestamp: new Date().getTime()
            }
        });
        document.dispatchEvent(event);
        
        // Si hay una búsqueda activa, actualizarla
        updateActiveClienteSearch();
        
    } catch (error) {
        console.error('Error notificando actualización de clientes:', error);
    }
}

// Actualizar búsqueda activa si la hay
function updateActiveClienteSearch() {
    try {
        const searchInput = document.getElementById('labClienteSearch');
        if (searchInput && searchInput.value.trim().length >= 2) {
            const query = searchInput.value.trim();
            console.log('Actualizando búsqueda activa para:', query);
            
            // Pequeño delay para evitar demasiadas actualizaciones
            setTimeout(() => {
                searchClientes(query);
            }, 300);
        }
    } catch (error) {
        console.error('Error actualizando búsqueda activa:', error);
    }
}

// Función de compatibilidad para cargar datos iniciales (mantener para compatibilidad)
async function loadClientesData() {
    // Esta función ahora solo inicia el listener en tiempo real
    setupClientesDataListener();
}

// Configurar listeners de Firebase para laboratorio
function setupLabFirebaseListeners() {
    labTicketsRef.on('value', (snapshot) => {
        labTickets = [];
        currentLabTicketId = 1;
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const ticket = { ...data[key], firebaseKey: key };
                labTickets.push(ticket);
                
                // Actualizar el ID más alto
                if (ticket.id >= currentLabTicketId) {
                    currentLabTicketId = ticket.id + 1;
                }
            });
        }
          // Actualizar la vista si está activa
        const labSection = document.getElementById('verLabSection');
        if (labSection && !labSection.classList.contains('hidden')) {
            // Obtener filtros activos
            const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
            const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
            const medicoFilter = document.getElementById('labMedicoFilter');
            const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
            
            renderLabTickets(currentStateFilter, currentMedicoFilter);
            updateLabStats();
        }
        
        console.log(`Cargados ${labTickets.length} tickets de laboratorio`);
    });
}

// Verificar si el usuario tiene acceso al módulo de laboratorio
function hasLabAccess() {
    const userRole = sessionStorage.getItem('userRole');
    const allowedRoles = ['admin', 'internos', 'consulta_externa', 'laboratorio', 'quirofano'];
    return allowedRoles.includes(userRole);
}

// Función para actualizar las razas según el tipo de mascota seleccionado
function updateRazasSelect() {
    const tipoMascota = document.getElementById('labTipoMascota').value;
    const razaSelect = document.getElementById('labRaza');
    
    if (!razaSelect) return;
    
    // Limpiar opciones existentes
    razaSelect.innerHTML = '';
    
    let razas = [];
    
    switch (tipoMascota) {
        case 'perro':
            razas = razasCaninas;
            break;
        case 'gato':
            razas = razasFelinas;
            break;
        case 'conejo':
        case 'otro':
            razas = razasOtras;
            break;
        default:
            razas = ['SRD'];
    }
    
    // Agregar opción por defecto
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar raza';
    razaSelect.appendChild(defaultOption);
    
    // Agregar las razas correspondientes
    razas.forEach(raza => {
        const option = document.createElement('option');
        option.value = raza;
        option.textContent = raza;
        razaSelect.appendChild(option);
    });
    
    console.log(`Razas actualizadas para ${tipoMascota}: ${razas.length} opciones`);
}

// Configurar event listeners del sistema de laboratorio
function setupLabEventListeners() {
    console.log('Configurando event listeners de laboratorio...');
    
    // NOTA: Los botones de navegación (crearLabBtn, verLabBtn) ahora se manejan
    // desde el sistema de navegación categorizada en index.js
    
    // Búsqueda de clientes
    const labClienteSearch = document.getElementById('labClienteSearch');
    if (labClienteSearch) {
        console.log('Configurando búsqueda de clientes');
        setupClienteSearch(labClienteSearch);
    } else {
        console.warn('Input labClienteSearch no encontrado');
    }
      
    // Formulario de creación
    const labTicketForm = document.getElementById('labTicketForm');
    if (labTicketForm) {
        console.log('Configurando formulario de laboratorio');
        labTicketForm.addEventListener('submit', handleLabTicketSubmit);
    } else {
        console.warn('Formulario labTicketForm no encontrado');
    }
    
    // Configurar listener para cambio de tipo de mascota
    const labTipoMascota = document.getElementById('labTipoMascota');
    if (labTipoMascota) {
        console.log('Configurando selector de tipo de mascota');
        labTipoMascota.addEventListener('change', updateRazasSelect);
        // Inicializar las razas con el valor por defecto
        updateRazasSelect();
    } else {
        console.warn('Select labTipoMascota no encontrado');
    }
    
    // Configurar listener para el médico que solicita (para controlar examen de regalía)
    const labMedicoSolicita = document.getElementById('labMedicoSolicita');
    if (labMedicoSolicita) {
        console.log('Configurando selector de médico que solicita');
        labMedicoSolicita.addEventListener('change', toggleExamenRegaliaVisibility);
        // Inicializar la visibilidad del campo
        toggleExamenRegaliaVisibility();
    } else {
        console.warn('Select labMedicoSolicita no encontrado');
    }
    
    // Filtros de laboratorio
    const labFilterBtns = document.querySelectorAll('.lab-filter-btn');
    console.log('Filtros de laboratorio encontrados:', labFilterBtns.length);    // Ocultar filtro "Todos" para usuarios que no sean admin
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'admin') {
        const todosLabBtn = document.querySelector('.lab-filter-btn[data-filter="todos"]');
        if (todosLabBtn) {
            todosLabBtn.style.display = 'none';
            // Si el botón "Todos" está activo, cambiar a "Pendiente" por defecto
            if (todosLabBtn.classList.contains('active')) {
                todosLabBtn.classList.remove('active');
                const pendienteBtn = document.querySelector('.lab-filter-btn[data-filter="pendiente"]');
                if (pendienteBtn) {
                    pendienteBtn.classList.add('active');
                }
            }
        }
    }
      labFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Actualizar botón activo
            labFilterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Filtrar tickets
            const filter = e.target.getAttribute('data-filter');
            
            // Mostrar/ocultar filtro de médicos según el estado
            toggleMedicoFilter(filter);
            
            // Mostrar/ocultar filtro de fecha según el estado
            toggleDateFilter(filter);
            
            // Reset del filtro de médicos al cambiar de estado
            const medicoFilter = document.getElementById('labMedicoFilter');
            if (medicoFilter) {
                medicoFilter.value = '';
            }
            
            // Renderizar con el nuevo filtro de estado, pero manteniendo la fecha
            renderLabTickets(filter, '');
        });
    });
    
    // Event listener para el filtro de médicos
    const labMedicoFilter = document.getElementById('labMedicoFilter');
    if (labMedicoFilter) {
        console.log('Configurando filtro de médicos');
        labMedicoFilter.addEventListener('change', (e) => {
            const selectedMedico = e.target.value;
            
            // Obtener el filtro de estado activo
            const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
            const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
            
            // Renderizar con ambos filtros
            renderLabTickets(currentStateFilter, selectedMedico);
        });
    } else {
        console.warn('Select labMedicoFilter no encontrado');
    }

    // Búsqueda de laboratorio
    const labSearchInput = document.getElementById('labSearchInput');
    if (labSearchInput) {
        console.log('Configurando búsqueda de laboratorio');
        labSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterLabTicketsBySearch(searchTerm);
        });
    } else {
        console.warn('Input labSearchInput no encontrado');
    }    // Filtro de fecha
    const labFilterDate = document.getElementById('labFilterDate');
    if (labFilterDate) {
        console.log('Configurando filtro de fecha de laboratorio');
        labFilterDate.addEventListener('change', (e) => {
            // Obtener el filtro de estado activo
            const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
            const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
            
            // Obtener el filtro de médico activo
            const medicoFilter = document.getElementById('labMedicoFilter');
            const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
            
            // Renderizar con todos los filtros
            renderLabTickets(currentStateFilter, currentMedicoFilter);
        });
    } else {
        console.warn('Input labFilterDate no encontrado');
    }
    
    // Filtro de fecha para búsqueda de clientes
    const labFechaFiltro = document.getElementById('labFechaFiltro');
    if (labFechaFiltro) {
        console.log('Configurando filtro de fecha para búsqueda de clientes');
        labFechaFiltro.addEventListener('change', (e) => {
            console.log('Filtro de fecha cambiado:', e.target.value);
            // Si hay una búsqueda activa, volver a ejecutarla con el nuevo filtro
            const searchInput = document.getElementById('labClienteSearch');
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchClientes(searchInput.value.trim());
            }
        });
    } else {
        console.warn('Input labFechaFiltro no encontrado');
    }
    
    // Event listeners para examen de regalía y firma digital
    setupExamenRegaliaAndFirma();
    
    console.log('Event listeners de laboratorio configurados');
}

// Controlar la visibilidad del campo de examen de regalía
function toggleExamenRegaliaVisibility() {
    const medicoSelect = document.getElementById('labMedicoSolicita');
    const examenRegaliaGroup = document.getElementById('labExamenRegalia')?.closest('.form-group');
    
    if (!medicoSelect || !examenRegaliaGroup) return;
    
    const medico = medicoSelect.value;
    const medicosRegalia = ['Dr. Luis Coto', 'Dr. Randall Azofeifa'];
    
    if (medicosRegalia.includes(medico)) {
        examenRegaliaGroup.style.display = 'block';
        // Auto-seleccionar "Sí" para examen de regalía si es uno de estos médicos
        const examenRegaliaSelect = document.getElementById('labExamenRegalia');
        if (examenRegaliaSelect && examenRegaliaSelect.value === 'no') {
            examenRegaliaSelect.value = 'si';
        }
    } else {
        examenRegaliaGroup.style.display = 'none';
        // Auto-seleccionar "No" para otros médicos
        const examenRegaliaSelect = document.getElementById('labExamenRegalia');
        if (examenRegaliaSelect) {
            examenRegaliaSelect.value = 'no';
        }
    }
}

// Configurar búsqueda de clientes con actualizaciones en tiempo real
function setupClienteSearch(searchInput) {
    const resultsContainer = document.getElementById('labClienteResults');
    if (!resultsContainer) {
        console.error('Contenedor de resultados no encontrado');
        return;
    }
    
    let searchTimeout;
    let selectedIndex = -1;
    
    // Escuchar actualizaciones de datos de clientes
    document.addEventListener('clientesDataUpdated', function(e) {
        console.log('Datos de clientes actualizados, refrescando búsqueda si es necesaria');
        // Si hay una búsqueda activa, actualizarla
        if (searchInput.value.trim().length >= 2) {
            const query = searchInput.value.trim();
            searchClientes(query);
        }
    });
    
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        // Limpiar timeout anterior
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        // Buscar después de 200ms para mejorar la responsividad
        searchTimeout = setTimeout(() => {
            searchClientes(query);
        }, 200);
    });
    
    // Navegación con teclado
    searchInput.addEventListener('keydown', function(e) {
        const items = resultsContainer.querySelectorAll('.cliente-search-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelectedItem(items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelectedItem(items);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    selectCliente(items[selectedIndex]);
                }
                break;
            case 'Escape':
                hideSearchResults();
                break;
        }
    });
    
    // Ocultar resultados al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    function updateSelectedItem(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    function hideSearchResults() {
        resultsContainer.style.display = 'none';
        selectedIndex = -1;
    }
}

// Buscar clientes en los datos con cache y optimización
function searchClientes(query) {
    console.log('Buscando clientes con query:', query);
    console.log('Datos disponibles:', clientesData.length, 'clientes');
    
    const resultsContainer = document.getElementById('labClienteResults');
    if (!resultsContainer) {
        console.error('Contenedor de resultados no encontrado');
        return;
    }
    
    // Verificar si hay datos disponibles
    if (!clientesData.length) {
        console.log('No hay datos de clientes disponibles');
        resultsContainer.innerHTML = '<div class="no-results">Cargando datos de clientes... <br><small>Si el problema persiste, <button onclick="forceReloadClientesData()" style="background: none; border: none; color: var(--primary-color); text-decoration: underline; cursor: pointer;">haga clic aquí para recargar</button></small></div>';
        resultsContainer.style.display = 'block';
        
        // Intentar cargar datos si no están disponibles
        if (!window.database) {
            resultsContainer.innerHTML = '<div class="no-results">Error: Base de datos no disponible</div>';
            return;
        }
        
        // Intentar forzar carga si no hay datos después de 2 segundos
        setTimeout(() => {
            if (clientesData.length === 0) {
                console.log('Forzando carga de datos después del timeout...');
                if (typeof forceReloadClientesData === 'function') {
                    forceReloadClientesData();
                } else {
                    // Fallback: intentar recargar manualmente
                    const ticketsRef = window.database.ref('tickets');
                    ticketsRef.once('value')
                        .then((snapshot) => {
                            updateClientesDataFromSnapshot(snapshot);
                        })
                        .catch((error) => {
                            console.error('Error en carga forzada:', error);
                        });
                }
            }
        }, 2000);
        
        return;
    }    const queryLower = query.toLowerCase();
    
    // Obtener filtro de fecha (obligatorio)
    const fechaFiltroInput = document.getElementById('labFechaFiltro');
    const fechaFiltro = fechaFiltroInput ? fechaFiltroInput.value : null;
    
    // Si no hay fecha seleccionada, usar fecha actual
    if (!fechaFiltro) {
        if (fechaFiltroInput) {
            fechaFiltroInput.value = getLocalDateString();
        }
        console.log('No había fecha seleccionada, usando fecha actual');
        return; // Salir y dejar que se ejecute de nuevo con la fecha actual
    }
    
    console.log('Filtrando por fecha:', fechaFiltro);
    
    // Búsqueda optimizada con múltiples criterios
    const results = clientesData.filter(cliente => {
        // Validar que cliente es un objeto válido
        if (!cliente || typeof cliente !== 'object') {
            console.warn('Cliente inválido encontrado:', cliente);
            return false;
        }
        
        const nombre = (cliente.Nombre || '').toString().toLowerCase();
        const cedula = (cliente.Identificacion || '').toString().toLowerCase();
        const mascota = (cliente['nombre mascota'] || '').toString().toLowerCase();
        const id = (cliente.Id || '').toString().toLowerCase();
        
        // Búsqueda básica por texto
        const textMatches = nombre.includes(queryLower) ||
               cedula.includes(queryLower) ||
               mascota.includes(queryLower) ||
               id.includes(queryLower) ||
               // Búsqueda por palabras individuales
               queryLower.split(' ').some(word => 
                   nombre.includes(word) || 
                   mascota.includes(word)
               );
          // Si no hay coincidencia de texto, filtrar
        if (!textMatches) {
            return false;
        }
        
        // Filtro por fecha (obligatorio) - verificar si el cliente tiene consultas en la fecha especificada
        const tieneConsultaEnFecha = cliente.consultas && cliente.consultas.some(consulta => 
            consulta.fecha === fechaFiltro
        );
        
        if (!tieneConsultaEnFecha) {
            return false;
        }
               

        return true;
    })
    .sort((a, b) => {
        // Ordenar por relevancia: coincidencias exactas primero
        const aExact = (a.Nombre || '').toLowerCase().startsWith(queryLower) ||
                       (a['nombre mascota'] || '').toLowerCase().startsWith(queryLower);
        const bExact = (b.Nombre || '').toLowerCase().startsWith(queryLower) ||
                       (b['nombre mascota'] || '').toLowerCase().startsWith(queryLower);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Luego por actualización más reciente
        return (b.ultimaActualizacion || 0) - (a.ultimaActualizacion || 0);
    })
    .slice(0, 8); // Limitar a 8 resultados para mejor rendimiento
    
    console.log('Resultados encontrados:', results.length);
    
    displaySearchResults(results, queryLower);
}

// Mostrar resultados de búsqueda con highlighting y mejor UX
function displaySearchResults(results, queryLower = '') {
    console.log('Mostrando resultados:', results);
    
    const resultsContainer = document.getElementById('labClienteResults');
    if (!resultsContainer) {
        console.error('Contenedor de resultados no encontrado');
        return;
    }    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 2rem; color: #bdc3c7; margin-bottom: 10px;"></i>
                <p>No se encontraron clientes para: "<strong>${query}</strong>"</p>
                <small style="color: #7f8c8d;">
                    Intente con: nombre, cédula, nombre de la mascota o ID del paciente<br>
                    Total de clientes en base de datos: ${clientesData.length}
                </small>
                <div style="margin-top: 10px;">
                    <button onclick="diagnoseLaboratorySearch()" style="background: none; border: 1px solid #3498db; color: #3498db; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-right: 5px;">
                        Diagnosticar
                    </button>
                    <button onclick="forceReloadClientesData()" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                        Recargar Datos
                    </button>
                </div>
            </div>
        `;
        resultsContainer.style.display = 'block';
        return;
    }
    
    try {
        // Función para resaltar texto coincidente
        const highlightText = (text, query) => {
            if (!query || !text) return text;
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        };
        
        const html = results.map((cliente, index) => {
            // Validar datos del cliente
            if (!cliente || typeof cliente !== 'object') {
                console.warn('Cliente inválido en resultados:', cliente);
                return '';
            }
            
            const especie = cliente.Especie === 'Canino' ? 'Perro' : 
                           cliente.Especie === 'Felino' ? 'Gato' : 
                           cliente.Especie === 'Conejo' ? 'Conejo' : 'Otro';
            
            // Escapar datos para JSON
            const clienteJson = JSON.stringify(cliente).replace(/"/g, '&quot;');
            
            // Aplicar highlighting a los campos relevantes
            const nombreHighlighted = highlightText(cliente.Nombre || 'Sin nombre', queryLower);
            const mascotaHighlighted = highlightText(cliente['nombre mascota'] || 'Sin mascota', queryLower);
            const cedulaHighlighted = highlightText(cliente.Identificacion || 'Sin cédula', queryLower);
            const idHighlighted = highlightText(cliente.Id || 'Sin ID', queryLower);
              // Indicador de actualización reciente
            const isRecent = cliente.ultimaActualizacion && 
                           (new Date().getTime() - cliente.ultimaActualizacion) < 30000; // 30 segundos
            
            // Información de consultas del cliente
            let consultasInfo = '';
            const fechaFiltroInput = document.getElementById('labFechaFiltro');
            const fechaFiltro = fechaFiltroInput ? fechaFiltroInput.value : null;
            
            if (cliente.consultas && cliente.consultas.length > 0) {
                let consultasRelevantes = cliente.consultas;
                
                // Si hay filtro de fecha, mostrar solo esas consultas
                if (fechaFiltro) {
                    consultasRelevantes = cliente.consultas.filter(c => c.fecha === fechaFiltro);
                } else {
                    // Mostrar las 3 consultas más recientes
                    consultasRelevantes = cliente.consultas
                        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                        .slice(0, 3);
                }
                
                if (consultasRelevantes.length > 0) {
                    consultasInfo = `
                        <div class="cliente-consultas">
                            <div class="consultas-header">
                                <i class="fas fa-history"></i>
                                <span>Consultas ${fechaFiltro ? 'del ' + formatDate(fechaFiltro) : 'recientes'}:</span>
                            </div>
                            ${consultasRelevantes.map(consulta => `
                                <div class="consulta-item">
                                    <span class="consulta-fecha">${formatDate(consulta.fecha)}</span>
                                    ${consulta.estado ? `<span class="consulta-estado estado-${consulta.estado}">${getEstadoLabel(consulta.estado)}</span>` : ''}
                                    ${consulta.medicoAtiene ? `<span class="consulta-medico">${consulta.medicoAtiene}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }
            
            return `
                <div class="cliente-search-item ${index === 0 ? 'first-result' : ''}" data-cliente="${clienteJson}">
                    ${isRecent ? '<div class="recent-indicator" title="Actualizado recientemente"><i class="fas fa-circle"></i></div>' : ''}
                    <div class="cliente-name">${nombreHighlighted}</div>
                    <div class="cliente-details">
                        <div class="cliente-detail-item">
                            <i class="fas fa-id-card"></i>
                            <span>${cedulaHighlighted}</span>
                        </div>
                        <div class="cliente-detail-item">
                            <i class="fas fa-hashtag"></i>
                            <span>ID: ${idHighlighted}</span>
                        </div>
                        <div class="cliente-detail-item cliente-mascota">
                            <i class="fas fa-paw"></i>
                            <span>${mascotaHighlighted} (${especie})</span>
                        </div>
                    </div>
                    ${consultasInfo}
                </div>
            `;
        }).filter(html => html !== '').join('');
        
        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
        
        console.log('Resultados mostrados en el DOM');
        
        // Agregar event listeners a los items
        resultsContainer.querySelectorAll('.cliente-search-item').forEach(item => {
            item.addEventListener('click', () => selectCliente(item));
            
            // Efecto hover mejorado
            item.addEventListener('mouseenter', () => {
                // Remover selección previa de teclado
                resultsContainer.querySelectorAll('.cliente-search-item').forEach(i => 
                    i.classList.remove('selected')
                );
                item.classList.add('selected');
            });
        });
        
        // Auto-seleccionar el primer resultado para navegación con teclado
        const firstItem = resultsContainer.querySelector('.cliente-search-item');
        if (firstItem) {
            firstItem.classList.add('keyboard-selected');
        }
        
    } catch (error) {
        console.error('Error mostrando resultados:', error);
        resultsContainer.innerHTML = `
            <div class="no-results error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error mostrando resultados</p>
                <small>Intenta de nuevo</small>
            </div>
        `;
        resultsContainer.style.display = 'block';
    }
}

// Seleccionar cliente y llenar formulario
function selectCliente(itemElement) {
    try {
        const clienteDataStr = itemElement.getAttribute('data-cliente');
        if (!clienteDataStr) {
            throw new Error('No se encontraron datos del cliente');
        }
        
        // Decodificar HTML entities
        const decodedStr = clienteDataStr.replace(/&quot;/g, '"');
        const clienteData = JSON.parse(decodedStr);
        
        console.log('Cliente seleccionado:', clienteData);
        
        // Llenar campos del formulario
        const nombreInput = document.getElementById('labNombre');
        const cedulaInput = document.getElementById('labCedula');
        const mascotaInput = document.getElementById('labMascota');
        const tipoMascotaSelect = document.getElementById('labTipoMascota');
        const idPacienteInput = document.getElementById('labIdPaciente');
        
        if (nombreInput) nombreInput.value = clienteData.Nombre || '';
        if (cedulaInput) cedulaInput.value = clienteData.Identificacion || '';
        if (mascotaInput) mascotaInput.value = clienteData['nombre mascota'] || '';
        if (idPacienteInput) idPacienteInput.value = clienteData.Id || '';
        
        // Determinar tipo de mascota
        if (tipoMascotaSelect) {
            let tipoMascota = 'otro';
            if (clienteData.Especie === 'Canino') tipoMascota = 'perro';
            else if (clienteData.Especie === 'Felino') tipoMascota = 'gato';
            else if (clienteData.Especie === 'Conejo') tipoMascota = 'conejo';
            
            tipoMascotaSelect.value = tipoMascota;
        }
        
        // Ocultar resultados
        const resultsContainer = document.getElementById('labClienteResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
        
        // Limpiar campo de búsqueda
        const searchInput = document.getElementById('labClienteSearch');
        if (searchInput) {
            searchInput.value = `${clienteData.Nombre} - ${clienteData['nombre mascota']}`;
        }
        
        showNotification('Cliente seleccionado correctamente', 'success');
        
    } catch (error) {
        console.error('Error al seleccionar cliente:', error);
        showNotification('Error al seleccionar cliente', 'error');
    }
}

// Mostrar sección de laboratorio
function showLabSection(sectionId) {
    console.log('Mostrando sección de laboratorio:', sectionId);
    
    try {
        // Ocultar todas las secciones
        document.querySelectorAll('.content section').forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('active');
        });
        
        // Mostrar la sección seleccionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            console.log('Sección encontrada:', sectionId);
            targetSection.classList.remove('hidden');
            setTimeout(() => targetSection.classList.add('active'), 50);
        } else {
            console.error('Sección no encontrada:', sectionId);
            return;
        }
        
        // Actualizar botones de navegación
        document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));        if (sectionId === 'crearLabSection') {
            const crearBtn = document.getElementById('crearLabBtn');
            if (crearBtn) {
                crearBtn.classList.add('active');
                // Usar la función setActiveButton del sistema principal si está disponible
                if (typeof setActiveButton === 'function') {
                    setActiveButton(crearBtn);
                }
                console.log('Botón crear laboratorio activado');
            }
            
            // Inicializar sistema de servicios cuando se muestra la sección de crear
            if (typeof initServiceSelection === 'function') {
                initServiceSelection();
            }        } else if (sectionId === 'verLabSection') {
            const verBtn = document.getElementById('verLabBtn');
            if (verBtn) {
                verBtn.classList.add('active');
                // Usar la función setActiveButton del sistema principal si está disponible
                if (typeof setActiveButton === 'function') {
                    setActiveButton(verBtn);
                }
                console.log('Botón ver laboratorio activado');
            }
            
            // Establecer fecha actual por defecto si no hay una fecha seleccionada
            const labFilterDate = document.getElementById('labFilterDate');
            if (labFilterDate && !labFilterDate.value) {
                labFilterDate.value = getLocalDateString();
            }
            
            // Determinar el filtro por defecto según el rol del usuario
            const userRole = sessionStorage.getItem('userRole');
            const defaultFilter = userRole === 'admin' ? 'todos' : 'pendiente';
            
            // Configurar visibilidad de filtros según el filtro por defecto
            toggleMedicoFilter(defaultFilter);
            toggleDateFilter(defaultFilter);
            
            renderLabTickets(defaultFilter);
            updateLabStats();
        }
        
        console.log('Sección de laboratorio mostrada exitosamente');
    } catch (error) {
        console.error('Error mostrando sección de laboratorio:', error);
    }
}

// Establecer fecha por defecto
function setDefaultLabDate() {
    const fechaInput = document.getElementById('labFecha');
    if (fechaInput) {
        fechaInput.value = getLocalDateString();
    }
    
    const filterDateInput = document.getElementById('labFilterDate');
    if (filterDateInput) {
        filterDateInput.value = getLocalDateString();
    }
    
    // Establecer fecha actual en el filtro de búsqueda
    const fechaFiltroInput = document.getElementById('labFechaFiltro');
    if (fechaFiltroInput) {
        fechaFiltroInput.value = getLocalDateString();
    }
}

// Manejar envío del formulario de laboratorio
function handleLabTicketSubmit(e) {
    e.preventDefault();
    
    // Validar que se hayan seleccionado servicios
    if (selectedServices.length === 0) {
        showNotification('Debe seleccionar al menos un servicio de laboratorio', 'error');
        return;
    }
    
    // Obtener datos de servicios seleccionados
    const serviciosData = getSelectedServicesData();
      // Recopilar datos del formulario
    const formData = {
        id: currentLabTicketId,
        randomId: generateRandomId(),
        nombre: document.getElementById('labNombre').value.trim(),
        cedula: document.getElementById('labCedula').value.trim(),
        mascota: document.getElementById('labMascota').value.trim(),
        tipoMascota: document.getElementById('labTipoMascota').value,
        // Nuevos campos agregados
        edad: document.getElementById('labEdad').value.trim(),
        raza: document.getElementById('labRaza').value,
        peso: document.getElementById('labPeso').value.trim(),
        sexo: document.getElementById('labSexo').value,
        idPaciente: document.getElementById('labIdPaciente').value.trim(),
        fecha: document.getElementById('labFecha').value,
        // Reemplazar tipoExamen con los servicios seleccionados
        serviciosSeleccionados: serviciosData.servicios,
        serviciosIds: serviciosData.serviciosIds,
        serviciosNombres: serviciosData.serviciosNombres,
        totalServicios: serviciosData.total,
        prioridad: document.getElementById('labPrioridad').value,
        medicoSolicita: document.getElementById('labMedicoSolicita').value.trim(),
        examenRegalia: document.getElementById('labExamenRegalia').value,
        observaciones: document.getElementById('labObservaciones').value.trim(),
        notasLaboratorio: document.getElementById('labNotasLaboratorio').value.trim(),
        paquete: document.getElementById('labPaquete').value,
        correo: document.getElementById('labCorreo').value.trim(),
        telefono: document.getElementById('labTelefono').value.trim(),
        factura: document.getElementById('labFactura').value.trim(),
        departamento: document.getElementById('labDepartamento').value,
        fechaCreacion: getLocalDateString(),
        horaCreacion: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        estado: document.getElementById('labEstado').value
    };
    
    // Validar datos requeridos
    if (!validateLabTicketData(formData)) {
        return;
    }
    
    // Guardar en Firebase
    saveLabTicket(formData);
}

// Validar datos del ticket de laboratorio
function validateLabTicketData(data) {
    const requiredFields = ['nombre', 'cedula', 'mascota', 'raza', 'sexo', 'idPaciente', 'medicoSolicita', 'departamento'];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field].trim() === '') {
            showNotification(`El campo ${getLabFieldName(field)} es requerido`, 'error');
            return false;
        }
    }
      // Validar cédula (formato básico)
    if (!/^\d{8,12}$/.test(data.cedula.replace(/[-\s]/g, ''))) {
        showNotification('Formato de cédula inválido', 'error');
        return false;
    }
    
    // Validación de correo eliminada - permite cualquier texto
    // if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
    //     showNotification('Formato de correo electrónico inválido', 'error');
    //     return false;
    // }
    
    return true;
}

// Obtener nombre del campo para validación
function getLabFieldName(field) {
    const fieldNames = {
        'nombre': 'Nombre del Cliente',
        'cedula': 'Cédula',
        'mascota': 'Nombre de la Mascota',
        'edad': 'Edad',
        'raza': 'Raza',
        'peso': 'Peso',
        'sexo': 'Sexo',
        'idPaciente': 'ID del Paciente',
        'medicoSolicita': 'Médico que Solicita',
        'departamento': 'Departamento que Solicita',
        'correo': 'Correo Electrónico'
    };
    return fieldNames[field] || field;
}

// Guardar ticket de laboratorio en Firebase
function saveLabTicket(ticketData) {
    if (!labTicketsRef) {
        showNotification('Error de conexión con la base de datos', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('#labTicketForm .btn-submit');
    if (submitBtn) {
        showLoadingButton(submitBtn);
    }
    
    labTicketsRef.push(ticketData)
        .then(() => {
            showNotification('Ticket de laboratorio creado exitosamente', 'success');
            resetLabForm();
            currentLabTicketId++;
            
            // Cambiar a la vista de tickets de laboratorio
            showLabSection('verLabSection');
        })
        .catch(error => {
            console.error('Error guardando ticket de laboratorio:', error);
            showNotification('Error al crear el ticket de laboratorio', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                hideLoadingButton(submitBtn);
            }
        });
}

// Resetear formulario de laboratorio
function resetLabForm() {
    const form = document.getElementById('labTicketForm');
    if (form) {
        form.reset();
        setDefaultLabDate();
        
        // Resetear el selector de razas al valor por defecto
        updateRazasSelect();
        
        // Limpiar servicios seleccionados
        selectedServices = [];
        updateSelectedServicesList();
        updateTotalPrice();
        
        // Actualizar la UI de servicios
        const serviceItems = document.querySelectorAll('.service-item');
        serviceItems.forEach(item => {
            item.classList.remove('selected');
            const checkbox = item.querySelector('.service-checkbox');
            if (checkbox) {
                checkbox.checked = false;
            }
        });
    }
}

// Renderizar tickets de laboratorio
function renderLabTickets(filter = 'todos', medicoFilter = '') {
    const container = document.getElementById('labTicketContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Filtrar tickets por estado
    let filteredTickets = filterLabTickets(labTickets, filter);

    // Solo aplicar filtro de fecha para reportado_cliente y cliente_no_contesta
    // Para "reportado" (Reportado Lab), NO aplicar filtro de fecha - mostrar todos
    const fechaFilter = document.getElementById('labFilterDate');
    if (
        (filter === 'reportado_cliente' || filter === 'cliente_no_contesta') &&
        fechaFilter && fechaFilter.value
    ) {
        const selectedDate = fechaFilter.value;
        filteredTickets = filteredTickets.filter(ticket => {
            // Verificar múltiples campos de fecha para mayor compatibilidad
            return ticket.fechaCreacion === selectedDate || 
                   ticket.fecha === selectedDate ||
                   (ticket.fechaReportado && ticket.fechaReportado === selectedDate) ||
                   (ticket.fechaReportadoCliente && ticket.fechaReportadoCliente === selectedDate);
        });
    }
    // Para pendiente, procesando, laboratorio_externo, internos y reportado, NO filtrar por fecha
    
    // Aplicar filtro de médico - para "reportado" no aplicar restricción de fecha
    if (medicoFilter && medicoFilter.trim() !== '') {
        if (filter === 'reportado') {
            // Para "Reportado Lab", filtrar por médico sin restricción de fecha
            filteredTickets = filteredTickets.filter(ticket => {
                return ticket.medicoSolicita && 
                       ticket.medicoSolicita.toLowerCase().includes(medicoFilter.toLowerCase());
            });
        } else if (filter === 'reportado_cliente' || filter === 'cliente_no_contesta') {
            // Para otros estados reportados, aplicar filtro de médico normalmente
            filteredTickets = filteredTickets.filter(ticket => {
                return ticket.medicoSolicita && 
                       ticket.medicoSolicita.toLowerCase().includes(medicoFilter.toLowerCase());
            });
        }
    }
    
    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="no-tickets">
                <i class="fas fa-vials" style="font-size: 3rem; color: #bdc3c7; margin-bottom: 15px;"></i>
                <h3>No hay tickets de laboratorio</h3>
                <p>No se encontraron tickets para los filtros seleccionados.</p>
            </div>
        `;
        return;
    }
    
    // Ordenar tickets por fecha y hora de creación (más recientes primero)
    filteredTickets.sort((a, b) => {
        const dateA = new Date(`${a.fechaCreacion} ${a.horaCreacion}`);
        const dateB = new Date(`${b.fechaCreacion} ${b.horaCreacion}`);
        return dateB - dateA;
    });
    
    // Renderizar cada ticket
    filteredTickets.forEach(ticket => {
        const ticketElement = createLabTicketElement(ticket);
        container.appendChild(ticketElement);
    });
}

// Filtrar tickets de laboratorio
function filterLabTickets(tickets, filter) {
    if (filter === 'todos') {
        return tickets;
    }
      return tickets.filter(ticket => {        switch (filter) {
            case 'pendiente':
                return ticket.estado === 'pendiente';            case 'procesando':
                return ticket.estado === 'procesando';
            case 'reportado':
                return ticket.estado === 'reportado';
            case 'reportado_cliente':
                return ticket.estado === 'reportado_cliente';
            case 'laboratorio_externo':
                return ticket.estado === 'laboratorio_externo';
            case 'cliente_no_contesta':
                return ticket.estado === 'cliente_no_contesta';
            case 'internos':
                return ticket.departamento === 'internos';
            default:
                return true;
        }
    });
}

// Crear elemento HTML para ticket de laboratorio
function createLabTicketElement(ticket) {
    const ticketDiv = document.createElement('div');
    ticketDiv.className = 'lab-ticket';
    ticketDiv.setAttribute('data-ticket-id', ticket.randomId);
    
    // Icono del animal
    const animalIcon = getAnimalIcon(ticket.tipoMascota);    // Estado del ticket
    const estadoTicket = getLabStatusDisplay(ticket.estado, ticket);
    const prioridad = getLabPriorityDisplay(ticket.prioridad);
    
    // Obtener el nombre del departamento
    const departamentoNombre = getDepartmentName(ticket.departamento);
    
    ticketDiv.innerHTML = `
        <div class="lab-ticket-header">
            <div class="lab-ticket-id">Lab #${ticket.id}</div>
            <div class="lab-ticket-priority ${ticket.prioridad}">${prioridad}</div>
        </div>
          <div class="lab-ticket-content">
            <div class="lab-ticket-info">
                <h4>${animalIcon} ${ticket.mascota}</h4>
                <div class="lab-ticket-details">                    <div class="lab-ticket-detail">
                        <i class="fas fa-user"></i>
                        <span><strong>Cliente:</strong> ${ticket.nombre}</span>
                    </div>
                    ${ticket.cedula ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-id-card-alt"></i>
                            <span><strong>Cédula:</strong> ${ticket.cedula}</span>
                        </div>
                    ` : ''}
                    <div class="lab-ticket-detail">
                        <i class="fas fa-id-card"></i>
                        <span><strong>ID Paciente:</strong> ${ticket.idPaciente}</span>
                    </div>
                    ${ticket.edad ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-birthday-cake"></i>
                            <span><strong>Edad:</strong> ${ticket.edad}</span>
                        </div>
                    ` : ''}
                    ${ticket.raza ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-paw"></i>
                            <span><strong>Raza:</strong> ${ticket.raza}</span>
                        </div>
                    ` : ''}
                    ${ticket.peso ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-weight"></i>
                            <span><strong>Peso:</strong> ${ticket.peso}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="lab-ticket-info">
                <div class="lab-ticket-details">
                    ${ticket.sexo ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-venus-mars"></i>
                            <span><strong>Sexo:</strong> ${ticket.sexo.charAt(0).toUpperCase() + ticket.sexo.slice(1)}</span>
                        </div>
                    ` : ''}
                    <div class="lab-ticket-detail">
                        <i class="fas fa-calendar"></i>
                        <span><strong>Fecha:</strong> ${formatDate(ticket.fecha)}</span>
                    </div>
                    <div class="lab-ticket-detail">
                        <i class="fas fa-clock"></i>
                        <span><strong>Hora:</strong> ${ticket.horaCreacion}</span>
                    </div>                    <div class="lab-ticket-detail">
                        <i class="fas fa-user-md"></i>
                        <span><strong>Médico:</strong> ${formatMedicoWithLineBreak(ticket.medicoSolicita)}</span>
                    </div>
                    ${ticket.examenRegalia === 'si' ? `
                        <div class="lab-ticket-detail examen-regalia">
                            <i class="fas fa-crown" style="color: #f1c40f;"></i>
                            <span><strong>Examen de Regalía</strong></span>
                            ${ticket.firmaDigital ? `
                                <div class="firma-digital" style="margin-top: 5px;">
                                    <i class="fas fa-signature" style="color: #27ae60;"></i>
                                    <small style="color: #27ae60;">Firmado digitalmente</small>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="lab-ticket-detail">
                        <i class="fas fa-building"></i>
                        <span><strong>Departamento:</strong> ${departamentoNombre}</span>
                    </div>
                    ${ticket.factura ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-file-invoice"></i>
                            <span><strong>Factura:</strong> ${ticket.factura}</span>
                        </div>
                    ` : ''}
                    ${ticket.correo ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-envelope"></i>
                            <span><strong>Email:</strong> ${formatEmailWithLineBreak(ticket.correo)}</span>
                        </div>
                    ` : ''}
                    ${ticket.telefono ? `
                        <div class="lab-ticket-detail">
                            <i class="fas fa-phone"></i>
                            <span><strong>Teléfono:</strong> ${ticket.telefono}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <!-- Servicios y estado al final -->
        <div class="lab-ticket-bottom">
            <div class="lab-ticket-servicios">
                <strong>Servicios:</strong>
                ${getServicesDisplayForTicket(ticket)}
            </div>            ${ticket.observaciones ? `
                <div class="lab-ticket-observaciones">
                    <strong>Observaciones:</strong>
                    <p>${ticket.observaciones}</p>
                </div>
            ` : ''}
            ${ticket.notasLaboratorio ? `
                <div class="lab-ticket-notas-lab">
                    <strong>Notas de Laboratorio:</strong>
                    <p>${ticket.notasLaboratorio}</p>
                </div>
            ` : ''}
            ${ticket.paquete && ticket.paquete !== 'no_aplica' ? `
                <div class="lab-ticket-paquete">
                    <strong>Tipo de Paquete:</strong>
                    <span class="paquete-badge paquete-${ticket.paquete}">
                        ${ticket.paquete === 'castracion' ? '🔸 Paquete de Castración' : '🔹 Paquete de Limpieza'}
                    </span>
                </div>
            ` : ''}
            <div class="lab-ticket-status ${ticket.estado}">
                ${estadoTicket}
            </div>
        </div><div class="lab-ticket-actions">
            ${getDeleteButtonForRole(ticket.randomId)}
        </div>
    `;
    
    // Agregar evento click al ticket completo para editar
    ticketDiv.addEventListener('click', function(e) {
        // Solo abrir para editar si no se hizo clic en el botón de eliminar
        if (!e.target.closest('.lab-btn-delete')) {
            editLabTicket(ticket.randomId);
        }
    });
    
    // Agregar estilo cursor pointer para indicar que es clickeable
    ticketDiv.style.cursor = 'pointer';
    
    return ticketDiv;
}

// Obtener botón de eliminar solo para admin
function getDeleteButtonForRole(randomId) {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole === 'admin') {
        return `
            <button class="lab-btn lab-btn-delete" onclick="deleteLabTicket('${randomId}')">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        `;
    }
    return '';
}

// Obtener icono del animal
function getAnimalIcon(tipoMascota) {
    const icons = {
        'perro': '<i class="fas fa-dog"></i>',
        'gato': '<i class="fas fa-cat"></i>',
        'conejo': '<i class="fas fa-dove"></i>',
        'otro': '<i class="fas fa-paw"></i>'
    };
    return icons[tipoMascota] || icons['otro'];
}

// Obtener display de servicios para ticket (con checkboxes de estado solo para laboratorio y admin)
function getServicesDisplayForTicket(ticket) {
    const userRole = sessionStorage.getItem('userRole');
    const canEditServices = userRole === 'laboratorio' || userRole === 'admin';
    
    // Si el ticket tiene servicios seleccionados (nuevo formato)
    if (ticket.serviciosSeleccionados && ticket.serviciosSeleccionados.length > 0) {
        const servicesHtml = ticket.serviciosSeleccionados.map((service, index) => {
            const isCompleted = service.realizado || false;
            const checkboxId = `service-${ticket.randomId}-${index}`;
            
            if (canEditServices) {
                // Para usuarios de laboratorio y admin: mostrar checkbox interactivo
                return `
                    <div class="ticket-service-item ${isCompleted ? 'completed' : ''}">
                        <label class="service-checkbox-label">
                            <input type="checkbox" 
                                   id="${checkboxId}"
                                   class="service-status-checkbox" 
                                   ${isCompleted ? 'checked' : ''}
                                   onchange="toggleServiceStatus('${ticket.randomId}', ${index})"
                                   onclick="event.stopPropagation()">
                            <span class="service-name">${service.nombre}</span>
                            <span class="service-status">${isCompleted ? '✅ Realizado' : '⏳ Pendiente'}</span>
                        </label>
                    </div>
                `;
            } else {
                // Para otros usuarios: mostrar solo el estado sin checkbox
                return `
                    <div class="ticket-service-item ${isCompleted ? 'completed' : ''} readonly">
                        <div class="service-info-display">
                            <span class="service-name">${service.nombre}</span>
                            <span class="service-status">${isCompleted ? '✅ Realizado' : '⏳ Pendiente'}</span>
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        return `
            <div class="ticket-services-list">
                ${servicesHtml}
            </div>
        `;
    }
    // Si el ticket tiene el formato anterior (tipoExamen)
    else if (ticket.tipoExamen) {
        return `<div class="ticket-service-legacy">${getLabExamName(ticket.tipoExamen)}</div>`;
    }    // Fallback
    else {
        return '<div class="ticket-service-none">No se especificaron servicios</div>';
    }
}

// Función para cambiar el estado de realización de un servicio (solo para usuarios de laboratorio)
function toggleServiceStatus(ticketRandomId, serviceIndex) {
    // Verificar que el usuario tiene permisos de laboratorio
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'laboratorio') {
        showNotification('Solo los usuarios de laboratorio pueden cambiar el estado de los servicios', 'error');
        return;
    }
    
    const ticket = labTickets.find(t => t.randomId === ticketRandomId);
    if (!ticket || !ticket.serviciosSeleccionados || !ticket.serviciosSeleccionados[serviceIndex]) {
        console.error('Ticket o servicio no encontrado');
        return;
    }
    
    // Cambiar el estado del servicio
    ticket.serviciosSeleccionados[serviceIndex].realizado = !ticket.serviciosSeleccionados[serviceIndex].realizado;
    
    // Actualizar en Firebase
    if (ticket.firebaseKey) {
        const ticketToUpdate = { ...ticket };
        delete ticketToUpdate.firebaseKey;
        
        labTicketsRef.child(ticket.firebaseKey).update(ticketToUpdate)            .then(() => {
                const serviceName = ticket.serviciosSeleccionados[serviceIndex].nombre;
                const status = ticket.serviciosSeleccionados[serviceIndex].realizado ? 'realizado' : 'pendiente';
                showNotification(`Servicio "${serviceName}" marcado como ${status}`, 'success');
                
                // Actualizar la vista manteniendo filtros activos
                const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
                const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
                const medicoFilter = document.getElementById('labMedicoFilter');
                const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
                
                renderLabTickets(currentStateFilter, currentMedicoFilter);
            })
            .catch(error => {
                console.error('Error actualizando estado del servicio:', error);
                showNotification('Error al actualizar el estado del servicio', 'error');                // Revertir el cambio en caso de error
                ticket.serviciosSeleccionados[serviceIndex].realizado = !ticket.serviciosSeleccionados[serviceIndex].realizado;
            });
    }
}

// Hacer la función disponible globalmente
window.toggleServiceStatus = toggleServiceStatus;

// Obtener nombre del examen
function getLabExamName(tipoExamen) {
    const examNames = {
        'hemograma': 'Hemograma Completo',
        'bioquimica': 'Bioquímica Sanguínea',
        'urinalisis': 'Urianálisis',
        'coprologia': 'Coprología',
        'test_distemper': 'Test de Distemper',
        'test_parvovirus': 'Test de Parvovirus',
        'test_felv_fiv': 'Test FeLV/FIV',
        'panel_basico': 'Panel Básico',
        'panel_completo': 'Panel Completo',
        'perfil_renal': 'Perfil Renal',
        'perfil_hepatico': 'Perfil Hepático',
        'tiempos_coagulacion': 'Tiempos de Coagulación',
        'otro': 'Otro'
    };
    return examNames[tipoExamen] || tipoExamen;
}

// Obtener display del estado de laboratorio
function getLabStatusDisplay(estado, ticket = null) {
    const statuses = {
        'pendiente': 'Pendiente',
        'procesando': 'En proceso',
        'reportado': 'Reportado Lab',
        'reportado_cliente': 'Reportado al Cliente',
        'laboratorio_externo': 'Laboratorio Externo',
        'cliente_no_contesta': 'Cliente no contesta'
    };
    
    let statusText = statuses[estado] || estado;
      // Agregar fecha y hora para estados reportados
    if (ticket) {
        if (estado === 'reportado_cliente' && ticket.fechaReportadoCliente && ticket.horaReportadoCliente) {
            statusText += `<br><small style="color: #666; font-size: 0.85em; display: block; margin-top: 4px;">
                <i class="fas fa-clock" style="margin-right: 4px;"></i>
                Reportado: ${formatDate(ticket.fechaReportadoCliente)} - ${ticket.horaReportadoCliente}
            </small>`;
        } else if (estado === 'reportado' && ticket.fechaReportado && ticket.horaReportado) {
            statusText += `<br><small style="color: #666; font-size: 0.85em; display: block; margin-top: 4px;">
                <i class="fas fa-clock" style="margin-right: 4px;"></i>
                Reportado: ${formatDate(ticket.fechaReportado)} - ${ticket.horaReportado}
            </small>`;
        }
    }
    
    return statusText;
}

// Obtener display de prioridad
function getLabPriorityDisplay(prioridad) {
    const priorities = {
        'rutina': '🟢 Normal',
        'urgente': '🟠 Urgente',
        'emergencia': '🔴 Emergencia'
    };
    return priorities[prioridad] || prioridad;
}

// Formatear nombre del médico con salto de línea en el apellido
function formatMedicoWithLineBreak(medicoName) {
    if (!medicoName) return '';
    
    // Dividir el nombre en palabras
    const words = medicoName.trim().split(' ');
    
    if (words.length <= 1) {
        return medicoName; // Si solo hay una palabra, devolverla sin cambios
    }
    
    // Si hay más de una palabra, poner br antes de la última palabra (apellido)
    const nombres = words.slice(0, -1).join(' ');
    const apellido = words[words.length - 1];
    
    return `${nombres}<br>${apellido}`;
}

// Formatear correo electrónico con salto de línea después del @
function formatEmailWithLineBreak(email) {
    if (!email) return '';
    
    // Si contiene @, dividir y agregar br después del @
    if (email.includes('@')) {
        return email.replace('@', '@<br>');
    }
    
    return email; // Si no tiene @, devolverlo sin cambios
}

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Obtener etiqueta del estado
function getEstadoLabel(estado) {
    const estados = {
        'espera': 'En Espera',
        'consultorio1': 'Consultorio 1',
        'consultorio2': 'Consultorio 2',
        'consultorio3': 'Consultorio 3',
        'consultorio4': 'Consultorio 4',
        'consultorio5': 'Consultorio 5',
        'rayosx': 'Rayos X',
        'quirofano': 'Quirófano',
        'terminado': 'Terminado',
        'cliente_se_fue': 'Cliente se fue'
    };
    return estados[estado] || estado;
}

// Editar ticket de laboratorio
function editLabTicket(randomId) {
    const ticket = labTickets.find(t => t.randomId === randomId);
    if (!ticket) {
        showNotification('Ticket no encontrado', 'error');
        return;
    }
    
    // Crear modal de edición
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale" style="max-width: 800px;">
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <h3><i class="fas fa-edit"></i> Editar Ticket de Laboratorio #${ticket.id}</h3>
            <form id="editLabForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Cliente</label>
                        <input type="text" id="editLabNombre" value="${ticket.nombre}" required>
                    </div>
                    <div class="form-group">
                        <label>Cédula</label>
                        <input type="text" id="editLabCedula" value="${ticket.cedula}" required>
                    </div>                </div>                <div class="form-row">
                    <div class="form-group">
                        <label>Mascota</label>
                        <input type="text" id="editLabMascota" value="${ticket.mascota}" required>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Mascota</label>
                        <select id="editLabTipoMascota" required>
                            <option value="perro" ${ticket.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                            <option value="gato" ${ticket.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                            <option value="conejo" ${ticket.tipoMascota === 'conejo' ? 'selected' : ''}>Conejo</option>
                            <option value="otro" ${ticket.tipoMascota === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Edad</label>
                        <input type="text" id="editLabEdad" value="${ticket.edad || ''}" placeholder="Ej: 2 años, 6 meses">
                    </div>
                    <div class="form-group">
                        <label>Raza</label>
                        <select id="editLabRaza" required>
                            <option value="">Seleccionar raza</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Peso</label>
                        <input type="text" id="editLabPeso" value="${ticket.peso || ''}" placeholder="Ej: 5.2 kg, 3 libras">
                    </div>
                    <div class="form-group">
                        <label>Sexo</label>
                        <select id="editLabSexo" required>
                            <option value="">Seleccionar</option>
                            <option value="macho" ${ticket.sexo === 'macho' ? 'selected' : ''}>Macho</option>
                            <option value="hembra" ${ticket.sexo === 'hembra' ? 'selected' : ''}>Hembra</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>ID del Paciente</label>
                        <input type="text" id="editLabIdPaciente" value="${ticket.idPaciente || ''}" required>
                    </div>
                    <div class="form-group">
                        <!-- Espacio vacío para balance del layout -->
                    </div>
                </div>
                <!-- Servicios de Laboratorio -->
                <div class="form-group full-width">
                    <label>Servicios de Laboratorio</label>
                    <div class="service-selection-edit">
                        <div class="service-filters">
                            <select id="editCategoryFilter">
                                <option value="">Todos los servicios</option>
                            </select>
                            <input type="text" id="editServiceSearch" placeholder="Buscar servicios...">
                        </div>
                        
                        <div class="selected-services-edit">
                            <h4>Servicios Seleccionados</h4>
                            <div id="editSelectedServicesList" class="selected-services-list"></div>
                            <div id="editTotalPrice" class="total-price">
                                <strong>Total: ₡0</strong>
                            </div>
                        </div>
                        
                        <div class="services-grid-edit">
                            <div id="editServicesList" class="services-list"></div>
                        </div>
                    </div>
                </div>                <div class="form-row">
                    <div class="form-group">
                        <label>Estado del Ticket</label>
                        <select id="editLabEstado" required>
                            <option value="pendiente" ${ticket.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="procesando" ${ticket.estado === 'procesando' ? 'selected' : ''}>En proceso</option>
                            ${getUserReportOption(ticket)}
                        </select>
                    </div>
                </div><div class="form-row">
                    <div class="form-group">
                        <label>Médico que Solicita</label>
                        <input type="text" id="editLabMedico" value="${ticket.medicoSolicita}" required>
                    </div>
                    <div class="form-group">
                        <label>Prioridad</label>                        <select id="editLabPrioridad" required>
                            <option value="rutina" ${ticket.prioridad === 'rutina' ? 'selected' : ''}>🟢 Normal</option>
                            <option value="urgente" ${ticket.prioridad === 'urgente' ? 'selected' : ''}>🟠 Urgente</option>
                            <option value="emergencia" ${ticket.prioridad === 'emergencia' ? 'selected' : ''}>🔴 Emergencia</option>
                        </select>
                    </div>
                </div>
                  <div class="form-row">
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="text" id="editLabCorreo" value="${ticket.correo || ''}" placeholder="Ejemplo: correo@ejemplo.com o cualquier texto">
                    </div>
                    <div class="form-group">
                        <label>Teléfono de Contacto</label>
                        <input type="tel" id="editLabTelefono" value="${ticket.telefono || ''}" placeholder="Número de teléfono">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Número de Factura</label>
                        <input type="text" id="editLabFactura" value="${ticket.factura || ''}" placeholder="Número de factura">
                    </div>
                    <div class="form-group">                        <label>Departamento que Solicita</label>
                        <select id="editLabDepartamento" required>
                            <option value="consulta_externa" ${ticket.departamento === 'consulta_externa' ? 'selected' : ''}>Consulta Externa</option>
                            <option value="internos" ${ticket.departamento === 'internos' ? 'selected' : ''}>Internos</option>
                        </select>
                    </div>
                </div>
                
                <!-- Campo de examen de regalía y firma digital -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="editLabExamenRegalia" style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-crown" style="color: #f1c40f;"></i>
                            Examen de Regalía
                        </label>
                        <select id="editLabExamenRegalia" required>
                            <option value="no" ${(ticket.examenRegalia || 'no') === 'no' ? 'selected' : ''}>No</option>
                            <option value="si" ${ticket.examenRegalia === 'si' ? 'selected' : ''}>Sí</option>
                        </select>
                    </div>
                    <div class="form-group" id="editFirmaContainer" style="display: ${ticket.examenRegalia === 'si' && sessionStorage.getItem('userRole') === 'admin' ? 'block' : 'none'};">
                        <label>Firma Digital del Administrador</label>
                        <div style="border: 1px solid #ccc; border-radius: 8px; background: #fff; padding: 10px;">
                            <canvas id="editFirmaCanvas" width="300" height="100" style="border: 1px solid #aaa; border-radius: 6px; background: #fafafa; cursor: crosshair;"></canvas>
                            <div style="margin-top: 8px;">
                                <button type="button" id="editLimpiarFirmaBtn" style="margin-right: 10px;">Limpiar Firma</button>
                                ${ticket.firmaDigital ? '<span style="color: #27ae60;"><i class="fas fa-check"></i> Ya firmado</span>' : ''}
                            </div>
                        </div>
                        <input type="hidden" id="editFirmaBase64" name="editFirmaBase64" value="${ticket.firmaDigital || ''}">
                        <small style="color: #888;">Solo disponible para administradores en exámenes de regalía.</small>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="editLabObservaciones" rows="3">${ticket.observaciones || ''}</textarea>
                </div>
                
                <!-- Nuevos campos -->
                <div class="form-row">
                    <div class="form-group">
                        <label>Notas de Laboratorio</label>
                        <textarea id="editLabNotasLaboratorio" rows="3" placeholder="Notas específicas del laboratorio...">${ticket.notasLaboratorio || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Paquete</label>
                        <select id="editLabPaquete" required>
                            <option value="no_aplica" ${(ticket.paquete || 'no_aplica') === 'no_aplica' ? 'selected' : ''}>No Aplica</option>
                            <option value="castracion" ${ticket.paquete === 'castracion' ? 'selected' : ''}>Paquete de Castración</option>
                            <option value="limpieza" ${ticket.paquete === 'limpieza' ? 'selected' : ''}>Paquete de Limpieza</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Cambios</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar sincronización de facturas para el campo de edición
    setupLabFacturaSyncForEdit(ticket.randomId);
      // Manejar envío del formulario de edición
    document.getElementById('editLabForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validar que al menos un servicio esté seleccionado
        if (selectedServices.length === 0) {
            showNotification('Debe seleccionar al menos un servicio', 'error');
            return;
        }
          const updatedData = {
            ...ticket,
            nombre: document.getElementById('editLabNombre').value.trim(),
            cedula: document.getElementById('editLabCedula').value.trim(),
            mascota: document.getElementById('editLabMascota').value.trim(),
            tipoMascota: document.getElementById('editLabTipoMascota').value,
            edad: document.getElementById('editLabEdad').value.trim(),
            raza: document.getElementById('editLabRaza').value,
            peso: document.getElementById('editLabPeso').value.trim(),
            sexo: document.getElementById('editLabSexo').value,
            idPaciente: document.getElementById('editLabIdPaciente').value.trim(),
            serviciosSeleccionados: [...selectedServices],
            estado: document.getElementById('editLabEstado').value,
            medicoSolicita: document.getElementById('editLabMedico').value.trim(),
            examenRegalia: document.getElementById('editLabExamenRegalia').value,
            firmaDigital: document.getElementById('editFirmaBase64').value,
            prioridad: document.getElementById('editLabPrioridad').value,            correo: document.getElementById('editLabCorreo').value.trim(),
            telefono: document.getElementById('editLabTelefono').value.trim(),
            factura: document.getElementById('editLabFactura').value.trim(),
            departamento: document.getElementById('editLabDepartamento').value,
            observaciones: document.getElementById('editLabObservaciones').value.trim(),
            notasLaboratorio: document.getElementById('editLabNotasLaboratorio').value.trim(),
            paquete: document.getElementById('editLabPaquete').value
        };
        
        // Validar datos antes de guardar
        if (!validateLabTicketData(updatedData)) {
            return;
        }
        
        saveEditedLabTicket(updatedData);
    });
    
    // Configurar event listeners para examen de regalía y firma digital
    setupEditExamenRegaliaAndFirma(ticket);
      
    // Inicializar el sistema de servicios para edición
    initEditServiceSelection(ticket);
    
    // Configurar el selector de razas para edición
    setupEditRazasSelector(ticket);
}

// Función para configurar el selector de razas en el modal de edición
function setupEditRazasSelector(ticket) {
    const editTipoMascota = document.getElementById('editLabTipoMascota');
    const editRazaSelect = document.getElementById('editLabRaza');
    
    if (!editTipoMascota || !editRazaSelect) return;
    
    // Función para actualizar las razas en el modal de edición
    function updateEditRazasSelect() {
        const tipoMascota = editTipoMascota.value;
        
        // Limpiar opciones existentes
        editRazaSelect.innerHTML = '';
        
        let razas = [];
        
        switch (tipoMascota) {
            case 'perro':
                razas = razasCaninas;
                break;
            case 'gato':
                razas = razasFelinas;
                break;
            case 'conejo':
            case 'otro':
                razas = razasOtras;
                break;
            default:
                razas = ['SRD'];
        }
        
        // Agregar opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccionar raza';
        editRazaSelect.appendChild(defaultOption);
        
        // Agregar las razas correspondientes
        razas.forEach(raza => {
            const option = document.createElement('option');
            option.value = raza;
            option.textContent = raza;
            // Seleccionar la raza actual del ticket si coincide
            if (ticket.raza === raza) {
                option.selected = true;
            }
            editRazaSelect.appendChild(option);
        });
    }
    
    // Configurar listener para cambio de tipo de mascota
    editTipoMascota.addEventListener('change', updateEditRazasSelect);
    
    // Inicializar las razas con el tipo actual
    updateEditRazasSelect();
}

// Funciones de sincronización de facturas para laboratorio
function setupLabFacturaSyncForEdit(ticketId) {
    const facturaInput = document.getElementById('editLabFactura');
    if (facturaInput) {
        let timeoutId = null;
        
        facturaInput.addEventListener('input', function(e) {
            const facturaValue = e.target.value.trim();
            
            // Limpiar timeout anterior
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Esperar 1 segundo después de que el usuario deje de escribir
            timeoutId = setTimeout(() => {
                if (facturaValue && facturaValue.length >= 3) {
                    // Usar la función global si está disponible
                    if (typeof window.syncFacturaBetweenSystems === 'function') {
                        window.syncFacturaBetweenSystems(facturaValue, ticketId, 'laboratorio');
                    }
                }
            }, 1000);
        });
    }
}

function setupLabFacturaSyncForCreate() {
    const facturaInput = document.getElementById('labFactura');
    if (facturaInput) {
        let timeoutId = null;
        
        facturaInput.addEventListener('input', function(e) {
            const facturaValue = e.target.value.trim();
            
            // Limpiar timeout anterior
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Esperar 1 segundo después de que el usuario deje de escribir
            timeoutId = setTimeout(() => {
                if (facturaValue && facturaValue.length >= 3) {
                    // Para formulario de creación, buscar por cédula/ID del paciente
                    const cedula = document.getElementById('labCedula').value.trim();
                    const idPaciente = document.getElementById('labIdPaciente').value.trim();
                    
                    if (cedula || idPaciente) {
                        syncLabFacturaToConsultaByClienteData(facturaValue, cedula, idPaciente);
                    }
                }
            }, 1000);
        });
    }
}

function syncLabFacturaToConsultaByClienteData(facturaNumero, cedula, idPaciente) {
    try {
        // Acceder a tickets desde el sistema principal
        if (window.tickets && Array.isArray(window.tickets)) {
            const consultaTicketsToUpdate = window.tickets.filter(consultaTicket => {
                return (consultaTicket.cedula === cedula || consultaTicket.idPaciente === idPaciente) &&
                       (!consultaTicket.numFactura || consultaTicket.numFactura.trim() === '');
            });
            
            consultaTicketsToUpdate.forEach(consultaTicket => {
                if (typeof window.updateConsultaTicketFactura === 'function') {
                    window.updateConsultaTicketFactura(consultaTicket.firebaseKey, facturaNumero);
                }
            });
            
            if (consultaTicketsToUpdate.length > 0) {
                showNotification(`Factura sincronizada con ${consultaTicketsToUpdate.length} ticket(s) de consulta`, 'success');
            }
        }
    } catch (error) {
        console.error('Error sincronizando factura desde laboratorio:', error);
    }
}

// Guardar ticket de laboratorio editado
function saveEditedLabTicket(ticket) {
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        showLoadingButton(saveButton);
    }
    
    const ticketToSave = { ...ticket };
    delete ticketToSave.firebaseKey;
    
    labTicketsRef.child(ticket.firebaseKey).update(ticketToSave)        .then(() => {
            showNotification('Ticket de laboratorio actualizado correctamente', 'success');
            closeModal();
            
            // Mantener filtros activos al actualizar
            const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
            const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
            const medicoFilter = document.getElementById('labMedicoFilter');
            const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
            
            renderLabTickets(currentStateFilter, currentMedicoFilter);
            updateLabStats();
        })
        .catch(error => {
            console.error('Error actualizando ticket de laboratorio:', error);
            showNotification('Error al actualizar el ticket', 'error');
        })
        .finally(() => {
            if (saveButton) {
                hideLoadingButton(saveButton);
            }
        });
}

// Cambiar estado del ticket de laboratorio
function changeLabStatus(randomId) {
    const ticket = labTickets.find(t => t.randomId === randomId);
    if (!ticket) return;    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3>Cambiar Estado - Lab #${ticket.id}</h3>
            <form id="labStatusForm">
                <div class="form-group">
                    <label for="changeLabEstado">Estado del Ticket</label>
                    <select id="changeLabEstado" required>
                        <option value="pendiente" ${ticket.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="procesando" ${ticket.estado === 'procesando' ? 'selected' : ''}>En proceso</option>
                        ${getUserReportOption(ticket)}
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Estado</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
      document.getElementById('labStatusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nuevoEstado = document.getElementById('changeLabEstado').value;
          const updatedTicket = {
            ...ticket,
            estado: nuevoEstado
        };
        
        // Si se marca como reportado (laboratorio), agregar fecha y hora
        if (nuevoEstado === 'reportado' && ticket.estado !== 'reportado') {
            updatedTicket.fechaReportado = getLocalDateString();
            updatedTicket.horaReportado = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Si se marca como reportado al cliente, agregar fecha y hora
        if (nuevoEstado === 'reportado_cliente' && ticket.estado !== 'reportado_cliente') {
            updatedTicket.fechaReportadoCliente = getLocalDateString();
            updatedTicket.horaReportadoCliente = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        
        saveEditedLabTicket(updatedTicket);
    });
}

// Imprimir ticket de laboratorio
// Eliminar ticket de laboratorio
function deleteLabTicket(randomId) {
    const ticket = labTickets.find(t => t.randomId === randomId);
    if (!ticket) return;
    
    const animalIcon = getAnimalIcon(ticket.tipoMascota);
    
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">            <h3><i class="fas fa-exclamation-triangle" style="color: var(--accent-color);"></i> Eliminar ticket de laboratorio</h3>
            <div style="text-align: center; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                    ${animalIcon}
                    <span style="font-size: 1.2rem;">${ticket.mascota}</span>
                </div>
                <p>¿Estás seguro que deseas eliminar el ticket de laboratorio #${ticket.id}?</p>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #777;">Esta acción no se puede deshacer.</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
                <button class="btn-delete" onclick="confirmDeleteLabTicket('${ticket.firebaseKey}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Confirmar eliminación de ticket de laboratorio
function confirmDeleteLabTicket(firebaseKey) {
    const deleteButton = document.querySelector('.btn-delete');
    if (deleteButton) {
        showLoadingButton(deleteButton);
    }
    
    labTicketsRef.child(firebaseKey).remove()        .then(() => {
            showNotification('Ticket de laboratorio eliminado correctamente', 'success');
            closeModal();
            
            // Mantener filtros activos al eliminar
            const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
            const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
            const medicoFilter = document.getElementById('labMedicoFilter');
            const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
            
            renderLabTickets(currentStateFilter, currentMedicoFilter);
            updateLabStats();
        })
        .catch(error => {
            console.error('Error eliminando ticket de laboratorio:', error);
            showNotification('Error al eliminar el ticket', 'error');
        })
        .finally(() => {
            if (deleteButton) {
                hideLoadingButton(deleteButton);
            }
        });
}

// Filtrar tickets por búsqueda
function filterLabTicketsBySearch(searchTerm) {
    const tickets = document.querySelectorAll('.lab-ticket');
    
    tickets.forEach(ticket => {
        const ticketText = ticket.textContent.toLowerCase();
        if (ticketText.includes(searchTerm)) {
            ticket.style.display = 'block';
        } else {
            ticket.style.display = 'none';
        }
    });
}

// Filtrar tickets por fecha
function filterLabTicketsByDate(selectedDate) {
    if (!selectedDate) {
        renderLabTickets();
        return;
    }
    
    const filteredTickets = labTickets.filter(ticket => ticket.fecha === selectedDate);
    
    const container = document.getElementById('labTicketContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="no-tickets">
                <i class="fas fa-calendar-times" style="font-size: 3rem; color: #bdc3c7; margin-bottom: 15px;"></i>
                <h3>No hay tickets para esta fecha</h3>
                <p>No se encontraron tickets de laboratorio para el ${formatDate(selectedDate)}.</p>
            </div>
        `;
        return;
    }
    
    filteredTickets.forEach(ticket => {
        const ticketElement = createLabTicketElement(ticket);
        container.appendChild(ticketElement);
    });
}

// Actualizar estadísticas de laboratorio
function updateLabStats() {
    const stats = {
        total: labTickets.length,
        pendientes: labTickets.filter(t => t.estado === 'pendiente').length,
        procesando: labTickets.filter(t => t.estado === 'procesando').length,
        reportados: labTickets.filter(t => t.estado === 'reportado').length,
        reportadosCliente: labTickets.filter(t => t.estado === 'reportado_cliente').length,
        laboratorioExterno: labTickets.filter(t => t.estado === 'laboratorio_externo').length,
        clienteNoContesta: labTickets.filter(t => t.estado === 'cliente_no_contesta').length,
        internos: labTickets.filter(t => t.departamento === 'internos').length
    };
    
    // Actualizar elementos del DOM
    const totalElement = document.getElementById('totalLabTickets');
    const pendientesElement = document.getElementById('pendientesLab');
    const procesandoElement = document.getElementById('procesandoLab');
    const reportadosElement = document.getElementById('reportadosLab');
    const reportadosClienteElement = document.getElementById('reportadosClienteLab');
    const laboratorioExternoElement = document.getElementById('laboratorioExternoLab');
    const clienteNoContestaElement = document.getElementById('clienteNoContestaLab');
    const internosElement = document.getElementById('internosLab');
    
    if (totalElement) totalElement.textContent = stats.total;
    if (pendientesElement) pendientesElement.textContent = stats.pendientes;
    if (procesandoElement) procesandoElement.textContent = stats.procesando;
    if (reportadosElement) reportadosElement.textContent = stats.reportados;
    if (reportadosClienteElement) reportadosClienteElement.textContent = stats.reportadosCliente;
    if (laboratorioExternoElement) laboratorioExternoElement.textContent = stats.laboratorioExterno;
    if (clienteNoContestaElement) clienteNoContestaElement.textContent = stats.clienteNoContesta;
    if (internosElement) internosElement.textContent = stats.internos;
    if (reportadosClienteElement) reportadosClienteElement.textContent = stats.reportadosCliente;
}

// Obtener nombre del departamento
function getDepartmentName(departamento) {
    const departments = {
        'consulta_externa': 'Consulta Externa',
        'internos': 'Internos'
    };
    return departments[departamento] || departamento;
}

// Mostrar indicador de actualización de datos
function showClientesUpdateIndicator() {
    const searchInput = document.getElementById('labClienteSearch');
    if (!searchInput) return;
    
    // Crear o actualizar indicador
    let indicator = document.getElementById('clientesUpdateIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'clientesUpdateIndicator';
        indicator.className = 'loading-indicator';
        indicator.innerHTML = '<i class="fas fa-sync-alt"></i> Datos actualizados';
        searchInput.parentNode.appendChild(indicator);
    }
    
    // Mostrar indicador
    indicator.style.display = 'flex';
    
    // Ocultar después de 2 segundos
    setTimeout(() => {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }, 2000);
}

// Función para limpiar cache de búsqueda cuando sea necesario
function clearClientesSearchCache() {
    const resultsContainer = document.getElementById('labClienteResults');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }
}

// Función para forzar actualización de datos de clientes
function forceUpdateClientesData() {
    console.log('Forzando actualización de datos de clientes...');
    if (window.database) {
        const ticketsRef = window.database.ref('tickets');
        ticketsRef.once('value', (snapshot) => {
            updateClientesDataFromSnapshot(snapshot);
            showClientesUpdateIndicator();
            console.log('Actualización forzada completada');
        });
    }
}

// ===== FUNCIONES DEL SISTEMA DE SERVICIOS =====

// Inicializar el sistema de servicios
function initServiceSelection() {
    console.log('Inicializando sistema de servicios...');
    
    // Cargar categorías en el filtro
    loadServiceCategories();
    
    // Cargar todos los servicios inicialmente
    loadAllServices();
    
    // Configurar event listeners
    setupServiceEventListeners();
    
    // Inicializar lista de servicios seleccionados
    updateSelectedServicesList();
}

// Cargar categorías en el select
function loadServiceCategories() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    // Limpiar opciones existentes (excepto "Todos los servicios")
    categoryFilter.innerHTML = '<option value="">Todos los servicios</option>';
    
    // Agregar cada categoría
    Object.keys(SERVICIOS_LABORATORIO).forEach(categoryKey => {
        const category = SERVICIOS_LABORATORIO[categoryKey];
        const option = document.createElement('option');
        option.value = categoryKey;
        option.textContent = category.titulo;
        categoryFilter.appendChild(option);
    });
}

// Cargar todos los servicios
function loadAllServices() {
    displayServices(getAllServices());
}

// Mostrar servicios en la interfaz
function displayServices(services) {
    const servicesList = document.getElementById('servicesList');
    if (!servicesList) return;
    
    servicesList.innerHTML = '';
    
    if (services.length === 0) {
        servicesList.innerHTML = `
            <div class="no-services-found">
                <i class="fas fa-search"></i>
                <h3>No se encontraron servicios</h3>
                <p>Intenta cambiar los filtros o términos de búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Agrupar servicios por categoría
    const servicesByCategory = {};
    services.forEach(service => {
        if (!servicesByCategory[service.categoria]) {
            servicesByCategory[service.categoria] = {
                titulo: service.categoriaTitulo,
                servicios: []
            };
        }
        servicesByCategory[service.categoria].servicios.push(service);
    });
    
    // Renderizar cada categoría
    Object.keys(servicesByCategory).forEach(categoryKey => {
        const category = servicesByCategory[categoryKey];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'service-category';
        
        // Encabezado de categoría
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <i class="fas fa-folder"></i>
            ${category.titulo}
        `;
        categoryDiv.appendChild(categoryHeader);
          // Servicios de la categoría
        category.servicios.forEach(service => {
            const serviceDiv = createServiceItem(service);
            categoryDiv.appendChild(serviceDiv);
        });
        
        servicesList.appendChild(categoryDiv);    });
}

// Toggle selección de servicio
function toggleServiceSelection(serviceId) {
    const service = getServiceById(serviceId);
    if (!service) return;
    
    const existingIndex = selectedServices.findIndex(s => s.id === serviceId);
    
    if (existingIndex >= 0) {
        // Remover servicio
        selectedServices.splice(existingIndex, 1);
    } else {
        // Agregar servicio
        selectedServices.push(service);
    }
    
    // Actualizar UI
    updateServiceSelectionUI(serviceId);
    updateSelectedServicesList();
    updateTotalPrice();
}

// Actualizar UI de selección de un servicio específico
function updateServiceSelectionUI(serviceId) {
    const serviceElement = document.querySelector(`[data-service-id="${serviceId}"]`);
    if (!serviceElement) return;
    
    const checkbox = serviceElement.querySelector('.service-checkbox');
    const isSelected = selectedServices.some(s => s.id === serviceId);
    
    if (isSelected) {
        serviceElement.classList.add('selected');
        checkbox.checked = true;
    } else {
        serviceElement.classList.remove('selected');
        checkbox.checked = false;
    }
}

// Actualizar lista de servicios seleccionados
function updateSelectedServicesList() {
    const selectedList = document.getElementById('selectedServicesList');
    if (!selectedList) return;
    
    if (selectedServices.length === 0) {
        selectedList.innerHTML = '<div class="no-services-selected">No hay servicios seleccionados</div>';
        return;
    }
    
    selectedList.innerHTML = selectedServices.map(service => `
        <div class="selected-service-item">
            <div class="selected-service-info">
                <div class="selected-service-name">${service.nombre}</div>
                <div class="selected-service-price">${formatPrice(service.precio)}</div>
            </div>
            <button class="remove-service-btn" onclick="removeSelectedService('${service.id}')" type="button">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Remover servicio seleccionado
function removeSelectedService(serviceId) {
    const index = selectedServices.findIndex(s => s.id === serviceId);
    if (index >= 0) {
        selectedServices.splice(index, 1);
        updateServiceSelectionUI(serviceId);
        updateSelectedServicesList();
        updateTotalPrice();
    }
}

// Actualizar precio total
function updateTotalPrice() {
    const totalPriceElement = document.getElementById('totalPrice');
    if (!totalPriceElement) return;
    
    const total = selectedServices.reduce((sum, service) => {
        return sum + (service.precio || 0);
    }, 0);
    
    totalPriceElement.textContent = formatPrice(total);
}

// Configurar event listeners para el sistema de servicios
function setupServiceEventListeners() {
    // Filtro por categoría
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentFilterCategory = e.target.value;
            filterAndDisplayServices();
        });
    }
    
    // Búsqueda de servicios
    const servicesSearch = document.getElementById('servicesSearch');
    if (servicesSearch) {
        let searchTimeout;
        servicesSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchTerm = e.target.value.toLowerCase().trim();
                filterAndDisplayServices();
            }, 300);
        });
    }
}

// Filtrar y mostrar servicios
function filterAndDisplayServices() {
    let filteredServices = getAllServices();
    
    // Filtrar por categoría
    if (currentFilterCategory) {
        filteredServices = filteredServices.filter(service => service.categoria === currentFilterCategory);
    }
    
    // Filtrar por término de búsqueda
    if (currentSearchTerm) {
        filteredServices = filteredServices.filter(service => 
            service.nombre.toLowerCase().includes(currentSearchTerm) ||
            service.descripcion.toLowerCase().includes(currentSearchTerm) ||
            service.categoriaTitulo.toLowerCase().includes(currentSearchTerm)
        );
    }
    
    displayServices(filteredServices);
}

// ===== FUNCIONES AUXILIARES PARA SERVICIOS =====

// Obtener todos los servicios
function getAllServices() {
    const allServices = [];
    
    Object.keys(SERVICIOS_LABORATORIO).forEach(categoryKey => {
        const category = SERVICIOS_LABORATORIO[categoryKey];
        
        category.servicios.forEach(service => {
            allServices.push({
                ...service,
                categoria: categoryKey,
                categoriaTitulo: category.titulo
            });
        });
    });
    
    return allServices;
}

// Obtener servicio por ID
function getServiceById(serviceId) {
    const allServices = getAllServices();
    return allServices.find(service => service.id === serviceId);
}

// Formatear precio
function formatPrice(price) {
    return `₡${price.toLocaleString()}`;
}

// Crear elemento HTML de servicio
function createServiceItem(service) {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    const serviceDiv = document.createElement('div');
    serviceDiv.className = `service-item ${isSelected ? 'selected' : ''}`;
    serviceDiv.setAttribute('data-service-id', service.id);
    
    serviceDiv.innerHTML = `
        <div class="service-checkbox-container">
            <input type="checkbox" class="service-checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="toggleServiceSelection('${service.id}')">
        </div>
        <div class="service-info">
            <div class="service-name">${service.nombre}</div>
            <div class="service-description">${service.descripcion}</div>
            <div class="service-price">₡${service.precio.toLocaleString()}</div>
        </div>
    `;
    
    return serviceDiv;
}

// Obtener datos de servicios seleccionados para el formulario
function getSelectedServicesData() {
    if (!selectedServices || selectedServices.length === 0) {
        return {
            servicios: [],
            serviciosIds: [],
            serviciosNombres: [],
            total: 0
        };
    }
    
    const serviciosIds = selectedServices.map(service => service.id);    const serviciosNombres = selectedServices.map(service => service.nombre);
    const total = selectedServices.reduce((sum, service) => sum + service.precio, 0);
    
    return {
        servicios: selectedServices,
        serviciosIds: serviciosIds,
        serviciosNombres: serviciosNombres,
        total: total
    };
}

// ===== FUNCIONES PARA EDICIÓN DE SERVICIOS =====

// Inicializar selección de servicios para edición
function initEditServiceSelection(ticket) {
    console.log('Inicializando selección de servicios para edición', ticket);
    
    // Cargar servicios existentes del ticket si los tiene
    if (ticket.serviciosSeleccionados && ticket.serviciosSeleccionados.length > 0) {
        selectedServices = [...ticket.serviciosSeleccionados];
    } else {
        selectedServices = [];
    }
    
    // Cargar categorías en el filtro de edición
    loadEditServiceCategories();
    
    // Cargar todos los servicios
    displayEditServices(getAllServices());
    
    // Configurar event listeners para edición
    setupEditServiceEventListeners();
    
    // Actualizar listas
    updateEditSelectedServicesList();
    updateEditTotalPrice();
}

// Cargar categorías para edición
function loadEditServiceCategories() {
    const categoryFilter = document.getElementById('editCategoryFilter');
    if (!categoryFilter) return;
    
    // Limpiar opciones existentes
    categoryFilter.innerHTML = '<option value="">Todos los servicios</option>';
    
    // Agregar cada categoría
    Object.keys(SERVICIOS_LABORATORIO).forEach(categoryKey => {
        const category = SERVICIOS_LABORATORIO[categoryKey];
        const option = document.createElement('option');
        option.value = categoryKey;
        option.textContent = category.titulo;
        categoryFilter.appendChild(option);
    });
}

// Mostrar servicios en edición
function displayEditServices(services) {
    const servicesList = document.getElementById('editServicesList');
    if (!servicesList) return;
    
    servicesList.innerHTML = '';
    
    if (services.length === 0) {
        servicesList.innerHTML = `
            <div class="no-services-found">
                <i class="fas fa-search"></i>
                <h3>No se encontraron servicios</h3>
                <p>Intenta cambiar los filtros o términos de búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Agrupar servicios por categoría
    const servicesByCategory = {};
    services.forEach(service => {
        if (!servicesByCategory[service.categoria]) {
            servicesByCategory[service.categoria] = {
                titulo: service.categoriaTitulo,
                servicios: []
            };
        }
        servicesByCategory[service.categoria].servicios.push(service);
    });
    
    // Renderizar cada categoría
    Object.keys(servicesByCategory).forEach(categoryKey => {
        const category = servicesByCategory[categoryKey];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'service-category';
        
        // Encabezado de categoría
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <i class="fas fa-folder"></i>
            ${category.titulo}
        `;
        categoryDiv.appendChild(categoryHeader);
        
        // Servicios de la categoría
        category.servicios.forEach(service => {
            const serviceDiv = createEditServiceItem(service);
            categoryDiv.appendChild(serviceDiv);
        });
        
        servicesList.appendChild(categoryDiv);
    });
}

// Crear elemento de servicio para edición
function createEditServiceItem(service) {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    const serviceDiv = document.createElement('div');
    serviceDiv.className = `service-item ${isSelected ? 'selected' : ''}`;
    serviceDiv.setAttribute('data-service-id', service.id);
    
    serviceDiv.innerHTML = `
        <div class="service-checkbox-container">
            <input type="checkbox" class="service-checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="toggleEditServiceSelection('${service.id}')">
        </div>
        <div class="service-info">
            <div class="service-name">${service.nombre}</div>
            <div class="service-description">${service.descripcion}</div>
            <div class="service-price">₡${service.precio.toLocaleString()}</div>
        </div>
    `;
    
    return serviceDiv;
}

// Toggle selección de servicio en edición
function toggleEditServiceSelection(serviceId) {
    const service = getServiceById(serviceId);
    if (!service) return;
    
    const existingIndex = selectedServices.findIndex(s => s.id === serviceId);
    
    if (existingIndex >= 0) {
        // Remover servicio
        selectedServices.splice(existingIndex, 1);
    } else {
        // Agregar servicio
        selectedServices.push(service);
    }
    
    // Actualizar UI
    updateEditServiceSelectionUI(serviceId);
    updateEditSelectedServicesList();
    updateEditTotalPrice();
}

// Actualizar UI de selección en edición
function updateEditServiceSelectionUI(serviceId) {
    const serviceElement = document.querySelector(`[data-service-id="${serviceId}"]`);
    if (!serviceElement) return;
    
    const checkbox = serviceElement.querySelector('.service-checkbox');
    const isSelected = selectedServices.some(s => s.id === serviceId);
    
    if (isSelected) {
        serviceElement.classList.add('selected');
        checkbox.checked = true;
    } else {
        serviceElement.classList.remove('selected');
        checkbox.checked = false;
    }
}

// Actualizar lista de servicios seleccionados en edición
function updateEditSelectedServicesList() {
    const selectedList = document.getElementById('editSelectedServicesList');
    if (!selectedList) return;
    
    if (selectedServices.length === 0) {
        selectedList.innerHTML = '<div class="no-services-selected">No hay servicios seleccionados</div>';
        return;
    }
    
    selectedList.innerHTML = selectedServices.map(service => `
        <div class="selected-service-item">
            <div class="selected-service-info">
                <div class="selected-service-name">${service.nombre}</div>
                <div class="selected-service-price">${formatPrice(service.precio)}</div>
            </div>
            <button class="remove-service-btn" onclick="removeEditSelectedService('${service.id}')" type="button">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Remover servicio seleccionado en edición
function removeEditSelectedService(serviceId) {
    const index = selectedServices.findIndex(s => s.id === serviceId);
    if (index >= 0) {
        selectedServices.splice(index, 1);
        updateEditServiceSelectionUI(serviceId);
        updateEditSelectedServicesList();
        updateEditTotalPrice();
    }
}

// Actualizar precio total en edición
function updateEditTotalPrice() {
    const totalPriceElement = document.getElementById('editTotalPrice');
    if (!totalPriceElement) return;
    
    const total = selectedServices.reduce((sum, service) => {
        return sum + (service.precio || 0);
    }, 0);
    
    totalPriceElement.innerHTML = `<strong>Total: ${formatPrice(total)}</strong>`;
}

// Configurar event listeners para edición
function setupEditServiceEventListeners() {
    // Filtro por categoría
    const categoryFilter = document.getElementById('editCategoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            const filterValue = e.target.value;
            let filteredServices = getAllServices();
            
            if (filterValue) {
                filteredServices = filteredServices.filter(service => service.categoria === filterValue);
            }
            
            // Aplicar búsqueda si existe
            const searchInput = document.getElementById('editServiceSearch');
            if (searchInput && searchInput.value.trim()) {
                const searchTerm = searchInput.value.toLowerCase().trim();
                filteredServices = filteredServices.filter(service => 
                    service.nombre.toLowerCase().includes(searchTerm) ||
                    service.descripcion.toLowerCase().includes(searchTerm) ||
                    service.categoriaTitulo.toLowerCase().includes(searchTerm)
                );
            }
            
            displayEditServices(filteredServices);
        });
    }
    
    // Búsqueda de servicios
    const servicesSearch = document.getElementById('editServiceSearch');
    if (servicesSearch) {
        let searchTimeout;
        servicesSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase().trim();
                let filteredServices = getAllServices();
                
                // Aplicar filtro de categoría si existe
                const categoryFilter = document.getElementById('editCategoryFilter');
                if (categoryFilter && categoryFilter.value) {
                    filteredServices = filteredServices.filter(service => service.categoria === categoryFilter.value);
                }
                
                // Aplicar búsqueda
                if (searchTerm) {
                    filteredServices = filteredServices.filter(service => 
                        service.nombre.toLowerCase().includes(searchTerm) ||
                        service.descripcion.toLowerCase().includes(searchTerm) ||
                        service.categoriaTitulo.toLowerCase().includes(searchTerm)
                    );
                }
                
                displayEditServices(filteredServices);
            }, 300);
        });
    }
}

// Mostrar/ocultar filtro de médicos según el estado
function toggleMedicoFilter(filter) {
    const medicoFilterContainer = document.getElementById('labMedicoFilterContainer');
    if (!medicoFilterContainer) return;
    
    // Mostrar el filtro para tickets reportados y cliente no contesta
    if (filter === 'reportado' || filter === 'reportado_cliente' || filter === 'cliente_no_contesta') {
        medicoFilterContainer.style.display = 'block';
    } else {
        medicoFilterContainer.style.display = 'none';
    }
}

// Mostrar/ocultar filtro de fecha según el estado
function toggleDateFilter(filter) {
    const dateFilterContainer = document.getElementById('labDateFilterContainer');
    if (!dateFilterContainer) return;
    
    // Ocultar el filtro de fecha para "Reportado Lab" (reportado) - mostrar todos sin restricción de fecha
    // Solo mostrar para reportado_cliente y cliente_no_contesta
    if (filter === 'reportado_cliente' || filter === 'cliente_no_contesta') {
        dateFilterContainer.style.display = 'block';
    } else {
        dateFilterContainer.style.display = 'none';
    }
}

// Obtener opción de reporte según el rol del usuario
function getUserReportOption(ticket) {
    // Mostrar todas las opciones de estado para todos los usuarios
    return `
        <option value="reportado" ${ticket.estado === 'reportado' ? 'selected' : ''}>Reportado de Laboratorio</option>
        <option value="reportado_cliente" ${ticket.estado === 'reportado_cliente' ? 'selected' : ''}>Reportado al Cliente</option>
        <option value="laboratorio_externo" ${ticket.estado === 'laboratorio_externo' ? 'selected' : ''}>Laboratorio Externo</option>
        <option value="cliente_no_contesta" ${ticket.estado === 'cliente_no_contesta' ? 'selected' : ''}>Cliente no contesta</option>
    `;
}
