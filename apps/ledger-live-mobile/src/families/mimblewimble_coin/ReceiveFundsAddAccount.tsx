import React, { useEffect, useCallback, useState, useRef, memo } from "react";
import { FlatList } from "react-native";
import { concat, from } from "rxjs";
import type { Subscription } from "rxjs";
import { ignoreElements } from "rxjs/operators";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import type { Account, TokenAccount } from "@ledgerhq/types-live";
import { Currency } from "@ledgerhq/types-cryptoassets";
import { getCurrencyBridge } from "@ledgerhq/live-common/bridge/index";

import { Flex, InfiniteLoader, Log } from "@ledgerhq/native-ui";
import { makeEmptyTokenAccount } from "@ledgerhq/live-common/account/index";
import type { Device } from "@ledgerhq/live-common/hw/actions/types";
import styled from "styled-components/native";
import { useTheme } from "@react-navigation/native";
import { replaceAccounts } from "../../actions/accounts";
import logger from "../../logger";
import { ScreenName } from "../../const";
import { TrackScreen } from "../../analytics";
import Button from "../../components/Button";
import PreventNativeBack from "../../components/PreventNativeBack";
import LText from "../../components/LText";
import RetryButton from "../../components/RetryButton";
import CancelButton from "../../components/CancelButton";
import GenericErrorBottomModal from "../../components/GenericErrorBottomModal";
import { prepareCurrency } from "../../bridge/cache";
import AccountCard from "../../components/AccountCard";
import { ReceiveFundsStackParamList } from "../../components/RootNavigator/types/ReceiveFundsNavigator";
import {
  StackNavigatorNavigation,
  StackNavigatorProps,
} from "../../components/RootNavigator/types/helpers";
import { RootStackParamList } from "../../components/RootNavigator/types/RootNavigator";
import Animation from "../../components/Animation";
import { getDeviceAnimation } from "../../helpers/getDeviceAnimation";
import SkipLock from "../../components/behaviour/SkipLock";
import BottomModal from "../../components/BottomModal";

const DeviceActionContainer = styled(Flex).attrs({
  flexDirection: "row",
})``;

const Wrapper = styled(Flex).attrs({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  minHeight: "160px",
})``;

type AnimationContainerExtraProps = {
  withConnectDeviceHeight?: boolean;
  withVerifyAddressHeight?: boolean;
};
const AnimationContainer = styled(Flex).attrs(
  (p: AnimationContainerExtraProps) => ({
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    height: p.withConnectDeviceHeight
      ? "100px"
      : p.withVerifyAddressHeight
      ? "72px"
      : undefined,
  }),
)<AnimationContainerExtraProps>``;

const TitleContainer = styled(Flex).attrs({
  py: 8,
})``;

const TitleText = ({
  children,
  disableUppercase,
}: {
  children: React.ReactNode;
  disableUppercase?: boolean;
}) => (
  <TitleContainer>
    <Log
      extraTextProps={disableUppercase ? { textTransform: "none" } : undefined}
    >
      {children}
    </Log>
  </TitleContainer>
);

const ApproveExportRootPublicKeyOnDevice = ({
  device,
  accountIndex,
}: {
  device: Device;
  accountIndex: number;
}) => {
  const { dark } = useTheme();
  const { t } = useTranslation();
  const theme: "dark" | "light" = dark ? "dark" : "light";
  return (
    <Flex>
      <DeviceActionContainer>
        <Wrapper>
          <AnimationContainer
            marginTop="16px"
            withVerifyAddressHeight={device.modelId !== "blue"}
          >
            <Animation
              source={getDeviceAnimation({ device, key: "validate", theme })}
            />
          </AnimationContainer>
          <TitleText>
            {t("mimblewimble_coin.approveExportingRootPublicKey", {
              accountIndex: accountIndex.toFixed(),
            })}
          </TitleText>
        </Wrapper>
      </DeviceActionContainer>
    </Flex>
  );
};

type Props = StackNavigatorProps<
  ReceiveFundsStackParamList,
  ScreenName.ReceiveAddAccount
>;

function AddAccountsAccounts(props: Props) {
  const { route, navigation } = props;
  const { currency, device } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState(null);
  const [scannedAccounts, setScannedAccounts] = useState<Account[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [rootPublicKeyRequested, setRootPublicKeyRequested] = useState(false);
  const [accountIndex, setAccountIndex] = useState(0);

  const scanSubscription = useRef<Subscription | null>();

  useEffect(() => {
    startSubscription();
    return () => stopSubscription(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSubscription = useCallback(() => {
    const c =
      currency.type === "TokenCurrency" ? currency.parentCurrency : currency;
    const bridge = getCurrencyBridge(c);
    const syncConfig = {
      paginationConfig: {
        operations: 0,
      },
      blacklistedTokenIds: [],
    };
    // will be set to false if an existing account is found
    // @TODO observable similar to the one in AddAccounts Flow maybe refactor both in single workflow
    scanSubscription.current = concat(
      from(prepareCurrency(c)).pipe(ignoreElements()),
      bridge.scanAccounts({
        currency: c,
        deviceId: device.deviceId,
        syncConfig,
      }),
    ).subscribe({
      next: event => {
        const { type } = event;
        switch (type) {
          case "discovered": {
            const { account } = event;
            if (currency.type === "TokenCurrency") {
              // handle token accounts cases where we want to create empty new token accounts
              const pa = { ...(account as Account) };

              if (
                !pa.subAccounts ||
                !pa.subAccounts.find(
                  a => (a as TokenAccount)?.token?.id === currency.id,
                ) // in case we dont already have one we create an empty token account
              ) {
                const tokenAcc = makeEmptyTokenAccount(pa, currency);
                const tokenA = {
                  ...tokenAcc,
                  parentAccount: pa,
                };

                pa.subAccounts = [...(pa.subAccounts || []), tokenA];
              }

              setScannedAccounts((accs: Account[]) => [...accs, pa]); // add the account with the newly added token account to the list of scanned accounts
            } else {
              setScannedAccounts((accs: Account[]) => [
                ...accs,
                account as Account,
              ]); // add the account to the list of scanned accounts
            }
            break;
          }
          case "device-root-public-key-requested": {
            const { index } = event;
            setAccountIndex(index);
            setRootPublicKeyRequested(true);
            break;
          }
          case "device-root-public-key-granted":
            setRootPublicKeyRequested(false);
            break;
          default:
            break;
        }
      },
      complete: () => {
        setRootPublicKeyRequested(false);
        setScanning(false);
      },
      error: error => {
        setRootPublicKeyRequested(false);
        logger.critical(error);
        setError(error);
      },
    });
  }, [currency, device.deviceId]);

  const restartSubscription = useCallback(() => {
    const c =
      currency.type === "TokenCurrency" ? currency.parentCurrency : currency;
    setScanning(true);
    setScannedAccounts([]);
    setError(null);
    setCancelled(false);
    navigation.navigate(ScreenName.ReceiveAddAccountSelectDevice, {
      ...(route?.params ?? {}),
      currency: c,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSubscription = useCallback((syncUI = true) => {
    if (scanSubscription.current) {
      scanSubscription.current.unsubscribe();
      scanSubscription.current = null;
      if (syncUI) {
        setScanning(false);
      }
    }
  }, []);

  const onCancel = useCallback(() => {
    setError(null);
    setCancelled(true);
  }, []);

  const onModalHide = useCallback(() => {
    if (cancelled) {
      navigation
        .getParent<StackNavigatorNavigation<RootStackParamList>>()
        ?.pop();
    }
  }, [cancelled, navigation]);

  const selectAccount = useCallback(
    (account: Account) => {
      if (!selectedAccount) {
        setSelectedAccount(account.id);
        dispatch(
          replaceAccounts({
            scannedAccounts,
            selectedIds: [account.id],
            renamings: {},
          }),
        );
        navigation.navigate(ScreenName.ReceiveConfirmation, {
          ...route.params,
          accountId: account.id,
        });
      }
    },
    [dispatch, navigation, route.params, scannedAccounts, selectedAccount],
  );

  const renderItem = useCallback(
    ({ item: account }: { item: Account }) => {
      const acc =
        currency.type === "TokenCurrency"
          ? account.subAccounts?.find(
              a => (a as TokenAccount).token.id === currency.id,
            )
          : account;

      return acc ? (
        <Flex px={6}>
          <AccountCard
            account={acc}
            onPress={() => selectAccount(account)}
            AccountSubTitle={
              currency.type === "TokenCurrency" ? (
                <LText color="neutral.c70">{account.name}</LText>
              ) : null
            }
          />
        </Flex>
      ) : null;
    },
    [currency.id, currency.type, selectAccount],
  );

  const renderHeader = useCallback(
    () => (
      <Flex p={6}>
        <LText fontSize="32px" fontFamily="InterMedium" semiBold>
          {t("transfer.receive.selectAccount.title")}
        </LText>
        <LText variant="body" color="neutral.c70">
          {t("transfer.receive.selectAccount.subtitle", {
            currencyTicker: currency.ticker,
          })}
        </LText>
      </Flex>
    ),
    [currency.ticker, t],
  );

  const keyExtractor = useCallback(item => item?.id, []);

  return (
    <>
      <TrackScreen
        category="AddAccounts"
        name="Accounts"
        currencyName={currency.name}
      />
      <PreventNativeBack />
      {rootPublicKeyRequested ? <SkipLock /> : null}
      {scanning ? (
        <ScanLoading
          currency={currency}
          scannedAccounts={scannedAccounts}
          stopSubscription={stopSubscription}
        />
      ) : (
        <FlatList
          data={scannedAccounts}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
        />
      )}
      <GenericErrorBottomModal
        error={error}
        onModalHide={onModalHide}
        footerButtons={
          <>
            <CancelButton flex={1} mx={8} onPress={onCancel} />
            <RetryButton flex={1} mx={8} onPress={restartSubscription} />
          </>
        }
      />
      <BottomModal isOpened={rootPublicKeyRequested} noCloseButton={true}>
        <ApproveExportRootPublicKeyOnDevice
          device={device}
          accountIndex={accountIndex}
        />
      </BottomModal>
    </>
  );
}

function ScanLoading({
  currency,
  scannedAccounts,
  stopSubscription,
}: {
  currency: Currency;
  scannedAccounts: Account[];
  stopSubscription: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Flex flex={1} alignItems="center" justifyContent="center" m={6}>
        <InfiniteLoader size={48} />
        <LText mt={13} variant="h4" textAlign="center">
          {t("transfer.receive.addAccount.title")}
        </LText>
        <LText p={6} textAlign="center" variant="body" color="neutral.c80">
          {t("transfer.receive.addAccount.subtitle", {
            currencyTicker: currency?.ticker,
          })}
        </LText>
      </Flex>
      <Flex
        minHeight={120}
        flexDirection="column"
        alignItems="stretch"
        m={6}
        justifyContent="flex-end"
      >
        {scannedAccounts?.length > 0 ? (
          <>
            <LText textAlign="center" mb={6} variant="body" color="neutral.c80">
              {t("transfer.receive.addAccount.foundAccounts", {
                count: scannedAccounts?.length,
              })}
            </LText>
            <Button type="secondary" onPress={stopSubscription}>
              {t("transfer.receive.addAccount.stopSynchronization")}
            </Button>
          </>
        ) : null}
      </Flex>
    </>
  );
}

export default memo(AddAccountsAccounts);
