# Mapa del sitio — QuestPass CR

## Páginas obligatorias (7)

1. `index.html` — Inicio
2. `experiencias.html` — Catálogo
3. `detalle.html` — Ficha de experiencia (QST-001 en Avance 1)
4. `reservar.html` — Formulario de reserva
5. `contacto.html` — Formulario de contacto
6. `login.html` — Acceso administrativo (maqueta)
7. `admin.html` — Panel administrativo (maqueta)

## Diagrama de navegación

```mermaid
flowchart TD
  index[index.html Inicio]
  exp[experiencias.html Catálogo]
  det[detalle.html QST-001]
  res[reservar.html Reservar]
  con[contacto.html Contacto]
  log[login.html Login]
  adm[admin.html Admin]

  index --> exp
  index --> res
  index --> con
  index --> log

  exp --> det
  exp --> res
  det --> res

  res --> exp
  con --> index
  log --> adm
  adm --> exp
  adm --> log

  exp --> index
  det --> exp
  res --> index
  con --> contacto
  log --> index
  adm --> index
```

## Relaciones principales

| Desde | Hacia | Motivo |
|-------|-------|--------|
| Todas | `index.html` | Logo «QuestPass CR» y enlace «Inicio» |
| `index.html` | `experiencias.html`, `reservar.html`, `contacto.html` | Flujo del visitante |
| `experiencias.html` | `detalle.html` | Ver ficha de QST-001 |
| `experiencias.html` | `reservar.html` | Reservar desde catálogo |
| `detalle.html` | `reservar.html` | CTA de reserva |
| `login.html` | `admin.html` | Enlace de maqueta «Ir al panel» (sin autenticación real) |
| `admin.html` | `login.html` | Cerrar sesión (enlace estático) |
