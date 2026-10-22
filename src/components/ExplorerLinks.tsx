import { FiExternalLink } from "react-icons/fi";
import { BlockExplorer } from "@/utils/api";

/**
 * Small links to the same item on each block explorer of the chain.
 * `path` is the explorer path, for example `tx/0x…`, `address/0x…` or `block/123`.
 */
export default function ExplorerLinks({ explorers = [], path }: { explorers?: BlockExplorer[]; path: string }) {
  if (explorers.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-xs">
      {explorers.map((explorer) => (
        <a
          key={explorer.name}
          href={`${explorer.url}/${path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-cerulean-blue-600 hover:text-cerulean-blue-800 hover:underline"
        >
          {explorer.name}
          <FiExternalLink className="h-3 w-3" />
        </a>
      ))}
    </span>
  );
}
