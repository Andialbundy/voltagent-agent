import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Agent, Memory, VoltAgent, Tool, Workflow, workflowStep } from "@voltagent/core";
import { LibSQLMemoryAdapter, LibSQLVectorAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";
import { createMcpServer } from "@voltagent/mcp-server";

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

// ============ TOOLS ============

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

const weatherTool: Tool = {
  name: "weather",
  description: "Get current weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
  },
  execute: async ({ location }) => {
    try {
      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`
      );
      const data = await response.json();
      return `Weather in ${location}: ${data.current_condition[0].temp_C}°C, ${data.current_condition[0].weatherDesc[0].value}`;
    } catch {
      return "Weather service unavailable";
    }
  },
};

// ============ AGENTS ============

const assistantAgent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant. Use tools when needed. Be concise.",
  model: openrouter("openai/gpt-4o-mini"),
  tools: [searchTool, calculatorTool, weatherTool],
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/memory.db" }),
    embedding: "openai/text-embedding-3-small",
    vector: new LibSQLVectorAdapter({ url: "file:./.voltagent/vector.db" }),
  }),
});

const codeAgent = new Agent({
  name: "Code Expert",
  instructions: "You are an expert programmer. Help with code, debugging, and best practices. Provide clean, well-documented code. Use TypeScript.",
  model: openrouter("anthropic/claude-3.5-sonnet"),
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/code-memory.db" }),
  }),
});

const researcherAgent = new Agent({
  name: "Researcher",
  instructions: "You are a research assistant. Use web search to find current information. Provide cited sources.",
  model: openrouter("openai/gpt-4o-mini"),
  tools: [searchTool],
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/research-memory.db" }),
  }),
});

const writerAgent = new Agent({
  name: "Writer",
  instructions: "You are a creative writer. Help with blog posts, articles, and content creation. Write in an engaging style.",
  model: openrouter("openai/gpt-4o-mini"),
  memory: new Memory({
    storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/writer-memory.db" }),
  }),
});

// ============ WORKFLOW ============

const researchWorkflow = new Workflow({
  name: "research-assistant",
  description: "Research a topic and generate a report",
  steps: [
    workflowStep({
      name: "search",
      agent: researcherAgent,
      input: ({ input }) => `Research this topic thoroughly: ${input}`,
    }),
    workflowStep({
      name: "write",
      agent: writerAgent,
      input: ({ search }) => `Write a brief report based on this research: ${search.text}`,
    }),
  ],
});

// ============ MCP SERVER ============

const mcpServer = createMcpServer({
  agents: {
    assistant: assistantAgent,
    code: codeAgent,
    researcher: researcherAgent,
    writer: writerAgent,
  },
  tools: {
    search: searchTool,
    calculator: calculatorTool,
    weather: weatherTool,
  },
  workflows: {
    research: researchWorkflow,
  },
});

// ============ VOLTAGENT SERVER ============

new VoltAgent({
  agents: {
    assistant: assistantAgent,
    code: codeAgent,
    researcher: researcherAgent,
    writer: writerAgent,
  },
  workflows: {
    research: researchWorkflow,
  },
  mcpServer,
  logger,
  server: honoServer({
    port: 4301,
    configureApp: (app) => {
      // Health check
      app.get("/api/health", async (c) => {
        return c.json({
          success: true,
          data: {
            status: "healthy",
            timestamp: new Date().toISOString(),
            agents: ["assistant", "code", "researcher", "writer"],
            workflows: ["research-assistant"],
          },
        });
      });

      // List agents
      app.get("/api/agents", async (c) => {
        return c.json({
          success: true,
          data: {
            agents: [
              { name: "assistant", description: "General assistant with tools" },
              { name: "code", description: "Code expert and programming help" },
              { name: "researcher", description: "Research with web search" },
              { name: "writer", description: "Creative writing assistant" },
            ],
          },
        });
      });

      // List workflows
      app.get("/api/workflows", async (c) => {
        return c.json({
          success: true,
          data: {
            workflows: [
              { name: "research-assistant", description: "Research topic and write report" },
            ],
          },
        });
      });

      // Chat endpoint
      app.post("/api/chat", async (c) => {
        const body = await c.req.json();
        const { agent: agentName = "assistant", message, workflow } = body;

        if (workflow) {
          const result = await researchWorkflow.execute(message);
          return c.json({
            success: true,
            data: {
              text: result.steps.write.text,
              workflow: "research-assistant",
            },
          });
        }

        const agents = {
          assistant: assistantAgent,
          code: codeAgent,
          researcher: researcherAgent,
          writer: writerAgent,
        };
        const targetAgent = agents[agentName as keyof typeof agents];

        if (!targetAgent) {
          return c.json({ success: false, error: "Agent not found" }, 404);
        }

        try {
          const result = await targetAgent.generateText(message);
          return c.json({
            success: true,
            data: {
              text: result.text,
              usage: result.usage,
            },
          });
        } catch (error) {
          return c.json({
            success: false,
            error: (error as Error).message,
          }, 500);
        }
      });

      // Execute workflow endpoint
      app.post("/api/workflow/:name/execute", async (c) => {
        const workflowName = c.req.param("name");
        const body = await c.req.json();
        const { input } = body;

        if (workflowName === "research-assistant") {
          const result = await researchWorkflow.execute(input);
          return c.json({
            success: true,
            data: {
              search: result.steps.search.text,
              report: result.steps.write.text,
            },
          });
        }

        return c.json({ success: false, error: "Workflow not found" }, 404);
      });
    },
  }),
});

logger.info("VoltAgent started with 4 agents, 1 workflow, and MCP server");
