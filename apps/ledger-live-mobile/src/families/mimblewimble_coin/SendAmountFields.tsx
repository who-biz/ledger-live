import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import type { Transaction} from "@ledgerhq/live-common/families/mimblewimble_coin/types";
import LText from "../../components/LText";
import { useTranslation } from "react-i18next";
import type { AccountLike } from "@ledgerhq/types-live";
import { useNavigation, useTheme } from "@react-navigation/native";
import { ScreenName } from "../../const";

const styles = StyleSheet.create({
  customizeBaseFeeButton: {
    flex: 0,
    padding: 8,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16
  }
});

export default (
  {
    account,
    transaction
  }: {
    account: AccountLike;
    transaction: Transaction;
  }
) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const onCustomizeBaseFeePress = useCallback(() => {
    navigation.navigate(ScreenName.MimbleWimbleCoinEditBaseFee, {
      account,
      transaction
    });
  }, [navigation, account, transaction]);
  return (
    <TouchableOpacity style={[styles.customizeBaseFeeButton, { backgroundColor: colors.lightLive }]} onPress={onCustomizeBaseFeePress}>
      <LText semiBold color="live">
        {t("mimblewimble_coin.customizeBaseFee")}
      </LText>
    </TouchableOpacity>
  );
}
