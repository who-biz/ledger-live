import invariant from "invariant";
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { Platform, StyleSheet, View, Share } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trans, useTranslation } from "react-i18next";
import {
  getMainAccount,
  formatOperation,
  addPendingOperation,
} from "@ledgerhq/live-common/account/index";
import { createAction as createTransactionAction } from "@ledgerhq/live-common/hw/actions/transaction";
import { createAction as createOpenAction } from "@ledgerhq/live-common/hw/actions/app";
import connectApp from "@ledgerhq/live-common/hw/connectApp";
import type { Device } from "@ledgerhq/live-common/hw/actions/types";
import useBridgeTransaction from "@ledgerhq/live-common/bridge/useBridgeTransaction";
import { useTheme } from "styled-components/native";
import { withDevice } from "@ledgerhq/live-common/hw/deviceAccess";
import { from } from "rxjs";
import prepareTransaction from "@ledgerhq/live-common/families/mimblewimble_coin/prepareTransaction";
import { toAccountRaw } from "@ledgerhq/live-common/account/serialization";
import { toTransactionRaw } from "@ledgerhq/live-common/transaction/index";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import { BigNumber } from "bignumber.js";
import QRCode from "react-native-qrcode-svg";
import { Flex, Text } from "@ledgerhq/native-ui";
import qrcode from "qrcode";
import Icon from "react-native-vector-icons/dist/FontAwesome";
import Clipboard from "@react-native-community/clipboard";
import {
  validateTransactionResponse,
  addSentTransactionToAccount,
} from "@ledgerhq/live-common/families/mimblewimble_coin/react";
import { useRoute, useNavigation } from "@react-navigation/native";
import type {
  Account,
  AccountLike,
  SignedOperation,
  Operation,
} from "@ledgerhq/types-live";
import { log } from "@ledgerhq/logs";
import { UserRefusedOnDevice } from "@ledgerhq/errors";
import { TransactionRefusedOnDevice } from "@ledgerhq/live-common/errors";
import { StackNavigationProp } from "@react-navigation/stack";
import CopyLink from "../../components/CopyLink";
import Button from "../../components/Button";
import LText from "../../components/LText";
import KeyboardView from "../../components/KeyboardView";
import NavigationScrollView from "../../components/NavigationScrollView";
import RecipientInput from "../../components/RecipientInput";
import TranslatedError from "../../components/TranslatedError";
import { broadcastSignedTx } from "../../logic/screenTransactionHooks";
import { updateAccountWithUpdater } from "../../actions/accounts";
import logger from "../../logger";
import { ScreenName } from "../../const";
// eslint-disable-next-line import/no-cycle
import { navigateToSelectDevice } from "../../screens/ConnectDevice";
import { TrackScreen, track } from "../../analytics";
import { renderLoading } from "../../components/DeviceAction/rendering";
import DeviceAction from "../../components/DeviceAction";
import { accountScreenSelector } from "../../reducers/accounts";
import type { SendFundsNavigatorStackParamList } from "../../components/RootNavigator/types/SendFundsNavigator";
import getWindowDimensions from "../../logic/getWindowDimensions";

const transactionAction = createTransactionAction(connectApp);

const openAction = createOpenAction(connectApp);

const IconQRCode = ({ size, color }: { size: number; color: string }) => (
  <Icon name="qrcode" size={size} color={color} />
);

function useSignedTxHandler({
  account,
  parentAccount,
}: {
  account: AccountLike;
  parentAccount: Account | null | undefined;
}) {
  const navigation = useNavigation();
  const route = useRoute();
  const broadcast = useCallback(
    async (signedOperation: SignedOperation): Promise<Operation> => {
      return broadcastSignedTx(account, parentAccount, signedOperation);
    },
    [account, parentAccount],
  );
  const dispatch = useDispatch();
  const mainAccount = getMainAccount(account, parentAccount);
  return useCallback(
    async ({ signedOperation, transactionSignError }) => {
      try {
        if (transactionSignError) {
          throw transactionSignError;
        }
        const operation = await broadcast(signedOperation);
        log(
          "transaction-summary",
          `✔️ broadcasted! optimistic operation: ${formatOperation(mainAccount)(
            operation,
          )}`,
        );
        (navigation as StackNavigationProp<{ [key: string]: object }>).replace(
          route.name.replace("ConnectDevice", "ValidationSuccess"),
          { ...route.params, result: operation },
        );
        dispatch(
          updateAccountWithUpdater(mainAccount.id, (account: Account) => {
            return addSentTransactionToAccount(
              addPendingOperation(account, operation),
              signedOperation,
            );
          }),
        );
      } catch (error) {
        if (
          !(
            error instanceof UserRefusedOnDevice ||
            error instanceof TransactionRefusedOnDevice
          )
        ) {
          logger.critical(error as Error);
        }
        (navigation as StackNavigationProp<{ [key: string]: object }>).replace(
          route.name.replace("ConnectDevice", "ValidationError"),
          { ...route.params, error },
        );
      }
    },
    [navigation, route, broadcast, mainAccount, dispatch],
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  separatorContainer: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
  },
  separatorLine: {
    flex: 1,
    borderBottomWidth: 1,
    marginHorizontal: 8,
  },
  inputWrapper: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  warningBox: {
    marginTop: 8,
    ...Platform.select({
      android: {
        marginLeft: 6,
      },
    }),
  },
});

type Props = StackNavigatorProps<
  SendFundsNavigatorStackParamList,
  ScreenName.SendConnectDevice
>;

export default function ConnectDevice(props: Props) {
  const { route, navigation } = props;
  const [currentDevice, setCurrentDevice] = useState(null);
  const [transactionData, setTransactionData] = useState(null);
  const [enterTransactionResponse, setEnterTransactionResponse] =
    useState(false);
  const [finalizingTransaction, setFinalizingTransaction] = useState(false);
  const [useTransactionDataQrCode, setUseTransactionDataQrCode] =
    useState(true);
  const [transactionResponseError, setTransactionResponseError] =
    useState(undefined);
  const [transactionResponseWarning, setTransactionResponseWarning] =
    useState(undefined);
  const prepareTransactionSubscription = useRef(null);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { account, parentAccount } = useSelector(accountScreenSelector(route));
  invariant(account, "account is required");
  const { appName, onSuccess, onError, analyticsPropertyFlow } = route.params;
  const mainAccount = getMainAccount(account, parentAccount);
  const { transaction, setTransaction, status } = useBridgeTransaction(() => ({
    account: mainAccount,
    transaction: route.params.transaction,
  }));
  const initialTransaction = useRef(transaction);
  const navigationTransaction = route.params?.transaction;
  useEffect(() => {
    if (
      initialTransaction.current !== navigationTransaction &&
      navigationTransaction
    ) {
      setTransaction(navigationTransaction);
      onChangeTransactionResponse(navigationTransaction.transactionResponse);
    }
  }, [setTransaction, navigationTransaction, onChangeTransactionResponse]);
  const tokenCurrency =
    account.type === "TokenAccount" ? account.token : undefined;
  const handleTx = useSignedTxHandler({
    account,
    parentAccount,
  });
  const onResult = useCallback(
    payload => {
      handleTx(payload);
      return renderLoading({ t });
    },
    [handleTx, t],
  );
  const extraProps = useMemo(() => {
    return onSuccess
      ? {
          onResult: onSuccess,
          onError,
        }
      : {
          renderOnResult: onResult,
        };
  }, [onSuccess, onError, onResult]);
  const onDeviceConnected = useCallback(
    ({ device }: { device: Device }) => {
      setCurrentDevice(device);
      return renderLoading({ t });
    },
    [setCurrentDevice, t],
  );
  useEffect(() => {
    if (currentDevice) {
      unsubscribe();
      prepareTransactionSubscription.current = withDevice(
        currentDevice.deviceId,
      )(transport =>
        from(
          prepareTransaction(
            toAccountRaw(account),
            transport,
            toTransactionRaw(transaction),
          ),
        ),
      ).subscribe({
        next: ({
          transactionData,
          height,
          id,
          offset,
          proof,
          privateNonceIndex,
        }: {
          transactionData: string;
          height: string;
          id: string;
          offset: string;
          proof: string | undefined;
          privateNonceIndex: number;
        }) => {
          qrcode.toString(
            transactionData,
            {
              errorCorrectionLevel: "L",
            },
            (error: Error | null) => {
              if (prepareTransactionSubscription.current) {
                setUseTransactionDataQrCode(!error);
                setTransactionData(transactionData);
                setCurrentDevice(null);
                const bridge = getAccountBridge(account, parentAccount);
                setTransaction(
                  bridge.updateTransaction(transaction, {
                    height: new BigNumber(height),
                    id,
                    offset: Buffer.from(offset, "hex"),
                    proof:
                      proof !== undefined
                        ? Buffer.from(proof, "hex")
                        : undefined,
                    privateNonceIndex,
                    transactionResponse: undefined,
                  }),
                );
              }
            },
          );
        },
        error: (error: Error) => {
          setCurrentDevice(null);
          logger.critical(error);
          navigation.replace(
            route.name.replace("ConnectDevice", "ValidationError"),
            { ...route.params, error },
          );
        },
      });
    } else {
      unsubscribe();
    }
    return () => {
      unsubscribe();
    };
  }, [
    currentDevice,
    account,
    navigation,
    parentAccount,
    route.name,
    route.params,
    setTransaction,
    transaction,
  ]);
  const unsubscribe = () => {
    if (prepareTransactionSubscription.current) {
      prepareTransactionSubscription.current.unsubscribe();
      prepareTransactionSubscription.current = null;
    }
  };
  const onChangeTransactionResponse = useCallback(
    transactionResponse => {
      if (transactionResponse) {
        const { error, warning } = validateTransactionResponse(
          account.currency,
          transactionResponse,
        );
        setTransactionResponseError(error);
        setTransactionResponseWarning(warning);
      } else {
        setTransactionResponseError(undefined);
        setTransactionResponseWarning(undefined);
      }
      const bridge = getAccountBridge(account, parentAccount);
      setTransaction(
        bridge.updateTransaction(transaction, {
          transactionResponse,
        }),
      );
    },
    [account, parentAccount, setTransaction, transaction],
  );
  const clearTransactionResponse = useCallback(() => {
    onChangeTransactionResponse("");
  }, [onChangeTransactionResponse]);
  const onContinue = useCallback(() => {
    setEnterTransactionResponse(true);
  }, [setEnterTransactionResponse]);
  const onFinalize = useCallback(() => {
    setFinalizingTransaction(true);
  }, [setFinalizingTransaction]);
  const onShare = useCallback(() => {
    track("button_clicked", {
      button: "Share",
      screen: route.name,
    });
    Share.share({ message: transactionData });
  }, [transactionData, route.name]);
  const onPressScan = useCallback(() => {
    navigation.navigate(ScreenName.MimbleWimbleCoinScanTransactionResponse, {
      ...route.params,
      account,
      transaction,
    });
  }, [navigation, route.params, account, transaction]);
  const { width } = getWindowDimensions();
  const qRSize = Math.round(width / 1.2 - 15);
  const render = useMemo(() => {
    return transaction ? (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background.main }]}
      >
        <TrackScreen
          category={route.name.replace("ConnectDevice", "")}
          name="ConnectDevice"
        />
        {!transaction.sendAsFile || finalizingTransaction ? (
          <DeviceAction
            action={transactionAction}
            request={{
              account,
              parentAccount,
              appName,
              transaction,
              status,
              tokenCurrency,
            }}
            device={route.params.device}
            onSelectDeviceLink={() => navigateToSelectDevice(navigation, route)}
            {...extraProps}
            analyticsPropertyFlow={analyticsPropertyFlow}
          />
        ) : enterTransactionResponse ? (
          <KeyboardView style={{ flex: 1 }}>
            <NavigationScrollView
              style={[styles.container, { flex: 1 }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                variant="body"
                fontWeight="medium"
                color="neutral.c70"
                textAlign="center"
                mt={4}
              >
                {t("mimblewimble_coin.transactionResponseReceived")}
              </Text>
              <Button
                mt={3}
                event="SendConnectDeviceQR"
                type="tertiary"
                title={<Trans i18nKey="send.recipient.scan" />}
                IconLeft={IconQRCode}
                onPress={onPressScan}
              />
              <View style={styles.separatorContainer}>
                <View
                  style={[
                    styles.separatorLine,
                    { borderBottomColor: colors.lightFog },
                  ]}
                />
                <LText color="grey">{<Trans i18nKey="common.or" />}</LText>
                <View
                  style={[
                    styles.separatorLine,
                    { borderBottomColor: colors.lightFog },
                  ]}
                />
              </View>
              <View style={styles.inputWrapper}>
                <RecipientInput
                  onPaste={async () => {
                    const transactionResponse = await Clipboard.getString();
                    onChangeTransactionResponse(transactionResponse);
                  }}
                  onChangeText={onChangeTransactionResponse}
                  onInputCleared={clearTransactionResponse}
                  value={transaction.transactionResponse}
                  placeholder={t("mimblewimble_coin.enterResponse")}
                />
              </View>
              {transactionResponseError || transactionResponseWarning ? (
                <LText
                  style={styles.warningBox}
                  color={
                    transactionResponseError
                      ? "alert"
                      : transactionResponseWarning
                      ? "orange"
                      : "darkBlue"
                  }
                >
                  <TranslatedError
                    error={
                      transactionResponseError || transactionResponseWarning
                    }
                  />
                </LText>
              ) : null}
            </NavigationScrollView>
            <View style={[styles.container, { paddingVertical: 16 }]}>
              <Button
                event="SendConnectDeviceFinalize"
                type="primary"
                title={<Trans i18nKey={"common.continue"} />}
                disabled={
                  !transaction.transactionResponse || transactionResponseError
                }
                onPress={onFinalize}
              />
            </View>
          </KeyboardView>
        ) : transactionData !== null ? (
          <>
            <NavigationScrollView
              style={[styles.container, { flex: 1 }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                variant="body"
                fontWeight="medium"
                color="neutral.c70"
                textAlign="center"
                mt={4}
              >
                {t("mimblewimble_coin.transactionRequest")}
              </Text>
              {useTransactionDataQrCode ? (
                <Flex alignItems="center" mt={3}>
                  <Flex
                    p={6}
                    borderRadius={24}
                    position="relative"
                    bg="constant.white"
                    borderWidth={1}
                    borderColor="neutral.c40"
                  >
                    <QRCode size={qRSize} value={transactionData} ecl="L" />
                  </Flex>
                </Flex>
              ) : null}
              <Flex
                mt={5}
                bg={"neutral.c30"}
                borderRadius={8}
                p={6}
                flexDirection="row"
                width="100%"
                justifyContent={"space-between"}
              >
                <Text
                  numberOfLines={useTransactionDataQrCode ? 4 : 8}
                  flex={1}
                  fontWeight="semiBold"
                >
                  {transactionData}
                </Text>
                <CopyLink
                  string={transactionData}
                  replacement={
                    <Trans i18nKey="transfer.receive.addressCopied" />
                  }
                >
                  {t("transfer.receive.copyAddress")}
                </CopyLink>
              </Flex>
            </NavigationScrollView>
            <View style={[styles.container, { paddingVertical: 16 }]}>
              <Button
                event="SendConnectDeviceShare"
                type="tertiary"
                title={<Trans i18nKey={"mimblewimble_coin.shareTransaction"} />}
                onPress={onShare}
              />
              <View style={[{ marginTop: 16 }]} />
              <Button
                event="SendConnectDeviceContinue"
                type="primary"
                title={<Trans i18nKey={"common.continue"} />}
                onPress={onContinue}
              />
            </View>
          </>
        ) : (
          <DeviceAction
            action={openAction}
            request={{
              account,
              appName,
              tokenCurrency,
            }}
            device={route.params.device}
            onSelectDeviceLink={() => navigateToSelectDevice(navigation, route)}
            renderOnResult={onDeviceConnected}
            analyticsPropertyFlow={analyticsPropertyFlow}
          />
        )}
      </SafeAreaView>
    ) : null;
  }, [
    status,
    transaction,
    tokenCurrency,
    finalizingTransaction,
    enterTransactionResponse,
    transactionData,
    useTransactionDataQrCode,
    transactionResponseError,
    transactionResponseWarning,
    account,
    analyticsPropertyFlow,
    appName,
    clearTransactionResponse,
    colors.background.main,
    colors.lightFog,
    extraProps,
    navigation,
    onChangeTransactionResponse,
    onContinue,
    onDeviceConnected,
    onFinalize,
    onPressScan,
    onShare,
    parentAccount,
    qRSize,
    route,
    t,
  ]);
  return render;
}
