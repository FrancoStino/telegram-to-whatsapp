import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bridgeService } from "./services/bridge";
import { whatsappService } from "./services/whatsapp";
import { insertBridgeConfigSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get bridge configuration
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getBridgeConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to get configuration" });
    }
  });

  // Update bridge configuration
  app.post("/api/config", async (req, res) => {
    try {
      const validatedData = insertBridgeConfigSchema.parse(req.body);
      
      const existingConfig = await storage.getBridgeConfig();
      let config;
      
      if (existingConfig) {
        config = await storage.updateBridgeConfig(existingConfig.id, validatedData);
      } else {
        config = await storage.createBridgeConfig(validatedData);
      }
      
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to save configuration" });
      }
    }
  });

  // Get service status
  app.get("/api/status", async (req, res) => {
    try {
      const statuses = await storage.getAllServiceStatus();
      const bridgeStatus = bridgeService.getStatus();
      
      res.json({
        services: statuses,
        bridge: bridgeStatus,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get status" });
    }
  });

  // Get activity logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get activity logs" });
    }
  });

  // Clear activity logs
  app.delete("/api/logs", async (req, res) => {
    try {
      await storage.clearActivityLogs();
      res.json({ message: "Activity logs cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear logs" });
    }
  });

  // Start bridge service
  app.post("/api/bridge/start", async (req, res) => {
    try {
      await bridgeService.start();
      res.json({ message: "Bridge service started" });
    } catch (error) {
      res.status(500).json({ message: `Failed to start bridge: ${(error as Error).message}` });
    }
  });

  // Stop bridge service
  app.post("/api/bridge/stop", async (req, res) => {
    try {
      await bridgeService.stop();
      res.json({ message: "Bridge service stopped" });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop bridge" });
    }
  });

  // Restart bridge service
  app.post("/api/bridge/restart", async (req, res) => {
    try {
      await bridgeService.restart();
      res.json({ message: "Bridge service restarted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to restart bridge" });
    }
  });

  // Get WhatsApp QR code
  app.get("/api/whatsapp/qr", async (req, res) => {
    try {
      const qrCode = whatsappService.getQRCode();
      res.json({ qrCode });
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code" });
    }
  });

  // Get available WhatsApp groups
  app.get("/api/whatsapp/groups", async (req, res) => {
    try {
      console.log("=== SIMPLE DEBUG: Calling getAvailableGroups ===");
      const groups = await whatsappService.getAvailableGroups();
      console.log("✅ Got groups successfully:", groups.length);
      res.json(groups);
    } catch (error) {
      console.error("❌ Route error:", error);
      res.status(500).json({ message: "Failed to get WhatsApp groups" });
    }
  });

  // Get message queue stats
  app.get("/api/queue", async (req, res) => {
    try {
      const pending = await storage.getQueuedMessages("pending");
      const failed = await storage.getQueuedMessages("failed");
      const processing = await storage.getQueuedMessages("processing");
      
      res.json({
        pending: pending.length,
        failed: failed.length,
        processing: processing.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get queue stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
