// @flow
import React, { useCallback } from "react";
import { Trans } from "react-i18next";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import type { Account } from "@ledgerhq/types-live";
import type { Transaction, TransactionStatus } from "@ledgerhq/live-common/generated/types";
import Box from "~/renderer/components/Box";
import Label from "~/renderer/components/Label";
import Switch from "~/renderer/components/Switch";

type Props = {
  account: Account,
  transaction: Transaction,
  status: TransactionStatus,
  onChange: Transaction => void
};

const SendRecipientFields = (
  props: Props
) => {
  const {
    account,
    transaction,
    onChange
  } = props;
  const onChangeSendAsFile = useCallback((
    sendAsFile: boolean
  ) => {
    const bridge = getAccountBridge(account);
    onChange(bridge.updateTransaction(transaction, {
      sendAsFile
    }));
  }, [account, onChange, transaction]);
  return (
    <Box flow={1} horizontal alignItems="center">
      <Label mr={2}>
        <Trans i18nKey="families.mimblewimble_coin.sendAsFile" />
      </Label>
      <Switch
        isChecked={transaction.sendAsFile}
        onChange={onChangeSendAsFile}
      />
    </Box>
  );
};

export default {
  component: SendRecipientFields,
  fields: ["sendAsFile"]
};
