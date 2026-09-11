# Character Frame Animation — visor de animación por fotogramas

Reproduce una **carpeta de personaje 2D ya exportada** en hoardodile: animación de
sprites fotograma a fotograma, cambio de acciones y el audio del personaje que dispara
el propio fotograma.

Los personajes son animaciones 2D de sprites (cinco capas de dibujo con curvas de
intercambio de sprite más posición/escala/rotación, 30 fps, ~150 sprites y ~75
acciones por personaje). El formato de exportación está documentado en
`docs/format.md`; la herramienta de exportación es un proyecto aparte, no público, y
no forma parte de este repositorio.

## Funciones

- Detecta dos formas de recurso: una **carpeta de personaje autocontenida**
  (`character.json` en la raíz — se puede conservar o borrar individualmente) y una
  **raíz de colección** (`catalog.json`, con selector de personajes).
- Visor: lista de acciones agrupada por reposo/movimiento/ataque/habilidad/golpe/estado,
  reproductor de fotogramas en canvas (reproducir/pausar, paso a paso, reinicio,
  velocidad, zoom, bucle, guías, línea de tiempo), fotograma actual y capas dibujadas.
- Audio del personaje: los eventos de sonido que la exportación dispara por fotograma,
  con la ganancia exportada restaurada (las que no son 1.0 muestran una insignia
  `x0.80`), reproducibles cuando resuelven a una muestra, con el estado completo de
  resolución (los no resueltos se muestran, no se ocultan).
- Tarjeta: `cover.png` como carátula y textos de esquina localizados vía claves i18n.

## Requisitos

- hoardodile ≥ 0.2.0.
- Una carpeta de personaje o de colección ya exportada. El plugin no incluye datos.
- Confía en el repositorio antes de instalar: el código del plugin se ejecuta en el
  servidor dentro de un sandbox restringido.
