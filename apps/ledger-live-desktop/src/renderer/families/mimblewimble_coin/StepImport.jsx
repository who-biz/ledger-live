// @flow
import React, { useEffect, useRef, useCallback, PureComponent } from "react";
import styled from "styled-components";
import { Trans } from "react-i18next";
import { concat, from } from "rxjs";
import { ignoreElements, filter, map } from "rxjs/operators";
import type { Account } from "@ledgerhq/types-live";
import { isAccountEmpty, groupAddAccounts } from "@ledgerhq/live-common/account/index";
import { DeviceShouldStayInApp } from "@ledgerhq/errors";
import { getCurrencyBridge } from "@ledgerhq/live-common/bridge/index";
import uniq from "lodash/uniq";
import { urls } from "~/config/urls";
import logger from "~/logger";
import { prepareCurrency } from "~/renderer/bridge/cache";
import TrackPage from "~/renderer/analytics/TrackPage";
import RetryButton from "~/renderer/components/RetryButton";
import Box from "~/renderer/components/Box";
import Button from "~/renderer/components/Button";
import CurrencyBadge from "~/renderer/components/CurrencyBadge";
import AccountsList from "~/renderer/components/AccountsList";
import Spinner from "~/renderer/components/Spinner";
import Text from "~/renderer/components/Text";
import ErrorDisplay from "~/renderer/components/ErrorDisplay";
import type { StepProps } from "~/renderer/modals/AddAccounts";
import { renderVerifyUnwrapped } from "~/renderer/components/DeviceAction/rendering";
import useTheme from "~/renderer/hooks/useTheme";
import { useDeviceBlocked } from "~/renderer/components/DeviceAction/DeviceBlocker";

const remapTransportError = (
  err: mixed,
  appName: string
): Error => {
  if(!err || typeof err !== "object") {
    return err;
  }
  const {
    name,
    statusCode
  } = err;
  const errorToThrow = (name === "BtcUnmatchedApp" || statusCode === 0x6982 || statusCode === 0x6700) ? new DeviceShouldStayInApp(null, {
    appName
  }) : err;
  return errorToThrow;
};

const LoadingRow = styled(Box).attrs(() => ({
  horizontal: true,
  borderRadius: 1,
  px: 3,
  alignItems: "center",
  justifyContent: "center",
  mt: 1
}))`
  height: 48px;
  border: 1px dashed ${p => p.theme.colors.palette.text.shade60};
`;

const SectionAccounts = (
  {
    defaultSelected,
    ...rest
  }: any
) => {
  useEffect(() => {
    if(defaultSelected && rest.onSelectAll) {
      rest.onSelectAll(rest.accounts);
    }
  }, []);
  return <AccountsList {...rest} />;
};

const Separator = styled.div`
  border-top: 1px solid #99999933;
  margin: 50px 0;
`;

const ApproveExportRootPublicKeyOnDevice = (
  {
    modelId,
    accountIndex
  }: {
    modelId: string;
    accountIndex: number;
  }
) => {
  const type = useTheme("colors.palette.type");
  return (
    <>
      <Separator />
      <Box horizontal alignItems="center" flow={2}>
        <Text
          style={{ flexShrink: "unset" }}
          ff="Inter|SemiBold"
          color="palette.text.shade100"
          fontSize={4}
        >
          <Trans i18nKey="families.mimblewimble_coin.approveExportingRootPublicKey" values={{ accountIndex: accountIndex.toFixed() }} />
        </Text>
      </Box>
      {renderVerifyUnwrapped({ modelId, type })}
    </>
  );
};

type State = {
  modelId: string | undefined,
  accountIndex: number | undefined
};

class StepImport extends PureComponent<StepProps, State> {

  constructor(
    props: StepProps
  ) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.props.setScanStatus("scanning");
  }

  componentDidUpdate(
    prevProps: StepProps
  ) {
    const didStartScan = prevProps.scanStatus !== "scanning" && this.props.scanStatus === "scanning";
    const didFinishScan = prevProps.scanStatus !== "finished" && this.props.scanStatus === "finished";
    if(didStartScan) {
      this.startScanAccountsDevice();
    }
    if(didFinishScan) {
      this.unsub();
    }
  }

  componentWillUnmount() {
    this.unsub();
  }

  scanSubscription = null;

  unsub = () => {
    if(this.scanSubscription) {
      this.scanSubscription.unsubscribe();
    }
  };

  startScanAccountsDevice() {
    this.unsub();

    const {
      currency,
      device,
      setScanStatus,
      setScannedAccounts,
      blacklistedTokenIds
    } = this.props;

    if(!currency || !device) {
      return;
    }
    const mainCurrency = (currency.type === "TokenCurrency") ? currency.parentCurrency : currency;

    try {
      const bridge = getCurrencyBridge(mainCurrency);
      let onlyNewAccounts: boolean = true;
      const syncConfig = {
        paginationConfig: {
          operations: 20
        },
        blacklistedTokenIds
      };

      this.scanSubscription = concat(
        from(prepareCurrency(mainCurrency)).pipe(ignoreElements()),
        bridge.scanAccounts({
          currency: mainCurrency,
          deviceId: device.deviceId,
          syncConfig
        })
      ).pipe(
        filter(e => e.type === "discovered" || e.type === "device-root-public-key-requested" || e.type === "device-root-public-key-granted")
      ).subscribe({
        next: (
         event
        ) => {
          switch(event.type) {
            case "discovered":
              const account = event.account;
              const {
                scannedAccounts,
                checkedAccountsIds,
                existingAccounts
              } = this.props;
              const hasAlreadyBeenScanned = !!scannedAccounts.find(a => account.id === a.id);
              const hasAlreadyBeenImported = !!existingAccounts.find(a => account.id === a.id);
              const isNewAccount = isAccountEmpty(account);

              if(!isNewAccount && !hasAlreadyBeenImported) {
                onlyNewAccounts = false;
              }
              if(!hasAlreadyBeenScanned) {
                setScannedAccounts({
                  scannedAccounts: [...scannedAccounts, account],
                  checkedAccountsIds: onlyNewAccounts ? ((hasAlreadyBeenImported || checkedAccountsIds.length > 0) ? checkedAccountsIds : [account.id]) : ((!hasAlreadyBeenImported && !isNewAccount) ? uniq([...checkedAccountsIds, account.id]) : checkedAccountsIds)
                });
              }
              break;
            case "device-root-public-key-requested":
              this.setState({
                modelId: device.modelId,
                accountIndex: event.index
              });
              break;
            case "device-root-public-key-granted":
              this.setState({
                modelId: undefined,
                accountIndex: undefined
              });
              break;
          }
        },
        complete: () => {
          this.setState({
            modelId: undefined,
            accountIndex: undefined
          });
          setScanStatus("finished");
        },
        error: (
          err
        ) => {
          this.setState({
            modelId: undefined,
            accountIndex: undefined
          });
          logger.critical(err);
          const error = remapTransportError(err, currency.name);
          setScanStatus("error", error);
        }
      });
    }
    catch(
      err: any
    ) {
      setScanStatus("error", err);
    }
  }

  handleRetry = () => {
    this.unsub();
    this.props.resetScanState();
    this.startScanAccountsDevice();
  };

  handleToggleAccount = (
    account: Account
  ) => {
    const {
      checkedAccountsIds,
      setScannedAccounts
    } = this.props;
    const isChecked = checkedAccountsIds.find(id => id === account.id) !== undefined;
    if(isChecked) {
      setScannedAccounts({
        checkedAccountsIds: checkedAccountsIds.filter(id => id !== account.id),
      });
    } else {
      setScannedAccounts({
        checkedAccountsIds: [...checkedAccountsIds, account.id]
      });
    }
  };

  handleSelectAll = (
    accountsToSelect: Account[]
  ) => {
    const {
      setScannedAccounts,
      checkedAccountsIds
    } = this.props;
    setScannedAccounts({
      checkedAccountsIds: uniq(checkedAccountsIds.concat(accountsToSelect.map(a => a.id))),
    });
  };

  handleUnselectAll = (
    accountsToRemove: Account[]
  ) => {
    const {
      setScannedAccounts,
      checkedAccountsIds
    } = this.props;
    setScannedAccounts({
      checkedAccountsIds: checkedAccountsIds.filter(id => !accountsToRemove.some(a => id === a.id)),
    });
  };

  render() {
    const {
      scanStatus,
      currency,
      err,
      scannedAccounts,
      checkedAccountsIds,
      existingAccounts,
      setAccountName,
      editedNames,
      t
    } = this.props;
    const {
      modelId,
      accountIndex
    } = this.state;

    if(!currency) {
      return null;
    }

    const mainCurrency = (currency.type === "TokenCurrency") ? currency.parentCurrency : currency;
    const newAccountSchemes = scannedAccounts.filter(a1 => !existingAccounts.map(a2 => a2.id).includes(a1.id) && !a1.used).map(a => a.derivationMode);
    const preferredNewAccountScheme = (newAccountSchemes && newAccountSchemes.length > 0) ? newAccountSchemes[0] : undefined;

    if(err) {
      const errorHandled = ["UserRefusedOnDevice", "DisconnectedDevice", "DisconnectedDeviceDuringOperation"].indexOf(err.name) !== -1;
      return (
        <ErrorDisplay
          error={err}
          withExportLogs={!errorHandled}
          supportLink={errorHandled ? undefined : urls.syncErrors}
        />
      );
    }

    const currencyName = mainCurrency ? mainCurrency.name : "";
    const {
      sections,
      alreadyEmptyAccount
    } = groupAddAccounts(existingAccounts, scannedAccounts, {
      scanning: scanStatus === "scanning",
      preferredNewAccountSchemes: [preferredNewAccountScheme]
    });

    let creatable;
    if(alreadyEmptyAccount) {
      creatable = (
        <Trans i18nKey="addAccounts.createNewAccount.noOperationOnLastAccount" parent="div">
          {" "}
          <Text ff="Inter|SemiBold" color="palette.text.shade100">
            {alreadyEmptyAccount.name}
          </Text>{" "}
        </Trans>
      );
    }
    else {
      creatable = (
        <Trans i18nKey="addAccounts.createNewAccount.noAccountToCreate" parent="div">
          {" "}
          <Text ff="Inter|SemiBold" color="palette.text.shade100">
            {currencyName}
          </Text>{" "}
        </Trans>
      );
    }

    const emptyTexts = {
      importable: t("addAccounts.noAccountToImport", {currencyName}),
      creatable
    };

    return (
      <>
        <TrackPage category="AddAccounts" name="Step3" currencyName={currencyName} />
        <Box mt={-4}>
          {sections.map(({
            id,
            selectable,
            defaultSelected,
            data,
            supportLink
          }, i) => {
            return (
              <SectionAccounts
                currency={currency}
                defaultSelected={defaultSelected}
                key={id}
                title={t(`addAccounts.sections.${id}.title`, {count: data.length})}
                emptyText={emptyTexts[id]}
                accounts={data}
                autoFocusFirstInput={selectable && i === 0}
                hideAmount={id === "creatable"}
                supportLink={supportLink}
                checkedIds={!selectable ? undefined : checkedAccountsIds}
                onToggleAccount={!selectable ? undefined : this.handleToggleAccount}
                setAccountName={!selectable ? undefined : setAccountName}
                editedNames={!selectable ? undefined : editedNames}
                onSelectAll={!selectable ? undefined : this.handleSelectAll}
                onUnselectAll={!selectable ? undefined : this.handleUnselectAll}
              />
            );
          })}
          {scanStatus === "scanning" ? (
            <LoadingRow>
              <Spinner color="palette.text.shade60" size={16} />
              <Box ml={2} ff="Inter|Regular" color="palette.text.shade60" fontSize={4}>
                {t("common.sync.syncing")}
              </Box>
            </LoadingRow>
          ) : null}
        </Box>
        {(modelId !== undefined) ? (
          <ApproveExportRootPublicKeyOnDevice modelId={modelId} accountIndex={accountIndex} />
        ) : null}
        {err && <Box shrink>{err.message}</Box>}
      </>
    );
  }
}

const StepImportFooter = (
  props: StepProps
) => {
  const {
    transitionTo,
    setScanStatus,
    scanStatus,
    onClickAdd,
    onCloseModal,
    resetScanState,
    checkedAccountsIds,
    scannedAccounts,
    currency,
    err,
    t,
    device
  } = props;
  const initialDevice = useRef(device);

  const willCreateAccount = checkedAccountsIds.some((
    id
  ) => {
    const account = scannedAccounts.find(a => a.id === id);
    return account && isAccountEmpty(account);
  });

  const willAddAccounts = checkedAccountsIds.some((
    id
  ) => {
    const account = scannedAccounts.find(a => a.id === id);
    return account && !isAccountEmpty(account);
  });

  const count = checkedAccountsIds.length;
  const willClose = !willCreateAccount && !willAddAccounts;
  const ctaWording = (scanStatus === "scanning") ? t("common.sync.syncing") : (willClose ? t("common.close") : t("addAccounts.cta.add", {count}));

  const onClick = willClose ? onCloseModal : async () => {
    await onClickAdd();
    transitionTo("finish");
  };

  const onRetry = useCallback(() => {
    resetScanState();
    if(device !== initialDevice.current) {
      transitionTo("connectDevice");
    }
    else {
      setScanStatus("scanning");
    }
  }, [resetScanState, device, transitionTo, setScanStatus]);

  if(useDeviceBlocked()) {
    return null;
  }

  return (
    <>
      <Box grow>{currency && <CurrencyBadge currency={currency} />}</Box>
      {(scanStatus === "error") ? (
        <RetryButton
          data-test-id={"add-accounts-import-retry-button"}
          primary
          onClick={onRetry}
        />
      ) : null}
      {(scanStatus === "scanning") ? (
        <Button
          data-test-id={"add-accounts-import-stop-button"}
          onClick={() => setScanStatus("finished")}
        >
          {t("common.stop")}
        </Button>
      ) : null}
      {(scanStatus === "error") ? null : (
        <Button
          data-test-id={"add-accounts-import-add-button"}
          primary
          disabled={scanStatus !== "finished"}
          onClick={onClick}
        >
          {ctaWording}
        </Button>
      )}
    </>
  );
};

export default {
  StepImport,
  StepImportFooter
};
