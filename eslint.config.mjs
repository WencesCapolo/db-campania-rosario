import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config, directly — `eslint-config-next` ships flat config arrays as of
 * Next 16, so the `FlatCompat` shim that wrapped the legacy `.eslintrc` presets
 * is gone. `next lint` is gone too; the entry point is the ESLint CLI.
 */

/**
 * The guard that keeps the consolidation from eroding.
 *
 * Issue #4's testing decisions ask for "a guard in continuous integration that
 * fails on any reintroduced inline style or non-Tailwind stylesheet". There is
 * no CI in this repository — no workflows, no hooks — so the choice was to add
 * one or to express the guard where every other rule in this project already
 * lives. This is the second. It runs under `pnpm lint`, which is
 * `eslint src --max-warnings=0`, and unlike a CI step it fires in the editor
 * while the mistake is being made rather than ten minutes after it is pushed.
 *
 * Both rules are about the same thing: there is exactly one styling system, and
 * a screen cannot quietly opt out of the token layer. An inline style bypasses
 * the tokens entirely; a second stylesheet redefines them somewhere nobody is
 * looking. Those were the two ways the codebase got into the state issue #4
 * exists to fix.
 */
const unSoloSistemaDeEstilos = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXAttribute[name.name='style']",
        message:
          "Sin estilos en línea: rompen los tokens y no se pueden revisar. Usá utilidades de Tailwind, y si falta un valor agregalo al bloque @theme de globals.css.",
      },
      {
        selector: "ImportDeclaration[source.value=/\\.module\\.css$/]",
        message:
          "Sin CSS modules: Tailwind es el único sistema de estilos. El último que hubo era un archivo de cero bytes cuyas once clases resolvían a undefined, y nadie lo notó durante tres issues.",
      },
      {
        selector:
          "ImportDeclaration[source.value=/\\.css$/][source.value!='./globals.css']",
        message:
          "Sin hojas de estilo propias: los tokens se declaran una sola vez, en globals.css. Una segunda hoja los redefine en un lugar donde nadie los busca.",
      },
    ],
  },
};

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  unSoloSistemaDeEstilos,
];

export default eslintConfig;
