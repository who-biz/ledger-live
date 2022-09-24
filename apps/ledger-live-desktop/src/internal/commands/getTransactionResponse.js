// @flow
import type { Observable } from "rxjs";
import type { AccountRaw, Address, OperationRaw } from "@ledgerhq/types-live";
import getTransactionResponse from "@ledgerhq/live-common/families/mimblewimble_coin/getTransactionResponse";

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
  type: string,
  transactionResponse?: string,
  freshAddress?: Address,
  nextIdentifier?: string,
  operation?: OperationRaw,
}> => getTransactionResponse(account, deviceId, transactionData);

export default cmd;
