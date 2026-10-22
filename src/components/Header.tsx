"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HiMenu, HiX } from "react-icons/hi";
import { RiTwitterXFill } from "react-icons/ri";
import { SiMatrix } from "react-icons/si";

/**
 * The site header, kept the same as the header of sourcify.dev (the
 * sourcify-ui repo, src/components/Header): logo, Verify, sourcify.dev,
 * 4byte, Docs, the GitHub star button, and X and Matrix icons. Where
 * sourcify.dev links to this app ("Repo"), this app links back to sourcify.dev.
 * Below 1024 px the links move into a full-screen menu.
 */
const NAV_LINKS: Array<{ label: string; href: string; newTab?: boolean }> = [
  { label: "Verify", href: "https://verify.sourcify.dev", newTab: true },
  { label: "sourcify.dev", href: "https://sourcify.dev" },
  { label: "4byte", href: "https://4byte.sourcify.dev" },
  { label: "Docs", href: "https://docs.sourcify.dev" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Esc closes the menu, and the page behind it does not scroll while it is open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const links = (
    <>
      <nav className="flex flex-col items-center font-vt323 text-2xl text-gray-700 lg:flex-row">
        {NAV_LINKS.map(({ label, href, newTab }) => (
          <a
            key={label}
            href={href}
            {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="link-underline mx-2 my-2 hover:text-cerulean-blue-500 lg:mx-6"
          >
            {label}
          </a>
        ))}
        <div className="ml-2 mt-4 flex items-center lg:mt-0">
          <iframe
            src="https://ghbtns.com/github-btn.html?user=argotorg&repo=sourcify&type=star&count=true&size=large"
            width="135"
            height="30"
            title="Star Sourcify on GitHub"
            scrolling="no"
          />
        </div>
      </nav>
      <div className="ml-2 mt-6 flex items-center lg:mt-0">
        <a className="hover-to-fill px-2" href="https://x.com/sourcifyeth" target="_blank" rel="noreferrer" aria-label="Sourcify on X">
          <RiTwitterXFill className="h-[1.4rem] w-auto fill-gray-700" />
        </a>
        <a
          className="hover-to-fill pl-2"
          href="https://matrix.to/#/#ethereum_source-verify:gitter.im"
          target="_blank"
          rel="noreferrer"
          aria-label="Matrix chat"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Matrix chat"
        >
          <SiMatrix className="h-6 w-auto fill-gray-700" />
        </a>
      </div>
    </>
  );

  return (
    // 72px tall with a small shadow, the same as the headers of sourcify.dev and verify.sourcify.dev.
    // While the menu is open, the header rises above the sticky bars (section bar z-40, staging banner z-50),
    // because its z-index also limits the full-screen menu inside it.
    <header
      className={`relative ${menuOpen ? "z-[60]" : "z-10"} flex h-[72px] w-full items-center bg-gray-100 shadow-sm`}
    >
      <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between px-6 md:px-12 lg:px-12 xl:px-24">
        <Link href="/" className="flex items-center">
          <Image src="/sourcify.png" alt="Sourcify logo" className="mr-3 h-10 w-auto" width={40} height={40} />
          <span className="font-vt323 text-2xl text-gray-700">sourcify.eth</span>
        </Link>

        {/* Wide screens: the links in the header */}
        <div className="hidden items-center lg:flex">{links}</div>

        {/* Narrow screens: a menu button and a full-screen menu */}
        <button
          type="button"
          className="lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <HiMenu className="text-3xl text-gray-700 hover:text-cerulean-blue-500" />
        </button>
        {menuOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-100/95 py-4 text-center lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button type="button" className="absolute right-8 top-4" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <HiX className="text-3xl text-gray-700 hover:text-cerulean-blue-500" />
            </button>
            {links}
          </div>
        )}
      </div>
    </header>
  );
}
