# VoltAgent API Documentation

## Base URL
```
https://pve-1.tail4ed754.ts.net
```

## Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Landing page |
| GET | /ui | Swagger UI |
| GET | /doc | OpenAPI specification |
| GET | /agents | List all agents |
| GET | /agents/:id | Get agent details |
| POST | /agents/:id/text | Generate text response |
| POST | /agents/:id/stream | Stream text (SSE) |
| GET | /tools | List all tools |
| POST | /tools/:name/execute | Execute tool |
| GET | /api/health | Health check |
| GET | /api/agents | List agents (custom) |
| POST | /api/chat | Chat with agent |

## Agent Endpoints

### List All Agents
```bash
GET /agents
```

### Generate Text
```bash
POST /agents/:id/text
Content-Type: application/json

{
  "input": "Hello, how are you?",
  "options": {
    "temperature": 0.7,
    "maxOutputTokens": 4000
  }
}
```

### Stream Response
```bash
POST /agents/:id/stream
Content-Type: application/json

{
  "input": "Tell me a story"
}
```

## Custom Endpoints

### Health Check
```bash
GET /api/health
```

### List Available Agents
```bash
GET /api/agents
```

### Chat with Agent
```bash
POST /api/chat
Content-Type: application/json

{
  "agent": "assistant",
  "message": "Hello!"
}
```

## Available Agents

| Agent | Model | Description |
|-------|-------|-------------|
| **assistant** | openai/gpt-4o-mini | General purpose assistant |
| **code** | anthropic/claude-3.5-sonnet | Code expert |
| **researcher** | openai/gpt-4o-mini | Research with web search |

## Examples

### cURL
```bash
# Health check
curl https://pve-1.tail4ed754.ts.net/api/health

# List agents
curl https://pve-1.tail4ed754.ts.net/agents

# Chat with assistant
curl -X POST https://pve-1.tail4ed754.ts.net/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'

# Chat with code expert
curl -X POST https://pve-1.tail4ed754.ts.net/api/chat \
  -H "Content-Type: application/json" \
  -d '{"agent": "code", "message": "Hello world in Python"}'
```

### JavaScript
```javascript
const response = await fetch('https://pve-1.tail4ed754.ts.net/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: 'assistant',
    message: 'Hello!'
  })
});
const data = await response.json();
console.log(data.data.text);
```

### Python
```python
import requests

response = requests.post(
    'https://pve-1.tail4ed754.ts.net/api/chat',
    json={'agent': 'assistant', 'message': 'Hello!'}
)
print(response.json()['data']['text'])
```

## Swagger UI
Visit: https://pve-1.tail4ed754.ts.net/ui

## OpenAPI Spec
Visit: https://pve-1.tail4ed754.ts.net/doc

---
*Generated: 2026-04-04*
