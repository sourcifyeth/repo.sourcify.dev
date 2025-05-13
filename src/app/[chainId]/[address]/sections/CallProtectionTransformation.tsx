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
      <h3 className="text-base md:text-lg font-medium leading-6 text-gray-900 md:px-6 px-3 md:py-4 py-2">
        Call Protection
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-[0.65rem] md:text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-3 md:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
              >
                Byte Offset
              </th>
              <th
                scope="col"
                className="px-3 md:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
              >
                Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-3 md:px-6 py-4 whitespace-nowrap font-mono">{callProtectionTransformation.offset}</td>
              <td className="px-3 md:px-6 py-4 whitespace-nowrap font-mono">
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
