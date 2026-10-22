"use client";

import React, { useState } from "react";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";

interface ExplorerSectionsProps {
  files: React.ReactNode;
  outline: React.ReactNode;
  // Starting state of the outline section (closed on small screens)
  outlineOpenByDefault: boolean;
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full shrink-0 items-center gap-1 border-b border-gray-700 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-300 hover:text-white cursor-pointer"
    >
      {open ? <VscChevronDown className="w-3.5 h-3.5" /> : <VscChevronRight className="w-3.5 h-3.5" />}
      {title}
    </button>
  );
}

/**
 * The Explorer tab: the file tree on top and the outline of the open file
 * below, as in VS Code. Each section can close; an open section takes the
 * free height.
 */
export default function ExplorerSections({ files, outline, outlineOpenByDefault }: ExplorerSectionsProps) {
  const [filesOpen, setFilesOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(outlineOpenByDefault);

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Files" open={filesOpen} onToggle={() => setFilesOpen((open) => !open)} />
      {filesOpen && <div className="min-h-0" style={{ flex: outlineOpen ? "3 1 0" : "1 1 0" }}>{files}</div>}
      <div className={filesOpen ? "border-t border-gray-700" : ""}>
        <SectionHeader title="Outline" open={outlineOpen} onToggle={() => setOutlineOpen((open) => !open)} />
      </div>
      {outlineOpen && <div className="min-h-0" style={{ flex: filesOpen ? "2 1 0" : "1 1 0" }}>{outline}</div>}
    </div>
  );
}
