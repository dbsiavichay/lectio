import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date());

// ─── Accounts ────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Lowercase login name. */
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  /** Avatar color token. */
  color: text("color").notNull().default("teal"),
  /** IANA zone used to decide what "today" is for reviews. */
  timezone: text("timezone").notNull().default("America/Guayaquil"),
  /** The book the tabs point at (slug); the last one opened. */
  currentBook: text("current_book"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passkeys = sqliteTable(
  "passkeys",
  {
    /** WebAuthn credential ID, base64url. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: blob("public_key", { mode: "buffer" }).notNull(),
    counter: integer("counter").notNull().default(0),
    /** JSON array of AuthenticatorTransport. */
    transports: text("transports").notNull().default("[]"),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    /** What the user called it ("iPhone", "MacBook"). */
    name: text("name").notNull(),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("passkeys_user_idx").on(t.userId)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    /** SHA-256 of the cookie token: a leaked database can't be replayed as cookies. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    /** Last password or passkey check, for actions that need a recent one. */
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/** Pending WebAuthn ceremonies; the browser holds the id in a short-lived cookie. */
export const authChallenges = sqliteTable("auth_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  kind: text("kind", { enum: ["register", "login", "reauth"] }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── Content ─────────────────────────────────────────────────────────────────

export const books = sqliteTable("books", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  /** Increments on every import; caches key on it. */
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash").notNull(),
  /** The parsed, validated book (see src/content/schema.ts). */
  content: text("content", { mode: "json" }).notNull(),
  importedAt: integer("imported_at", { mode: "timestamp_ms" }).notNull(),
  importedBy: text("imported_by").references(() => users.id, { onDelete: "set null" }),
});

// ─── Study data (everything a user writes, keyed by stable content keys) ─────

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug")
      .notNull()
      .references(() => books.slug, { onDelete: "cascade" }),
    /** YYYY-MM-DD in the user's zone. */
    startedOn: text("started_on").notNull(),
    /** JSON array of weekday codes: ["mon","wed","fri"]. */
    studyDays: text("study_days").notNull(),
    restDays: text("rest_days").notNull(),
    status: text("status", { enum: ["active", "paused", "finished"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("enrollments_user_book_idx").on(t.userId, t.bookSlug)],
);

/** Free-text answers, checks and ratings, one row per field of the notebook. */
export const fieldValues = sqliteTable(
  "field_values",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookSlug, t.key] })],
);

/** Sessions, the Session 0 and chapter evaluations ("s1.1", "s0", "ef1"). */
export const unitProgress = sqliteTable(
  "unit_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    unitId: text("unit_id").notNull(),
    status: text("status", {
      enum: ["in_progress", "completed", "needs_review"],
    }).notNull(),
    currentStep: integer("current_step").notNull().default(1),
    rating: integer("rating"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /** YYYY-MM-DD in the user's zone, the date reviews count from. */
    completedOn: text("completed_on"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookSlug, t.unitId] })],
);

/** The answer guide opened for a question, and how the user graded themselves. */
export const answerChecks = sqliteTable(
  "answer_checks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    code: text("code").notNull(),
    revealedAt: integer("revealed_at", { mode: "timestamp_ms" }).notNull(),
    grade: text("grade", { enum: ["correct", "partial", "missed"] }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookSlug, t.code] })],
);

export const commitments = sqliteTable(
  "commitments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    unitId: text("unit_id").notNull(),
    teaching: text("teaching").notNull().default(""),
    behavior: text("behavior").notNull().default(""),
    action: text("action").notNull().default(""),
    situation: text("situation").notNull().default(""),
    /** YYYY-MM-DD. */
    dueOn: text("due_on"),
    measure: text("measure").notNull().default(""),
    learned: text("learned").notNull().default(""),
    status: text("status", { enum: ["pending", "done", "partial", "not_done"] })
      .notNull()
      .default("pending"),
    observed: text("observed").notNull().default(""),
    keepAsHabit: integer("keep_as_habit", { mode: "boolean" }).notNull().default(false),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("commitments_unit_idx").on(t.userId, t.bookSlug, t.unitId)],
);

export const reviewTasks = sqliteTable(
  "review_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    kind: text("kind", { enum: ["d1", "d3", "d7", "d14", "block", "final"] }).notNull(),
    /** Chapter number for d1–d14, part number for block, 0 for final. */
    ref: integer("ref").notNull(),
    /** YYYY-MM-DD in the user's zone. */
    dueOn: text("due_on").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("review_tasks_unique_idx").on(t.userId, t.bookSlug, t.kind, t.ref),
    index("review_tasks_due_idx").on(t.userId, t.dueOn),
  ],
);

/** Page where a section starts in the user's own printed copy. */
export const sectionPages = sqliteTable(
  "section_pages",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookSlug: text("book_slug").notNull(),
    sectionId: text("section_id").notNull(),
    page: integer("page").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookSlug, t.sectionId] })],
);
