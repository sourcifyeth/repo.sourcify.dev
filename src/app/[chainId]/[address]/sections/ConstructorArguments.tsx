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
    <div>
      <h3 className="text-base font-semibold text-gray-800 mt-2">Constructor Arguments</h3>
      <p className="text-gray-700 mb-2 text-sm">
        These are the arguments passed to the contract&apos;s constructor during deployment, in the onchain creation
        bytecode.
      </p>
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
  );
}
