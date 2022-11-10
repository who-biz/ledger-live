import type { MimbleWimbleCoinResources, MimbleWimbleCoinResourcesRaw } from "./types";
import RecentHeight from "./api/recentHeight";
import Identifier from "./api/identifier";
import BigNumber from "bignumber.js";

export const toMimbleWimbleCoinResourcesRaw = (
  mimbleWimbleCoinResources: MimbleWimbleCoinResources
): MimbleWimbleCoinResourcesRaw => {
  const {
    rootPublicKey,
    recentHeights,
    nextIdentifier,
    nextTransactionSequenceNumber
  } = mimbleWimbleCoinResources;
  return {
    rootPublicKey: rootPublicKey.toString("hex"),
    recentHeights: recentHeights.map((
      recentHeight: RecentHeight
    ): {
      height: string,
      hash: string
    } => {
      return {
        height: recentHeight.height.toFixed(),
        hash: recentHeight.hash.toString("hex")
      }
    }),
    nextIdentifier: nextIdentifier.serialize().toString("hex"),
    nextTransactionSequenceNumber
  };
};

export const fromMimbleWimbleCoinResourcesRaw = (
  mimbleWimbleCoinResources: MimbleWimbleCoinResourcesRaw
): MimbleWimbleCoinResources => {
  const {
    rootPublicKey,
    recentHeights,
    nextIdentifier,
    nextTransactionSequenceNumber
  } = mimbleWimbleCoinResources;
  return {
    rootPublicKey: Buffer.from(rootPublicKey, "hex"),
    recentHeights: recentHeights.map((
      {
        height,
        hash
      }: {
        height: string;
        hash: string;
      }
    ): RecentHeight => {
      return new RecentHeight(new BigNumber(height), Buffer.from(hash, "hex"));
    }),
    nextIdentifier: new Identifier(Buffer.from(nextIdentifier, "hex")),
    nextTransactionSequenceNumber
  };
};
