// @flow
import type { Observable } from "rxjs";
import type { AccountRaw, Address } from "@ledgerhq/types-live";
import type { TransactionRaw } from "@ledgerhq/live-common/generated/types"
import { withDevice } from "@ledgerhq/live-common/hw/deviceAccess";
import prepareTransaction from "@ledgerhq/live-common/families/mimblewimble_coin/prepareTransaction";
import { from } from "rxjs";


type Input = {
  account: AccountRaw,
  deviceId: string,
  transaction: TransactionRaw,
};

const cmd = ({
  account,
  deviceId,
  transaction,
}: Input): Observable<{
  transactionData: string,
  height: string,
  id: string,
  offset: string,
  proof: string | undefined,
  encryptedSecretNonce: string,
  address: Address,
  identifier: string,
  freshAddress: Address,
}> => withDevice(deviceId)(transport => from(prepareTransaction(account, transport, transaction)));

export default cmd;
