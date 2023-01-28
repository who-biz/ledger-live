import React, { useCallback } from "react";
import i18next from "i18next";
import { useTheme } from "styled-components/native";
import { ScreenName } from "../../const";
import Scanner from "../../components/Scanner";
import HeaderRightClose from "../../components/HeaderRightClose";
import TransparentHeaderNavigationOptions from "../../navigation/TransparentHeaderNavigationOptions";

const HeaderRight = () => {
  const { colors } = useTheme();
  return <HeaderRightClose color={colors.white} preferDismiss={false} />;
};

type Props = {
  navigation;
  route: {
    params;
  };
};

function MimbleWimbleCoinScanTransactionData({ navigation, route }: Props) {
  const onResult = useCallback(
    (result: string) => {
      navigation.navigate(ScreenName.ReceiveConfirmation, {
        ...route.params,
        transactionData: result,
      });
    },
    [route.params, navigation],
  );
  return <Scanner onResult={onResult} />;
}

const options = {
  ...TransparentHeaderNavigationOptions,
  title: i18next.t("send.scan.title"),
  headerRight: () => {
    return <HeaderRight />;
  },
  headerLeft: null,
};

export { MimbleWimbleCoinScanTransactionData as component, options };
