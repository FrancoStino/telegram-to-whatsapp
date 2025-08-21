import TelegramBot from "node-telegram-bot-api";
import { storage } from "../storage";

export class TelegramService {
  private bot: TelegramBot | null = null;
  private isConnected = false;

  async initialize(token: string): Promise<void> {
    try {
      // Stop any existing bot first
      if (this.bot) {
        await this.disconnect();
      }

      // Use webhook in production to avoid polling conflicts
      const isProd = process.env.NODE_ENV === "production";
      const isRender = process.env.RENDER !== undefined;

      if (isProd || isRender) {
        // In production, use webhooks instead of polling to avoid conflicts
        this.bot = new TelegramBot(token, { polling: false });

        // Set webhook if URL is provided
        const webhookUrl = process.env.WEBHOOK_URL;
        if (webhookUrl) {
          await this.bot.setWebHook(`${webhookUrl}/webhook/telegram`);
          console.log(
            "✅ Telegram webhook set to:",
            `${webhookUrl}/webhook/telegram`,
          );
        } else {
          console.log(
            "⚠️ No WEBHOOK_URL provided, Telegram will work in receive-only mode",
          );
        }
      } else {
        // Development mode - use polling with conflict resolution
        this.bot = new TelegramBot(token, {
          polling: {
            interval: 2000, // Slower polling to reduce conflicts
            autoStart: true,
            params: {
              timeout: 10,
            },
          },
        });
      }

      this.bot.on("message", async (msg) => {
        await this.handleMessage(msg);
      });

      this.bot.on("polling_error", async (error) => {
        console.error("Telegram polling error:", error);

        // If it's a conflict error, try to resolve it
        if (error.message.includes("409 Conflict")) {
          console.log("🔄 Attempting to resolve Telegram conflict...");
          try {
            await this.bot?.deleteWebHook();
            // Wait a bit before retrying
            setTimeout(async () => {
              if (this.bot) {
                await this.bot.startPolling();
              }
            }, 5000);
          } catch (resolveError) {
            console.error("Failed to resolve Telegram conflict:", resolveError);
          }
        }

        await this.updateStatus("disconnected", { error: error.message });
      });

      this.bot.on("webhook_error", async (error) => {
        console.error("Telegram webhook error:", error);
        await this.updateStatus("disconnected", { error: error.message });
      });

      // Test connection
      const botInfo = await this.bot.getMe();
      this.isConnected = true;

      await this.updateStatus("connected", { botInfo: botInfo.username });
      await this.logActivity(
        "connection_established",
        "Telegram bot connected",
        `Bot @${botInfo.username} authenticated successfully`,
      );
    } catch (error) {
      console.error("Failed to initialize Telegram bot:", error);
      await this.updateStatus("disconnected", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stopPolling();
        await this.bot.deleteWebHook();
      } catch (error) {
        console.log("Error during Telegram disconnect:", error);
      }
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
        messagesCount: await this.incrementMessageCount(),
      });
    } catch (error) {
      console.error("Error handling Telegram message:", error);
      await this.logActivity(
        "error",
        "Message handling failed",
        (error as Error).message,
      );
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

  private async logActivity(
    type: string,
    title: string,
    description?: string,
    content?: string,
  ): Promise<void> {
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

  // Handle webhook messages (for production)
  async handleWebhookUpdate(update: any): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    }
  }
}

export const telegramService = new TelegramService();
