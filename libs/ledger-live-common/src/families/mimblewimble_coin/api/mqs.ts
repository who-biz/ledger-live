import Crypto from "./crypto";
import bs58check from "bs58check";
import Secp256k1Zkp from "@nicolasflamel/secp256k1-zkp-wasm";
import type { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import { MimbleWimbleCoinInvalidParameters } from "../errors";

export default class Mqs {

  public static readonly ADDRESS_LENGTH = 52;
  public static readonly VERSION_LENGTH = 2;

  private constructor() {
  }

  public static mqsAddressToPublicKey(
    mqsAddress: string,
    cryptocurrency: CryptoCurrency
  ): Buffer {
    const decodedAddress = bs58check.decode(mqsAddress);
    if(decodedAddress.length !== Mqs.VERSION_LENGTH + Crypto.SECP256K1_PUBLIC_KEY_LENGTH) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid MQS address");
    }
    const version = Mqs.getAddressVersion(cryptocurrency);
    if(!decodedAddress.subarray(0, Mqs.VERSION_LENGTH).equals(version)) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid MQS address");
    }
    if(!Secp256k1Zkp.isValidPublicKey(decodedAddress.subarray(Mqs.VERSION_LENGTH))) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid MQS address");
    }
    return decodedAddress.subarray(Mqs.VERSION_LENGTH);
  }

  public static publicKeyToMqsAddress(
    publicKey: Buffer,
    cryptocurrency: CryptoCurrency
  ): string {
    if(!Secp256k1Zkp.isValidPublicKey(publicKey)) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid public key");
    }
    const version = Mqs.getAddressVersion(cryptocurrency);
    const buffer = Buffer.alloc(Mqs.VERSION_LENGTH + Crypto.SECP256K1_PUBLIC_KEY_LENGTH);
    version.copy(buffer, 0);
    publicKey.copy(buffer, Mqs.VERSION_LENGTH);
    return bs58check.encode(buffer);
  }

  private static getAddressVersion(
    cryptocurrency: CryptoCurrency
  ): Buffer {
    switch(cryptocurrency.id) {
      case "mimblewimble_coin":
        return Buffer.from([1, 69]);
      case "mimblewimble_coin_floonet":
        return Buffer.from([1, 121]);
      default:
        throw new MimbleWimbleCoinInvalidParameters("Invalid cryptocurrency");
    }
  }
}
