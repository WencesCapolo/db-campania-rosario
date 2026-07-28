# La identidad visual sale del sitio de Schoenstatt Argentina

El sistema tenía tokens verificados y ninguna identidad: neutros grises, un azul de
Tailwind y esquinas de 12 px, que es lo que sale cuando nadie eligió nada. Issue #4
dejó el piso de accesibilidad hecho — 4.5:1, 54 px, foco por geometría — pero un piso
no es una cara.

La cara la da schoenstatt.org.ar. Es el sitio que esta gente ya reconoce: entrar al
inventario y encontrar el mismo azul, la misma regla dorada partiendo la sección y la
misma tipografía dice "esto es de la Campaña" antes de que nadie lea el header. La
alternativa era inventarnos una identidad propia, que además de trabajo habría hecho
que el sistema se presente como una aplicación de otro.

## Qué se tomó

Medido sobre el sitio renderizado, no sacado de una captura:

| | Valor | Papel acá |
|---|---|---|
| Azul institucional | `#004478` | tinta de los títulos, relleno del botón, color de link |
| Celeste | `#76A9DB` | el filete de cada destino, los iconos |
| Dorado | `#AC954F` | la regla que parte la sección |
| Lienzo | `#F2F6FA` | el fondo del cuerpo |
| Esquinas | 3 px | `--radius-marco` |
| Tipografía | Open Sans | `--font-marca`, servida por next/font desde nuestro dominio |

Open Sans Condensed, que el sitio usa para los títulos, ya no existe como familia
aparte: Google la retiró cuando Open Sans pasó a variable y el ancho condensado quedó
como el eje `wdth`. Un título es `font-stretch-condensed` sobre la misma descarga.

## Las tres cosas que no se pudieron copiar, y por qué

Esto es lo que hace que este ADR exista en lugar de ser un commit: **el tema del sitio
no llega al piso de contraste de este proyecto en tres lugares**, y en los tres el
tema cede.

1. **El celeste no es un color de texto.** Blanco encima da 2.5:1 y el azul encima
   4.0:1. Se usa como relleno con tinta noche encima (5.9:1) o como decoración.
2. **El dorado tampoco.** `#AC954F` sobre papel da 2.9:1, que no alcanza ni para una
   regla. Se queda como decoración pura y hay un `--color-oro-tinta` (`#7D6828`,
   5.4:1) para cuando el gesto tiene que ser legible.
3. **El borde gris del sitio (`#E5E5E5`) da 1.3:1.** Un borde que delimita un control
   pide 3:1 — SC 1.4.11 — así que las tarjetas llevan `--color-borde-suave`
   (`#67788C`, 4.5:1) y los controles el azul.

De ahí sale una regla que es fácil de romper sin darse cuenta: **el filete celeste va
adentro del borde, nunca en lugar de él.** Un `border-l-8 border-l-celeste` le saca a
la tarjeta uno de sus cuatro cantos y lo reemplaza por 2.5:1. En Inicio el filete es
una franja interna de 8 px y el canto sigue siendo `borde-suave`.

Cada par está en `src/app/contraste.test.ts`, en su propio `describe`. Los pares que
*no* están ahí son los que la interfaz no dibuja, y el comentario al lado dice cuáles
y por qué — el celeste no aparece como borde, y esa ausencia es la regla de arriba
escrita donde se rompe.

## Cómo se eligió

Tres variantes en la propia ruta `/dashboard`, con `?variant=A|B|C` y un switcher
flotante, comparadas contra el diseño de entonces: A ponía el azul en toda la
pantalla, B lo dejaba en el registro claro del cuerpo del sitio, C metía la acción
dentro de una banda azul arriba. Ganó B.

La razón es el lugar donde se usa: un teléfono, en una oficina parroquial, con una
lámpara. El fondo claro es el que no pelea con el reflejo, y es la única de las tres
donde el azul lleno del destino con consecuencias — "Entregar una imagen" — tiene
contra qué destacar. En A todo era azul y el botón principal tenía que volverse
blanco para diferenciarse, lo cual invierte el significado de los tokens.

Las variantes perdedoras, el switcher y los tokens con prefijo `sch-` se borraron.

## Lo que queda pendiente

Inicio es la única pantalla con el tema. El resto sigue con los tokens neutros de
issue #4, que no están mal — pasan el mismo piso — pero no son la misma cara. Portar
el tema pantalla por pantalla es trabajo aparte, y cada pantalla que se porte suma sus
pares al mismo test. Lo que **no** hay que hacer es reasignar los tokens viejos a los
valores nuevos de una sola vez: `contraste.test.ts` verifica pares concretos contra
superficies concretas, y cambiar `--color-accion` por debajo hace que un test que pasa
deje de significar lo que dice.
