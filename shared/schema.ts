import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep the existing users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Define Bitcoin chart data schema
export const bitcoinCandleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

export const bitcoinVolumeSchema = z.object({
  time: z.number(),
  value: z.number(),
  color: z.string(),
});

export const bitcoinChartDataSchema = z.object({
  candles: z.array(bitcoinCandleSchema),
  volumes: z.array(bitcoinVolumeSchema),
});

export type BitcoinCandle = z.infer<typeof bitcoinCandleSchema>;
export type BitcoinVolume = z.infer<typeof bitcoinVolumeSchema>;
export type BitcoinChartData = z.infer<typeof bitcoinChartDataSchema>;
