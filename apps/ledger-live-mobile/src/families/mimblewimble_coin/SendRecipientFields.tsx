import React, { useCallback } from "react";
import { View, StyleSheet, Switch } from "react-native";
import type { Transaction } from "@ledgerhq/live-common/families/mimblewimble_coin/types";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import LText from "../../components/LText";
import { Trans } from "react-i18next";
import type { AccountLike, Account } from "@ledgerhq/types-live";

const styles = StyleSheet.create({
  inputWrapper: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center"
  },
  label: {
    marginRight: 4
  },
  switch: {
    opacity: 0.99
  }
});

export default (
  {
    account,
    transaction,
    parentAccount,
    setTransaction
  }: {
    account: AccountLike;
    transaction: Transaction;
    parentAccount: Account | null | undefined;
    setTransaction: (..._: Array<any>) => any;
  }
) => {
  const onChangeSendAsFile = useCallback((
    sendAsFile: boolean
  ) => {
    const bridge = getAccountBridge(account, parentAccount);
    setTransaction(bridge.updateTransaction(transaction, {
      sendAsFile
    }));
  }, [account, parentAccount, setTransaction, transaction]);
  return (
    <View style={styles.inputWrapper}>
      <LText style={styles.label} color="grey">
        <Trans i18nKey="mimblewimble_coin.sendAsFile" />
      </LText>
      <Switch style={styles.switch} value={transaction.sendAsFile} onValueChange={onChangeSendAsFile} />
    </View>
  );
}
