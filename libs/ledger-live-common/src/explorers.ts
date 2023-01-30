import type {
  CryptoCurrency,
  ExplorerView,
} from "@ledgerhq/types-cryptoassets";
import type { TokenAccount, Account, Operation } from "@ledgerhq/types-live";
export const getDefaultExplorerView = (
  currency: CryptoCurrency
): ExplorerView | null | undefined => currency.explorerViews[0];
export const getTransactionExplorer = (
  explorerView: ExplorerView | null | undefined,
  txHash: string
): string | null | undefined =>
  explorerView && explorerView.tx && explorerView.tx.replace("$hash", txHash);
export const getAddressExplorer = (
  explorerView: ExplorerView | null | undefined,
  address: string
): string | null | undefined =>
  explorerView &&
  explorerView.address &&
  explorerView.address.replace("$address", address);
export const getAccountContractExplorer = (
  explorerView: ExplorerView | null | undefined,
  account: TokenAccount,
  parentAccount: Account
): string | null | undefined =>
  explorerView &&
  explorerView.token &&
  explorerView.token
    .replace("$contractAddress", account.token.contractAddress)
    .replace("$address", parentAccount.freshAddress);
export const getOperationExplorer = (
  currency: CryptoCurrency,
  operation: Operation
): string | null | undefined => {
  const explorerView = getDefaultExplorerView(currency);
  switch (currency.family) {
    case "mimblewimble_coin":
      return (
        explorerView &&
        explorerView.custom &&
        operation.extra &&
        operation.extra.kernelExcess &&
        explorerView.custom.replace(
          "$kernelExcess",
          operation.extra.kernelExcess.toString("hex")
        )
      );
  }
};
