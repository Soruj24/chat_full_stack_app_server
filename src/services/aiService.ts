import { ChatOllama } from "@langchain/ollama";
import { DynamicTool } from "@langchain/core/tools";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import User from "../models/schemas/User";
import { SupportTicket } from "../models/SupportTicket";
import { UserDocument } from "../models/UserDocument";

/**
 * AI Service using LangChain and Ollama
 */
export class AiService {
  private model: ChatOllama;
  private chatHistory: Map<string, BaseMessage[]>;

  constructor() {
    this.model = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: "llama3.2",
      temperature: 0.7,
    });

    this.chatHistory = new Map<string, BaseMessage[]>();
  }

  /**
   * Get tools for the AI agent
   * Note: We are bridging MCP concepts into LangChain DynamicTools
   */
  private getTools(userId: string) {
    return [
      new DynamicTool({
        name: "get_my_profile",
        description: "Get the current logged-in user's profile information",
        func: async () => {
          const user = await User.findById(userId).select("-password");
          return JSON.stringify(user || { error: "User not found" });
        },
      }),
      new DynamicTool({
        name: "get_my_tickets",
        description: "Get all support tickets for the current logged-in user",
        func: async () => {
          const tickets = await SupportTicket.find({ userId });
          return JSON.stringify(tickets);
        },
      }),
      new DynamicTool({
        name: "get_system_info",
        description: "Get general information about the User Management System",
        func: async () => {
          return "This is a MERN-stack User Management System with features like social login (Google, GitHub, Facebook), 2FA, support tickets, and AI assistance.";
        },
      }),
      new DynamicTool({
        name: "get_user_documents",
        description: "Search or list documents uploaded by the user",
        func: async () => {
          const docs = await UserDocument.find({ userId }).select("fileName fileSize createdAt");
          return JSON.stringify(docs);
        },
      }),
      new DynamicTool({
        name: "read_document_content",
        description: "Read the full text content of a specific document by its name or ID",
        func: async (input: string) => {
          const doc = await UserDocument.findOne({ 
            userId, 
            $or: [{ fileName: new RegExp(input, "i") }, { _id: input.match(/^[0-9a-fA-F]{24}$/) ? input : null }] 
          });
          return doc ? doc.textContent : "Document not found.";
        },
      }),
    ];
  }

  /**
   * Handle chat with the AI assistant
   */
  async chat(userId: string, message: string) {
    try {
      const tools = this.getTools(userId);

      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          "You are a helpful AI assistant for a User Management System. You can help users manage their accounts, understand system features, and check their support tickets. Use the provided tools to get specific information about the user if needed.",
        ],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
      ]);

      // Get user's chat history or initialize it
      if (!this.chatHistory.has(userId)) {
        this.chatHistory.set(userId, []);
      }
      const userHistory = this.chatHistory.get(userId)!;

      // 1. Check if the message needs a tool (Simulated Tool Calling for Ollama)
      let context = "";
      console.log(`🤖 AI Chat: Processing message from user ${userId}: "${message}"`);
      
      if (
        message.toLowerCase().includes("profile") ||
        message.toLowerCase().includes("who am i")
      ) {
        console.log("🛠️ Tool: get_my_profile");
        context = await tools[0].call({});
      } else if (message.toLowerCase().includes("ticket")) {
        console.log("🛠️ Tool: get_my_tickets");
        context = await tools[1].call({});
      } else if (
        message.toLowerCase().includes("document") || 
        message.toLowerCase().includes("file") || 
        message.toLowerCase().includes("pdf")
      ) {
        console.log("🛠️ Tool: get_user_documents");
        // If they ask for documents, list them first
        context = await tools[3].call({});
        
        // If they seem to ask about a specific document content
        if (message.toLowerCase().includes("read") || message.toLowerCase().includes("content") || message.toLowerCase().includes("what is in")) {
           console.log("🛠️ Tool: read_document_content");
           // Basic heuristic to extract filename from message
           const words = message.split(" ");
           const fileName = words[words.length - 1]; // Assume last word might be filename for now
           const docContent = await tools[4].call(fileName);
           context += `\n\nContent of document: ${docContent}`;
        }
      }

      // 2. Format the prompt with history and input
      const formattedPrompt = await prompt.formatMessages({
        chat_history: userHistory,
        input: message,
      });

      // 3. Add context if available
      if (context) {
        console.log("📝 Context added to prompt");
        formattedPrompt.unshift(
          new HumanMessage({
            content: `System Context Information: ${context}`,
          })
        );
      }

      // 4. Invoke the model
      console.log("🧠 Calling Ollama...");
      const response = await this.model.invoke(formattedPrompt);
      console.log("✅ AI Response received");

      // 5. Update history
      userHistory.push(new HumanMessage(message));
      userHistory.push(new AIMessage(response.content as string));

      // Keep history manageable (last 10 messages)
      if (userHistory.length > 10) {
        userHistory.splice(0, userHistory.length - 10);
      }

      return response.content;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      return "I'm sorry, I'm having trouble connecting to my brain right now. Please make sure Ollama is running with llama3.2.";
    }
  }
}

export const aiService = new AiService();
