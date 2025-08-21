import { storage } from "../storage";
import { telegramService } from "./telegram";
import { whatsappService } from "./whatsapp";

export class BridgeService {
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      const config = await storage.getBridgeConfig();
      if (!config) {
        throw new Error("No bridge configuration found");
      }

      // Initialize services
      await telegramService.initialize(config.telegramBotToken);
      await whatsappService.initialize();
      
      if (config.whatsappTargetGroup) {
        await whatsappService.setTargetGroup(config.whatsappTargetGroup);
      }

      // Start message processing loop
      this.isRunning = true;
      this.processingInterval = setInterval(() => {
        this.processMessageQueue();
      }, 1000); // Process every second

      await storage.createActivityLog({
        type: "info",
        title: "Bridge service started",
        description: "Message bridge is now active and processing messages",
      });

    } catch (error) {
      console.error("Failed to start bridge service:", error);
      await storage.createActivityLog({
        type: "error",
        title: "Bridge startup failed",
        description: (error as Error).message,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    await telegramService.disconnect();
    await whatsappService.disconnect();

    await storage.createActivityLog({
      type: "info",
      title: "Bridge service stopped",
      description: "Message bridge has been deactivated",
    });
  }

  private async processMessageQueue(): Promise<void> {
    try {
      const pendingMessages = await storage.getQueuedMessages("pending");
      
      for (const message of pendingMessages) {
        if (message.fromService === "telegram" && message.toService === "whatsapp") {
          await this.forwardToWhatsApp(message);
        }
        // Add more forwarding directions as needed
      }
    } catch (error) {
      console.error("Error processing message queue:", error);
    }
  }

  private async forwardToWhatsApp(message: any): Promise<void> {
    try {
      await storage.updateQueuedMessage(message.id, { status: "processing" });

      if (!whatsappService.getConnectionStatus()) {
        throw new Error("WhatsApp is not connected");
      }

      await whatsappService.sendMessage(message.messageContent, message.metadata);

      await storage.updateQueuedMessage(message.id, { 
        status: "sent", 
        processedAt: new Date() 
      });

      await storage.createActivityLog({
        type: "message_forwarded",
        title: "Message forwarded successfully",
        description: "From: Telegram → WhatsApp",
        content: message.messageContent,
        fromService: "telegram",
        toService: "whatsapp",
      });

      // Clean up sent message after successful processing
      setTimeout(() => {
        storage.deleteQueuedMessage(message.id);
      }, 5000);

    } catch (error) {
      console.error("Error forwarding message to WhatsApp:", error);
      
      const retryCount = (message.retryCount || 0) + 1;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        await storage.updateQueuedMessage(message.id, { 
          status: "failed", 
          retryCount,
          processedAt: new Date() 
        });

        await storage.createActivityLog({
          type: "error",
          title: "Message forwarding failed",
          description: `Failed to forward message after ${maxRetries} attempts: ${(error as Error).message}`,
          content: message.messageContent,
          fromService: "telegram",
          toService: "whatsapp",
        });
      } else {
        await storage.updateQueuedMessage(message.id, { 
          status: "pending", 
          retryCount 
        });
      }
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  async restart(): Promise<void> {
    await this.stop();
    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.start();
  }
}

export const bridgeService = new BridgeService();
