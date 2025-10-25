import { useState, useCallback, useRef } from 'react';
import { TabData } from '@/types/codeEditor';

interface UseCodeEditorTabsProps {
  initialFiles: Record<string, { content: string }>;
}

export const useCodeEditor = ({ initialFiles }: UseCodeEditorTabsProps) => {
  const fileNames = Object.keys(initialFiles);
  const firstFileName = fileNames[0];
  
  const [tabs, setTabs] = useState<TabData[]>(() => {
    if (firstFileName) {
      return [{
        id: 'tab-default',
        name: firstFileName.split('/').pop() || firstFileName,
        path: firstFileName,
        content: initialFiles[firstFileName].content,
        isDirty: false,
        isDefault: true
      }];
    }
    return [];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(
    firstFileName ? 'tab-default' : null
  );

  const tabCounterRef = useRef(1); // Start from 1 since we have a default tab

  // Create a new tab
  const openTab = useCallback((filePath: string, content: string) => {
    const fileName = filePath.split('/').pop() || filePath;
    
    setTabs(prev => {
      // Check if tab already exists
      const existingTab = prev.find(tab => tab.path === filePath);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return prev;
      }

      // Create new tab
      const newTab: TabData = {
        id: `tab-${tabCounterRef.current++}`,
        name: fileName,
        path: filePath,
        content,
        isDirty: false,
        isDefault: false
      };

      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(tab => tab.id === tabId);
      
      // Prevent closing the default tab
      if (tabToClose?.isDefault) {
        return prev;
      }
      
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // If we're closing the active tab, switch to another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Switch to the next tab, or the previous one if we closed the last tab
          const currentIndex = prev.findIndex(tab => tab.id === tabId);
          const nextIndex = currentIndex < newTabs.length ? currentIndex : newTabs.length - 1;
          setActiveTabId(newTabs[nextIndex].id);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  // Close all tabs (except the default one)
  const closeAllTabs = useCallback(() => {
    setTabs(prev => {
      const defaultTab = prev.find(tab => tab.isDefault);
      if (defaultTab) {
        setActiveTabId(defaultTab.id);
        return [defaultTab];
      }
      return [];
    });
  }, []);

  // Switch to a tab
  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Update tab content (for when files are modified)
  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, isDirty: true }
        : tab
    ));
  }, []);

  // Get current active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    closeAllTabs,
    switchToTab,
    updateTabContent
  };
};
