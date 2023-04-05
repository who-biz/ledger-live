import React from "react";
import TrackPage from "~/renderer/analytics/TrackPage";
import GenericStepConnectDevice from "./GenericStepConnectDevice";
import { StepProps } from "../types";
export default function StepConnectDevice({
  account,
  parentAccount,
  transaction,
  status,
  transitionTo,
  onOperationBroadcasted,
  onTransactionError,
  setSigned,
  isNFTSend,
  onConfirmationHandler,
  onFailHandler,
  currencyName,
}: StepProps) {
  return (
    <>
      <TrackPage
        category="Send Flow"
        name="Step ConnectDevice"
        currencyName={currencyName}
        isNFTSend={isNFTSend}
      />
      <GenericStepConnectDevice
        account={account}
        parentAccount={parentAccount}
        transaction={transaction}
        status={status}
        transitionTo={transitionTo}
        onOperationBroadcasted={onOperationBroadcasted}
        onTransactionError={onTransactionError}
        setSigned={setSigned}
        onConfirmationHandler={onConfirmationHandler}
        onFailHandler={onFailHandler}
      />
    </>
  );
}

export function StepConnectDeviceFooter(props: StepProps) {
  const { account, parentAccount } = props;

  const mainAccount = account ? getMainAccount(account, parentAccount) : null;
  invariant(account && mainAccount, "No account given");

  // custom family UI for StepConnectDeviceFooter
  const CustomStepConnectDevice = byFamily[mainAccount.currency.family];
  if (CustomStepConnectDevice && CustomStepConnectDevice.StepConnectDeviceFooter) {
    return <CustomStepConnectDevice.StepConnectDeviceFooter {...props} />;
  }

  return null;
}
