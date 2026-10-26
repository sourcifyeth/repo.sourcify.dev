"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { IoWarning } from "react-icons/io5";
import CopyToClipboardButton from "@/components/CopyToClipboardButton";
import DownloadFileButton from "@/components/DownloadFileButton";
import JsonViewOnlyEditor from "@/components/JsonViewOnlyEditor";
import { useInView } from "@/hooks/useInView";
import { LazyContractField } from "@/types/contract";

// One request per field and contract while the page is open, shared by remounts
const requests = new Map<string, Promise<unknown>>();

async function loadField(url: string, field: LazyContractField): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The Sourcify API answered ${response.status} ${response.statusText}`.trim());
  const body = (await response.json()) as Record<string, unknown>;
  return body[field] ?? null;
}

type LoadState =
  { status: "idle" | "loading" } | { status: "loaded"; data: unknown } | { status: "error"; message: string };

interface LazyJsonSectionProps {
  field: LazyContractField;
  chainId: string;
  address: string;
  serverUrl: string;
  // The title (and subtitle) of the section
  header: ReactNode;
  // The name part of the download file, for example "metadata"
  fileName: string;
  // If set, the field cannot exist for this contract: show this text and do not load it
  unavailableMessage?: string;
  // The text if the API has no value for the field
  emptyMessage?: string;
}

/**
 * A section with a large JSON value (metadata, Standard JSON Input or
 * Output). The page does not include the value: the browser loads it from
 * the Sourcify API when the section comes near the visible part of the page.
 * If the request fails, the section shows the error and a Retry button.
 */
export default function LazyJsonSection({
  field,
  chainId,
  address,
  serverUrl,
  header,
  fileName,
  unavailableMessage,
  emptyMessage = "No value found.",
}: LazyJsonSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // The delay skips sections that a smooth scroll only passes by
  const inView = useInView(sectionRef, { margin: "400px 0px", delay: 250 });
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const url = `${serverUrl}/v2/contract/${chainId}/${address}?fields=${field}`;

  const load = useCallback(() => {
    let request = requests.get(url);
    if (!request) {
      request = loadField(url, field);
      requests.set(url, request);
      // A failed request is not kept, so Retry sends a new one
      request.catch(() => requests.delete(url));
    }
    setState({ status: "loading" });
    request.then(
      (data) => setState({ status: "loaded", data }),
      (error: unknown) =>
        setState({
          status: "error",
          message:
            error instanceof Error && error.message !== "Failed to fetch"
              ? error.message
              : "The request did not reach the Sourcify API.",
        })
    );
  }, [url, field]);

  useEffect(() => {
    if (inView && !unavailableMessage && state.status === "idle") load();
  }, [inView, unavailableMessage, state.status, load]);

  const data = state.status === "loaded" ? state.data : null;

  let body: ReactNode;
  if (unavailableMessage) {
    body = <Notice>{unavailableMessage}</Notice>;
  } else if (state.status === "error") {
    body = (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-white p-6 text-sm text-gray-700"
      >
        <div className="flex items-center gap-2 text-red-700">
          <IoWarning className="h-4 w-4 flex-shrink-0" />
          <span>Could not load this section. {state.message}</span>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 shadow-sm hover:bg-gray-100 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  } else if (state.status === "loaded" && data === null) {
    body = <Notice>{emptyMessage}</Notice>;
  } else if (state.status === "loaded") {
    body = <JsonViewOnlyEditor data={data} />;
  } else {
    body = (
      <div
        className="flex h-[400px] items-center justify-center rounded bg-[#1e1e1e] text-sm text-gray-400"
        aria-busy="true"
      >
        {state.status === "loading" ? "Loading…" : ""}
      </div>
    );
  }

  return (
    <div ref={sectionRef}>
      <div className="bg-gray-100 py-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between">
          <div>{header}</div>
          {data !== null && (
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={data} />
              <DownloadFileButton data={data} fileName={fileName} chainId={chainId} address={address} />
            </div>
          )}
        </div>
      </div>
      {body}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg p-4">
      <div className="text-gray-700 text-sm">{children}</div>
    </div>
  );
}
