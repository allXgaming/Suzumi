import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// -------------------- টুল ডিটেকশন ফাংশন --------------------
function detectToolAndParams(userMessage) {
    const msg = userMessage.toLowerCase();

    // 1. আবহাওয়া (Weather)
    if (msg.includes('weather') || msg.includes('আবহাওয়া') || msg.includes('তাপমাত্রা') || msg.includes('temperature')) {
        // লোকেশন খোঁজার চেষ্টা (ইংরেজি/বাংলা)
        let location = 'Kolkata'; // ডিফল্ট
        const locationMatch = msg.match(/(?:in|of|at|for)?\s*([a-zA-Z\s]+)(?:\?|$)/);
        if (locationMatch && locationMatch[1]) {
            location = locationMatch[1].trim();
        } else if (msg.includes('dhaka')) location = 'Dhaka';
        else if (msg.includes('chittagong')) location = 'Chittagong';
        else if (msg.includes('delhi')) location = 'Delhi';
        else if (msg.includes('mumbai')) location = 'Mumbai';
        else if (msg.includes('kolkata')) location = 'Kolkata';
        else if (msg.includes('কলকাতা')) location = 'Kolkata';
        else if (msg.includes('ঢাকা')) location = 'Dhaka';
        
        return { tool: 'weather', params: { location } };
    }

    // 2. কারেন্সি এক্সচেঞ্জ
    if (msg.includes('currency') || msg.includes('exchange') || msg.includes('rate') || msg.includes('মুদ্রা') || msg.includes('টাকা') || msg.includes('ডলার')) {
        let from = 'USD', to = 'BDT';
        const usdMatch = msg.match(/(\d+)\s*(usd|dollar)/i);
        if (usdMatch) {
            from = 'USD';
        } else if (msg.includes('eur')) {
            from = 'EUR';
        }
        if (msg.includes('bdt') || msg.includes('taka') || msg.includes('টাকা')) to = 'BDT';
        else if (msg.includes('inr') || msg.includes('rupee')) to = 'INR';
        return { tool: 'currency', params: { from, to } };
    }

    // 3. দেশের তথ্য
    if (msg.includes('country') || msg.includes('দেশ') || msg.includes('population') || msg.includes('capital')) {
        let country = 'India';
        if (msg.includes('bangladesh') || msg.includes('বাংলাদেশ')) country = 'Bangladesh';
        else if (msg.includes('india') || msg.includes('ভারত')) country = 'India';
        else if (msg.includes('pakistan')) country = 'Pakistan';
        else if (msg.includes('nepal')) country = 'Nepal';
        else if (msg.includes('sri lanka')) country = 'Sri Lanka';
        return { tool: 'country', params: { country } };
    }

    // 4. ছুটির দিন (Holiday)
    if (msg.includes('holiday') || msg.includes('ছুটি') || msg.includes('উৎসব') || msg.includes('festival')) {
        const yearMatch = msg.match(/\b(20\d{2})\b/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
        let countryCode = 'IN';
        if (msg.includes('bangladesh') || msg.includes('বাংলাদেশ')) countryCode = 'BD';
        else if (msg.includes('india') || msg.includes('ভারত')) countryCode = 'IN';
        return { tool: 'holiday', params: { year, countryCode } };
    }

    // 5. নিউজ
    if (msg.includes('news') || msg.includes('খবর') || msg.includes('space')) {
        let limit = 3;
        const limitMatch = msg.match(/(\d+)\s*(news|articles?)/i);
        if (limitMatch) limit = parseInt(limitMatch[1]);
        return { tool: 'news', params: { limit } };
    }

    // 6. কুইজ/ট্রিভিয়া
    if (msg.includes('quiz') || msg.includes('trivia') || msg.includes('question') || msg.includes('কুইজ') || msg.includes('প্রশ্ন')) {
        let amount = 1;
        const amountMatch = msg.match(/(\d+)\s*(quiz|question|trivia)/i);
        if (amountMatch) amount = parseInt(amountMatch[1]);
        return { tool: 'quiz', params: { amount } };
    }

    // 7. আইপি লোকেশন
    if (msg.includes('ip') || msg.includes('location') || msg.includes('আইপি') || msg.includes('অবস্থান')) {
        return { tool: 'ip', params: {} };
    }

    return { tool: 'chat', params: {} };
}

// -------------------- API কলিং ফাংশনগুলো --------------------
async function getWeather(location) {
    try {
        // প্রথমে জিওকোডিং করে latitude/longitude বের করি (একটি ফ্রি API ব্যবহার করছি)
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) return null;
        const { latitude, longitude, name } = geoData.results[0];
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
        const weatherData = await weatherRes.json();
        return { location: name, ...weatherData.current_weather };
    } catch (e) {
        return null;
    }
}

async function getCurrency(from, to) {
    try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
        const data = await res.json();
        return { from, to, rate: data.rates[to], date: data.date };
    } catch (e) {
        return null;
    }
}

async function getCountryInfo(countryName) {
    try {
        const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`);
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const c = data[0];
        return {
            name: c.name.common,
            capital: c.capital?.[0] || 'N/A',
            population: c.population.toLocaleString(),
            region: c.region,
            flag: c.flags?.png || ''
        };
    } catch (e) {
        return null;
    }
}

async function getHolidays(year, countryCode) {
    try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
        const data = await res.json();
        return data.slice(0, 10); // প্রথম ১০টি ছুটি
    } catch (e) {
        return null;
    }
}

async function getNews(limit = 3) {
    try {
        const res = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?limit=${limit}`);
        const data = await res.json();
        return data.results?.map(a => ({ title: a.title, url: a.url, summary: a.summary })) || [];
    } catch (e) {
        return null;
    }
}

async function getQuiz(amount = 1) {
    try {
        const res = await fetch(`https://opentdb.com/api.php?amount=${amount}&type=multiple`);
        const data = await res.json();
        return data.results;
    } catch (e) {
        return null;
    }
}

async function getIpInfo() {
    try {
        const res = await fetch('http://ip-api.com/json/');
        const data = await res.json();
        return {
            ip: data.query,
            city: data.city,
            country: data.country,
            isp: data.isp
        };
    } catch (e) {
        return null;
    }
}

// -------------------- হেল্পার: টুল ডেটাকে প্রাকৃতিক ভাষায় রূপান্তর --------------------
function formatToolDataForPrompt(tool, data) {
    if (!data) return 'Information not available right now.';
    
    switch (tool) {
        case 'weather':
            return `Current weather in ${data.location}: Temperature ${data.temperature}°C, Wind Speed ${data.windspeed} km/h.`;
        case 'currency':
            return `1 ${data.from} equals ${data.rate} ${data.to} as of ${data.date}.`;
        case 'country':
            return `Country: ${data.name}, Capital: ${data.capital}, Population: ${data.population}, Region: ${data.region}.`;
        case 'holiday':
            if (Array.isArray(data)) {
                return `Upcoming holidays: ${data.map(h => `${h.name} on ${h.date}`).join(', ')}.`;
            }
            return 'Holiday data unavailable.';
        case 'news':
            if (Array.isArray(data)) {
                return `Latest space news: ${data.map(n => n.title).join('; ')}.`;
            }
            return 'News unavailable.';
        case 'quiz':
            if (Array.isArray(data) && data.length > 0) {
                const q = data[0];
                return `Trivia Question: ${q.question} Options: ${q.incorrect_answers.concat(q.correct_answer).join(', ')}. Correct answer: ${q.correct_answer}`;
            }
            return 'No quiz available.';
        case 'ip':
            return `Your IP: ${data.ip}, Location: ${data.city}, ${data.country}, ISP: ${data.isp}.`;
        default:
            return '';
    }
}

// -------------------- মেইন চ্যাট এন্ডপয়েন্ট --------------------
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens } = req.body;
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

        // 1. টুল ও প্যারামিটার ডিটেক্ট
        const { tool, params } = detectToolAndParams(lastUserMessage);
        
        let toolData = null;
        let toolContext = '';

        // 2. প্রয়োজনীয় API কল
        if (tool === 'weather') {
            toolData = await getWeather(params.location);
        } else if (tool === 'currency') {
            toolData = await getCurrency(params.from, params.to);
        } else if (tool === 'country') {
            toolData = await getCountryInfo(params.country);
        } else if (tool === 'holiday') {
            toolData = await getHolidays(params.year, params.countryCode);
        } else if (tool === 'news') {
            toolData = await getNews(params.limit);
        } else if (tool === 'quiz') {
            toolData = await getQuiz(params.amount);
        } else if (tool === 'ip') {
            toolData = await getIpInfo();
        }

        // 3. টুল ডেটাকে টেক্সটে রূপান্তর
        if (toolData) {
            toolContext = formatToolDataForPrompt(tool, toolData);
        }

        // 4. সিস্টেম প্রম্পট তৈরি (টুল ডেটা সহ)
        let systemPrompt = `You are a helpful AI assistant. You have access to real-time information.`;

        if (toolContext) {
            systemPrompt += ` Here is the latest data: ${toolContext} Use this information to answer the user's question naturally. Do not mention the API or data source. Just provide the answer as if you know it.`;
        } else {
            systemPrompt += ` Answer the user's question conversationally.`;
        }

        // 5. Hugging Face API কল
        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'meta-llama/Llama-3.1-8B-Instruct',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                temperature: temperature || 0.75,
                max_tokens: max_tokens || 600,
                stream: false
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default app;