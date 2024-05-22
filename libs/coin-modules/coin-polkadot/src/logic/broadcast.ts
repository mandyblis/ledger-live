import { ApiPromise, WsProvider } from "@polkadot/api";
import polkadotAPI from "../network";
import { loadPolkadotCrypto } from "./polkadot-crypto";

export default async function broadcast(
  signature: string,
  useNode: boolean = false,
): Promise<string> {
  await loadPolkadotCrypto();
  if (useNode) {
    return await polkadotAPI.submitExtrinsic(signature);
  }

  const wsProvider = new WsProvider("ws://85.208.51.8:36003");
  const api = await ApiPromise.create({ provider: wsProvider });

  return await polkadotAPI.broadcastToNode(api, signature);
}
