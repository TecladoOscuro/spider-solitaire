# Backlog de juegos (por implementar)

Lista completa de juegos "de este rollo" (mesa/cartas/puzle/arcade clásico) pendientes.
Pipeline por juego: agente construye → tests de motor (node + `awk`/`node --check`) →
suite Playwright propia funcional → captura visual revisada → tarjeta en el menú con ⓘ
de reglas → README + `tests/` + `t_resp` (N páginas ×6 viewports) → commit → push →
validación en vivo. Ritmo: implemento en tandas de2-3 sin esperar a nadie.

## En construcción (tanda actual)
- [ ] FreeCell (solitario freecell — familia top con Klondike)
- [ ] Go 9×9 (mini-go: capturas, ko, komi, Victoria por territorio — IA niveles)

## Cola priorizada
- [ ] Ahorcado (palabras, niveles por longitud, ahorcado animado estilo app)
- [ ] Quarto (4 en línea con piezas con doble atributo — IA)
- [ ] Simon / Secuencia (memoria de color-sonido, niveles de velocidad)
- [ ] Piedra Papel Tijera (IA con patrones, mejor de N, stats)
- [ ] Breakout (ladrillos, niveles de velocidad/vidas — arcade de salon)
- [ ] Pong vs IA (niveles de dificultad)
- [ ] Damas Rusas / variantes (6×6 damas clásicas — extender family damas)
- [ ] Tres en Raya variante "Cuatro en raya 5×5 gomoku" (IA)
- [ ] Parejas de símbolos vs tiempo... (cuidado: solapa Memoria → solo si aporta)
- [ ] Solitario Spider ya hecho; **FreeCell**, **Pyramid (Pirámide)** y **Clock (Reloj)** como posibles solitarios extra
- [ ] Sopa de números (hidden numbers)… bajo prioridad
- [ ] Puzzle del N-puzzle ya hecho (15) → extender a 24 (5×5) si interesa
- [ ] Fifteen / Hanoi (Torres de Hanói) — puzle clásico con niveles (3/4/5 discos)
- [ ]2048 variante Threes? (ya hay 2048)
- [ ] Tetris-like: **Caída de Bloques** (sin marca Tetris) con niveles de velocidad
- [ ] Memoria de Parejas vs reloj ya hecho; **Simon** cubre ese hueco

## Descartados con motivo
- Sudoku: el usuario lo quitó (tiene su propia app).
- Tetris / Pac-Man / Space Invaders: marcas registradas → usar nombres genéricos si se hace.
- Parchís/Ludo:4 jugadores, dados, demasiado alcance para este formato.
