import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { db, defaultProfileSlugsForUser, getProfileBySlug, getProfiles, mapMediaRow, normalizeProfileSlugs, nowIso, seedBaseData } from "./db.js";
import { config, hasTmdbCredentials } from "./env.js";
import { isDevAuthEnabled, resolveCurrentUser } from "./auth.js";
import { getMediaDetails, getMovieDetails, getRecommendationsForItem, getTvDetails, getTvSeason, searchMedia } from "./tmdb.js";
import type { CurrentUser, MediaItem, MediaType, ProfileSlug, TmdbSearchResult, WatchStatus } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}

type EntryRow = {
  entryId: string;
  profileId: string;
  profileSlug: ProfileSlug;
  profileName: string;
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pinned?: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  mediaId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string | null;
  englishTitle: string | null;
  englishOverview: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  tmdbJson: string | null;
  providersJson: string | null;
};

type ListItemRow = Omit<EntryRow, "entryId" | "profileId" | "profileSlug" | "profileName" | "status"> & {
  addedAt: string;
  addedByName: string | null;
  entryId: string | null;
  profileId: string | null;
  profileSlug: ProfileSlug | null;
  profileName: string | null;
  status: WatchStatus | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type SaveMediaBody = {
  tmdbId?: number;
  mediaType?: MediaType;
  profileSlugs?: string[];
  status?: WatchStatus;
  rating?: number | null;
  notes?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  listId?: string;
};

type SearchSavedEntry = {
  status: WatchStatus;
  profileSlug: ProfileSlug;
  profileName: string;
  rating: number | null;
};

type EntryBody = {
  profileSlugs?: string[];
  status?: WatchStatus;
  rating?: number | null;
  notes?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
};

type ListBody = {
  name?: string;
  icon?: string;
  profileSlug?: ProfileSlug;
  visibility?: "shared" | "personal";
};

type MoveListItemBody = {
  targetListId?: string;
};

type SeasonSummary = {
  season_number: number;
  episode_count: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string | null;
  vote_average?: number;
};

type SeasonPayload = {
  seasonNumber: number;
  episodeCount: number;
  watchedEpisodeCount?: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  year: string | null;
  voteAverage: number | null;
};

const app = Fastify({
  logger: {
    transport: !config.isProduction && process.env.PINO_PRETTY !== "false" ? { target: "pino-pretty" } : undefined
  }
});
const API_VERSION = "0.2.0-series-detail";

seedBaseData();

await app.register(cors, {
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  credentials: true
});

app.addHook("preHandler", async (request, reply) => {
  if (request.url.startsWith("/health")) return;
  if (request.url.startsWith("/dev-auth/users") && isDevAuthEnabled()) return;

  try {
    request.currentUser = await resolveCurrentUser(request);
  } catch (error) {
    request.log.warn(error);
    return reply.status(401).send({ error: "No se pudo identificar el usuario" });
  }
});

const parseProfilesParam = (profiles: unknown, fallback: ProfileSlug[]) => {
  if (typeof profiles !== "string" || !profiles.trim()) return fallback;
  return profiles.split(",").map((value) => value.trim()).filter(Boolean) as ProfileSlug[];
};

const isMediaType = (value: unknown): value is MediaType => value === "movie" || value === "tv";

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const providerPayload = (providersJson: string | null) => {
  if (!providersJson) return { providers: [], link: null };
  try {
    return JSON.parse(providersJson) as { providers: unknown[]; link: string | null };
  } catch {
    return { providers: [], link: null };
  }
};

const statusPriority: Record<WatchStatus, number> = {
  watching: 5,
  watched: 4,
  wishlist: 3,
  paused: 2,
  dropped: 1
};

const mediaToPayload = (row: Pick<EntryRow, "mediaId" | "tmdbId" | "mediaType" | "title" | "originalTitle" | "englishTitle" | "overview" | "englishOverview" | "posterPath" | "backdropPath" | "releaseDate" | "firstAirDate" | "voteAverage" | "providersJson">) => ({
  id: row.mediaId,
  tmdbId: row.tmdbId,
  mediaType: row.mediaType,
  title: row.title,
  originalTitle: row.originalTitle,
  englishTitle: row.englishTitle,
  overview: row.overview,
  englishOverview: row.englishOverview,
  posterPath: row.posterPath,
  backdropPath: row.backdropPath,
  releaseDate: row.releaseDate,
  firstAirDate: row.firstAirDate,
  voteAverage: row.voteAverage,
  providers: providerPayload(row.providersJson)
});

const entryToPayload = (row: EntryRow) => ({
  entryId: row.entryId,
  profile: {
    id: row.profileId,
    slug: row.profileSlug,
    name: row.profileName
  },
  status: row.status,
  rating: row.rating,
  notes: row.notes,
  watchedAt: row.watchedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  pinned: Boolean(row.pinned),
  progress: row.mediaType === "tv" ? {
    seasonNumber: row.seasonNumber ?? 0,
    episodeNumber: row.episodeNumber ?? 0,
    episodeTitle: row.episodeTitle
  } : null,
  media: mediaToPayload(row)
});

const selectEntries = (profileSlugs: ProfileSlug[], statuses?: WatchStatus[]) => {
  const statusFilter = statuses?.length ? `AND we.status IN (${statuses.map(() => "?").join(",")})` : "";
  return db.prepare(`
    SELECT
      we.id AS entryId,
      p.id AS profileId,
      p.slug AS profileSlug,
      p.name AS profileName,
      we.status,
      we.rating,
      we.notes,
      we.watched_at AS watchedAt,
      we.created_at AS createdAt,
      we.updated_at AS updatedAt,
      we.pinned AS pinned,
      sp.season_number AS seasonNumber,
      sp.episode_number AS episodeNumber,
      sp.episode_title AS episodeTitle,
      mi.id AS mediaId,
      mi.tmdb_id AS tmdbId,
      mi.media_type AS mediaType,
      mi.title,
      mi.original_title AS originalTitle,
      mi.english_title AS englishTitle,
      mi.english_overview AS englishOverview,
      mi.overview,
      mi.poster_path AS posterPath,
      mi.backdrop_path AS backdropPath,
      mi.release_date AS releaseDate,
      mi.first_air_date AS firstAirDate,
      mi.vote_average AS voteAverage,
      mi.tmdb_json AS tmdbJson,
      mi.providers_json AS providersJson
    FROM watch_entries we
    JOIN profiles p ON p.id = we.profile_id
    JOIN media_items mi ON mi.id = we.media_item_id
    LEFT JOIN series_progress sp ON sp.profile_id = p.id AND sp.media_item_id = mi.id
    WHERE p.slug IN (${profileSlugs.map(() => "?").join(",")})
    ${statusFilter}
    ORDER BY we.updated_at DESC
  `).all(...profileSlugs, ...(statuses ?? [])) as EntryRow[];
};

const selectEntryByMediaAndProfile = (mediaId: string, profileSlug: ProfileSlug) => {
  return db.prepare(`
    SELECT
      we.id AS entryId,
      p.id AS profileId,
      p.slug AS profileSlug,
      p.name AS profileName,
      we.status,
      we.rating,
      we.notes,
      we.watched_at AS watchedAt,
      we.created_at AS createdAt,
      we.updated_at AS updatedAt,
      we.pinned AS pinned,
      sp.season_number AS seasonNumber,
      sp.episode_number AS episodeNumber,
      sp.episode_title AS episodeTitle,
      mi.id AS mediaId,
      mi.tmdb_id AS tmdbId,
      mi.media_type AS mediaType,
      mi.title,
      mi.original_title AS originalTitle,
      mi.english_title AS englishTitle,
      mi.english_overview AS englishOverview,
      mi.overview,
      mi.poster_path AS posterPath,
      mi.backdrop_path AS backdropPath,
      mi.release_date AS releaseDate,
      mi.first_air_date AS firstAirDate,
      mi.vote_average AS voteAverage,
      mi.tmdb_json AS tmdbJson,
      mi.providers_json AS providersJson
    FROM watch_entries we
    JOIN profiles p ON p.id = we.profile_id
    JOIN media_items mi ON mi.id = we.media_item_id
    LEFT JOIN series_progress sp ON sp.profile_id = p.id AND sp.media_item_id = mi.id
    WHERE mi.id = ? AND p.slug = ?
    LIMIT 1
  `).get(mediaId, profileSlug) as EntryRow | undefined;
};

const selectMediaItemById = (mediaId: string) => {
  const row = db.prepare("SELECT * FROM media_items WHERE id = ?").get(mediaId) as Record<string, unknown> | undefined;
  return row ? mapMediaRow(row) : null;
};

const previewEntryRowForMedia = (media: MediaItem, profileSlug: ProfileSlug): EntryRow => {
  const profile = getProfileBySlug(profileSlug);

  return {
    entryId: `preview:${media.id}:${profile.slug}`,
    profileId: profile.id,
    profileSlug: profile.slug,
    profileName: profile.name,
    status: "wishlist",
    rating: null,
    notes: null,
    watchedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    seasonNumber: 0,
    episodeNumber: 0,
    episodeTitle: null,
    mediaId: media.id,
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    englishTitle: media.englishTitle,
    englishOverview: media.englishOverview,
    overview: media.overview,
    posterPath: media.posterPath,
    backdropPath: media.backdropPath,
    releaseDate: media.releaseDate,
    firstAirDate: media.firstAirDate,
    voteAverage: media.voteAverage,
    tmdbJson: media.tmdbJson,
    providersJson: media.providersJson
  };
};

const selectEntryOrPreviewByMediaAndProfile = (mediaId: string, profileSlug: ProfileSlug) => {
  const entry = selectEntryByMediaAndProfile(mediaId, profileSlug);
  if (entry) return entry;

  const media = selectMediaItemById(mediaId);
  return media ? previewEntryRowForMedia(media, profileSlug) : null;
};

const isEpisodeAfter = (candidate: { season_number: number; episode_number: number }, progress: { seasonNumber: number; episodeNumber: number }) => {
  if (candidate.season_number > progress.seasonNumber) return true;
  return candidate.season_number === progress.seasonNumber && candidate.episode_number > progress.episodeNumber;
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const isRecentAirDate = (airDate: string | undefined, windowDays = 14) => {
  if (!airDate) return false;
  const parsed = new Date(`${airDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  return parsed <= today && parsed >= daysAgo(windowDays);
};

const isEpisodeWatched = (candidate: { season_number: number; episode_number: number }, progress: { seasonNumber: number; episodeNumber: number }) => {
  if (candidate.season_number === 0) {
    return progress.seasonNumber === 0 && candidate.episode_number <= progress.episodeNumber;
  }
  if (candidate.season_number < progress.seasonNumber) return true;
  return candidate.season_number === progress.seasonNumber && candidate.episode_number <= progress.episodeNumber;
};

const tvDetailsFromEntry = async (entry: EntryRow) => {
  try {
    const cached = entry.tmdbJson ? JSON.parse(entry.tmdbJson) as Awaited<ReturnType<typeof getTvDetails>> : null;
    if (cached?.seasons?.length) return cached;
  } catch {
    // Fall through to TMDB when cached metadata is absent or malformed.
  }

  return getTvDetails(entry.tmdbId);
};

const seasonsFromEntry = async (entry: EntryRow) => {
  const details = await tvDetailsFromEntry(entry);
  return details.seasons ?? [];
};

const watchedEpisodesForSeason = (season: SeasonSummary, progress: { seasonNumber: number; episodeNumber: number }) => {
  if (season.season_number === 0) {
    return progress.seasonNumber === 0 ? Math.min(progress.episodeNumber, season.episode_count) : 0;
  }
  if (season.season_number < progress.seasonNumber) return season.episode_count;
  if (season.season_number === progress.seasonNumber) return Math.min(progress.episodeNumber, season.episode_count);
  return 0;
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const getTvSeasonWithTextFallback = async (tmdbId: number, seasonNumber: number) => {
  const season = await getTvSeason(tmdbId, seasonNumber);
  const episodes = season.episodes ?? [];
  const needsFallback = !hasText(season.overview)
    || episodes.some((episode) => !hasText(episode.name) || !hasText(episode.overview));

  if (!needsFallback) return season;

  try {
    const fallback = await getTvSeason(tmdbId, seasonNumber, "en-US");
    const fallbackEpisodes = fallback.episodes ?? [];

    return {
      ...season,
      name: hasText(season.name) ? season.name : fallback.name,
      overview: hasText(season.overview) ? season.overview : fallback.overview,
      poster_path: season.poster_path ?? fallback.poster_path,
      air_date: season.air_date ?? fallback.air_date,
      vote_average: season.vote_average ?? fallback.vote_average,
      episodes: episodes.map((episode) => {
        const fallbackEpisode = fallbackEpisodes.find((item) => item.episode_number === episode.episode_number);
        return {
          ...episode,
          name: hasText(episode.name) ? episode.name : fallbackEpisode?.name,
          overview: hasText(episode.overview) ? episode.overview : fallbackEpisode?.overview,
          still_path: episode.still_path ?? fallbackEpisode?.still_path,
          runtime: episode.runtime ?? fallbackEpisode?.runtime,
          vote_average: episode.vote_average ?? fallbackEpisode?.vote_average
        };
      })
    };
  } catch {
    return season;
  }
};

const hydrateSeasonSummaries = async (tmdbId: number, seasons: SeasonSummary[]) => {
  return Promise.all(seasons.map(async (season) => {
    if (hasText(season.overview) && season.poster_path) return season;

    try {
      const detail = await getTvSeasonWithTextFallback(tmdbId, season.season_number);
      return {
        ...season,
        name: hasText(season.name) ? season.name : detail.name,
        overview: hasText(season.overview) ? season.overview : detail.overview,
        poster_path: season.poster_path ?? detail.poster_path,
        air_date: season.air_date ?? detail.air_date,
        vote_average: season.vote_average ?? detail.vote_average,
        episode_count: season.episode_count || detail.episodes?.length || 0
      };
    } catch {
      return season;
    }
  }));
};

const seasonToPayload = (season: SeasonSummary, progress: { seasonNumber: number; episodeNumber: number }): SeasonPayload => ({
  seasonNumber: season.season_number,
  episodeCount: season.episode_count,
  watchedEpisodeCount: watchedEpisodesForSeason(season, progress),
  name: season.name ?? (season.season_number === 0 ? "Especiales" : `Temporada ${season.season_number}`),
  overview: hasText(season.overview) ? season.overview ?? null : null,
  posterPath: season.poster_path ?? null,
  airDate: season.air_date ?? null,
  year: season.air_date ? season.air_date.slice(0, 4) : null,
  voteAverage: season.vote_average ?? null
});

const finalProgressFromSeasons = (seasons: SeasonSummary[] | undefined) => {
  const watchableSeasons = (seasons ?? [])
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const lastSeason = watchableSeasons.at(-1);

  return lastSeason ? {
    seasonNumber: lastSeason.season_number,
    episodeNumber: lastSeason.episode_count
  } : null;
};

const isProgressBefore = (
  current: { seasonNumber: number; episodeNumber: number },
  target: { seasonNumber: number; episodeNumber: number }
) => {
  if (current.seasonNumber < target.seasonNumber) return true;
  return current.seasonNumber === target.seasonNumber && current.episodeNumber < target.episodeNumber;
};

const ensureWatchedProgress = (entry: EntryRow, seasons: SeasonSummary[]) => {
  if (entry.status !== "watched" || entry.mediaType !== "tv") return entry;

  const finalProgress = finalProgressFromSeasons(seasons);
  if (!finalProgress) return entry;

  const currentProgress = {
    seasonNumber: entry.seasonNumber ?? 0,
    episodeNumber: entry.episodeNumber ?? 0
  };
  if (!isProgressBefore(currentProgress, finalProgress)) return entry;

  upsertEntry(entry.mediaId, entry.profileSlug, {
    profileSlugs: [entry.profileSlug],
    status: "watched",
    rating: entry.rating,
    notes: entry.notes,
    seasonNumber: finalProgress.seasonNumber,
    episodeNumber: finalProgress.episodeNumber
  });

  return {
    ...entry,
    seasonNumber: finalProgress.seasonNumber,
    episodeNumber: finalProgress.episodeNumber
  };
};

const entryBodyWithResolvedProgress = async (mediaId: string, profileSlug: ProfileSlug, body: EntryBody) => {
  if (body.status !== "watched") {
    return body;
  }

  const entry = selectEntryOrPreviewByMediaAndProfile(mediaId, profileSlug);
  if (!entry || entry.mediaType !== "tv") return body;

  const finalProgress = finalProgressFromSeasons(await seasonsFromEntry(entry));
  return finalProgress ? {
    ...body,
    seasonNumber: finalProgress.seasonNumber,
    episodeNumber: finalProgress.episodeNumber
  } : body;
};

const getEpisodeSummary = async (row: EntryRow) => {
  if (row.mediaType !== "tv" || !hasTmdbCredentials()) {
    return null;
  }

  const progress = {
    seasonNumber: row.seasonNumber ?? 0,
    episodeNumber: row.episodeNumber ?? 0
  };

  try {
    const tv = await getTvDetails(row.tmdbId);
    const last = tv.last_episode_to_air;
    const hasNewEpisode = last ? isEpisodeAfter(last, progress) && isRecentAirDate(last.air_date) : false;
    const seasons = (tv.seasons ?? []).filter((season) => season.season_number > 0);
    const currentSeasonNumber = progress.seasonNumber > 0 ? progress.seasonNumber : seasons[0]?.season_number ?? 1;
    const currentSeasonMeta = seasons.find((season) => season.season_number === currentSeasonNumber);
    const currentSeason = await getTvSeasonWithTextFallback(row.tmdbId, currentSeasonNumber);
    let next = (currentSeason.episodes ?? []).find((episode) => {
      if (currentSeasonNumber !== progress.seasonNumber) return episode.episode_number >= 1;
      return episode.episode_number > progress.episodeNumber;
    });

    if (!next) {
      const nextSeasonNumber = currentSeasonNumber + 1;
      const nextSeason = tv.seasons?.find((season) => season.season_number === nextSeasonNumber);
      if (nextSeason) {
        const season = await getTvSeasonWithTextFallback(row.tmdbId, nextSeasonNumber);
        next = (season.episodes ?? []).find((episode) => episode.episode_number >= 1);
      }
    }

    return {
      hasNewEpisode,
      seasonNumber: currentSeasonNumber,
      seasonPosterPath: currentSeason.poster_path ?? currentSeasonMeta?.poster_path ?? row.posterPath,
      lastEpisodeToAir: last ? {
        seasonNumber: last.season_number,
        episodeNumber: last.episode_number,
        title: last.name ?? null,
        airDate: last.air_date ?? null
      } : null,
      nextEpisode: next ? {
        seasonNumber: next.season_number,
        episodeNumber: next.episode_number,
        title: next.name ?? null,
        airDate: next.air_date ?? null,
        recentlyReleased: isRecentAirDate(next.air_date)
      } : null
    };
  } catch {
    return null;
  }
};

const upsertMedia = (details: Awaited<ReturnType<typeof getMediaDetails>>) => {
  const existing = db.prepare("SELECT * FROM media_items WHERE tmdb_id = ? AND media_type = ?").get(details.tmdbId, details.mediaType) as Record<string, unknown> | undefined;
  const id = existing ? String(existing.id) : randomUUID();

  db.prepare(`
    INSERT INTO media_items (
      id, tmdb_id, media_type, title, original_title, english_title, overview, english_overview, poster_path, backdrop_path,
      release_date, first_air_date, vote_average, tmdb_json, providers_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tmdb_id, media_type) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      english_title = excluded.english_title,
      overview = excluded.overview,
      english_overview = excluded.english_overview,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      release_date = excluded.release_date,
      first_air_date = excluded.first_air_date,
      vote_average = excluded.vote_average,
      tmdb_json = excluded.tmdb_json,
      providers_json = excluded.providers_json,
      updated_at = excluded.updated_at
  `).run(
    id,
    details.tmdbId,
    details.mediaType,
    details.title,
    details.originalTitle,
    details.englishTitle,
    details.overview,
    details.englishOverview,
    details.posterPath,
    details.backdropPath,
    details.releaseDate,
    details.firstAirDate,
    details.voteAverage,
    details.tmdbJson,
    details.providersJson,
    nowIso(),
    nowIso()
  );

  return db.prepare("SELECT * FROM media_items WHERE id = ?").get(id) as Record<string, unknown>;
};

const upsertEntry = (mediaId: string, profileSlug: ProfileSlug, body: EntryBody) => {
  const profile = getProfileBySlug(profileSlug);
  const status = body.status ?? "wishlist";
  const existing = db.prepare("SELECT id FROM watch_entries WHERE profile_id = ? AND media_item_id = ?").get(profile.id, mediaId) as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  db.prepare(`
    INSERT INTO watch_entries (id, profile_id, media_item_id, status, rating, notes, watched_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, media_item_id) DO UPDATE SET
      status = excluded.status,
      rating = excluded.rating,
      notes = excluded.notes,
      watched_at = excluded.watched_at,
      updated_at = excluded.updated_at
  `).run(
    id,
    profile.id,
    mediaId,
    status,
    body.rating ?? null,
    body.notes ?? null,
    status === "watched" ? nowIso() : null,
    nowIso(),
    nowIso()
  );

  if (body.seasonNumber !== undefined || body.episodeNumber !== undefined) {
    db.prepare(`
      INSERT INTO series_progress (id, profile_id, media_item_id, season_number, episode_number, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, media_item_id) DO UPDATE SET
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        updated_at = excluded.updated_at
    `).run(
      randomUUID(),
      profile.id,
      mediaId,
      body.seasonNumber ?? 0,
      body.episodeNumber ?? 0,
      nowIso()
    );
  }
};

const syncEpisodeWatchHistory = async (mediaId: string, profileSlug: ProfileSlug, body: EntryBody) => {
  if (body.seasonNumber === undefined && body.episodeNumber === undefined) return;

  const entry = selectEntryOrPreviewByMediaAndProfile(mediaId, profileSlug);
  if (!entry || entry.mediaType !== "tv") return;

  const profile = getProfileBySlug(profileSlug);
  const progress = {
    seasonNumber: body.seasonNumber ?? 0,
    episodeNumber: body.episodeNumber ?? 0
  };

  db.prepare(`
    DELETE FROM episode_watches
    WHERE profile_id = ?
      AND media_item_id = ?
      AND (
        season_number > ?
        OR (season_number = ? AND episode_number > ?)
        OR (? = 0 AND ? = 0)
      )
  `).run(profile.id, mediaId, progress.seasonNumber, progress.seasonNumber, progress.episodeNumber, progress.seasonNumber, progress.episodeNumber);

  if (progress.episodeNumber <= 0) return;

  const stamp = nowIso();
  const seasons = await hydrateSeasonSummaries(entry.tmdbId, await seasonsFromEntry(entry)).catch(() => ([{
    season_number: progress.seasonNumber,
    episode_count: progress.episodeNumber
  }]));

  for (const season of seasons) {
    if (season.season_number < 0 || season.episode_count <= 0) continue;
    if (season.season_number > progress.seasonNumber) continue;

    const lastEpisode = season.season_number === progress.seasonNumber
      ? Math.min(progress.episodeNumber, season.episode_count)
      : season.episode_count;

    for (let episodeNumber = 1; episodeNumber <= lastEpisode; episodeNumber += 1) {
      db.prepare(`
        INSERT INTO episode_watches (id, profile_id, media_item_id, season_number, episode_number, watched_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, media_item_id, season_number, episode_number) DO NOTHING
      `).run(randomUUID(), profile.id, mediaId, season.season_number, episodeNumber, stamp, stamp, stamp);
    }
  }
};

const addToList = (listId: string, mediaId: string, userId: string) => {
  db.prepare(`
    INSERT OR IGNORE INTO list_items (list_id, media_item_id, added_by_user_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(listId, mediaId, userId, nowIso());
};

const writeTarString = (header: Buffer, value: string, offset: number, length: number) => {
  header.write(value.slice(0, length), offset, length, "utf8");
};

const writeTarOctal = (header: Buffer, value: number, offset: number, length: number) => {
  const octal = value.toString(8).padStart(length - 1, "0").slice(-(length - 1));
  header.write(octal, offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
};

const tarGzSingleFile = (filename: string, contents: Buffer) => {
  const blockSize = 512;
  const header = Buffer.alloc(blockSize, 0);
  const paddedSize = Math.ceil(contents.length / blockSize) * blockSize;
  const paddedContents = Buffer.concat([contents, Buffer.alloc(paddedSize - contents.length)]);

  writeTarString(header, filename, 0, 100);
  writeTarOctal(header, 0o644, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, contents.length, 124, 12);
  writeTarOctal(header, Math.floor(Date.now() / 1000), 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarString(header, "ustar", 257, 6);
  writeTarString(header, "00", 263, 2);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  return gzipSync(Buffer.concat([header, paddedContents, Buffer.alloc(blockSize * 2)]));
};

app.get("/health", async () => ({
  ok: true,
  service: "pipiseries-api",
  version: API_VERSION,
  tmdbConfigured: hasTmdbCredentials()
}));

app.get("/export", async (request, reply) => {
  const exportedAt = nowIso();
  const table = <T>(query: string) => db.prepare(query).all() as T[];

  return reply
    .header("content-disposition", `attachment; filename="pipiseries-export-${exportedAt.slice(0, 10)}.json"`)
    .send({
      exportedAt,
      exportedBy: {
        id: request.currentUser.id,
        email: request.currentUser.email,
        displayName: request.currentUser.displayName
      },
      version: API_VERSION,
      notes: {
        tmdbCacheIncluded: false
      },
      data: {
        users: table("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users ORDER BY created_at ASC"),
        profiles: table("SELECT id, slug, name, kind, owner_user_id AS ownerUserId, created_at AS createdAt FROM profiles ORDER BY created_at ASC"),
        mediaItems: table(`
          SELECT
            id,
            tmdb_id AS tmdbId,
            media_type AS mediaType,
            title,
            original_title AS originalTitle,
            english_title AS englishTitle,
            english_overview AS englishOverview,
            overview,
            poster_path AS posterPath,
            backdrop_path AS backdropPath,
            release_date AS releaseDate,
            first_air_date AS firstAirDate,
            vote_average AS voteAverage,
            tmdb_json AS tmdbJson,
            providers_json AS providersJson,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM media_items
          ORDER BY title COLLATE NOCASE ASC
        `),
        watchEntries: table(`
          SELECT
            id,
            profile_id AS profileId,
            media_item_id AS mediaItemId,
            status,
            rating,
            notes,
            watched_at AS watchedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM watch_entries
          ORDER BY updated_at DESC
        `),
        seriesProgress: table(`
          SELECT
            id,
            profile_id AS profileId,
            media_item_id AS mediaItemId,
            season_number AS seasonNumber,
            episode_number AS episodeNumber,
            episode_title AS episodeTitle,
            updated_at AS updatedAt
          FROM series_progress
          ORDER BY updated_at DESC
        `),
        episodeWatches: table(`
          SELECT
            id,
            profile_id AS profileId,
            media_item_id AS mediaItemId,
            season_number AS seasonNumber,
            episode_number AS episodeNumber,
            watched_at AS watchedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM episode_watches
          ORDER BY watched_at DESC
        `),
        lists: table(`
          SELECT
            id,
            name,
            icon,
            profile_id AS profileId,
            visibility,
            created_by_user_id AS createdByUserId,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM lists
          ORDER BY updated_at DESC
        `),
        listItems: table(`
          SELECT
            list_id AS listId,
            media_item_id AS mediaItemId,
            added_by_user_id AS addedByUserId,
            created_at AS createdAt
          FROM list_items
          ORDER BY created_at DESC
        `)
      }
    });
});

app.get("/backup", async (request, reply) => {
  const exportedAt = nowIso();
  const date = exportedAt.slice(0, 10);
  const sqliteFilename = `pipiseries-${date}.sqlite`;
  const archiveFilename = `pipiseries-backup-${date}.tar.gz`;
  const tmpPath = `/tmp/pipiseries-backup-${randomUUID()}.sqlite`;

  try {
    db.exec(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
    const archive = tarGzSingleFile(sqliteFilename, readFileSync(tmpPath));

    request.log.info({ exportedBy: request.currentUser.email, archiveFilename }, "database backup generated");

    return reply
      .header("content-type", "application/gzip")
      .header("content-disposition", `attachment; filename="${archiveFilename}"`)
      .send(archive);
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // The temp file may not exist if SQLite failed before creating it.
    }
  }
});

app.get("/dev-auth/users", async (_request, reply) => {
  if (!isDevAuthEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  return {
    users: [
      { label: "Juan", email: config.auth.juanEmail },
      { label: "Cami", email: config.auth.camiEmail }
    ]
  };
});

app.get("/me", async (request) => ({
  user: request.currentUser,
  profiles: getProfiles(),
  defaultProfileSlugs: defaultProfileSlugsForUser(request.currentUser),
  devAuth: isDevAuthEnabled()
}));

app.get("/profiles", async () => ({ profiles: getProfiles() }));

app.get("/search", async (request, reply) => {
  const { query, profiles } = request.query as { query?: string; profiles?: string };
  if (!query || query.trim().length < 2) {
    return { results: [] };
  }

  try {
    const activeProfiles = parseProfilesParam(profiles, defaultProfileSlugsForUser(request.currentUser));
    const results = await searchMedia(query.trim());
    const savedRows = db.prepare(`
      SELECT
        mi.tmdb_id AS tmdbId,
        mi.media_type AS mediaType,
        we.status,
        we.rating,
        p.slug AS profileSlug,
        p.name AS profileName
      FROM watch_entries we
      JOIN media_items mi ON mi.id = we.media_item_id
      JOIN profiles p ON p.id = we.profile_id
      WHERE p.slug IN (${activeProfiles.map(() => "?").join(",")})
    `).all(...activeProfiles) as Array<SearchSavedEntry & { tmdbId: number; mediaType: MediaType }>;
    const savedByMedia = new Map<string, SearchSavedEntry>();

    for (const row of savedRows) {
      const key = `${row.tmdbId}:${row.mediaType}`;
      const current = savedByMedia.get(key);
      if (!current || statusPriority[row.status] > statusPriority[current.status]) {
        savedByMedia.set(key, {
          status: row.status,
          rating: row.rating,
          profileSlug: row.profileSlug,
          profileName: row.profileName
        });
      }
    }

    return {
      results: results.map((result) => ({
        ...result,
        saved: savedByMedia.get(`${result.tmdbId}:${result.mediaType}`) ?? null
      }))
    };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudo buscar en TMDB. Revisa las credenciales." });
  }
});

app.get("/dashboard", async (request) => {
  const query = request.query as { profiles?: string };
  const activeProfiles = parseProfilesParam(query.profiles, defaultProfileSlugsForUser(request.currentUser));
  const watching = selectEntries(activeProfiles, ["watching"]);
  const watchedTv = selectEntries(activeProfiles, ["watched"]).filter((entry) => entry.mediaType === "tv");
  const wishlist = selectEntries(activeProfiles, ["wishlist"]).slice(0, 12);
  const watched = selectEntries(activeProfiles, ["watched"]).slice(0, 12);

  const watchingWithEpisodes = await Promise.all(watching.map(async (entry) => ({
    ...entryToPayload(entry),
    episodeInfo: await getEpisodeSummary(entry)
  })));

  const watchingKeys = new Set(watching.map((entry) => `${entry.mediaId}:${entry.profileSlug}`));
  const newEpisodes = (await Promise.all([...watching, ...watchedTv].map(async (entry) => ({
    ...entryToPayload(entry),
    episodeInfo: await getEpisodeSummary(entry)
  })))).filter((entry) => entry.episodeInfo?.hasNewEpisode && !watchingKeys.has(`${entry.media.id}:${entry.profile.slug}`));

  return {
    activeProfiles,
    watching: watchingWithEpisodes,
    newEpisodes,
    wishlist: wishlist.map(entryToPayload),
    watched: watched.map(entryToPayload)
  };
});

app.get("/media", async (request) => {
  const query = request.query as { profiles?: string; status?: WatchStatus };
  const activeProfiles = parseProfilesParam(query.profiles, defaultProfileSlugsForUser(request.currentUser));
  const statuses = query.status ? [query.status] : undefined;
  return { items: selectEntries(activeProfiles, statuses).map(entryToPayload) };
});

app.post("/media", async (request, reply) => {
  const body = request.body as SaveMediaBody;
  if (!body.tmdbId || (body.mediaType !== "movie" && body.mediaType !== "tv")) {
    return reply.status(400).send({ error: "tmdbId y mediaType son obligatorios" });
  }

  try {
    const details = await getMediaDetails(body.mediaType, body.tmdbId);
    const mediaRow = upsertMedia(details);
    const media = mapMediaRow(mediaRow);
    const profileSlugs = normalizeProfileSlugs(body.profileSlugs);

    for (const profileSlug of profileSlugs) {
      const resolvedBody = await entryBodyWithResolvedProgress(media.id, profileSlug, body);
      upsertEntry(media.id, profileSlug, resolvedBody);
      await syncEpisodeWatchHistory(media.id, profileSlug, resolvedBody);
    }

    if (body.listId) {
      addToList(body.listId, media.id, request.currentUser.id);
    }

    return { media, profileSlugs };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudo guardar el item desde TMDB" });
  }
});

app.get("/media/preview", async (request, reply) => {
  const query = request.query as { tmdbId?: string; mediaType?: MediaType; profileSlug?: ProfileSlug };
  const tmdbId = Number(query.tmdbId);
  if (!tmdbId || (query.mediaType !== "movie" && query.mediaType !== "tv")) {
    return reply.status(400).send({ error: "tmdbId y mediaType son obligatorios" });
  }

  try {
    const details = await getMediaDetails(query.mediaType, tmdbId);
    const media = mapMediaRow(upsertMedia(details));
    const profileSlug = query.profileSlug ?? request.currentUser.profileSlug;
    const entry = selectEntryByMediaAndProfile(media.id, profileSlug) ?? previewEntryRowForMedia(media, profileSlug);

    return { entry: entryToPayload(entry) };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudo cargar el detalle desde TMDB" });
  }
});

app.get("/media/:id/series", async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { profileSlug?: ProfileSlug };
  const profileSlug = query.profileSlug ?? request.currentUser.profileSlug;
  let entry = selectEntryOrPreviewByMediaAndProfile(id, profileSlug);

  if (!entry) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  if (entry.mediaType !== "tv") {
    return reply.status(400).send({ error: "El detalle de serie solo aplica a series" });
  }

  if (!hasTmdbCredentials() && !entry.tmdbJson) {
    return reply.status(502).send({ error: "Faltan credenciales de TMDB para cargar la serie" });
  }

  try {
    const details = await tvDetailsFromEntry(entry);
    const hydratedSeasons = await hydrateSeasonSummaries(entry.tmdbId, details.seasons ?? []);
    entry = ensureWatchedProgress(entry, hydratedSeasons);
    const progress = {
      seasonNumber: entry.seasonNumber ?? 0,
      episodeNumber: entry.episodeNumber ?? 0
    };
    const seasons = hydratedSeasons.map((season) => seasonToPayload(season, progress));

    return {
      entry: entryToPayload(entry),
      series: {
        title: details.name ?? entry.title,
        year: details.first_air_date ? details.first_air_date.slice(0, 4) : null,
        overview: details.overview ?? entry.overview,
        posterPath: details.poster_path ?? entry.posterPath,
        backdropPath: details.backdrop_path ?? entry.backdropPath,
        voteAverage: details.vote_average ?? entry.voteAverage,
        genres: details.genres?.map((genre) => genre.name) ?? []
      },
      progress,
      seasons
    };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudo cargar la serie desde TMDB" });
  }
});

app.post("/media/sync-titles", async (request, reply) => {
  if (!hasTmdbCredentials()) {
    return reply.status(502).send({ error: "Faltan credenciales de TMDB" });
  }

  const rows = db.prepare(`
    SELECT id, tmdb_id AS tmdbId, media_type AS mediaType
    FROM media_items
    WHERE english_title IS NULL OR english_title = ''
  `).all() as Array<{ id: string; tmdbId: number; mediaType: MediaType }>;

  let updated = 0;
  for (const row of rows) {
    try {
      const details = await getMediaDetails(row.mediaType, row.tmdbId);
      if (details.englishTitle || details.englishOverview) {
        db.prepare("UPDATE media_items SET english_title = ?, english_overview = ? WHERE id = ?")
          .run(details.englishTitle, details.englishOverview, row.id);
        updated += 1;
      }
    } catch (error) {
      request.log.warn(error);
    }
  }

  return { updated, total: rows.length };
});

app.get("/media/:id/movie", async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { profileSlug?: ProfileSlug };
  const profileSlug = query.profileSlug ?? request.currentUser.profileSlug;
  const entry = selectEntryOrPreviewByMediaAndProfile(id, profileSlug);

  if (!entry) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  if (entry.mediaType !== "movie") {
    return reply.status(400).send({ error: "El detalle de pelicula solo aplica a peliculas" });
  }

  if (!hasTmdbCredentials()) {
    return reply.status(502).send({ error: "Faltan credenciales de TMDB para cargar la pelicula" });
  }

  try {
    const details = await getMovieDetails(entry.tmdbId);
    const director = details.credits?.crew?.find((member) => member.job === "Director")?.name ?? null;

    return {
      entry: entryToPayload(entry),
      movie: {
        title: details.title ?? entry.title,
        year: details.release_date ? details.release_date.slice(0, 4) : null,
        overview: details.overview ?? entry.overview,
        tagline: details.tagline && details.tagline.trim() ? details.tagline : null,
        runtime: details.runtime ?? null,
        director,
        genres: details.genres?.map((genre) => genre.name) ?? [],
        voteAverage: details.vote_average ?? entry.voteAverage,
        releaseDate: details.release_date ?? null
      }
    };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudo cargar la pelicula desde TMDB" });
  }
});

app.put("/media/:id/pin", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { profileSlug?: ProfileSlug; pinned?: boolean };
  const profileSlug = body.profileSlug ?? request.currentUser.profileSlug;

  const result = db.prepare(`
    UPDATE watch_entries
    SET pinned = ?
    WHERE media_item_id = ?
      AND profile_id = (SELECT id FROM profiles WHERE slug = ?)
  `).run(body.pinned ? 1 : 0, id, profileSlug);

  if (result.changes === 0) {
    return reply.status(404).send({ error: "Entrada no encontrada para ese perfil" });
  }

  return { ok: true, pinned: Boolean(body.pinned) };
});

app.get("/media/:id/season", async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { profileSlug?: ProfileSlug; seasonNumber?: string };
  const profileSlug = query.profileSlug ?? request.currentUser.profileSlug;
  let entry = selectEntryOrPreviewByMediaAndProfile(id, profileSlug);

  if (!entry) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  if (entry.mediaType !== "tv") {
    return reply.status(400).send({ error: "El detalle de episodios solo aplica a series" });
  }

  if (!hasTmdbCredentials()) {
    return reply.status(502).send({ error: "Faltan credenciales de TMDB para cargar capitulos" });
  }

  try {
    const hydratedSeasons = await hydrateSeasonSummaries(entry.tmdbId, await seasonsFromEntry(entry));
    entry = ensureWatchedProgress(entry, hydratedSeasons);
    const progress = {
      seasonNumber: entry.seasonNumber ?? 0,
      episodeNumber: entry.episodeNumber ?? 0
    };
    const seasons = hydratedSeasons.map((season) => seasonToPayload(season, progress));
    const savedSeason = entry.seasonNumber !== null && (entry.seasonNumber > 0 || (entry.seasonNumber === 0 && (entry.episodeNumber ?? 0) > 0))
      ? entry.seasonNumber
      : undefined;
    const firstRegularSeason = seasons.find((season) => season.seasonNumber > 0)?.seasonNumber;
    const fallbackSeason = savedSeason ?? firstRegularSeason ?? seasons[0]?.seasonNumber ?? 1;
    const requestedSeason = Number(query.seasonNumber ?? fallbackSeason);
    const selectedSeason = seasons.some((season) => season.seasonNumber === requestedSeason)
      ? requestedSeason
      : fallbackSeason;
    const season = await getTvSeasonWithTextFallback(entry.tmdbId, selectedSeason);
    const selectedSeasonMeta = hydratedSeasons.find((item) => item.season_number === selectedSeason);
    const seasonSummary = seasonToPayload({
      season_number: season.season_number ?? selectedSeason,
      episode_count: selectedSeasonMeta?.episode_count ?? season.episodes?.length ?? 0,
      name: hasText(season.name) ? season.name : selectedSeasonMeta?.name,
      overview: hasText(season.overview) ? season.overview : selectedSeasonMeta?.overview,
      poster_path: season.poster_path ?? selectedSeasonMeta?.poster_path,
      air_date: season.air_date ?? selectedSeasonMeta?.air_date,
      vote_average: season.vote_average ?? selectedSeasonMeta?.vote_average
    }, progress);
    const rawEpisodes = season.episodes ?? [];
    const nextEpisode = rawEpisodes.find((episode) => isEpisodeAfter(episode, progress));
    const watchedRows = db.prepare(`
      SELECT episode_number AS episodeNumber, watched_at AS watchedAt
      FROM episode_watches ew
      JOIN profiles p ON p.id = ew.profile_id
      WHERE p.slug = ?
        AND ew.media_item_id = ?
        AND ew.season_number = ?
    `).all(profileSlug, id, selectedSeason) as Array<{ episodeNumber: number; watchedAt: string }>;
    const watchedDatesByEpisode = new Map(watchedRows.map((row) => [row.episodeNumber, row.watchedAt]));
    const episodes = rawEpisodes.map((episode) => ({
      id: episode.id,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      title: episode.name ?? `Episodio ${episode.episode_number}`,
      overview: episode.overview ?? null,
      airDate: episode.air_date ?? null,
      stillPath: episode.still_path ?? null,
      runtime: episode.runtime ?? null,
      voteAverage: episode.vote_average ?? null,
      watched: isEpisodeWatched(episode, progress),
      watchedAt: watchedDatesByEpisode.get(episode.episode_number) ?? null,
      next: nextEpisode?.id === episode.id
    }));

    return {
      entry: entryToPayload(entry),
      season: seasonSummary,
      seasons,
      selectedSeason,
      progress,
      episodes
    };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudieron cargar capitulos desde TMDB" });
  }
});

app.post("/media/:id/entry", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as EntryBody;
  const media = db.prepare("SELECT * FROM media_items WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!media) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  const profileSlugs = normalizeProfileSlugs(body.profileSlugs);
  for (const profileSlug of profileSlugs) {
    const resolvedBody = await entryBodyWithResolvedProgress(id, profileSlug, body);
    upsertEntry(id, profileSlug, resolvedBody);
    await syncEpisodeWatchHistory(id, profileSlug, resolvedBody);
  }

  return { ok: true, profileSlugs };
});

app.delete("/media/:id/entry", async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { profileSlug?: ProfileSlug };
  const profileSlug = query.profileSlug ?? request.currentUser.profileSlug;
  const profile = getProfileBySlug(profileSlug);
  const media = db.prepare("SELECT id FROM media_items WHERE id = ?").get(id) as { id: string } | undefined;

  if (!media) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  db.prepare("DELETE FROM series_progress WHERE profile_id = ? AND media_item_id = ?").run(profile.id, id);
  db.prepare("DELETE FROM watch_entries WHERE profile_id = ? AND media_item_id = ?").run(profile.id, id);

  return { ok: true, profileSlug };
});

app.get("/lists", async () => {
  const rows = db.prepare(`
    SELECT
      l.id,
      l.name,
      l.icon,
      l.visibility,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      p.slug AS profileSlug,
      p.name AS profileName,
      COUNT(li.media_item_id) AS itemCount
    FROM lists l
    LEFT JOIN profiles p ON p.id = l.profile_id
    LEFT JOIN list_items li ON li.list_id = l.id
    GROUP BY l.id
    ORDER BY l.created_at ASC
  `).all();

  return { lists: rows };
});

const selectListById = (id: string) => {
  return db.prepare(`
    SELECT
      l.id,
      l.name,
      l.icon,
      l.visibility,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      p.slug AS profileSlug,
      p.name AS profileName,
      COUNT(li.media_item_id) AS itemCount
    FROM lists l
    LEFT JOIN profiles p ON p.id = l.profile_id
    LEFT JOIN list_items li ON li.list_id = l.id
    WHERE l.id = ?
    GROUP BY l.id
    LIMIT 1
  `).get(id) as {
    id: string;
    name: string;
    icon: string | null;
    visibility: "shared" | "personal";
    createdAt: string;
    updatedAt: string;
    profileSlug: ProfileSlug | null;
    profileName: string | null;
    itemCount: number;
  } | undefined;
};

app.post("/lists", async (request) => {
  const body = request.body as ListBody;
  const profile = body.profileSlug ? getProfileBySlug(body.profileSlug) : null;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO lists (id, name, icon, profile_id, visibility, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name?.trim() || "Nueva lista",
    body.icon?.trim() || null,
    profile?.id ?? null,
    body.visibility ?? (body.profileSlug === "juntos" ? "shared" : "personal"),
    request.currentUser.id,
    nowIso(),
    nowIso()
  );

  return { id };
});

app.get("/lists/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const list = selectListById(id);

  if (!list) {
    return reply.status(404).send({ error: "Lista no encontrada" });
  }

  const rows = db.prepare(`
    SELECT
      li.created_at AS addedAt,
      u.display_name AS addedByName,
      we.id AS entryId,
      p.id AS profileId,
      p.slug AS profileSlug,
      p.name AS profileName,
      we.status,
      we.rating,
      we.notes,
      we.watched_at AS watchedAt,
      we.created_at AS createdAt,
      we.updated_at AS updatedAt,
      we.pinned AS pinned,
      sp.season_number AS seasonNumber,
      sp.episode_number AS episodeNumber,
      sp.episode_title AS episodeTitle,
      mi.id AS mediaId,
      mi.tmdb_id AS tmdbId,
      mi.media_type AS mediaType,
      mi.title,
      mi.original_title AS originalTitle,
      mi.english_title AS englishTitle,
      mi.english_overview AS englishOverview,
      mi.overview,
      mi.poster_path AS posterPath,
      mi.backdrop_path AS backdropPath,
      mi.release_date AS releaseDate,
      mi.first_air_date AS firstAirDate,
      mi.vote_average AS voteAverage,
      mi.tmdb_json AS tmdbJson,
      mi.providers_json AS providersJson
    FROM list_items li
    JOIN lists l ON l.id = li.list_id
    JOIN media_items mi ON mi.id = li.media_item_id
    LEFT JOIN users u ON u.id = li.added_by_user_id
    LEFT JOIN watch_entries we ON we.media_item_id = mi.id
      AND we.profile_id = COALESCE(l.profile_id, (SELECT id FROM profiles WHERE slug = ?))
    LEFT JOIN profiles p ON p.id = we.profile_id
    LEFT JOIN series_progress sp ON sp.profile_id = p.id AND sp.media_item_id = mi.id
    WHERE li.list_id = ?
    ORDER BY li.created_at DESC
  `).all(request.currentUser.profileSlug, id) as ListItemRow[];

  return {
    list,
    items: rows.map((row) => ({
      addedAt: row.addedAt,
      addedByName: row.addedByName,
      media: mediaToPayload(row),
      entry: row.entryId && row.profileId && row.profileSlug && row.profileName && row.status
        ? entryToPayload(row as EntryRow)
        : null
    }))
  };
});

app.patch("/lists/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as ListBody;
  const existing = selectListById(id);

  if (!existing) {
    return reply.status(404).send({ error: "Lista no encontrada" });
  }

  const nextName = body.name?.trim();
  const nextProfile = body.profileSlug ? getProfileBySlug(body.profileSlug) : null;

  db.prepare(`
    UPDATE lists
    SET
      name = ?,
      icon = ?,
      profile_id = ?,
      visibility = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    nextName || existing.name,
    body.icon === undefined ? existing.icon : body.icon.trim() || null,
    body.profileSlug === undefined ? (existing.profileSlug ? getProfileBySlug(existing.profileSlug).id : null) : nextProfile?.id ?? null,
    body.visibility ?? existing.visibility,
    nowIso(),
    id
  );

  return { list: selectListById(id) };
});

app.delete("/lists/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const existing = selectListById(id);

  if (!existing) {
    return reply.status(404).send({ error: "Lista no encontrada" });
  }

  db.prepare("DELETE FROM lists WHERE id = ?").run(id);
  return { ok: true };
});

app.post("/lists/:id/items", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { mediaItemId?: string };
  const list = selectListById(id);

  if (!list) {
    return reply.status(404).send({ error: "Lista no encontrada" });
  }

  if (!body.mediaItemId) {
    return reply.status(400).send({ error: "mediaItemId es obligatorio" });
  }

  const media = db.prepare("SELECT id FROM media_items WHERE id = ?").get(body.mediaItemId) as { id: string } | undefined;
  if (!media) {
    return reply.status(404).send({ error: "Item no encontrado" });
  }

  addToList(id, body.mediaItemId, request.currentUser.id);
  db.prepare("UPDATE lists SET updated_at = ? WHERE id = ?").run(nowIso(), id);
  return { ok: true };
});

app.post("/lists/:id/items/:mediaId/move", async (request, reply) => {
  const { id, mediaId } = request.params as { id: string; mediaId: string };
  const body = request.body as MoveListItemBody;
  const source = selectListById(id);
  const target = body.targetListId ? selectListById(body.targetListId) : null;

  if (!source) {
    return reply.status(404).send({ error: "Lista origen no encontrada" });
  }

  if (!target || target.id === id) {
    return reply.status(400).send({ error: "Lista destino invalida" });
  }

  const item = db.prepare("SELECT media_item_id AS mediaItemId FROM list_items WHERE list_id = ? AND media_item_id = ?").get(id, mediaId) as { mediaItemId: string } | undefined;
  if (!item) {
    return reply.status(404).send({ error: "Item no encontrado en la lista" });
  }

  addToList(target.id, mediaId, request.currentUser.id);
  db.prepare("DELETE FROM list_items WHERE list_id = ? AND media_item_id = ?").run(id, mediaId);
  db.prepare("UPDATE lists SET updated_at = ? WHERE id IN (?, ?)").run(nowIso(), id, target.id);
  return { ok: true };
});

app.delete("/lists/:id/items/:mediaId", async (request, reply) => {
  const { id, mediaId } = request.params as { id: string; mediaId: string };
  const existing = selectListById(id);

  if (!existing) {
    return reply.status(404).send({ error: "Lista no encontrada" });
  }

  db.prepare("DELETE FROM list_items WHERE list_id = ? AND media_item_id = ?").run(id, mediaId);
  db.prepare("UPDATE lists SET updated_at = ? WHERE id = ?").run(nowIso(), id);
  return { ok: true };
});

app.get("/recommendations", async (request, reply) => {
  const query = request.query as { profileSlug?: ProfileSlug; mediaType?: MediaType | "all"; seed?: string };
  const profileSlug = query.profileSlug ?? "juntos";
  const mediaType = isMediaType(query.mediaType) ? query.mediaType : null;
  const seed = typeof query.seed === "string" && query.seed.trim() ? query.seed.trim() : nowIso().slice(0, 10);
  const seedHash = stableHash(`${profileSlug}:${mediaType ?? "all"}:${seed}`);
  const profile = getProfileBySlug(profileSlug);

  const baseItemsQuery = `
    SELECT mi.tmdb_id AS tmdbId, mi.media_type AS mediaType
    FROM watch_entries we
    JOIN media_items mi ON mi.id = we.media_item_id
    WHERE we.profile_id = ?
      AND (we.status IN ('watched', 'watching') OR we.rating >= 4)
      ${mediaType ? "AND mi.media_type = ?" : ""}
    ORDER BY COALESCE(we.rating, 0) DESC, we.updated_at DESC
    LIMIT 24
  `;
  const baseItems = db.prepare(baseItemsQuery).all(...(mediaType ? [profile.id, mediaType] : [profile.id])) as Array<{ tmdbId: number; mediaType: MediaType }>;
  const selectedBaseItems = [...baseItems]
    .sort((a, b) => stableHash(`${seedHash}:${a.mediaType}:${a.tmdbId}`) - stableHash(`${seedHash}:${b.mediaType}:${b.tmdbId}`))
    .slice(0, 8);

  const saved = db.prepare("SELECT tmdb_id || ':' || media_type AS key FROM media_items").all() as Array<{ key: string }>;
  const savedKeys = new Set(saved.map((item) => item.key));
  const results = new Map<string, TmdbSearchResult & { score: number }>();

  try {
    for (const [index, base] of selectedBaseItems.entries()) {
      const page = 1 + (stableHash(`${seedHash}:${base.mediaType}:${base.tmdbId}:${index}`) % 3);
      let recommendations = await getRecommendationsForItem(base.mediaType, base.tmdbId, page);
      if (recommendations.length === 0 && page !== 1) {
        recommendations = await getRecommendationsForItem(base.mediaType, base.tmdbId, 1);
      }

      for (const recommendation of recommendations) {
        const key = `${recommendation.tmdbId}:${recommendation.mediaType}`;
        if (savedKeys.has(key)) continue;
        if (mediaType && recommendation.mediaType !== mediaType) continue;

        const current = results.get(key);
        results.set(key, {
          ...recommendation,
          score: (current?.score ?? 0) + 1 + (stableHash(`${seedHash}:${key}`) % 1000) / 100000
        });
      }
    }

    return {
      profileSlug,
      mediaType: mediaType ?? "all",
      seed,
      results: [...results.values()]
        .sort((a, b) => b.score - a.score || (b.voteAverage ?? 0) - (a.voteAverage ?? 0) || stableHash(`${seedHash}:${a.tmdbId}:${a.mediaType}`) - stableHash(`${seedHash}:${b.tmdbId}:${b.mediaType}`))
        .slice(0, 20)
    };
  } catch (error) {
    request.log.warn(error);
    return reply.status(502).send({ error: "No se pudieron cargar recomendados de TMDB" });
  }
});

await app.listen({ host: config.apiHost, port: config.apiPort });
