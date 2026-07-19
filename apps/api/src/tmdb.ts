import { db, nowIso } from "./db.js";
import { config, hasTmdbCredentials } from "./env.js";
import type { MediaType, TmdbSearchResult, WatchProvider } from "./types.js";

type TmdbRawResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
};

type TmdbProviderResponse = {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

export type TmdbDetails = TmdbRawResult & {
  "watch/providers"?: {
    results?: Record<string, TmdbProviderResponse>;
  };
  genres?: Array<{ id: number; name: string }>;
  runtime?: number | null;
  tagline?: string | null;
  credits?: {
    crew?: Array<{ job?: string; name?: string; department?: string }>;
  };
  translations?: {
    translations?: Array<{ iso_639_1?: string; data?: { title?: string; name?: string; overview?: string } }>;
  };
  last_episode_to_air?: TmdbEpisode | null;
  next_episode_to_air?: TmdbEpisode | null;
  seasons?: Array<{
    season_number: number;
    episode_count: number;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    air_date?: string | null;
    vote_average?: number;
  }>;
};

export type TmdbEpisode = {
  id: number;
  name?: string;
  overview?: string;
  season_number: number;
  episode_number: number;
  air_date?: string;
  still_path?: string | null;
  runtime?: number | null;
  vote_average?: number;
};

type TmdbSeason = {
  id?: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string | null;
  season_number?: number;
  vote_average?: number;
  episodes?: TmdbEpisode[];
};

const authHeaders = () => {
  if (config.tmdb.accessToken) {
    return { Authorization: `Bearer ${config.tmdb.accessToken}` };
  }

  return {};
};

const assertCredentials = () => {
  if (!hasTmdbCredentials()) {
    throw new Error("TMDB credentials are missing. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env.");
  }
};

const hours = (value: number) => value * 60 * 60 * 1000;
const days = (value: number) => hours(value * 24);

const cacheTtl = {
  search: hours(12),
  details: days(7),
  recommendations: days(2),
  tvDetails: hours(6),
  season: days(14)
};

const stableParams = (params: Record<string, string | number | boolean | undefined>) => (
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&")
);

const tmdbCacheKey = (path: string, params: Record<string, string | number | boolean | undefined>) => {
  const query = stableParams(params);
  return query ? `${path}?${query}` : path;
};

const readTmdbCache = <T>(cacheKey: string): T | null => {
  const cached = db.prepare(`
    SELECT payload_json
    FROM tmdb_cache
    WHERE cache_key = ? AND expires_at > ?
  `).get(cacheKey, nowIso()) as { payload_json: string } | undefined;

  if (!cached) return null;

  try {
    return JSON.parse(cached.payload_json) as T;
  } catch {
    db.prepare("DELETE FROM tmdb_cache WHERE cache_key = ?").run(cacheKey);
    return null;
  }
};

const writeTmdbCache = (cacheKey: string, payload: unknown, ttlMs: number) => {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(`
    INSERT INTO tmdb_cache (cache_key, payload_json, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run(cacheKey, JSON.stringify(payload), expiresAt, now, now);
};

const tmdbFetch = async <T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  ttlMs = 0
) => {
  assertCredentials();

  const url = new URL(`${config.tmdb.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  if (!config.tmdb.accessToken && config.tmdb.apiKey) {
    url.searchParams.set("api_key", config.tmdb.apiKey);
  }

  const cacheKey = ttlMs > 0 ? tmdbCacheKey(path, params) : null;
  if (cacheKey) {
    const cached = readTmdbCache<T>(cacheKey);
    if (cached) return cached;
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...authHeaders()
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TMDB ${response.status}: ${message}`);
  }

  const data = await response.json() as T;
  if (cacheKey) writeTmdbCache(cacheKey, data, ttlMs);

  return data;
};

export const buildImageUrl = (path: string | null | undefined, size = "w500") => {
  if (!path) return null;
  return `${config.tmdb.imageBaseUrl}/${size}${path}`;
};

const normalizeResult = (result: TmdbRawResult): TmdbSearchResult | null => {
  const mediaType = result.media_type as MediaType | undefined;
  if (mediaType !== "movie" && mediaType !== "tv") return null;

  const date = mediaType === "movie" ? result.release_date : result.first_air_date;
  const title = mediaType === "movie" ? result.title : result.name;
  if (!title) return null;

  return {
    tmdbId: result.id,
    mediaType,
    title,
    originalTitle: mediaType === "movie" ? result.original_title ?? null : result.original_name ?? null,
    overview: result.overview ?? null,
    posterPath: result.poster_path ?? null,
    backdropPath: result.backdrop_path ?? null,
    releaseDate: mediaType === "movie" ? result.release_date ?? null : null,
    firstAirDate: mediaType === "tv" ? result.first_air_date ?? null : null,
    year: date ? date.slice(0, 4) : null,
    voteAverage: result.vote_average ?? null
  };
};

const searchMediaByLanguage = async (query: string, language: string) => {
  const data = await tmdbFetch<{ results?: TmdbRawResult[] }>("/search/multi", {
    query,
    include_adult: false,
    language,
    page: 1
  }, cacheTtl.search);

  return (data.results ?? [])
    .map(normalizeResult)
    .filter((result): result is TmdbSearchResult => Boolean(result));
};

const searchLanguages = () => Array.from(new Set([
  config.tmdb.language,
  config.tmdb.fallbackLanguage,
  "en-US"
].filter(Boolean)));

const singularizeWord = (word: string) => {
  if (word.length <= 3 || !word.toLowerCase().endsWith("s")) return word;
  return word.slice(0, -1);
};

const searchQueryVariants = (query: string) => {
  const normalized = query.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  const variants = [normalized];

  words.forEach((word, index) => {
    const singular = singularizeWord(word);
    if (singular === word) return;

    const nextWords = [...words];
    nextWords[index] = singular;
    variants.push(nextWords.join(" "));
  });

  const fullySingular = words.map(singularizeWord).join(" ");
  variants.push(fullySingular);

  return Array.from(new Set(variants)).slice(0, 6);
};

export const searchMedia = async (query: string) => {
  const resultsByLanguage = await Promise.all(searchQueryVariants(query).flatMap((variant) => (
    searchLanguages().map((language) => searchMediaByLanguage(variant, language))
  )));
  const merged = new Map<string, TmdbSearchResult>();

  for (const results of resultsByLanguage) {
    for (const result of results) {
      const key = `${result.tmdbId}:${result.mediaType}`;
      if (!merged.has(key)) {
        merged.set(key, result);
      }
    }
  }

  return [...merged.values()];
};

const normalizeProviders = (details: TmdbDetails): { providers: WatchProvider[]; link: string | null } => {
  const region = details["watch/providers"]?.results?.[config.tmdb.watchRegion];
  if (!region) return { providers: [], link: null };

  const providerTypes: WatchProvider["type"][] = ["flatrate", "free", "ads", "rent", "buy"];
  const seen = new Set<string>();
  const providers: WatchProvider[] = [];

  for (const type of providerTypes) {
    for (const provider of region[type] ?? []) {
      const key = `${provider.provider_id}:${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      providers.push({
        providerId: provider.provider_id,
        providerName: provider.provider_name,
        logoPath: provider.logo_path ?? null,
        type
      });
    }
  }

  return { providers, link: region.link ?? null };
};

export const getMediaDetails = async (mediaType: MediaType, tmdbId: number) => {
  const namespace = mediaType === "movie" ? "movie" : "tv";
  const details = await tmdbFetch<TmdbDetails>(`/${namespace}/${tmdbId}`, {
    append_to_response: "watch/providers,translations",
    language: config.tmdb.language
  }, cacheTtl.details);

  const providerData = normalizeProviders(details);
  const title = mediaType === "movie" ? details.title : details.name;

  if (!title) {
    throw new Error("TMDB response did not include a title");
  }

  const enTranslation = details.translations?.translations?.find((entry) => entry.iso_639_1 === "en")?.data;
  const englishTitle = (enTranslation?.title || enTranslation?.name || null)?.trim() || null;
  const englishOverview = enTranslation?.overview?.trim() || null;

  return {
    tmdbId,
    mediaType,
    title,
    englishTitle,
    englishOverview,
    originalTitle: mediaType === "movie" ? details.original_title ?? null : details.original_name ?? null,
    overview: details.overview ?? null,
    posterPath: details.poster_path ?? null,
    backdropPath: details.backdrop_path ?? null,
    releaseDate: mediaType === "movie" ? details.release_date ?? null : null,
    firstAirDate: mediaType === "tv" ? details.first_air_date ?? null : null,
    voteAverage: details.vote_average ?? null,
    tmdbJson: JSON.stringify(details),
    providersJson: JSON.stringify(providerData)
  };
};

export const getRecommendationsForItem = async (mediaType: MediaType, tmdbId: number, page = 1) => {
  const namespace = mediaType === "movie" ? "movie" : "tv";
  const data = await tmdbFetch<{ results?: TmdbRawResult[] }>(`/${namespace}/${tmdbId}/recommendations`, {
    language: config.tmdb.language,
    page
  }, cacheTtl.recommendations);

  return (data.results ?? [])
    .map((item) => normalizeResult({ ...item, media_type: mediaType }))
    .filter((result): result is TmdbSearchResult => Boolean(result));
};

export const getTvDetails = async (tmdbId: number) => {
  return tmdbFetch<TmdbDetails>(`/tv/${tmdbId}`, {
    language: config.tmdb.language
  }, cacheTtl.tvDetails);
};

export const getMovieDetails = async (tmdbId: number) => {
  return tmdbFetch<TmdbDetails>(`/movie/${tmdbId}`, {
    append_to_response: "credits",
    language: config.tmdb.language
  }, cacheTtl.tvDetails);
};

export const getTvSeason = async (tmdbId: number, seasonNumber: number, language = config.tmdb.language) => {
  return tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${seasonNumber}`, {
    language
  }, cacheTtl.season);
};
