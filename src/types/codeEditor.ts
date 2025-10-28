export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  isOpen?: boolean;
  children?: Record<string, FileNode> | FileNode[];
  content?: string;
  isTarget?: boolean;
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

