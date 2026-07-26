import Link from "next/link";

/**
 * Botón — the one clickable thing.
 *
 * Variants are a lookup, not a conditional class string. A ternary chain lets a
 * caller pass extra classes that fight the variant, and the fight is invisible
 * until somebody inspects the rendered element; a record of whole class strings
 * cannot be half-overridden.
 *
 * The floor is in here rather than in each caller: `min-h-12` is 54px at an 18px
 * root, over the 48px a thumb needs, and every variant carries a visible border
 * so a button looks like a button without being hovered — story 6, and the
 * reason there is no ghost variant.
 *
 * The focus ring comes from the `:focus-visible` rule in globals.css and is
 * deliberately not repeated here. One definition, no drift.
 *
 * `BotonEnlace` is a separate component rather than a `como="enlace"` prop,
 * because the two take genuinely different props and a discriminated union of
 * `<button>` and `<a>` attributes reads worse than two names. Anything that
 * navigates must be one: an anchor opens in a new tab, shows its target in the
 * status bar, and is announced as a link. Which element it is follows from what
 * it does, never from how it looks.
 */

export type TonoDeBoton = "principal" | "secundario" | "peligro";

const TONOS: Record<TonoDeBoton, string> = {
  principal: "border-transparent bg-accion text-white hover:bg-accion-viva",
  secundario: "border-borde-fuerte bg-papel text-tinta hover:bg-fondo",
  peligro: "border-transparent bg-peligro text-white hover:bg-peligro-viva",
};

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control " +
  "border-2 px-5 text-base font-semibold no-underline " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function clases(tono: TonoDeBoton, anchoCompleto?: boolean): string {
  return [BASE, TONOS[tono], anchoCompleto ? "w-full" : ""]
    .filter(Boolean)
    .join(" ");
}

interface Comun {
  tono?: TonoDeBoton;
  /** Fills its container. For a phone, where buttons in a column read better. */
  anchoCompleto?: boolean;
}

export default function Boton({
  tono = "principal",
  anchoCompleto,
  children,
  ...resto
}: Comun &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      {...resto}
      type={resto.type ?? "button"}
      className={clases(tono, anchoCompleto)}
    >
      {children}
    </button>
  );
}

export function BotonEnlace({
  tono = "principal",
  anchoCompleto,
  children,
  ...resto
}: Comun & Omit<React.ComponentProps<typeof Link>, "className">) {
  return (
    <Link {...resto} className={clases(tono, anchoCompleto)}>
      {children}
    </Link>
  );
}
