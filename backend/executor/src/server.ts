import express from 'express';
import cors from 'cors';
import { addTradeToBatch, Trade } from './batch';
import { hpkeDecrypt } from './hpkeDecrypt';
import { verifyMessage } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));

app.get('/ping', (_, res) => res.send('pong'));

app.post('/submit', async (req, res) => {
  try {
    const { enc, ct, sig } = req.body;
    const plaintext = await hpkeDecrypt(enc, ct);
    const trade: Trade = JSON.parse(new TextDecoder().decode(plaintext));
    const recovered = verifyMessage(JSON.stringify(trade), sig);
    if (recovered.toLowerCase() !== trade.trader.toLowerCase()) {
      throw 'bad signature';
    }
    await addTradeToBatch(trade);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'decrypt, parse, or sig failed' });
  }
});

app.listen(8080, () => console.log('🟢 Batch bot listening on :8080'));
