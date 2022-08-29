import type { CurrenciesData } from "@ledgerhq/types-live";
import type { Transaction, MimbleWimbleCoinAccountRaw } from "../types";
import { fromTransactionRaw } from "../transaction";
import { AmountRequired, NotEnoughBalance, RecipientRequired, InvalidAddress } from "@ledgerhq/errors";
import scanAccounts1 from "./grin.scanAccounts.1";

export default {
  scanAccounts: [scanAccounts1],
  accounts: [{
    raw: {
      id: "js:2:grin:59a666ad7a04a9c397924d14b0e1faba023559b4c23c102df59ad0f20773a2b189bc0acacbf385a1d8997a76ac2b3b7e0332187b85b24653702eec838e32d3b8:",
      seedIdentifier: "",
      xpub: "59a666ad7a04a9c397924d14b0e1faba023559b4c23c102df59ad0f20773a2b189bc0acacbf385a1d8997a76ac2b3b7e0332187b85b24653702eec838e32d3b8",
      derivationMode: "",
      index: 0,
      freshAddress: "grin1pe6nvyy4n2nqh73l8kr80zqj5uf4cyqdu4jelqhxmmmjufw8g33q42r76l",
      freshAddressPath: "44'/592'/0'/0/0",
      freshAddresses: [{
        address: "grin1pe6nvyy4n2nqh73l8kr80zqj5uf4cyqdu4jelqhxmmmjufw8g33q42r76l",
        derivationPath: "44'/592'/0'/0/0"
      }],
      name: "Grin 1",
      balance: "0",
      spendableBalance: "0",
      blockHeight: 0,
      operationsCount: 0,
      currencyId: "grin",
      operations: [],
      pendingOperations: [],
      unitMagnitude: 9,
      lastSyncDate: "",
      mimbleWimbleCoinResources: {
        rootPublicKey: "03efd2936a0ec29e49aff8ef7d6d08c42b8b39d5c632ba240b73f98a8f89a79a8a",
        recentHeights: [],
        nextIdentifier: "0300000000000000000000000000000000",
        nextTransactionSequenceNumber: 0
      }
    } as MimbleWimbleCoinAccountRaw,
    transactions: [{
      name: "Amount required",
      transaction: fromTransactionRaw({
        family: "mimblewimble_coin",
        amount: "0",
        recipient: "http://localhost",
        useAllAmount: false,
        sendAsFile: false,
        height: undefined,
        id: undefined,
        offset: undefined,
        proof: undefined,
        encryptedSecretNonce: undefined,
        transactionResponse: undefined
      }),
      expectedStatus: {
        errors: {
          amount: new AmountRequired()
        },
        warnings: {}
      }
    },
    {
      name: "Not enough balance",
      transaction: fromTransactionRaw({
        family: "mimblewimble_coin",
        amount: "1",
        recipient: "http://localhost",
        useAllAmount: false,
        sendAsFile: false,
        height: undefined,
        id: undefined,
        offset: undefined,
        proof: undefined,
        encryptedSecretNonce: undefined,
        transactionResponse: undefined
      }),
      expectedStatus: {
        errors: {
          amount: new NotEnoughBalance()
        },
        warnings: {}
      }
    },
    {
      name: "Recipient required",
      transaction: fromTransactionRaw({
        family: "mimblewimble_coin",
        amount: "0",
        recipient: "",
        useAllAmount: false,
        sendAsFile: false,
        height: undefined,
        id: undefined,
        offset: undefined,
        proof: undefined,
        encryptedSecretNonce: undefined,
        transactionResponse: undefined
      }),
      expectedStatus: {
        errors: {
          recipient: new RecipientRequired()
        },
        warnings: {}
      }
    },
    {
      name: "Invalid address",
      transaction: fromTransactionRaw({
        family: "mimblewimble_coin",
        amount: "0",
        recipient: "localhost",
        useAllAmount: false,
        sendAsFile: false,
        height: undefined,
        id: undefined,
        offset: undefined,
        proof: undefined,
        encryptedSecretNonce: undefined,
        transactionResponse: undefined
      }),
      expectedStatus: {
        errors: {
          recipient: new InvalidAddress()
        },
        warnings: {}
      }
    }]
  }]
} as CurrenciesData<Transaction>;
