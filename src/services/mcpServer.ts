import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import User from "../models/schemas/User";
import { SupportTicket } from "../models/SupportTicket";

/**
 * MCP Server to provide user and support context to the AI
 */
export const setupMcpServer = () => {
  const server = new Server(
    {
      name: "user-management-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_user_info",
          description: "Get detailed information about a user by their ID",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string", description: "The ID of the user" },
            },
            required: ["userId"],
          },
        },
        {
          name: "get_user_tickets",
          description: "Get all support tickets for a specific user",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string", description: "The ID of the user" },
            },
            required: ["userId"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "get_user_info") {
        const userId = args?.userId as string;
        const user = await User.findById(userId).select("-password");
        if (!user) return { content: [{ type: "text", text: "User not found" }] };
        return {
          content: [{ type: "text", text: JSON.stringify(user) }],
        };
      }

      if (name === "get_user_tickets") {
        const userId = args?.userId as string;
        const tickets = await SupportTicket.find({ userId });
        return {
          content: [{ type: "text", text: JSON.stringify(tickets) }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
};

// For actual production use, this would run in its own process.
// For this implementation, we will use it via a local transport or simulate tool calls.
