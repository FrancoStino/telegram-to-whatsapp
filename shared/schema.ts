import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bridgeConfigs = pgTable("bridge_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramBotToken: text("telegram_bot_token").notNull(),
  whatsappTargetGroup: text("whatsapp_target_group"),
  messageFormat: text("message_format").notNull().default("simple"),
  autoForwardEnabled: boolean("auto_forward_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceStatus = pgTable("service_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(), // 'telegram' | 'whatsapp'
  status: text("status").notNull(), // 'connected' | 'disconnected' | 'authenticating'
  lastActivity: timestamp("last_activity"),
  messagesCount: integer("messages_count").notNull().default(0),
  metadata: jsonb("metadata"), // Store additional service-specific data
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'message_forwarded' | 'connection_established' | 'error' | 'warning'
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"), // Message content if applicable
  fromService: text("from_service"), // 'telegram' | 'whatsapp'
  toService: text("to_service"), // 'telegram' | 'whatsapp'
  timestamp: timestamp("timestamp").defaultNow(),
});

export const messageQueue = pgTable("message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromService: text("from_service").notNull(),
  toService: text("to_service").notNull(),
  messageContent: text("message_content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'sent' | 'failed'
  retryCount: integer("retry_count").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertBridgeConfigSchema = createInsertSchema(bridgeConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceStatusSchema = createInsertSchema(serviceStatus).omit({
  id: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export const insertMessageQueueSchema = createInsertSchema(messageQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertBridgeConfig = z.infer<typeof insertBridgeConfigSchema>;
export type BridgeConfig = typeof bridgeConfigs.$inferSelect;

export type InsertServiceStatus = z.infer<typeof insertServiceStatusSchema>;
export type ServiceStatus = typeof serviceStatus.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertMessageQueue = z.infer<typeof insertMessageQueueSchema>;
export type MessageQueue = typeof messageQueue.$inferSelect;
