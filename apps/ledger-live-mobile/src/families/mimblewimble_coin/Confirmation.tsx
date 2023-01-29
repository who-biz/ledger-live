import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  TouchableOpacity,
  Share,
  View,
  BackHandler,
  StyleSheet,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import QRCode from "react-native-qrcode-svg";
import { useTranslation, Trans } from "react-i18next";
import type {
  Account,
  TokenAccount,
  OperationRaw,
  Address,
  AccountLike,
} from "@ledgerhq/types-live";
import type {
  CryptoCurrency,
  CryptoOrTokenCurrency,
  TokenCurrency,
  Currency,
} from "@ledgerhq/types-cryptoassets";
import {
  makeEmptyTokenAccount,
  getMainAccount,
  getAccountCurrency,
} from "@ledgerhq/live-common/account/index";
import { useTheme, useRoute } from "@react-navigation/native";
import { Flex, Text, Icons, Notification } from "@ledgerhq/native-ui";
import { SyncSkipUnderPriority } from "@ledgerhq/live-common/bridge/react/index";
import { HeaderBackButton } from "@react-navigation/elements";
import Icon from "react-native-vector-icons/FontAwesome";
import Clipboard from "@react-native-community/clipboard";
import {
  validateTransactionData,
  addReceivedTransactionToAccount,
} from "@ledgerhq/live-common/families/mimblewimble_coin/react";
import { createAction } from "@ledgerhq/live-common/hw/actions/app";
import connectApp from "@ledgerhq/live-common/hw/connectApp";
import getTransactionResponse from "@ledgerhq/live-common/families/mimblewimble_coin/getTransactionResponse";
import { toAccountRaw } from "@ledgerhq/live-common/account/serialization";
// @ts-expect-error no declaration file
import qrcode from "qrcode";
import type { Device } from "@ledgerhq/live-common/hw/actions/types";
import { Subscription } from "rxjs";
import { StackNavigationProp } from "@react-navigation/stack";
import { DeviceModelId } from "@ledgerhq/types-devices";
import getWindowDimensions from "../../logic/getWindowDimensions";
import { accountScreenSelector } from "../../reducers/accounts";
import CurrencyIcon from "../../components/CurrencyIcon";
import CopyLink from "../../components/CopyLink";
import NavigationScrollView from "../../components/NavigationScrollView";
import ReceiveSecurityModal from "../../screens/ReceiveFunds/ReceiveSecurityModal";
import AdditionalInfoModal from "../../screens/ReceiveFunds/AdditionalInfoModal";
import {
  replaceAccounts,
  updateAccountWithUpdater,
} from "../../actions/accounts";
import { ScreenName } from "../../const";
import { track, TrackScreen } from "../../analytics";
import PreventNativeBack from "../../components/PreventNativeBack";
import Button from "../../components/Button";
import StepHeader from "../../components/StepHeader";
import KeyboardView from "../../components/KeyboardView";
import LText from "../../components/LText";
import RecipientInput from "../../components/RecipientInput";
import TranslatedError from "../../components/TranslatedError";
import { navigateToSelectDevice } from "../../screens/ConnectDevice";
import { renderLoading } from "../../components/DeviceAction/rendering";
import DeviceAction from "../../components/DeviceAction";
import logger from "../../logger";
import ValidateError from "../../components/ValidateError";
import SkipLock from "../../components/behaviour/SkipLock";
import HeaderRightClose from "../../components/HeaderRightClose";
import ValidateReceiveOnDevice from "./ValidateReceiveOnDevice";
import ValidateReceiveSuccess from "./ValidateReceiveSuccess";
import {
  BaseComposite,
  StackNavigatorProps,
} from "../../components/RootNavigator/types/helpers";
import { ReceiveFundsStackParamList } from "../../components/RootNavigator/types/ReceiveFundsNavigator";

const openAction = createAction(connectApp);

const IconQRCode = ({
  size = 16,
  color,
}: {
  size?: number;
  color?: string;
}) => <Icon name="qrcode" size={size} color={color} />;

const styles = StyleSheet.create({
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

type ScreenProps = BaseComposite<
  StackNavigatorProps<
    ReceiveFundsStackParamList,
    ScreenName.ReceiveConfirmation | ScreenName.ReceiveVerificationConfirmation
  >
>;

type Props = {
  account?: TokenAccount | Account;
  parentAccount?: Account;
  readOnlyModeEnabled?: boolean;
} & ScreenProps;

type ParamList = {
  account?: AccountLike;
  accountId: string;
  parentId?: string;
  modelId?: DeviceModelId;
  verified?: boolean;
  wired?: boolean;
  device?: Device;
  currency?: Currency;
  createTokenAccount?: boolean;
  onSuccess?: (_?: string) => void;
  onError?: () => void;
  transactionData?: string;
};

export default function ReceiveConfirmation({ navigation }: Props) {
  const route = useRoute<ScreenProps["route"]>();
  const { account, parentAccount } = useSelector(accountScreenSelector(route));

  return account ? (
    <ReceiveConfirmationInner
      navigation={navigation}
      route={route}
      account={account as Account | TokenAccount}
      parentAccount={parentAccount ?? undefined}
    />
  ) : null;
}

function ReceiveConfirmationInner({
  navigation,
  route,
  account,
  parentAccount,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useEffect(() => {
    if (!route.params.verified) {
      let selectAccountRoute: number | undefined;
      for (let i = 0; i < navigation.getState().routes.length; ++i) {
        if (
          navigation.getState().routes[i].name ===
          ScreenName.ReceiveSelectAccount
        ) {
          selectAccountRoute = i;
          break;
        }
      }
      if (
        navigation.getState().routes[0].name === ScreenName.ReceiveSelectCrypto
      ) {
        if (selectAccountRoute !== undefined) {
          (navigation as StackNavigationProp<{ [key: string]: object }>).reset({
            index: 2,
            routes: [
              (
                navigation as StackNavigationProp<{ [key: string]: object }>
              ).getState().routes[0],
              (
                navigation as StackNavigationProp<{ [key: string]: object }>
              ).getState().routes[selectAccountRoute],
              {
                name: ScreenName.ReceiveConnectDevice,
                params: {
                  ...route.params,
                  notSkippable: true,
                  transactionData: undefined,
                },
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
          });
        } else {
          (navigation as StackNavigationProp<{ [key: string]: object }>).reset({
            index: 1,
            routes: [
              (
                navigation as StackNavigationProp<{ [key: string]: object }>
              ).getState().routes[0],
              {
                name: ScreenName.ReceiveConnectDevice,
                params: {
                  ...route.params,
                  notSkippable: true,
                  transactionData: undefined,
                },
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
          });
        }
      } else if (selectAccountRoute !== undefined) {
        (navigation as StackNavigationProp<{ [key: string]: object }>).reset({
          index: 1,
          routes: [
            (
              navigation as StackNavigationProp<{ [key: string]: object }>
            ).getState().routes[selectAccountRoute],
            {
              name: ScreenName.ReceiveConnectDevice,
              params: {
                ...route.params,
                notSkippable: true,
                transactionData: undefined,
              },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });
      } else {
        (navigation as StackNavigationProp<{ [key: string]: object }>).reset({
          index: 0,
          routes: [
            {
              name: ScreenName.ReceiveConnectDevice,
              params: {
                ...route.params,
                notSkippable: true,
                transactionData: undefined,
              },
            },
          ],
        });
      }
    }
  }, [navigation, route.params]);
  if (!route.params.verified) {
    navigation.setOptions({
      headerLeft: undefined,
      headerRight: undefined,
      headerTitle: "",
      gestureEnabled: false,
    });
  }
  const verified = route.params?.verified ?? false;
  const [isModalOpened, setIsModalOpened] = useState(true);
  const [hasAddedTokenAccount, setHasAddedTokenAccount] = useState(false);
  const [isToastDisplayed, setIsToastDisplayed] = useState(false);
  const [isAddionalInfoModalOpen, setIsAddionalInfoModalOpen] = useState(false);
  const [enterTransaction, setEnterTransaction] = useState(
    (route.params as ParamList).transactionData !== undefined,
  );
  const [transactionData, setTransactionData] = useState("");
  const [transactionDataError, setTransactionDataError] = useState<
    undefined | Error
  >(undefined);
  const [transactionDataWarning, setTransactionDataWarning] = useState<
    undefined | Error
  >(undefined);
  const [finalizeTransaction, setFinalizeTransaction] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<null | Device>(null);
  const getTransactionResponseSubscription = useRef<null | Subscription>(null);
  const [processingTransactionError, setProcessingTransactionError] =
    useState<null | Error>(null);
  const [useTransactionResponseQrCode, setUseTransactionResponseQrCode] =
    useState(true);
  const [operationAmount, setOperationAmount] = useState<null | string>(null);
  const [operationFee, setOperationFee] = useState<null | string>(null);
  const [
    operationSenderPaymentProofAddress,
    setOperationSenderPaymentProofAddress,
  ] = useState<null | string>(null);
  const [signatureRequested, setSignatureRequested] = useState(false);
  const [signatureReceived, setSignatureReceived] = useState(false);
  const [transactionResponse, setTransactionResponse] = useState<null | string>(
    null,
  );
  const dispatch = useDispatch();

  const hideToast = useCallback(() => {
    setIsToastDisplayed(false);
  }, []);

  const openAdditionalInfoModal = useCallback(() => {
    track("notification_clicked", {
      button: "Imported and created account",
    });
    setIsAddionalInfoModalOpen(true);
    hideToast();
  }, [setIsAddionalInfoModalOpen, hideToast]);

  const closeAdditionalInfoModal = useCallback(() => {
    setIsAddionalInfoModalOpen(false);
  }, [setIsAddionalInfoModalOpen]);

  const onRetry = useCallback(() => {
    track("button_clicked", {
      button: "Verify your address",
    });
    const params = { ...route.params, notSkippable: true };
    setIsModalOpened(false);
    (navigation as StackNavigationProp<{ [key: string]: object }>).navigate(
      ScreenName.ReceiveConnectDevice,
      params,
    );
  }, [navigation, route.params]);

  const { width } = getWindowDimensions();
  const QRSize = Math.round(width / 1.8 - 16);
  const mainAccount = account && getMainAccount(account, parentAccount);
  const currency =
    route.params?.currency || (account && getAccountCurrency(account));

  useEffect(() => {
    if (!route.params.verified) {
      return;
    }
    if (route.params?.createTokenAccount && !hasAddedTokenAccount) {
      const newMainAccount = { ...mainAccount };
      if (
        !newMainAccount.subAccounts ||
        !newMainAccount.subAccounts.find(
          acc =>
            (acc as TokenAccount)?.token?.id ===
            (currency as CryptoOrTokenCurrency).id,
        )
      ) {
        const emptyTokenAccount = makeEmptyTokenAccount(
          newMainAccount as Account,
          currency as TokenCurrency,
        );
        newMainAccount.subAccounts = [
          ...(newMainAccount.subAccounts || []),
          emptyTokenAccount,
        ];

        // @TODO create a new action for adding a single account at a time instead of replacing
        dispatch(
          replaceAccounts({
            scannedAccounts: [newMainAccount as Account],
            selectedIds: [(newMainAccount as Account).id],
            renamings: {},
          }),
        );
        setIsToastDisplayed(true);
        setHasAddedTokenAccount(true);
      }
    }
  }, [
    currency,
    route.params?.createTokenAccount,
    mainAccount,
    dispatch,
    hasAddedTokenAccount,
    route.params?.verified,
  ]);

  useEffect(() => {
    if (!route.params.verified) {
      return;
    }
    if (verified && currency) {
      track("Verification Success", { currency: currency.name });
    }
  }, [verified, currency, route.params?.verified]);

  const onShare = useCallback(() => {
    track("button_clicked", {
      button: "Share",
    });
    if (mainAccount?.freshAddress) {
      Share.share({ message: mainAccount?.freshAddress });
    }
  }, [mainAccount?.freshAddress]);

  const onCopy = useCallback(() => {
    track("button_clicked", {
      button: "Copy",
    });
  }, []);

  const onContinue = useCallback(() => {
    setEnterTransaction(true);
  }, [setEnterTransaction]);
  const onFinalize = useCallback(() => {
    setFinalizeTransaction(true);
  }, [setFinalizeTransaction]);
  const onPressScan = useCallback(() => {
    (navigation as StackNavigationProp<{ [key: string]: object }>).navigate(
      ScreenName.MimbleWimbleCoinScanTransactionData,
      route.params,
    );
  }, [navigation, route.params]);
  const onChangeTransactionData = useCallback(
    transactionData => {
      if (transactionData) {
        const { error, warning } = validateTransactionData(
          (account as Account).currency,
          transactionData,
        );
        setTransactionDataError(error);
        setTransactionDataWarning(warning);
      } else {
        setTransactionDataError(undefined);
        setTransactionDataWarning(undefined);
      }
      setTransactionData(transactionData);
    },
    [
      account,
      setTransactionDataError,
      setTransactionDataWarning,
      setTransactionData,
    ],
  );
  useEffect(() => {
    if (!route.params.verified) {
      return;
    }
    if ((route.params as ParamList).transactionData !== undefined) {
      setTransactionData((route.params as ParamList).transactionData || "");
      onChangeTransactionData((route.params as ParamList).transactionData);
    }
  }, [
    setTransactionData,
    route.params,
    onChangeTransactionData,
    route.params?.verified,
  ]);
  const onDeviceConnected = useCallback(
    ({ device }: { device: Device }) => {
      setCurrentDevice(device);
      return renderLoading({ t });
    },
    [setCurrentDevice, t],
  );
  useEffect(() => {
    if (!route.params.verified) {
      return;
    }
    if (currentDevice) {
      unsubscribe();
      getTransactionResponseSubscription.current = getTransactionResponse(
        toAccountRaw(account as Account),
        currentDevice.deviceId,
        transactionData,
      ).subscribe({
        next: ({
          type,
          transactionResponse,
          freshAddress,
          nextIdentifier,
          operation,
        }: {
          type: string;
          transactionResponse?: string;
          freshAddress?: Address;
          nextIdentifier?: string;
          operation?: OperationRaw;
        }) => {
          switch (type) {
            case "device-signature-requested":
              setOperationAmount((operation as OperationRaw).value);
              setOperationFee((operation as OperationRaw).fee);
              setOperationSenderPaymentProofAddress(
                (operation as OperationRaw).senders.length
                  ? (operation as OperationRaw).senders[0]
                  : null,
              );
              setSignatureRequested(true);
              break;
            case "device-signature-granted":
              setSignatureReceived(true);
              break;
            case "signed":
              qrcode.toString(
                transactionResponse,
                {
                  errorCorrectionLevel: "L",
                },
                (error: Error | null) => {
                  if (getTransactionResponseSubscription.current) {
                    setUseTransactionResponseQrCode(!error);
                    setCurrentDevice(null);
                    setOperationAmount((operation as OperationRaw).value);
                    setTransactionResponse(transactionResponse as string);
                    dispatch(
                      updateAccountWithUpdater(
                        (mainAccount as Account).id,
                        (account: Account) => {
                          return addReceivedTransactionToAccount(
                            account,
                            freshAddress as Address,
                            nextIdentifier as string,
                            operation as OperationRaw,
                          );
                        },
                      ),
                    );
                  }
                },
              );
              break;
            default:
              break;
          }
        },
        error: (error: Error) => {
          setProcessingTransactionError(error);
          setCurrentDevice(null);
          logger.critical(error);
        },
      });
    } else {
      unsubscribe();
    }
    // eslint-disable-next-line consistent-return
    return () => {
      unsubscribe();
    };
  }, [
    currentDevice,
    account,
    dispatch,
    mainAccount,
    transactionData,
    route.params?.verified,
  ]);
  const unsubscribe = () => {
    if (getTransactionResponseSubscription.current) {
      getTransactionResponseSubscription.current.unsubscribe();
      getTransactionResponseSubscription.current = null;
    }
  };
  const retry = useCallback(() => {
    (navigation as StackNavigationProp<{ [key: string]: object }>).navigate(
      ScreenName.ReceiveConfirmation,
      {
        ...route.params,
        verified: false,
        transactionData: undefined,
      },
    );
  }, [navigation, route.params]);
  const close = useCallback(() => {
    (
      navigation.getParent() as StackNavigationProp<{ [key: string]: object }>
    ).pop();
  }, [navigation]);
  const share = useCallback(() => {
    Share.share({ message: transactionResponse || "" });
  }, [transactionResponse]);
  useEffect(() => {
    if (!route.params.verified) {
      return;
    }
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!signatureRequested || processingTransactionError) {
          (
            navigation as StackNavigationProp<{ [key: string]: object }>
          ).navigate(ScreenName.ReceiveConfirmation, {
            ...route.params,
            verified: false,
            transactionData: undefined,
          });
        }
        return true;
      },
    );
    if (!signatureRequested) {
      navigation.setOptions({
        headerLeft: () => (
          <HeaderBackButton
            onPress={() =>
              (
                navigation as StackNavigationProp<{ [key: string]: object }>
              ).navigate(ScreenName.ReceiveConfirmation, {
                ...route.params,
                verified: false,
                transactionData: undefined,
              })
            }
          />
        ),
        headerRight: () => <HeaderRightClose />,
        headerTitle: () => (
          <StepHeader
            subtitle={t("transfer.receive.stepperHeader.range", {
              currentStep: "3",
              totalSteps: 3,
            })}
            title={t("mimblewimble_coin.receiveFunds")}
          />
        ),
        gestureEnabled: Platform.OS === "ios",
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: undefined,
        headerTitle:
          processingTransactionError || transactionResponse !== null
            ? ""
            : () => (
                <StepHeader
                  subtitle={t("transfer.receive.stepperHeader.range", {
                    currentStep: "3",
                    totalSteps: 3,
                  })}
                  title={t("mimblewimble_coin.receiveFunds")}
                />
              ),
        gestureEnabled: false,
      });
    }
    // eslint-disable-next-line consistent-return
    return () => backHandler.remove();
  }, [
    signatureRequested,
    signatureReceived,
    processingTransactionError,
    transactionResponse,
    navigation,
    route.params,
    t,
    route.params?.verified,
  ]);

  if (!route.params.verified) {
    return null;
  }

  if (!account || !currency || !mainAccount) return null;

  return (
    <Flex flex={1}>
      <PreventNativeBack />
      <SyncSkipUnderPriority priority={100} />
      {transactionResponse !== null ? (
        <>
          <ValidateReceiveSuccess
            transactionResponse={transactionResponse}
            useTransactionResponseQrCode={useTransactionResponseQrCode}
            operationAmount={operationAmount || ""}
            mainAccount={mainAccount}
          />
          <View style={[styles.container, { paddingVertical: 16 }]}>
            <Button
              event="ReceiveConfirmationShare"
              type="tertiary"
              title={<Trans i18nKey={"mimblewimble_coin.shareResponse"} />}
              onPress={share}
            />
            <View style={[{ marginTop: 16 }]} />
            <Button
              event="ReceiveConfirmationClose"
              type="primary"
              title={<Trans i18nKey={"common.close"} />}
              onPress={close}
            />
          </View>
        </>
      ) : processingTransactionError ? (
        <ValidateError
          error={processingTransactionError}
          onRetry={retry}
          onClose={close}
        />
      ) : signatureReceived ? (
        <>{renderLoading({ t })}</>
      ) : signatureRequested ? (
        <>
          <SkipLock />
          <ValidateReceiveOnDevice
            account={account}
            parentAccount={parentAccount}
            device={route.params.device}
            amount={operationAmount || ""}
            fee={operationFee || ""}
            senderPaymentProofAddress={operationSenderPaymentProofAddress}
          />
        </>
      ) : finalizeTransaction ? (
        <Flex style={[styles.container, { flex: 1 }]}>
          <DeviceAction
            action={openAction}
            request={{
              account: account as Account,
            }}
            device={route.params.device}
            onSelectDeviceLink={() =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              navigateToSelectDevice(navigation as any, route as any)
            }
            renderOnResult={onDeviceConnected}
          />
        </Flex>
      ) : enterTransaction ? (
        <KeyboardView style={{ flex: 1 }}>
          <NavigationScrollView
            style={[styles.container, { flex: 1 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TrackScreen
              category="Receive"
              name="Enter Transaction"
              currency={currency.name}
            />
            <Text
              variant="body"
              fontWeight="medium"
              color="neutral.c70"
              textAlign="center"
              mt={4}
            >
              {t("mimblewimble_coin.transactionToReceive")}
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
                  const transactionData = await Clipboard.getString();
                  onChangeTransactionData(transactionData);
                }}
                onChangeText={onChangeTransactionData}
                value={transactionData}
                placeholder={t("mimblewimble_coin.enterTransaction")}
              />
            </View>
            {transactionDataError || transactionDataWarning ? (
              <LText
                style={styles.warningBox}
                color={
                  transactionDataError
                    ? "alert"
                    : transactionDataWarning
                    ? "orange"
                    : "darkBlue"
                }
              >
                <TranslatedError
                  error={transactionDataError || transactionDataWarning}
                />
              </LText>
            ) : null}
          </NavigationScrollView>
          <Flex m={6}>
            <Button
              event="ReceiveConfirmationFinalize"
              type="primary"
              title={<Trans i18nKey={"common.continue"} />}
              disabled={!!(!transactionData || transactionDataError)}
              onPress={onFinalize}
            />
          </Flex>
        </KeyboardView>
      ) : (
        <>
          <NavigationScrollView style={{ flex: 1 }}>
            <TrackScreen
              category="Receive"
              name="Qr Code"
              currency={currency.name}
            />
            <Flex p={6} alignItems="center" justifyContent="center">
              <Text
                color="neutral.c100"
                fontWeight="semiBold"
                variant="h4"
                mb={3}
              >
                {t("transfer.receive.receiveConfirmation.title", {
                  currencyTicker: currency.ticker,
                })}
              </Text>
              <Flex>
                {verified ? (
                  <Flex
                    alignItems="center"
                    justifyContent="center"
                    flexDirection="row"
                  >
                    <Icons.ShieldCheckMedium color="success.c100" size={16} />
                    <Text
                      color="success.c100"
                      fontWeight="medium"
                      variant="paragraphLineHeight"
                      ml={2}
                    >
                      {t(
                        "transfer.receive.receiveConfirmation.addressVerified",
                      )}
                    </Text>
                  </Flex>
                ) : (
                  <Flex>
                    <TouchableOpacity onPress={onRetry}>
                      <Flex
                        alignItems="center"
                        justifyContent="center"
                        flexDirection="row"
                      >
                        <Icons.ShieldSecurityMedium
                          color="warning.c100"
                          size={16}
                        />
                        <Text
                          color="warning.c100"
                          fontWeight="medium"
                          variant="paragraphLineHeight"
                          ml={2}
                        >
                          {t(
                            "transfer.receive.receiveConfirmation.verifyAddress",
                          )}
                        </Text>
                      </Flex>
                    </TouchableOpacity>
                    <Text
                      variant="small"
                      fontWeight="medium"
                      color="neutral.c70"
                      textAlign="center"
                      mt={3}
                    >
                      {t("transfer.receive.receiveConfirmation.adviceVerify")}
                    </Text>
                  </Flex>
                )}
              </Flex>
              <Flex alignItems="center" justifyContent="center" mt={10}>
                <Flex
                  p={6}
                  borderRadius={24}
                  position="relative"
                  bg="constant.white"
                  borderWidth={1}
                  borderColor="neutral.c40"
                >
                  <QRCode
                    size={QRSize}
                    value={mainAccount.freshAddress}
                    ecl="H"
                  />
                </Flex>
                <Flex
                  alignItems="center"
                  justifyContent="center"
                  width={QRSize * 0.3}
                  height={QRSize * 0.3}
                  bg="constant.white"
                  position="absolute"
                >
                  <CurrencyIcon
                    currency={currency}
                    color={colors.white}
                    bg={
                      (currency as CryptoCurrency)?.color ||
                      (currency as TokenCurrency).parentCurrency?.color ||
                      colors.black
                    }
                    size={48}
                    circle
                  />
                </Flex>
              </Flex>
              <Flex
                mt={10}
                bg={"neutral.c30"}
                borderRadius={8}
                p={6}
                mx={6}
                flexDirection="row"
                width="100%"
                justifyContent={"space-between"}
              >
                <Text numberOfLines={4} flex={1} fontWeight="semiBold">
                  {mainAccount.freshAddress}
                </Text>
                <CopyLink
                  onCopy={onCopy}
                  string={mainAccount.freshAddress}
                  replacement={
                    <Trans i18nKey="transfer.receive.addressCopied" />
                  }
                >
                  {t("transfer.receive.copyAddress")}
                </CopyLink>
              </Flex>
              <Text
                variant="body"
                fontWeight="medium"
                color="neutral.c70"
                mt={6}
                textAlign="center"
              >
                {t("transfer.receive.receiveConfirmation.sendWarning", {
                  currencyName: currency.name,
                  currencyTicker: currency.ticker,
                })}
              </Text>
            </Flex>
          </NavigationScrollView>
          <Flex m={6}>
            {isToastDisplayed ? (
              <Notification
                Icon={Icons.CircledCheckMedium}
                variant={"neutral"}
                title={t("transfer.receive.toastMessages.accountImported", {
                  currencyTicker: currency.ticker,
                })}
                onClose={hideToast}
                linkText={t("transfer.receive.toastMessages.why")}
                onLinkPress={openAdditionalInfoModal}
              />
            ) : (
              <>
                <Button
                  event="ReceiveConfirmationShare"
                  type="tertiary"
                  title={<Trans i18nKey={"transfer.receive.shareAddress"} />}
                  onPress={onShare}
                />
                <View style={[{ marginTop: 16 }]} />
                <Button
                  event="ReceiveConfirmationContinue"
                  type="primary"
                  title={<Trans i18nKey={"common.continue"} />}
                  onPress={onContinue}
                />
              </>
            )}
          </Flex>
          {verified ? null : isModalOpened ? (
            <ReceiveSecurityModal onVerifyAddress={onRetry} />
          ) : null}
        </>
      )}

      <AdditionalInfoModal
        isOpen={isAddionalInfoModalOpen}
        onClose={closeAdditionalInfoModal}
        currencyTicker={currency.ticker}
      />
    </Flex>
  );
}
