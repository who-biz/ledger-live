import BigNumber from "bignumber.js";
import JsonRpc from "./jsonRpc";
import { MimbleWimbleCoinNoResponseFromRecipient, MimbleWimbleCoinUnsupportedResponseFromRecipient } from "../errors";

export default class WalletApi {

  private static readonly FOREIGN_API_VERSION = 2;

  private constructor() {
  }

  public static async getSupportedSlateVersions(
    url: string
  ): Promise<string[]> {
    const {
      foreign_api_version,
      supported_slate_versions
    } = await JsonRpc.sendRequest(url, WalletApi.getNoResponseError(), WalletApi.getInvalidResponseError(), false, "check_version");
    if(!(foreign_api_version instanceof BigNumber) || !foreign_api_version.isEqualTo(WalletApi.FOREIGN_API_VERSION)) {
      throw new MimbleWimbleCoinUnsupportedResponseFromRecipient("Unsupported foreign API version from recipient");
    }
    if(!Array.isArray(supported_slate_versions)) {
      throw new MimbleWimbleCoinUnsupportedResponseFromRecipient("Invalid supported slate versions from recipient");
    }
    return supported_slate_versions;
  }

  public static async getSerializedSlateResponse(
    url: string,
    serializedSlate: {[key: string]: any} | string
  ): Promise<{[key: string]: any} | string> {
    const serializedSlateResponse = await JsonRpc.sendRequest(url, WalletApi.getNoResponseError(), WalletApi.getInvalidResponseError(), false, "receive_tx", [serializedSlate, null, null]);
    return serializedSlateResponse;
  }

  private static getNoResponseError(): Error {
    return new MimbleWimbleCoinNoResponseFromRecipient("No response from recipient");
  }

  private static getInvalidResponseError(): Error {
    return new MimbleWimbleCoinUnsupportedResponseFromRecipient("Invalid response from recipient");
  }
}
