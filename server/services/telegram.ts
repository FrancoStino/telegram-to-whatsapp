import TelegramBot from "node-telegram-bot-api";
import { storage } from "../storage";

export class TelegramService {
  private bot: TelegramBot | null = null;
  private isConnected = false;

  async initialize(token: string): Promise<void> {
    try {
      if (this.bot) {
        await this.disconnect();
      }

      this.bot = new TelegramBot(token, { polling: true });
      
      this.bot.on("message", async (msg) => {
        await this.handleMessage(msg);
      });

      this.bot.on("polling_error", async (error) => {
        console.error("Telegram polling error:", error);
        await this.updateStatus("disconnected", { error: error.message });
      });

      // Test connection
      await this.bot.getMe();
      this.isConnected = true;
      
      await this.updateStatus("connected");
      await this.logActivity("connection_established", "Telegram bot connected", "Bot authentication successful");

    } catch (error) {
      console.error("Failed to initialize Telegram bot:", error);
      await this.updateStatus("disconnected", { error: (error as Error).message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
      this.isConnected = false;
      await this.updateStatus("disconnected");
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    try {
      if (!msg.text) return;

      // Create message in queue for WhatsApp forwarding
      await storage.createQueuedMessage({
        fromService: "telegram",
        toService: "whatsapp",
        messageContent: msg.text,
        messageType: "text",
        status: "pending",
        retryCount: 0,
        metadata: {
          telegramMessageId: msg.message_id,
          telegramChatId: msg.chat.id,
          senderUsername: msg.from?.username,
          senderFirstName: msg.from?.first_name,
        },
      });

      await this.updateStatus("connected", { 
        lastMessageTime: new Date(),
        messagesCount: await this.incrementMessageCount()
      });

    } catch (error) {
      console.error("Error handling Telegram message:", error);
      await this.logActivity("error", "Message handling failed", (error as Error).message);
    }
  }

  private async updateStatus(status: string, metadata?: any): Promise<void> {
    await storage.upsertServiceStatus({
      serviceName: "telegram",
      status,
      lastActivity: new Date(),
      messagesCount: await this.getMessageCount(),
      metadata,
    });
  }

  private async logActivity(type: string, title: string, description?: string, content?: string): Promise<void> {
    await storage.createActivityLog({
      type,
      title,
      description,
      content,
      fromService: "telegram",
      toService: null,
    });
  }

  private async getMessageCount(): Promise<number> {
    const status = await storage.getServiceStatus("telegram");
    return status?.messagesCount || 0;
  }

  private async incrementMessageCount(): Promise<number> {
    const current = await this.getMessageCount();
    return current + 1;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.bot || !this.isConnected) {
      throw new Error("Telegram bot is not connected");
    }
    await this.bot.sendMessage(chatId, text);
  }
}

export const telegramService = new TelegramService();
