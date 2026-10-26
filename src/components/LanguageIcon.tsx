import Image from "next/image";
import SolidityIcon from "@/assets/solidity.svg";
import VyperIcon from "@/assets/vyper.svg";
import FeIcon from "@/assets/fe-dark.svg";

// `scale` makes up for empty space inside the logo file: the Solidity file has a wide margin
// around the mark, so it draws 1.5 times larger to look the same size as the others
const languageIcons: Record<string, { src: string; alt: string; scale: number }> = {
  solidity: { src: SolidityIcon, alt: "Solidity", scale: 1.5 },
  vyper: { src: VyperIcon, alt: "Vyper", scale: 1 },
  fe: { src: FeIcon, alt: "Fe", scale: 1 },
};

/**
 * The logo of a contract language, with the language name as a tooltip.
 * `size` is the visible size of the mark; the box stays `size` pixels, and a
 * scaled logo overflows it without moving the text around it.
 * Nothing for an unknown language.
 */
export default function LanguageIcon({ language, size = 20 }: { language: string; size?: number }) {
  const icon = languageIcons[language.toLowerCase()];
  if (!icon) return null;
  const drawn = Math.round(size * icon.scale);
  return (
    <span
      data-tooltip-id="global-tooltip"
      data-tooltip-content={icon.alt}
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image src={icon.src} alt={icon.alt} width={drawn} height={drawn} className="max-w-none" />
    </span>
  );
}
