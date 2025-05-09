import { NextRequest } from "next/server";
import { checkVerification } from "@/utils/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get("chainId");
  const address = searchParams.get("address");

  if (!chainId || !address) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const verified = await checkVerification(chainId, address);
    return Response.json({ verified });
  } catch (error) {
    console.error("Error checking verification:", error);
    return Response.json({ error: "Failed to check verification status" }, { status: 500 });
  }
}
