/**
 * The public IPFS gateway for "View on IPFS" links. ipfs.io (and dweb.link,
 * w3s.link) answer 429 since they moved to a service worker gateway; Filebase
 * serves the files directly. Checked 2026-10-22 with a contract metadata CID.
 */
export const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";

export const ipfsGatewayUrl = (cid: string) => `${IPFS_GATEWAY}${cid}`;
