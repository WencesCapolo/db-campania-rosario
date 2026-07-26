# La accesibilidad se verifica en un navegador real, en un proyecto aparte

Accessibility is a requirement of this project rather than a nicety: the people
entering every record by hand are often older adults, on phones, in poorly lit
parish offices. Issue #4 promises an 18px base, 4.5:1 contrast, 48px targets and a
focus indicator that does not depend on colour — and a promise nothing measures is a
comment.

The runner is **Vitest browser mode, with the Playwright provider and axe-core**, as
a second Vitest project inside the existing `vitest.config.ts`. `pnpm test` runs both
projects.

## Why a real browser

Every claim worth checking is a *computed* value.

`min-h-12` is a string until Tailwind turns it into a height. `text-tinta-suave` is a
string until the cascade turns it into an rgb triple. A test asserting on class names
would pass against a stylesheet that never loaded, which is the failure this suite
exists to prevent — and it is not hypothetical: the dashboard shell rendered
completely unstyled for three issues because eleven classNames came from a zero-byte
CSS module and every one of them resolved to `undefined`.

jsdom does not help. It has no layout, so `getBoundingClientRect` is zeroes and every
target-size assertion passes vacuously. Its `<dialog>` is shallow enough that a
focus-trap test would pass against a plain `div` — and `Dialogo`'s entire argument is
that the platform's `showModal()` does focus trapping, Escape, focus restoration and
scroll locking better than we would. That argument is only worth making if something
checks it in a browser that actually implements it.

So the helpers in `src/test/accesibilidad.ts` read `getComputedStyle`,
`getBoundingClientRect` and `Element.checkVisibility`, and nothing else.

## Why a separate project, not a separate config

The node project runs against a real Postgres: a `globalSetup` that drops `public`
and replays every migration, and a `setupFiles` that truncates every table between
tests. Neither has anything to do with mounting a component, and both are slow enough
that inheriting them would make somebody think twice about adding an accessibility
test — which is already the test nobody adds.

A separate *config file* would have worked too, and was rejected for one reason:
`pnpm test` must run both. A second config is a second command, a second command is
one somebody forgets, and an accessibility suite that has to be remembered is not
run. `test:node` and `test:navegador` exist for when you want one of them, and the
default is both.

The split also makes the boundary explicit in a way `docs/TESTING.md` previously only
described. That file says the suite has one seam — the service — and no component
tests. This project is the stated exception, and it is now a named thing rather than a
sentence in a document.

## What the two suites each prove

`src/app/contraste.test.ts` runs in the **node** project. It parses `globals.css` and
computes all twenty pairings, verifying the *token values* against each other. It
cannot know whether any component uses them: a perfect palette applied to nothing
passes it.

The **navegador** project mounts the components with the real stylesheet imported and
measures what came out. The two halves are complementary and neither is sufficient —
which is why the contrast test was not simply moved.

## Chromium only, at 390px

One browser. These assertions are about the DOM, the accessibility tree and our own
CSS, not about a rendering engine's quirks; a second browser would triple the
download and catch nothing they are about. If a Safari-specific bug ever bites, that
is the moment to add WebKit, with the bug as the reason.

The viewport is a 390px phone because that is the device. At 1280px no target is ever
cramped and no layout ever has to reflow, so every size assertion would pass by
accident.

## axe-core, and what it is not for

axe runs over each mounted subtree with the WCAG 2.0/2.1/2.2 A and AA tags, which is
wider than its default — target size and focus appearance are 2.2 additions and are
not in `wcag2aa`.

Only `violations` are asserted on. axe's `incomplete` results are "I cannot tell",
raised for things like text over a gradient or an element whose background it could
not resolve, and treating them as failures would make the suite noisy in exactly the
cases a person has to look at anyway.

axe is a floor and not a ceiling. It cannot tell whether copy is in Spanish, whether
a confirmation names what it is about to change, or whether Escape means cancel — so
the interesting tests in this project are the hand-written ones, and axe is there to
catch the mechanical mistakes nobody should spend attention on.

## The behaviour this bought immediately

Two things were untested and are now asserted, both of which could only fail in a
browser:

**Escape must not confirm.** The platform fires one `close` event for the Escape key
and for `close()`, so a component treating every close as a confirmation would give
Peregrinas de baja by keystroke — and would look entirely correct to anybody testing
with a mouse. `Dialogo` distinguishes them through the platform's own `returnValue`,
and `ConfirmarAccion` now has a test asserting the action is *not* called.

**Keyboard-only traversal of the stepped flow.** `FlujoDeAsignacion` chooses between
`asignar` and `entregar` depending on whether the image is already out. Both services
are tested; which one the screen calls is a UI fact and nothing in the node project
can catch a regression in it.

## Costs, taken knowingly

Playwright's Chromium is a ~115 MB download per machine, and CI would need it cached.
There is no CI in this repository yet (see the style guard, which is an ESLint rule
for the same reason), so today that cost is one `pnpm exec playwright install
chromium`.

Failure screenshots and attachments are written on a failing run and are ignored by
git — artefacts of a run, never of the repository.

`next/link` reads `process.env` at module scope, which does not exist in a browser.
Next's own bundler replaces it at build time; the browser project defines it. That is
a small, permanent piece of configuration owed to testing framework components
outside the framework.

## Considered options

**Playwright directly, against `next dev`.** Rejected as the primary suite: it tests
pages rather than components, needs a database and a signed-in Actor for every screen
behind `getCurrentUser()`, and turns a contrast assertion into an end-to-end run.
Worth revisiting for the one thing it does better — a real navigation across screens —
if that ever becomes the question.

**jsdom with `@testing-library/react` and `jest-axe`.** Rejected above: no layout, no
real `<dialog>`, and a suite whose green means less than it appears to.

**Storybook with the accessibility addon.** Rejected as a second, parallel way to
render every component, maintained by hand and drifting from the screens. The stories
would become the thing that is accessible.

**A CI step running Lighthouse or pa11y over deployed pages.** Not rejected so much as
deferred: it answers a different question, about pages in production rather than
components in a repository, and it cannot fail in the editor while the mistake is
being made.
