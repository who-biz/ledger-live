import { Account, AccountRaw, Address, TransactionCommon, TransactionCommonRaw, TransactionStatusCommon, TransactionStatusCommonRaw } from "@ledgerhq/types-live";
import RecentHeight from "./api/recentHeight";
import Identifier from "./api/identifier";
import BigNumber from "bignumber.js";

export type MimbleWimbleCoinResources = {
  rootPublicKey: Buffer,
  recentHeights: RecentHeight[],
  nextIdentifier: Identifier,
  nextTransactionSequenceNumber: number
};

export type MimbleWimbleCoinResourcesRaw = {
  rootPublicKey: string,
  recentHeights: {
    height: string,
    hash: string
  }[],
  nextIdentifier: string,
  nextTransactionSequenceNumber: number
};

export type Transaction = TransactionCommon & {
  family: "mimblewimble_coin";
  sendAsFile: boolean;
  height: BigNumber | undefined;
  id: string | undefined;
  offset: Buffer | undefined;
  proof: Buffer | undefined;
  encryptedSecretNonce: Buffer | undefined;
  address: Address | undefined;
  identifier: Identifier | undefined;
  freshAddress: Address | undefined;
  transactionResponse: string | undefined;
  useDefaultBaseFee: boolean;
  baseFee: BigNumber;
  networkInfo: {};
};

export type TransactionRaw = TransactionCommonRaw & {
  family: "mimblewimble_coin";
  sendAsFile: boolean;
  height: string | undefined;
  id: string | undefined;
  offset: string | undefined;
  proof: string | undefined;
  encryptedSecretNonce: string | undefined;
  address: Address | undefined;
  identifier: string | undefined;
  freshAddress: Address | undefined;
  transactionResponse: string | undefined;
  useDefaultBaseFee: boolean;
  baseFee: string;
  networkInfo: {};
};

export type MimbleWimbleCoinAccount = Account & {
  mimbleWimbleCoinResources: MimbleWimbleCoinResources
};

export type MimbleWimbleCoinAccountRaw = AccountRaw & {
  mimbleWimbleCoinResources: MimbleWimbleCoinResourcesRaw;
};

export type TransactionStatus = TransactionStatusCommon;

export type TransactionStatusRaw = TransactionStatusCommonRaw;
