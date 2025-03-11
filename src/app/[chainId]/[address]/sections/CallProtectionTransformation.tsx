import { Transformations, TransformationValues } from "@/types/contract";
import CopyToClipboard from "@/components/CopyToClipboard";

interface CallProtectionTransformationProps {
  transformations: Transformations;
  transformationValues: TransformationValues;
}

export default function CallProtectionTransformation({
  transformations,
  transformationValues,
}: CallProtectionTransformationProps) {
  const callProtectionTransformation = transformations.find((t) => t.reason === "callProtection");

  if (!callProtectionTransformation || !transformationValues.callProtection) {
    return null;
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="text-lg font-medium leading-6 text-gray-900 px-6 py-4">Call Protection</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Byte Offset
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{callProtectionTransformation.offset}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                <div className="flex items-center">
                  <span>{transformationValues.callProtection}</span>
                  <CopyToClipboard text={transformationValues.callProtection} className="ml-2" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
