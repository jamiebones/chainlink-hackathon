import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import { verifyMessage } from 'ethers';



const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));

app.post('/verify', async (req, res) => {
  try {
    const { payload, sig } = req.body;
    if (!payload || !sig) {
      return res.status(400).json({ error: 'Missing payload or signature' });
    }
    const payloadJson = JSON.stringify(payload);
    const recovered = verifyMessage(payloadJson, sig);
    if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
      return res.status(400).json({ error: 'Signature does not match trader address' });
    }
    res.json({ success: true, trader: recovered });
  } catch (e) {
    console.error('❌ Error:', e);
    res.status(400).json({ error: 'sig failed' });
  }
});

app.listen(8090, () => console.log('🟢 Listening on :8090'));
