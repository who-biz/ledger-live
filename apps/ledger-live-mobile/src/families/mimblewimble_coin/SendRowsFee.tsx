import React from "react";
import { View, StyleSheet } from "react-native";
import type { AccountLike } from "@ledgerhq/types-live";
import type { TransactionStatus } from "@ledgerhq/live-common/families/mimblewimble_coin/types";
import { Trans } from "react-i18next";
import { getAccountUnit, getAccountCurrency } from "@ledgerhq/live-common/account/index";
import SummaryRow from "../../screens/SendFunds/SummaryRow";
import LText from "../../components/LText";
import CurrencyUnitValue from "../../components/CurrencyUnitValue";
import CounterValue from "../../components/CounterValue";

const styles = StyleSheet.create({
  amountContainer: {
    flexDirection: "column",
    alignItems: "flex-end"
  },
  valueText: {
    fontSize: 16
  },
  counterValueText: {
    fontSize: 12
  }
});

export default (
  {
    account,
    status
  }: {
    account: AccountLike;
    status: TransactionStatus;
  }
) => {
  const unit = getAccountUnit(account);
  const currency = getAccountCurrency(account);
  return (
    <SummaryRow title={<Trans i18nKey="send.fees.title" />} >
      <View style={styles.amountContainer}>
        <LText style={styles.valueText} semiBold>
          <CurrencyUnitValue unit={unit} value={status.estimatedFees} disableRounding />
        </LText>
        <LText style={styles.counterValueText} color="grey" semiBold>
          <CounterValue before="≈ " value={status.estimatedFees} currency={currency} showCode />
        </LText>
      </View>
    </SummaryRow>
  );
}
