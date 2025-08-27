const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('No GOOGLE_API_KEY or GEMINI_API_KEY set. AI features will be disabled.');
}
const client = new GoogleGenAI({ apiKey });

function buildContentsFromPrompt(prompt) {
  return [{ role: 'user', parts: [{ text: prompt }] }];
}

async function backoff(fn, attempts=3, base=250) {
  let lastErr;
  for (let i=0;i<attempts;i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r=>setTimeout(r, base*Math.pow(2,i))); }
  }
  throw lastErr;
}

async function askGemini(prompt, generationConfig = {}) {
  if (!apiKey) throw new Error('Missing Google API key. AI features will be disabled.');
  const contents = buildContentsFromPrompt(prompt);
  try {
    const response = await backoff(()=>client.models.generateContent({
      model: 'models/gemini-2.0-flash',
      contents,
      generationConfig: Object.assign({ maxOutputTokens: 512, temperature: 0.2 }, generationConfig)
    }));
    const text = response?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
    return { text, raw: response };
  } catch (err) {
    console.error('GenAI request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    const sdkMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`GenAI request failed: ${sdkMsg}`);
  }
}

// New: Explain image using Gemini multimodal
async function explainImage(imageUrl, prompt) {
  if (!apiKey) throw new Error('Missing Google API key. AI features will be disabled.');
  const head = await axios.head(imageUrl).catch(()=>null);
  const len = parseInt(head?.headers?.['content-length']||'0',10);
  if (len && len > 8*1024*1024) throw new Error('Image too large (>8MB).');
  const response = await backoff(()=>axios.get(imageUrl, { responseType: 'arraybuffer' }));
  const imageBuffer = Buffer.from(response.data, 'binary');
  const imageBase64 = imageBuffer.toString('base64');
  const model = client.getGenerativeModel ? client.getGenerativeModel({ model: 'gemini-2.0-flash' }) : client.models;
  const contents = [
    { role: 'user', parts: [
      { text: prompt || 'Explain this image.' },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } }
    ] }
  ];
  try {
    const result = await backoff(()=>model.generateContent({
      model: 'models/gemini-2.0-flash',
      contents
    }));
    const text = result?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || 'No explanation found.';
    return text;
  } catch (err) {
    console.error('GenAI image request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    const sdkMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`GenAI image request failed: ${sdkMsg}`);
  }
}

async function explainImages(urls, prompt) {
  const parts = [];
  for (const url of urls) {
    try { parts.push(await explainImage(url, prompt)); }
    catch (e) { parts.push(`(Failed: ${e.message})`); }
  }
  return parts.join('\n\n');
}
module.exports = { askGemini, explainImage, explainImages };
