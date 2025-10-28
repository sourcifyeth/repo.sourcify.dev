import { headers } from "next/headers";

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string;
  createdAt: string;
  updatedAt: string;
};

type TenantNetwork = {
  tenantId: string;
  tenantName: string;
  rpcUrl: string;
  chainId: number;
  displayName: string;
};

type Session = {
  id: string;
  userId: string;
  token: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: string;
  tenantNetworks: TenantNetwork[];
  createdAt: string;
  updatedAt: string;
};

export const fetchSession = async () => {
  const { get } = await headers();
  const response = await fetch(
    `${
      process.env.NODE_ENV === "production"
        ? "https://evm.walnut.dev"
        : "http://evm.walnut.local"
    }/api/auth/session`,
    { headers: { Cookie: get("cookie") ?? "" } }
  );
  const result = await response.json();
  if (result === null) {
    return null;
  }
  const { user, session } = result as { user: User; session: Session };
  return { user, session };
};
