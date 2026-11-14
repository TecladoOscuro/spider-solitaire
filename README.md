# Juegos

Tres juegos de navegador en un solo archivo HTML cada uno. Sin dependencias, sin build.

**Web:** https://tecladooscuro.github.io/spider-solitaire/

| Juego | Archivo | Niveles |
|---|---|---|
| Spider Solitaire | `spider.html` | 1, 2 y 4 palos |
| Damas | `damas.html` | Fácil, Medio, Difícil (IA alfa-beta) |
| Ajedrez | `ajedrez.html` | 800 · 1200 · 1600 · 2000 (IA alfa-beta) |
| Solitario (Klondike) | `klondike.html` | 1 carta, 3 cartas |
| Sudoku | `sudoku.html` | Fácil, Medio, Difícil, Experto |
| Buscaminas | `buscaminas.html` | 9×9/10 · 16×16/40 · 30×16/99 |

El índice `index.html` es el menú de entrada.

## Spider Solitaire

- 10 columnas, 104 cartas (2 mazos), 5 repartos de 10 cartas.
- Escalera K→A del mismo palo se elimina. Gana con las 8 escaleras.
- Puntos: 500 base, +100 por escalera, -1 por movimiento.
- Arrastrar o tocar carta y luego destino. Teclas: `U` deshacer · `H` pista · `D` repartir · `N` nuevo.

## Damas

- 8×8, reglas clásicas: captura obligatoria, saltos múltiples encadenados, coronación.
- La IA juega con negras: minimax alfa-beta con iterative deepening y time-box por nivel.
- Teclas: `U` deshacer · `H` pista · `N` nuevo.

## Ajedrez

- Reglas completas: enroque, al paso, promoción, jaque mate, ahogado, regla de 50, material insuficiente.
- La IA juega con negras: negamax alfa-beta + piece-square tables, profundidad según nivel.
- Teclas: `U` deshacer · `N` nuevo.

## Solitario (Klondike)

- Reparto clásico 1..7 + stock de 24, robo de 1 o 3 cartas (dificultad).
- Puntos: +5 estante→columna, +10 a fundación, −1 por movimiento.
- Doble toque envía a fundación. Teclas: `U` deshacer · `H` pista · `N` nuevo.

## Sudoku

- Generador con solución única, simetría rotacional y pistas por nivel (40/34/30/26).
- Notas, errores en rojo, pista, deshacer. Teclas: flechas · 1-9 · `U` · `H` · `N`.

## Buscaminas

- Primera jugada siempre segura (y abre región), bandera con clic derecho o pulsación larga, acorde al tocar un número.
- Niveles 9×9/10, 16×16/40, 30×16/99 con récord por nivel. Tecla `N`.

Todos los juegos tienen botón `⌂ Juegos` (y logo clicable) para volver al menú.

## Desarrollo

```sh
python3 -m http.server 8000
```

GitHub Pages sirve la rama `main`, raíz.

## Tests (Playwright, navegador real)

```sh
python3 -m http.server 8899        # en la raíz del repo
cd tests
npm install
npx playwright install chromium
npm test                           # escritorio: los 7 (6 juegos + móvil)
node t_resp.js                     # responsive: 7 páginas × 6 viewports
```

Contra el sitio en vivo: `node t_spider.js https://tecladooscuro.github.io/spider-solitaire/spider.html` (idem con `damas.html` / `ajedrez.html` / `t_mobile.js <base>` / `t_resp.js <base>`).

Cubren: reparto, solape/alineación, arrastre sin residuos, click-click, deshacer, pista, nuevo juego, dificultades, respuesta de la IA, teclado y ausencia de errores JS.

`node t_resp.js` es la suite responsive: 6 viewports (iPhone vertical/horizontal, iPad vertical/horizontal, 360px, portátil) × 4 páginas — sin desbordes, tablero y panel dentro del viewport, 10 columnas del spider sin scroll horizontal.
