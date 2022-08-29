import Ed25519 from "@nicolasflamel/ed25519-wasm";
import X25519 from "@nicolasflamel/x25519-wasm";
import crypto from "crypto";
import Crypto from "./crypto";
import hkdf from "futoin-hkdf";
import chacha from "chacha";
import createHmac from "create-hmac";
import { MimbleWimbleCoinInvalidParameters } from "../errors";
import Common from "./common";
import { Account } from "@ledgerhq/types-live";
import MimbleWimbleCoin from "../hw-app-mimblewimble-coin";

export default class Age {

  public static readonly FILE_KEY_LENGTH = 16;
  private static readonly HEADER_VERSION_LINE = "age-encryption.org/v1";
  private static readonly HEADER_STANZA_LINE_PREFIX = "->";
  private static readonly HEADER_MAC_LINE_PREFIX = "---";
  private static readonly STANZA_WRAPPED_BODY_LENGTH = 64;
  private static readonly X25519_RECIPIENT_STANZA_NUMBER_OF_ARGUMENTS = 2;
  private static readonly X25519_RECIPIENT_STANZA_FIRST_ARGUMENT = "X25519";
  private static readonly SCRYPT_RECIPIENT_STANZA_FIRST_ARGUMENT = "scrypt";
  public static readonly PAYLOAD_NONCE_LENGTH = 16;
  private static readonly MAXIMUM_PAYLOAD_CHUNK_LENGTH = Math.pow(2, 16);
  private static readonly MAC_LENGTH = 32;

  private constructor() {
  }

  public static encrypt(
    data: Buffer,
    recipientEd25519PublicKey: Buffer
  ): Buffer {
    let recipientX25519PublicKey: Buffer = X25519.publicKeyFromEd25519PublicKey(recipientEd25519PublicKey);
    if(recipientX25519PublicKey === X25519.OPERATION_FAILED) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid recipient Ed25519 public key");
    }
    recipientX25519PublicKey = Buffer.from(recipientX25519PublicKey);
    if(recipientX25519PublicKey.equals(Buffer.alloc(Crypto.X25519_PUBLIC_KEY_LENGTH))) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid recipient Ed25519 public key");
    }
    let ephemeralX25519PublicKey: Buffer;
    let sharedSecret: Buffer;
    while(true) {
      const ephemeralEd25519SecretKey = crypto.randomFillSync(Buffer.alloc(Crypto.ED25519_PRIVATE_KEY_LENGTH));
      const ephemeralX25519SecretKey = X25519.secretKeyFromEd25519SecretKey(ephemeralEd25519SecretKey);
      if(ephemeralX25519SecretKey === X25519.OPERATION_FAILED) {
        continue;
      }
      const ephemeralEd25519PublicKey = Ed25519.publicKeyFromSecretKey(ephemeralEd25519SecretKey);
      if(ephemeralEd25519PublicKey === Ed25519.OPERATION_FAILED) {
        continue;
      }
      ephemeralX25519PublicKey = X25519.publicKeyFromEd25519PublicKey(ephemeralEd25519PublicKey);
      if(ephemeralX25519PublicKey === X25519.OPERATION_FAILED) {
        continue;
      }
      ephemeralX25519PublicKey = Buffer.from(ephemeralX25519PublicKey);
      sharedSecret = X25519.sharedSecretKeyFromSecretKeyAndPublicKey(ephemeralX25519SecretKey, recipientX25519PublicKey);
      if(sharedSecret === X25519.OPERATION_FAILED) {
        continue;
      }
      sharedSecret = Buffer.from(sharedSecret);
      if(sharedSecret.equals(Buffer.alloc(Crypto.X25519_PRIVATE_KEY_LENGTH))) {
        continue;
      }
      break;
    }
    const salt = Buffer.alloc(ephemeralX25519PublicKey.length + recipientX25519PublicKey.length);
    ephemeralX25519PublicKey.copy(salt, 0);
    recipientX25519PublicKey.copy(salt, ephemeralX25519PublicKey.length);
    const wrapKey = hkdf(sharedSecret, 32, {
      salt,
      info: "age-encryption.org/v1/X25519",
      hash: "SHA-256"
    });
    const cipher = chacha.createCipher(wrapKey, Buffer.alloc(Crypto.CHACHA20_POLY1305_NONCE_LENGTH));
    const fileKey = crypto.randomFillSync(Buffer.alloc(Age.FILE_KEY_LENGTH));
    const encryptedFileKeyStart = cipher.update(fileKey);
    const encryptedFileKeyEnd = cipher.final();
    const encryptedFileKeyTag = cipher.getAuthTag();
    const encryptedFileKey = Buffer.alloc(encryptedFileKeyStart.length + encryptedFileKeyEnd.length + encryptedFileKeyTag.length);
    encryptedFileKeyStart.copy(encryptedFileKey, 0);
    encryptedFileKeyEnd.copy(encryptedFileKey, encryptedFileKeyStart.length);
    encryptedFileKeyTag.copy(encryptedFileKey, encryptedFileKeyStart.length + encryptedFileKeyEnd.length);
    let ageHeader: string = `${Age.HEADER_VERSION_LINE}\n${Age.HEADER_STANZA_LINE_PREFIX} ${Age.X25519_RECIPIENT_STANZA_FIRST_ARGUMENT} ${ephemeralX25519PublicKey.toString("base64").replace(/=+$/u, "")}\n${encryptedFileKey.toString("base64").replace(/=+$/u, "")}\n${Age.HEADER_MAC_LINE_PREFIX}`;
    const hmacKey = hkdf(fileKey, 32, {
      info: "header",
      hash: "SHA-256"
    });
    const mac = createHmac("sha256", hmacKey).update(ageHeader).digest();
    const nonce = crypto.randomFillSync(Buffer.alloc(Age.PAYLOAD_NONCE_LENGTH));
    const payloadKey = hkdf(fileKey, 32, {
      salt: nonce,
      info: "payload",
      hash: "SHA-256"
    });
    ageHeader += ` ${mac.toString("base64").replace(/=+$/u, "")}\n`;
    let agePayload: Buffer = nonce;
    for(let i: number = 0; i < Math.max(Math.ceil(data.length / Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH), 1); ++i) {
      if(i === Number.MAX_SAFE_INTEGER) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid data");
      }
      const chunk = data.subarray(i * Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH, (i + 1) * Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH);
      const nonce = Buffer.alloc(Crypto.CHACHA20_POLY1305_NONCE_LENGTH);
      nonce.writeBigInt64BE(BigInt(i), Crypto.CHACHA20_POLY1305_NONCE_LENGTH - 1 - BigUint64Array.BYTES_PER_ELEMENT);
      nonce.writeUInt8((i === Math.max(Math.ceil(data.length / Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH), 1) - 1) ? 1 : 0, Crypto.CHACHA20_POLY1305_NONCE_LENGTH - 1);
      const cipher = chacha.createCipher(payloadKey, nonce);
      const encryptedChunkStart = chunk.length ? cipher.update(chunk) : Buffer.alloc(0);
      const encryptedChunkEnd = cipher.final();
      const encryptedChunkTag = cipher.getAuthTag();
      const temp = Buffer.alloc(agePayload.length + encryptedChunkStart.length + encryptedChunkEnd.length + encryptedChunkTag.length);
      agePayload.copy(temp, 0);
      encryptedChunkStart.copy(temp, agePayload.length);
      encryptedChunkEnd.copy(temp, agePayload.length + encryptedChunkStart.length);
      encryptedChunkTag.copy(temp, agePayload.length + encryptedChunkStart.length + encryptedChunkEnd.length);
      agePayload = temp;
    }
    const ageFile = Buffer.alloc(ageHeader.length + agePayload.length);
    ageFile.write(ageHeader, 0);
    agePayload.copy(ageFile, ageHeader.length);
    return ageFile;
  }

  public static async decrypt(
    account: Account,
    ageFile: Buffer,
    mimbleWimbleCoin: MimbleWimbleCoin
  ): Promise<Buffer> {
    let endOfHeaderIndex: number = -1;
    for(let newlineIndex: number = ageFile.indexOf("\n".charCodeAt(0)); newlineIndex !== -1; newlineIndex = ageFile.indexOf("\n".charCodeAt(0), newlineIndex + "\n".length)) {
      if(ageFile.subarray(newlineIndex, newlineIndex + `\n${Age.HEADER_MAC_LINE_PREFIX} `.length).equals(Buffer.from(`\n${Age.HEADER_MAC_LINE_PREFIX} `))) {
        endOfHeaderIndex = ageFile.indexOf("\n".charCodeAt(0), newlineIndex + `\n${Age.HEADER_MAC_LINE_PREFIX} `.length);
        break;
      }
    }
    if(endOfHeaderIndex === -1) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    for(let i: number = 0; i < endOfHeaderIndex; ++i) {
      if(!Common.isPrintableCharacter(ageFile.readUInt8(i)) && ageFile.readUInt8(i) !== "\n".charCodeAt(0)) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
    }
    const ageHeader = ageFile.subarray(0, endOfHeaderIndex + "\n".length).toString();
    const agePayload = ageFile.subarray(endOfHeaderIndex + "\n".length);
    if(!ageHeader.startsWith(`${Age.HEADER_VERSION_LINE}\n${Age.HEADER_STANZA_LINE_PREFIX} `)) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    const stanzas: {
      ephemeralX25519PublicKey: Buffer,
      encryptedFileKey: Buffer
    }[] = [];
    let startOfLine = `${Age.HEADER_VERSION_LINE}\n`.length;
    while(ageHeader.substring(startOfLine, startOfLine + `${Age.HEADER_STANZA_LINE_PREFIX} `.length) === `${Age.HEADER_STANZA_LINE_PREFIX} `) {
      let endOfLine: number = ageHeader.indexOf("\n", startOfLine);
      if(endOfLine === -1) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      const stanzaArguments = ageHeader.substring(startOfLine + `${Age.HEADER_STANZA_LINE_PREFIX} `.length, endOfLine).split(" ");
      if(!stanzaArguments.length) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      if(stanzaArguments[0] === Age.SCRYPT_RECIPIENT_STANZA_FIRST_ARGUMENT) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      let stanzaBody: string = "";
      for(startOfLine = endOfLine + "\n".length;; startOfLine = endOfLine + "\n".length) {
        endOfLine = ageHeader.indexOf("\n", startOfLine);
        if(endOfLine === -1) {
          throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
        }
        stanzaBody += ageHeader.substring(startOfLine, endOfLine);
        if(endOfLine - startOfLine > Age.STANZA_WRAPPED_BODY_LENGTH) {
          throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
        }
        else if(endOfLine - startOfLine < Age.STANZA_WRAPPED_BODY_LENGTH) {
          startOfLine = endOfLine + "\n".length;
          break;
        }
      }
      if(stanzaBody.endsWith(Crypto.BASE64_PADDING_CHARACTER)) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      if(stanzaArguments.length === Age.X25519_RECIPIENT_STANZA_NUMBER_OF_ARGUMENTS && stanzaArguments[0] === Age.X25519_RECIPIENT_STANZA_FIRST_ARGUMENT) {
        if(stanzaArguments[1].endsWith(Crypto.BASE64_PADDING_CHARACTER)) {
          continue;
        }
        if(!/^[a-z0-9+\/]+$/ui.test(stanzaArguments[1]) || !/^[a-z0-9+\/]+$/ui.test(stanzaBody)) {
          continue;
        }
        const ephemeralX25519PublicKey = Buffer.from(stanzaArguments[1], "base64");
        const encryptedFileKey = Buffer.from(stanzaBody, "base64");
        if(ephemeralX25519PublicKey.length === Crypto.X25519_PUBLIC_KEY_LENGTH && encryptedFileKey.length === Age.FILE_KEY_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH) {
          stanzas.push({
            ephemeralX25519PublicKey,
            encryptedFileKey
          });
        }
      }
    }
    if(ageHeader.substring(startOfLine, startOfLine + `${Age.HEADER_MAC_LINE_PREFIX} `.length) !== `${Age.HEADER_MAC_LINE_PREFIX} `) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    const endOfLine = ageHeader.indexOf("\n", startOfLine);
    if(endOfLine === -1 || endOfLine + "\n".length !== ageHeader.length) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    const encodedMac = ageHeader.substring(startOfLine + `${Age.HEADER_MAC_LINE_PREFIX} `.length, endOfLine);
    if(encodedMac.endsWith(Crypto.BASE64_PADDING_CHARACTER)) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    if(!/^[a-z0-9+\/]+$/ui.test(encodedMac)) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    const mac = Buffer.from(encodedMac, "base64");
    if(mac.length !== Age.MAC_LENGTH) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    if(stanzas.length !== 1) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid number of stanzas");
    }
    if(agePayload.length < Age.PAYLOAD_NONCE_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH) {
      throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
    }
    const payloadNonce = agePayload.subarray(0, Age.PAYLOAD_NONCE_LENGTH);
    let data: Buffer = Buffer.alloc(0);
    for(let i: number = 0; i < Math.ceil((agePayload.length - Age.PAYLOAD_NONCE_LENGTH) / (Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH)); ++i) {
      if(i === Number.MAX_SAFE_INTEGER) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      const chunk = agePayload.subarray(Age.PAYLOAD_NONCE_LENGTH + i * (Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH), Age.PAYLOAD_NONCE_LENGTH + (i + 1) * (Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH));
      if(chunk.length < Crypto.CHACHA20_POLY1305_TAG_LENGTH) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      else if(chunk.length === Crypto.CHACHA20_POLY1305_TAG_LENGTH && i) {
        throw new MimbleWimbleCoinInvalidParameters("Invalid age file");
      }
      const nonce = Buffer.alloc(Crypto.CHACHA20_POLY1305_NONCE_LENGTH);
      nonce.writeBigInt64BE(BigInt(i), Crypto.CHACHA20_POLY1305_NONCE_LENGTH - 1 - BigUint64Array.BYTES_PER_ELEMENT);
      nonce.writeUInt8((i === Math.ceil((agePayload.length - Age.PAYLOAD_NONCE_LENGTH) / (Age.MAXIMUM_PAYLOAD_CHUNK_LENGTH + Crypto.CHACHA20_POLY1305_TAG_LENGTH)) - 1) ? 1 : 0, Crypto.CHACHA20_POLY1305_NONCE_LENGTH - 1);
      const decryptedChunk = await mimbleWimbleCoin.decryptAgeChunk(account.freshAddresses[0].derivationPath, stanzas[0].ephemeralX25519PublicKey, stanzas[0].encryptedFileKey, payloadNonce, nonce, chunk);
      const temp = Buffer.alloc(data.length + decryptedChunk.length);
      data.copy(temp, 0);
      decryptedChunk.copy(temp, data.length);
      data = temp;
    }
    return data;
  }
}
