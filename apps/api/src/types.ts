export type MediaType = "movie" | "tv";
export type WatchStatus = "watching" | "watched" | "paused" | "dropped" | "wishlist";
export type ProfileSlug = "juan" | "cami" | "juntos";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  profileSlug: ProfileSlug;
};

export type Profile = {
  id: string;
  slug: ProfileSlug;
  name: string;
  kind: "person" | "shared";
  ownerUserId: string | null;
};

export type MediaItem = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export type TmdbSearchResult = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
  year: string | null;
  voteAverage: number | null;
};

export type WatchProvider = {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  type: "flatrate" | "free" | "ads" | "rent" | "buy";
};
