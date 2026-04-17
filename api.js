import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens } = req.body;

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'meta-llama/Llama-3.1-8B-Instruct',
        messages,
        temperature: temperature || 0.75,
        max_tokens: max_tokens || 600,
        stream: false
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vercel-এ app.listen() দরকার নেই, এক্সপোর্ট করলেই চলবে
export default app;
