import type Transport from "@ledgerhq/hw-transport";
import type { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import MimbleWimbleCoin from "./hw-app-mimblewimble-coin";

import Common from "./api/common";
import Crypto from "./api/crypto";
import Ed25519 from "@nicolasflamel/ed25519-wasm";
import Secp256k1Zkp from "@nicolasflamel/secp256k1-zkp-wasm";
import Smaz from "@nicolasflamel/smaz-wasm";
import X25519 from "@nicolasflamel/x25519-wasm";

export default async (
  transport: Transport,
  {
    currency,
    path,
    verify
  }: {
    currency: CryptoCurrency;
    path: string;
    verify: boolean;
  }
): Promise<{
  address: string,
  path: string
}> => {
  console.log("Random: " + (await Crypto.randomBytes(32)).toString("hex"));
  console.log("AES decrypt: " + (await Crypto.aesDecrypt("AES-256-CBC", Buffer.alloc(32), Buffer.alloc(16), Buffer.from("049fd0102ef4c907f3579ae63a60b284", "hex"))).toString("hex"));
  console.log("Ed25519:" + (await Common.resolveIfPromise(Ed25519.publicKeyFromSecretKey(Buffer.alloc(32)))).toString("hex"));
  console.log("Secp256k1-zkp:" + (await Common.resolveIfPromise(Secp256k1Zkp.isValidSecretKey(Buffer.alloc(32)))));
  console.log("SMAZ:" + (await Common.resolveIfPromise(Smaz.compress(Buffer.from("test")))).toString("hex"));
  console.log("X25519:" + (await Common.resolveIfPromise(X25519.secretKeyFromEd25519SecretKey(Buffer.alloc(32)))).toString("hex"));
  const mimbleWimbleCoin = new MimbleWimbleCoin(transport, currency);
  const address = await mimbleWimbleCoin.getAddress(path, verify);
  return {
    address,
    path
  };
}
