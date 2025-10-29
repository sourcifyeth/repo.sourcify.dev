import React, { useCallback } from 'react';
import { FaEthereum, FaStar, FaTimes } from 'react-icons/fa';
import { TabData } from '@/types/codeEditor';

interface CodeEditorTabsProps {
  tabs: TabData[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseAll?: () => void;
}

const CodeEditorTabs: React.FC<CodeEditorTabsProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCloseAll,
}) => {
  const handleTabClick = useCallback((tabId: string) => {
    onTabSelect(tabId);
  }, [onTabSelect]);

  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  }, [onTabClose]);

  const handleCloseAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTabCloseAll) {
      onTabCloseAll();
    }
  }, [onTabCloseAll]);

  if (tabs.length === 0) {
    return (
      <div className={`flex items-center bg-gray-800 border-b border-gray-700 px-3 py-2`}>
        <span className="text-sm text-gray-400">No files open</span>
      </div>
    );
  }

  return (
    <div className="flex items-center bg-gray-800 border-b border-gray-700">
      <div className="flex items-center flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`
                flex items-center px-3 py-2 cursor-pointer border-r border-gray-700
                transition-colors duration-150 min-w-0 max-w-48
                ${isActive 
                  ? 'bg-gray-700 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                }
              `}
              onClick={() => handleTabClick(tab.id)}
              title={tab.path}
            >
              {/* File Icon */}
              <div className="mr-2 flex-shrink-0">
                <FaEthereum className="w-3 h-3 text-blue-500" />
              </div>
              
              {/* File Name */}
              <span className="text-sm truncate mr-2" title={tab.path}>
                {tab.name}
              </span>

              {tab.isTargetContract && (
                <span className="w-3 h-3 text-yellow-500 ml-auto"
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content="Compilation target contract"
                >
                  <FaStar className="w-3 h-3 text-yellow-500" />
                </span>
              )}
              
              {/* Dirty indicator */}
              {tab.isDirty && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 flex-shrink-0" />
              )}
              
              {/* Close button - hide for default tab */}
              {!tab.isDefault && (
                <button
                  className="flex-shrink-0 p-1 rounded hover:bg-gray-600 transition-colors"
                  onClick={(e) => handleTabClose(e, tab.id)}
                  title="Close tab"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Close All button (only show if there are non-default tabs) */}
      {tabs.some(tab => !tab.isDefault) && onTabCloseAll && (
        <div className="px-2 border-l border-gray-700">
          <button
            className="p-1 rounded hover:bg-gray-600 transition-colors text-gray-400 hover:text-white"
            onClick={handleCloseAll}
            title="Close all tabs"
          >
            <FaTimes className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CodeEditorTabs;
