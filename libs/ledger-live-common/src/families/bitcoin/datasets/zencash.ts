import type { CurrenciesData } from "@ledgerhq/types-live";
import type { Transaction } from "../types";
const dataset: CurrenciesData<Transaction> = {
  FIXME_ignoreAccountFields: [
    "bitcoinResources.walletAccount", // it is not "stable"
    "bitcoinResources.utxos", // TODO: fix ordering
  ],
  scanAccounts: [
    {
      name: "zencash seed 1",
      apdus: `
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e04000000d038000002c8000007980000000
      <= 4104ecf3eb0c3454436fd414da75eafad95896209052eef81b06860cc6c14731963e63ae744577e35b51d4e40ebb4366e59e2a20f571384384bfcb804444db6a83d7237a6e687a6f6835647175706b4c71386837697635794c5339627776434e784432554279f29f778d62ee797a06daa97cdda87bc1e18e6cd586ba1207e68574b5efa543539000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000015058000002c80000079800000000000000000000000
      <= 410486390295a9553025e00eccbf51967519bf773462a01521ee74565fa58375a42a11f0b3419bc37b830e734e501d05a93fa384c9f9040572272e230b6bacf8d56c237a6e677173694a793361334275665176554775766a53757065576d6f39667661414e64e0eba045054e7506e936b4e2dc0de59f94e1cd78f314e9a67e04e7b6d6a135359000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000009028000002c80000079
      <= 4104eee69b0e927018a4a46f30fe967c1a5ba40da2828f5ae8c57b2343b8596af2198363d99a0d77135d93f2d441278297551d6f8e0a96565e810efc03e1c6ec6c4b237a6e69726b5452664c4b674a5a525a4251734d6932554b3239547a39313969586159429facf5df0c974458073fd05717e75137a2002bc7a7b42b86532395b68d88b2469000
      => e04000000d038000002c8000007980000000
      <= 4104ecf3eb0c3454436fd414da75eafad95896209052eef81b06860cc6c14731963e63ae744577e35b51d4e40ebb4366e59e2a20f571384384bfcb804444db6a83d7237a6e687a6f6835647175706b4c71386837697635794c5339627776434e784432554279f29f778d62ee797a06daa97cdda87bc1e18e6cd586ba1207e68574b5efa543539000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000015058000002c80000079800000010000000000000000
      <= 41044b897060883cc30b0282965766ca6066793493c9bfa5f8cfc70e70c8b1d5a22cad8cb2aa10b51c85f74b8edabd42c8dd707389725db89105640f8b59086d7803237a6e6242755377747832513267584a55374a79374d3170437879654b6365444a6554329d4cfaf53a20579aef2b9cb214af3ccc8a1d562903dac43e2fe9e202b7e2216d9000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000009028000002c80000079
      <= 4104eee69b0e927018a4a46f30fe967c1a5ba40da2828f5ae8c57b2343b8596af2198363d99a0d77135d93f2d441278297551d6f8e0a96565e810efc03e1c6ec6c4b237a6e69726b5452664c4b674a5a525a4251734d6932554b3239547a39313969586159429facf5df0c974458073fd05717e75137a2002bc7a7b42b86532395b68d88b2469000
      => e04000000d038000002c8000007980000001
      <= 4104e35cb5c7e66e75e75ccce990d9b755063b8ccef58aabc106a7b1215c5e54a7bad53d131ce6608a72b966f4e9abcfef56a6c2036c3cbd4d5d63830e67244914c8237a6e5261314a6b7578455755764661695433314566624e4e6a5a6f31797169347777534206552ceb3ebb5cf76aa1e7638ff8dde695def238b8ba9ffda07aa405a1c7de9000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000015058000002c80000079800000020000000000000000
      <= 4104425460848ca553921c33d6ce448477f6e45ab759ec61f924e3a8c5e855a58a418aa96f0139ebbaec918ca8925e4621ee6b7cac7e8238f727f9758dd7f9c54462237a6e704d55456d626f507250453847796e45445a31556353534e4b39756134533661671fd0d15d2c1770a73b667b6081781eb4e1f34eefa2af6cbfe09703de4bc062679000
      => b001000000
      <= 0107486f72697a656e05322e312e3001029000
      => e040000009028000002c80000079
      <= 4104eee69b0e927018a4a46f30fe967c1a5ba40da2828f5ae8c57b2343b8596af2198363d99a0d77135d93f2d441278297551d6f8e0a96565e810efc03e1c6ec6c4b237a6e69726b5452664c4b674a5a525a4251734d6932554b3239547a39313969586159429facf5df0c974458073fd05717e75137a2002bc7a7b42b86532395b68d88b2469000
      => e04000000d038000002c8000007980000002
      <= 4104b1d9c8cf69904054c9146d47373d2289a7571ecb373c1fbfddbc75fe90b5f0bdece39d9ef356e1f230aeb8b707cc9c516314386ae88ea3e4b7b17ba30805a195237a6e566a61634c6e6e6765683278593938474c424b4a5373703947353139395a426e345116ea07321a2e2322c8b98ac0911b356dd861d89432142fe51bbeeadf6fca389000
      `,
    },
  ],
};
export default dataset;
