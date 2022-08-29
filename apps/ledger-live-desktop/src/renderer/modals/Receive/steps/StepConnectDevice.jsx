// @flow

import React from "react";
import { getMainAccount } from "@ledgerhq/live-common/account/helpers";
import Box from "~/renderer/components/Box";
import Button from "~/renderer/components/Button";
import DeviceAction from "~/renderer/components/DeviceAction";
import { createAction } from "@ledgerhq/live-common/hw/actions/app";
import CurrencyDownStatusAlert from "~/renderer/components/CurrencyDownStatusAlert";
import TrackPage from "~/renderer/analytics/TrackPage";
import { command } from "~/renderer/commands";

import type { StepProps } from "../Body";
import { mockedEventEmitter } from "~/renderer/components/debug/DebugMock";
import { getEnv } from "@ledgerhq/live-common/env";
import invariant from "invariant";
import byFamily from "~/renderer/generated/ReceiveStepConnectDevice";

const connectAppExec = command("connectApp");

const action = createAction(getEnv("MOCK") ? mockedEventEmitter : connectAppExec);

export default function StepConnectDevice({
  account,
  parentAccount,
  token,
  transitionTo,
}: StepProps) {
  const mainAccount = account ? getMainAccount(account, parentAccount) : null;
  const tokenCurrency = (account && account.type === "TokenAccount" && account.token) || token;
  return (
    <>
      {mainAccount ? <CurrencyDownStatusAlert currencies={[mainAccount.currency]} /> : null}
      <DeviceAction
        action={action}
        request={{ account: mainAccount, tokenCurrency }}
        onResult={() => transitionTo("receive")}
        analyticsPropertyFlow="receive"
      />
    </>
  );
}

export function StepConnectDeviceFooter(props: StepProps) {
  const {
    account,
    parentAccount,
    t,
    transitionTo,
    onSkipConfirm,
    device,
    eventType,
    currencyName,
  } = props;

  const mainAccount = account ? getMainAccount(account, parentAccount) : null;
  invariant(account && mainAccount, "No account given");

  // custom family UI for StepConnectDeviceFooter
  const CustomStepConnectDevice = byFamily[mainAccount.currency.family];
  if (CustomStepConnectDevice && CustomStepConnectDevice.StepConnectDeviceFooter) {
    return <CustomStepConnectDevice.StepConnectDeviceFooter {...props} />;
  }

  return (
    <Box horizontal flow={2}>
      <TrackPage
        category={`Receive Flow${eventType ? ` (${eventType})` : ""}`}
        name="Step 2"
        currencyName={currencyName}
      />
      <Button
        event="Receive Flow Without Device Clicked"
        data-test-id="receive-connect-device-skip-device-button"
        onClick={onSkipConfirm}
      >
        {t("receive.steps.connectDevice.withoutDevice")}
      </Button>
    </Box>
  );
}
