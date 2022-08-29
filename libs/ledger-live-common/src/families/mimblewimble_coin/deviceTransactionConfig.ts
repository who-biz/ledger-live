import type { Transaction, TransactionStatus } from "./types";
import type { DeviceTransactionField } from "../../transaction";
import { MimbleWimbleCoinTransactionWontHavePaymentProof } from "./errors";

export default (
  {
    transaction,
    status
  }: {
    transaction: Transaction;
    status: TransactionStatus;
  }
): DeviceTransactionField[] => {
  const fields: DeviceTransactionField[] = [];
  fields.push({
    type: "amount",
    label: "Amount"
  });
  fields.push({
    type: "fees",
    label: "Fee"
  });
  fields.push({
    type: "text",
    label: "Kernel Features",
    value: "Plain"
  });
  fields.push({
    type: "text",
    label: "Recipient Payment Proof Address",
    value: (status.warnings.recipient instanceof MimbleWimbleCoinTransactionWontHavePaymentProof) ? "N/A" : transaction.recipient.trim()
  });
  return fields;
}
