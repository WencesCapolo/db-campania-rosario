# Handoff — Inicio y la barra de navegación

Escrito el 2026-07-28, sobre `trabajo`, con todo sin comitear encima de `759a708`.
Alcance: las dos pantallas que se ven en cada carga — Inicio y el shell del grupo
`(dashboard)`. Nada de servicios, repositorios ni migraciones se tocó.

## 1. Qué quedó hecho

### Inicio — `src/app/(dashboard)/dashboard/page.tsx`

Una tarjeta y nada más, centrada en el alto. De arriba hacia abajo:

- Una banda de encabezado sobre `lienzo`, centrada: el retrato del Padre Pozzobón
  (`/pozzobon.png`, 80 px), la etiqueta `CAMPAÑA DEL ROSARIO` en `oro-tinta`, el
  título `¿Qué querés hacer?` en `azul`, y el filete dorado corto que lo cierra.
- Un filete `borde-suave` que separa la banda de los destinos.
- Los tres destinos, como filas separadas por filetes en lugar de por aire, cada una
  con su punta de flecha: Peregrinas, Misioneros, y `Entregar una imagen` con el
  relleno azul, porque es el único con consecuencias.

Dos cosas que parecen detalles y son decisiones:

- **El encabezado está adentro de la tarjeta**, no arriba de ella. Por eso la
  pantalla tiene **un borde en total** en lugar de dos objetos con canto propio.
- **El centrado es óptico, no geométrico** — `items-center` con `pt-6 pb-28`. El
  aire de más abajo empuja la tarjeta arriba del centro exacto, que con una sola
  cosa en pantalla se lee como caída. `pt-6` es el piso: en una pantalla más baja
  que la tarjeta, el centrado cede y queda margen en lugar de recorte.

El alto disponible sale del layout, que es una columna `flex min-h-screen flex-col`
con los hijos en un `flex-1`. No hay ninguna altura de barra restada a mano, que es
lo que se rompería cuando los destinos se van a un segundo renglón en un teléfono.

### La barra — `src/app/(dashboard)/barra.tsx` (nuevo)

Componente cliente, y por una sola razón: marca la ruta actual con `usePathname`. El
Usuario se sigue resolviendo en el servidor, en el layout, y baja por props — la
barra no toma ninguna decisión de permisos, sólo recibe `puedeAdministrar` y
`esNacional` ya decididos.

Lo que cambió respecto de los tres links subrayados que había:

| Antes | Ahora | Por qué |
| --- | --- | --- |
| Nada decía en qué sección estás | `aria-current="page"` y relleno azul | Lo dice para quien escucha y para quien mira; cambia el relleno, no sólo el matiz |
| Texto subrayado en `accion` | Pastillas con borde de 2 px en `azul` | Un control se reconoce antes de que alguien lo toque — por eso ningún `Boton` tiene variante fantasma |
| 18 px de texto con 12 px de aire | `min-h-12` (54 px) y `px-4` | Es un blanco para un pulgar |
| El nombre del Usuario al lado, mismo peso | Regla vertical y rol en `text-sm` | Sin la regla, un nombre propio se lee como un cuarto lugar a dónde ir |

Al pie va el filete dorado del sitio, **adentro** del borde: el canto de abajo lo
sigue dibujando `borde` (3.8:1), porque el dorado da 2.9:1 y no delimita nada.

Salió de tres variantes (`?variant=N1|N2|N3`, ya borradas): N1 pintaba la barra
entera de `azul-noche`, N3 la partía en dos pisos con el nombre arriba. Ganó la de
papel — el cuerpo de la app es claro, y una franja azul a todo el ancho arriba de un
cuerpo claro es la misma mancha que ya había perdido en la ronda del tratamiento.

### `globals.css`

`:root` declara `color-scheme: light`. Sin esa línea el navegador decide, y con el
sistema en oscuro pinta los `<select>`, las barras de scroll y los controles nativos
oscuros arriba de una paleta que es clara en todas las pantallas — la misma mitad de
modo oscuro que el bloque borrado de `prefers-color-scheme` dejaba. El día que haya
modo oscuro de verdad, esto es `light dark` y la tabla de contraste necesita su
segunda mitad.

Está también la desviación del import de Tailwind, explicada en el archivo mismo y
en CLAUDE.md § 8. **No volver a `@import "tailwindcss"`.**

### `layout.tsx` (raíz)

`suppressHydrationWarning` en el `<html>`, y sólo ahí: el modo oscuro automático del
navegador le agrega atributos a ese elemento antes de que React hidrate, y eso no es
nuestro cambio. Es de un nivel, no se hereda, así que una discrepancia real adentro
de la app sigue avisando.

## 2. Contraste, y qué lo prueba

Ningún par nuevo quedó sin declarar. Los que la barra y la tarjeta usan ya estaban en
`src/app/contraste.test.ts`: `azul` sobre papel y sobre lienzo (10:1), blanco sobre
`azul` (10:1), `oro-tinta` sobre los dos fondos, `borde-suave` como canto (4.5:1 y
4.2:1). El dorado y el celeste no llevan texto en ninguna pantalla, que es la razón
por la que existen `oro-tinta` y `borde-suave`.

Si se retoma N1 — la barra azul — hay que agregar un par: su regla divisoria era
`celeste` sobre `azul-noche` (4.9:1, clarea el 3:1 de un límite de interfaz) y ese
par no está en el archivo.

## 3. Estado de la verificación

`pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec next build` y `pnpm test`
(26 archivos, 426 pruebas) pasan. La suite `navegador` monta los componentes con la
hoja de estilos real, así que las 63 pruebas de accesibilidad corrieron contra los
tokens que se despachan.

Una advertencia sobre el alcance de esa suite, porque cambia qué hay que mirar: el
proyecto `navegador` importa `globals.css` por Vite, no por el pipeline de Next. Un
cambio en **cómo una utilidad llega a la página** — el orden de la cascada, las
capas, un paquete que trae su propio CSS — se verifica en la app corriendo, no en la
suite. Un cambio de valor de token se verifica en la suite.

## 4. Lo que queda pendiente

1. **Ruido de formato sin resolver.** 17 archivos `src/app/**/*.tsx` que no tienen
   nada que ver con este trabajo quedaron reformateados por una corrida de
   `prettier --write` (comas finales, salto de línea al final). Es sólo formato y no
   toca ninguna lógica, pero ensucia el diff. No se revirtió porque esos archivos
   tenían trabajo sin comitear encima: un `git checkout` se lo llevaría.
2. **Una captura suelta en `public/`.** `Captura de pantalla_2026-07-28_17-06-06.png`
   está sin trackear en `public/`, que es un directorio que se despacha. Borrarla o
   moverla antes de comitear.
3. **El resto de las pantallas no lleva el tema.** Inicio y la barra están vestidas;
   los listados, el tablero y los formularios siguen con los tokens base. La barra ya
   les pone el filete dorado y el logo arriba, así que la costura se ve.
4. **El contenedor de pruebas quedó levantado.** `pnpm test:db:down` cuando no se
   use más.

## 5. Cómo mirarlo

```
pnpm dev            # :3000
```

Inicio en `/dashboard`; la pastilla rellena sólo se ve estando en `/tablero`,
`/admin/users` o `/admin/territorio`, así que hay que salir de Inicio para juzgarla.
En un teléfono, mirar que los destinos de la barra caigan a un segundo renglón sin
tapar el nombre del Usuario, y que Inicio siga centrado con la barra más alta.
