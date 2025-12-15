const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!apiKey && !groqApiKey) {
  console.warn('No AI API keys set. AI features will be disabled.');
}

const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

async function backoff(fn, attempts=3, base=250) {
  let lastErr;
  for (let i=0;i<attempts;i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r=>setTimeout(r, base*Math.pow(2,i))); }
  }
  throw lastErr;
}

async function askGemini(prompt, generationConfig = {}) {
  if (!apiKey || !client) throw new Error('Missing Google API key. AI features will be disabled.');
  
  try {
    const result = await backoff(() => client.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }));
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, raw: result };
  } catch (err) {
    console.error('GenAI request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    const sdkMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`GenAI request failed: ${sdkMsg}`);
  }
}

// New: Explain image using Gemini multimodal
async function explainImage(imageUrl, prompt) {
  if (!apiKey || !client) throw new Error('Missing Google API key. AI features will be disabled.');
  
  const head = await axios.head(imageUrl).catch(()=>null);
  const len = parseInt(head?.headers?.['content-length']||'0',10);
  if (len && len > 8*1024*1024) throw new Error('Image too large (>8MB).');
  
  const response = await backoff(()=>axios.get(imageUrl, { responseType: 'arraybuffer' }));
  const imageBuffer = Buffer.from(response.data, 'binary');
  const imageBase64 = imageBuffer.toString('base64');
  
  try {
    const result = await backoff(() => client.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt || 'Explain this image.' },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } }
        ]
      }]
    }));
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No explanation found.';
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

/**
 * Chat with Groq (fast, for dashboard and /ask command)
 * Uses OpenAI-compatible API with Llama 3.3 70B
 */
async function chatGroq(message, history = [], options = {}) {
  if (!groqApiKey) throw new Error('Missing GROQ_API_KEY. Please set it in your .env file.');
  
  const {
    systemPrompt = 'You are Chocomaid AI Assistant, a helpful bot management assistant. Be concise, friendly, and format your responses with markdown when appropriate.',
    temperature = 0.7,
    maxTokens = 2000,
    model = 'llama-3.3-70b-versatile' // Current available models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
  } = options;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add history (last 10 messages for context)
  if (Array.isArray(history)) {
    history.slice(-10).forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });
  }

  // Add current message
  messages.push({ role: 'user', content: message });

  try {
    const response = await backoff(async () => {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return res.data;
    });

    const text = response?.choices?.[0]?.message?.content || '';
    return { text, raw: response };
  } catch (err) {
    console.error('Groq request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`Groq request failed: ${errorMsg}`);
  }
}

/**
 * Chat with Groq using function calling (for dashboard CRUD operations)
 */
async function chatGroqWithTools(message, tools, history = [], options = {}) {
  if (!groqApiKey) throw new Error('Missing GROQ_API_KEY. Please set it in your .env file.');
  
  const {
    systemPrompt = 'You are Chocomaid AI Assistant. Use the available tools to help users manage their Discord bot.',
    temperature = 0.7,
    model = 'llama-3.3-70b-versatile' // llama-3.3-70b-versatile supports tool calling
  } = options;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add history
  if (Array.isArray(history)) {
    history.slice(-10).forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });
  }

  // Add current message
  messages.push({ role: 'user', content: message });

  // Convert tools to OpenAI function format
  const functions = tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.entries(tool.parameters || {}).reduce((acc, [key, val]) => {
          acc[key] = {
            type: val.type || 'string',
            description: val.description || ''
          };
          return acc;
        }, {}),
        required: Object.entries(tool.parameters || {})
          .filter(([_, val]) => val.required)
          .map(([key, _]) => key)
      }
    }
  }));

  try {
    const response = await backoff(async () => {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages,
          tools: functions,
          tool_choice: 'auto',
          temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return res.data;
    });

    const choice = response?.choices?.[0];
    
    // Check if a tool was called
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      return {
        text: choice.message.content || '',
        toolCall: {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        },
        raw: response
      };
    }

    // No tool call, just regular response
    return {
      text: choice?.message?.content || '',
      toolCall: null,
      raw: response
    };
  } catch (err) {
    console.error('Groq tools request error:', err?.response?.status || err?.code || 'N/A', err?.response?.data || err.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || JSON.stringify(err);
    throw new Error(`Groq tools request failed: ${errorMsg}`);
  }
}

module.exports = { askGemini, explainImage, explainImages, chatGroq, chatGroqWithTools };
