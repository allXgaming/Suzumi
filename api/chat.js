// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://yourdomain.vercel.app', // তোমার ডোমেইন বসাও
        'X-Title': 'AllX AI Chat'
      },
      body: JSON.stringify({
        model: model || 'openrouter/free', // ডিফল্ট ফ্রি মডেল
        messages,
        temperature: 0.75,
        max_tokens: 600
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenRouter API error');
    }

    // চেক করো রেসপন্সে কনটেন্ট আছে কি না
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from model');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    // এরর হলে ক্লায়েন্টকে জানিয়ে দাও
    res.status(500).json({ 
      error: error.message,
      fallbackReply: "Kichu bolte parchi na 😕" 
    });
  }
}
