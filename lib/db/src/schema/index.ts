import { pgTable, serial, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password_hash: text("password_hash").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const icdCodesTable = pgTable("icd_codes", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
});

export const recordsTable = pgTable("records", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id),
  input_text: text("input_text").notNull(),
  selected_icd: text("selected_icd").notNull(),
  icd_description: text("icd_description").notNull(),
  confidence_score: real("confidence_score").notNull(),
  fhir_json: jsonb("fhir_json").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, created_at: true });
export const insertRecordSchema = createInsertSchema(recordsTable).omit({ id: true, created_at: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Record = typeof recordsTable.$inferSelect;
export type InsertRecord = z.infer<typeof insertRecordSchema>;
