/* chainparams */
const PUBKEY_ADDRESS = 30;
const SECRET_KEY     = 212;

importScripts('libs/noble-secp256k1.js', 'libs/bn.js', 'libs/crypto-min.js', 'libs/crypto-sha256-hmac.js', 'libs/crypto-sha256.js', 'libs/jsbn.js', 'libs/ripemd160.js', 'libs/sha256.js');

const nSecp256k1 = nobleSecp256k1.default;

// B58 Encoding Map
const MAP = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".split('');;

// ByteArray to B58
var to_b58 = function (
  B           //Uint8Array raw byte input
) {
  var d = [], //the array for storing the stream of base58 digits
    s = "",   //the result string variable that will be returned
    i,        //the iterator variable for the byte input
    j,        //the iterator variable for the base58 digit array (d)
    c,        //the carry amount variable that is used to overflow from the current base58 digit to the next base58 digit
    n;        //a temporary placeholder variable for the current base58 digit
  for (i in B) { //loop through each byte in the input stream
    j = 0,                           //reset the base58 digit iterator
      c = B[i];                        //set the initial carry amount equal to the current byte amount
    s += c || s.length ^ i ? "" : 1; //prepend the result string with a "1" (0 in base58) if the byte stream is zero and non-zero bytes haven't been seen yet (to ensure correct decode length)
    while (j in d || c) {             //start looping through the digits until there are no more digits and no carry amount
      n = d[j];                    //set the placeholder for the current base58 digit
      n = n ? n * 256 + c : c;     //shift the current base58 one byte and add the carry amount (or just add the carry amount if this is a new digit)
      c = n / 58 | 0;              //find the new carry amount (floored integer of current digit divided by 58)
      d[j] = n % 58;               //reset the current base58 digit to the remainder (the carry amount will pass on the overflow)
      j++                          //iterate to the next base58 digit
    }
  }
  while (j--)        //since the base58 digits are backwards, loop through them in reverse order
    s += MAP[d[j]];  //lookup the character associated with each base58 digit
  return s;          //return the final base58 string
}
//B58 to ByteArray
var from_b58 = function (
  S           //Base58 encoded string input
) {
  var d = [], //the array for storing the stream of decoded bytes
    b = [],   //the result byte array that will be returned
    i,        //the iterator variable for the base58 string
    j,        //the iterator variable for the byte array (d)
    c,        //the carry amount variable that is used to overflow from the current byte to the next byte
    n;        //a temporary placeholder variable for the current byte
  for (i in S) { //loop through each base58 character in the input string
    j = 0,                             //reset the byte iterator
      c = MAP.indexOf(S[i]);           //set the initial carry amount equal to the current base58 digit
    if (c < 0)                         //see if the base58 digit lookup is invalid (-1)
      return undefined;                //if invalid base58 digit, bail out and return undefined
    c || b.length ^ i ? i : b.push(0); //prepend the result array with a zero if the base58 digit is zero and non-zero characters haven't been seen yet (to ensure correct decode length)
    while (j in d || c) {              //start looping through the bytes until there are no more bytes and no carry amount
      n = d[j];                      //set the placeholder for the current byte
      n = n ? n * 58 + c : c;        //shift the current byte 58 units and add the carry amount (or just add the carry amount if this is a new byte)
      c = n >> 8;                    //find the new carry amount (1-byte shift of current byte value)
      d[j] = n % 256;                //reset the current byte to the remainder (the carry amount will pass on the overflow)
      j++                            //iterate to the next byte
    }
  }
  while (j--)               //since the byte array is backwards, loop through it in reverse order
    b.push(d[j]);           //append each byte to the result
  return new Uint8Array(b); //return the final byte array in Uint8Array format
}

// Cryptographic Random-Gen
function getSafeRand(b) {
  const r = b || new Uint8Array(32);
  crypto.getRandomValues(r);
  return r;
}

// Writes a sequence of Array-like bytes into a location within a Uint8Array
function writeToUint8(arr, bytes, pos = 0) {
  const len = arr.length;
  let i = 0;
  for (pos; pos<len; pos++) {
    arr[pos] = bytes[i];
    if (!Number.isSafeInteger(bytes[i++])) break;
  }
}

// Generation Constants + Pre-allocations
const pubCompressedLen = 33;                              // (int) Length of compressed pubkey
const pubCompressed = new Uint8Array(pubCompressedLen);   // (Uint8) Pre-allocated array for a compressed pubkey
const pubHashNetLen = 21;                                 // (int) Length of net-encoded pubkey hash
const pubHashNet = new Uint8Array(pubHashNetLen);         // (Uint8) Pre-allocated array for a pubkey hash
const pubPreBaseLen = 25;                                 // (int) Length of pre-base58 pubkey
const pubPreBase = new Uint8Array(pubPreBaseLen);         // (Uint8) Pre-allocated array for a pre-base58 pubkey
pubHashNet[0] = PUBKEY_ADDRESS;                           // Public key prefix  (1 byte)

const pkBytes = new Uint8Array(32);
while (true) {
    // Generate Secure Random bytes
    getSafeRand(pkBytes);

    // Public Key Derivation
    let nPubkey = nSecp256k1.getPublicKey(pkBytes).slice(1, 65);
    const pubY = new BN(nPubkey.slice(32), 16);
    pubCompressed[0] = pubY.isEven() ? 2 : 3;
    writeToUint8(pubCompressed, nPubkey.slice(0, 32), 1);
    // First pubkey SHA-256 hash
    const pubKeyHashing = new jsSHA(0, 0, { "numRounds": 1 });
    pubKeyHashing.update(pubCompressed);
    // RIPEMD160 hash
    const pubKeyHashRipemd160 = ripemd160(pubKeyHashing.getHash(0));
    // Network Encoding
    writeToUint8(pubHashNet, pubKeyHashRipemd160, 1);
    // Double SHA-256 hash
    const pubKeyHashingS = new jsSHA(0, 0, { "numRounds": 2 });
    pubKeyHashingS.update(pubHashNet);
    const pubKeyHashingSF = pubKeyHashingS.getHash(0);
    // Checksum
    const checksumPubKey = pubKeyHashingSF.slice(0, 4);
    // Public key pre-base58
    writeToUint8(pubPreBase, pubHashNet, 0);
    writeToUint8(pubPreBase, checksumPubKey, pubHashNetLen);

    postMessage({'pub': to_b58(pubPreBase), 'priv': pkBytes});
}