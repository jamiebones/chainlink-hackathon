import { Aes128Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
const suite = new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
import * as fs from 'fs';

const botSkB64 = fs.readFileSync('.hpke-secret', 'utf8');
const botSecretRaw = Buffer.from(botSkB64, 'base64'); 
export async function hpkeDecrypt(encB64: string, ctB64: string): Promise<Uint8Array> {
  const enc = new Uint8Array(Buffer.from(encB64, 'base64'));
  const ct  = new Uint8Array(Buffer.from(ctB64, 'base64'));
  const botSecret = await suite.kem.importKey('raw', botSecretRaw, true);
  const params = { recipientKey: botSecret, enc };
  const ptBuffer = await suite.open(params, ct);
  return new Uint8Array(ptBuffer);
}
