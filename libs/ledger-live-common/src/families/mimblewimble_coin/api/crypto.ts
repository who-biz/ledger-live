export default class Crypto {

  public static readonly HARDENED_PATH_MASK = 0x80000000;
  public static readonly BIP44_PATH_PURPOSE_INDEX = 0;
  public static readonly BIP44_PATH_COIN_TYPE_INDEX = 1;
  public static readonly BIP44_PATH_ACCOUNT_INDEX = 2;
  public static readonly BIP44_PATH_CHANGE_INDEX = 3;
  public static readonly BIP44_PATH_INDEX_INDEX = 4;
  public static readonly BIP44_PATH_DEFAULT_PURPOSE = 44;
  public static readonly BIP44_PATH_DEFAULT_CHANGE = 0;
  public static readonly BIP44_PATH_DEFAULT_INDEX = 0;
  public static readonly SwitchType = {
    NONE: 0,
    REGULAR: 1
  };
  public static readonly TAU_X_LENGTH = 32;
  public static readonly SECP256K1_PRIVATE_KEY_LENGTH = 32;
  public static readonly SECP256K1_PUBLIC_KEY_LENGTH = 33;
  public static readonly COMMITMENT_LENGTH = 33;
  public static readonly SINGLE_SIGNER_SIGNATURE_LENGTH = 64;
  public static readonly BULLETPROOF_LENGTH = 675;
  public static readonly ED25519_SIGNATURE_LENGTH = 64;
  public static readonly ED25519_PRIVATE_KEY_LENGTH = 32;
  public static readonly ED25519_PUBLIC_KEY_LENGTH = 32;
  public static readonly X25519_PRIVATE_KEY_LENGTH = 32;
  public static readonly X25519_PUBLIC_KEY_LENGTH = 32;
  public static readonly CHACHA20_POLY1305_NONCE_LENGTH = 12;
  public static readonly CHACHA20_POLY1305_TAG_LENGTH = 16;
  public static readonly BASE64_PADDING_CHARACTER = "=";

  private constructor() {
  }
}
