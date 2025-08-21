import { 
  type BridgeConfig, 
  type InsertBridgeConfig,
  type ServiceStatus,
  type InsertServiceStatus,
  type ActivityLog,
  type InsertActivityLog,
  type MessageQueue,
  type InsertMessageQueue
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Bridge Configuration
  getBridgeConfig(): Promise<BridgeConfig | undefined>;
  createBridgeConfig(config: InsertBridgeConfig): Promise<BridgeConfig>;
  updateBridgeConfig(id: string, config: Partial<InsertBridgeConfig>): Promise<BridgeConfig | undefined>;

  // Service Status
  getServiceStatus(serviceName: string): Promise<ServiceStatus | undefined>;
  getAllServiceStatus(): Promise<ServiceStatus[]>;
  upsertServiceStatus(status: InsertServiceStatus): Promise<ServiceStatus>;

  // Activity Logs
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  clearActivityLogs(): Promise<void>;

  // Message Queue
  getQueuedMessages(status?: string): Promise<MessageQueue[]>;
  createQueuedMessage(message: InsertMessageQueue): Promise<MessageQueue>;
  updateQueuedMessage(id: string, update: Partial<MessageQueue>): Promise<MessageQueue | undefined>;
  deleteQueuedMessage(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private bridgeConfigs: Map<string, BridgeConfig>;
  private serviceStatuses: Map<string, ServiceStatus>;
  private activityLogs: ActivityLog[];
  private messageQueue: Map<string, MessageQueue>;

  constructor() {
    this.bridgeConfigs = new Map();
    this.serviceStatuses = new Map();
    this.activityLogs = [];
    this.messageQueue = new Map();
  }

  async getBridgeConfig(): Promise<BridgeConfig | undefined> {
    return Array.from(this.bridgeConfigs.values())[0];
  }

  async createBridgeConfig(insertConfig: InsertBridgeConfig): Promise<BridgeConfig> {
    const id = randomUUID();
    const config: BridgeConfig = {
      ...insertConfig,
      whatsappTargetGroup: insertConfig.whatsappTargetGroup || null,
      messageFormat: insertConfig.messageFormat || "simple",
      autoForwardEnabled: insertConfig.autoForwardEnabled ?? true,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bridgeConfigs.set(id, config);
    return config;
  }

  async updateBridgeConfig(id: string, update: Partial<InsertBridgeConfig>): Promise<BridgeConfig | undefined> {
    const config = this.bridgeConfigs.get(id);
    if (!config) return undefined;
    
    const updatedConfig: BridgeConfig = {
      ...config,
      ...update,
      updatedAt: new Date(),
    };
    this.bridgeConfigs.set(id, updatedConfig);
    return updatedConfig;
  }

  async getServiceStatus(serviceName: string): Promise<ServiceStatus | undefined> {
    return this.serviceStatuses.get(serviceName);
  }

  async getAllServiceStatus(): Promise<ServiceStatus[]> {
    return Array.from(this.serviceStatuses.values());
  }

  async upsertServiceStatus(insertStatus: InsertServiceStatus): Promise<ServiceStatus> {
    const existing = this.serviceStatuses.get(insertStatus.serviceName);
    
    if (existing) {
      const updatedStatus: ServiceStatus = {
        ...existing,
        ...insertStatus,
        metadata: insertStatus.metadata || null,
        lastActivity: insertStatus.lastActivity || null,
        messagesCount: insertStatus.messagesCount || 0,
        updatedAt: new Date(),
      };
      this.serviceStatuses.set(insertStatus.serviceName, updatedStatus);
      return updatedStatus;
    } else {
      const id = randomUUID();
      const status: ServiceStatus = {
        ...insertStatus,
        id,
        metadata: insertStatus.metadata || null,
        lastActivity: insertStatus.lastActivity || null,
        messagesCount: insertStatus.messagesCount || 0,
        updatedAt: new Date(),
      };
      this.serviceStatuses.set(insertStatus.serviceName, status);
      return status;
    }
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...insertLog,
      id,
      content: insertLog.content || null,
      description: insertLog.description || null,
      fromService: insertLog.fromService || null,
      toService: insertLog.toService || null,
      timestamp: new Date(),
    };
    this.activityLogs.push(log);
    return log;
  }

  async clearActivityLogs(): Promise<void> {
    this.activityLogs = [];
  }

  async getQueuedMessages(status?: string): Promise<MessageQueue[]> {
    const messages = Array.from(this.messageQueue.values());
    if (status) {
      return messages.filter(msg => msg.status === status);
    }
    return messages;
  }

  async createQueuedMessage(insertMessage: InsertMessageQueue): Promise<MessageQueue> {
    const id = randomUUID();
    const message: MessageQueue = {
      ...insertMessage,
      id,
      metadata: insertMessage.metadata || null,
      status: insertMessage.status || "pending",
      messageType: insertMessage.messageType || "text",
      retryCount: insertMessage.retryCount || 0,
      createdAt: new Date(),
      processedAt: null,
    };
    this.messageQueue.set(id, message);
    return message;
  }

  async updateQueuedMessage(id: string, update: Partial<MessageQueue>): Promise<MessageQueue | undefined> {
    const message = this.messageQueue.get(id);
    if (!message) return undefined;
    
    const updatedMessage: MessageQueue = {
      ...message,
      ...update,
    };
    this.messageQueue.set(id, updatedMessage);
    return updatedMessage;
  }

  async deleteQueuedMessage(id: string): Promise<boolean> {
    return this.messageQueue.delete(id);
  }
}

export const storage = new MemStorage();
