import React, { useCallback, useEffect, useRef } from 'react';
import { Tree, NodeApi, TreeApi } from 'react-arborist';
import {
  FaChevronDown,
  FaChevronRight,
  FaFolder,
  FaFolderOpen,
  FaFile,
  FaEthereum
} from 'react-icons/fa';
import { FileNode } from '@/types/codeEditor';

interface FileExplorerTreeProps {
  files: FileNode[];
  activeFile?: string;
  onFileSelect: (filePath: string, content?: string) => void;
}

interface TreeNodeProps {
  node: NodeApi<FileNode>;
  style: React.CSSProperties;
  dragHandle?: (el: HTMLDivElement | null) => void;
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'sol') {
    return <FaEthereum className="w-4 h-4 text-blue-500" />;
  }
  return <FaFile className="w-4 h-4 text-gray-400" />;
};

const getFolderIcon = (isExpanded: boolean) => {
  return isExpanded ?
    <FaFolderOpen className="w-4 h-4 text-gray-400" /> :
    <FaFolder className="w-4 h-4 text-gray-400" />;
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, style, dragHandle }) => {
  const isActive = node.isSelected;
  const isFolder = node.data.type === 'folder';
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

  return (
    <div
      ref={dragHandle}
      style={{
        ...style,
        backgroundColor: isActive ? '#2a2a2a' : 'transparent'
      }}
      className={`
        flex items-center py-1 px-2 cursor-pointer transition-colors
        ${isActive ? 'text-white' : 'text-gray-300'}
      `}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#1f1f1f';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
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
      {!isFolder && <div className="w-4 mr-1" />}

      {/* Icon */}
      <div className="mr-2">
        {isFolder ? getFolderIcon(isExpanded) : getFileIcon(node.data.name)}
      </div>

      {/* File/Folder name */}
      <span className="text-sm truncate" title={node.data.name}>
        {node.data.name}
      </span>
    </div>
  );
};

const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({
  files,
  activeFile,
  onFileSelect,
}) => {
  const treeRef = useRef<TreeApi<FileNode>>(null);

  const handleSelect = useCallback((nodes: NodeApi<FileNode>[]) => {
    if (nodes.length > 0) {
      const node = nodes[0];
      if (node.data && node.data.type === 'file') {
        onFileSelect(node.data.path, node.data.content);
      }
    }
  }, [onFileSelect]);

  return (
    <div className={`bg-gray-800 text-gray-300 min-h-60 md:min-h-[500px] max-h-60 md:max-h-[500px]`}>
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">EXPLORER</span>
          <button className="text-gray-400 hover:text-gray-200">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-50 md:max-h-[460px] overflow-y-auto">
        <Tree
          ref={treeRef}
          data={files}
          openByDefault={true}
          width="100%"
          height={500}
          indent={16}
          rowHeight={28}
          overscanCount={5}
          onSelect={handleSelect}
          selection={activeFile}
        >
          {TreeNode}
        </Tree>
      </div>
    </div>
  );
};

export default FileExplorerTree;
