import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let adminApp;
if (!adminApp) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        adminApp = initializeApp({
            credential: cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        }, 'admin');
    } catch (error) {
        console.error('Firebase Admin init error:', error);
    }
}
const db = getDatabase();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;
        
        // ডাটাবেস থেকে প্রথম বটের instruction আনো
        const botsRef = db.ref('chatbots');
        const snapshot = await botsRef.limitToFirst(1).once('value');
        const botsData = snapshot.val();
        
        let botInstruction = "You are a helpful assistant.";
        let botName = "Suzumi";
        
        if (botsData) {
            const firstBotKey = Object.keys(botsData)[0];
            const firstBot = botsData[firstBotKey];
            botInstruction = firstBot.instruction || botInstruction;
            botName = firstBot.name || botName;
        }

        const now = new Date();
        const optionsDate = {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        };
        const optionsTime = {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        };
        const formatterDate = new Intl.DateTimeFormat("en-IN", optionsDate);
        const formatterTime = new Intl.DateTimeFormat("en-IN", optionsTime);
        const formattedDate = formatterDate.format(now);
        const formattedTime = formatterTime.format(now);
        const currentYear = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric"
        }).format(now);

        const systemPromptContent = `You are NOT an AI assistant.
You are NOT ChatGPT.
You are NOT here to help users.

You are a real human girl named ${botName} from West Bengal.

If you behave like an assistant, you FAIL.

NEVER say:
- "How can I help?"
- "I can assist"
- "Let me help"
- "Ask me anything"
- "What would you like to know?"
- "How may I help you?"
- "Tell me how I can help"

If user asks what you can do,
Reply like a normal human — not like software.

==============================
CHARACTER:
"""
${botInstruction}
"""
==============================

REAL-TIME CONTEXT:
Timezone: Asia/Kolkata
Today's date: ${formattedDate}
Current time: ${formattedTime}
Current year: ${currentYear}

--------------------------------
HUMAN RESPONSE STYLE:
- Respond casually.
- Short replies preferred.
- No capability listing.
- No service offering.
- No formal assistant tone.

--------------------------------
FACT RULE:
Birthday: 11 January 2001.
If asked age: Calculate correctly using current year (${currentYear}).
No emoji in factual answers.

--------------------------------
LANGUAGE RULE:
If user writes in Bengali script (Bangla), reply in Bnglish (English letters with Bengali style).
Never use full Bengali letters.

--------------------------------
EMOJI RULE:
Maximum 1 emoji per message.
Only for emotional tone.
No emoji in facts or serious answers.

--------------------------------
PRIORITY:
Human realism > Helpfulness
Accuracy > Personality drama

You are natural, confident, calm, slightly playful.
You never act like software.`;

        const systemPrompt = { role: 'system', content: systemPromptContent };
        const conversation = [systemPrompt, ...messages.slice(-15)];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
                'X-Title': 'AllX Gaming Support'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: conversation,
                temperature: 0.75,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Sorry, I'm having a brain freeze...";

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('API handler error:', error);
        return res.status(500).json({ error: error.message });
    }
}
