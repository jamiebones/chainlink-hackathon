import { Aes128Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
const suite = new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
import * as fs from 'fs';

function arrayBufferToBase64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

(async () => {
  const rkp = await suite.kem.generateKeyPair();
  const pubKeyBuf = await suite.kem.serializePublicKey(rkp.publicKey);
  const privKeyBuf = await suite.kem.serializePrivateKey(rkp.privateKey);
  const pubKey = arrayBufferToBase64url(pubKeyBuf);
  const privKey = arrayBufferToBase64url(privKeyBuf);

  console.log('Generated HPKE keypair:', pubKey);
  fs.writeFileSync('.hpke-secret', privKey);
  fs.writeFileSync('../../frontend-V1/public/hpke-key.txt', pubKey);
  console.log('HPKE keypair generated & saved.');
})();
