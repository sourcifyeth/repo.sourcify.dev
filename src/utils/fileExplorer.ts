import { FileNode } from '@/types/codeEditor';
import { SourceData } from '@/types/contract';

/**
 * Converts flat file paths into a hierarchical tree structure with IDs for library compatibility
 * @param sources - Object with file paths as keys and file content as values
 * @returns Array of ExtendedFileNode objects representing the tree structure
 */
export function buildFileTreeWithIds(sources: Record<string, SourceData>): FileNode[] {
  const root: Record<string, FileNode> = {};
  
  // Process each file path
  Object.entries(sources).forEach(([filePath, fileData]) => {
    const parts = filePath.split('/');
    let current = root;
    let currentPath = '';
    
    // Build the tree structure
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!current[part]) {
        current[part] = {
          id: currentPath, // Use path as ID
          name: part,
          type: isLast ? 'file' : 'folder',
          path: currentPath,
          isOpen: false,
          children: isLast ? undefined : {}
        };
      }
      
      // If it's a file, add the content
      if (isLast) {
        current[part].content = fileData.content;
      } else {
        // Move to the next level
        current = current[part].children as Record<string, FileNode>;
      }
    });
  });
  
  // Convert the root object to an array and ensure all children have IDs
  const convertToArray = (nodes: Record<string, FileNode>): FileNode[] => {
    return Object.values(nodes).map(node => ({
      ...node,
      children: node.children ? convertToArray(node.children as Record<string, FileNode>) : undefined
    }));
  };
  
  return convertToArray(root);
}
