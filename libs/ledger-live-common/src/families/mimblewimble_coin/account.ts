import type { Operation } from "@ledgerhq/types-live";
import type { Unit } from "@ledgerhq/types-cryptoassets";
import Identifier from "./api/identifier";

const formatOperationSpecifics = (
  operation: Operation,
  unit: Unit | null | undefined
): string => {
  const {
    outputCommitment
  } = operation.extra;
  return outputCommitment ? `\n  Output Commitment: ${outputCommitment.toString("hex")}` : "";
};

export const fromOperationExtraRaw = (
  extra: Record<string, any> | null | undefined
): Record<string, any> | null | undefined => {
  if(extra) {
    const {
      outputCommitment,
      identifier,
      switchType,
      spent,
      kernelExcess,
      kernelOffset,
      recipientPaymentProofSignature
    } = extra;
    let values: {[key: string]: any} = {};
    if(outputCommitment !== undefined) {
      values = {
        ...values,
        outputCommitment: Buffer.from(outputCommitment, "hex")
      };
    }
    if(identifier !== undefined) {
      values = {
        ...values,
        identifier: new Identifier(Buffer.from(identifier, "hex"))
      };
    }
    if(switchType !== undefined) {
      values = {
        ...values,
        switchType
      };
    }
    if(spent !== undefined) {
      values = {
        ...values,
        spent
      };
    }
    if(kernelExcess !== undefined) {
      values = {
        ...values,
        kernelExcess: kernelExcess ? Buffer.from(kernelExcess, "hex") : null
      };
    }
    if(kernelOffset !== undefined) {
      values = {
        ...values,
        kernelOffset: kernelOffset ? Buffer.from(kernelOffset, "hex") : null
      };
    }
    if(recipientPaymentProofSignature !== undefined) {
      values = {
        ...values,
        recipientPaymentProofSignature: recipientPaymentProofSignature ? Buffer.from(recipientPaymentProofSignature, "hex") : null
      };
    }
    return {
      ...extra,
      ...values
    };
  }
  return extra;
};

export const toOperationExtraRaw = (
  extra: Record<string, any> | null | undefined
): Record<string, any> | null | undefined => {
  if(extra) {
    const {
      outputCommitment,
      identifier,
      switchType,
      spent,
      kernelExcess,
      kernelOffset,
      recipientPaymentProofSignature
    } = extra;
    let values: {[key: string]: any} = {};
    if(outputCommitment !== undefined) {
      values = {
        ...values,
        outputCommitment: outputCommitment.toString("hex")
      };
    }
    if(identifier !== undefined) {
      values = {
        ...values,
        identifier: identifier.serialize().toString("hex")
      };
    }
    if(switchType !== undefined) {
      values = {
        ...values,
        switchType
      };
    }
    if(spent !== undefined) {
      values = {
        ...values,
        spent
      };
    }
    if(kernelExcess !== undefined) {
      values = {
        ...values,
        kernelExcess: kernelExcess ? kernelExcess.toString("hex") : null
      };
    }
    if(kernelOffset !== undefined) {
      values = {
        ...values,
        kernelOffset: kernelOffset ? kernelOffset.toString("hex") : null
      };
    }
    if(recipientPaymentProofSignature !== undefined) {
      values = {
        ...values,
        recipientPaymentProofSignature: recipientPaymentProofSignature ? recipientPaymentProofSignature.toString("hex") : null
      };
    }
    return {
      ...extra,
      ...values
    };
  }
  return extra;
};

export default {
  formatOperationSpecifics,
  fromOperationExtraRaw,
  toOperationExtraRaw
};
