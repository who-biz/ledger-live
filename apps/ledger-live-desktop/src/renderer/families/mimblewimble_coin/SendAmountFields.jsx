// @flow
import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import type { Account } from "@ledgerhq/types-live";
import type { Transaction, TransactionStatus } from "@ledgerhq/live-common/generated/types";
import InputCurrency from "~/renderer/components/InputCurrency";
import Box from "~/renderer/components/Box";
import SendFeeMode from "~/renderer/components/SendFeeMode";
import BigNumber from "bignumber.js";
import Label from "~/renderer/components/Label";
import { Trans } from "react-i18next";
import { counterValueCurrencySelector } from "~/renderer/reducers/settings";
import { useSendAmount } from "@ledgerhq/live-common/countervalues/react";
import { useSelector } from "react-redux";
import TranslatedError from "~/renderer/components/TranslatedError";

const InputRight = styled(Box).attrs(() => ({
  ff: "Inter|Medium",
  color: "palette.text.shade60",
  fontSize: 4,
  justifyContent: "center"
}))`
  padding-right: 10px;
`;

const ErrorContainer = styled(Box)`
  margin-top: 0px;
  font-size: 12px;
  width: 100%;
  transition: all 0.4s ease-in-out;
  will-change: max-height;
  max-height: ${p => (p.hasError ? 60 : 0)}px;
  min-height: ${p => (p.hasError ? 20 : 0)}px;
`;

const ErrorDisplay = styled(Box)`
  color: ${p => p.theme.colors.pearl};
`;

type Props = {
  account: Account,
  transaction: Transaction,
  status: TransactionStatus,
  onChange: Transaction => void
};

const SendAmountFields = (
  props: Props
) => {
  const {
    account,
    transaction,
    status,
    onChange
  } = props;
  const {
    cryptoUnit,
    fiatAmount,
    fiatUnit,
    calculateCryptoAmount
  } = useSendAmount({
    account,
    fiatCurrency: useSelector(counterValueCurrencySelector),
    cryptoAmount: transaction.baseFee
  });

  const onChangeUseDefaultBaseFee = useCallback((
    useDefaultBaseFee: boolean
  ) => {
    const bridge = getAccountBridge(account);
    onChange(bridge.updateTransaction(transaction, {
      useDefaultBaseFee: !useDefaultBaseFee
    }));
  }, [account, onChange, transaction]);

  const onChangeBaseFee = useCallback((
    baseFee: string
  ) => {
    const bridge = getAccountBridge(account);
    onChange(bridge.updateTransaction(transaction, {
      baseFee: new BigNumber(baseFee)
    }));
  }, [account, onChange, transaction]);

  return (
    <>
      <SendFeeMode isAdvanceMode={!transaction.useDefaultBaseFee} setAdvanceMode={onChangeUseDefaultBaseFee} useLink={false} />
      {!transaction.useDefaultBaseFee ? (
        <Box>
          <Label>
            <Trans i18nKey="families.mimblewimble_coin.baseFee" />
          </Label>
          <Box vertical>
            <InputCurrency
              hideErrorMessage
              error={status.errors.baseFee}
              containerProps={{ grow: true }}
              defaultUnit={cryptoUnit}
              value={transaction.baseFee}
              onChange={onChangeBaseFee}
              renderRight={<InputRight>{cryptoUnit.code}</InputRight>}
            />
            <ErrorContainer hasError={status.errors.baseFee}>
              {status.errors.baseFee ? (
                <ErrorDisplay>
                  <TranslatedError error={status.errors.baseFee} />
                </ErrorDisplay>
              ) : null}
            </ErrorContainer>
          </Box>
        </Box>
      ) : null}
    </>
  );
}

export default {
  component: SendAmountFields,
  fields: ["baseFee"]
};
