/**
 * Finds the symbols of source files away from the page's main thread, so that
 * parsing a large contract does not freeze the page. One message per file.
 */
import { parse } from "@solidity-parser/parser";
import { extractSymbols, FileSymbols, SourceLanguage } from "@/utils/sourceSymbols";

export interface SymbolsRequest {
  path: string;
  content: string;
  language: SourceLanguage;
}

export interface SymbolsResponse {
  path: string;
  result: FileSymbols;
}

self.onmessage = (event: MessageEvent<SymbolsRequest>) => {
  const { path, content, language } = event.data;
  const result = extractSymbols(content, language, (code, options) => parse(code, options));
  const response: SymbolsResponse = { path, result };
  self.postMessage(response);
};
