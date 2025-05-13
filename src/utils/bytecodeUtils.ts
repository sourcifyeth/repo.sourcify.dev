import { keccak256 } from "@ethersproject/keccak256";
import { BytecodeData, ContractData } from "@/types/contract";
import semver from "semver";

/**
 * Calculates the library placeholder based on the fully qualified name (file:library)
 * The format differs between Solidity versions pre and post 0.5.0
 *
 * @param fqn Fully qualified name of the library (file:library)
 * @param isPreV050 Whether the contract uses a Solidity version < 0.5.0
 * @returns The placeholder string that will be in the bytecode
 */
export function calculateLibraryPlaceholder(fqn: string, isPreV050: boolean): string {
  if (isPreV050) {
    // Pre v0.5.0 format: '__' + fqn.padEnd(38, '_')
    const trimmedFQN = fqn.slice(0, 36); // in case the fqn is too long
    return "__" + trimmedFQN.padEnd(38, "_");
  } else {
    // Post v0.5.0 format: '__$' + keccak256(fqn).slice(2, 36) + '$__'
    const hash = keccak256(Buffer.from(fqn)).slice(2, 36);
    return "__$" + hash + "$__";
  }
}

/**
 * Processes bytecode data to insert library placeholders at the appropriate positions
 *
 * @param bytecodeData The bytecode data object containing the original bytecode and link references
 * @param compilerVersion The Solidity compiler version string
 * @returns The processed bytecode with library placeholders inserted
 */
export function insertLibraryPlaceholders(bytecodeData: BytecodeData, compilerVersion: string): string {
  if (!bytecodeData.recompiledBytecode || !bytecodeData.linkReferences) {
    return bytecodeData.recompiledBytecode;
  }

  // Check if compiler version is pre-0.5.0
  const isPreV050 = isPreVersion050(compilerVersion);

  let bytecodeWithPlaceholders = bytecodeData.recompiledBytecode;
  const linkReferences = bytecodeData.linkReferences;

  for (const file in linkReferences) {
    for (const lib in linkReferences[file]) {
      const references = linkReferences[file][lib];
      const fqn = `${file}:${lib}`;
      const placeholder = calculateLibraryPlaceholder(fqn, isPreV050);

      for (const ref of references) {
        // Calculate the position in the bytecode string
        const startPos = ref.start * 2 + 2; // Each byte is 2 hex chars, +2 for "0x" prefix
        const length = ref.length * 2;

        // Replace the segment with the placeholder
        bytecodeWithPlaceholders =
          bytecodeWithPlaceholders.substring(0, startPos) +
          placeholder +
          bytecodeWithPlaceholders.substring(startPos + length);
      }
    }
  }

  return bytecodeWithPlaceholders;
}

/**
 * Checks if the compiler version is pre-0.5.0
 * Uses semver for robust version comparison
 *
 * @param compilerVersion The compiler version string (e.g., "0.4.24+commit.e67f0147")
 * @returns True if the version is before 0.5.0, false otherwise
 */
function isPreVersion050(compilerVersion: string): boolean {
  // Normalize version for semver comparison
  // This handles various formats like "0.4.24+commit.e67f0147"
  const normalizedVersion = semver.coerce(compilerVersion);

  if (!normalizedVersion) {
    console.warn(`Failed to parse compiler version: ${compilerVersion}, defaulting to post-0.5.0 format`);
    return false;
  }

  // Use semver to compare versions
  return semver.lt(normalizedVersion, "0.5.0");
}

/**
 * Processes both creation and runtime bytecodes, inserting library placeholders
 *
 * @param contract The contract object containing creationBytecode, runtimeBytecode and compilation info
 * @returns An object with processed creation and runtime bytecodes
 */
export function processContractBytecodes(contract: ContractData): {
  processedCreationBytecode: string;
  processedRuntimeBytecode: string;
} {
  const compilerVersion = contract.compilation.compilerVersion;

  const processedCreationBytecode = insertLibraryPlaceholders(contract.creationBytecode, compilerVersion);

  const processedRuntimeBytecode = insertLibraryPlaceholders(contract.runtimeBytecode, compilerVersion);

  return {
    processedCreationBytecode,
    processedRuntimeBytecode,
  };
}
