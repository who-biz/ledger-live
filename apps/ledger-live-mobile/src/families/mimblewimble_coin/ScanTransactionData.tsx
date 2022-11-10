import React, { useCallback } from "react";
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
};

function MimbleWimbleCoinScanTransactionData(
  {
    navigation,
    route
  }: Props
) {
  const onResult = useCallback((
    result: string
  ) => {
    navigation.navigate(ScreenName.ReceiveConfirmation, {
      ...route.params,
      transactionData: result
    });
  }, [route.params, navigation]);
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
  MimbleWimbleCoinScanTransactionData as component,
  options
};
