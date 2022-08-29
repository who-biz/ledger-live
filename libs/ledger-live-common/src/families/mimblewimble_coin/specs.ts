import type { AppSpec, MutationSpec } from "../../bot/types";
import type { Transaction } from "./types";
import { DeviceModelId } from "@ledgerhq/devices";
import { getCryptoCurrencyById } from "../../currencies";

const mimbleWimbleCoinLikeMutations = (): MutationSpec<Transaction>[] => [];

const mimblewimble_coin: AppSpec<Transaction> = {
  name: "MimbleWimble Coin",
  currency: getCryptoCurrencyById("mimblewimble_coin"),
  appQuery: {
    model: DeviceModelId.nanoS,
    appName: "MimbleWimble Coin"
  },
  mutations: mimbleWimbleCoinLikeMutations()
};

const mimblewimble_coin_floonet: AppSpec<Transaction> = {
  name: "MimbleWimble Coin Floonet",
  currency: getCryptoCurrencyById("mimblewimble_coin_floonet"),
  dependency: "MimbleWimble Coin",
  appQuery: {
    model: DeviceModelId.nanoS,
    appName: "MimbleWimble Coin Floonet"
  },
  mutations: mimbleWimbleCoinLikeMutations()
};

const grin: AppSpec<Transaction> = {
  name: "Grin",
  currency: getCryptoCurrencyById("grin"),
  dependency: "MimbleWimble Coin",
  appQuery: {
    model: DeviceModelId.nanoS,
    appName: "Grin"
  },
  mutations: mimbleWimbleCoinLikeMutations()
};

const grin_testnet: AppSpec<Transaction> = {
  name: "Grin",
  currency: getCryptoCurrencyById("grin_testnet"),
  dependency: "MimbleWimble Coin",
  appQuery: {
    model: DeviceModelId.nanoS,
    appName: "Grin Testnet"
  },
  mutations: mimbleWimbleCoinLikeMutations()
};

export default {
  mimblewimble_coin,
  mimblewimble_coin_floonet,
  grin,
  grin_testnet
};
