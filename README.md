# VoltAgent Agent

AI Agent running on Proxmox with OpenRouter integration.

## Setup

```bash
# Install dependencies
pnpm install

# Set environment variable
echo "OPENROUTER_API_KEY=your-key" > .env

# Start development server
pnpm run dev
```

## API Endpoints

- **Base URL:** https://pve-1.tail4ed754.ts.net
- **Health:** `/api/health`
- **Chat:** `POST /api/chat`

## Available Agents

| Agent | Model | Description |
|-------|-------|-------------|
| assistant | openai/gpt-4o-mini | General assistant |
| code | anthropic/claude-3.5-sonnet | Code expert |
| researcher | openai/gpt-4o-mini | Research with web search |

## Example

```bash
curl -X POST https://pve-1.tail4ed754.ts.net/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

## License

MIT
