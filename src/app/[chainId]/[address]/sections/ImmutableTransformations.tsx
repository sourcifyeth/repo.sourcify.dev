import { Transformations, TransformationValues } from "@/types/contract";

interface ImmutableTransformationsProps {
  transformations: Transformations;
  transformationValues: TransformationValues;
}

export default function ImmutableTransformations({
  transformations,
  transformationValues,
}: ImmutableTransformationsProps) {
  // Filter only immutable transformations and sort by offset
  const immutableTransformations = transformations
    .filter((t) => t.reason === "immutable")
    .sort((a, b) => a.offset - b.offset);

  // Group transformations by id to show offsets together
  const groupedTransformations = immutableTransformations.reduce((acc, t) => {
    if (!acc[t.id]) {
      acc[t.id] = [];
    }
    acc[t.id].push(t.offset);
    return acc;
  }, {} as Record<string, number[]>);

  // Sort offsets within each group
  Object.values(groupedTransformations).forEach((offsets) => offsets.sort((a, b) => a - b));

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="text-lg font-medium leading-6 text-gray-900 px-6 py-4">Immutable Transformations</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Value
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Offsets
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(groupedTransformations).map(([id, offsets]) => (
              <tr key={id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                  {transformationValues.immutables?.[id] || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{offsets.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
