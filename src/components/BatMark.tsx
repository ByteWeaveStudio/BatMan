import batmark from '../assets/batmark.png';

/*
 * The mark is the favicon artwork used as a CSS mask, so the header, the browser
 * tab and the installed app icon are all the same bat. Painting it with
 * currentColor keeps it themeable the way an inline SVG would.
 */

/** Tight bounding box of the artwork — 256x142. */
const ASPECT = 256 / 142;

export function BatMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="batmark"
      style={{
        width: size,
        height: Math.round(size / ASPECT),
        maskImage: `url(${batmark})`,
        WebkitMaskImage: `url(${batmark})`,
      }}
      aria-hidden="true"
    />
  );
}
