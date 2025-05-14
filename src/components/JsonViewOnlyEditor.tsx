"use client";

import { useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useIsMobile } from "@/hooks/useResponsive";

type Monaco = typeof import("monaco-editor");

interface JsonViewOnlyEditorProps {
  data: Record<string, unknown> | unknown;
  height?: string;
}

export default function JsonViewOnlyEditor({ data, height = "400px" }: JsonViewOnlyEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Use isMobile hook to determine font size
  const isMobile = useIsMobile();

  // Format the JSON with indentation for better readability
  const formattedJson = JSON.stringify(data, null, 2);

  // Handle editor mounting
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <div className="h-[400px]" style={{ height }}>
      <Editor
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
    </div>
  );
}
