// @flow
import React from "react";
import type { Account, AccountLike } from "@ledgerhq/types-live";
import type { Transaction, TransactionStatus } from "@ledgerhq/live-common/generated/types";
import WarnBox from "~/renderer/components/WarnBox";
import { Trans } from "react-i18next";
import { MimbleWimbleCoinTransactionWontHavePaymentProofNoRecipient, MimbleWimbleCoinTransactionWontHavePaymentProofInapplicableAddress } from "@ledgerhq/live-common/families/mimblewimble_coin/errors";

const warning = (
  {
    account,
    parentAccount,
    transaction,
    recipientWording,
    status
  }: {
    account: AccountLike,
    parentAccount: Account,
    transaction: Transaction,
    recipientWording: string,
    status: TransactionStatus
  }
) => {
  return (
    <WarnBox>
      {(status.warnings.recipient instanceof MimbleWimbleCoinTransactionWontHavePaymentProofNoRecipient || status.warnings.recipient instanceof MimbleWimbleCoinTransactionWontHavePaymentProofInapplicableAddress) ? (
        <Trans i18nKey="families.mimblewimble_coin.noPaymentProof" />
      ) : (
        <Trans i18nKey="families.mimblewimble_coin.verifyRecipientPaymentProofAddress" />
      )}
    </WarnBox>
  );
};

export default {
  warning
};
