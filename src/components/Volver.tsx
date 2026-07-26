import Link from "next/link";

/**
 * Volver — the way back, in the one place it is written.
 *
 * Every form screen had its own copy of this, and the copies disagreed on the
 * arrow, the underline and the tap target. It is a link and not a button because
 * it navigates, so it announces as a link and opens in a new tab if somebody
 * middle-clicks it.
 *
 * `min-h-12` and not just underlined text: this is the control an older adult
 * reaches for most often on a phone, and a 20px line of text is not a 48px
 * target. The arrow is `aria-hidden` — the label already says where it goes,
 * which is why the label is a destination ("Volver a Peregrinas") rather than
 * just "Volver".
 */
export default function Volver({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-accion underline"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}
