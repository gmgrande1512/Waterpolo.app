# Waterpolo Táctico

Pizarra táctica de waterpolo para acompañar las charlas técnicas, en celular o tablet.

- Pileta con **6 atacantes** (gorro azul) y **6 defensores + arquero** (gorro blanco / rojo).
- Número de gorro **del 1 al 15** para cada jugador (tocá el gorro).
- **Grabar jugadas paso a paso** y reproducirlas animadas, con flechas de movimiento y una nota por paso.
- **Biblioteca** con jugadas base (ataque, superioridad, contraataque, defensa, inferioridad) y las propias.
- Exportar e importar jugadas (para pasarlas de un dispositivo a otro).
- Se instala como app (PWA) y **funciona sin internet**.

## Uso rápido

1. Arrastrá gorros y pelota con el dedo.
2. **Agregar paso** copia la posición actual: mové a los jugadores y repetí.
3. **▶** reproduce la jugada.
4. **Guardar** la manda a la biblioteca.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Pantalla y diálogos |
| `css/styles.css` | Estilos |
| `js/app.js` | Lógica: dibujo, arrastre, pasos, biblioteca, guardado |
| `js/plays.js` | Jugadas base (coordenadas en metros) |
| `sw.js` | Funcionamiento sin conexión. **Cambiar `CACHE` en cada versión nueva.** |
| `manifest.webmanifest`, `icons/` | Datos para instalar la app |
| `docs/investigacion-jugadas.md` | Investigación y fuentes de las jugadas base |

No necesita instalar nada ni compilar: son archivos estáticos.

## Probar en la compu

```bash
python3 -m http.server 8000
```

y abrir http://localhost:8000

## Publicar (GitHub Pages)

En GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
La app queda en `https://gmgrande1512.github.io/Waterpolo.app/`. Desde el celular se abre ese link y se instala
(Android: menú ⋮ → *Instalar aplicación*; iPhone/iPad: Compartir → *Agregar a inicio*).

## Datos

Las jugadas propias y los números se guardan **en el dispositivo** (almacenamiento del navegador).
Usá *Opciones → Exportar mis jugadas* para hacer copia de seguridad o pasarlas a otro equipo.
