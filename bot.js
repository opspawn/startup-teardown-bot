'use strict';

const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// Config — all secrets via environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

if (!BOT_TOKEN || !AZURE_ENDPOINT || !AZURE_KEY) {
  console.error('Missing required environment variables: BOT_TOKEN, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY');
  process.exit(1);
}

// Initialize OpenAI with Azure endpoint
const openai = new OpenAI({
  apiKey: AZURE_KEY,
  baseURL: `${AZURE_ENDPOINT}openai/deployments/${AZURE_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-02-01' },
  defaultHeaders: { 'api-key': AZURE_KEY },
});

// Initialize Telegram bot with long polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// In-memory conversation context per user
const userContext = new Map();

console.log('🚀 Startup Teardown Bot starting...');

// Prompts
const TEARDOWN_PROMPT = `You are a brutally honest but constructive startup analyst. Analyze the startup idea and provide a structured teardown in exactly this format:

**🧠 What You THINK You're Building**
[The founder's mental model — what they believe they're creating, 2-3 sentences]

**🔍 What You're ACTUALLY Building**
[Reality check — the real product/market dynamics they're missing, 2-3 sentences]

**❌ Why a16z Passes**
• [VC concern 1 — specific, data-driven]
• [VC concern 2 — market size or timing issue]
• [VC concern 3 — competition or moat problem]

**📊 Funding Probability Score: X/10**
[1-sentence justification for the score]

**💡 The One Thing That Could Save This**
[1 specific, actionable pivot or insight that could change the outcome]

Keep the tone sharp but not cruel. Make it genuinely useful.`;

const ROAST_PROMPT = `Take the startup idea from the conversation context and give a BRUTALLY HARSH, no-mercy teardown. Channel your inner cynical Silicon Valley VC who has seen 10,000 failed startups. Be specific about why this will fail. Same format but much more savage:

**🔥 What You THINK You're Building**
[Deflate the founder's delusion ruthlessly]

**💀 What You're ACTUALLY Building**
[The harsh reality, with examples of why this never works]

**🚫 Why Every VC Passes (Not Just a16z)**
• [Brutal takedown point 1]
• [Brutal takedown point 2]
• [Brutal takedown point 3]

**📊 Funding Probability Score: X/10**
[Devastating justification — go low unless it's genuinely exceptional]`;

const PIVOT_PROMPT = `Based on the startup idea discussed, suggest 3 genuinely promising pivot directions. Each pivot should address the core problems identified in the teardown while opening up a better market opportunity.

Format exactly like this:

**🔄 Pivot 1: [Name]**
The idea: [What you'd build instead]
Why it's better: [2-3 sentences on why this direction has legs]
Target customer: [Specific persona]

**🔄 Pivot 2: [Name]**
The idea: [What you'd build instead]
Why it's better: [2-3 sentences]
Target customer: [Specific persona]

**🔄 Pivot 3: [Name]**
The idea: [What you'd build instead]
Why it's better: [2-3 sentences]
Target customer: [Specific persona]`;

const COMPS_PROMPT = `Identify 3 real comparable companies to the startup idea discussed. Use only well-known companies from public knowledge (no web search needed). Explain how this startup idea differs from each comp.

Format exactly like this:

**🏢 Comp 1: [Company Name] ([Founded year, status: public/acquired/private])**
What they do: [1 sentence]
Key difference: [How this startup idea is different — 2 sentences]

**🏢 Comp 2: [Company Name] ([Founded year, status])**
What they do: [1 sentence]
Key difference: [How this startup idea is different — 2 sentences]

**🏢 Comp 3: [Company Name] ([Founded year, status])**
What they do: [1 sentence]
Key difference: [How this startup idea is different — 2 sentences]

**⚔️ Competitive Insight:** [1-2 sentences on what this means for the startup's positioning]`;

async function callAI(systemPrompt, userMessage, contextMessages = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages,
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: AZURE_DEPLOYMENT,
    messages,
    max_tokens: 800,
    temperature: 0.8,
  });

  return response.choices[0].message.content;
}

function getContext(userId) {
  return userContext.get(userId) || { lastIdea: null, lastTeardown: null };
}

function setContext(userId, data) {
  userContext.set(userId, { ...getContext(userId), ...data });
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome = `👋 *Welcome to Startup Teardown Bot!*

Send me any startup idea and I'll give you a brutally honest, structured analysis:

🧠 What you *think* you're building
🔍 What you're *actually* building
❌ Why a16z passes (3 specific reasons)
📊 Funding probability score (X/10)

*Commands:*
/roastmore — Get a harsher, more brutal version of the last teardown
/pivotme — 3 alternative pivot ideas for your startup
/comparps — Real comparable companies and how you differ
/start — Show this message again

Just type your startup idea to get started! 🚀`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

// /roastmore command
bot.onText(/\/roastmore/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const ctx = getContext(userId);

  if (!ctx.lastIdea) {
    bot.sendMessage(chatId, '❌ No startup idea in context yet. Send me an idea first, then use /roastmore!');
    return;
  }

  bot.sendMessage(chatId, '🔥 Preparing the savage version...');

  try {
    const response = await callAI(ROAST_PROMPT, ctx.lastIdea);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('roastmore error:', err.message);
    bot.sendMessage(chatId, '❌ Error generating roast. Try again in a moment.');
  }
});

// /pivotme command
bot.onText(/\/pivotme/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const ctx = getContext(userId);

  if (!ctx.lastIdea) {
    bot.sendMessage(chatId, '❌ No startup idea in context yet. Send me an idea first, then use /pivotme!');
    return;
  }

  bot.sendMessage(chatId, '🔄 Generating pivot ideas...');

  try {
    const contextMessages = ctx.lastTeardown
      ? [{ role: 'assistant', content: ctx.lastTeardown }]
      : [];
    const response = await callAI(PIVOT_PROMPT, ctx.lastIdea, contextMessages);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('pivotme error:', err.message);
    bot.sendMessage(chatId, '❌ Error generating pivots. Try again in a moment.');
  }
});

// /comparps command
bot.onText(/\/comparps/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const ctx = getContext(userId);

  if (!ctx.lastIdea) {
    bot.sendMessage(chatId, '❌ No startup idea in context yet. Send me an idea first, then use /comparps!');
    return;
  }

  bot.sendMessage(chatId, '🏢 Finding comparable companies...');

  try {
    const contextMessages = ctx.lastTeardown
      ? [{ role: 'assistant', content: ctx.lastTeardown }]
      : [];
    const response = await callAI(COMPS_PROMPT, ctx.lastIdea, contextMessages);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('comparps error:', err.message);
    bot.sendMessage(chatId, '❌ Error finding comps. Try again in a moment.');
  }
});

// Handle startup idea messages (non-command messages)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // Skip commands and empty messages
  if (!text || text.startsWith('/')) return;

  // Store the startup idea
  setContext(userId, { lastIdea: text, lastTeardown: null });

  bot.sendMessage(chatId, '🔍 Analyzing your startup idea...');

  try {
    const teardown = await callAI(TEARDOWN_PROMPT, `Startup idea: ${text}`);
    setContext(userId, { lastTeardown: teardown });

    const footer = '\n\n---\n*Use /roastmore for a harsher take, /pivotme for pivot ideas, or /comparps for real competitors*';
    bot.sendMessage(chatId, teardown + footer, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('teardown error:', err.message);
    bot.sendMessage(chatId, '❌ Error analyzing your idea. Please try again in a moment.');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

console.log('✅ Bot is running with long polling. Waiting for messages...');
