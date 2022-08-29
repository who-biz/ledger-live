import type { AccountLike } from "@ledgerhq/types-live";
import type { Transaction } from "../../generated/types";
import invariant from "invariant";
import flatMap from "lodash/flatMap";

const inferTransactions = (
  transactions: {
    account: AccountLike,
    transaction: Transaction
  }[]
): Transaction[] => {
  return flatMap(transactions, ({
    transaction
  }: {
    transaction: Transaction;
  }): Transaction => {
    invariant(transaction.family === "mimblewimble_coin", "mimblewimble_coin family");
    return {
      ...transaction,
      family: "mimblewimble_coin",
      sendAsFile: false,
      height: undefined,
      id: undefined,
      offset: undefined,
      proof: undefined,
      encryptedSecretNonce: undefined,
      transactionResponse: undefined
    };
  });
};

export default {
  inferTransactions
};
