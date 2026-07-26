import axe from "axe-core";

/**
 * The measurements the accessibility suite makes, in one place.
 *
 * These read the browser's *computed* values rather than our class names, which is
 * the whole reason the suite runs in a browser at all. `min-h-12` and
 * `text-tinta-suave` are strings until Tailwind and the cascade have turned them
 * into a height and an rgb triple; a test asserting on the strings would pass
 * against a stylesheet that never loaded.
 */

/**
 * axe-core over a subtree, returning only what it is sure about.
 *
 * `incomplete` results are dropped on purpose. axe reports "cannot tell" for
 * things like text over a gradient or an element it could not resolve a background
 * for, and treating those as failures would make the suite noisy in exactly the
 * cases a human has to look anyway. `violations` are the ones it can prove.
 *
 * The rule set is left at axe's defaults plus the two WCAG 2.2 additions this
 * project promised — target size and focus appearance are not in axe's default
 * "wcag2a/wcag2aa" tags, and asking for them by tag is how they get run.
 */
export async function violacionesDeAxe(
  elemento: Element
): Promise<{ id: string; help: string; nodos: string[] }[]> {
  const resultado = await axe.run(elemento, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
  });

  return resultado.violations.map((v) => ({
    id: v.id,
    help: v.help,
    nodos: v.nodes.map((n) => n.html),
  }));
}

/** The relative luminance of an `rgb(...)`/`rgba(...)` string. */
function luminancia(color: string): number {
  const [r, g, b] = canales(color);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function canales(color: string): [number, number, number] {
  const m = color.match(/[\d.]+/g);
  if (!m || m.length < 3) throw new Error(`No pude leer el color «${color}»`);
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function esTransparente(color: string): boolean {
  const m = color.match(/[\d.]+/g);
  return color === "transparent" || (m?.length === 4 && Number(m[3]) === 0);
}

/**
 * The background an element is actually drawn on.
 *
 * Walks up until it finds something opaque, because a button with no background of
 * its own is drawn on its card, which is drawn on the page. `getComputedStyle`
 * will not do this walk for you: it reports `rgba(0, 0, 0, 0)` and leaves the
 * question of what is behind it to whoever asked.
 */
function fondoEfectivo(elemento: Element): string {
  let actual: Element | null = elemento;
  while (actual) {
    const fondo = getComputedStyle(actual).backgroundColor;
    if (!esTransparente(fondo)) return fondo;
    actual = actual.parentElement;
  }
  // Nothing opaque all the way up. The page's own background is white by the time
  // it reaches the compositor, and saying so beats throwing.
  return "rgb(255, 255, 255)";
}

/**
 * The contrast ratio between an element's text and what it is drawn on.
 *
 * Rounded to one decimal, because 4.4999 failing a 4.5 assertion on a float is a
 * test failure nobody can act on.
 */
export function contrasteDelTexto(elemento: Element): number {
  const tinta = getComputedStyle(elemento).color;
  const fondo = fondoEfectivo(elemento);
  const [a, b] = [luminancia(tinta), luminancia(fondo)];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 10) / 10;
}

/**
 * An element's rendered size, for SC 2.5.8.
 *
 * The project promises 48px, which is more than the 24px WCAG asks — the audience
 * is older adults on phones, and 24px is a floor for a mouse.
 */
export function tamanioDelObjetivo(elemento: Element): {
  ancho: number;
  alto: number;
} {
  const r = elemento.getBoundingClientRect();
  return { ancho: Math.round(r.width), alto: Math.round(r.height) };
}

/**
 * Everything the keyboard can reach inside a subtree, in tab order.
 *
 * `checkVisibility` is not decoration. A closed `<dialog>` is `display: none` and
 * its buttons are still in the DOM, so a plain `querySelectorAll` reports controls
 * nobody can see or reach — and a focus-order test built on that list would assert
 * an order that never happens. It is the browser's own answer to "is this
 * rendered", which is the question being asked.
 */
export function focalizables(raiz: ParentNode): HTMLElement[] {
  const seleccion =
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  return Array.from(raiz.querySelectorAll<HTMLElement>(seleccion)).filter((e) =>
    e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
  );
}
