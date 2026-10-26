export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  isOpen?: boolean;
  children?: Record<string, FileNode> | FileNode[];
  content?: string;
  isTarget?: boolean;
  // Library code (dependencies such as OpenZeppelin). A folder is library code if all its files are.
  isLibrary?: boolean;
  // The group of files that the compiled contract does not use
  isOtherGroup?: boolean;
  // Number of files in a folder or group, shown next to the "Other files" group
  fileCount?: number;
}

export interface TabData {
  id: string;
  name: string;
  path: string;
  content: string;
  isDirty?: boolean;
  isDefault?: boolean;
  isTargetContract?: boolean;
}

