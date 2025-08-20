const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('No GOOGLE_API_KEY or GEMINI_API_KEY set. AI features will be disabled.');
}
const client = new GoogleGenAI({ apiKey });

// Build contents array similar to the server example
function buildContentsFromPrompt(prompt) {
  return [{ role: 'user', parts: [{ text: prompt }] }];
}

async function askGemini(prompt, generationConfig = {}) {
  if (!apiKey) throw new Error('Missing Google API key (set GOOGLE_API_KEY or GEMINI_API_KEY in .env)');
  const contents = buildContentsFromPrompt(prompt);
  try {
    const response = await client.models.generateContent({
      model: 'models/gemini-2.0-flash',
      contents,
      generationConfig: Object.assign({ maxOutputTokens: 512, temperature: 0.2 }, generationConfig)
    });
    const text = response?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
    return { text, raw: response };
  } catch (err) {
    // Normalize error message for caller; log details for local debugging
    console.error('GenAI request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    // Try to extract a useful message from the SDK error
    const sdkMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`GenAI request failed: ${sdkMsg}`);
  }
}

module.exports = { askGemini };
