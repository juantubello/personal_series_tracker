import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./env.js";
import type { CurrentUser, MediaItem, Profile, ProfileSlug } from "./types.js";

const dbPath = path.resolve(process.cwd(), "../../", config.databasePath);
mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('person', 'shared')),
    owner_user_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    original_title TEXT,
    overview TEXT,
    poster_path TEXT,
    backdrop_path TEXT,
    release_date TEXT,
    first_air_date TEXT,
    vote_average REAL,
    tmdb_json TEXT,
    providers_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tmdb_id, media_type)
  );

  CREATE TABLE IF NOT EXISTS watch_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    media_item_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('watching', 'watched', 'paused', 'dropped', 'wishlist')),
    rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    notes TEXT,
    watched_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (profile_id, media_item_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS series_progress (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    media_item_id TEXT NOT NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER NOT NULL DEFAULT 0,
    episode_title TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (profile_id, media_item_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episode_watches (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    media_item_id TEXT NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    watched_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (profile_id, media_item_id, season_number, episode_number),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    profile_id TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('shared', 'personal')),
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS list_items (
    list_id TEXT NOT NULL,
    media_item_id TEXT NOT NULL,
    added_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (list_id, media_item_id),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tmdb_cache (
    cache_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

try {
  db.prepare("ALTER TABLE lists ADD COLUMN icon TEXT").run();
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
    throw error;
  }
}

try {
  db.prepare("ALTER TABLE watch_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0").run();
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
    throw error;
  }
}

for (const column of ["english_title", "english_overview"]) {
  try {
    db.prepare(`ALTER TABLE media_items ADD COLUMN ${column} TEXT`).run();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }
}

export const nowIso = () => new Date().toISOString();

const upsertUser = (id: string, email: string, displayName: string) => {
  db.prepare(`
    INSERT INTO users (id, email, display_name, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name
  `).run(id, email.toLowerCase(), displayName, nowIso());

  return getUserByEmail(email);
};

const upsertProfile = (id: string, slug: ProfileSlug, name: string, kind: Profile["kind"], ownerUserId: string | null) => {
  db.prepare(`
    INSERT INTO profiles (id, slug, name, kind, owner_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      kind = excluded.kind,
      owner_user_id = excluded.owner_user_id
  `).run(id, slug, name, kind, ownerUserId, nowIso());
};

export const seedBaseData = () => {
  const juan = upsertUser("user_juan", config.auth.juanEmail, "Juan");
  const cami = upsertUser("user_cami", config.auth.camiEmail, "Cami");

  upsertProfile("profile_juan", "juan", "Juan", "person", juan.id);
  upsertProfile("profile_cami", "cami", "Cami", "person", cami.id);
  upsertProfile("profile_juntos", "juntos", "Juntos", "shared", null);
};

export const getUserByEmail = (email: string): CurrentUser => {
  const row = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.display_name AS displayName,
      p.slug AS profileSlug
    FROM users u
    LEFT JOIN profiles p ON p.owner_user_id = u.id
    WHERE lower(u.email) = lower(?)
  `).get(email) as CurrentUser | undefined;

  if (!row) {
    throw new Error(`Email not allowed: ${email}`);
  }

  return row;
};

export const getProfiles = () => {
  return db.prepare(`
    SELECT id, slug, name, kind, owner_user_id AS ownerUserId
    FROM profiles
    ORDER BY CASE slug WHEN 'juntos' THEN 0 WHEN 'juan' THEN 1 WHEN 'cami' THEN 2 ELSE 3 END
  `).all() as Profile[];
};

export const getProfileBySlug = (slug: ProfileSlug) => {
  const row = db.prepare(`
    SELECT id, slug, name, kind, owner_user_id AS ownerUserId
    FROM profiles
    WHERE slug = ?
  `).get(slug) as Profile | undefined;

  if (!row) {
    throw new Error(`Profile not found: ${slug}`);
  }

  return row;
};

export const defaultProfileSlugsForUser = (user: CurrentUser): ProfileSlug[] => {
  if (user.profileSlug === "cami") return ["juntos", "cami"];
  return ["juntos", "juan"];
};

export const normalizeProfileSlugs = (input: string[] | undefined): ProfileSlug[] => {
  const allowed = new Set<ProfileSlug>(["juan", "cami", "juntos"]);
  const selected = (input ?? []).filter((value): value is ProfileSlug => allowed.has(value as ProfileSlug));
  const unique = new Set(selected);

  if (unique.has("juntos") || (unique.has("juan") && unique.has("cami"))) {
    return ["juntos"];
  }

  if (unique.size === 0) {
    return ["juntos"];
  }

  return [...unique];
};

export const mapMediaRow = (row: Record<string, unknown>): MediaItem => ({
  id: String(row.id),
  tmdbId: Number(row.tmdb_id),
  mediaType: row.media_type as MediaItem["mediaType"],
  title: String(row.title),
  originalTitle: row.original_title ? String(row.original_title) : null,
  englishTitle: row.english_title ? String(row.english_title) : null,
  englishOverview: row.english_overview ? String(row.english_overview) : null,
  overview: row.overview ? String(row.overview) : null,
  posterPath: row.poster_path ? String(row.poster_path) : null,
  backdropPath: row.backdrop_path ? String(row.backdrop_path) : null,
  releaseDate: row.release_date ? String(row.release_date) : null,
  firstAirDate: row.first_air_date ? String(row.first_air_date) : null,
  voteAverage: row.vote_average === null || row.vote_average === undefined ? null : Number(row.vote_average),
  tmdbJson: row.tmdb_json ? String(row.tmdb_json) : null,
  providersJson: row.providers_json ? String(row.providers_json) : null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
});
