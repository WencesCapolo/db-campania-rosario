import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config, directly — `eslint-config-next` ships flat config arrays as of
 * Next 16, so the `FlatCompat` shim that wrapped the legacy `.eslintrc` presets
 * is gone. `next lint` is gone too; the entry point is the ESLint CLI.
 */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
