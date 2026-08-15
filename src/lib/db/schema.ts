import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { GenerationBrief, Step, TestCaseStatus } from "@/lib/types";

export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  generationBrief: jsonb("generation_brief").$type<GenerationBrief>(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const specifications = pgTable("specifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull().default("paste"),
  rawText: text("raw_text").notNull(),
  storagePath: text("storage_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exemplarSets = pgTable("exemplar_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sourceType: text("source_type").notNull().default("manual_form"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exemplars = pgTable("exemplars", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  exemplarSetId: uuid("exemplar_set_id")
    .notNull()
    .references(() => exemplarSets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  preconditions: text("preconditions").notNull().default(""),
  steps: jsonb("steps").$type<Step[]>().notNull(),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectExemplarSets = pgTable(
  "project_exemplar_sets",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    exemplarSetId: uuid("exemplar_set_id")
      .notNull()
      .references(() => exemplarSets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.exemplarSetId] })],
);

export const generations = pgTable("generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  specificationId: uuid("specification_id").references(() => specifications.id),
  kind: text("kind").notNull(),
  promptTemplateId: text("prompt_template_id").notNull(),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  specificationId: uuid("specification_id").references(() => specifications.id),
  title: text("title").notNull(),
  preconditions: text("preconditions").notNull().default(""),
  steps: jsonb("steps").$type<Step[]>().notNull(),
  status: text("status").$type<TestCaseStatus>().notNull().default("generated"),
  generationId: uuid("generation_id").references(() => generations.id),
  version: integer("version").notNull().default(1),
  requirementId: text("requirement_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testCaseComments = pgTable("test_case_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id")
    .notNull()
    .references(() => testCases.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorId: uuid("author_id").references(() => users.id),
  consumedInGenerationId: uuid("consumed_in_generation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testCaseRevisions = pgTable("test_case_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id")
    .notNull()
    .references(() => testCases.id, { onDelete: "cascade" }),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  source: text("source").notNull(),
  generationId: uuid("generation_id"),
  editedBy: uuid("edited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
