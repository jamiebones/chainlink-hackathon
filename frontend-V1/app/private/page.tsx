'use client';
import { useEffect, useState } from "react";
import { Wallet } from "ethers";
import { CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";

const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
});

function base64urlToUint8Array(base64url: string): Uint8Array {
  let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function usePrivateTradeHpke() {
  const [botPk, setBotPk] = useState<CryptoKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/hpke-key.txt');
        const b64 = await res.text();
        const pubkeyBytes = base64urlToUint8Array(b64);
        const pubkeyBuffer = pubkeyBytes.buffer.slice(pubkeyBytes.byteOffset, pubkeyBytes.byteOffset + pubkeyBytes.byteLength) as ArrayBuffer;
        const deserialized = await suite.kem.deserializePublicKey(pubkeyBuffer);
        setBotPk(deserialized);
        console.log('HPKE key loaded!');
      } catch (err) {
        console.error('Failed to fetch or process HPKE key', err);
      }
    })();
  }, []);

  return async function sendPrivateTrade(
    assetId: number,
    qty: bigint,
    margin: bigint
  ) {
    if (!botPk) {
      alert('Bot key not loaded yet');
      throw new Error('Bot key not loaded yet');
    }
    const burner = Wallet.createRandom();
    const payload = {
      trader: burner.address,
      assetId,
      qty: qty.toString(),
      margin: margin.toString(),
      ts: Date.now(),
    };
    const payloadJson = JSON.stringify(payload);
    const sig = await burner.signMessage(payloadJson);

    // Combine payload and sig
    const message = JSON.stringify({ payload, sig });
    const encodedPayload = new TextEncoder().encode(message);

    // HPKE Encrypt
    const sender = await suite.createSenderContext({ recipientPublicKey: botPk });
    // const ctc = await sender.seal(new TextEncoder().encode("Hello world!"));
    const ctc = await sender.seal(encodedPayload.buffer.slice(encodedPayload.byteOffset, encodedPayload.byteOffset + encodedPayload.byteLength) as ArrayBuffer);
    const ciphertext = await sender.seal(encodedPayload.buffer.slice(encodedPayload.byteOffset, encodedPayload.byteOffset + encodedPayload.byteLength) as ArrayBuffer);

    // Convert to base64 for POST
    const encBase64 = Buffer.from(sender.enc).toString('base64');
    const ctcBase64 = Buffer.from(ctc).toString('base64');

    await fetch('http://localhost:8080/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enc: encBase64, ctc: ctcBase64 }),
    });

    alert('Trade sent privately 🚀');
  };
}

export default function PrivatePage() {
  const sendTrade = usePrivateTradeHpke();

  async function handleClick() {
    try {
      await sendTrade(0, 5n * 10n ** 18n, 1_000_000n);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
      {/* Blurred colored balls for Uniswap-style background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
      <button
        onClick={handleClick}
        style={{ backgroundColor: '#FF007A', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4 }}
      >
        Send Private Order
      </button>
    </div>
  );
}