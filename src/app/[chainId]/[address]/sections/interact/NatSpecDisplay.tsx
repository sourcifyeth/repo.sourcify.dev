"use client";

import { createContext, useContext } from "react";

/**
 * NatSpec notes (@notice, @dev, @param, @return) are hidden until the user asks for them: an open function
 * with notes has a "Show Docs" link, which shows the notes of that function. This context is true inside
 * a function whose docs are shown.
 */
export const FunctionDocsContext = createContext(false);

/** True if the NatSpec notes show here. */
export function useDocsShown(): boolean {
  return useContext(FunctionDocsContext);
}
