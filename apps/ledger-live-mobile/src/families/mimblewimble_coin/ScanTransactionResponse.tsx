import React, { useCallback } from "react";
import type { Transaction } from "@ledgerhq/live-common/families/mimblewimble_coin/types";
import { Account } from "@ledgerhq/types-live";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import { ScreenName } from "../../const";
import Scanner from "../../components/Scanner";
import i18next from "i18next";
import HeaderRightClose from "../../components/HeaderRightClose";
import TransparentHeaderNavigationOptions from "../../navigation/TransparentHeaderNavigationOptions";
import { useTheme } from "styled-components/native";

type Props = {
  navigation: any;
  route: {
    params: RouteParams;
  };
};

type RouteParams = {
  account: Account;
  transaction: Transaction;
};

function MimbleWimbleCoinScanTransactionResponse(
  {
    navigation,
    route
  }: Props
) {
  const { account, transaction } = route.params;
  const onResult = useCallback((
    result: string
  ) => {
    const bridge = getAccountBridge(account);
    navigation.navigate(ScreenName.SendConnectDevice, {
      ...route.params,
      accountId: account.id,
      transaction: bridge.updateTransaction(transaction, {
        transactionResponse: result
      })
    });
  }, [account, route.params, navigation, transaction]);
  return (
    <Scanner onResult={onResult} />
  );
}

const options = {
  ...TransparentHeaderNavigationOptions,
  title: i18next.t("send.scan.title"),
  headerRight: () => {
    const { colors } = useTheme();
    return (
      <HeaderRightClose color={colors.white} preferDismiss={false} />
     );
   },
   headerLeft: null
};

export {
  MimbleWimbleCoinScanTransactionResponse as component,
  options
};
