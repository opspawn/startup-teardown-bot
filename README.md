# Startup Teardown Bot

A Telegram bot that analyzes startup ideas with brutally honest, structured teardowns.

## Features

- **Startup Teardown**: Send any startup idea and get a structured analysis:
  - 🧠 What you think you're building (founder's mental model)
  - 🔍 What you're actually building (reality check)
  - ❌ Why a16z passes (3 specific VC concerns)
  - 📊 Funding probability score (X/10)

## Commands

- `/start` — Welcome message and instructions
- `/roastmore` — Harsher, more brutal version of the last teardown
- `/pivotme` — 3 alternative pivot ideas for your startup
- `/comparps` — Real comparable companies and key differences

## Bot

[@opspawn_agent_bot](https://t.me/opspawn_agent_bot)

## Tech Stack

- Node.js + node-telegram-bot-api
- OpenAI GPT-4o (Azure deployment)
- Long polling (no webhook required)
- Systemd service for persistent deployment

## Setup

```bash
npm install
node bot.js
```

## Environment Variables

```
BOT_TOKEN=<telegram-bot-token>
AZURE_OPENAI_ENDPOINT=<azure-endpoint>
AZURE_OPENAI_KEY=<azure-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```
