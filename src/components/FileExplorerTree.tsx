import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tree, NodeApi, TreeApi } from "react-arborist";
import { FaChevronDown, FaChevronRight, FaFolder, FaFolderOpen, FaFile, FaStar } from "react-icons/fa";
import { VscClose, VscFileSubmodule, VscInfo } from "react-icons/vsc";
import { FileNode } from "@/types/codeEditor";
import { OTHER_FILES_GROUP_ID } from "@/utils/fileExplorer";
import Image from "next/image";
import SolidityIcon from "@/assets/solidity.svg";
import VyperIcon from "@/assets/vyper.svg";
import FeIcon from "@/assets/fe.svg";

interface FileExplorerTreeProps {
  files: FileNode[];
  fileCount: number;
  activeFile?: string;
  onFileSelect: (filePath: string, content?: string) => void;
}

interface TreeNodeProps {
  node: NodeApi<FileNode>;
  style: React.CSSProperties;
  dragHandle?: (el: HTMLDivElement | null) => void;
}

const OTHER_FILES_TOOLTIP =
  "These files were in the compiler input, but the verified contract does not use them: the contract's metadata does not list them. They have no effect on the bytecode.";

const getFileIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "sol") {
    return <Image src={SolidityIcon} alt="Solidity" width={16} height={16} />;
  }
  if (extension === "vy") {
    return <Image src={VyperIcon} alt="Vyper" width={16} height={16} />;
  }
  if (extension === "fe") {
    return <Image src={FeIcon} alt="Fe" width={16} height={16} />;
  }
  return <FaFile className="w-4 h-4 text-gray-400" />;
};

const getFolderIcon = (isExpanded: boolean) => {
  return isExpanded ? (
    <FaFolderOpen className="w-4 h-4 text-gray-400" />
  ) : (
    <FaFolder className="w-4 h-4 text-gray-400" />
  );
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, style, dragHandle }) => {
  const isActive = node.isSelected;
  const isFolder = node.data.type === "folder";
  const isExpanded = node.isOpen;

  const handleClick = useCallback(() => {
    if (isFolder) {
      node.toggle();
    } else {
      node.select();
    }
  }, [isFolder, node]);

  // Safety check: don't render if node.data is undefined
  if (!node.data) {
    return null;
  }

  const { isOtherGroup, isTarget } = node.data;
  // Library code is dimmed, so that the project's own code stands out. The main
  // contract file is never dimmed, even if it is library code (for example an OpenZeppelin proxy).
  const isLibrary = node.data.isLibrary && !isTarget;
  const textColor = isActive ? "text-white" : isLibrary || isOtherGroup ? "text-gray-500" : "text-gray-300";

  return (
    <div
      ref={dragHandle}
      style={{
        ...style,
        backgroundColor: isActive ? "#2a2a2a" : "transparent",
      }}
      className={`flex items-center py-1 px-2 cursor-pointer transition-colors ${textColor} ${
        isOtherGroup ? "border-t border-gray-700" : ""
      }`}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "#1f1f1f";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
      onClick={handleClick}
    >
      {/* Chevron for folders */}
      {isFolder && (
        <div className="mr-1">
          {isExpanded ? (
            <FaChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <FaChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </div>
      )}

      {/* Spacer for files */}
      {!isFolder && <div className="w-4 md:mr-1" />}

      {/* Icon */}
      <div className={`mr-1 ${isLibrary && !isActive ? "opacity-60" : ""}`}>
        {isOtherGroup ? (
          <VscFileSubmodule className="w-4 h-4 text-gray-400" />
        ) : isFolder ? (
          getFolderIcon(isExpanded)
        ) : (
          getFileIcon(node.data.name)
        )}
      </div>

      {/* File/Folder name */}
      <span className={`text-xs md:text-sm truncate ${isOtherGroup ? "italic" : ""}`} title={node.data.path || node.data.name}>
        {node.data.name}
      </span>

      {isOtherGroup && (
        <>
          <span className="ml-1.5 shrink-0 rounded-full bg-gray-700 px-1.5 text-[10px] text-gray-300">
            {node.data.fileCount}
          </span>
          <span
            className="ml-1 shrink-0 text-gray-400 hover:text-white"
            data-tooltip-id="global-tooltip"
            data-tooltip-content={OTHER_FILES_TOOLTIP}
            aria-label={OTHER_FILES_TOOLTIP}
            role="img"
          >
            <VscInfo className="w-3.5 h-3.5" />
          </span>
        </>
      )}

      {!isFolder && isLibrary && !node.data.isTarget && (
        <span
          className="ml-auto shrink-0 rounded border border-gray-600 px-1 text-[9px] uppercase tracking-wide text-gray-500"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Library code (a dependency of the project)"
        >
          lib
        </span>
      )}

      {node.data.isTarget && (
        <span
          className="w-4 h-4 text-yellow-500 ml-auto shrink-0"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Compilation target file"
        >
          <FaStar className="w-4 h-4 text-yellow-500" />
        </span>
      )}
    </div>
  );
};

// A filter matches files whose full path contains the text (any case)
const matchesFilter = (node: NodeApi<FileNode>, term: string) =>
  node.data.type === "file" && node.data.path.toLowerCase().includes(term.toLowerCase());

const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({ files, fileCount, activeFile, onFileSelect }) => {
  const treeRef = useRef<TreeApi<FileNode>>(null);
  const [filter, setFilter] = useState("");

  // react-arborist needs a height in pixels: use the height of the box around the tree
  const treeBoxRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState(500);
  useEffect(() => {
    const box = treeBoxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.floor(entry.contentRect.height);
      if (height > 0) setTreeHeight(height);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Show the open file in the tree, also if it is inside a closed folder or group
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree || !activeFile || !tree.get(activeFile)) return;
    tree.openParents(activeFile);
    tree.scrollTo(activeFile);
  }, [activeFile]);

  const handleSelect = useCallback(
    (nodes: NodeApi<FileNode>[]) => {
      if (nodes.length > 0) {
        const node = nodes[0];
        if (node.data && node.data.type === "file") {
          onFileSelect(node.data.path, node.data.content);
        }
      }
    },
    [onFileSelect]
  );

  return (
    // The sidebar around it shows the "Explorer" title and sets the height
    <div className="bg-gray-800 text-gray-300 h-full flex flex-col">
      <div className="px-2 pt-2 pb-1.5 border-b border-gray-700">
        <div className="flex items-center rounded border border-gray-600 bg-gray-900 focus-within:border-cyan-500">
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filter) {
                event.preventDefault();
                setFilter("");
              }
            }}
            placeholder={`Filter ${fileCount} ${fileCount === 1 ? "file" : "files"}`}
            aria-label="Filter files by path"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent px-2 py-1 text-xs text-gray-100 placeholder-gray-500 outline-none"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear the filter"
              className="mx-0.5 p-0.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer"
            >
              <VscClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div ref={treeBoxRef} className="flex-1 min-h-0 px-2">
        <Tree
          ref={treeRef}
          data={files}
          openByDefault={true}
          initialOpenState={{ [OTHER_FILES_GROUP_ID]: false }}
          width="100%"
          height={treeHeight}
          indent={8}
          rowHeight={24}
          overscanCount={5}
          onSelect={handleSelect}
          selection={activeFile}
          searchTerm={filter}
          searchMatch={matchesFilter}
          paddingBottom={24}
        >
          {TreeNode}
        </Tree>
      </div>
    </div>
  );
};

export default FileExplorerTree;
