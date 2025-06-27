import { Aes128Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";


async function doHpke() {
  const suite = new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  // Generate a keypair
  const rkp = await suite.kem.generateKeyPair();

  // Sender context (public key)
  const sender = await suite.createSenderContext({
    recipientPublicKey: rkp.publicKey,
  });

  // Recipient context (private key, encapsulated key)
  const recipient = await suite.createRecipientContext({
    recipientKey: rkp.privateKey,
    enc: sender.enc,
  });

  // Encrypt message
  const ct = await sender.seal(new TextEncoder().encode("Hello world!"));

  // Decrypt message
  const pt = await recipient.open(ct);

  console.log(new TextDecoder().decode(pt));
}

doHpke().catch(e => {
  console.error("failed:", e);
});
