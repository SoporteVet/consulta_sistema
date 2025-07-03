let currentTicketId = 1;
let isDataLoaded = false;
// Add this missing declaration
let tickets = [];
// Expose tickets globally for other modules (like consentimientos)
window.tickets = tickets;

// Function to safely add event listeners
function safeAddEventListener(elementId, eventType, handler) {
  const element = document.getElementById(elementId);
  if (element) {
    element.addEventListener(eventType, handler);
  } else {
    console.warn(`Element with ID '${elementId}' not found for event listener`);
  }
}

// Utilidad para obtener la fecha local en formato YYYY-MM-DD
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Generar un identificador aleatorio seguro para cada ticket
function generateRandomId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

const crearTicketBtn = document.getElementById('crearTicketBtn');
const verTicketsBtn = document.getElementById('verTicketsBtn');
const estadisticasBtn = document.getElementById('estadisticasBtn');
const edicionesBtn = document.getElementById('edicionesBtn');
const crearTicketSection = document.getElementById('crearTicketSection');
const verTicketsSection = document.getElementById('verTicketsSection');
const estadisticasSection = document.getElementById('estadisticasSection');
const edicionesSection = document.getElementById('edicionesSection');
const ticketForm = document.getElementById('ticketForm');
const ticketContainer = document.getElementById('ticketContainer');
const filterBtns = document.querySelectorAll('.filter-btn');
const horarioBtn = document.getElementById('horarioBtn');
const horarioSection = document.getElementById('horarioSection');
const fechaHorario = document.getElementById('fechaHorario');
const verHorarioBtn = document.getElementById('verHorarioBtn');
const exportarDiaBtn = document.getElementById('exportarDiaBtn');
const exportarMesBtn = document.getElementById('exportarMesBtn');
const exportarGoogleBtn = document.getElementById('exportarGoogleBtn');
const backupBtn = document.getElementById('backupBtn');
const cleanDataBtn = document.getElementById('cleanDataBtn');

// Inicialización with loop prevention
document.addEventListener('DOMContentLoaded', () => {
    // Prevent auto-redirect while loading
    window.noRedirectOnAuth = true;
    
    // Check authentication before doing anything else
    checkAuth().then(userData => {
        if (!userData) {
            // Si no hay datos de usuario, redirigir al login
            window.location.href = 'home.html'; // O 'login.html' según corresponda
            return;
        }
        // Show the UI elements based on user role
        applyRoleBasedUI(userData.role);
        
        console.log("Successfully authenticated as", userData.role);
        
        // Continue with loading data
        showLoading();
        
        // Verify if the sections exist before trying to work with them
        const crearTicketSection = document.getElementById('crearTicketSection');
        const verTicketsSection = document.getElementById('verTicketsSection');
        const horarioSection = document.getElementById('horarioSection');
        const estadisticasSection = document.getElementById('estadisticasSection');
        
        if (!crearTicketSection || !verTicketsSection) {
            console.error("Critical sections missing in the DOM. Check your HTML structure.");
            hideLoading();
            showNotification('Error: Estructura HTML incompleta', 'error');
            return;
        }
        
        // Inicializar Firebase Auth y cargar datos
        initAuth().then(() => {
            loadTickets().then(() => {
                hideLoading();
                isDataLoaded = true;
                
                // Mostrar por defecto la sección de crear ticket si existe
                if (crearTicketSection) {
                    showSection(crearTicketSection);
                    if (crearTicketBtn) crearTicketBtn.classList.add('active');
                }
                
                // Establecer fecha actual en el formulario
                const fechaInput = document.getElementById('fecha');
                if (fechaInput) {
                    fechaInput.value = getLocalDateString();
                }
                
                // Establecer fecha actual en el campo de fecha del horario
                const today = getLocalDateString();
                if (fechaHorario) {
                    fechaHorario.value = today;
                }

                // --- reset diario del contador de tickets ---
                const todayDaily = getLocalDateString();
                const todaysTickets = tickets.filter(t => t.fechaConsulta === todayDaily);
                currentTicketId = todaysTickets.length
                    ? Math.max(...todaysTickets.map(t => t.id)) + 1
                    : 1;

                // Mostrar solo tickets EN ESPERA al cargar para todos menos admin
                const userRole = sessionStorage.getItem('userRole');
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                if (userRole === 'admin') {
                    renderTickets('todos');
                    const todosBtn = document.querySelector('.filter-btn[data-filter="todos"]');
                    if (todosBtn) todosBtn.classList.add('active');
                } else {
                    renderTickets('espera');
                    const esperaBtn = document.querySelector('.filter-btn[data-filter="espera"]');
                    if (esperaBtn) esperaBtn.classList.add('active');
                }
                updateStatsGlobal();
                
                // Inicializar sistema de laboratorio
                if (typeof initLaboratorioSystem === 'function') {
                    console.log('Inicializando sistema de laboratorio desde index.js');
                    initLaboratorioSystem();
                    window.laboratorioInitialized = true;
                } else {
                    console.warn('Sistema de laboratorio no disponible');
                }
                
            }).catch(err => {
                console.error("Error cargando tickets:", err);
                hideLoading();
                showNotification('Error al cargar los datos', 'error');
            });
        }).catch(err => {
            console.error("Error en autenticación:", err);
            hideLoading();
            showNotification('Error al conectar con el servidor', 'error');
        });
    }).catch(err => {
        // Si estamos en la página de login, no mostrar error ni notificación
        if (window.location.pathname.toLowerCase().includes('home.html')) {
            return;
        }
        console.error("Authentication error:", err);
        hideLoading();
        showNotification('Error de autenticación. Por favor inicie sesión nuevamente.', 'error');
        // Add a login button instead of auto-redirect
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>Sesión expirada</h2>
                    <p>Su sesión ha expirado o no ha iniciado sesión correctamente.</p>
                    <button onclick="window.location.href='home.html'" 
                            style="padding: 10px 20px; background: var(--primary-color); 
                            color: white; border: none; border-radius: 5px; cursor: pointer; 
                            margin-top: 20px;">
                        Iniciar sesión
                    </button>
                </div>
            `;
        }
    });

    // mostrar filtro de fecha para admin/recepción
    const dateFilter = document.getElementById('dateFilterContainer');
    if (dateFilter && hasPermission('canViewSchedule')) {
        dateFilter.classList.remove('hidden');
        // inicializar con fecha actual y filtrar al cargar
        const filterDateInput = document.getElementById('filterDate');
        if (filterDateInput) {
            const today = getLocalDateString();
            filterDateInput.value = today;
            renderTickets('fecha', today);
        }
    }

    // Evento para búsqueda en tiempo real
    const searchInput = document.getElementById('ticketSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Detecta el filtro activo
            const currentFilterBtn = document.querySelector('.filter-btn.active');
            const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'espera';
            renderTickets(currentFilter);
        });
    }

    // Evento para filtrar por fecha
    safeAddEventListener('filterDate', 'change', () => {
        // Detecta el filtro activo
        const currentFilterBtn = document.querySelector('.filter-btn.active');
        const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'espera';
        renderTickets(currentFilter);
    });

    // Ocultar filtro "Todos" en ver consultas para todos menos admin
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'admin') {
        const todosBtn = document.querySelector('.filter-btn[data-filter="todos"]');
        if (todosBtn) todosBtn.style.display = 'none';
    }

    // Mostrar barra de búsqueda solo para roles distintos a visitas
    const searchBar = document.getElementById('searchBarContainer');
    if (searchBar && userRole !== 'visitas') {
        searchBar.style.display = 'flex';
    }

    // Agregar filtro 'Lista' solo para roles distintos a visitas
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer && sessionStorage.getItem('userRole') !== 'visitas') {
        const listaBtn = document.createElement('button');
        listaBtn.className = 'filter-btn';
        listaBtn.setAttribute('data-filter', 'lista');
        listaBtn.textContent = 'Lista';
        filterContainer.appendChild(listaBtn);
        listaBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            listaBtn.classList.add('active');
            renderTickets('lista');
        });
    }

    // Mostrar filtro Laboratorio solo para roles distintos a visitas
    const labFilterBtn = document.querySelector('.filter-btn[data-filter="laboratorio"]');
    if (labFilterBtn && ["admin", "laboratorio", "consulta_externa"].includes(userRole)) {
        labFilterBtn.style.display = '';
    }
    // Evento para filtro Laboratorio
    if (labFilterBtn) {
        labFilterBtn.addEventListener('click', () => {
            // Quitar clase active de todos los botones de filtro
            const allFilterBtns = document.querySelectorAll('.filter-btn');
            if (allFilterBtns && allFilterBtns.length) {
                allFilterBtns.forEach(b => b.classList.remove('active'));
            }
            if (labFilterBtn) labFilterBtn.classList.add('active');
            const ticketContainer = document.getElementById('ticketContainer');
            const labContainer = document.getElementById('labContainer');
            if (ticketContainer) ticketContainer.style.display = 'none';
            if (labContainer) labContainer.style.display = '';
            if (typeof renderLabSheets === 'function') renderLabSheets();
        });
    }
});

// Improved version of applyRoleBasedUI with better debugging and role detection
function applyRoleBasedUI(role) {
    console.log(`Applying UI for role: ${role}`);
    
    // Set user info in UI
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    
    if (userNameElement) {
        userNameElement.textContent = sessionStorage.getItem('userName') || 'Usuario';
    }
    if (userRoleElement) {
        userRoleElement.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
    
    // Debug info to console
    console.log("User role from sessionStorage:", sessionStorage.getItem('userRole'));
    console.log("User name from sessionStorage:", sessionStorage.getItem('userName'));
    console.log("Admin permissions:", JSON.stringify(PERMISSIONS.admin));
    
    // Add role-specific class to body element for CSS targeting
    document.body.classList.add(`${role}-role`);
    console.log(`Added ${role}-role class to body`);
    
    // Check explicitly for admin role with string comparison
    if (role === 'admin') {
        console.log("ADMIN ROLE DETECTED - enabling all admin features");
        
        // Show all admin-specific buttons
        const adminElements = document.querySelectorAll('.admin-only');
        console.log(`Found ${adminElements.length} admin-only elements`);
        adminElements.forEach(el => {
            el.style.display = 'block';
            console.log(`Showing admin element:`, el);
        });

        // Enable export buttons for admin
        const exportButtons = document.querySelectorAll('.export-controls button');
        if (exportButtons && exportButtons.length > 0) {
            console.log(`Found ${exportButtons.length} export buttons`);
            exportButtons.forEach(btn => {
                btn.style.display = 'inline-flex';
            });
        } else {
            console.log("No export buttons found");
        }
        
        // Enable backup buttons for admin
        const backupButtons = document.querySelectorAll('.backup-controls button');
        if (backupButtons && backupButtons.length > 0) {
            console.log(`Found ${backupButtons.length} backup buttons`);
            backupButtons.forEach(btn => {
                btn.style.display = 'inline-flex';
            });
        } else {
            console.log("No backup buttons found");
        }
    } else {
        console.log(`Non-admin role detected: ${role}`);
        // For non-admin roles, hide features based on permissions
        if (!hasPermission('canCreateTickets')) {
            document.getElementById('crearTicketBtn').style.display = 'none';
        }
        
        if (!hasPermission('canViewStats')) {
            document.getElementById('estadisticasBtn').style.display = 'none';
        }
        
        if (!hasPermission('canViewSchedule')) {
            document.getElementById('horarioBtn').style.display = 'none';
        }
        
        // Hide export buttons for non-admin users without export permission
        const exportButtons = document.querySelectorAll('.export-controls button');
        if (exportButtons && !hasPermission('canExportData')) {
            exportButtons.forEach(btn => {
                btn.style.display = 'none';
            });
        }
        
        // Hide admin-only elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = 'none';
        });
    }
    
    // Control de visibilidad del botón de laboratorio basado en roles
    const laboratorioBtn = document.getElementById('laboratorioBtn');
    const laboratorioCategory = laboratorioBtn ? laboratorioBtn.closest('.nav-category') : null;
    const allowedLabRoles = ['admin', 'consulta_externa', 'internos', 'quirofano', 'laboratorio'];
    
    if (laboratorioCategory) {
        if (allowedLabRoles.includes(role)) {
            laboratorioCategory.style.display = 'block';
            console.log(`Módulo de laboratorio mostrado para rol: ${role}`);
        } else {
            laboratorioCategory.style.display = 'none';
            console.log(`Módulo de laboratorio ocultado para rol: ${role}`);
        }
    }
    
    // Control de visibilidad del botón de consentimientos basado en roles
    const consentimientosBtn = document.getElementById('consentimientosBtn');
    const consentimientosCategory = consentimientosBtn ? consentimientosBtn.closest('.nav-category') : null;
    
    if (consentimientosCategory) {
        if (role !== 'visitas') {
            consentimientosCategory.style.display = 'block';
            console.log(`Módulo de consentimientos mostrado para rol: ${role}`);
        } else {
            consentimientosCategory.style.display = 'none';
            console.log(`Módulo de consentimientos ocultado para rol: ${role}`);
        }
    }
    
    // Add logout button event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }
    
    console.log("UI permissions applied successfully for role:", role);
}

// Mostrar/ocultar sidebar para visitas
function setupVisitasSidebarToggle() {
  const btn = document.getElementById('menuToggleBtn');
  const sidebar = document.querySelector('.sidebar');
  const mainContainer = document.querySelector('.main-container');
  if (!btn || !sidebar || !mainContainer) return;

  // Mostrar solo si es visitas
  if (sessionStorage.getItem('userRole') === 'visitas') {
    btn.style.display = 'block';
    btn.addEventListener('click', function() {
      mainContainer.classList.toggle('sidebar-hidden');
      if (mainContainer.classList.contains('sidebar-hidden')) {
        btn.innerHTML = '<i class="fas fa-angle-double-right"></i> ';
      } else {
        btn.innerHTML = '<i class="fas fa-angle-double-left"></i>';
      }
    });
  } else {
    btn.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', setupVisitasSidebarToggle);

// Event listeners
safeAddEventListener('crearTicketBtn', 'click', () => {
    const section = document.getElementById('crearTicketSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('crearTicketBtn'));
    } else {
        console.error("Section 'crearTicketSection' not found");
    }
});
function setDefaultFilterDate() {
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput && !filterDateInput.value) {
        // Usa la fecha de hoy en formato yyyy-mm-dd
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        filterDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

safeAddEventListener('verTicketsBtn', 'click', () => {
    // Siempre inicializar el filtro de fecha antes de renderizar
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput && !filterDateInput.value) {
        filterDateInput.value = getLocalDateString();
    }
    // Forzar el filtro visualmente al botón de espera para todos menos admin
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const userRole = sessionStorage.getItem('userRole');
    if (userRole === 'admin') {
        renderTickets('todos');
        const todosBtn = document.querySelector('.filter-btn[data-filter="todos"]');
        if (todosBtn) todosBtn.classList.add('active');
    } else {
        renderTickets('espera');
        const esperaBtn = document.querySelector('.filter-btn[data-filter="espera"]');
        if (esperaBtn) esperaBtn.classList.add('active');
    }
    const section = document.getElementById('verTicketsSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('verTicketsBtn'));
    } else {
        console.error("Section 'verTicketsSection' not found");
    }
});

// Add proper event listener for horarioBtn
safeAddEventListener('horarioBtn', 'click', () => {
    const section = document.getElementById('horarioSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('horarioBtn'));
        // Set today's date in the date field
        const fechaHorario = document.getElementById('fechaHorario');
        if (fechaHorario) {
            fechaHorario.value = getLocalDateString();
        }
        // Optionally load today's schedule automatically
        mostrarHorario();
    } else {
        console.error("Section 'horarioSection' not found");
    }
});

safeAddEventListener('estadisticasBtn', 'click', () => {
    const section = document.getElementById('estadisticasSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('estadisticasBtn'));
        updateStatsGlobal();
        
        // Asegurarnos que se vea la sección de tiempo de espera
        const waitTimeSection = document.querySelector('.wait-time-statistics');
        if (waitTimeSection) {
            waitTimeSection.style.display = 'block';
        }
        
        // Initialize personnel statistics 
        setTimeout(() => {
            llenarSelectorPersonal(tickets);
            renderizarGraficosPersonalServicios(tickets);
            
            // Regenerar el gráfico de tiempo de espera para asegurar que se muestre
            renderizarGraficosTiempoEspera(tickets);
        }, 200);
    } else {
        console.error("Section 'estadisticasSection' not found");
    }
});

// Variables globales para la paginación
let paginaActualEdiciones = 1;
const elementosPorPagina = 25;
let edicionesGlobales = [];

function cargarHistorialEdiciones() {
    const tbody = document.getElementById('edicionesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
    
    if (typeof firebase === 'undefined' || !firebase.database) {
        tbody.innerHTML = '<tr><td colspan="8">No se puede conectar a la base de datos</td></tr>';
        return;
    }

    // Obtener el período seleccionado y las fechas si es personalizado
    const periodo = document.getElementById('filtroPeriodoEdiciones')?.value || 'hoy';
    const fechaInicio = document.getElementById('fechaInicioEdiciones')?.value;
    const fechaFin = document.getElementById('fechaFinEdiciones')?.value;
    const searchText = document.getElementById('searchEdiciones')?.value?.toLowerCase() || '';

    // Calcular fechas según el período
    const hoy = new Date();
    let fechaInicioFiltro, fechaFinFiltro;

    switch (periodo) {
        case 'hoy':
            fechaInicioFiltro = getLocalDateString();
            fechaFinFiltro = fechaInicioFiltro;
            break;
        case 'semana':
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - hoy.getDay());
            fechaInicioFiltro = getLocalDateString(inicioSemana);
            fechaFinFiltro = getLocalDateString(hoy);
            break;
        case 'mes':
            fechaInicioFiltro = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
            fechaFinFiltro = getLocalDateString(hoy);
            break;
        case 'ano':
            fechaInicioFiltro = `${hoy.getFullYear()}-01-01`;
            fechaFinFiltro = getLocalDateString(hoy);
            break;
        case 'personalizado':
            if (!fechaInicio || !fechaFin) {
                showNotification('Por favor seleccione ambas fechas para el período personalizado', 'error');
                tbody.innerHTML = '<tr><td colspan="8">Seleccione un rango de fechas válido</td></tr>';
                return;
            }
            fechaInicioFiltro = fechaInicio;
            fechaFinFiltro = fechaFin;
            break;
        case 'todo':
            fechaInicioFiltro = '2000-01-01';
            fechaFinFiltro = '2100-12-31';
            break;
        default:
            fechaInicioFiltro = '2000-01-01';
            fechaFinFiltro = getLocalDateString(hoy);
    }

    firebase.database().ref('ticket_edits').orderByChild('fecha').once('value', function(snapshot) {
        const edits = [];
        snapshot.forEach(child => {
            const edit = child.val();
            // Filtrar por fecha
            if (edit.fecha >= fechaInicioFiltro && edit.fecha <= fechaFinFiltro) {
                edits.push(edit);
            }
        });

        // Ordenar por fecha y hora descendente
        edits.sort((a, b) => (b.fecha + ' ' + b.hora).localeCompare(a.fecha + ' ' + a.hora));

        // Filtrar por búsqueda
        const edicionesFiltradas = edits.filter(edit => {
            const ticket = tickets.find(t => t.id === edit.idTicket);
            const nombreCliente = ticket ? ticket.nombre : 'N/A';
            const nombreMascota = ticket ? ticket.mascota : 'N/A';
            const idPaciente = ticket ? ticket.idPaciente : 'N/A';
            const numFactura = ticket ? ticket.numFactura : 'N/A';

            return !searchText || (
                nombreCliente.toLowerCase().includes(searchText) ||
                nombreMascota.toLowerCase().includes(searchText) ||
                idPaciente.toLowerCase().includes(searchText) ||
                numFactura.toLowerCase().includes(searchText) ||
                edit.idTicket.toString().includes(searchText)
            );
        });

        // Guardar las ediciones filtradas globalmente
        edicionesGlobales = edicionesFiltradas;

        if (edicionesFiltradas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No hay ediciones registradas para los filtros seleccionados</td></tr>';
            actualizarControlesPaginacion(0);
            return;
        }

        // Calcular paginación
        const totalPaginas = Math.ceil(edicionesFiltradas.length / elementosPorPagina);
        if (paginaActualEdiciones > totalPaginas) {
            paginaActualEdiciones = 1;
        }

        // Obtener elementos de la página actual
        const inicio = (paginaActualEdiciones - 1) * elementosPorPagina;
        const fin = inicio + elementosPorPagina;
        const edicionesPagina = edicionesFiltradas.slice(inicio, fin);

        // Renderizar tabla
        tbody.innerHTML = '';
        edicionesPagina.forEach(edit => {
            const ticket = tickets.find(t => t.id === edit.idTicket);
            const nombreCliente = ticket ? ticket.nombre : 'N/A';
            const nombreMascota = ticket ? ticket.mascota : 'N/A';

            const cambios = Object.entries(edit.cambios || {}).map(([campo, val]) =>
                `<div><strong>${campo}:</strong> <span style='color:#b00'>${val.antes}</span> → <span style='color:#080'>${val.despues}</span></div>`
            ).join('');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${edit.fecha}</td>
                <td>${edit.hora}</td>
                <td>${edit.usuario}</td>
                <td>${edit.email}</td>
                <td>${edit.idTicket}</td>
                <td>${nombreCliente}</td>
                <td>${nombreMascota}</td>
                <td>${cambios}</td>
            `;
            tbody.appendChild(tr);
        });

        // Actualizar controles de paginación
        actualizarControlesPaginacion(totalPaginas);
    });
}

function actualizarControlesPaginacion(totalPaginas) {
    const paginacionContainer = document.getElementById('numeroPaginas');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const paginaActualSpan = document.getElementById('paginaActual');
    const totalPaginasSpan = document.getElementById('totalPaginas');

    if (!paginacionContainer || !prevBtn || !nextBtn || !paginaActualSpan || !totalPaginasSpan) return;

    // Actualizar información de página actual
    paginaActualSpan.textContent = paginaActualEdiciones;
    totalPaginasSpan.textContent = totalPaginas;

    // Actualizar estado de botones anterior/siguiente
    prevBtn.disabled = paginaActualEdiciones === 1;
    nextBtn.disabled = paginaActualEdiciones === totalPaginas || totalPaginas === 0;

    // Generar botones de página
    paginacionContainer.innerHTML = '';
    
    // Determinar qué páginas mostrar
    let startPage = Math.max(1, paginaActualEdiciones - 2);
    let endPage = Math.min(totalPaginas, startPage + 4);
    
    // Ajustar si estamos cerca del final
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Agregar botón para primera página si no es visible
    if (startPage > 1) {
        const firstBtn = crearBotonPagina(1);
        paginacionContainer.appendChild(firstBtn);
        if (startPage > 2) {
            paginacionContainer.appendChild(crearPuntosSuspensivos());
        }
    }

    // Agregar botones de página
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = crearBotonPagina(i);
        paginacionContainer.appendChild(pageBtn);
    }

    // Agregar botón para última página si no es visible
    if (endPage < totalPaginas) {
        if (endPage < totalPaginas - 1) {
            paginacionContainer.appendChild(crearPuntosSuspensivos());
        }
        const lastBtn = crearBotonPagina(totalPaginas);
        paginacionContainer.appendChild(lastBtn);
    }
}

function crearBotonPagina(numero) {
    const btn = document.createElement('button');
    btn.className = `btn-pagina ${numero === paginaActualEdiciones ? 'active' : ''}`;
    btn.textContent = numero;
    btn.onclick = () => {
        paginaActualEdiciones = numero;
        cargarHistorialEdiciones();
    };
    return btn;
}

function crearPuntosSuspensivos() {
    const span = document.createElement('span');
    span.className = 'puntos-suspensivos';
    span.textContent = '...';
    return span;
}

// Agregar event listeners para los controles de paginación
document.addEventListener('DOMContentLoaded', function() {
    // Event listeners para paginación
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (paginaActualEdiciones > 1) {
                paginaActualEdiciones--;
                cargarHistorialEdiciones();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPaginas = Math.ceil(edicionesGlobales.length / elementosPorPagina);
            if (paginaActualEdiciones < totalPaginas) {
                paginaActualEdiciones++;
                cargarHistorialEdiciones();
            }
        });
    }

    // Event listener para el filtro de período
    const filtroPeriodoEdiciones = document.getElementById('filtroPeriodoEdiciones');
    if (filtroPeriodoEdiciones) {
        filtroPeriodoEdiciones.addEventListener('change', function() {
            const periodPersonalizadoEdiciones = document.getElementById('periodPersonalizadoEdiciones');
            if (periodPersonalizadoEdiciones) {
                periodPersonalizadoEdiciones.style.display = 
                    this.value === 'personalizado' ? 'flex' : 'none';
            }
            if (this.value !== 'personalizado') {
                paginaActualEdiciones = 1; // Resetear a primera página
                cargarHistorialEdiciones();
            }
        });
    }

    // Event listener para la búsqueda en tiempo real
    const searchEdiciones = document.getElementById('searchEdiciones');
    if (searchEdiciones) {
        let timeoutId;
        searchEdiciones.addEventListener('input', () => {
            // Debounce para evitar demasiadas llamadas
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                paginaActualEdiciones = 1; // Resetear a primera página al buscar
                cargarHistorialEdiciones();
            }, 300);
        });
    }

    // Event listener para el botón de aplicar filtros
    const aplicarFiltrosEdicionesBtn = document.getElementById('aplicarFiltrosEdicionesBtn');
    if (aplicarFiltrosEdicionesBtn) {
        aplicarFiltrosEdicionesBtn.addEventListener('click', function() {
            const periodo = document.getElementById('filtroPeriodoEdiciones')?.value;
            if (periodo === 'personalizado') {
                const fechaInicio = document.getElementById('fechaInicioEdiciones')?.value;
                const fechaFin = document.getElementById('fechaFinEdiciones')?.value;
                if (!fechaInicio || !fechaFin) {
                    showNotification('Por favor seleccione ambas fechas para el período personalizado', 'error');
                    return;
                }
                if (new Date(fechaInicio) > new Date(fechaFin)) {
                    showNotification('La fecha de inicio no puede ser posterior a la fecha final', 'error');
                    return;
                }
            }
            paginaActualEdiciones = 1; // Resetear a primera página al aplicar filtros
            cargarHistorialEdiciones();
        });
    }

    // Event listeners para las fechas personalizadas
    const fechaInicioEdiciones = document.getElementById('fechaInicioEdiciones');
    const fechaFinEdiciones = document.getElementById('fechaFinEdiciones');
    
    if (fechaInicioEdiciones) {
        fechaInicioEdiciones.addEventListener('change', () => {
            const periodo = document.getElementById('filtroPeriodoEdiciones')?.value;
            if (periodo === 'personalizado') {
                paginaActualEdiciones = 1;
                cargarHistorialEdiciones();
            }
        });
    }
    
    if (fechaFinEdiciones) {
        fechaFinEdiciones.addEventListener('change', () => {
            const periodo = document.getElementById('filtroPeriodoEdiciones')?.value;
            if (periodo === 'personalizado') {
                paginaActualEdiciones = 1;
                cargarHistorialEdiciones();
            }
        });
    }

    // Agregar estilos para la paginación
    const style = document.createElement('style');
    style.textContent = `
        .btn-pagina {
            padding: 5px 10px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 4px;
            min-width: 35px;
            transition: all 0.2s;
        }
        .btn-pagina:hover:not(:disabled) {
            background: #f0f0f0;
            border-color: #aaa;
        }
        .btn-pagina.active {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }
        .btn-pagina:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
            color: #999;
        }
        .puntos-suspensivos {
            padding: 5px;
            color: #666;
        }
        .paginacion-container {
            user-select: none;
        }
        .search-bar {
            position: relative;
        }
        .search-bar i {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #666;
        }
    `;
    document.head.appendChild(style);
});

if (ticketForm) {
    ticketForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTicket();
    });
}

// Event listeners para la sección de horario
if (verHorarioBtn) {
    verHorarioBtn.addEventListener('click', mostrarHorario);
}

if (exportarDiaBtn) {
    exportarDiaBtn.addEventListener('click', exportarDia);
}

if (exportarMesBtn) {
    exportarMesBtn.addEventListener('click', exportarMes);
}

if (exportarGoogleBtn) {
    exportarGoogleBtn.addEventListener('click', exportarGoogle);
}

if (backupBtn) {
    backupBtn.addEventListener('click', backupData);
}

if (cleanDataBtn) {
    cleanDataBtn.addEventListener('click', cleanOldData);
}

// Filtros de tickets
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Quitar clase active de todos los botones
        filterBtns.forEach(b => b.classList.remove('active'));
        // Agregar clase active al botón clickeado
        btn.classList.add('active');
        // Filtrar tickets
        const filter = btn.getAttribute('data-filter');
        renderTickets(filter);
    });
});

// Update the showSection function to make it more robust with null checking
function showSection(section) {
    // Check if section exists
    if (!section) {
        console.error("Error: Attempted to show a section that doesn't exist");
        return; // Exit the function early
    }
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content section');
    sections.forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    
    // Mostrar la sección solicitada con animación
    section.classList.remove('hidden');
    
    // Aplicar un pequeño retraso para la animación
    setTimeout(() => {
        section.classList.add('active');
    }, 50);
}

// Add a safer way to show sections using IDs
function showSectionById(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        showSection(section);
    } else {
        console.error(`Section with ID '${sectionId}' not found`);
    }
}

function setActiveButton(button) {
    // Quitar clase active de todos los botones
    const buttons = document.querySelectorAll('nav button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Agregar clase active al botón seleccionado
    button.classList.add('active');
}

// Función auxiliar para formatear el contenido de Por Cobrar
function formatPorCobrarDisplay(porCobrarText) {
    if (!porCobrarText) return '';
    
    // Dividir por las líneas de separación con timestamp
    const lines = porCobrarText.split('\n');
    let formattedContent = '';
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detectar líneas de separación con timestamp
        if (line.match(/^--- \d{2}\/\d{2}\/\d{4}.*---$/)) {
            // Si hay contenido previo, agregarlo como sección
            if (currentSection.trim()) {
                if (formattedContent === '') {
                    // Primera sección (contenido original)
                    formattedContent += `<div class="por-cobrar-original">${currentSection.trim()}</div>`;
                } else {
                    // Secciones adicionales
                    formattedContent += `<div class="por-cobrar-addition">${currentSection.trim()}</div>`;
                }
                currentSection = '';
            }
            
            // Agregar el header de la sección
            formattedContent += `<div style="font-weight: bold; color: #666; font-size: 11px; margin: 8px 0 4px 0;">${line.replace(/^---\s*/, '').replace(/\s*---$/, '')}</div>`;
        } else {
            // Agregar línea normal al contenido de la sección actual
            currentSection += (currentSection ? '\n' : '') + line;
        }
    }
    
    // Agregar la última sección si existe
    if (currentSection.trim()) {
        if (formattedContent === '') {
            // Solo hay contenido original
            formattedContent += currentSection.trim();
        } else {
            // Última sección adicional
            formattedContent += `<div class="por-cobrar-addition">${currentSection.trim()}</div>`;
        }
    }
    
    return formattedContent || porCobrarText;
}

// Función para cargar tickets desde Firebase
function loadTickets() {
    return new Promise((resolve, reject) => {
        ticketsRef.once('value')
            .then(snapshot => {
                tickets = [];
                currentTicketId = 1;
                const data = snapshot.val() || {};
                Object.keys(data).forEach(key => {
                    const entry = data[key];
                    if (entry && entry.id != null && entry.mascota) {
                        tickets.push({
                            ...entry,
                            firebaseKey: key
                        });
                        if (entry.id >= currentTicketId) currentTicketId = entry.id + 1;
                    } else {
                        ticketsRef.child(key).remove();
                    }
                });
                // Update global reference
                window.tickets = tickets;
                return settingsRef.once('value');
            })
            .then(snapshot => {
                const settings = snapshot.val() || {};
                if (settings.currentTicketId && settings.currentTicketId > currentTicketId) {
                    currentTicketId = settings.currentTicketId;
                } else {
                    // Guardar el valor actual en Firebase si no existe o es menor
                    settingsRef.update({ currentTicketId });
                }
                resolve();
            })
            .catch(error => {
                console.error("Error cargando datos:", error);
                reject(error);
            });
        // --- Escuchas en tiempo real ---
        ticketsRef.on('child_added', snapshot => {
            const entry = snapshot.val();
            if (!entry || entry.id == null || !entry.mascota) {
                ticketsRef.child(snapshot.key).remove();
                return;
            }
            const newTicket = { ...entry, firebaseKey: snapshot.key };
            // Solo agregar si no existe ya un ticket con esa firebaseKey
            if (!tickets.some(t => t.firebaseKey === newTicket.firebaseKey)) {
                tickets.push(newTicket);
                // Update global reference
                window.tickets = tickets;
                // Usar el filtro activo actual
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStatsGlobal();
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) renderizarGraficosPersonalServicios(tickets);
            }
        });
        ticketsRef.on('child_changed', snapshot => {
            const updatedTicket = {
                ...snapshot.val(),
                firebaseKey: snapshot.key
            };
            const index = tickets.findIndex(t => t.firebaseKey === snapshot.key);
            if (index !== -1) {
                tickets[index] = updatedTicket;
                // Update global reference
                window.tickets = tickets;
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStatsGlobal();
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) renderizarGraficosPersonalServicios(tickets);
            }
        });
        ticketsRef.on('child_removed', snapshot => {
            const index = tickets.findIndex(t => t.firebaseKey === snapshot.key);
            if (index !== -1) {
                tickets.splice(index, 1);
                // Update global reference
                window.tickets = tickets;
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStatsGlobal();
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) renderizarGraficosPersonalServicios(tickets);
            }
        });
    });
}

// Reemplaza la función addTicket() actual con esta versión corregida
function addTicket() {
    try {
        console.log("addTicket function called");
        // 1. Obtener valores del formulario
        const nombre = document.getElementById('nombre').value;
        const mascota = document.getElementById('mascota').value;
        const cedula = document.getElementById('cedula').value;
        const motivo = document.getElementById('motivo').value;
        const motivoLlegada = document.getElementById('motivoLlegada')?.value || '';
        const estado = document.getElementById('estado').value;
        const tipoMascota = document.getElementById('tipoMascota').value;
        let urgencia = document.getElementById('urgencia')?.value || 'consulta';
        urgencia = urgencia.toLowerCase();
        const porCobrar = document.getElementById('porCobrar')?.value || '';
        const idPaciente = document.getElementById('idPaciente')?.value || '';
        const doctorAtiende = document.getElementById('doctorAtiende')?.value || '';
        const asistenteAtiende = document.getElementById('asistenteAtiende')?.value || '';
        let medicoAtiende = '';
        if (doctorAtiende && asistenteAtiende) {
            medicoAtiende = `${doctorAtiende}, ${asistenteAtiende}`;
        } else if (doctorAtiende) {
            medicoAtiende = doctorAtiende;
        } else if (asistenteAtiende) {
            medicoAtiende = asistenteAtiende;
        }
        const numFactura = document.getElementById('numFactura')?.value || '';
        const tipoServicio = document.getElementById('tipoServicio').value;
        const fechaConsulta = document.getElementById('fecha')?.value;
        const horaCita = document.getElementById('hora')?.value;
        const horaAtencion = document.getElementById('horaAtencion')?.value;
        const expediente = document.getElementById('expediente')?.checked || false;
        console.log("Datos recopilados:", { nombre, mascota, fechaConsulta, horaCita, horaAtencion, tipoServicio, expediente });
        const fecha = new Date();
        // --- Calcular el número de ticket visual justo antes de guardar ---
        const hoy = fechaConsulta || getLocalDateString();
        const ticketsHoy = tickets.filter(t => t.fechaConsulta === hoy);
        const nextVisualId = ticketsHoy.length ? Math.max(...ticketsHoy.map(t => parseInt(t.id, 10) || 0)) + 1 : 1;
        // 2. Crear nuevo ticket
        const nuevoTicket = {
            id: nextVisualId, // Solo visual
            randomId: generateRandomId(),
            nombre,
            mascota,
            cedula,
            motivo,
            motivoLlegada,
            estado,
            tipoMascota,
            urgencia,
            idPaciente,
            medicoAtiende,
            numFactura,
            tipoServicio,
            fecha: fecha.toISOString(),
            horaCreacion: fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            porCobrar,
            expediente,
            // Asignar hora de llegada automáticamente
            horaLlegada: fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
        // Asignar hora de atención si el estado inicial es consultorio
        if (["consultorio1", "consultorio2", "consultorio3", "consultorio4", "consultorio5"].includes(estado)) {
            nuevoTicket.horaAtencion = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        if (fechaConsulta) nuevoTicket.fechaConsulta = fechaConsulta;
        if (horaCita) nuevoTicket.horaConsulta = horaCita;
        if (horaAtencion) nuevoTicket.horaAtencion = horaAtencion;
        showLoadingButton(document.querySelector('.btn-submit'));
        if (!ticketsRef) {
            console.error("Error: ticketsRef no está definido");
            showNotification('Error con la base de datos. Por favor recarga la página.', 'error');
            hideLoadingButton(document.querySelector('.btn-submit'));
            return;
        }
        ticketsRef.push(nuevoTicket)
            .then(() => {
                console.log("Ticket guardado exitosamente");
                ticketForm.reset();
                if (document.getElementById('fecha')) {
                    document.getElementById('fecha').value = getLocalDateString();
                }
                hideLoadingButton(document.querySelector('.btn-submit'));
                showNotification('Consulta creada correctamente', 'success');
                setTimeout(() => {
                    showSection(verTicketsSection);
                    setActiveButton(verTicketsBtn);
                }, 1500);
            })
            .catch(error => {
                console.error("Error guardando ticket:", error);
                hideLoadingButton(document.querySelector('.btn-submit'));
                showNotification('Error al guardar la consulta: ' + error.message, 'error');
            });
    } catch (error) {
        console.error("Error en la función addTicket:", error);
        hideLoadingButton(document.querySelector('.btn-submit'));
        showNotification('Error en el proceso de creación: ' + error.message, 'error');
    }
}

// Función para corregir IDs duplicados de tickets
async function fixDuplicateTicketIds() {
    // Crear un mapa para contar ocurrencias de cada id
    const idMap = new Map();
    let maxId = tickets.length > 0 ? Math.max(...tickets.map(t => t.id)) : 0;
    const updates = [];

    tickets.forEach(ticket => {
        if (!idMap.has(ticket.id)) {
            idMap.set(ticket.id, [ticket]);
        } else {
            idMap.get(ticket.id).push(ticket);
        }
    });

    idMap.forEach((ticketList, id) => {
        if (ticketList.length > 1) {
            // El primero se queda igual, los demás se corrigen
            for (let i = 1; i < ticketList.length; i++) {
                maxId++;
                const ticket = ticketList[i];
                const oldId = ticket.id;
                ticket.id = maxId;
                updates.push({ firebaseKey: ticket.firebaseKey, newId: maxId, oldId });
            }
        }
    });

    if (updates.length === 0) {
        console.log('No hay IDs duplicados.');
        showNotification('No se encontraron tickets duplicados.', 'success');
        return;
    }

    // Actualizar en Firebase
    for (const upd of updates) {
        await ticketsRef.child(upd.firebaseKey).update({ id: upd.newId });
        console.log(`Ticket con firebaseKey ${upd.firebaseKey}: ID cambiado de ${upd.oldId} a ${upd.newId}`);
    }
    showNotification('IDs de tickets duplicados corregidos.', 'success');
}
const filterDateInput = document.getElementById('filterDate');
if (filterDateInput && !filterDateInput.value) {
    filterDateInput.value = getLocalDateString();
}
renderTickets('espera');
function renderTickets(filter = 'todos', date = null) {
    ticketContainer.innerHTML = '';
    let filteredTickets;

    const filterDateInput = document.getElementById('filterDate');
    const selectedDate = (filterDateInput && filterDateInput.value) ? filterDateInput.value : getLocalDateString();
    // --- Búsqueda por texto ---
    const searchInput = document.getElementById('ticketSearchInput');
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (filter === 'todos') {
        // Mostrar todos menos terminados y cliente_se_fue
        filteredTickets = tickets.filter(t => t.fechaConsulta === selectedDate && t.estado !== 'terminado' && t.estado !== 'cliente_se_fue');
    } else if (filter === 'espera') {
        filteredTickets = tickets.filter(ticket => ticket.estado === 'espera' && ticket.fechaConsulta === selectedDate);
    } else if (filter === 'consultorio') {
        filteredTickets = tickets.filter(ticket => 
            (
                ticket.estado === 'consultorio1' || 
                ticket.estado === 'consultorio2' || 
                ticket.estado === 'consultorio3' ||
                ticket.estado === 'consultorio4' ||
                ticket.estado === 'consultorio5' ||
                ticket.estado === 'rayosx' ||
                ticket.estado === 'quirofano'
            ) &&
            ticket.fechaConsulta === selectedDate
        );
    } else if (filter === 'terminado') {
        filteredTickets = tickets.filter(ticket => (ticket.estado === 'terminado' || ticket.estado === 'cliente_se_fue') && ticket.fechaConsulta === selectedDate);
    } else if (filter === 'urgentes') {
        filteredTickets = tickets.filter(ticket => ticket.urgencia === 'alta' && ticket.fechaConsulta === selectedDate);
    } else if (filter === 'lista' && sessionStorage.getItem('userRole') !== 'visitas') {
        // Filtro lista: igual que 'todos' pero en formato tabla
        filteredTickets = tickets.filter(t => t.fechaConsulta === selectedDate);
    } else if (filter === 'porFacturar') {
        filteredTickets = tickets.filter(ticket => {
            // Solo mostrar tickets que:
            // 1. No tengan número de factura (numFactura es undefined, null, o string vacío)
            // 2. No estén marcados como "sin costo"
            // 3. Sean de la fecha seleccionada
            return ticket.fechaConsulta === selectedDate && 
                   (!ticket.numFactura || ticket.numFactura.trim() === '') && 
                   (!ticket.sinCosto || ticket.sinCosto !== true);
        });
    } else {
        filteredTickets = tickets.filter(ticket => ticket.fechaConsulta === selectedDate);
    }

    // Aplicar filtro de búsqueda si hay texto
    if (searchText) {
        filteredTickets = filteredTickets.filter(ticket => {
            return (
                (ticket.nombre && ticket.nombre.toLowerCase().includes(searchText)) ||
                (ticket.mascota && ticket.mascota.toLowerCase().includes(searchText)) ||
                (ticket.idPaciente && ticket.idPaciente.toLowerCase().includes(searchText)) ||
                (ticket.numFactura && ticket.numFactura.toLowerCase().includes(searchText))
            );
        });
    }

    if (filter === 'lista' && sessionStorage.getItem('userRole') !== 'visitas') {
        let table = `<table class="excel-tickets-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>N° Ticket</th>
                    <th>Cliente</th>
                    <th>Mascota</th>
                    <th>ID Paciente</th>
                    <th>Estado</th>
                    <th>Hora Llegada</th>
                    <th>Hora Atención</th>
                    <th>Hora Finalización</th>
                    <th>Médico/Asistente</th>
                    <th>Urgencia</th>
                    <th>Motivo de Llegada</th>
                </tr>
            </thead>
            <tbody>`;
        filteredTickets.forEach((ticket, index) => {
            let estadoColor = '';
            if (ticket.estado === 'espera') estadoColor = 'excel-estado-espera';
            else if (ticket.estado && ticket.estado.startsWith('consultorio')) estadoColor = 'excel-estado-consultorio';
            else if (ticket.estado === 'terminado') estadoColor = 'excel-estado-terminado';
            else if (ticket.estado === 'rayosx') estadoColor = 'excel-estado-rayosx';
            else if (ticket.estado === 'quirofano') estadoColor = 'excel-estado-quirofano';
            else if (ticket.estado === 'cliente_se_fue') estadoColor = 'excel-estado-cliente-se-fue';
            else estadoColor = '';
            table += `<tr class="${estadoColor}">
                <td>${index + 1}</td>
                <td>#${ticket.id}</td>
                <td>${ticket.nombre || ''}</td>
                <td>${ticket.mascota || ''}</td>
                <td>${ticket.idPaciente || ''}</td>
                <td>${ticket.estado || ''}</td>
                <td>${ticket.horaLlegada || ''}</td>
                <td>${ticket.horaAtencion || ''}</td>
                <td>${ticket.horaFinalizacion || ''}</td>
                <td>${ticket.medicoAtiende || ''}</td>
                <td>${(ticket.urgencia || '').toUpperCase()}</td>
                <td>${ticket.motivoLlegada || ''}</td>
            </tr>`;
        });
        table += '</tbody></table>';
        ticketContainer.innerHTML = table;
        return;
    }
    
    // Ordenar según el filtro
    if (filter === 'terminado') {
        // Ordenar por número de ticket (id) descendente
        filteredTickets.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else {
        // Ordenar por hora de llegada (orden cronológico)
        filteredTickets.sort((a, b) => {
            // Si ambos tienen hora de llegada, ordenar por hora
            if (a.horaLlegada && b.horaLlegada) {
                return a.horaLlegada.localeCompare(b.horaLlegada);
            }
            // Si solo uno tiene hora de llegada, el que la tiene va primero
            if (a.horaLlegada && !b.horaLlegada) return -1;
            if (!a.horaLlegada && b.horaLlegada) return 1;
            
            // Si ninguno tiene hora de llegada, ordenar por hora de creación como respaldo
            if (a.horaCreacion && b.horaCreacion) {
                return a.horaCreacion.localeCompare(b.horaCreacion);
            }
            
            // Como último recurso, ordenar por ID
            return (a.id || 0) - (b.id || 0);
        });
    }
    
    if (filteredTickets.length === 0) {
        ticketContainer.innerHTML = `
            <div class="no-tickets">
                <i class="fas fa-paw" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                <p>No hay tickets disponibles</p>
            </div>
        `;
        return;
    }
    
    filteredTickets.forEach((ticket, index) => {
        const ticketElement = document.createElement('div');
        
        // Set base class
        ticketElement.className = `ticket ticket-${ticket.estado}`;
        
        // Add urgency class based on ticket urgency level
        ticketElement.classList.add(`ticket-urgencia-${ticket.urgencia}`);
        // Si es prequirurgico, agregar clase especial para fondo lila
        if (ticket.urgencia === 'prequirurgico') {
            ticketElement.classList.add('ticket-prequirurgico-bg');
        }
        
        // Add injectable class if service type is injectable - FIX ERROR
        if (ticket.tipoServicio && typeof ticket.tipoServicio === 'string' && ticket.tipoServicio.includes('inyectable')) {
            ticketElement.classList.add('ticket-inyectable');
        }
        
        ticketElement.dataset.id = ticket.id;
        
        let ticketContent = '';
        
        // Check azul si el ticket ya fue pasado a consultorio o atendido
        let checkIcon = '';
        if (ticket.estado !== 'espera') {
            checkIcon = '<span class="ticket-check-icon"><i class="fas fa-check-circle"></i></span>';
        }
        // Insertar el check al inicio del ticketContent
        ticketContent = checkIcon + ticketContent;

       

        // Check if user is in 'visitas' role with limited view
        if (!hasPermission('canViewFullTicket')) {
            // Get animal icon for visitas
            let animalIcon = '';
            switch(ticket.tipoMascota) {
                case 'perro':
                    animalIcon = '<i class="fas fa-dog animal-icon"></i>';
                    break;
                case 'gato':
                    animalIcon = '<i class="fas fa-cat animal-icon"></i>';
                    break;
                case 'conejo':
                    animalIcon = '<i class="fas fa-paw animal-icon"></i>';
                    break;
                default:
                    animalIcon = '<i class="fas fa-paw animal-icon"></i>';
            }
            // Get urgency class and icon using actual ticket.urgencia
            let urgenciaClass = `urgencia-${ticket.urgencia}`;
            let urgenciaIcon = ticket.urgencia === 'emergencia' ? 'fa-exclamation-triangle' :
                                ticket.urgencia === 'urgencia'    ? 'fa-exclamation' :
                                                                   'fa-info-circle';
            // Get status text and class
            let estadoText = '';
            let estadoClass = '';
            switch(ticket.estado) {
                case 'espera':
                    estadoText = 'En sala de espera';
                    estadoClass = 'estado-espera';
                    break;
                case 'consultorio1':
                    estadoText = 'Consultorio 1';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio2':
                    estadoText = 'Consultorio 2';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio3':
                    estadoText = 'Consultorio 3';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio4':
                    estadoText = 'Consultorio 4';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio5':
                    estadoText = 'Consultorio 5';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'rayosx':
                    estadoText = 'En Rayos X';
                    estadoClass = 'estado-rayosx';
                    break;
                case 'quirofano':
                    estadoText = 'En Quirófano';
                    estadoClass = 'estado-quirofano';
                    break;
                case 'cliente_se_fue':
                    estadoText = 'Cliente se fue';
                    estadoClass = 'estado-cliente-se-fue';
                    break;
                case 'terminado':
                    estadoText = 'Consulta terminada';
                    estadoClass = 'estado-terminado';
                    break;
            }
            // Simplified view for 'visitas' role with animal icon
            ticketContent += `
                <div class="ticket-header">
                    <div class="ticket-title">${animalIcon} ${ticket.mascota}</div>
                    <div class="ticket-number">#${ticket.id}</div>
                </div>
                <div class="ticket-info">
                    <p><i class="fas fa-user"></i> ${ticket.nombre}</p>
                    ${ticket.medicoAtiende ? `<p><i class="fas fa-user-md"></i> Médico: ${ticket.medicoAtiende}</p>` : ''}
                    ${ticket.idPaciente ? `<p><i class="fas fa-fingerprint"></i> ID: ${ticket.idPaciente}</p>` : ''}
                    <p><i class="fas fa-stethoscope"></i> Motivo de llegada: ${ticket.motivoLlegada}</p>
                    ${ticket.fechaConsulta ? `<p><i class="fas fa-calendar-day"></i> Fecha: ${formatDate(ticket.fechaConsulta)}</p>` : ''}
                    ${ticket.horaLlegada ? `<p><i class="fas fa-sign-in-alt"></i> Llegada: ${ticket.horaLlegada}</p>` : ''}
                    ${ticket.horaAtencion ? `<p><i class="fas fa-user-md"></i> Atención: ${ticket.horaAtencion}</p>` : ''}
                    ${ticket.horaFinalizacion ? `<p><i class="fas fa-check-circle"></i> Finalización: ${ticket.horaFinalizacion}</p>` : ''}
                    <p class="${urgenciaClass}"><strong>Categorización de paciente:</strong> ${getUrgenciaLabel(ticket.urgencia)}</p>
                    ${ticket.urgencia === 'emergencia' ? `<div class="ticket-emergencia-anim" style='position:absolute;top:10px;right:10px;z-index:2;'><span style='background:#d32f2f;color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.95em;box-shadow:0 2px 8px rgba(0,0,0,0.12);letter-spacing:1px;'>Emergencia</span></div>` : ''}
                    <div class="estado-badge ${estadoClass}">
                        <i class="fas fa-${ticket.estado === 'espera' ? 'hourglass-half' : 
                                     typeof ticket.estado === 'string' && ticket.estado.includes('consultorio') ? 'user-md' : 'check-circle'}"></i>
                        ${estadoText}
                    </div>
                </div>
            `;
        } else {
            // Full view for other roles, show motivo de consulta debajo del motivo de llegada
            let animalIcon = '';
            switch(ticket.tipoMascota) {
                case 'perro':
                    animalIcon = '<i class="fas fa-dog animal-icon"></i>';
                    break;
                case 'gato':
                    animalIcon = '<i class="fas fa-cat animal-icon"></i>';
                    break;
                case 'conejo':
                    animalIcon = '<i class="fas fa-paw animal-icon"></i>';
                    break;
                default:
                    animalIcon = '<i class="fas fa-paw animal-icon"></i>';
            }
            let estadoText = '';
            let estadoClass = '';
            switch(ticket.estado) {
                case 'espera':
                    estadoText = 'En sala de espera';
                    estadoClass = 'estado-espera';
                    break;
                case 'consultorio1':
                    estadoText = 'Consultorio 1';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio2':
                    estadoText = 'Consultorio 2';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio3':
                    estadoText = 'Consultorio 3';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio4':
                    estadoText = 'Consultorio 4';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio5':
                    estadoText = 'Consultorio 5';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'rayosx':
                    estadoText = 'En Rayos X';
                    estadoClass = 'estado-rayosx';
                    break;
                case 'quirofano':
                    estadoText = 'En Quirófano';
                    estadoClass = 'estado-quirofano';
                    break;
                case 'cliente_se_fue':
                    estadoText = 'Cliente se fue';
                    estadoClass = 'estado-cliente-se-fue';
                    break;
                case 'terminado':
                    estadoText = 'Consulta terminada';
                    estadoClass = 'estado-terminado';
                    break;
            }
            // Crear clase y texto para el nivel de urgencia (NUEVO)
            let urgenciaClass = `urgencia-${ticket.urgencia}`;
            let urgenciaIcon = ticket.urgencia === 'emergencia' ? 'fa-exclamation-triangle' :
                               ticket.urgencia === 'urgencia'    ? 'fa-exclamation' :
                                                                  'fa-info-circle';
            ticketContent += `
                <div class="ticket-header">
                    <div class="ticket-title">${animalIcon} ${ticket.mascota}</div>
                    <div class="ticket-number">#${ticket.id}</div>
                </div>
                <div class="ticket-info">
                    <p><i class="fas fa-user"></i> ${ticket.nombre}</p>
                    <p><i class="fas fa-id-card"></i> ${ticket.cedula}</p>
                    ${ticket.idPaciente ? `<p><i class="fas fa-fingerprint"></i> ID: ${ticket.idPaciente}</p>` : ''}
                    ${ticket.medicoAtiende ? `<p><i class="fas fa-user-md"></i> Médico: ${ticket.medicoAtiende}</p>` : ''}
                    ${ticket.numFactura ? `<p><i class="fas fa-file-invoice"></i> Factura: ${ticket.numFactura}</p>` : ''}
                    <p><i class="fas fa-stethoscope"></i> Motivo de llegada: ${ticket.motivoLlegada}</p>
                    <p><i class='fas fa-notes-medical'></i> Motivo: ${ticket.motivo}</p>
                    ${ticket.fechaConsulta ? `<p><i class="fas fa-calendar-day"></i> Fecha: ${formatDate(ticket.fechaConsulta)}</p>` : ''}
                    ${ticket.horaLlegada ? `<p><i class="fas fa-sign-in-alt"></i> Llegada: ${ticket.horaLlegada}</p>` : ''}
                    ${ticket.horaConsulta ? `<p><i class="fas fa-calendar-check"></i> Cita: ${ticket.horaConsulta}</p>` : ''}
                    ${ticket.horaAtencion ? `<p><i class="fas fa-user-md"></i> Atención: ${ticket.horaAtencion}</p>` : ''}
                    ${ticket.horaFinalizacion ? `<p><i class="fas fa-check-circle"></i> Finalización: ${ticket.horaFinalizacion}</p>` : ''}
                    <p class="${urgenciaClass}"><strong>Categorización de paciente:</strong> ${getUrgenciaLabel(ticket.urgencia)}</p>
                    ${ticket.urgencia === 'emergencia' ? `<div class="ticket-emergencia-anim" style='position:absolute;top:10px;right:10px;z-index:2;'><span style='background:#d32f2f;color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.95em;box-shadow:0 2px 8px rgba(0,0,0,0.12);letter-spacing:1px;'>Emergencia</span></div>` : ''}
                    <div class="estado-badge ${estadoClass}">
                        <i class="fas fa-${ticket.estado === 'espera' ? 'hourglass-half' : 
                                     typeof ticket.estado === 'string' && ticket.estado.includes('consultorio') ? 'user-md' : 'check-circle'}"></i>
                        ${estadoText}
                    </div>
                    ${ticket.expediente ? `<div class="expediente-badge"><i class="fas fa-file-medical"></i> <strong>Expediente médico:</strong> Registrado</div>` : ''}
                    ${ticket.listoParaFacturar ? `<div class="listo-para-facturar-badge"><i class="fas fa-file-invoice-dollar"></i> <strong>Listo para facturar ✓</strong></div>` : ''}
                    ${ticket.porCobrar ? `<div class="por-cobrar-info"><i class='fas fa-money-bill-wave'></i> <strong>Por Cobrar:</strong><br><div style="white-space: pre-wrap; font-size: 13px; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 4px;">${formatPorCobrarDisplay(ticket.porCobrar)}</div></div>` : ''}
                </div>
            `;
        }
        
        // Icono de edición (visible solo en hover)
        ticketContent += ``;
        // Botón de eliminar solo para admin (hover)
        if (hasPermission('canDeleteTickets')) {
            ticketContent += `
            
                </button>
            `;
        }

        // Quitar los botones de editar y cambiar estado
        let actionButtons = '';
        if (hasPermission('canDeleteTickets')) {
            actionButtons += `
                <button class="action-btn btn-eliminar" onclick="event.stopPropagation(); deleteTicketByRandomId('${ticket.randomId}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            `;
        }
        
        // Add end consultation button for admin and external consultation roles
        if (
            (hasPermission('canDeleteTickets') || sessionStorage.getItem('userRole') === 'consulta_externa') &&
            ticket.estado !== 'terminado' && ticket.estado !== 'cliente_se_fue'
        ) {
            actionButtons += `
                <button class="action-btn btn-terminar" onclick="event.stopPropagation(); endConsultationByRandomId('${ticket.randomId}')">
                    <i class="fas fa-check-circle"></i> Terminar Consulta
                </button>
            `;
        }
        
        // Only add action buttons container if there are buttons
        if (actionButtons) {
            ticketContent += `<div class="ticket-actions">${actionButtons}</div>`;
        }
        
        ticketElement.innerHTML = ticketContent;
        
        // Abrir modal de edición solo al hacer click, excepto para visitas
        if (sessionStorage.getItem('userRole') !== 'visitas') {
            ticketElement.addEventListener('click', () => {
                editTicket(ticket.randomId);
            });
        }
        
        // Agregar animación basada en el índice para escalonamiento
        ticketElement.style.animationDelay = `${index * 0.1}s`;
        
        ticketContainer.appendChild(ticketElement);
    });
    
    // Agregar estilos para los niveles de urgencia si no existen
    if (!document.getElementById('urgencia-styles')) {
        const style = document.createElement('style');
        style.id = 'urgencia-styles';
        style.textContent = `
            .ticket-info .urgencia-emergencia {
                color: #d32f2f;
                font-weight: bold;
                background-color: rgba(211, 47, 47, 0.12);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
                animation: pulseUrgent 1.5s infinite;
                box-shadow: 0 0 8px rgba(211,47,47,0.18);
            }
            .ticket-info .urgencia-urgencia {
                color: #fb8c00;
                font-weight: bold;
                background-color: rgba(251, 140, 0, 0.12);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            .ticket-info .urgencia-leve {
                color: #43a047;
                background-color: rgba(67, 160, 71, 0.12);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            .ticket-info .urgencia-consulta {
                color: #1976d2;
                background-color: rgba(25, 118, 210, 0.10);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            .ticket-info .urgencia-prequirurgico {
                color: #8e24aa;
                background-color: rgba(142, 36, 170, 0.13);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            .ticket-prequirurgico-bg {
                background: linear-gradient(135deg, #f3e6fa 60%, #e1c8f7 100%);
                border: 2px solid #b47ddb;
                box-shadow: 0 2px 12px 0 rgba(142,36,170,0.08);
            }
            .listo-para-facturar-badge {
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: 600;
                display: inline-block;
                margin: 5px 0;
                box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                animation: pulseGreen 2s infinite;
            }
            @keyframes pulseGreen {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            @keyframes pulseUrgent {
                0% { transform: scale(1); }
                50% { transform: scale(1.07); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Reemplazar la función formatDate actual con esta versión mejorada
function formatDate(dateString) {
    if (!dateString) return '';
    
    // Dividir la fecha en sus componentes (formato YYYY-MM-DD)
    const [year, month, day] = dateString.split('-');
    
    // Devolver fecha formateada sin crear un objeto Date (evita problemas de zona horaria)
    return `${day}/${month}/${year}`;
}

function mostrarHorario() {
    const fecha = fechaHorario.value;
    
    // Filtrar tickets por fecha de consulta
    const ticketsDelDia = tickets.filter(ticket => {
        // Si el ticket tiene los campos nuevos de fecha y hora
        if (ticket.fechaConsulta) {
            return ticket.fechaConsulta === fecha;
        }
        // Compatibilidad con tickets antiguos: validar fecha
        if (!ticket.fecha) return false;
        const parsedDate = new Date(ticket.fecha);
        if (isNaN(parsedDate.getTime())) return false;
        return parsedDate.toISOString().split('T')[0] === fecha;
    });
    
    // Ordenar por hora
    ticketsDelDia.sort((a, b) => {
        if (a.horaConsulta && b.horaConsulta) {
            return a.horaConsulta.localeCompare(b.horaConsulta);
        }
        return 0;
    });
    
    // Mostrar los tickets en la tabla
    const horarioBody = document.getElementById('horarioBody');
    if (!horarioBody) return;
    
    horarioBody.innerHTML = '';
    
    if (ticketsDelDia.length === 0) {

        horarioBody.innerHTML = `
            <tr>
                <td colspan="12" class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    No hay consultas programadas para esta fecha
                </td>
            </tr>
        `;
        return;
    }
    
    ticketsDelDia.forEach((ticket, index) => {
        const row = document.createElement('tr');
        
        // Determinar la hora a mostrar
        const hora = ticket.horaConsulta || ticket.horaCreacion || '-';
        
        // Determinar el estado
        let estadoLabel = '';
        switch(ticket.estado) {
            case 'espera':
                estadoLabel = 'En Sala de Espera';
                break;
            case 'consultorio1':
                estadoLabel = 'Consultorio 1';
                break;
            case 'consultorio2':
                estadoLabel = 'Consultorio 2';
                break;
            case 'consultorio3':
                estadoLabel = 'Consultorio 3';
                break;
                case 'consultorio4':
                    estadoLabel = 'Consultorio 4'
                    break;
                    case 'consultorio5':
                        estadoLabel = 'Consultorio 5';
                        break;
            case 'rayosx':
                estadoLabel = 'En Rayos X';
                break;
            case 'quirofano':
                estadoLabel = 'En Quirófano';
                break;
            case 'cliente_se_fue':
                estadoLabel = 'Cliente se fue';
                break;
            case 'terminado':
                estadoLabel = 'Terminado';
                break;
            default:
                estadoLabel = ticket.estado;
        }
        
        // Determinar el tipo de mascota
        let tipoLabel = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                tipoLabel = 'Perro';
                break;
            case 'gato':
                tipoLabel = 'Gato';
                break;
            case 'conejo':
                tipoLabel = 'Conejo'; 
                break;
            default:
                tipoLabel = 'Otro';
        }
        
        // Clase de urgencia
        const urgenciaClass = `urgencia-${ticket.urgencia}`;
        
        // Setear el índice para la animación
        row.style.setProperty('--index', index);
        
        row.innerHTML = `
            <td>${hora}</td>
            <td>${ticket.nombre}</td>
            <td>${ticket.mascota}</td>
            <td>${tipoLabel}</td>
            <td>${estadoLabel}</td>
            <td class="${urgenciaClass}">${(ticket.urgencia || '').toUpperCase()}</td>
            <td>${ticket.medicoAtiende || '-'}</td>
            <td>${ticket.idPaciente || '-'}</td>
            <td>${ticket.numFactura || '-'}</td>
            <td>${ticket.horaAtencion || '-'}</td>
            <td>${ticket.porCobrar || '-'}</td>
            <td>
                <button class="btn-edit" onclick="editTicket('${ticket.randomId}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="deleteTicketByRandomId('${ticket.randomId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        horarioBody.appendChild(row);
    });
}
function exportarDia() {
    // Check permissions
    if (!hasPermission('canExportData')) {
        showNotification('No tienes permiso para exportar datos', 'error');
        return;
    }
    
    const fecha = fechaHorario.value;
    
    // Filtrar tickets por fecha
    const ticketsDelDia = tickets.filter(ticket => {
        if (ticket.fechaConsulta) {
            return ticket.fechaConsulta === fecha;
        }
        return new Date(ticket.fecha).toISOString().split('T')[0] === fecha;
    });
    
    if (ticketsDelDia.length === 0) {
        showNotification('No hay consultas para la fecha seleccionada', 'error');
        return;
    }
    
    // Generar el CSV
    exportToCSV(ticketsDelDia, `consultas_${fecha}`);
}

function getTipoMascotaLabel(tipo) {
    const tipos = {
        'perro': 'Perro',
        'gato': 'Gato',
        'conejo': 'Conejo',
        'otro': 'Otro'
    };
    return tipos[tipo] || tipo || '';
}
function getEstadoLabel(estado) {
    const estados = {
        'espera': 'En sala de espera',
        'consultorio1': 'Consultorio 1',
        'consultorio2': 'Consultorio 2',
        'consultorio3': 'Consultorio 3',
        'consultorio4': 'Consultorio 4',
        'consultorio5': 'Consultorio 5',
        'rayosx': 'En Rayos X',
        'quirofano': 'En Quirófano',
        'cliente_se_fue': 'Cliente se fue',
        'terminado': 'Consulta terminada'
    };
    return estados[estado] || estado || '';
}
function exportarMes() {
    const fecha = fechaHorario.value;
const [year, month] = fecha.split('-');

// Filtrar tickets del mes seleccionado
const ticketsDelMes = tickets.filter(ticket => {
        let ticketDate;
        if (ticket.fechaConsulta) {
            ticketDate = new Date(ticket.fechaConsulta);
        } else {
            ticketDate = new Date(ticket.fecha);
        }
        
        return ticketDate.getFullYear() === parseInt(year) && 
               ticketDate.getMonth() === parseInt(month) - 1;
    });
    
    if (ticketsDelMes.length === 0) {
        showNotification('No hay consultas para el mes seleccionado', 'error');
        return;
    }
    
    // Generar el CSV
    exportToCSV(ticketsDelMes, `consultas_${year}_${month}`);
}

function exportToCSV(data, filename) {
    // Encabezados del CSV
    const headers = [
        'ID', 
        'Cliente', 
        'Mascota', 
        'Tipo', 
        'Cédula', 
        'ID Paciente',
        'Médico',
        'Fecha', 
        'Hora', 
        'Estado', 
        'Urgencia',
        'Factura',
        'Motivo de Llegada',
        'Motivo de Consulta',
        'Por Cobrar'
    ];
    
    // Crear las filas de datos
    const rows = data.map(ticket => [
        ticket.id,
        ticket.nombre,
        ticket.mascota,
        getTipoMascotaLabel(ticket.tipoMascota),
        ticket.cedula,
        ticket.idPaciente || '',
        ticket.medicoAtiende || '',
        ticket.fechaConsulta || new Date(ticket.fecha).toISOString().split('T')[0],
        ticket.horaConsulta || ticket.horaCreacion,
        getEstadoLabel(ticket.estado),
        (ticket.urgencia || '').toUpperCase(),
        ticket.numFactura || '',
        ticket.motivoLlegada || '',
        ticket.motivo || '',
        ticket.porCobrar || ''
    ]);
    
    // Usar punto y coma como separador y agregar BOM para UTF-8
    const separator = ';';
    const bom = '\uFEFF';
    const csvContent = [
        headers.join(separator),
        ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(separator))
    ].join('\n');
    
    // Crear blob y enlace de descarga con BOM
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Archivo CSV generado correctamente', 'success');
}

function exportarGoogle() {
    showNotification('Para exportar a Google Sheets, configura la API en producción', 'info');
    
    // Opción alternativa: abrir Google Sheets en nueva pestaña
    window.open('https://docs.google.com/spreadsheets', '_blank');
}

function backupData() {
    // Crear una copia sin las claves de Firebase para el backup
    const ticketsBackup = tickets.map(ticket => {
        const { firebaseKey, ...ticketData } = ticket;
        return ticketData;
    });
    
    const backup = {
        tickets: ticketsBackup,
        currentTicketId: currentTicketId,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const jsonString = JSON.stringify(backup);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_veterinaria_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('Respaldo generado correctamente', 'success');
}

// --- LIMPIEZA DE DATOS ANTIGUOS ---
function cleanOldData() {
    if (!confirm('¿Estás seguro de limpiar las consultas terminadas con más de 3 meses de antigüedad? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    // Mostrar indicador de carga
    showLoading();
    
    // Obtener tickets a eliminar (terminados con más de 3 meses)
    const ticketsToDelete = tickets.filter(ticket => {
        if (ticket.estado !== 'terminado') {
            return false; // Mantener tickets que no estén terminados
        }
        
        // Para tickets terminados, verificar la fecha
        const fechaTicket = new Date(ticket.fecha);
        return fechaTicket < tresMesesAtras;
    });
    
    // Contador para operaciones pendientes
    let pendingOperations = ticketsToDelete.length;
    
    if (pendingOperations === 0) {
        hideLoading();
        showNotification('No hay consultas antiguas para eliminar', 'info');
        return;
    }
    
    // Eliminar cada ticket en Firebase
    ticketsToDelete.forEach(ticket => {
        if (!ticket.firebaseKey) {
            pendingOperations--;
            if (pendingOperations === 0) {
                hideLoading();
                showNotification(`Se eliminaron ${ticketsToDelete.length} consultas antiguas`, 'success');
            }
            return;
        }
        
        ticketsRef.child(ticket.firebaseKey).remove()
            .then(() => {
                pendingOperations--;
                if (pendingOperations === 0) {
                    hideLoading();
                    showNotification(`Se eliminaron ${ticketsToDelete.length} consultas antiguas`, 'success');
                }
            })
            .catch(error => {
                console.error("Error eliminando ticket antiguo:", error);
                pendingOperations--;
                if (pendingOperations === 0) {
                    hideLoading();
                    showNotification('Hubo errores al eliminar algunas consultas antiguas', 'error');
                }
            });
    });
}

function editTicket(randomId) {
    const ticket = tickets.find(t => t.randomId === randomId);
    
    if (!ticket) {
        console.error("Ticket no encontrado con randomId:", randomId);
        showNotification('Error: Ticket no encontrado', 'error');
        return;
    }
    
    console.log("Ticket encontrado:", ticket);
    console.log("Firebase Key:", ticket.firebaseKey);
    
    // Cerrar cualquier modal existente primero
    closeModal();
    
    // Crear un modal para editar
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    
    // Seleccionar icono según tipo de mascota
    let animalIcon = '';
    switch(ticket.tipoMascota) {
        case 'perro':
            animalIcon = '<i class="fas fa-dog"></i>';
            break;
        case 'gato':
            animalIcon = '<i class="fas fa-cat"></i>';
            break;
        case 'conejo':
            animalIcon = '<i class="fas fa-paw"></i>';
            break;
        default:
            animalIcon = '<i class="fas fa-paw"></i>';
    }
    
    // Asegurar que todos los valores estén definidos para evitar errores en el formulario
    const safeTicket = {
        id: ticket.id,
        nombre: ticket.nombre || '',
        mascota: ticket.mascota || '',
        cedula: ticket.cedula || '',
        idPaciente: ticket.idPaciente || '',
        fechaConsulta: ticket.fechaConsulta || '',
        horaConsulta: ticket.horaConsulta || '',
        medicoAtiende: ticket.medicoAtiende || '',
        motivo: ticket.motivo || '',
        motivoLlegada: ticket.motivoLlegada || '',
        numFactura: ticket.numFactura || '',
        tipoMascota: ticket.tipoMascota || 'otro',
        urgencia: ticket.urgencia || 'normal',
        estado: ticket.estado || 'espera',
        firebaseKey: ticket.firebaseKey,
        horaLlegada: ticket.horaLlegada || '',
        horaAtencion: ticket.horaAtencion || '',
        tipoServicio: ticket.tipoServicio || 'consulta',
        expediente: ticket.expediente || false,
        listoParaFacturar: ticket.listoParaFacturar || false
    };
    
    // Separar el médico y asistente si existe
    let doctorSeleccionado = "";
    let asistenteSeleccionado = "";
    
    if (ticket.medicoAtiende) {
        const personal = ticket.medicoAtiende.split(',').map(p => p.trim());
        
        // Intentar identificar el doctor y el asistente
        for (const persona of personal) {
            if (persona.startsWith("Dr.") || persona.startsWith("Dra.")) {
                doctorSeleccionado = persona;
            } else if (persona.startsWith("Tec.")) {
                asistenteSeleccionado = persona;
            }
        }
    }
    
    // Obtener el rol actual
    const userRole = sessionStorage.getItem('userRole');
    // Contador de ediciones para consulta externa
    if (!ticket.editCount) ticket.editCount = 0;
    // Solo puede editar "porCobrar" si NO es recepcion y (si no es consulta_externa o no ha alcanzado el límite)
    const canEditPorCobrar = hasPermission('canEditTickets') && userRole !== 'recepcion' && (userRole !== 'consulta_externa' || ticket.editCount < 7);
    
    // Mostrar historial de Por Cobrar arriba (solo lectura)
    let porCobrarHistorial = '';
    if (ticket.porCobrar) {
      porCobrarHistorial = `<div class='por-cobrar-historial' style='background:#fffbe6;border:1px solid #ffe082;border-radius:4px;padding:8px 12px;margin-bottom:10px;'>${formatPorCobrarDisplay(ticket.porCobrar)}</div>`;
    }
    // Textarea vacío para nueva entrada
    const porCobrarField = canEditPorCobrar
      ? `<div class="form-group">
            <label for="editPorCobrar">Por Cobrar</label>
            ${porCobrarHistorial}
            <textarea id="editPorCobrar" 
                   placeholder="Agregue nueva información que hay que cobrar al cliente..."
                   style="width: 100%; 
                          min-height: 80px; 
                          resize: vertical; 
                          font-size: 14px; 
                          line-height: 1.5;
                          padding: 12px;
                          white-space: pre-wrap;
                          word-wrap: break-word;
                          border: 1px solid #ddd;"></textarea>
        </div>`
      : `<div class="form-group">
            <label for="editPorCobrar">Por Cobrar</label>
            ${porCobrarHistorial}
            <textarea id="editPorCobrar" readonly 
                   style="width: 100%; 
                          min-height: 80px; 
                          resize: vertical; 
                          font-size: 14px; 
                          line-height: 1.5;
                          padding: 12px;
                          white-space: pre-wrap;
                          word-wrap: break-word;
                          background:#f5f5f5; 
                          color:#888; 
                          cursor:not-allowed;"></textarea>
        </div>`;

    // Protección en el textarea para evitar borrar contenido existente
    setTimeout(() => {
      const porCobrarTextarea = document.getElementById('editPorCobrar');
      if (porCobrarTextarea && canEditPorCobrar) {
        const originalLength = porCobrarTextarea.value.length;
        porCobrarTextarea.addEventListener('keydown', function(e) {
          // Permitir solo agregar al final
          if ((e.key === 'Backspace' || e.key === 'Delete') && this.selectionStart <= originalLength) {
            e.preventDefault();
          }
          // Evitar escribir en medio del texto original
          if (this.selectionStart < originalLength) {
            this.setSelectionRange(originalLength, originalLength);
          }
        });
        porCobrarTextarea.addEventListener('paste', function(e) {
          // Solo permitir pegar al final
          if (this.selectionStart < originalLength) {
            this.setSelectionRange(originalLength, originalLength);
          }
        });
        // Forzar el cursor al final al enfocar
        porCobrarTextarea.addEventListener('focus', function() {
          this.setSelectionRange(this.value.length, this.value.length);
        });
      }
    }, 0);

    // Botón "Listo para facturar" - visible para todos menos visitas, color naranja sin animación
    const listoParaFacturarButton = userRole !== 'visitas' 
      ? `<div class="form-group" style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px;">
            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #2c3e50;">
                <input type="checkbox" id="editListoParaFacturar" ${safeTicket.listoParaFacturar ? 'checked' : ''} 
                       style="width: 18px; height: 18px; cursor: pointer;">
                <i class="fas fa-file-invoice-dollar" style="color: #ff9800;"></i>
                <span id="listoParaFacturarText" style="color: #ff9800;">
                    Listo para facturar
                </span>
            </label>
            <small style="display: block; margin-top: 5px; color: #7f8c8d; font-style: italic;">
                Marcar cuando el paciente esté listo para ser facturado
            </small>
        </div>`
      : '';

    // Eliminar animación de badge en CSS si existe
    const styleTag = document.getElementById('urgencia-styles');
    if (styleTag) {
      styleTag.textContent = styleTag.textContent.replace(/\.listo-para-facturar-badge\s*\{[^}]*animation:[^;]+;[^}]*\}/g, '.listo-para-facturar-badge { background: #ff9800; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 600; display: inline-block; margin: 5px 0; box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3); }');
    }
    
    // Mostrar/ocultar campo Hora de Cita según el rol en edición
    const canShowHoraCita = ["admin", "recepción", "quirofano"].includes(userRole);
    
    // Crear el contenido del modal con el formulario
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <h3>${animalIcon} Editar Consulta #${safeTicket.id}</h3>
            <form id="editTicketForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="editNombre">Nombre del Cliente</label>
                        <input type="text" id="editNombre" value="${safeTicket.nombre}" required>
                    </div>
                    <div class="form-group">
                        <label for="editMascota">Nombre de la Mascota</label>
                        <input type="text" id="editMascota" value="${safeTicket.mascota}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editIdPaciente">Número ID del paciente</label>
                        <input type="text" id="editIdPaciente" value="${safeTicket.idPaciente}" required>
                    </div>
                    <div class="form-group">
                        <label for="editCedula">Cédula</label>
                        <input type="text" id="editCedula" value="${safeTicket.cedula}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editFecha">Fecha de Consulta</label>
                        <input type="date" id="editFecha" value="${safeTicket.fechaConsulta}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Hora de Llegada</label>
                        <input type="text" value="${safeTicket.horaLlegada || ''}" readonly disabled style="background:#f5f5f5;color:#888;cursor:not-allowed;">
                    </div>
                    ${canShowHoraCita ? `<div class="form-group">
                        <label for="editHora">Hora de Cita</label>
                        <input type="time" id="editHora" value="${safeTicket.horaConsulta || ''}">
                    </div>` : ''}
                    <div class="form-group">
                        <label>Hora de Atención</label>
                        <input type="text" value="${safeTicket.horaAtencion || ''}" readonly disabled style="background:#f5f5f5;color:#888;cursor:not-allowed;">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editDoctorAtiende"><i class="fas fa-user-md"></i> Doctor que atiende</label>
                        <select id="editDoctorAtiende" name="editDoctorAtiende">
                            <option value="">Seleccione un doctor</option>
                            <option value="Dr. Luis Coto" ${doctorSeleccionado === "Dr. Luis Coto" ? 'selected' : ''}>Dr. Luis Coto</option>
                            <option value="Dr. Randall Azofeifa" ${doctorSeleccionado === "Dr. Randall Azofeifa" ? 'selected' : ''}>Dr. Randall Azofeifa</option>
                            <option value="Dr. Gustavo González" ${doctorSeleccionado === "Dr. Gustavo González" ? 'selected' : ''}>Dr. Gustavo González</option>
                            <option value="Dra. Daniela Sancho" ${doctorSeleccionado === "Dra. Daniela Sancho" ? 'selected' : ''}>Dra. Daniela Sancho</option>
                            <option value="Dra. Francinny Nuñez" ${doctorSeleccionado === "Dra. Francinny Nuñez" ? 'selected' : ''}>Dra. Francinny Nuñez</option>
                            <option value="Dra. Kharen Moreno" ${doctorSeleccionado === "Dra. Kharen Moreno" ? 'selected' : ''}>Dra. Kharen Moreno</option>
                            <option value="Dra. Karina Madrigal" ${doctorSeleccionado === "Dra. Karina Madrigal" ? 'selected' : ''}>Dra. Karina Madrigal</option>
                            <option value="Dra. Lourdes Chacón" ${doctorSeleccionado === "Dra. Lourdes Chacón" ? 'selected' : ''}>Dra. Lourdes Chacón</option>
                            <option value="Dra. Sofia Carrillo" ${doctorSeleccionado === "Dra. Sofia Carrillo" ? 'selected' : ''}>Dra. Sofia Carrillo</option>
                            <option value="Dra. Karla Quesada" ${doctorSeleccionado === "Dra. Karla Quesada" ? 'selected' : ''}>Dra. Karla Quesada</option>
                            <option value="Dra. Natalia Alvarado" ${doctorSeleccionado === "Dra. Natalia Alvarado" ? 'selected' : ''}>Dra. Natalia Alvarado</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editAsistenteAtiende"><i class="fas fa-user-nurse"></i> Asistente que atiende</label>
                        <select id="editAsistenteAtiende" name="editAsistenteAtiende">
                            <option value="">Seleccione un asistente</option>
                            <option value="Tec. Maribel Guzmán" ${asistenteSeleccionado === "Tec. Maribel Guzmán" ? 'selected' : ''}>Tec. Maribel Guzmán</option>
                            <option value="Tec. Juliana Perez" ${asistenteSeleccionado === "Tec. Juliana Perez" ? 'selected' : ''}>Tec. Juliana Perez</option>
                            <option value="Tec. Jafeth Bermudez" ${asistenteSeleccionado === "Tec. Jafeth Bermudez" ? 'selected' : ''}>Tec. Jafeth Bermudez</option>
                            <option value="Tec. Johnny Chacón" ${asistenteSeleccionado === "Tec. Johnny Chacón" ? 'selected' : ''}>Tec. Johnny Chacón</option>
                            <option value="Tec. Gabriela Zuñiga" ${asistenteSeleccionado === "Tec. Gabriela Zuñiga" ? 'selected' : ''}>Tec. Gabriela Zuñiga</option>
                            <option value="Tec. Indra Perez" ${asistenteSeleccionado === "Tec. Indra Perez" ? 'selected' : ''}>Tec. Indra Perez</option>
                            <option value="Tec. Randy Arias" ${asistenteSeleccionado === "Tec. Randy Arias" ? 'selected' : ''}>Tec. Randy Arias</option>
                            <option value="Tec. Yancy Picado" ${asistenteSeleccionado === "Tec. Yancy Picado" ? 'selected' : ''}>Tec. Yancy Picado</option>
                            <option value="Tec. Maria Fernanda"${asistenteSeleccionado === "Tec. Maria Fernanda" ? 'selected' : ''}>Tec. Maria Fernanda</option>
                            <option value="Tec. Maria José Gutierrez"${asistenteSeleccionado === "Tec. Maria José Gutierrez" ? 'selected' : ''}>Tec. Maria José Gutierrez</option>
                            <option value="Tec. Jimena Urtecho"${asistenteSeleccionado === "Tec.  Jimena Urtecho" ? 'selected' : ''}>Tec.  Jimena Urtecho</option>
                            <option value="Tec. Nicole Gamboa" ${asistenteSeleccionado === "Tec. Nicole Gamboa" ? 'selected' : ''}>Tec. Nicole Gamboa</option>
                            <option value="Tec. Paola López" ${asistenteSeleccionado === "Tec. Paola López" ? 'selected' : ''}>Tec. Paola López</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="editMotivoLlegada">Motivo de Llegada</label>
                    <textarea id="editMotivoLlegada">${safeTicket.motivoLlegada || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="editMotivo">Motivo de Consulta</label>
                    <textarea id="editMotivo">${safeTicket.motivo}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editEstado">Estado</label>
                        <select id="editEstado" required>
                            <option value="espera" ${safeTicket.estado === 'espera' ? 'selected' : ''}>En Sala de Espera</option>
                            <option value="consultorio1" ${safeTicket.estado === 'consultorio1' ? 'selected' : ''}>Consultorio 1</option>
                            <option value="consultorio2" ${safeTicket.estado === 'consultorio2' ? 'selected' : ''}>Consultorio 2</option>
                            <option value="consultorio3" ${safeTicket.estado === 'consultorio3' ? 'selected' : ''}>Consultorio 3</option>
                            <option value="consultorio4" ${safeTicket.estado === 'consultorio4' ? 'selected' : ''}>Consultorio 4</option>
                            <option value="consultorio5" ${safeTicket.estado === 'consultorio5' ? 'selected' : ''}>Consultorio 5</option>
                            <option value="rayosx" ${safeTicket.estado === 'rayosx' ? 'selected' : ''}>En Rayos X</option>
                            <option value="quirofano" ${safeTicket.estado === 'quirofano' ? 'selected' : ''}>En Quirófano</option>
                            <option value="cliente_se_fue" ${safeTicket.estado === 'cliente_se_fue' ? 'selected' : ''}>Cliente se fue</option>
                            <option value="terminado" ${safeTicket.estado === 'terminado' ? 'selected' : ''}>Consulta Terminada</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editTipoMascota">Tipo de Mascota</label>
                        <select id="editTipoMascota" required>
                            <option value="perro" ${safeTicket.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                            <option value="gato" ${safeTicket.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                            <option value="conejo" ${safeTicket.tipoMascota === 'conejo' ? 'selected' : ''}>Conejo</option>
                            <option value="otro" ${safeTicket.tipoMascota === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editUrgencia">Categorización de pacientes</label>
                        <select id="editUrgencia" required>
                            <option value="emergencia" ${safeTicket.urgencia === 'emergencia' ? 'selected' : ''}>🔴 Emergencias</option>
                            <option value="urgencia" ${safeTicket.urgencia === 'urgencia' ? 'selected' : ''}>🟠 Urgencias</option>
                            <option value="leve" ${safeTicket.urgencia === 'leve' ? 'selected' : ''}>🟢 Leve</option>
                            <option value="consulta" ${safeTicket.urgencia === 'consulta' ? 'selected' : ''}>🔵 Consulta</option>
                            <option value="prequirurgico" ${safeTicket.urgencia === 'prequirurgico' ? 'selected' : ''}>🟣 Examenes Pre Quirurgicos</option>
                        </select>
                        <div id="editUrgenciaDesc" style="font-size:0.95em;color:#1976d2;margin-top:4px;"></div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editNumFactura">Número de factura</label>
                        <input type="text" id="editNumFactura" value="${safeTicket.numFactura}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="editTipoServicio">Tipo de Servicio</label>
                    <select id="editTipoServicio" required>
                        <option value="consulta" ${safeTicket.tipoServicio === 'consulta' ? 'selected' : ''}>Consulta general</option>
                        <option value="revaloracion" ${safeTicket.tipoServicio === 'revaloracion' ? 'selected' : ''}>Revaloración</option>
                        <option value="retiroHilos" ${safeTicket.tipoServicio === 'retiroHilos' ? 'selected' : ''}>Retiro de hilos</option>
                        <option value="rayosX" ${safeTicket.tipoServicio === 'rayosX' ? 'selected' : ''}>Rayos X</option>
                        <option value="desparasitacion" ${safeTicket.tipoServicio === 'desparasitacion' ? 'selected' : ''}>Desparasitación</option>
                        <option value="inyectable" ${safeTicket.tipoServicio === 'inyectable' ? 'selected' : ''}>Inyectables</option>
                        <option value="vacunas" ${safeTicket.tipoServicio === 'vacunas' ? 'selected' : ''}>Vacunas</option>
                        <option value="consulta_8pm" ${safeTicket.tipoServicio === 'consulta_8pm' ? 'selected' : ''}>Consulta después de las 8 P.M</option>
                        <option value="consulta_6pm" ${safeTicket.tipoServicio === 'consulta_6pm' ? 'selected' : ''}>Consulta después de las 6 P.M</option>
                        <option value="hmg_limpieza" ${safeTicket.tipoServicio === 'hmg_limpieza' ? 'selected' : ''}>HMG Limpieza</option>
                        <option value="hmg_castracion" ${safeTicket.tipoServicio === 'hmg_castracion' ? 'selected' : ''}>HMG Castración</option>
                        <option value="cambio_vendaje" ${safeTicket.tipoServicio === 'cambio_vendaje' ? 'selected' : ''}>Cambio de vendaje</option>
                        <option value="convenia_cx" ${safeTicket.tipoServicio === 'convenia_cx' ? 'selected' : ''}>Convenia de CX</option>
                        <option value="analito" ${safeTicket.tipoServicio === 'analito' ? 'selected' : ''}>Analito</option>
                        <option value="panel_general_basico" ${safeTicket.tipoServicio === 'panel_general_basico' ? 'selected' : ''}>Panel General Básico</option>
                        <option value="panel_plus" ${safeTicket.tipoServicio === 'panel_plus' ? 'selected' : ''}>Panel Plus</option>
                        <option value="perfil_quimico_general" ${safeTicket.tipoServicio === 'perfil_quimico_general' ? 'selected' : ''}>Perfil quimico general</option>
                        <option value="perfil_pre_quirurgico" ${safeTicket.tipoServicio === 'perfil_pre_quirurgico' ? 'selected' : ''}>Perfil pre quirurgico</option>
                        <option value="perfil_renal" ${safeTicket.tipoServicio === 'perfil_renal' ? 'selected' : ''}>Perfil renal</option>
                        <option value="cirugia" ${safeTicket.tipoServicio === 'cirugia' ? 'selected' : ''}>Cirugía</option>
                        <option value="muestra_test" ${safeTicket.tipoServicio === 'muestra_test' ? 'selected' : ''}>Muestra para test</option>
                        <option value="tiempos_coagulacion" ${safeTicket.tipoServicio === 'tiempos_coagulacion' ? 'selected' : ''}>Tiempos de coagulación</option>
                        <option value="internamiento" ${safeTicket.tipoServicio === 'internamiento' ? 'selected' : ''}>Internamiento</option>
                        <option value="test_sida_leucemia" ${safeTicket.tipoServicio === 'test_sida_leucemia' ? 'selected' : ''}>Test sida leucemia</option>
                        <option value="corteUnas" ${safeTicket.tipoServicio === 'corteUnas' ? 'selected' : ''}>Corte de uñas</option>
                        <option value="emergencia" ${safeTicket.tipoServicio === 'emergencia' ? 'selected' : ''}>Emergencia</option>
                        <option value="tomaMuestras" ${safeTicket.tipoServicio === 'tomaMuestras' ? 'selected' : ''}>Toma de muestras</option>
                        <option value="tests" ${safeTicket.tipoServicio === 'tests' ? 'selected' : ''}>Tests</option>
                        <option value="hemograma" ${safeTicket.tipoServicio === 'hemograma' ? 'selected' : ''}>Hemograma</option>
                        <option value="eutanasia" ${safeTicket.tipoServicio === 'eutanasia' ? 'selected' : ''}>Eutanasia</option>
                        <option value="quitarPuntos" ${safeTicket.tipoServicio === 'quitarPuntos' ? 'selected' : ''}>Quitar puntos</option>
                        <option value="otro" ${safeTicket.tipoServicio === 'otro' ? 'selected' : ''}>Otro</option>
                        <option value="prequirurgico" ${safeTicket.tipoServicio === 'prequirurgico' ? 'selected' : ''}>Examenes Pre Quirurgicos</option>
                        <option value="test_sida_leucemia" ${safeTicket.tipoServicio === 'test_sida_leucemia' ? 'selected' : ''}>Test de Sida Leucemia</option>
                        <option value="test_distemper" ${safeTicket.tipoServicio === 'test_distemper' ? 'selected' : ''}>Test de Distemper</option>
                        <option value="test_parvovirus" ${safeTicket.tipoServicio === 'test_parvovirus' ? 'selected' : ''}>Test Parvovirus</option>
                        <option value="rx_control" ${safeTicket.tipoServicio === 'rx_control' ? 'selected' : ''}>RX de Control</option>
                    </select>
                </div>
                
                ${porCobrarField}
                
                ${userRole !== 'visitas' ? `
                <div class="form-group" style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #2c3e50;">
                        <input type="checkbox" id="editExpediente" ${safeTicket.expediente ? 'checked' : ''} 
                               style="width: 18px; height: 18px; cursor: pointer;">
                        <i class="fas fa-clipboard-list" style="color: #27ae60;"></i>
                        Paciente ingresado al expediente médico
                    </label>
                    <small style="display: block; margin-top: 5px; color: #7f8c8d; font-style: italic;">
                        Marcar cuando el paciente haya sido registrado en el sistema Argus
                    </small>
                </div>
                ` : ''}
                
                ${listoParaFacturarButton}
                
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Cambios</button>
                </div>
            </form>
            <div id="ticketEdicionesHistorial" style="margin-top:30px;">
                <h4 style="margin-bottom:10px;">Historial de Ediciones</h4>
                <div id="ticketEdicionesHistorialBody"><div style='color:#888;'>Cargando historial...</div></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listener para el checkbox "Listo para facturar" - disponible para todos excepto visitas
    const listoParaFacturarCheckbox = document.getElementById('editListoParaFacturar');
    if (listoParaFacturarCheckbox && userRole !== 'visitas') {
        listoParaFacturarCheckbox.addEventListener('change', function() {
            // Guardar inmediatamente el estado
            const ticketToUpdate = {
                listoParaFacturar: this.checked
            };
            
            // Referencia a Firebase
            const ticketsRef = firebase.database().ref('tickets');
            
            ticketsRef.child(ticket.firebaseKey).update(ticketToUpdate)
                .then(() => {
                    const statusMessage = this.checked ? 'Marcado como listo para facturar' : 'Desmarcado como listo para facturar';
                    showNotification(statusMessage, 'success');
                })
                .catch(error => {
                    console.error('Error actualizando estado de facturación:', error);
                    showNotification('Error al actualizar estado de facturación', 'error');
                    // Revertir el cambio en caso de error
                    this.checked = !this.checked;
                });
        });
    }
    
    // Añadir event listener al formulario para guardar los cambios
    document.getElementById('editTicketForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Combinar doctor y asistente
        const editDoctorAtiende = document.getElementById('editDoctorAtiende').value;
        const editAsistenteAtiende = document.getElementById('editAsistenteAtiende').value;
        let medicoAtiende = '';
        
        if (editDoctorAtiende && editAsistenteAtiende) {
            medicoAtiende = `${editDoctorAtiende}, ${editAsistenteAtiende}`;
        } else if (editDoctorAtiende) {
            medicoAtiende = editDoctorAtiende;
        } else if (editAsistenteAtiende) {
            medicoAtiende = editAsistenteAtiende;
        }
        
        // Recoger todos los datos del formulario
        const editExpediente = document.getElementById('editExpediente');
        const expedienteValue = editExpediente ? editExpediente.checked : false;
        
        const editListoParaFacturar = document.getElementById('editListoParaFacturar');
        const listoParaFacturarValue = editListoParaFacturar ? editListoParaFacturar.checked : false;
        
        // Procesar el campo porCobrar
        let updatedPorCobrar = ticket.porCobrar || '';
        const editPorCobrar = document.getElementById('editPorCobrar');
        if (editPorCobrar && canEditPorCobrar) {
            const newContent = editPorCobrar.value.trim();
            if (newContent.length > 0) {
                const timestamp = new Date().toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const userName = sessionStorage.getItem('userName') || 'Usuario';
                const separator = updatedPorCobrar ? '\n\n' : '';
                const newEntry = `${separator}--- ${timestamp} (${userName}) ---\n${newContent}`;
                updatedPorCobrar = updatedPorCobrar + newEntry;
            }
            // Si no hay texto nuevo, no se agrega nada
        }
        
        const updatedTicket = {
            id: safeTicket.id,
            nombre: document.getElementById('editNombre').value,
            mascota: document.getElementById('editMascota').value,
            cedula: document.getElementById('editCedula').value,
            idPaciente: document.getElementById('editIdPaciente').value,
            fechaConsulta: document.getElementById('editFecha').value,
            horaAtencion: ticket.horaAtencion || '',
            medicoAtiende: medicoAtiende,
            motivo: document.getElementById('editMotivo').value,
            motivoLlegada: document.getElementById('editMotivoLlegada').value,
            estado: document.getElementById('editEstado').value,
            tipoMascota: document.getElementById('editTipoMascota').value,
            urgencia: document.getElementById('editUrgencia').value,
            numFactura: document.getElementById('editNumFactura').value,
            tipoServicio: document.getElementById('editTipoServicio').value,
            firebaseKey: safeTicket.firebaseKey,
            porCobrar: updatedPorCobrar,
            expediente: expedienteValue,
            listoParaFacturar: listoParaFacturarValue
        };
        
        // Si el estado cambia a terminado o cliente_se_fue, registrar hora de finalización si no existe
        if ((updatedTicket.estado === 'terminado' || updatedTicket.estado === 'cliente_se_fue') && !ticket.horaFinalizacion) {
            const ahora = new Date();
            updatedTicket.horaFinalizacion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Si el usuario es consulta_externa, incrementar el contador de ediciones
        if (userRole === 'consulta_externa') {
            ticket.editCount = (ticket.editCount || 0) + 1;
            updatedTicket.editCount = ticket.editCount;
        }
        
        // Guardar el ticket actualizado
        saveEditedTicket(updatedTicket);
    });
    
    // Deshabilitar el botón de guardar si se alcanzó el límite de ediciones
    if (userRole === 'consulta_externa' && ticket.editCount >= 7) {
        const saveBtn = modal.querySelector('.btn-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Límite de ediciones alcanzado';
            saveBtn.style.background = '#ccc';
            saveBtn.style.cursor = 'not-allowed';
        }
    }
    
    // Actualizar descripción de urgencia
    const editUrgenciaDescriptions = {
        emergencia: 'Emergencias. Situaciones críticas que requieren atención médica inmediata. Se mostrará como EMERGENCIA en el ticket.',
        urgencia: 'Urgencias. Problemas de salud que deben atenderse pronto, pero no son críticos.',
        leve: 'Leve. Puede esperar, sin riesgo inmediato.',
        consulta: 'Consulta. Atención general o rutinaria.'
    };
    function updateEditUrgenciaDescription() {
        const select = document.getElementById('editUrgencia');
        const desc = document.getElementById('editUrgenciaDesc');
        if (!select || !desc) return;
        desc.textContent = editUrgenciaDescriptions[select.value] || '';
    }
    const editUrgenciaSelect = document.getElementById('editUrgencia');
    if (editUrgenciaSelect) {
        editUrgenciaSelect.addEventListener('change', updateEditUrgenciaDescription);
        updateEditUrgenciaDescription();
    }

    // --- En el modal de edición, mostrar la hora de atención como solo lectura ---
    // Busca el input de hora de atención y cámbialo a readonly y deshabilitado
    setTimeout(() => {
      const horaAtencionInput = document.getElementById('editHoraAtencion');
      if (horaAtencionInput) {
        horaAtencionInput.readOnly = true;
        horaAtencionInput.disabled = true;
        horaAtencionInput.style.background = '#f5f5f5';
        horaAtencionInput.style.color = '#888';
        horaAtencionInput.style.cursor = 'not-allowed';
      }
      // Agregar lógica para actualizar la hora de atención automáticamente al cambiar el estado
      const estadoSelect = document.getElementById('editEstado');
      if (estadoSelect && horaAtencionInput) {
        estadoSelect.addEventListener('change', function() {
          if (this.value.startsWith('consultorio') && !horaAtencionInput.value) {
            const ahora = new Date();
            const horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            horaAtencionInput.value = horaActual;
          } else if (this.value === 'espera') {
            horaAtencionInput.value = '';
          }
        });
      }
    }, 0);

    // --- HISTORIAL DE EDICIONES SOLO DE ESTE TICKET (TIEMPO REAL) ---
    const userRoleHistorial = sessionStorage.getItem('userRole');
    const historialBody = modal.querySelector('#ticketEdicionesHistorialBody');
    const historialContainer = modal.querySelector('#ticketEdicionesHistorial');
    if (userRoleHistorial === 'admin' && historialBody && typeof firebase !== 'undefined' && firebase.database) {
        // Limpiar listener previo si existe
        if (window._ticketEdicionesListener) {
            firebase.database().ref('ticket_edits').off('value', window._ticketEdicionesListener);
        }
        window._ticketEdicionesListener = function(snapshot) {
            const edits = [];
            snapshot.forEach(child => {
                const edit = child.val();
                if (edit.randomId === ticket.randomId) {
                    edits.push(edit);
                }
            });
            edits.sort((a, b) => (b.fecha + ' ' + b.hora).localeCompare(a.fecha + ' ' + a.hora));
            if (edits.length === 0) {
                historialBody.innerHTML = `<div style='color:#888;'>No hay ediciones para este ticket</div>`;
                return;
            }
            let html = `<table style='width:100%;font-size:0.97em;border-collapse:collapse;'>
                <thead><tr style='background:#f5f5f5;'><th>Fecha</th><th>Hora</th><th>Usuario</th><th>Email</th><th>Factura</th><th>Cambios</th></tr></thead><tbody>`;
            edits.forEach(edit => {
                const cambios = Object.entries(edit.cambios || {}).map(([campo, val]) =>
                    `<div><strong>${campo}:</strong> <span style='color:#b00'>${val.antes}</span> → <span style='color:#080'>${val.despues}</span></div>`
                ).join('');
                html += `<tr style='border-bottom:1px solid #eee;'><td>${edit.fecha}</td><td>${edit.hora}</td><td>${edit.usuario}</td><td>${edit.email}</td><td>${ticket.numFactura || ''}</td><td>${cambios}</td></tr>`;
            });
            html += '</tbody></table>';
            historialBody.innerHTML = html;
        };
        firebase.database().ref('ticket_edits').on('value', window._ticketEdicionesListener);
        // Limpiar el listener al cerrar el modal
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                firebase.database().ref('ticket_edits').off('value', window._ticketEdicionesListener);
            });
        }
    } else if (historialContainer) {
        historialContainer.style.display = 'none';
    }
}

function getTicketDiff(oldTicket, newTicket) {
    const diff = {};
    Object.keys(newTicket).forEach(key => {
        if (key === 'firebaseKey') return;
        if (oldTicket[key] !== newTicket[key]) {
            diff[key] = { antes: oldTicket[key] || '', despues: newTicket[key] || '' };
        }
    });
    return diff;
}

function saveEditedTicket(ticket) {
    console.log("Guardando ticket actualizado:", ticket);
    
    if (!ticket.firebaseKey) {
        console.error("Error: No hay clave de Firebase para el ticket", ticket);
        showNotification('Error al guardar los cambios: falta identificador', 'error');
        return;
    }
    
    // Guardar la sección y filtro activos antes de actualizar
    const currentSection = document.querySelector('.content section.active');
    const currentFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
    
    // Mostrar indicador de carga
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        showLoadingButton(saveButton);
    }
    
    // Eliminar la propiedad firebaseKey antes de guardar
    const ticketToSave = {...ticket};
    delete ticketToSave.firebaseKey;
    
    // Asegurarse de que ningún campo sea undefined
    Object.keys(ticketToSave).forEach(key => {
        if (ticketToSave[key] === undefined) {
            ticketToSave[key] = '';
        }
    });
    
    // Obtener el ticket anterior para comparar cambios
    const oldTicket = tickets.find(t => t.firebaseKey === ticket.firebaseKey) || {};
    const diff = getTicketDiff(oldTicket, ticket);
    
    // Verificar si el estado cambió a consultorio y establecer hora de atención si es necesario
    if (diff.estado && 
        ticketToSave.estado.startsWith('consultorio') && 
        oldTicket.estado === 'espera' && 
        !ticketToSave.horaAtencion) {
        const ahora = new Date();
        ticketToSave.horaAtencion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        diff.horaAtencion = {
            antes: '',
            despues: ticketToSave.horaAtencion
        };
    }
    
    // CAMBIO: Asegurarse de que la hora de atención se mantenga cuando cambia a terminado
    if (diff.estado && ticketToSave.estado === 'terminado' && oldTicket.horaAtencion) {
        ticketToSave.horaAtencion = oldTicket.horaAtencion;
    }
    
    // Si hay cambios, registrar la edición
    if (Object.keys(diff).length > 0) {
        const userName = sessionStorage.getItem('userName') || 'Desconocido';
        const userEmail = sessionStorage.getItem('userEmail') || '';
        const now = new Date();
        let randomId = ticket.randomId;
        if (!randomId) {
            // Buscar por firebaseKey
            const tByKey = tickets.find(t => t.firebaseKey === ticket.firebaseKey);
            if (tByKey && tByKey.randomId) randomId = tByKey.randomId;
        }
        if (!randomId && ticket.id) {
            // Buscar por id (último recurso)
            const tById = tickets.find(t => t.id === ticket.id);
            if (tById && tById.randomId) randomId = tById.randomId;
        }
        const editLog = {
            idTicket: ticket.id,
            usuario: userName,
            email: userEmail,
            fecha: now.toISOString().split('T')[0],
            hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            cambios: diff
        };
        if (randomId) {
            editLog.randomId = randomId;
        }
        // Guardar en la rama ticket_edits en Firebase
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('ticket_edits').push(editLog);
        }
    }
    
    // Usar update en lugar de eliminar y recrear el ticket
    ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
        .then(() => {
            closeModal();
            showNotification('Consulta actualizada correctamente', 'success');
            
            // Actualizar la página actual
            if (currentSection && currentSection.id === 'verTicketsSection') {
                renderTickets(currentFilter);
                
                // Mantener el filtro activo
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-filter') === currentFilter) {
                        btn.classList.add('active');
                    }
                });
                
                // Asegurar que el botón de navegación también está activo
                setActiveButton(verTicketsBtn);
            } else if (currentSection && currentSection.id === 'horarioSection') {
                mostrarHorario();
            } else {
                renderTickets();
            }
            
            updateStatsGlobal();
        })
        .catch(error => {
            console.error("Error actualizando ticket:", error);
            if (saveButton) {
                hideLoadingButton(saveButton);
            }
            showNotification('Error al guardar los cambios: ' + error.message, 'error');
        });
}

function changeStatus(randomId) {
    const ticket = tickets.find(t => t.randomId === randomId);
    if (!ticket) return;
    
    // Mostrar modal para cambiar estado
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3>Cambiar Estado del Ticket #${ticket.id}</h3>
            <form id="statusForm">
                <div class="form-group">
                    <label for="changeEstado">Nuevo Estado</label>
                    <select id="changeEstado" required>
                        <option value="espera" ${ticket.estado === 'espera' ? 'selected' : ''}>En Sala de Espera</option>
                        <option value="consultorio1" ${ticket.estado === 'consultorio1' ? 'selected' : ''}>Consultorio 1</option>
                        <option value="consultorio2" ${ticket.estado === 'consultorio2' ? 'selected' : ''}>Consultorio 2</option>
                        <option value="consultorio3" ${ticket.estado === 'consultorio3' ? 'selected' : ''}>Consultorio 3</option>
                        <option value="consultorio4" ${ticket.estado === 'consultorio4' ? 'selected' : ''}>Consultorio 4</option>
                        <option value="consultorio5" ${ticket.estado === 'consultorio5' ? 'selected' : ''}>Consultorio 5</option>
                        <option value="rayosx" ${ticket.estado === 'rayosx' ? 'selected' : ''}>En Rayos X</option>
                        <option value="quirofano" ${ticket.estado === 'quirofano' ? 'selected' : ''}>En Quirófano</option>
                        <option value="cliente_se_fue" ${ticket.estado === 'cliente_se_fue' ? 'selected' : ''}>Cliente se fue</option>
                        <option value="terminado" ${ticket.estado === 'terminado' ? 'selected' : ''}>Consulta Terminada</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Cambios</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('statusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Actualizar estado del ticket
        const nuevoEstado = document.getElementById('changeEstado').value;
        ticket.estado = nuevoEstado;
        
        // Si el ticket pasa a consultorio y no tiene hora de atención, registrarla automáticamente
        if (nuevoEstado.includes('consultorio') && !ticket.horaAtencion) {
            const ahora = new Date();
            ticket.horaAtencion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        // Si el ticket pasa a terminado o cliente se fue, registrar hora de finalización
        if (nuevoEstado === 'terminado' || nuevoEstado === 'cliente_se_fue') {
            const ahora = new Date();
            // Conservar la hora de atención existente si existe
            if (!ticket.horaAtencion) {
                ticket.horaAtencion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            }
            ticket.horaFinalizacion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            // Guardar en Firebase inmediatamente
            const ticketToSave = {...ticket};
            delete ticketToSave.firebaseKey;
            ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
                .then(() => {
                    // Refrescar la tabla después de guardar
                    if (document.getElementById('verTicketsSection').classList.contains('active')) {
                        renderTickets('terminado');
                    }
                    if (document.getElementById('horarioSection').classList.contains('active')) {
                        mostrarHorario();
                    }
                });
            return; // Evitar doble guardado
        }
        
        // Mostrar indicador de carga
        const saveButton = document.querySelector('.btn-save');
        if (saveButton) {
            showLoadingButton(saveButton);
        }
        
        // Actualizar en Firebase
        const ticketToSave = {...ticket};
        delete ticketToSave.firebaseKey;
        
        ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
            .then(() => {
                closeModal();
                showNotification('Estado actualizado correctamente', 'success');
                
                // If we're in the tickets view, show only finished tickets
                const ticketsSectionActive = document.getElementById('verTicketsSection').classList.contains('active');
                if (ticketsSectionActive) {
                    // Render only 'terminado' tickets and set filter button
                    renderTickets('terminado');
                    filterBtns.forEach(btn => btn.classList.remove('active'));
                    const terminadoBtn = document.querySelector('.filter-btn[data-filter="terminado"]');
                    if (terminadoBtn) terminadoBtn.classList.add('active');
                    // Ensure the navigation button remains active
                    setActiveButton(verTicketsBtn);
                }
                
                // If in schedule view, update schedule
                if (document.getElementById('horarioSection').classList.contains('active')) {
                    mostrarHorario();
                }
            })
            .catch(error => {
                console.error("Error actualizando estado:", error);
                if (saveButton) {
                    hideLoadingButton(saveButton);
                }
                showNotification('Error al cambiar el estado', 'error');
            });
    });
}

// Nueva función para eliminar por randomId
function deleteTicketByRandomId(randomId) {
    const ticket = tickets.find(t => t.randomId === randomId);
    if (!ticket) return;
    deleteTicketByFirebaseKey(ticket.firebaseKey);
}

// Nueva función para eliminar por firebaseKey
function deleteTicketByFirebaseKey(firebaseKey) {
    // Check if user has permission to delete
    if (!hasPermission('canDeleteTickets')) {
        showNotification('No tienes permiso para eliminar consultas', 'error');
        return;
    }
    const ticket = tickets.find(t => t.firebaseKey === firebaseKey);
    if (!ticket) return;
    // Confirmar antes de eliminar
    let animalIcon = '';
    switch(ticket.tipoMascota) {
        case 'perro':
            animalIcon = '<i class="fas fa-dog" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'gato':
            animalIcon = '<i class="fas fa-cat" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'conejo':
            animalIcon = '<i class="fas fa-dove" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        default:
            animalIcon = '<i class="fas fa-paw" style="font-size: 1.5rem; margin-right: 10px;"></i>';
    }
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3><i class="fas fa-exclamation-triangle" style="color: var(--accent-color);"></i> Eliminar Ticket</h3>
            <div style="text-align: center; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                    ${animalIcon}
                    <span style="font-size: 1.2rem;">${ticket.mascota}</span>
                </div>
                <p>¿Estás seguro que deseas eliminar el ticket #${ticket.id}?</p>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #777;">Esta acción no se puede deshacer.</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
                <button class="btn-delete" onclick="confirmDeleteByFirebaseKey('${firebaseKey}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmDeleteByFirebaseKey(firebaseKey) {
    const ticket = tickets.find(t => t.firebaseKey === firebaseKey);
    if (!ticket || !ticket.firebaseKey) {
        showNotification('Error al eliminar la consulta', 'error');
        return;
    }
    const currentSection = document.querySelector('.content section.active');
    const currentFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
    const deleteButton = document.querySelector('.btn-delete');
    if (deleteButton) {
        showLoadingButton(deleteButton);
    }
    ticketsRef.child(ticket.firebaseKey).remove()
        .then(() => {
            showNotification('Consulta eliminada correctamente', 'success');
            closeModal();
            if (currentSection) {
                if (currentSection.id === 'verTicketsSection') {
                    renderTickets(currentFilter);
                    if (currentFilterBtn) {
                        document.querySelectorAll('.filter-btn').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        currentFilterBtn.classList.add('active');
                    }
                    setActiveButton(verTicketsBtn);
                } else if (currentSection.id === 'horarioSection') {
                    mostrarHorario();
                }
            }
            updateStatsGlobal();
        })
        .catch(error => {
            console.error("Error eliminando ticket:", error);
            if (deleteButton) {
                hideLoadingButton(deleteButton);
            }
            showNotification('Error al eliminar la consulta', 'error');
        });
}

function closeModal() {
    const modal = document.querySelector('.edit-modal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Sistema de autenticación básico
let userCredential = null;

// Iniciar sesión o crear cuenta anónima
function initAuth() {
  return new Promise((resolve, reject) => {
    console.log("Initializing auth...");
    
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log("User already authenticated:", user.uid);
        resolve(user);
      } else {
        // Redirigir al login si no hay usuario autenticado
        window.location.href = 'home.html'; // Cambia a 'login.html' si tu login es ese archivo
      }
    });
  });
}

function showNotification(message, type = 'info') {
    // Crear notificación si no existe
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.innerHTML = `
            .notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: 500;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
                z-index: 1001;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .notification.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .notification.info {
                background: var(--primary-color);
            }
            
            .notification.success {
                background: var(--secondary-color);
            }
            
            .notification.error {
                background: var(--accent-color);
            }
        `;
        document.head.appendChild(style);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerText = message;
    
    document.body.appendChild(notification);
    
    // Mostrar notificación
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// --- Actualizar estadísticas usando el filtro global ---
function updateStatsGlobal() {
  const filtered = filtrarTicketsPorPeriodoGlobal(tickets);
  console.log('[DEBUG] Tickets filtrados:', filtered.length, filtered.map(t => t.fechaConsulta));
  
  // Actualizar contadores
  document.getElementById('totalPacientes').textContent = filtered.length;
  document.getElementById('pacientesEspera').textContent = filtered.filter(t => t.estado === 'espera').length;
  document.getElementById('pacientesConsulta').textContent = filtered.filter(t => 
    t.estado === 'consultorio1' || t.estado === 'consultorio2' || t.estado === 'consultorio3' || t.estado === 'consultorio4' || t.estado === 'consultorio5'
  ).length;
  document.getElementById('pacientesAtendidos').textContent = filtered.filter(t => t.estado === 'terminado').length;
  // Nuevo: clientes que se fueron
  if (document.getElementById('clientesSeFueron')) {
    document.getElementById('clientesSeFueron').textContent = filtered.filter(t => t.estado === 'cliente_se_fue').length;
  }
  
  // Generar todos los gráficos
  renderizarGraficosTiempoEspera(filtered);
  renderizarGraficosPersonalServicios(filtered);
}

// Función para renderizar el gráfico de tiempo de espera y la tabla
function renderizarGraficosTiempoEspera(ticketsFiltrados) {
  // Calcular tiempos de espera
  const tiemposEspera = {};
  let ticketsConTiempos = 0;
  let tiemposTotales = [];
  
  ticketsFiltrados.forEach(ticket => {
    // Usar horaFinalizacion si existe, si no horaAtencion
    if (ticket.horaLlegada && (ticket.horaFinalizacion || ticket.horaAtencion)) {
      const servicio = ticket.tipoServicio || 'consulta';
      const llegada = convertTimeToMinutes(ticket.horaLlegada);
      const fin = convertTimeToMinutes(ticket.horaFinalizacion || ticket.horaAtencion);
      const tiempoTotal = fin - llegada;
      if (tiempoTotal >= 0) {
        if (!tiemposEspera[servicio]) tiemposEspera[servicio] = { total: 0, count: 0 };
        tiemposEspera[servicio].total += tiempoTotal;
        tiemposEspera[servicio].count++;
        ticketsConTiempos++;
        tiemposTotales.push({ servicio, tiempoTotal });
      }
    }
  });
  
  // Actualizar tabla de tiempos de espera
  const waitTimeStatsBody = document.getElementById('waitTimeStatsBody');
  if (waitTimeStatsBody) {
    waitTimeStatsBody.innerHTML = '';
    
    if (ticketsConTiempos === 0) {
      waitTimeStatsBody.innerHTML = `<tr><td colspan="3" class="no-data">No hay datos suficientes para calcular tiempos de espera</td></tr>`;
    } else {
      const serviciosOrdenados = Object.keys(tiemposEspera).sort((a, b) => 
        (tiemposEspera[b].total / tiemposEspera[b].count) - (tiemposEspera[a].total / tiemposEspera[a].count)
      );
      
      serviciosOrdenados.forEach(servicio => {
        const { total, count } = tiemposEspera[servicio];
        const promedio = total / count;
        const row = document.createElement('tr');
        row.innerHTML = `<td>${getNombreServicio(servicio)}</td><td>${formatMinutesToTime(promedio)}</td><td>${count}</td>`;
        waitTimeStatsBody.appendChild(row);
      });
    }
  }
  
  // Renderizar gráfico de tiempo de espera
  const ctx = document.getElementById('waitTimeChart');
  if (!ctx) return;
  
  // Destruir gráfico anterior si existe
  if (window.waitTimeChart) {
    try {
      window.waitTimeChart.destroy();
    } catch (error) {
      console.log('Error al destruir gráfico anterior:', error);
    }
  }
  
  // Si no hay datos, mostrar mensaje
  if (ticketsConTiempos === 0) {
    const ctxCanvas = ctx.getContext('2d');
    if (ctxCanvas) {
      ctxCanvas.clearRect(0, 0, ctx.width, ctx.height);
      ctxCanvas.font = '16px Arial';
      ctxCanvas.fillStyle = '#888';
      ctxCanvas.textAlign = 'center';
      ctxCanvas.fillText('No hay datos suficientes para calcular tiempos de espera', 
        ctx.width / 2 || 150, ctx.height / 2 || 150);
    }
    return;
  }
  
  // Preparar datos para el gráfico
  const labels = [];
  const data = [];
  const backgroundColors = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
    '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69'
  ];
  
  // Tomar hasta 10 servicios para el gráfico
  const serviciosParaGrafico = Object.keys(tiemposEspera)
    .sort((a, b) => (tiemposEspera[b].total / tiemposEspera[b].count) - (tiemposEspera[a].total / tiemposEspera[a].count))
    .slice(0, 10);
  
  serviciosParaGrafico.forEach((servicio, index) => {
    const { total, count } = tiemposEspera[servicio];
    const promedio = total / count;
    
    labels.push(getNombreServicio(servicio));
    data.push(promedio);
  });
  
  // Crear gráfico
  try {
    window.waitTimeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tiempo promedio de espera (minutos)',
          data: data,
          backgroundColor: backgroundColors.slice(0, data.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutos'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                return `Tiempo de espera: ${formatMinutesToTime(value)}`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("Error al crear gráfico de tiempos de espera:", error);
  }
}

// Función para renderizar los gráficos de personal y servicios
function renderizarGraficosPersonalServicios(ticketsFiltrados) {
  // Aplicar filtros adicionales si están seleccionados
  const filtroPersonal = document.getElementById('filtroPersonal')?.value || 'todos';
  const filtroServicio = document.getElementById('filtroServicio')?.value || 'todos';
  
  let ticketsAGraficar = [...ticketsFiltrados];
  
  // Filtrar por servicio específico si no es "todos"
  if (filtroServicio !== 'todos') {
    ticketsAGraficar = ticketsAGraficar.filter(ticket => {
      return (ticket.tipoServicio || '').trim().toLowerCase() === filtroServicio.trim().toLowerCase();
    });
  }
  
  console.log('[DEBUG] Tickets para gráficos después de filtro servicio:', ticketsAGraficar.length);
  
  // Conteo de servicios por personal y servicios totales
  const conteoPersonalServicio = {};
  const conteoServicios = {};
  let totalServicios = 0;
  
  // Procesar tickets para estadísticas
  ticketsAGraficar.forEach(ticket => {
    if (!ticket) return;
    
    // Normalizar servicio (por defecto consulta)
    const servicio = (ticket.tipoServicio || 'consulta').trim().toLowerCase();
    
    // Incrementar conteo general de servicios
    conteoServicios[servicio] = (conteoServicios[servicio] || 0) + 1;
    totalServicios++;
    
    // Procesar personal (médicos)
    let personalList = [];
    
    if (ticket.medicoAtiende && ticket.medicoAtiende.trim()) {
      // Dividir si hay varios médicos separados por coma
      personalList = ticket.medicoAtiende.split(',').map(p => p.trim()).filter(Boolean);
    } else {
      personalList = ['Sin asignar'];
    }
    
    // Para cada persona en el ticket
    personalList.forEach(persona => {
      // Si hay filtro de personal específico, verificar
      if (filtroPersonal !== 'todos' && persona.toLowerCase() !== filtroPersonal.toLowerCase()) {
        return;
      }
      
      // Inicializar estructura si no existe
      if (!conteoPersonalServicio[persona]) {
        conteoPersonalServicio[persona] = {};
      }
      
      // Incrementar conteo para esta persona y servicio
      conteoPersonalServicio[persona][servicio] = (conteoPersonalServicio[persona][servicio] || 0) + 1;
    });
  });
  
  console.log('[DEBUG] Conteo personal/servicio:', conteoPersonalServicio);
  console.log('[DEBUG] Conteo servicios:', conteoServicios);
  
  // Actualizar tabla de estadísticas
  actualizarTablaEstadisticas(conteoPersonalServicio, conteoServicios, totalServicios);
  
  // Renderizar gráficos
  renderizarGraficoPersonalPorServicio(conteoPersonalServicio);
  renderizarGraficoDistribucionServicios(conteoServicios);
}

// Actualizar la tabla de estadísticas
function actualizarTablaEstadisticas(conteoPersonalServicio, conteoServicios, totalServicios) {
  const tablaBody = document.getElementById('tablaEstadisticasBody');
  if (!tablaBody) return;
  
  tablaBody.innerHTML = '';
  
  // Si no hay datos, mostrar mensaje
  if (totalServicios === 0) {
    tablaBody.innerHTML = `<tr><td colspan="4" class="no-data">No hay datos para los filtros seleccionados</td></tr>`;
    return;
  }
  
  // Ordenar personal alfabéticamente
  const personalOrdenado = Object.keys(conteoPersonalServicio).sort();
  
  // Para cada persona, mostrar sus servicios
  personalOrdenado.forEach(persona => {
    // Ordenar servicios alfabéticamente
    const serviciosPersona = Object.keys(conteoPersonalServicio[persona]).sort();
    
    serviciosPersona.forEach((servicio, index) => {
      const cantidad = conteoPersonalServicio[persona][servicio];
      const porcentaje = ((cantidad / totalServicios) * 100).toFixed(1);
      
      const row = document.createElement('tr');
      
      // Primera fila incluye el nombre de la persona con rowspan
      if (index === 0) {
        row.innerHTML = `
          <td rowspan="${serviciosPersona.length}">${persona}</td>
          <td>${getNombreServicio(servicio)}</td>
          <td>${cantidad}</td>
          <td>${porcentaje}%</td>
        `;
      } else {
        row.innerHTML = `
          <td>${getNombreServicio(servicio)}</td>
          <td>${cantidad}</td>
          <td>${porcentaje}%</td>
        `;
      }
      
      tablaBody.appendChild(row);
    });
  });
}

// Renderizar gráfico de servicios por personal (gráfico de barras)
function renderizarGraficoPersonalPorServicio(conteoPersonalServicio) {
  const canvas = document.getElementById('chartServiciosPersonal');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Destruir gráfico anterior si existe
  if (window.chartServiciosPersonal) {
    try {
      window.chartServiciosPersonal.destroy();
    } catch (error) {
      console.log('Error al destruir gráfico anterior:', error);
    }
    window.chartServiciosPersonal = null;
  }
  
  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Si no hay datos, mostrar mensaje
  const personal = Object.keys(conteoPersonalServicio);
  if (personal.length === 0) {
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('No hay datos para mostrar', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Recopilar todos los servicios únicos
  const serviciosUnicos = new Set();
  Object.values(conteoPersonalServicio).forEach(servicios => {
    Object.keys(servicios).forEach(servicio => serviciosUnicos.add(servicio));
  });
  
  // Colores para los servicios
  const colores = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
    '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69'
  ];
  
  // Crear datasets para el gráfico
  const datasets = [];
  
  // Convertir el conjunto a array y ordenar
  const servicios = Array.from(serviciosUnicos).sort();
  
  // Para cada servicio, crear un dataset
  servicios.forEach((servicio, index) => {
    const data = personal.map(persona => conteoPersonalServicio[persona][servicio] || 0);
    
    datasets.push({
      label: getNombreServicio(servicio),
      data: data,
      backgroundColor: colores[index % colores.length],
      borderWidth: 1
    });
  });
  
  // Crear gráfico de barras
  try {
    window.chartServiciosPersonal = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: personal,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true }
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  } catch (error) {
    console.error('Error al crear gráfico de servicios por personal:', error);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#f00';
    ctx.textAlign = 'center';
    ctx.fillText('Error al crear gráfico', canvas.width / 2, canvas.height / 2);
  }
}

// Renderizar gráfico de distribución de servicios (gráfico de pie)
function renderizarGraficoDistribucionServicios(conteoServicios) {
  const canvas = document.getElementById('chartDistribucionServicios');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Destruir gráfico anterior si existe
  if (window.chartDistribucionServicios) {
    try {
      window.chartDistribucionServicios.destroy();
    } catch (error) {
      console.log('Error al destruir gráfico anterior:', error);
    }
    window.chartDistribucionServicios = null;
  }
  
  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Si no hay datos, mostrar mensaje
  const servicios = Object.keys(conteoServicios);
  if (servicios.length === 0) {
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('No hay datos para mostrar', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Colores para los servicios
  const colores = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
    '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69'
  ];
  
  // Preparar datos
  const data = servicios.map(servicio => conteoServicios[servicio]);
  const labels = servicios.map(servicio => getNombreServicio(servicio));
  const colors = colores.slice(0, servicios.length);
  
  // Crear gráfico de pie
  try {
    window.chartDistribucionServicios = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: { callbacks: { label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error al crear gráfico de distribución de servicios:', error);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#f00';
    ctx.textAlign = 'center';
    ctx.fillText('Error al crear gráfico', canvas.width / 2, canvas.height / 2);
  }
}

// Configurar Event Listeners para estadísticas
document.addEventListener('DOMContentLoaded', function() {
  // Botón para aplicar filtros estadísticos
  const aplicarFiltrosBtn = document.getElementById('aplicarFiltrosEstadisticasBtn');
  if (aplicarFiltrosBtn) {
    aplicarFiltrosBtn.addEventListener('click', function() {
      const periodo = document.getElementById('filtroPeriodoGlobal')?.value;
      if (periodo === 'personalizado') {
        const fechaInicio = document.getElementById('fechaInicioEstadisticasGlobal')?.value;
        const fechaFin = document.getElementById('fechaFinEstadisticasGlobal')?.value;
        if (!fechaInicio || !fechaFin) {
          showNotification('Por favor seleccione ambas fechas para el período personalizado', 'error');
          return;
        }
        if (new Date(fechaInicio) > new Date(fechaFin)) {
          showNotification('La fecha de inicio no puede ser posterior a la fecha final', 'error');
          return;
        }
      }
      updateStatsGlobal();
      showNotification('Filtros aplicados correctamente', 'success');
    });
  }
  
  // Cambio en filtro de periodo
  const filtroPeriodoGlobal = document.getElementById('filtroPeriodoGlobal');
  if (filtroPeriodoGlobal) {
    filtroPeriodoGlobal.addEventListener('change', function() {
      // Mostrar/ocultar sección de fechas personalizadas
      const periodPersonalizadoGlobal = document.getElementById('periodPersonalizadoGlobal');
      if (periodPersonalizadoGlobal) {
        periodPersonalizadoGlobal.style.display = 
          this.value === 'personalizado' ? 'flex' : 'none';
      }
      // Actualizar estadísticas
      updateStatsGlobal();
    });
  }
  
  // Inputs de fecha personalizada
  const fechaInicioInput = document.getElementById('fechaInicioEstadisticasGlobal');
  const fechaFinInput = document.getElementById('fechaFinEstadisticasGlobal');
  if (fechaInicioInput) fechaInicioInput.addEventListener('change', updateStatsGlobal);
  if (fechaFinInput) fechaFinInput.addEventListener('change', updateStatsGlobal);
  
  // Filtros adicionales
  const filtroPersonal = document.getElementById('filtroPersonal');
  const filtroServicio = document.getElementById('filtroServicio');
  if (filtroPersonal) filtroPersonal.addEventListener('change', updateStatsGlobal);
  if (filtroServicio) filtroServicio.addEventListener('change', updateStatsGlobal);
  
  // Actualizar estadísticas al entrar a la sección
  // NOTA: Event listener para estadisticasBtn se maneja en setupCategorizedNavigation()
});

// --- FUNCIONES FALTANTES PARA ERRORES DE REFERENCIA ---
function showLoading() {
    // Crear overlay de carga
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-paw fa-spin"></i>
            <p>Conectando...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Añadir estilo si no existe
    if (!document.getElementById('loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            #loadingOverlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            .loading-spinner {
                text-align: center;
            }
            .loading-spinner i {
                font-size: 3rem;
                color: var(--primary-color);
                margin-bottom: 15px;
            }
            .loading-spinner p {
                color: var(--dark-color);
                font-size: 1.2rem;
            }
            .button-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            .button-loading::after {
                content: '';
                display: inline-block;
                width: 1em;
                height: 1em;
                border: 2px solid currentColor;
                border-radius: 50%;
                border-right-color: transparent;
                animation: button-spinner 0.75s linear infinite;
                margin-left: 8px;
                vertical-align: text-bottom;
            }
            @keyframes button-spinner {
                to {transform: rotate(360deg);}
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showLoadingButton(button) {
    if (!button) return;
    button.classList.add('button-loading');
    button.innerHTML = button.innerHTML.replace(/<i.*<\/i>/, '');
    button.disabled = true;
}

function hideLoadingButton(button) {
    if (!button) return;
    button.classList.remove('button-loading');
    button.disabled = false;
}

function filtrarTicketsPorPeriodoGlobal(tickets) {
  const periodo = document.getElementById('filtroPeriodoGlobal')?.value || 'hoy';
  const fechaInicio = document.getElementById('fechaInicioEstadisticasGlobal')?.value;
  const fechaFin = document.getElementById('fechaFinEstadisticasGlobal')?.value;
  const hoy = new Date();
  
  switch (periodo) {
    case 'hoy':
        // Mostrar todos los tickets de hoy, sin importar el estado
        const hoyStr = getLocalDateString();
        return tickets.filter(ticket => {
            const fechaTicket = ticket.fechaConsulta || (ticket.fecha ? new Date(ticket.fecha).toISOString().split('T')[0] : '');
            return fechaTicket === hoyStr;
        });
    case 'semana':
        const inicio = new Date(hoy);
        const diaSemana = hoy.getDay();
        inicio.setDate(hoy.getDate() - diaSemana);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + (6 - diaSemana), 23, 59, 59);
        return tickets.filter(ticket => {
            const fechaTicket = ticket.fechaConsulta || ticket.fecha;
            if (!fechaTicket) return false;
            const ticketDate = new Date(fechaTicket);
            return ticketDate >= inicio && ticketDate <= fin;
        });
    case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
        return tickets.filter(ticket => {
            const fechaTicket = ticket.fechaConsulta || ticket.fecha;
            if (!fechaTicket) return false;
            const ticketDate = new Date(fechaTicket);
            return ticketDate >= inicioMes && ticketDate <= finMes;
        });
    case 'ano':
        const inicioAno = new Date(hoy.getFullYear(), 0, 1);
        const finAno = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59);
        return tickets.filter(ticket => {
            const fechaTicket = ticket.fechaConsulta || ticket.fecha;
            if (!fechaTicket) return false;
            const ticketDate = new Date(fechaTicket);
            return ticketDate >= inicioAno && ticketDate <= finAno;
        });
    case 'personalizado':
        if (!fechaInicio || !fechaFin) return tickets;
        const inicioPersonalizado = new Date(fechaInicio);
        inicioPersonalizado.setHours(0, 0, 0, 0);
        const finPersonalizado = new Date(fechaFin);
        finPersonalizado.setHours(23, 59, 59, 999);
        return tickets.filter(ticket => {
            const fechaTicket = ticket.fechaConsulta || ticket.fecha;
            if (!fechaTicket) return false;
            const ticketDate = new Date(fechaTicket);
            return ticketDate >= inicioPersonalizado && ticketDate <= finPersonalizado;
        });
    default:
        return tickets;
  }
}

function obtenerPersonalUnico() {
    const personal = new Set();
    tickets.forEach(ticket => {
        if (ticket.medicoAtiende) {
            // Dividir en caso de que haya múltiples personas separadas por comas
            const personas = ticket.medicoAtiende.split(',').map(p => p.trim());
            personas.forEach(persona => {
                if (persona) personal.add(persona);
            });
        }
    });
    return Array.from(personal).sort();
}

function llenarSelectorPersonal() {
    const personalUnico = obtenerPersonalUnico();
    const select = document.getElementById('filtroPersonal');
    if (!select) return;
    // Limpiar opciones existentes excepto "Todos"
    while (select.options.length > 1) {
        select.remove(1);
    }
    // Agregar personal único
    personalUnico.forEach(persona => {
        const option = document.createElement('option');
        option.value = persona;
        option.textContent = persona;
        select.appendChild(option);
    });
}

function getNombreServicio(tipoServicio) {
    const servicios = {
        'consulta': 'Consulta general',
        'revaloracion': 'Revaloración',
        'retiroHilos': 'Retiro de hilos',
        'rayosX': 'Rayos X',
        'desparasitacion': 'Desparasitación',
        'inyectable': 'Inyectables',
        'vacunas': 'Vacunas',
        'consulta_8pm': 'Consulta después de las 8 P.M',
        'consulta_6pm': 'Consulta después de las 6 P.M',
        'hmg_limpieza': 'HMG Limpieza',
        'hmg_castracion': 'HMG Castración',
        'cambio_vendaje': 'Cambio de vendaje',
        'convenia_cx': 'Convenia de CX',
        'analito': 'Analito',
        'panel_general_basico': 'Panel General Básico',
        'panel_plus': 'Panel Plus',
        'perfil_quimico_general': 'Perfil quimico general',
        'perfil_pre_quirurgico': 'Perfil pre quirurgico',
        'perfil_renal': 'Perfil renal',
        'cirugia': 'Cirugía',
        'muestra_test': 'Muestra para test',
        'tiempos_coagulacion': 'Tiempos de coagulación',
        'internamiento': 'Internamiento',
        'test_sida_leucemia': 'Test sida leucemia',
        'corteUnas': 'Corte de uñas',
        'emergencia': 'Emergencia',
        'tomaMuestras': 'Toma de muestras',
        'tests': 'Tests',
        'hemograma': 'Hemograma',
        'eutanasia': 'Eutanasia',
        'quitarPuntos': 'Quitar puntos',
        'otro': 'Otro'
    };
    return servicios[tipoServicio] || tipoServicio;
}

function cleanOldData() {
  alert('Función de limpieza no implementada.');
}

function convertTimeToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatMinutesToTime(minutes) {
    if (isNaN(minutes) || minutes < 0) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}m`;
}

function getUrgenciaLabel(urgencia) {
    const labels = {
        'alta': 'Alta',
        'media': 'Media',
        'normal': 'Normal',
        'critico': 'Crítico',
        'leve': 'Leve',
        'general': 'General',
        'emergencia': 'Emergencia',
        'urgencia': 'Urgencia',
        'consulta': 'Consulta Regular',
        'prequirurgico': 'Exámenes Pre Quirúrgicos'
    };
    return labels[urgencia] || urgencia || '';
}
document.addEventListener('DOMContentLoaded', function() {
  const tipoMascota = document.getElementById('tipoMascota');
  const conejoImg = document.getElementById('conejoImg');
  if (tipoMascota && conejoImg) {
    tipoMascota.addEventListener('change', function() {
      conejoImg.style.display = tipoMascota.value === 'conejo' ? 'inline-block' : 'none';
    });
  }

  // Ocultar campo Hora de Cita según el rol
  const userRole = sessionStorage.getItem('userRole');
  const horaCitaGroup = document.querySelector('input#hora')?.closest('.form-group');
  if (horaCitaGroup) {
    if (!["admin", "recepción", "quirofano"].includes(userRole)) {
      horaCitaGroup.style.display = 'none';
    } else {
      horaCitaGroup.style.display = '';
    }
  }

  // Mostrar botón Hoja de Laboratorio solo para ciertos roles
  const labSheetBtn = document.getElementById('labSheetBtn');
  const labSheetSection = document.getElementById('labSheetSection');
  const allowedRoles = ["consulta_externa", "laboratorio", "admin"];
  if (labSheetBtn && allowedRoles.includes(userRole)) {
    labSheetBtn.style.display = '';
    labSheetBtn.onclick = function() {
      // Oculta todas las secciones
      document.querySelectorAll('.content section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
      });
      // Muestra la hoja de laboratorio
      if (labSheetSection) {
        labSheetSection.classList.remove('hidden');
        setTimeout(() => labSheetSection.classList.add('active'), 50);
      }
      // Quita active de todos los botones y pon solo este
      document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
      labSheetBtn.classList.add('active');
      // Llama a la función de renderizado de hoja de laboratorio
      if (window.renderLabSheetList) window.renderLabSheetList();
    };
  }

  // Descripciones para cada categorización
  const urgenciaDescriptions = {
    emergencia: 'Emergencias. Situaciones críticas que requieren atención médica inmediata. Se mostrará como EMERGENCIA en el ticket.',
    urgencia: 'Urgencias. Problemas de salud que deben atenderse pronto, pero no son críticos.',
    leve: 'Leve. Puede esperar, sin riesgo inmediato.',
    consulta: 'Consulta. Atención general o rutinaria.'
  };

  function updateUrgenciaDescription(selectId, descId) {
    const select = document.getElementById(selectId);
    const desc = document.getElementById(descId);
    if (!select || !desc) return;
    const value = select.value;
    desc.textContent = urgenciaDescriptions[value] || '';
  }

  // Descripción dinámica en creación
  const urgenciaSelect = document.getElementById('urgencia');
  if (urgenciaSelect) {
    const descDiv = document.createElement('div');
    descDiv.id = 'urgenciaDesc';
    descDiv.style.fontSize = '0.95em';
    descDiv.style.color = '#1976d2';
    descDiv.style.marginTop = '4px';
    urgenciaSelect.parentNode.appendChild(descDiv);
    urgenciaSelect.addEventListener('change', function() {
      updateUrgenciaDescription('urgencia', 'urgenciaDesc');
    });
    updateUrgenciaDescription('urgencia', 'urgenciaDesc');
  }

  // Mostrar filtro de laboratorio solo para roles permitidos
  const allowedLabRoles = ["admin", "consulta_externa", "internos", "laboratorio"];
  const labFilterBtn = document.getElementById('labFilterBtn');
  if (labFilterBtn && allowedLabRoles.includes(userRole)) {
    labFilterBtn.style.display = '';
  }

  // Evento para mostrar tabla de laboratorio
  if (labFilterBtn) {
    labFilterBtn.addEventListener('click', function() {
      // Oculta otras vistas
      document.getElementById('ticketContainer').style.display = 'none';
      document.getElementById('labResultsContainer').classList.remove('hidden');
      renderLabResults();
      // Marcar botón activo
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      labFilterBtn.classList.add('active');
    });
  }

  // Cuando se selecciona otro filtro, ocultar la tabla de laboratorio
  document.querySelectorAll('.filter-btn:not(#labFilterBtn)').forEach(btn => {
    btn.addEventListener('click', function() {
      document.getElementById('labResultsContainer').classList.add('hidden');
      document.getElementById('ticketContainer').style.display = '';
    });
  });

  // Actualización en tiempo real
  window.renderLabResults = function() {
    const labResultsBody = document.getElementById('labResultsBody');
    if (!labResultsBody) return;
    labResultsBody.innerHTML = '';
    // Filtrar tickets con servicios de laboratorio
    const labTickets = (window.tickets || []).filter(t =>
      t.tipoServicio && (
        t.tipoServicio.includes('panel') ||
        t.tipoServicio.includes('perfil') ||
        t.tipoServicio.includes('hemograma') ||
        t.tipoServicio.includes('quimica') ||
        t.tipoServicio.includes('test') ||
        t.tipoServicio.includes('analito') ||
        t.tipoServicio.includes('laboratorio')
      )
    );
    if (labTickets.length === 0) {
      labResultsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">No hay registros de laboratorio</td></tr>';
      return;
    }
    labTickets.forEach(t => {
      // Apellido del cliente (última palabra del nombre)
      const apellido = (t.nombre || '').trim().split(' ').slice(-1)[0] || '';
      // Servicios a realizar (puedes mejorar esto si tienes un campo específico)
      const servicios = t.tipoServicio ? t.tipoServicio.replace(/_/g, ' ') : '';
      // Estado laboratorio (puedes mejorar lógica según tu flujo)
      let estadoLab = 'En proceso';
      if (t.estado === 'terminado') estadoLab = 'Realizado';
      // Hora creación
      const hora = t.horaCreacion || '';
      // Doctor encargado
      const doctor = t.medicoAtiende || '';
      labResultsBody.innerHTML += `
        <tr>
          <td>${t.mascota || ''}</td>
          <td>${apellido}</td>
          <td>${servicios}</td>
          <td>${estadoLab}</td>
          <td>${hora}</td>
          <td>${doctor}</td>
        </tr>
      `;
    });
  };

  // Actualizar tabla en tiempo real cuando cambian los tickets
  if (typeof window.ticketsRef !== 'undefined') {
    window.ticketsRef.on('value', function() {
      const labResultsContainer = document.getElementById('labResultsContainer');
      if (labResultsContainer && !labResultsContainer.classList.contains('hidden')) {
        renderLabResults();
      }
    });
  }

  // Navegación con flechas en el formulario de tickets
  (function() {
    const form = document.getElementById('ticketForm');
    if (!form) return;
    // Selecciona todos los inputs, selects y textareas visibles en orden
    const getFields = () => Array.from(form.querySelectorAll('input, select, textarea')).filter(el => el.offsetParent !== null && !el.disabled);

    form.addEventListener('keydown', function(e) {
      const fields = getFields();
      const idx = fields.indexOf(document.activeElement);
      if (idx === -1) return;
      // Columnas por fila (ajustar si cambias el diseño)
      const cols = 2;
      // Flecha abajo
      if (e.key === 'ArrowDown') {
        if (idx + cols < fields.length) {
          fields[idx + cols].focus();
          e.preventDefault();
        }
      }
      // Flecha arriba
      else if (e.key === 'ArrowUp') {
        if (idx - cols >= 0) {
          fields[idx - cols].focus();
          e.preventDefault();
        }
      }
      // Flecha derecha
      else if (e.key === 'ArrowRight') {
        if ((idx + 1) % cols !== 0 && idx + 1 < fields.length) {
          fields[idx + 1].focus();
          e.preventDefault();
        }
      }
      // Flecha izquierda
      else if (e.key === 'ArrowLeft') {
        if (idx % cols !== 0 && idx - 1 >= 0) {
          fields[idx - 1].focus();
          e.preventDefault();
        }
      }
    });
  })();

  // Eliminar el campo de hora de llegada del formulario de creación si existe
  const horaLlegadaGroup = document.querySelector('input#horaLlegada')?.closest('.form-group');
  if (horaLlegadaGroup) {
    horaLlegadaGroup.style.display = 'none';
  }
});

// --- MODAL HOJA DE LABORATORIO ---
window.openLabSheetModal = function(randomId) {
    const ticket = tickets.find(t => t.randomId === randomId);
    if (!ticket) {
        showNotification('Ticket no encontrado', 'error');
        return;
    }
    // Cerrar cualquier modal existente
    closeModal();
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    // Cargar hoja de laboratorio si existe
    let labSheet = null;
    if (window.labSheets && window.labSheets[ticket.id]) {
        labSheet = window.labSheets[ticket.id];
    }
    // Estados posibles
    const estadosLab = ['en proceso', 'pendiente reportar', 'reportados'];
    // Generar HTML del modal (simplificado, puedes expandirlo con más campos y estilos)
    modal.innerHTML = `
        <div class="modal-content animate-scale" style="max-width:900px;">
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <h3><i class="fas fa-vials"></i> Hoja de Laboratorio</h3>
            <form id="labSheetForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Paciente</label>
                        <input type="text" value="${ticket.mascota || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Propietario</label>
                        <input type="text" value="${ticket.nombre || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label>ID Paciente</label>
                        <input type="text" value="${ticket.idPaciente || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Fecha</label>
                        <input type="text" value="${ticket.fechaConsulta || ''}" readonly>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Estado de laboratorio</label>
                        <select id="labEstado" required>
                            ${estadosLab.map(e => `<option value="${e}" ${labSheet && labSheet.estado === e ? 'selected' : ''}>${e.charAt(0).toUpperCase() + e.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Exámenes a realizar</label>
                    <textarea id="labExamenes" placeholder="Ej: Hemograma, Química sanguínea, Test de Distemper..." rows="4">${labSheet && labSheet.examenes ? labSheet.examenes : ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Hoja de Laboratorio</button>
                    ${(["admin"].includes(userRole) && labSheet) ? `<button type="button" class="btn-delete" id="deleteLabSheetBtn">Eliminar</button>` : ''}
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    // Guardar cambios
    document.getElementById('labSheetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const estado = document.getElementById('labEstado').value;
        const examenes = document.getElementById('labExamenes').value;
        // Guardar en Firebase (o tu backend)
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('lab_sheets/' + ticket.id).set({
                ticketId: ticket.id,
                estado,
                examenes,
                paciente: ticket.mascota,
                propietario: ticket.nombre,
                idPaciente: ticket.idPaciente,
                fecha: ticket.fechaConsulta
            }).then(() => {
                showNotification('Hoja de laboratorio guardada', 'success');
                closeModal();
            }).catch(err => {
                showNotification('Error al guardar: ' + err.message, 'error');
            });
        }
    });
    // Eliminar hoja de laboratorio (solo admin)
    if (document.getElementById('deleteLabSheetBtn')) {
        document.getElementById('deleteLabSheetBtn').addEventListener('click', function() {
            if (confirm('¿Seguro que deseas eliminar esta hoja de laboratorio?')) {
                firebase.database().ref('lab_sheets/' + ticket.id).remove().then(() => {
                    showNotification('Hoja de laboratorio eliminada', 'success');
                    closeModal();
                }).catch(err => {
                    showNotification('Error al eliminar: ' + err.message, 'error');
                });
            }
        });
    }
};

// Importar lab.js
const scriptLab = document.createElement('script');
scriptLab.src = 'lab.js';
document.body.appendChild(scriptLab);

// Nueva función para terminar consulta por randomId
function endConsultationByRandomId(randomId) {
    const ticket = tickets.find(t => t.randomId === randomId);
    if (!ticket) return;
    endConsultationByFirebaseKey(ticket.firebaseKey);
}

// Nueva función para terminar consulta por firebaseKey
function endConsultationByFirebaseKey(firebaseKey) {
    const ticket = tickets.find(t => t.firebaseKey === firebaseKey);
    if (!ticket) return;
    
    // Confirmar antes de terminar la consulta
    let animalIcon = '';
    switch(ticket.tipoMascota) {
        case 'perro':
            animalIcon = '<i class="fas fa-dog" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'gato':
            animalIcon = '<i class="fas fa-cat" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'conejo':
            animalIcon = '<i class="fas fa-dove" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        default:
            animalIcon = '<i class="fas fa-paw" style="font-size: 1.5rem; margin-right: 10px;"></i>';
    }
    
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3><i class="fas fa-check-circle" style="color: var(--accent-color);"></i> Terminar Consulta</h3>
            <div style="text-align: center; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                    ${animalIcon}
                    <span style="font-size: 1.2rem;">${ticket.mascota}</span>
                </div>
                <p>¿Estás seguro que deseas terminar la consulta #${ticket.id}?</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
                <button class="btn-save" onclick="confirmEndConsultationByFirebaseKey('${firebaseKey}')">
                    <i class="fas fa-check"></i> Terminar Consulta
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmEndConsultationByFirebaseKey(firebaseKey) {
    const ticket = tickets.find(t => t.firebaseKey === firebaseKey);
    if (!ticket || !ticket.firebaseKey) {
        showNotification('Error al terminar la consulta', 'error');
        return;
    }

    const currentSection = document.querySelector('.content section.active');
    const currentFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
    const endButton = document.querySelector('.btn-save');
    
    if (endButton) {
        showLoadingButton(endButton);
    }

    // Actualizar el estado y la hora de finalización
    const ahora = new Date();
    const ticketToSave = {
        ...ticket,
        estado: 'terminado',
        horaFinalizacion: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };
    
    // Si no tiene hora de atención, establecerla
    if (!ticketToSave.horaAtencion) {
        ticketToSave.horaAtencion = ticketToSave.horaFinalizacion;
    }

    delete ticketToSave.firebaseKey;

    ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
        .then(() => {
            showNotification('Consulta terminada correctamente', 'success');
            closeModal();
            if (currentSection) {
                if (currentSection.id === 'verTicketsSection') {
                    renderTickets(currentFilter);
                    if (currentFilterBtn) {
                        document.querySelectorAll('.filter-btn').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        currentFilterBtn.classList.add('active');
                    }
                    setActiveButton(verTicketsBtn);
                } else if (currentSection.id === 'horarioSection') {
                    mostrarHorario();
                }
            }
            updateStatsGlobal();
        })
        .catch(error => {
            console.error("Error terminando consulta:", error);
            if (endButton) {
                hideLoadingButton(endButton);
            }
            showNotification('Error al terminar la consulta', 'error');
        });
}

// ===== SISTEMA DE MENÚ CATEGORIZADO =====

// Funciones de navegación para onclick en HTML
function toggleSubmenuHTML(categoryBtnId, submenuId) {
    console.log('🔥 Toggle submenu:', categoryBtnId, submenuId);
    
    const categoryBtn = document.getElementById(categoryBtnId);
    const submenu = document.getElementById(submenuId);
    
    if (!categoryBtn || !submenu) {
        console.error('❌ Elementos no encontrados:', { categoryBtn: !!categoryBtn, submenu: !!submenu });
        return;
    }
    
    // Cerrar otros submenús
    const allSubmenus = document.querySelectorAll('.nav-submenu');
    const allCategoryBtns = document.querySelectorAll('.nav-category-btn');
    
    allSubmenus.forEach(menu => {
        if (menu !== submenu && menu.classList.contains('active')) {
            menu.classList.remove('active');
        }
    });
    
    allCategoryBtns.forEach(btn => {
        if (btn !== categoryBtn && btn.classList.contains('active')) {
            btn.classList.remove('active');
        }
    });
    
    // Toggle el submenú actual
    const wasActive = submenu.classList.contains('active');
    
    if (wasActive) {
        submenu.classList.remove('active');
        categoryBtn.classList.remove('active');
        console.log('📉 Submenu cerrado');
    } else {
        submenu.classList.add('active');
        categoryBtn.classList.add('active');
        console.log('📈 Submenu abierto');
    }
}

function navigateToSection(sectionId, buttonId) {
    console.log('🎯 Navegando a sección:', sectionId);
    
    const section = document.getElementById(sectionId);
    if (!section) {
        console.error('❌ Sección no encontrada:', sectionId);
        return;
    }
    
    // Usar la función showSection existente
    if (typeof showSection === 'function') {
        showSection(section);
        setActiveSubmenuButtonHTML(buttonId);
        
        // Configuraciones específicas por sección
        if (sectionId === 'horarioSection') {
            const fechaHorario = document.getElementById('fechaHorario');
            if (fechaHorario) {
                fechaHorario.value = getLocalDateString();
            }
            if (typeof mostrarHorario === 'function') {
                mostrarHorario();
            }
        }
    } else {
        console.error('❌ Función showSection no disponible');
    }
}

function navigateToConsultas() {
    console.log('🎯 Navegando a Ver Consultas');
    
    // Inicializar filtro de fecha
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput && !filterDateInput.value) {
        filterDateInput.value = getLocalDateString();
    }
    
    // Configurar filtro por defecto según rol
    const userRole = sessionStorage.getItem('userRole');
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    if (userRole === 'admin') {
        if (typeof renderTickets === 'function') {
            renderTickets('todos');
        }
        const todosBtn = document.querySelector('.filter-btn[data-filter="todos"]');
        if (todosBtn) todosBtn.classList.add('active');
    } else {
        if (typeof renderTickets === 'function') {
            renderTickets('espera');
        }
        const esperaBtn = document.querySelector('.filter-btn[data-filter="espera"]');
        if (esperaBtn) esperaBtn.classList.add('active');
    }
    
    navigateToSection('verTicketsSection', 'verTicketsBtn');
}

function navigateToLab(sectionId, buttonId) {
    console.log('🎯 Navegando a laboratorio:', sectionId);
    
    if (typeof showLabSection === 'function') {
        showLabSection(sectionId);
        setActiveSubmenuButtonHTML(buttonId);
    } else {
        console.warn('⚠️ Función showLabSection no disponible');
    }
}

function navigateToEstadisticas() {
    console.log('🎯 Navegando a Estadísticas');
    
    const section = document.getElementById('estadisticasSection');
    if (section) {
        if (typeof showSection === 'function') {
            showSection(section);
            setActiveSubmenuButtonHTML('estadisticasBtn');
            
            // Actualizar estadísticas
            if (typeof updateStatsGlobal === 'function') {
                updateStatsGlobal();
            }
            
            // Asegurar que se muestre la sección de tiempo de espera
            const waitTimeSection = document.querySelector('.wait-time-statistics');
            if (waitTimeSection) {
                waitTimeSection.style.display = 'block';
            }
        } else {
            console.error('❌ Función showSection no disponible');
        }
    } else {
        console.error('❌ Sección estadisticasSection no encontrada');
    }
}

function setActiveSubmenuButtonHTML(buttonId) {
    // Quitar clase active de todos los botones de submenú
    const submenuButtons = document.querySelectorAll('.submenu-btn');
    submenuButtons.forEach(btn => btn.classList.remove('active'));
    
    // Agregar clase active al botón seleccionado
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.add('active');
        console.log('🔥 Botón activo:', buttonId);
    }
}

window.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  // Mostrar botón de Consentimientos solo si el usuario no es 'visitas'
  const userRole = sessionStorage.getItem('userRole');
  const consentimientosBtnContainer = document.getElementById('btn-consentimientos-container');
  const consentimientosBtn = document.getElementById('btn-consentimientos');
  if (consentimientosBtnContainer && userRole && userRole !== 'visitas') {
    consentimientosBtnContainer.style.display = 'block';
    consentimientosBtn.addEventListener('click', function() {
      // Navegar a la sección de consentimientos usando la función existente
      navigateToSection('consentimientosSection', 'crearConsentimientoBtn');
    });
  }
});
