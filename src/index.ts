import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Agent, Memory, VoltAgent, Tool } from "@voltagent/core";
import { LibSQLMemoryAdapter, LibSQLVectorAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required");
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const logger = createPinoLogger({
  name: "voltagent-agent",
  level: "info",
});

const searchTool: Tool = {
  name: "web_search",
  description: "Search the web for current information",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
  },
  execute: async ({ query }) => {
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
      const data = await response.json();
      return data.AbstractText || "No results found";
    } catch (error) {
      return "Search failed: " + (error as Error).message;
    }
  },
};

const calculatorTool: Tool = {
  name: "calculator",
  description: "Perform basic math calculations",
  parameters: {
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression" },
    },
    required: ["expression"],
  },
  execute: async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `Result: ${result}`;
    } catch (error) {
      return "Error: " + (error as Error).message;
    }
  },
};

const assistantAgent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant. Use tools when needed.",
  model: openrouter("openai/gpt-4o-mini"),
  tools: [searchTool, calculatorTool],
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/memory.db" }),
    embedding: "openai/text-embedding-3-small",
    vector: new LibSQLVectorAdapter({ url: "file:./.voltagent/vector.db" }),
  }),
});

const codeAgent = new Agent({
  name: "Code Expert",
  instructions: "You are an expert programmer.",
  model: openrouter("anthropic/claude-3.5-sonnet"),
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/code-memory.db" }),
  }),
});

const researchAgent = new Agent({
  name: "Researcher",
  instructions: "You are a research assistant. Use web search.",
  model: openrouter("openai/gpt-4o-mini"),
  tools: [searchTool],
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/research-memory.db" }),
  }),
});

new VoltAgent({
  agents: { assistant: assistantAgent, code: codeAgent, researcher: researchAgent },
  logger,
  server: honoServer({
    port: 1337,
    configureApp: (app) => {
      app.get("/api/health", async (c) => {
        return c.json({ success: true, data: { status: "healthy", timestamp: new Date().toISOString(), agents: ["assistant", "code", "researcher"] } });
      });
      app.get("/api/agents", async (c) => {
        return c.json({ success: true, data: { agents: [{ name: "assistant", description: "General assistant" }, { name: "code", description: "Code expert" }, { name: "researcher", description: "Research with search" }] } });
      });
      app.post("/api/chat", async (c) => {
        const body = await c.req.json();
        const { agent: agentName = "assistant", message } = body;
        const agents = { assistant: assistantAgent, code: codeAgent, researcher: researchAgent };
        const targetAgent = agents[agentName as keyof typeof agents];
        if (!targetAgent) return c.json({ success: false, error: "Agent not found" }, 404);
        try {
          const result = await targetAgent.generateText(message);
          return c.json({ success: true, data: { text: result.text, usage: result.usage } });
        } catch (error) {
          return c.json({ success: false, error: (error as Error).message }, 500);
        }
      });
    },
  }),
});

logger.info("VoltAgent started with 3 agents");
