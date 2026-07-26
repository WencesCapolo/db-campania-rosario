import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The contrast claims in globals.css, checked rather than asserted.
 *
 * Issue #4 promises 4.5:1 for body text and a focus indicator that is visible
 * independently of colour. Both are properties of the token layer, so this is
 * the one place they can be verified once instead of screen by screen — and the
 * one place a regression is cheap to catch. Somebody nudging a token to make a
 * badge look nicer finds out here.
 *
 * The pairs are written out rather than derived, because which colour is used
 * against which surface is a design fact the stylesheet does not encode. A test
 * that inferred the pairings would verify combinations nobody renders and miss
 * the ones we do.
 *
 * Runs in the node project alongside the service suite. It reads the stylesheet
 * rather than a duplicated table of hex values, so the tokens cannot drift away
 * from what is checked.
 */

const CSS = readFileSync(resolve(__dirname, "./globals.css"), "utf8");

/**
 * The stylesheet with its comments removed.
 *
 * Needed because the comments in globals.css explain why certain things are
 * *absent*, and name them to do it — so a test searching the raw text for
 * `prefers-color-scheme` finds the paragraph saying there is no
 * `prefers-color-scheme` block and fails. Grepping prose is not a check.
 */
const DECLARACIONES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function token(nombre: string): string {
  const m = DECLARACIONES.match(
    new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})`)
  );
  if (!m) throw new Error(`No está el token --color-${nombre} en globals.css`);
  return m[1];
}

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const BLANCO = "#ffffff";

describe("los tokens de color", () => {
  const papel = token("papel");
  const fondo = token("fondo");

  // 4.5:1 — SC 1.4.3, text.
  describe.each([
    ["tinta sobre papel", () => token("tinta"), () => papel],
    ["tinta sobre fondo", () => token("tinta"), () => fondo],
    ["tinta-suave sobre papel", () => token("tinta-suave"), () => papel],
    ["tinta-suave sobre fondo", () => token("tinta-suave"), () => fondo],
    ["blanco sobre acción", () => BLANCO, () => token("accion")],
    ["acción sobre papel", () => token("accion"), () => papel],
    ["blanco sobre acción viva", () => BLANCO, () => token("accion-viva")],
    ["blanco sobre peligro", () => BLANCO, () => token("peligro")],
    ["peligro sobre papel", () => token("peligro"), () => papel],
    ["blanco sobre peligro vivo", () => BLANCO, () => token("peligro-viva")],
    ["éxito", () => token("exito-tinta"), () => token("exito-fondo")],
    ["aviso", () => token("aviso-tinta"), () => token("aviso-fondo")],
    ["alerta", () => token("alerta-tinta"), () => token("alerta-fondo")],
    ["alerta sobre papel", () => token("alerta-tinta"), () => papel],
    ["neutro", () => token("neutro-tinta"), () => token("neutro-fondo")],
  ])("texto: %s", (_nombre, frente, atras) => {
    it("llega a 4.5:1", () => {
      expect(contraste(frente(), atras())).toBeGreaterThanOrEqual(4.5);
    });
  });

  // 3:1 — SC 1.4.11, anything that delimits a control or indicates focus.
  describe.each([
    ["el foco sobre papel", () => token("foco"), () => papel],
    ["el foco sobre fondo", () => token("foco"), () => fondo],
    ["el borde de un control", () => token("borde-fuerte"), () => papel],
    ["el borde de una tarjeta sobre papel", () => token("borde"), () => papel],
    ["el borde de una tarjeta sobre fondo", () => token("borde"), () => fondo],
  ])("interfaz: %s", (_nombre, frente, atras) => {
    it("llega a 3:1", () => {
      expect(contraste(frente(), atras())).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("la base tipográfica", () => {
  it("es de 18px, en un solo lugar", () => {
    expect(DECLARACIONES).toMatch(/html\s*\{[^}]*font-size:\s*18px/);
  });
});

describe("el modo oscuro", () => {
  /**
   * Out of scope for issue #4 — it doubles the contrast verification above, and
   * every colour on every screen is currently light. The block that used to be
   * here flipped the body dark while nothing else followed, which rendered white
   * text on white for exactly the people the requirements are about. If somebody
   * adds dark mode, this test failing is the reminder that the table above needs
   * a second half, not a line to delete.
   */
  it("no está declarado a medias", () => {
    expect(DECLARACIONES).not.toMatch(/prefers-color-scheme/);
  });
});
