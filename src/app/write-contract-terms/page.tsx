import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use: Read / Write Contract",
  description: "Terms of use for the Read / Write Contract feature of repo.sourcify.dev",
};

/** Change this date when the text changes (point 9). */
const LAST_CHANGE = "23 November 2026";

/**
 * The short terms of the "Read / Write Contract" section (decision D8). Modelled on the terms of Louper,
 * Etherscan and Safe. The Argot Collective reviews the text before release.
 */
export default function TermsPage() {
  const points: Array<[string, React.ReactNode]> = [
    [
      "Free and as is",
      "This feature is free. It is provided “as is” and “as available”, without warranties of any kind. It can be unavailable, and it can show wrong data.",
    ],
    [
      "Verified does not mean safe",
      "A verified contract has source code that compiles to the bytecode on the chain. Sourcify does not audit contracts. Sourcify does not recommend or endorse any contract.",
    ],
    [
      "Your wallet, your transaction",
      "A write goes from your own wallet directly to the blockchain. Sourcify never holds or sees your private keys or funds. Sourcify does not send transactions for you. A sent transaction cannot be changed, cancelled or reversed.",
    ],
    [
      "Check before you sign",
      "Before you sign, check the network, the contract address, the function, the inputs and the value in your wallet. You are responsible for each transaction that you sign.",
    ],
    [
      "Data from third parties",
      "Read results come from public RPC providers listed by Chainlist, or from an RPC that you choose. Sourcify does not run these providers. Their answers can be late, incomplete or wrong. The page compares two providers to find differences, but it cannot prove that an answer is correct.",
    ],
    [
      "Privacy",
      "Your browser sends read calls directly to the RPC providers. They can see your IP address and the calls that you make. Your wallet is third-party software with its own terms.",
    ],
    ["No advice", "Nothing in this feature is financial, investment, legal or security advice."],
    [
      "Liability",
      "To the extent that the law allows, the Argot Collective and the Sourcify contributors are not liable for any loss from the use of this feature. This includes lost funds and gas fees.",
    ],
    ["Changes", "These terms can change. The date at the top shows the last change."],
  ];
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 md:text-3xl">Terms of use: Read / Write Contract</h1>
      <p className="mt-1 text-sm text-gray-500">Last change: {LAST_CHANGE}</p>
      <p className="mt-4 text-sm leading-6 text-gray-700">
        These terms apply when you use the Read / Write Contract section on the contract pages of repo.sourcify.dev.
      </p>
      <ol className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-5 shadow-sm md:px-6">
        {points.map(([title, text], i) => (
          <li key={title} className="py-4">
            <h2 className="text-base font-semibold text-gray-900">
              {i + 1}. {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-700">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
