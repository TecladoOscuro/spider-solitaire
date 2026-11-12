# Spider Solitaire

Spider solitaire clásico en un solo archivo HTML. Sin dependencias, sin build.

## Juego

- 10 columnas, 104 cartas (2 mazos), 5 repartos de 10 cartas.
- Dificultad: 1 palo (fácil), 2 palos, 4 palos (difícil).
- Mueve una carta o una escalera descendente del mismo palo sobre la carta un valor mayor, o a una columna vacía.
- Completa K→A del mismo palo para eliminar 13 cartas. Gana con las 8 escaleras.
- Puntos: 500 base, +100 por escalera, -1 por movimiento.
- Controles: arrastrar con ratón o tocar carta y luego destino.
- Teclas: `U` deshacer · `H` pista · `D` repartir · `N` nuevo juego.

## Ejecutar

Abrir `index.html` en el navegador, o servirlo:

```sh
python3 -m http.server 8000
```

## Despliegue

GitHub Pages sirve `index.html` desde la rama `main`, raíz.

https://tecladooscuro.github.io/spider-solitaire/
