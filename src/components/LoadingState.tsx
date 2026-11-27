import Image from "next/image";

/** Shown while a page or a part of it loads: the Sourcify logo (without the name) that bounces. */
export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12" role="status">
      {/* With "reduce motion" the logo stays still */}
      <Image
        src="/sourcify.png"
        alt=""
        width={48}
        height={48}
        priority
        className="h-12 w-12 animate-bounce motion-reduce:animate-none"
      />
      <p className="mt-4 text-gray-600">Loading contract data...</p>
    </div>
  );
}
