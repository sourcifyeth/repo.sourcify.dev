"use client";

import React from "react";
import { VscFiles, VscSearch } from "react-icons/vsc";

export type SidebarView = "explorer" | "search";

interface SourceSidebarProps {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  searchShortcut: string;
  explorer: React.ReactNode;
  search: React.ReactNode;
}

const VIEW_TITLES: Record<SidebarView, string> = { explorer: "Explorer", search: "Search" };

/**
 * The left panel of the source view, with one tab per view (VS Code style).
 * Both views stay mounted, so a view keeps its state (tree folders, search
 * results, scroll position) while the other one shows.
 */
export default function SourceSidebar({ view, onViewChange, searchShortcut, explorer, search }: SourceSidebarProps) {
  const tabs: Array<{ id: SidebarView; Icon: React.ComponentType<{ className?: string }>; tooltip: string }> = [
    { id: "explorer", Icon: VscFiles, tooltip: "Explorer" },
    { id: "search", Icon: VscSearch, tooltip: `Search in all files (${searchShortcut})` },
  ];

  return (
    <div className="flex flex-col bg-gray-800 text-gray-300 h-full">
      <div className="flex items-center gap-1 px-2 border-b border-gray-700" role="tablist" aria-label="Source views">
        {tabs.map(({ id, Icon, tooltip }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`source-tab-${id}`}
            aria-selected={view === id}
            aria-controls={`source-view-${id}`}
            aria-label={VIEW_TITLES[id]}
            onClick={() => onViewChange(id)}
            data-tooltip-id="global-tooltip"
            data-tooltip-content={tooltip}
            className={`p-1.5 -mb-px border-b-2 cursor-pointer transition-colors ${
              view === id ? "border-cyan-500 text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-gray-200">{VIEW_TITLES[view]}</span>
      </div>
      <div className="h-[200px] md:h-[500px] min-h-0">
        <div
          id="source-view-explorer"
          role="tabpanel"
          aria-labelledby="source-tab-explorer"
          hidden={view !== "explorer"}
          className="h-full"
        >
          {explorer}
        </div>
        <div
          id="source-view-search"
          role="tabpanel"
          aria-labelledby="source-tab-search"
          hidden={view !== "search"}
          className="h-full"
        >
          {search}
        </div>
      </div>
    </div>
  );
}
