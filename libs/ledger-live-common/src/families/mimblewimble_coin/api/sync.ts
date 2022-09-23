import type { Operation } from "@ledgerhq/types-live";
import { encodeOperationId } from "../../../operation";
import type { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import BigNumber from "bignumber.js";
import Identifier from "./identifier";
import RecentHeight from "./recentHeight";
import Consensus from "./consensus";
import Node from "./node";
import Secp256k1Zkp from "@nicolasflamel/secp256k1-zkp";
import ProofBuilder from "./proofBuilder";
import Common from "./common";

export default class Sync {

  private static readonly MAXIMUM_NUMBER_OF_RECENT_HEIGHTS = 13;

  private constructor() {
  }

  public static async sync(
    cryptocurrency: CryptoCurrency,
    rootPublicKey: Buffer,
    operations: Operation[],
    pendingOperations: Operation[],
    recentHeights: RecentHeight[],
    accountHeight: BigNumber,
    nextIdentifier: Identifier,
    accountId: string
  ): Promise<{
    newOperations: Operation[],
    newRecentHeights: RecentHeight[],
    newAccountHeight: BigNumber,
    newNextIdentifier: Identifier,
    balanceChange: BigNumber,
    spendableBalanceChange: BigNumber
  }> {
    let balanceChange: BigNumber = new BigNumber(0);
    let spendableBalanceChange: BigNumber = new BigNumber(0);
    const {
      tipHeight,
      tipHash
    } = await Node.getTip(cryptocurrency);
    if(!tipHeight.isZero() && (!recentHeights.length || tipHeight.isGreaterThanOrEqualTo(recentHeights[0].height))) {
      if(recentHeights.length && (!recentHeights[0].height.isEqualTo(tipHeight) || !recentHeights[0].hash.equals(tipHash))) {
        while(recentHeights.length) {
          const {
            hash
          } = await Node.getHeader(cryptocurrency, recentHeights[0].height);
          if(recentHeights[0].hash.equals(hash)) {
           break;
          }
          recentHeights.shift();
        }
      }
      const startHeight = BigNumber.minimum(recentHeights.length ? recentHeights[0].height.plus(1) : 0, accountHeight.plus(1));
      if(tipHeight.isGreaterThanOrEqualTo(startHeight)) {
        const proofBuilder = new ProofBuilder(rootPublicKey);
        let highestIdentifier: Identifier | undefined;
        const newOperations: Operation[] = [];
        const {
          startIndex,
          endIndex
        } = await Node.getPmmrIndices(cryptocurrency, startHeight, tipHeight);
        if(startIndex.isLessThanOrEqualTo(endIndex)) {
          for(let currentIndex: BigNumber = startIndex;;) {
            const {
              highestIndex,
              lastRetrievedIndex,
              outputs
            } = await Node.getOutputs(cryptocurrency, currentIndex, endIndex, Sync.getOutputsGroupSize());
            for(const output of outputs) {
              let rewindNonce: Buffer;
              const outputCommitment = Buffer.from(output.commitment, "hex");
              try {
                rewindNonce = await proofBuilder.getRewindNonce(outputCommitment);
              }
              catch(
                error: any
              ) {
                continue;
              }
              const outputProof = Buffer.from(output.proof, "hex");
              const bulletproof = await Common.resolveIfPromise(Secp256k1Zkp.rewindBulletproof(outputProof, outputCommitment, rewindNonce));
              if(bulletproof !== Secp256k1Zkp.OPERATION_FAILED) {
                const amount = new BigNumber(bulletproof["Value"]);
                const message = Buffer.from(bulletproof["Message"]);
                let messageComponents: {
                  identifier: Identifier,
                  switchType: number
                };
                try {
                  messageComponents = ProofBuilder.decodeMessage(message);
                }
                catch(
                  error: any
                ) {
                  continue;
                }
                if(await Common.resolveIfPromise(Secp256k1Zkp.verifyBulletproof(outputProof, outputCommitment, Buffer.alloc(0)))) {
                  const outputHeight = new BigNumber(output.height);
                  let identifierHeight: BigNumber | null = messageComponents.identifier.getHeight(cryptocurrency);
                  if(identifierHeight) {
                    identifierHeight = identifierHeight.plus(outputHeight.dividedBy(Identifier.MAXIMUM_HEIGHT + 1).decimalPlaces(0, BigNumber.ROUND_HALF_CEIL).multipliedBy(Identifier.MAXIMUM_HEIGHT + 1));
                     if(identifierHeight.minus(outputHeight).isGreaterThan(Sync.getIdentifierHeightOverageThreshold(cryptocurrency)) && identifierHeight.isGreaterThanOrEqualTo(Identifier.MAXIMUM_HEIGHT + 1)) {
                      identifierHeight = identifierHeight.minus(Identifier.MAXIMUM_HEIGHT + 1);
                    }
                    if(outputHeight.minus(identifierHeight).isGreaterThan(Sync.getReplayDetectionThreshold(cryptocurrency))) {
                      continue;
                    }
                  }
                  if(!highestIdentifier) {
                    highestIdentifier = new Identifier();
                  }
                  if(messageComponents.identifier.includesValue(highestIdentifier)) {
                    highestIdentifier = messageComponents.identifier.removeExtras(cryptocurrency);
                  }
                  const {
                    hash,
                    timestamp
                  } = await Node.getHeader(cryptocurrency, outputHeight);
                  newOperations.unshift({
                    id: encodeOperationId(accountId, output.commitment, "IN"),
                    hash: "",
                    type: (output.type === "Coinbase") ? "COINBASE_REWARD" : "IN",
                    value: amount,
                    fee: new BigNumber(-1),
                    senders: [],
                    recipients: [],
                    blockHeight: output.height,
                    blockHash: hash.toString("hex"),
                    accountId,
                    date: timestamp,
                    extra: {
                      outputCommitment,
                      identifier: messageComponents.identifier,
                      switchType: messageComponents.switchType,
                      spent: false,
                      kernelExcess: null,
                      kernelOffset: null,
                      recipientPaymentProofSignature: null
                    }
                  });
                }
              }
            }
            if(highestIndex.isLessThanOrEqualTo(lastRetrievedIndex)) {
              break;
            }
            currentIndex = lastRetrievedIndex.plus(1);
          }
        }
        const newNextIdentifier = (highestIdentifier && highestIdentifier.includesValue(nextIdentifier)) ? highestIdentifier.getNext() : nextIdentifier;
        for(let i: number = operations.length - 1; i >= 0; --i) {
          if(operations[i].type !== "OUT" && operations[i].blockHeight !== null && !operations[i].extra.spent && startHeight.isGreaterThan(operations[i].blockHeight!)) {
            const {
              height
            } = await Node.getOutput(cryptocurrency, operations[i].extra.outputCommitment);
            if(height && height.isEqualTo(operations[i].blockHeight!)) {
              break;
            }
            else {
              balanceChange = balanceChange.minus(operations[i].value);
              if(operations[i].type !== "COINBASE_REWARD" || accountHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
                spendableBalanceChange = spendableBalanceChange.minus(operations[i].value);
              }
              operations[i].extra.spent = true;
            }
          }
        }
        const checkedOperations: {[key: string]: Operation} = {};
        for(let i: number = 0; i < newOperations.length; ++i) {
          if(newOperations[i].id in checkedOperations) {
            newOperations.splice(i--, 1);
          }
          else {
            balanceChange = balanceChange.plus(newOperations[i].value);
            if(newOperations[i].type !== "COINBASE_REWARD" || tipHeight.isGreaterThanOrEqualTo(new BigNumber(newOperations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
              spendableBalanceChange = spendableBalanceChange.plus(newOperations[i].value);
            }
            checkedOperations[newOperations[i].id] = newOperations[i];
          }
        }
        for(let i: number = 0; i < operations.length; ++i) {
          if(operations[i].id in checkedOperations) {
            if(operations[i].blockHeight !== null || operations[i].extra.spent) {
              balanceChange = balanceChange.minus(operations[i].value);
              if(operations[i].extra.spent || operations[i].type !== "COINBASE_REWARD" || accountHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
                spendableBalanceChange = spendableBalanceChange.minus(operations[i].value);
              }
            }
            checkedOperations[operations[i].id].hash = operations[i].hash;
            checkedOperations[operations[i].id].type = operations[i].type;
            checkedOperations[operations[i].id].fee = operations[i].fee;
            checkedOperations[operations[i].id].date = operations[i].date;
            checkedOperations[operations[i].id].senders = operations[i].senders;
            checkedOperations[operations[i].id].recipients = operations[i].recipients;
            checkedOperations[operations[i].id].extra.spent = operations[i].extra.spent;
            checkedOperations[operations[i].id].extra.kernelExcess = operations[i].extra.kernelExcess;
            checkedOperations[operations[i].id].extra.kernelOffset = operations[i].extra.kernelOffset;
            checkedOperations[operations[i].id].extra.recipientPaymentProofSignature = operations[i].extra.recipientPaymentProofSignature;
            delete checkedOperations[operations[i].id];
            operations.splice(i--, 1);
          }
          else if(operations[i].blockHeight !== null) {
            if(startHeight.isLessThanOrEqualTo(operations[i].blockHeight!)) {
              if(operations[i].type !== "OUT") {
                if(!operations[i].extra.spent) {
                  const {
                    height,
                    proof
                  } = await Node.getOutput(cryptocurrency, operations[i].extra.outputCommitment);
                  let ownsOutput: boolean = false;
                  if(height) {
                    try {
                      const rewindNonce = await proofBuilder.getRewindNonce(operations[i].extra.outputCommitment);
                      const bulletproof = await Common.resolveIfPromise(Secp256k1Zkp.rewindBulletproof(proof, operations[i].extra.outputCommitment, rewindNonce));
                      if(bulletproof !== Secp256k1Zkp.OPERATION_FAILED) {
                        const amount = new BigNumber(bulletproof["Value"]);
                        const message = Buffer.from(bulletproof["Message"]);
                        const {
                          identifier,
                          switchType
                        } = ProofBuilder.decodeMessage(message);
                        if(amount.isEqualTo(operations[i].value) && identifier.serialize().equals(operations[i].extra.identifier.serialize()) && switchType === operations[i].extra.switchType) {
                          if(await Common.resolveIfPromise(Secp256k1Zkp.verifyBulletproof(proof, operations[i].extra.outputCommitment, Buffer.alloc(0)))) {
                            ownsOutput = true;
                          }
                        }
                      }
                    }
                    catch(
                      error: any
                    ) {
                    }
                  }
                  if(ownsOutput) {
                    const {
                      hash
                    } = await Node.getHeader(cryptocurrency, height!);
                    if(operations[i].type === "COINBASE_REWARD" && accountHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
                      spendableBalanceChange = spendableBalanceChange.minus(operations[i].value);
                    }
                    operations[i].blockHeight = height!.toNumber();
                    operations[i].blockHash = hash.toString("hex");
                    if(operations[i].type === "COINBASE_REWARD" && tipHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
                      spendableBalanceChange = spendableBalanceChange.plus(operations[i].value);
                    }
                  }
                  else {
                    balanceChange = balanceChange.minus(operations[i].value);
                    if(operations[i].type !== "COINBASE_REWARD" || accountHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
                      spendableBalanceChange = spendableBalanceChange.minus(operations[i].value);
                    }
                    if(operations[i].extra.kernelExcess) {
                      const {
                        height
                      } = await Node.getKernel(cryptocurrency, operations[i].extra.kernelExcess, BigNumber.maximum(new BigNumber(operations[i].blockHeight!).minus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), 0), BigNumber.minimum(new BigNumber(operations[i].blockHeight!).plus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), tipHeight));
                      if(height) {
                        const {
                          hash
                        } = await Node.getHeader(cryptocurrency, height);
                        operations[i].extra.spent = true;
                        operations[i].blockHeight = height.toNumber();
                        operations[i].blockHash = hash.toString("hex");
                      }
                      else {
                        operations[i].blockHeight = null;
                        operations[i].blockHash = null;
                      }
                    }
                    else {
                      operations[i].blockHeight = null;
                      operations[i].blockHash = null;
                    }
                  }
                }
                else if(operations[i].extra.kernelExcess) {
                  const {
                    height
                  } = await Node.getKernel(cryptocurrency, operations[i].extra.kernelExcess, BigNumber.maximum(new BigNumber(operations[i].blockHeight!).minus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), 0), BigNumber.minimum(new BigNumber(operations[i].blockHeight!).plus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), tipHeight));
                  if(height) {
                    const {
                      hash
                    } = await Node.getHeader(cryptocurrency, height);
                    operations[i].blockHeight = height.toNumber();
                    operations[i].blockHash = hash.toString("hex");
                  }
                  else {
                    operations[i].blockHeight = null;
                    operations[i].blockHash = null;
                  }
                }
              }
              else {
                const {
                  height
                } = await Node.getKernel(cryptocurrency, operations[i].extra.kernelExcess, BigNumber.maximum(new BigNumber(operations[i].blockHeight!).minus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), 0), BigNumber.minimum(new BigNumber(operations[i].blockHeight!).plus(Sync.getKernelHeightVariationThreshold(cryptocurrency)), tipHeight));
                if(height) {
                  const {
                    hash
                  } = await Node.getHeader(cryptocurrency, height);
                  operations[i].blockHeight = height.toNumber();
                  operations[i].blockHash = hash.toString("hex");
                }
                else {
                  operations[i].blockHeight = null;
                  operations[i].blockHash = null;
                }
              }
            }
            else if(!operations[i].extra.spent && operations[i].type === "COINBASE_REWARD" && accountHeight.isLessThan(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1)) && tipHeight.isGreaterThanOrEqualTo(new BigNumber(operations[i].blockHeight!).plus(Consensus.getCoinbaseMaturity(cryptocurrency)).minus(1))) {
              spendableBalanceChange = spendableBalanceChange.plus(operations[i].value);
            }
          }
          else if(operations[i].type === "OUT") {
            const {
              height
            } = await Node.getKernel(cryptocurrency, operations[i].extra.kernelExcess, startHeight, tipHeight);
            if(height) {
              const {
                hash
              } = await Node.getHeader(cryptocurrency, height);
              operations[i].blockHeight = height.toNumber();
              operations[i].blockHash = hash.toString("hex");
            }
          }
        }
        for(const pendingOperation of pendingOperations) {
          if(pendingOperation.id in checkedOperations) {
            if(pendingOperation.type === "NONE") {
              balanceChange = balanceChange.minus(pendingOperation.value);
            }
            checkedOperations[pendingOperation.id].hash = pendingOperation.hash;
            checkedOperations[pendingOperation.id].type = pendingOperation.type;
            checkedOperations[pendingOperation.id].fee = pendingOperation.fee;
            checkedOperations[pendingOperation.id].date = pendingOperation.date;
            checkedOperations[pendingOperation.id].senders = pendingOperation.senders;
            checkedOperations[pendingOperation.id].recipients = pendingOperation.recipients;
            checkedOperations[pendingOperation.id].extra.spent = pendingOperation.extra.spent;
            checkedOperations[pendingOperation.id].extra.kernelExcess = pendingOperation.extra.kernelExcess;
            checkedOperations[pendingOperation.id].extra.kernelOffset = pendingOperation.extra.kernelOffset;
            checkedOperations[pendingOperation.id].extra.recipientPaymentProofSignature = pendingOperation.extra.recipientPaymentProofSignature;
          }
          if(pendingOperation.type === "OUT") {
            let pendingOperationExists: boolean = false;
            for(const operation of operations) {
              if(pendingOperation.id === operation.id) {
                pendingOperationExists = true;
                break;
              }
            }
            if(!pendingOperationExists) {
              const {
                height
              } = await Node.getKernel(cryptocurrency, pendingOperation.extra.kernelExcess, startHeight, tipHeight);
              if(height) {
                const {
                  hash
                } = await Node.getHeader(cryptocurrency, height);
                newOperations.unshift({
                  id: pendingOperation.id,
                  hash: pendingOperation.hash,
                  type: pendingOperation.type,
                  value: pendingOperation.value,
                  fee: pendingOperation.fee,
                  senders: pendingOperation.senders,
                  recipients: pendingOperation.recipients,
                  blockHeight: height.toNumber(),
                  blockHash: hash.toString("hex"),
                  accountId: pendingOperation.accountId,
                  date: pendingOperation.date,
                  extra: {
                    kernelExcess: pendingOperation.extra.kernelExcess,
                    recipientPaymentProofSignature: pendingOperation.extra.recipientPaymentProofSignature
                  }
                });
                balanceChange = balanceChange.minus(pendingOperation.value.plus(pendingOperation.fee));
              }
            }
          }
        }
        newOperations.sort((
          first: Operation,
          second: Operation
        ): number => {
          return second.date.valueOf() - first.date.valueOf();
        });
        for(let i: number = newOperations.length - 1; i >= 0 && operations.length; --i) {
          while(operations.length && operations[operations.length - 1].date.valueOf() <= newOperations[i].date.valueOf()) {
            newOperations.splice(i + 1, 0, operations.pop()!);
          }
        }
        while(operations.length) {
          newOperations.splice(0, 0, operations.pop()!);
        }
        const newRecentHeights: RecentHeight[] = [new RecentHeight(tipHeight, tipHash)];
        for(let i: number = newRecentHeights.length; i < Sync.MAXIMUM_NUMBER_OF_RECENT_HEIGHTS; ++i) {
          const minimumAge = Sync.getMinimumAgeForRecentHeight(cryptocurrency, i - 1);
          const maximumAge = Sync.getMinimumAgeForRecentHeight(cryptocurrency, i) - 1;
          const idealHeight = BigNumber.maximum(tipHeight.minus(Math.ceil(minimumAge / Consensus.getBlockTimeSeconds(cryptocurrency))), 0);
          if(recentHeights.length) {
            for(let j: number = 0; j < recentHeights.length; ++j) {
              const age = tipHeight.minus(recentHeights[j].height).multipliedBy(Consensus.getBlockTimeSeconds(cryptocurrency));
              if((age.isGreaterThanOrEqualTo(minimumAge) && age.isLessThanOrEqualTo(maximumAge)) || (idealHeight.isZero() && recentHeights[j].height.isZero())) {
                newRecentHeights.push(new RecentHeight(recentHeights[j].height, recentHeights[j].hash));
                break;
              }
              else if(j === recentHeights.length - 1) {
                const {
                  hash
                } = await Node.getHeader(cryptocurrency, idealHeight);
                newRecentHeights.push(new RecentHeight(idealHeight, hash));
              }
            }
          }
          else {
            const {
              hash
            } = await Node.getHeader(cryptocurrency, idealHeight);
            newRecentHeights.push(new RecentHeight(idealHeight, hash));
          }
          if(idealHeight.isZero()) {
            break;
          }
        }
        return {
          newOperations,
          newRecentHeights,
          newAccountHeight: BigNumber.maximum(tipHeight, accountHeight),
          newNextIdentifier,
          balanceChange,
          spendableBalanceChange
        };
      }
    }
    return {
      newOperations: operations,
      newRecentHeights: recentHeights,
      newAccountHeight: BigNumber.maximum(tipHeight, accountHeight),
      newNextIdentifier: nextIdentifier,
      balanceChange,
      spendableBalanceChange
    };
  }

  private static getIdentifierHeightOverageThreshold(
    cryptocurrency: CryptoCurrency
  ): number {
    return Consensus.getBlockHeightWeek(cryptocurrency);
  }

  private static getReplayDetectionThreshold(
    cryptocurrency: CryptoCurrency
  ): number {
    return Consensus.getBlockHeightWeek(cryptocurrency);
  }

  private static getOutputsGroupSize(): number {
    return Common.isLowMemoryDevice() ? 250 : 2000;
  }

  private static getMinimumAgeForRecentHeight(
    cryptocurrency: CryptoCurrency,
    index: number
  ): number {
    return Math.pow((index > 2) ? 3 : 2, (index > 2) ? index - 1 : index) * Consensus.getBlockTimeSeconds(cryptocurrency);
  }

  private static getKernelHeightVariationThreshold(
    cryptocurrency: CryptoCurrency
  ): number {
    return Consensus.getBlockHeightWeek(cryptocurrency);
  }
}
