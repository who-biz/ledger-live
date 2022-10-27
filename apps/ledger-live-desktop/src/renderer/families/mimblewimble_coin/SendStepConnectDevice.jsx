// @flow
import React, { PureComponent } from "react";
import invariant from "invariant";
import type { StepProps } from "~/renderer/modals/Send/types";
import TrackPage from "~/renderer/analytics/TrackPage";
import { Trans } from "react-i18next";
import type { Device } from "@ledgerhq/live-common/hw/actions/types";
import DeviceAction from "~/renderer/components/DeviceAction";
import StepProgress from "~/renderer/components/StepProgress";
import { createAction as createTransactionAction } from "@ledgerhq/live-common/hw/actions/transaction";
import { createAction as createOpenAction } from "@ledgerhq/live-common/hw/actions/app";
import type { Address, Operation, SignedOperation } from "@ledgerhq/types-live";
import { command } from "~/renderer/commands";
import { DeviceBlocker } from "~/renderer/components/DeviceAction/DeviceBlocker";
import { getMainAccount } from "@ledgerhq/live-common/account/index";
import { updateAccountWithUpdater } from "~/renderer/actions/accounts";
import { connect } from "react-redux";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import { execAndWaitAtLeast } from "@ledgerhq/live-common/promise";
import { toAccountRaw } from "@ledgerhq/live-common/account/serialization";
import { toTransactionRaw } from "@ledgerhq/live-common/transaction/index";
import qrcode from "qrcode";
import Box from "~/renderer/components/Box";
import Text from "~/renderer/components/Text";
import LinkShowQRCode from "~/renderer/components/LinkShowQRCode";
import ReadOnlyTransactionField from "./components/ReadOnlyTransactionField";
import TextAreaTransaction from "./components/TextAreaTransaction";
import Label from "~/renderer/components/Label";
import StepRecipientSeparator from "~/renderer/components/StepRecipientSeparator";
import Modal from "~/renderer/components/Modal";
import ModalBody from "~/renderer/components/Modal/ModalBody";
import QRCode from "~/renderer/components/QRCode";
import styled from "styled-components";
import Button from "~/renderer/components/Button";
import { validateTransactionResponse, addSentTransactionToAccount, identifierFromString, addPreparedTransactionToAccount, addUnbroadcastTransactionToAccount } from "@ledgerhq/live-common/families/mimblewimble_coin/react";
import BigNumber from "bignumber.js";
import { deserializeError } from "@ledgerhq/errors";
import { MimbleWimbleCoinSerializedError } from "@ledgerhq/live-common/families/mimblewimble_coin/errors";

const connectAppExec = command("connectApp");

const transactionAction = createTransactionAction(connectAppExec);

const openAction = createOpenAction(connectAppExec);

const QRCodeWrapper = styled.div`
  border: 24px solid white;
  background: white;
  display: flex;
`;

type State = {
  currentDevice: Device | null,
  transactionData: string | null,
  useTransactionDataQrCode: boolean,
  modalVisible: boolean,
  disableContinue: boolean,
  finalizingTransaction: boolean,
  transactionResponse: string | null,
  transactionResponseError: Error | undefined,
  transactionResponseWarning: Error | undefined
};

type Props = {
  ...StepProps,
  updateAccountWithUpdater: (string, (Account) => Account) => void
};

const mapDispatchToProps = {
  updateAccountWithUpdater
};

class StepConnectDevice extends PureComponent<Props, State> {

  constructor(
    props: Props
  ) {
    super(props);
    this.state = {
      currentDevice: null,
      transactionData: null,
      useTransactionDataQrCode: true,
      modalVisible: false,
      disableContinue: true,
      finalizingTransaction: false,
      transactionResponse: null
    };
    this.prepareTransactionSubscription = null;
  }

  componentDidMount() {
    invariant(setFooterState, "Footer doesn't exist");
    setFooterState({
      ...this.state,
      stepConnectDevice: this
    });
  }

  componentWillUnmount() {
    const {
      account,
      parentAccount,
      transaction,
      onChangeTransaction
    } = this.props;
    this.unsubscribe();
    const bridge = getAccountBridge(account, parentAccount);
    onChangeTransaction(bridge.updateTransaction(transaction, {
      height: undefined,
      id: undefined,
      offset: undefined,
      proof: undefined,
      encryptedSecretNonce: undefined,
      address: undefined,
      identifier: undefined,
      freshAddress: undefined,
      transactionResponse: undefined
    }));
  }

  componentDidUpdate(
    previousProps: Props,
    previousState: State
  ) {
    const {
      account,
      parentAccount,
      transaction,
      onFailHandler,
      onTransactionError,
      transitionTo,
      closeModal,
      onChangeTransaction,
      updateAccountWithUpdater
    } = this.props;
    const {
      currentDevice
    } = this.state;
    const mainAccount = getMainAccount(account, parentAccount);
    if(!previousState.currentDevice && currentDevice) {
      this.unsubscribe();
      this.prepareTransactionSubscription = command("prepareTransaction")({
        account: toAccountRaw(mainAccount),
        deviceId: currentDevice.deviceId,
        transaction: toTransactionRaw(transaction)
      }).subscribe({
        next: (
          {
            transactionData,
            height,
            id,
            offset,
            proof,
            encryptedSecretNonce,
            address,
            identifier,
            freshAddress
          }: {
            transactionData: string;
            height: string;
            id: string;
            offset: string;
            proof: string | undefined;
            encryptedSecretNonce: string;
            address: Address;
            identifier: string;
            freshAddress: Address;
          }
        ) => {
          qrcode.toString(transactionData, {
            errorCorrectionLevel: "Q"
          }, (
            error: Error | null
          ) => {
            if(this.prepareTransactionSubscription) {
              this.updateState({
                transactionData,
                useTransactionDataQrCode: !error,
                currentDevice: null
              });
              const bridge = getAccountBridge(account, parentAccount);
              onChangeTransaction(bridge.updateTransaction(transaction, {
                height: new BigNumber(height),
                id,
                offset: Buffer.from(offset, "hex"),
                proof: (proof !== undefined) ? Buffer.from(proof, "hex") : undefined,
                encryptedSecretNonce: Buffer.from(encryptedSecretNonce, "hex"),
                address,
                identifier: identifierFromString(identifier),
                freshAddress
              }));
              updateAccountWithUpdater(mainAccount.id, (
                account: Account
              ) => {
                return addPreparedTransactionToAccount(account, freshAddress, identifier);
              });
            }
          });
        },
        error: (
          error: Error
        ) => {
          this.updateState({
            currentDevice: null
          });
          if(!onFailHandler) {
            onTransactionError(error);
            transitionTo("confirmation");
          }
          else {
            closeModal();
            onFailHandler(error);
          }
        }
      });
    }
    else if(previousState.currentDevice && !currentDevice) {
      this.unsubscribe();
    }
  }

  unsubscribe() {
    if(this.prepareTransactionSubscription) {
      this.prepareTransactionSubscription.unsubscribe();
      this.prepareTransactionSubscription = null;
    }
  }

  updateState(
    newState: {[key: string]: any}
  ) {
    this.setState(newState);
    setFooterState(newState);
  }

  hideQRCodeModal = () => {
    this.updateState({
      modalVisible: false
    });
  };

  showQRCodeModal = () => {
    this.updateState({
      modalVisible: true
    });
  };

  broadcast = async (
    signedOperation: SignedOperation
  ): Promise<Operation> => {
    const {
      account,
      parentAccount
    } = this.props;
    const mainAccount = getMainAccount(account, parentAccount);
    const bridge = getAccountBridge(account, parentAccount);
    return execAndWaitAtLeast(3000, (): Promise<Operation> => {
      return bridge.broadcast({
        account: mainAccount,
        signedOperation
      });
    });
  };

  onTransactionResponseChange = (
    transactionResponse: string
  ) => {
    const {
      account,
      parentAccount,
      transaction,
      onChangeTransaction
    } = this.props;
    const mainAccount = getMainAccount(account, parentAccount);
    if(transactionResponse) {
      const {
        error,
        warning
      } = validateTransactionResponse(mainAccount.currency, transactionResponse);
      if(error) {
        this.updateState({
          transactionResponseError: error,
          disableContinue: true
        });
      }
      else {
        this.updateState({
          transactionResponseError: undefined,
          disableContinue: false
        });
      }
      if(warning) {
        this.updateState({
          transactionResponseWarning: warning
        });
      }
      else {
        this.updateState({
          transactionResponseWarning: undefined
        });
      }
    }
    else {
      this.updateState({
        transactionResponseError: undefined,
        transactionResponseWarning: undefined,
        disableContinue: true
      });
    }
    this.updateState({
      transactionResponse
    });
    const bridge = getAccountBridge(account, parentAccount);
    onChangeTransaction(bridge.updateTransaction(transaction, {
      transactionResponse
    }));
  };

  onContinue = () => {
    this.updateState({
      finalizingTransaction: true
    });
  };

  onDeviceConnected = (
    {
      device
    }: {
      device: Device;
    }
  ) => {
    this.updateState({
      currentDevice: device
    });
  };

  onTransactionSigned = (
    {
      signedOperation,
      transactionSignError
    }: {
      signedOperation: SignedOperation;
      transactionSignError: Error;
    }
  ) => {
    const {
      account,
      parentAccount,
      setSigned,
      onConfirmationHandler,
      onOperationBroadcasted,
      transitionTo,
      closeModal,
      onFailHandler,
      onTransactionError,
      updateAccountWithUpdater,
      transaction
    } = this.props;
    const mainAccount = getMainAccount(account, parentAccount);
    if(signedOperation) {
      setSigned(true);
      this.broadcast(signedOperation).then((
        operation: Operation
      ) => {
        if(!onConfirmationHandler) {
          onOperationBroadcasted(operation);
          transitionTo("confirmation");
        }
        else {
          closeModal();
          onConfirmationHandler(operation);
        }
        updateAccountWithUpdater(mainAccount.id, (
          account: Account
        ) => {
          return addSentTransactionToAccount(account, signedOperation);
        });
      },
      (
        error: Error
      ) => {
        if(!onFailHandler) {
          onTransactionError(error);
          transitionTo("confirmation");
        }
        else {
          closeModal();
          onFailHandler(error);
        }
        updateAccountWithUpdater(mainAccount.id, (
          account: Account
        ) => {
          return addUnbroadcastTransactionToAccount(account, signedOperation);
        });
      });
    }
    else if(transactionSignError) {
      if(transactionSignError instanceof MimbleWimbleCoinSerializedError) {
        const {
          error,
          freshAddress,
          identifier
        } = JSON.parse(transactionSignError.message);
        if(!onFailHandler) {
          onTransactionError(deserializeError(error));
          transitionTo("confirmation");
        }
        else {
          closeModal();
          onFailHandler(deserializeError(error));
        }
        if(transaction.transactionResponse === undefined && freshAddress) {
          updateAccountWithUpdater(mainAccount.id, (
            account: Account
          ) => {
            return addPreparedTransactionToAccount(account, freshAddress, identifier);
          });
        }
      }
      else {
        if(!onFailHandler) {
          onTransactionError(transactionSignError);
          transitionTo("confirmation");
        }
        else {
          closeModal();
          onFailHandler(transactionSignError);
        }
      }
    }
  };

  render() {
    const {
      account,
      parentAccount,
      transaction,
      status,
      isNFTSend,
      currencyName
    } = this.props;
    const {
      transactionData,
      useTransactionDataQrCode,
      modalVisible,
      finalizingTransaction,
      transactionResponse,
      transactionResponseError,
      transactionResponseWarning
    } = this.state;

    const mainAccount = account ? getMainAccount(account, parentAccount) : null;
    invariant(account && mainAccount, "No account given");
    const tokenCurrency = account && account.type === "TokenAccount" && account.token;

    if(!transaction || !account) {
      return null;
    }

    return (
      <>
        <Box px={(transactionData !== null && !finalizingTransaction) ? 2 : 0}>
          <TrackPage
            category="Send Flow"
            name="Step ConnectDevice"
            currencyName={currencyName}
            isNFTSend={isNFTSend}
          />
          {(!transaction.sendAsFile || finalizingTransaction) ? (
            <DeviceAction
              action={transactionAction}
              request={{
                tokenCurrency,
                parentAccount,
                account,
                transaction,
                status
              }}
              Result={(
                {
                  signedOperation,
                  device
                }: {
                  signedOperation: ?SignedOperation;
                  device: Device;
                }
              ) => {
                if(!signedOperation) {
                  return null;
                }
                return (
                  <StepProgress modelId={device.modelId}>
                    <DeviceBlocker />
                    <Trans i18nKey="send.steps.confirmation.pending.title" />
                  </StepProgress>
                );
              }}
              onResult={this.onTransactionSigned}
              analyticsPropertyFlow="send"
            />
          ) : (transactionData !== null) ? (
            <>
              <Box flow={1} mb={4}>
                <Box style={{ display: "block" }} horizontal flow={2} mb={3}>
                  <Text style={{ flex: 1 }} ff="Inter|SemiBold" color="palette.text.shade100" fontSize={4}>
                    <Trans i18nKey="families.mimblewimble_coin.transactionRequest" />
                  </Text>
                  {useTransactionDataQrCode ? (
                    <Box style={{ float: "right", marginLeft: 10 }}>
                      <LinkShowQRCode onClick={this.showQRCodeModal} address={transactionData} />
                    </Box>
                  ) : null}
                </Box>
                <ReadOnlyTransactionField transactionData={transactionData} allowSave />
              </Box>
              <StepRecipientSeparator />
              <Label mb={5} mt={20}>
                <Trans i18nKey="families.mimblewimble_coin.transactionResponseReceived" />
              </Label>
              <TextAreaTransaction
                style={{ wordBreak: "break-all" }}
                spellCheck="false"
                value={transactionResponse}
                onChange={this.onTransactionResponseChange}
                error={transactionResponseError}
                warning={transactionResponseWarning}
              />
            </>
          ) : (
            <DeviceAction
              action={openAction}
              request={{
                account: mainAccount
              }}
              Result={(
                {
                  device,
                }: {
                  device: Device;
                }
              ) => {
                return (
                  <StepProgress modelId={device.modelId} />
                );
              }}
              onResult={this.onDeviceConnected}
              analyticsPropertyFlow="send"
            />
          )}
        </Box>
        <Modal isOpened={modalVisible} onClose={this.hideQRCodeModal} centered width={460}>
          <ModalBody
            onClose={this.hideQRCodeModal}
            render={() => (
              <Box alignItems="center">
                <QRCodeWrapper>
                  <QRCode size={372} data={transactionData} />
                </QRCodeWrapper>
                <Box mt={6}>
                  <ReadOnlyTransactionField transactionData={transactionData} />
                </Box>
              </Box>
            )}
          />
        </Modal>
      </>
    )
  }
}

interface FooterState extends State = {
  stepConnectDevice: StepConnectDevice | undefined
};

let setFooterState: ({[key: string]: any}) => void | undefined;

class StepConnectDeviceFooter extends PureComponent<StepProps, FooterState> {

  constructor(
    props: StepProps
  ) {
    super(props);
    this.state = {};
    setFooterState = (
      state: {[key: string]: any}
    ) => {
      this.setState(state);
    };
  }

  componentWillUnmount() {
    setFooterState = undefined;
  }

  render() {
    const {
      transaction
    } = this.props;
    const {
      transactionData,
      disableContinue,
      stepConnectDevice,
      finalizingTransaction
    } = this.state;

    if(!stepConnectDevice) {
      return null;
    }

    return (
        <>
          {(transaction.sendAsFile && !finalizingTransaction && transactionData !== null) ? (
            <Button data-test-id="modal-continue-button" primary disabled={disableContinue} onClick={stepConnectDevice.onContinue}>
              <Trans i18nKey="common.continue" />
            </Button>
          ) : null}
        </>
    );
  }
}

export default {
  StepConnectDevice: connect(null, mapDispatchToProps)(StepConnectDevice),
  StepConnectDeviceFooter
};
