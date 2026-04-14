import {
  StorageLayoutData,
  VyperStorageLayout,
  isSolidityStorageLayout,
} from "@/types/contract";

interface StorageLayoutProps {
  storageLayout: StorageLayoutData | VyperStorageLayout;
}

export default function StorageLayout({ storageLayout }: StorageLayoutProps) {
  if (!storageLayout) return null;

  if (isSolidityStorageLayout(storageLayout)) {
    return <SolidityStorageLayout storageLayout={storageLayout} />;
  }

  return <VyperStorageLayoutTable storageLayout={storageLayout} />;
}

function SolidityStorageLayout({ storageLayout }: { storageLayout: StorageLayoutData }) {
  if (!storageLayout.types) return null;

  // Function to resolve type name from the types record
  const resolveTypeName = (type: string): string => {
    const typeInfo = storageLayout.types?.[type];
    if (!typeInfo) return type;

    if (typeInfo.key && typeInfo.value) {
      // Handle mappings
      const keyType = resolveTypeName(typeInfo.key);
      const valueType = resolveTypeName(typeInfo.value);
      return `mapping(${keyType} ⇒ ${valueType})`;
    }

    return typeInfo.label;
  };

  // Track background colors based on slot changes
  let currentSlot: string | null = null;
  let isCurrentSlotWhite = true;

  const getBackgroundColor = (slot: string) => {
    if (slot !== currentSlot) {
      currentSlot = slot;
      isCurrentSlotWhite = !isCurrentSlotWhite;
    }
    return isCurrentSlotWhite ? "bg-white" : "bg-gray-100";
  };

  return (
    <div className="overflow-x-auto rounded-lg shadow-md">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Slot
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Offset
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Bytes
            </th>

            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Label
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contract
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {storageLayout.storage.map((item, index) => {
            const typeInfo = storageLayout.types?.[item.type];
            const bgColor = getBackgroundColor(item.slot);

            return (
              <tr key={index} className={bgColor}>
                <td className="px-2 py-2 text-center whitespace-nowrap text-sm text-gray-500">{item.slot}</td>
                <td className="px-2 py-2 text-center whitespace-nowrap text-sm text-gray-500">{item.offset}</td>
                <td className="px-2 py-2 text-center whitespace-nowrap text-sm text-gray-500">
                  {typeInfo?.numberOfBytes || "N/A"}
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{item.label}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {resolveTypeName(item.type)}
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">{item.contract}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VyperStorageLayoutTable({ storageLayout }: { storageLayout: VyperStorageLayout }) {
  const entries = Object.entries(storageLayout).sort(([, a], [, b]) => a.slot - b.slot);

  if (entries.length === 0) return null;

  // Track background colors based on slot changes
  let currentSlot: number | null = null;
  let isCurrentSlotWhite = true;

  const getBackgroundColor = (slot: number) => {
    if (slot !== currentSlot) {
      currentSlot = slot;
      isCurrentSlotWhite = !isCurrentSlotWhite;
    }
    return isCurrentSlotWhite ? "bg-white" : "bg-gray-100";
  };

  return (
    <div className="overflow-x-auto rounded-lg shadow-md">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Slot
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              N Slots
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variable
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {entries.map(([name, entry]) => {
            const bgColor = getBackgroundColor(entry.slot);

            return (
              <tr key={name} className={bgColor}>
                <td className="px-2 py-2 text-center whitespace-nowrap text-sm text-gray-500">{entry.slot}</td>
                <td className="px-2 py-2 text-center whitespace-nowrap text-sm text-gray-500">{entry.n_slots}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{name}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">{entry.type}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
