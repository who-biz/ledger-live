// @flow
import type { Observable } from "rxjs";
import type { AccountRaw, Address, OperationRaw } from "@ledgerhq/types-live";
import { withDevice } from "@ledgerhq/live-common/hw/deviceAccess";
import getTransactionResponse from "@ledgerhq/live-common/families/mimblewimble_coin/getTransactionResponse";
import { from } from "rxjs";

type Input = {
  account: AccountRaw,
  deviceId: string,
  transactionData: string,
};

const cmd = ({
  account,
  deviceId,
  transactionData,
}: Input): Observable<{
  transactionResponse: string,
  freshAddress: Address,
  nextIdentifier: string,
  operation: OperationRaw,
}> => withDevice(deviceId)(transport => from(getTransactionResponse(account, transport, transactionData)));

export default cmd;
