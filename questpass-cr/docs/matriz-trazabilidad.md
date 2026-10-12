# Matriz de trazabilidad — QuestPass CR (Avance 1)

| ID | Requerimiento | Página(s) donde se atiende | Evidencia en el sitio |
|----|---------------|----------------------------|------------------------|
| R01 | Presentar la propuesta de valor y accesos rápidos al catálogo | `index.html` | Hero, beneficios y enlaces a experiencias y reserva |
| R02 | Listar las seis experiencias oficiales del catálogo | `experiencias.html`, `admin.html` | Tarjetas con códigos QST-001 a QST-006 y tabla en panel |
| R03 | Mostrar ficha completa de QST-001 en esta fase | `detalle.html` | Sección de detalle con todos los campos oficiales de QST-001 |
| R04 | Permitir solicitud de reserva con validación HTML nativa | `reservar.html` | Formulario con tipos, `required`, `min`/`max`, `pattern` y `minlength`/`maxlength` |
| R05 | Canal de contacto para patrocinadores y participantes | `contacto.html` | Formulario con nombre, correo, asunto y mensaje |
| R06 | Maquetar acceso administrativo (sin validar credenciales) | `login.html` | Campos correo y contraseña correctamente etiquetados |
| R07 | Maquetar panel futuro con experiencias y reservas | `admin.html` | Dos secciones: tabla de 6 registros oficiales y tabla vacía de reservas |
| R08 | Navegación consistente; marca enlaza al inicio | Todas las páginas | `<header>` con enlace «QuestPass CR» → `index.html` y menú repetido |
| R09 | HTML semántico y un único `h1` por página | Todas las páginas | Uso de `header`, `main`, `nav`, `footer`, `article`, `section` |
| R10 | Diseño responsive (móvil y escritorio) | `css/estilos.css` | Breakpoints 480px y 1024px; Grid/Flexbox |
| R11 | Accesibilidad de formularios (labels visibles, foco, contraste) | Formularios en `reservar.html`, `contacto.html`, `login.html` | Labels asociados, `:focus-visible`, sin sustituir label por placeholder |
| R12 | Sin lógica JavaScript en este avance | Todas las páginas | Solo HTML y CSS; formularios sin scripts |
