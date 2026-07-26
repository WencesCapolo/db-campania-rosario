/**
 * The browser project's setup, and it does two things.
 *
 * The first is the important one: it imports the real stylesheet. Every contrast
 * and target-size assertion in this suite reads a *computed* style, so a run
 * against unstyled markup would pass while asserting nothing — `min-h-12` is a
 * class name, not a height, until Tailwind has turned it into one. Vite puts the
 * import through the same PostCSS config Next uses, so the tokens under test are
 * the tokens that ship.
 *
 * That is also the half `src/app/contraste.test.ts` cannot cover. It verifies the
 * token *values* against each other; this verifies that the components actually
 * use them. A perfect palette applied to nothing passes the first and fails the
 * second.
 *
 * The second is `cleanup`, which unmounts between tests. Without it a focus-order
 * test would walk the previous test's buttons as well as its own — and would pass,
 * because there is always something focusable next.
 */
import "@/app/globals.css";

import { afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";

afterEach(async () => {
  await cleanup();
});
