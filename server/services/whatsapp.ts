import pkg from "whatsapp-web.js";
import { storage } from "../storage";
const { Client, LocalAuth } = pkg;

export class WhatsAppService {
  private client: any = null;
  private isConnected = false;
  private qrCode: string | null = null;
  private targetGroup: string | null = null;

  async initialize(): Promise<void> {
    try {
      // Different configurations for different environments
      const isProd = process.env.NODE_ENV === "production";
      const isReplit = process.env.REPL_ID !== undefined;
      const isRender = process.env.RENDER !== undefined;

      let puppeteerConfig: any = {
        headless: "new", // Use new headless mode
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--single-process",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-extensions",
          "--disable-default-apps",
          "--disable-blink-features=AutomationControlled",
          "--no-default-browser-check",
          "--disable-plugins",
          "--disable-sync",
          "--disable-translate",
          "--disable-background-networking",
          "--disable-background-downloads",
          "--disable-component-extensions-with-background-pages",
          "--disable-ipc-flooding-protection",
          "--memory-pressure-off",
        ],
      };

      // Only set executablePath on Replit
      if (isReplit) {
        puppeteerConfig.executablePath =
          "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";
      }

      // On Render, try to disable WhatsApp altogether or use a mock
      if (isRender && !process.env.FORCE_WHATSAPP) {
        console.log(
          "🚫 WhatsApp disabled on Render - use FORCE_WHATSAPP=true to enable",
        );
        await this.updateStatus("disabled", {
          reason: "WhatsApp disabled on Render platform",
        });
        return;
      }

      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: puppeteerConfig,
      });

      this.client.on("qr", async (qr: string) => {
        this.qrCode = qr;
        await this.updateStatus("authenticating", { qrCode: qr });
        await this.logActivity(
          "info",
          "QR code generated",
          "Scan QR code with WhatsApp to authenticate",
        );
      });

      this.client.on("ready", async () => {
        this.isConnected = true;
        this.qrCode = null;
        await this.updateStatus("connected");
        await this.logActivity(
          "connection_established",
          "WhatsApp Web connected",
          "QR code scanned successfully",
        );
      });

      this.client.on("auth_failure", async (msg: any) => {
        await this.updateStatus("disconnected", { error: msg });
        await this.logActivity("error", "WhatsApp authentication failed", msg);
      });

      this.client.on("disconnected", async (reason: any) => {
        this.isConnected = false;
        await this.updateStatus("disconnected", { reason });
        await this.logActivity("warning", "WhatsApp disconnected", reason);
      });

      this.client.on("message", async (msg: any) => {
        // Handle incoming WhatsApp messages if needed for two-way sync
      });

      await this.client.initialize();
    } catch (error) {
      console.error("Failed to initialize WhatsApp client:", error);
      await this.updateStatus("disconnected", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isConnected = false;
      this.qrCode = null;
      await this.updateStatus("disconnected");
    }
  }

  async sendMessage(message: string, metadata?: any): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("WhatsApp client is not connected");
    }

    if (!this.targetGroup) {
      throw new Error("No target group configured");
    }

    try {
      // Find the target group or channel
      const chats = await this.client.getChats();
      const cleanTargetName = this.targetGroup?.replace(/^(📢 |👥 )/, "") || "";
      const targetChat = chats.find((chat: any) => {
        return chat.isChannel && chat.name === cleanTargetName;
      });

      if (!targetChat) {
        throw new Error(`Target group/channel "${this.targetGroup}" not found`);
      }

      // Format message based on configuration
      const config = await storage.getBridgeConfig();
      let formattedMessage = message;

      if (config?.messageFormat === "formatted" && metadata?.senderUsername) {
        formattedMessage = `📱 From Telegram (@${metadata.senderUsername}):\n\n${message}`;
      }

      await this.client.sendMessage(
        targetChat.id._serialized,
        formattedMessage,
      );

      await this.updateStatus("connected", {
        lastForwardTime: new Date(),
        forwardsCount: await this.incrementForwardCount(),
      });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      throw error;
    }
  }

  async setTargetGroup(groupName: string): Promise<void> {
    this.targetGroup = groupName;
  }

  private async updateStatus(status: string, metadata?: any): Promise<void> {
    await storage.upsertServiceStatus({
      serviceName: "whatsapp",
      status,
      lastActivity: new Date(),
      messagesCount: await this.getForwardCount(),
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
      fromService: null,
      toService: "whatsapp",
    });
  }

  private async getForwardCount(): Promise<number> {
    const status = await storage.getServiceStatus("whatsapp");
    return status?.messagesCount || 0;
  }

  private async incrementForwardCount(): Promise<number> {
    const current = await this.getForwardCount();
    return current + 1;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getQRCode(): string | null {
    return this.qrCode;
  }

  async getAvailableGroups(): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      console.log("🔍 Looking for channels...");

      // Try different methods to get channels since they extend Base, not Chat
      let channels: any[] = [];

      // Method 1: Check if there's a dedicated getChannels method
      if (typeof (this.client as any).getChannels === "function") {
        console.log("📞 Calling client.getChannels()...");
        channels = await (this.client as any).getChannels();
        console.log(`✅ Found ${channels.length} channels via getChannels()`);
      } else {
        console.log("❌ getChannels() method not available");
      }

      // Method 2: Check client.pupPage for direct WhatsApp Web access
      if (channels.length === 0 && (this.client as any).pupPage) {
        console.log("🔍 Trying to find channels via pupPage...");
        try {
          // Try to evaluate JavaScript in the browser to find channels
          const result = await (this.client as any).pupPage.evaluate(() => {
            // This is browser context - look for WhatsApp Web channel objects
            const Store = window.Store || window.require("WAWebMain");
            if (Store && Store.Channel) {
              const channels = Store.Channel.getModelsArray
                ? Store.Channel.getModelsArray()
                : [];
              return channels.map((ch: any) => ({
                name: ch.name || ch.formattedTitle,
                id: ch.id,
              }));
            }
            return [];
          });
          channels = result || [];
          console.log(`✅ Found ${channels.length} channels via pupPage`);
        } catch (puppeteerError) {
          console.log(
            "❌ pupPage channel search failed:",
            puppeteerError.message,
          );
        }
      }

      // Method 3: Fallback - check all chats for any that might be channels
      if (channels.length === 0) {
        console.log("🔍 Fallback: checking chats for channels...");
        const chats = await this.client.getChats();
        channels = chats.filter((chat: any) => chat.isChannel === true);
        console.log(`✅ Found ${channels.length} channels in chats`);
      }

      const result = channels
        .map(
          (channel: any) =>
            `📢 ${channel.name || channel.formattedTitle || "Unnamed Channel"}`,
        )
        .sort();

      console.log(`🎯 Final result: ${result.length} channels`);
      return result;
    } catch (error) {
      console.error("💥 Error getting WhatsApp channels:", error);
      return [];
    }
  }
}

export const whatsappService = new WhatsAppService();
