import React, { useCallback, useEffect, useState, useRef } from "react";
import { TouchableOpacity, Share, View, BackHandler, StyleSheet, Linking, Platform } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import QRCode from "react-native-qrcode-svg";
import { useTranslation, Trans } from "react-i18next";
import type { Account, TokenAccount, AccountLike, OperationRaw } from "@ledgerhq/types-live";
import {
  makeEmptyTokenAccount,
  getMainAccount,
  getAccountCurrency,
  getAccountName,
} from "@ledgerhq/live-common/account/index";
import { useTheme } from "styled-components/native";
import { Flex, Text, Icons, Notification } from "@ledgerhq/native-ui";
import { useRoute } from "@react-navigation/native";
// eslint-disable-next-line import/no-unresolved
import getWindowDimensions from "../../logic/getWindowDimensions";
import { accountScreenSelector } from "../../reducers/accounts";
import CurrencyIcon from "../../components/CurrencyIcon";
import CopyLink from "../../components/CopyLink";
import NavigationScrollView from "../../components/NavigationScrollView";
import ReceiveSecurityModal from "../../screens/ReceiveFunds/ReceiveSecurityModal";
import AdditionalInfoModal from "../../screens/ReceiveFunds/AdditionalInfoModal";
import { replaceAccounts } from "../../actions/accounts";
import { ScreenName } from "../../const";
import { track, TrackScreen } from "../../analytics";
import { usePreviousRouteName } from "../../helpers/routeHooks";
import PreventNativeBack from "../../components/PreventNativeBack";
import { SyncSkipUnderPriority } from "@ledgerhq/live-common/bridge/react/index";
import Button from "../../components/Button";
import { HeaderBackButton } from "@react-navigation/elements";
import StepHeader from "../../components/StepHeader";
import KeyboardView from "../../components/KeyboardView";
import Icon from "react-native-vector-icons/dist/FontAwesome";
import LText from "../../components/LText";
import RecipientInput from "../../components/RecipientInput";
import Clipboard from "@react-native-community/clipboard";
import TranslatedError from "../../components/TranslatedError";
import { validateTransactionData, addReceivedTransactionToAccount } from "@ledgerhq/live-common/families/mimblewimble_coin/react";
import { createAction } from "@ledgerhq/live-common/hw/actions/app";
import connectApp from "@ledgerhq/live-common/hw/connectApp";
import { navigateToSelectDevice } from "../../screens/ConnectDevice";
import { renderLoading } from "../../components/DeviceAction/rendering";
import DeviceAction from "../../components/DeviceAction";
import getTransactionResponse from "@ledgerhq/live-common/families/mimblewimble_coin/getTransactionResponse";
import { toAccountRaw } from "@ledgerhq/live-common/account/serialization";
import logger from "../../logger";
import ValidateError from "../../components/ValidateError";
import { urls } from "../../config/urls";
import qrcode from "qrcode";
import { updateAccountWithUpdater } from "../../actions/accounts";
import SkipLock from "../../components/behaviour/SkipLock";
import HeaderRightClose from "../../components/HeaderRightClose";
import ValidateReceiveOnDevice from "./ValidateReceiveOnDevice";
import ValidateReceiveSuccess from "./ValidateReceiveSuccess";

const openAction = createAction(connectApp);

const IconQRCode = ({ size, color }: { size: number; color: string }) => (
  <Icon name="qrcode" size={size} color={color} />
);

const styles = StyleSheet.create({
  separatorContainer: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center"
  },
  separatorLine: {
    flex: 1,
    borderBottomWidth: 1,
    marginHorizontal: 8
  },
  inputWrapper: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center"
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: "transparent"
  },
  warningBox: {
    marginTop: 8,
    ...Platform.select({
      android: {
        marginLeft: 6
      }
    })
  }
});

type Props = {
  account?: TokenAccount | Account;
  parentAccount?: Account;
  navigation: any;
  route: { params: RouteParams };
  readOnlyModeEnabled: boolean;
};

type RouteParams = {
  account?: AccountLike;
  accountId: string;
  parentId?: string;
  modelId: DeviceModelId;
  wired: boolean;
  device?: Device;
  currency?: Currency;
  createTokenAccount?: boolean;
  onSuccess?: (_?: string) => void;
  onError?: () => void;
};

export default function ReceiveConfirmation({ navigation }: Props) {
  const route = useRoute();
  const { account, parentAccount } = useSelector(accountScreenSelector(route));

  return account ? (
    <ReceiveConfirmationInner
      navigation={navigation}
      route={route}
      account={account}
      parentAccount={parentAccount}
    />
  ) : null;
}

function ReceiveConfirmationInner({
  navigation,
  route,
  account,
  parentAccount,
}: Props) {
  useEffect(() => {
    if(!route.params.verified) {
      if(navigation.getState().routes[0].name === ScreenName.ReceiveSelectCrypto) {
        navigation.reset({
          index: 1,
          routes: [
            navigation.getState().routes[0],
            {
              name: ScreenName.ReceiveConnectDevice,
              params: {
                ...route.params,
                notSkippable: true,
                transactionData: undefined
              }
            }
          ]
        });
      }
      else {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: ScreenName.ReceiveConnectDevice,
              params: {
                ...route.params,
                notSkippable: true,
                transactionData: undefined
              }
            }
          ]
        });
      }
    }
  }, []);
  if(!route.params.verified) {
    navigation.setOptions({
      headerLeft: null,
      headerRight: null,
      headerTitle: "",
      gestureEnabled: false
    });
    return null;
  }
  const { colors } = useTheme();
  const { t } = useTranslation();
  const verified = route.params?.verified;
  const [isModalOpened, setIsModalOpened] = useState(true);
  const [hasAddedTokenAccount, setHasAddedTokenAccount] = useState();
  const [isToastDisplayed, setIsToastDisplayed] = useState(false);
  const [isVerifiedToastDisplayed, setIsVerifiedToastDisplayed] =
    useState(verified);
  const [isAddionalInfoModalOpen, setIsAddionalInfoModalOpen] = useState(false);
  const [ enterTransaction, setEnterTransaction ] = useState(route.params.transactionData !== undefined);
  const [ transactionData, setTransactionData ] = useState("");
  const [ transactionDataError, setTransactionDataError ] = useState(undefined);
  const [ transactionDataWarning, setTransactionDataWarning ] = useState(undefined);
  const [ finalizeTransaction, setFinalizeTransaction ] = useState(false);
  const [ currentDevice, setCurrentDevice ] = useState(null);
  const getTransactionResponseSubscription = useRef(null);
  const [ processingTransactionError, setProcessingTransactionError ] = useState(null);
  const [ useTransactionResponseQrCode, setUseTransactionResponseQrCode ] = useState(true);
  const [ operationId, setOperationId ] = useState(null);
  const [ operationAmount, setOperationAmount ] = useState(null);
  const [ operationFee, setOperationFee ] = useState(null);
  const [ operationSenderPaymentProofAddress, setOperationSenderPaymentProofAddress] = useState(null);
  const [ signatureRequested, setSignatureRequested ] = useState(false);
  const [ signatureReceived, setSignatureReceived ] = useState(false);
  const [ transactionResponse, setTransactionResponse ] = useState(null);
  const dispatch = useDispatch();
  const lastRoute = usePreviousRouteName();
  const routerRoute = useRoute();

  const hideToast = useCallback(() => {
    setIsToastDisplayed(false);
  }, []);
  const hideVerifiedToast = useCallback(() => {
    setIsVerifiedToastDisplayed(false);
  }, []);

  const openAdditionalInfoModal = useCallback(() => {
    track("notification_clicked", {
      button: "Imported and created account",
      screen: routerRoute.name,
    });
    setIsAddionalInfoModalOpen(true);
    hideToast();
  }, [setIsAddionalInfoModalOpen, hideToast, routerRoute.name]);

  const closeAdditionalInfoModal = useCallback(() => {
    setIsAddionalInfoModalOpen(false);
  }, [setIsAddionalInfoModalOpen]);

  const onRetry = useCallback(() => {
    track("button_clicked", {
      button: "Verify your address",
      screen: routerRoute.name,
    });
    const params = { ...route.params, notSkippable: true };
    setIsModalOpened(false);
    navigation.navigate(ScreenName.ReceiveConnectDevice, params);
  }, [navigation, route.params, routerRoute]);

  const { width } = getWindowDimensions();
  const QRSize = Math.round(width / 1.8 - 16);
  const mainAccount = account && getMainAccount(account, parentAccount);
  const currency =
    route.params?.currency || (account && getAccountCurrency(account));

  useEffect(() => {
    if (route.params?.createTokenAccount && !hasAddedTokenAccount) {
      const newMainAccount = { ...mainAccount };
      if (
        !newMainAccount.subAccounts ||
        !newMainAccount.subAccounts.find(
          (acc: TokenAccount) => acc?.token?.id === currency.id,
        )
      ) {
        const emptyTokenAccount = makeEmptyTokenAccount(
          newMainAccount,
          currency,
        );
        newMainAccount.subAccounts = [
          ...(newMainAccount.subAccounts || []),
          emptyTokenAccount,
        ];

        // @TODO create a new action for adding a single account at a time instead of replacing
        dispatch(
          replaceAccounts({
            scannedAccounts: [newMainAccount],
            selectedIds: [newMainAccount.id],
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
  ]);

  useEffect(() => {
    setIsVerifiedToastDisplayed(verified);
    if (verified) {
      track("Verification Success", { currency: currency.name });
    }
  }, [verified, currency.name]);

  const onShare = useCallback(() => {
    track("button_clicked", {
      button: "Share",
      screen: routerRoute.name,
    });
    if (mainAccount?.freshAddress) {
      Share.share({ message: mainAccount?.freshAddress });
    }
  }, [mainAccount?.freshAddress, routerRoute.name]);

  const onCopy = useCallback(() => {
    track("button_clicked", {
      button: "Copy",
      screen: routerRoute.name,
    });
  }, [routerRoute.name]);

  const onContinue = useCallback(() => {
    setEnterTransaction(true);
  }, [setEnterTransaction]);
  const onFinalize = useCallback(() => {
    setFinalizeTransaction(true);
  }, [setFinalizeTransaction]);
  const onPressScan = useCallback(() => {
    navigation.navigate(ScreenName.MimbleWimbleCoinScanTransactionData, route.params);
  }, [navigation, route.params]);
  const onChangeTransactionData = useCallback((
    transactionData
  ) => {
   if(transactionData) {
      const {
        error,
        warning
      } = validateTransactionData(account.currency, transactionData);
      setTransactionDataError(error);
      setTransactionDataWarning(warning);
    }
    else {
      setTransactionDataError(undefined);
      setTransactionDataWarning(undefined);
    }
    setTransactionData(transactionData);
  }, [account, setTransactionDataError, setTransactionDataWarning, setTransactionData]);
  const clearTransactionData = useCallback(() => {
    onChangeTransactionData("");
  }, [onChangeTransactionData]);
  useEffect(() => {
    if(route.params.transactionData !== undefined) {
      setTransactionData(route.params.transactionData);
      onChangeTransactionData(route.params.transactionData);
    }
  }, [setTransactionData, route.params]);
  const onDeviceConnected = useCallback((
    {
      device
    } : {
      device: Device
    }
  ) => {
    setCurrentDevice(device);
    return renderLoading({ t });
  }, [setCurrentDevice, t]);
  useEffect(() => {
    if(currentDevice) {
      unsubscribe();
      getTransactionResponseSubscription.current = getTransactionResponse(toAccountRaw(account), currentDevice.deviceId, transactionData).subscribe({
        next: (
          {
            type,
            transactionResponse,
            freshAddress,
            nextIdentifier,
            operation
          }: {
            type: string;
            transactionResponse?: string;
            freshAddress?: Address;
            nextIdentifier?: string;
            operation?: OperationRaw;
          }
        ) => {
          switch(type) {
            case "device-signature-requested":
              setOperationAmount(operation.value);
              setOperationFee(operation.fee);
              setOperationSenderPaymentProofAddress(operation.senders.length ? operation.senders[0] : null);
              setSignatureRequested(true);
              break;
            case "device-signature-granted":
              setSignatureReceived(true);
              break;
            case "signed":
              qrcode.toString(transactionResponse, {
                errorCorrectionLevel: "L"
              }, (
                error: Error | null
              ) => {
                if(getTransactionResponseSubscription.current) {
                  setUseTransactionResponseQrCode(!error);
                  setCurrentDevice(null);
                  setOperationId(operation.id);
                  setOperationAmount(operation.value)
                  setTransactionResponse(transactionResponse);
                  dispatch(updateAccountWithUpdater(mainAccount.id, (
                    account: Account
                  ) => {
                    return addReceivedTransactionToAccount(account, freshAddress, nextIdentifier, operation);
                  }));
                }
              });
              break;
          }
        },
        error: (
          error: Error
        ) => {
          setProcessingTransactionError(error);
          setCurrentDevice(null);
          logger.critical(error);
        }
      });
    }
    else {
      unsubscribe();
    }
    return () => {
      unsubscribe();
    };
  }, [currentDevice]);
  const unsubscribe = () => {
    if(getTransactionResponseSubscription.current) {
      getTransactionResponseSubscription.current.unsubscribe();
      getTransactionResponseSubscription.current = null;
    }
  };
  const retry = useCallback(() => {
    navigation.navigate(ScreenName.ReceiveConfirmation, {
      ...route.params,
      verified: false,
      transactionData: undefined
    });
  }, [navigation]);
  const contactUs = useCallback(() => {
    Linking.openURL(urls.contact);
  }, []);
  const close = useCallback(() => {
    navigation.getParent().pop();
  }, [navigation]);
  const share = useCallback(() => {
    Share.share({ message: transactionResponse });
  }, [transactionResponse]);
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if(!signatureRequested || processingTransactionError) {
        navigation.navigate(ScreenName.ReceiveConfirmation, {
          ...route.params,
          verified: false,
          transactionData: undefined
        });
      }
      return true;
    });
    if(!signatureRequested) {
      navigation.setOptions({
        headerLeft: () => (
          <HeaderBackButton onPress={() => navigation.navigate(ScreenName.ReceiveConfirmation, {
            ...route.params,
            verified: false,
            transactionData: undefined
          })} />
        ),
        headerRight: () => (
          <HeaderRightClose />
        ),
        headerTitle: () => (
          <StepHeader
            subtitle={t("transfer.receive.stepperHeader.range", {
              currentStep: "3",
              totalSteps: 3,
            })}
            title={t("mimblewimble_coin.receiveFunds")}
          />
        ),
        gestureEnabled: Platform.OS === "ios"
      });
    }
    else {
      navigation.setOptions({
        headerLeft: null,
        headerRight: null,
        headerTitle: (processingTransactionError || transactionResponse !== null) ? "" : () => (
          <StepHeader
            subtitle={t("transfer.receive.stepperHeader.range", {
              currentStep: "3",
              totalSteps: 3,
            })}
            title={t("mimblewimble_coin.receiveFunds")}
          />
        ),
        gestureEnabled: false
      });
    }
    return () => backHandler.remove();
  }, [signatureRequested, signatureReceived, processingTransactionError, transactionResponse]);

  if (!account || !currency || !mainAccount) return null;

  return (
    <Flex flex={1}>
      <PreventNativeBack />
      <SyncSkipUnderPriority priority={100} />
      {(transactionResponse !== null) ? (
        <>
          <ValidateReceiveSuccess transactionResponse={transactionResponse} useTransactionResponseQrCode={useTransactionResponseQrCode} operationAmount={operationAmount} mainAccount={mainAccount} />
          <View style={[styles.container, { paddingVertical: 16 }]}>
            <Button event="ReceiveConfirmationShare" type="tertiary" title={<Trans i18nKey={"mimblewimble_coin.shareResponse"} />} onPress={share} />
            <View style={[{ marginTop: 16 }]} />
            <Button event="ReceiveConfirmationClose" type="primary" title={<Trans i18nKey={"common.close"} />} onPress={close} />
          </View>
        </>
      ) : processingTransactionError ? (
        <ValidateError
          error={processingTransactionError}
          onRetry={retry}
          onClose={close}
          onContactUs={contactUs}
        />
      ) : signatureReceived ? (
        <>
          {renderLoading({ t })}
        </>
      ) : signatureRequested ? (
        <>
          <SkipLock />
          <ValidateReceiveOnDevice
            account={account}
            parentAccount={parentAccount}
            device={route.params.device}
            amount={operationAmount}
            fee={operationFee}
            senderPaymentProofAddress={operationSenderPaymentProofAddress}
          />
        </>
      ) : finalizeTransaction ? (
        <Flex style={[styles.container, { flex: 1 }]}>
          <DeviceAction
            action={openAction}
            request={{
              account
            }}
            device={route.params.device}
            onSelectDeviceLink={() => navigateToSelectDevice(navigation, route)}
            renderOnResult={onDeviceConnected}
          />
        </Flex>
      ) : enterTransaction ? (
        <KeyboardView style={{ flex: 1 }}>
          <NavigationScrollView style={[styles.container, { flex: 1 }]} keyboardShouldPersistTaps="handled">
            <TrackScreen
              category="Receive"
              name="Enter Transaction"
              source={lastRoute}
              currency={currency.name}
            />
            <Text variant="body" fontWeight="medium" color="neutral.c70" textAlign="center" mt={4}>
              {t("mimblewimble_coin.transactionToReceive")}
            </Text>
            <Button mt={3}
              event="SendConnectDeviceQR"
              type="tertiary"
              title={<Trans i18nKey="send.recipient.scan" />}
              IconLeft={IconQRCode}
              onPress={onPressScan}
            />
            <View style={styles.separatorContainer}>
              <View style={[styles.separatorLine, { borderBottomColor: colors.lightFog }]} />
              <LText color="grey">{<Trans i18nKey="common.or" />}</LText>
              <View style={[styles.separatorLine, { borderBottomColor: colors.lightFog }]} />
            </View>
            <View style={styles.inputWrapper}>
              <RecipientInput
                onPaste={async () => {
                  const transactionData = await Clipboard.getString();
                  onChangeTransactionData(transactionData);
                }}
                onChangeText={onChangeTransactionData}
                onInputCleared={clearTransactionData}
                value={transactionData}
                placeholder={t("mimblewimble_coin.enterTransaction")}
              />
            </View>
            {(transactionDataError || transactionDataWarning) ? (
              <LText style={styles.warningBox} color={transactionDataError ? "alert" : transactionDataWarning ? "orange" : "darkBlue"}>
                <TranslatedError error={transactionDataError || transactionDataWarning} />
              </LText>
            ) : null}
          </NavigationScrollView>
          <Flex m={6}>
            <Button
              event="ReceiveConfirmationFinalize"
              type="primary"
              title={<Trans i18nKey={"common.continue"} />}
              disabled={!transactionData || transactionDataError}
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
              source={lastRoute}
              currency={currency.name}
            />
            <Flex p={6} alignItems="center" justifyContent="center">
              <Text color="neutral.c100" fontWeight="semiBold" variant="h4" mb={3}>
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
                      {t("transfer.receive.receiveConfirmation.addressVerified")}
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
                          {t("transfer.receive.receiveConfirmation.verifyAddress")}
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
                  <QRCode size={QRSize} value={mainAccount.freshAddress} ecl="H" />
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
                    color={colors.constant.white}
                    bg={
                      currency?.color ||
                      currency.parentCurrency?.color ||
                      colors.constant.black
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
                  replacement={<Trans i18nKey="transfer.receive.addressCopied" />}
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
            ) : (isVerifiedToastDisplayed && false) ? (
              <Notification
                Icon={Icons.CircledCheckMedium}
                variant={"success"}
                title={t("transfer.receive.toastMessages.addressVerified")}
                onClose={hideVerifiedToast}
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
