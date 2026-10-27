"use client";

import { useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import "@/utils/monacoLoader";
import { useInView } from "@/hooks/useInView";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useIsMobile } from "@/hooks/useResponsive";

interface JsonViewOnlyEditorProps {
  data: Record<string, unknown> | unknown;
  height?: string;
}

export default function JsonViewOnlyEditor({ data, height = "400px" }: JsonViewOnlyEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // Each viewer is a full editor: start it only when it comes near the visible part of the page
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef);

  // Use isMobile hook to determine font size
  const isMobile = useIsMobile();

  // Format the JSON with indentation for better readability
  const formattedJson = inView ? JSON.stringify(data, null, 2) : "";

  // Handle editor mounting
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <div ref={containerRef} className="h-[400px] bg-[#1e1e1e]" style={{ height }}>
      {inView && (
        <MonacoEditor
          height="100%"
          language="json"
          value={formattedJson}
          options={{
            readOnly: true,
            minimap: { enabled: isMobile ? false : true },
            scrollBeyondLastLine: false,
            fontSize: isMobile ? 10 : 12,
            wordWrap: "on",
            automaticLayout: true,
            scrollbar: {
              useShadows: false,
              verticalHasArrows: true,
              horizontalHasArrows: true,
              vertical: "visible",
              horizontal: "visible",
              verticalScrollbarSize: 12,
              horizontalScrollbarSize: 12,
            },
            glyphMargin: true,
            folding: true,
            renderLineHighlight: "all",
            stickyScroll: {
              enabled: false,
            },
            lineNumbers: isMobile ? "off" : "on",
          }}
          onMount={handleEditorDidMount}
          theme="vs-dark"
        />
      )}
    </div>
  );
}
