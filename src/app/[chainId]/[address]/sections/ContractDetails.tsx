import { ReactNode } from "react";
import { ContractPageData } from "@/types/contract";
import { BlockExplorer, formatTimestamp } from "@/utils/api";
import { formatSourceHash } from "@/utils/sourceHash";
import CopyToClipboard from "@/components/CopyToClipboard";
import ExplorerLinks from "@/components/ExplorerLinks";
import LanguageIcon from "@/components/LanguageIcon";
import InfoTooltip from "@/components/InfoTooltip";
import { createLibraryPathCheck } from "@/utils/libraryFiles";
import { hexByteLength, INITCODE_SIZE_LIMIT, lineStats, RUNTIME_SIZE_LIMIT } from "@/utils/codeStats";

interface ContractDetailsProps {
  contract: ContractPageData;
  explorers?: BlockExplorer[];
}

/** `0x87c343…6913d1f`: the start and the end of a long hex value. People compare those parts. */
function shortHex(value: string, head = 6, tail = 6): string {
  if (value.length <= 2 + head + tail + 1) return value;
  return `${value.slice(0, 2 + head)}…${value.slice(-tail)}`;
}

/** "4 months ago", from the time of the server render. */
function timeAgo(timestamp: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(timestamp).getTime()) / 1000);
  const units: Array<[string, number]> = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

const formatNumber = (value: string | number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : String(value);
};

/** A file path that wraps after a "/" (and inside a part only if one part is wider than the line). */
function FilePath({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <span className="[overflow-wrap:anywhere]">
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </span>
      ))}
    </span>
  );
}

function Unknown() {
  return <span className="italic text-gray-500">Unknown</span>;
}

/** A long hex value: shortened, the full value on hover, a copy button, and explorer links. */
function HexValue({ value, explorers, path }: { value: string; explorers: BlockExplorer[]; path: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono" data-tooltip-id="global-tooltip" data-tooltip-content={value}>
          {shortHex(value)}
        </span>
        <CopyToClipboard text={value} />
      </span>
      <ExplorerLinks explorers={explorers} path={path} />
    </span>
  );
}

/** One bytecode size against its limit: the bytes, the share of the limit, and an (i) that names the rule. */
function SizeLine({ label, bytes, limit, rule }: { label: string; bytes: number; limit: number; rule: string }) {
  // Round down: 24,535 of 24,576 bytes is under the limit, so it shows 99%, not 100%
  const percent = Math.floor((bytes / limit) * 100);
  return (
    <div className="grid grid-cols-[4.5rem_auto_auto] items-center justify-start gap-x-2">
      <span className="text-gray-600">{label}</span>
      <span className="tabular-nums">{formatNumber(bytes)} bytes</span>
      <span className="inline-flex items-center gap-1 tabular-nums text-gray-600">
        {percent}%
        <InfoTooltip
          content={`${formatNumber(bytes)} of ${formatNumber(limit)} bytes: the ${rule} limit on Ethereum. Other chains can have other limits.`}
          iconClassName="text-base text-gray-400 hover:text-gray-600"
        />
      </span>
    </div>
  );
}

function Card({ title, rows }: { title: string; rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">{title}</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-gray-600">{label}</dt>
            <dd className="min-w-0 text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The facts about a verified contract, in three groups: the contract itself,
 * how it was compiled, and how it was deployed.
 */
export default function ContractDetails({ contract, explorers = [] }: ContractDetailsProps) {
  const { compilation, deployment } = contract;
  const settings = compilation.compilerSettings as {
    evmVersion?: string;
    viaIR?: boolean;
    optimizer?: { enabled?: boolean; runs?: number };
    optimize?: string | boolean;
  };
  const isSolidity = compilation.language.toLowerCase() === "solidity";

  // The main file is the part of the fully qualified name before the last ":"
  const mainFile = compilation.fullyQualifiedName.slice(0, compilation.fullyQualifiedName.lastIndexOf(":"));
  const fileCount = Object.keys(contract.sources ?? {}).length;

  // Lines of the compiled files (all files if the compiled list is unknown); own files versus library files
  const remappings = compilation.compilerSettings?.remappings as string[] | undefined;
  const lines = lineStats(
    contract.sources ?? {},
    createLibraryPathCheck(remappings ?? []),
    mainFile,
    contract.sourceIds ? new Set(Object.keys(contract.sourceIds)) : undefined
  );

  // Sizes: the on-chain code if there is one, else the recompiled code. The on-chain creation code is the
  // whole initcode of the deployment (with constructor arguments), which is what EIP-3860 limits.
  const runtimeBytes = hexByteLength(
    contract.runtimeBytecode?.onchainBytecode || contract.runtimeBytecode?.recompiledBytecode
  );
  const creationBytes = hexByteLength(
    contract.creationBytecode?.onchainBytecode || contract.creationBytecode?.recompiledBytecode
  );

  const [version, commit] = compilation.compilerVersion.split("+");

  let optimizer: ReactNode;
  if (isSolidity) {
    optimizer = settings.optimizer?.enabled
      ? `On, ${formatNumber(settings.optimizer.runs ?? 200)} runs`
      : "Off";
  } else if (settings.optimize !== undefined) {
    optimizer = String(settings.optimize);
  } else {
    optimizer = <span className="text-gray-600">compiler default</span>;
  }

  const contractRows = [
    { label: "Name", value: <span className="font-medium">{compilation.name}</span> },
    {
      label: "Main file",
      value: mainFile ? (
        <a
          href={formatSourceHash({ file: mainFile, symbol: compilation.name })}
          className="text-cerulean-blue-600 hover:underline"
          data-tooltip-id="global-tooltip"
          data-tooltip-content={`Open ${compilation.name} in the source code`}
        >
          <FilePath path={mainFile} />
        </a>
      ) : (
        <Unknown />
      ),
    },
    {
      label: "Files",
      value: (
        <span
          data-tooltip-id="global-tooltip"
          data-tooltip-content={`${contract.sourceIds ? "The compiled files. " : ""}Library files: node_modules, lib/, @scope/ folders and remapped library paths.`}
        >
          {formatNumber(lines.files.total)}
          {fileCount > lines.files.total && " compiled"}
          {lines.files.library > 0 && (
            <span className="text-gray-600">
              {" "}
              · {formatNumber(lines.files.own)} own · {formatNumber(lines.files.library)} library
            </span>
          )}
          {fileCount > lines.files.total && (
            <span className="text-gray-600"> · {formatNumber(fileCount - lines.files.total)} not compiled</span>
          )}
        </span>
      ),
    },
    {
      label: "Lines",
      value: (
        <span
          data-tooltip-id="global-tooltip"
          data-tooltip-content={`Lines in the ${contract.sourceIds ? "compiled " : ""}files. Library files: node_modules, lib/, @scope/ folders and remapped library paths.`}
        >
          {formatNumber(lines.total)}
          {lines.library > 0 && (
            <span className="text-gray-600">
              {" "}
              · {formatNumber(lines.own)} own · {formatNumber(lines.library)} library
            </span>
          )}
        </span>
      ),
    },
    {
      label: "Verified",
      value: (
        <span data-tooltip-id="global-tooltip" data-tooltip-content={formatTimestamp(contract.verifiedAt)}>
          {formatTimestamp(contract.verifiedAt).slice(0, 10)}{" "}
          <span className="text-gray-600">({timeAgo(contract.verifiedAt)})</span>
        </span>
      ),
    },
  ];

  const compilationRows = [
    {
      label: "Language",
      value: (
        <span className="inline-flex h-5 items-center gap-1.5 align-top">
          <LanguageIcon language={compilation.language} size={16} />
          {compilation.language}
        </span>
      ),
    },
    {
      label: "Compiler",
      value: (
        <span data-tooltip-id="global-tooltip" data-tooltip-content={compilation.compilerVersion}>
          {compilation.compiler} {version}
          {commit && <span className="text-gray-500"> +{commit.replace(/^commit\./, "").slice(0, 8)}</span>}
        </span>
      ),
    },
    {
      label: "EVM version",
      value: settings.evmVersion ?? <span className="text-gray-600">compiler default</span>,
    },
    { label: "Optimizer", value: optimizer },
    ...(isSolidity ? [{ label: "Via IR", value: settings.viaIR ? "On" : "Off" }] : []),
    ...(runtimeBytes || creationBytes
      ? [
          {
            label: "Code Size",
            value: (
              <div className="flex flex-col gap-1">
                {runtimeBytes > 0 && (
                  <SizeLine label="Runtime" bytes={runtimeBytes} limit={RUNTIME_SIZE_LIMIT} rule="EIP-170" />
                )}
                {creationBytes > 0 && (
                  <SizeLine label="Creation" bytes={creationBytes} limit={INITCODE_SIZE_LIMIT} rule="EIP-3860" />
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const deploymentRows = [
    {
      label: "Deployer",
      value: deployment?.deployer ? (
        <HexValue value={deployment.deployer} explorers={explorers} path={`address/${deployment.deployer}`} />
      ) : (
        <Unknown />
      ),
    },
    {
      label: "Transaction",
      value: deployment?.transactionHash ? (
        <HexValue value={deployment.transactionHash} explorers={explorers} path={`tx/${deployment.transactionHash}`} />
      ) : (
        <Unknown />
      ),
    },
    {
      label: "Block",
      value: deployment?.blockNumber ? (
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <span>
            {formatNumber(deployment.blockNumber)}
            {deployment.transactionIndex != null && (
              <span
                className="text-gray-600"
                data-tooltip-id="global-tooltip"
                data-tooltip-content="The position of the deployment transaction in the block"
              >
                {" "}
                · tx #{deployment.transactionIndex}
              </span>
            )}
          </span>
          <ExplorerLinks explorers={explorers} path={`block/${deployment.blockNumber}`} />
        </span>
      ) : (
        <Unknown />
      ),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Contract" rows={contractRows} />
      <Card title="Compilation" rows={compilationRows} />
      <Card title="Deployment" rows={deploymentRows} />
    </div>
  );
}
