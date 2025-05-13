interface CodeDisplayProps {
  value: string;
  className?: string;
}

export default function CodeDisplay({ value, className = "" }: CodeDisplayProps) {
  return (
    <div
      className={`w-full max-h-64 p-3 bg-gray-50 rounded text-[0.65rem] md:text-xs font-mono border border-gray-200 cursor-text break-words overflow-y-auto whitespace-pre-wrap ${className}`}
    >
      {value}
    </div>
  );
}
