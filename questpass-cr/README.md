# QuestPass CR — Avance 1

Primera versión navegable del sitio QuestPass CR (HTML semántico + CSS responsive, sin JavaScript).

## Cómo ver el sitio

Desde esta carpeta:

```bash
cd questpass-cr
python3 -m http.server 8080
```

Abre `http://localhost:8080/index.html` en el navegador.

## Entregables de documentación

| Documento | Ruta |
|-----------|------|
| Matriz de trazabilidad (12 requerimientos) | `docs/matriz-trazabilidad.md` |
| Mapa del sitio (7 páginas) | `docs/mapa-sitio.md` |
| Registros oficiales de experiencias | `docs/datos-oficiales.md` |
| Wireframes (SVG) | `docs/wireframes/*.svg` |

## Páginas HTML

- `index.html` — Inicio
- `experiencias.html` — Catálogo (6 experiencias)
- `detalle.html` — Ficha completa QST-001
- `reservar.html` — Formulario de reserva
- `contacto.html` — Contacto
- `login.html` — Login (maqueta)
- `admin.html` — Panel (maqueta)

Estilos: `css/estilos.css` (breakpoints 480px y 1024px).
