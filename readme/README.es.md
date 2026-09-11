# 2D Frame — visor de animación por fotogramas

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
- **Vista previa (por defecto)**: todas las acciones del personaje se reproducen a la
  vez, una celda por acción, sin configurar nada. Cada celda toma el tamaño de su
  propio rectángulo de todos los fotogramas y se muestra **siempre a tamaño original
  (1:1, un píxel de arte = un píxel de dispositivo)**, sin ampliar ni reducir. Las
  celdas se envuelven en flex, así que cada acción ocupa su propio espacio; si no
  caben, el panel se desplaza. La vista previa es muda: no carga el mapa de audio y no
  tiene ninguna ruta de reproducción.
- **Inspeccionar**: una tabla densa de acciones (búsqueda, filtros por categoría,
  fotogramas / milisegundos / eventos de sonido por fila), un escenario a **tamaño
  nativo 1:1** que encaja toda la animación en el lienzo en vez de recortarla, una
  **tira de fotogramas** reales para desplazar el cursor; arriba del
  panel derecho, los **interruptores Loop, Siguiente acción y Sound, uno por fila**, y
  después el fotograma actual (capa, sprite, posición, escala, giro, los sonidos de ese
  fotograma y los datos de sprite y atlas); el mapa de eventos está dentro de un
  diálogo. **Siguiente acción** reproduce una acción y pasa directamente a la siguiente
  de la lista (al final vuelve a la primera); además apaga Loop y desactiva su
  interruptor, porque un bucle nunca llega al final de una acción. Ambos
  paneles laterales siguen el ancho de la ventana (izquierda desde 1150 px, derecha
  desde 1440 px).
- **Los ajustes se recuerdan**: la vista abierta (previa / inspeccionar) y los tres
  interruptores de la inspección son **ajustes del plugin**, guardados en el almacén de
  preferencias del anfitrión: una instalación nueva abre la vista previa y, a partir de
  ahí, cada visita empieza donde la dejaste (entre recargas, personajes y colecciones).
- **Barra inferior de control (igual en ambas vistas)**: reproducir/pausar, reiniciar,
  una lectura en vivo (número de acciones en la vista previa, `fotograma N / M · ms`
  al inspeccionar) y, a la derecha del todo, el cambio de vista; en una colección,
  además, un selector de personajes con búsqueda. No hay zoom, velocidad ni paso a
  paso: se reproduce al tamaño y la cadencia exportados.
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
