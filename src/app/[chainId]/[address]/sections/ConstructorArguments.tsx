import ToggledRawCodeView from "@/components/ToggledRawCodeView";
import { AbiItem, TransformationValues } from "@/types/contract";
import { defaultAbiCoder as abiCoder, ParamType } from "@ethersproject/abi";

interface ConstructorArgumentsProps {
  constructorArguments: TransformationValues["constructorArguments"];
  abi: AbiItem[];
}

export default function ConstructorArguments({ constructorArguments, abi }: ConstructorArgumentsProps) {
  const constructorAbiParamInputs = abi?.find((param) => param.type === "constructor")?.inputs as ParamType[];

  if (!constructorAbiParamInputs || !constructorArguments) {
    console.error("No constructor abi param inputs or constructor arguments found");
    return null;
  }

  const decodedArguments = abiCoder.decode(constructorAbiParamInputs, constructorArguments);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="md:text-lg text-base font-medium leading-6 text-gray-900 md:px-6 px-3 md:py-4 py-2">
        Constructor Arguments
      </h3>
      <div className="px-3 md:px-6 pb-4">
        <ToggledRawCodeView
          data1={{
            name: "Raw",
            value: constructorArguments || "",
          }}
          data2={{
            name: "Decoded",
            value: JSON.stringify(
              Object.fromEntries(Object.entries(decodedArguments).filter(([key]) => isNaN(Number(key)))),
              null,
              2
            ),
            notBytes: true,
          }}
          tooltipContent="Decoded via @ethersproject/abi decoder"
        />
      </div>
    </div>
  );
}
