import type { Account } from "@ledgerhq/types-live";
import type { Transaction } from "./types";
import BigNumber from "bignumber.js";
import estimateMaxSpendable from "./js-estimateMaxSpendable";

export const createTransaction = (
  account: Account
): Transaction => {
  return {
    family: "mimblewimble_coin",
    amount: new BigNumber(0),
    recipient: "",
    useAllAmount: false,
    sendAsFile: false,
    height: undefined,
    id: undefined,
    offset: undefined,
    proof: undefined,
    encryptedSecretNonce: undefined,
    transactionResponse: undefined
  };
};

export const updateTransaction = (
  transaction: Transaction,
  patch: Partial<Transaction>
): Transaction => {
  return {
    ...transaction,
    ...patch
  };
};

export const prepareTransaction = async (
  account: Account,
  transaction: Transaction
): Promise<Transaction> => {
  if(transaction.useAllAmount) {
    return {
      ...transaction,
      amount: await estimateMaxSpendable({
        account
      })
    };
  }
  return transaction;
};
