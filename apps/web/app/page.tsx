"use client";

import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  Film,
  Grid2X2,
  Home,
  ListPlus,
  Loader2,
  Pencil,
  Pin,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Tv,
  UserRound,
  Users,
  AlertTriangle,
  X
} from "lucide-react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type ProfileSlug = "juan" | "cami" | "juntos";
type MediaType = "movie" | "tv";
type WatchStatus = "watching" | "watched" | "paused" | "dropped" | "wishlist";
type Tab = "home" | "search" | "lists" | "recs" | "profile";
type ProfileMediaFilter = "all" | MediaType;
type RecommendationMediaFilter = "all" | MediaType;
type ProfileSort = "updated_desc" | "added_desc" | "name_asc" | "name_desc" | "watched_desc";

type DevUser = {
  label: string;
  email: string;
};

type Profile = {
  id: string;
  slug: ProfileSlug;
  name: string;
  kind: "person" | "shared";
};

type MeResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    profileSlug: ProfileSlug;
  };
  profiles: Profile[];
  defaultProfileSlugs: ProfileSlug[];
  devAuth: boolean;
};

type Provider = {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  type: "flatrate" | "free" | "ads" | "rent" | "buy";
};

type Media = {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  providers?: {
    providers: Provider[];
    link: string | null;
  };
};

type Entry = {
  entryId: string;
  profile: {
    id: string;
    slug: ProfileSlug;
    name: string;
  };
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  progress: {
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle: string | null;
  } | null;
  media: Media;
  episodeInfo?: {
    hasNewEpisode: boolean;
    seasonNumber?: number;
    seasonPosterPath?: string | null;
    lastEpisodeToAir: {
      seasonNumber: number;
      episodeNumber: number;
      title: string | null;
      airDate: string | null;
    } | null;
    nextEpisode: {
      seasonNumber: number;
      episodeNumber: number;
      title: string | null;
      airDate: string | null;
    } | null;
  } | null;
};

type Dashboard = {
  activeProfiles: ProfileSlug[];
  watching: Entry[];
  newEpisodes: Entry[];
  wishlist: Entry[];
  watched: Entry[];
};

type SearchResult = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
  year: string | null;
  voteAverage: number | null;
  saved?: {
    status: WatchStatus;
    profileSlug: ProfileSlug;
    profileName: string;
    rating: number | null;
  } | null;
};

type SavedList = {
  id: string;
  name: string;
  icon: string | null;
  visibility: "shared" | "personal";
  profileSlug: ProfileSlug | null;
  profileName: string | null;
  itemCount: number;
};

type ListDetailItem = {
  addedAt: string;
  addedByName: string | null;
  media: Media;
  entry: Entry | null;
};

type ListDetail = {
  list: SavedList;
  items: ListDetailItem[];
};

type HomeWishlistItem = {
  media: Media;
  entry: Entry | null;
  lists: SavedList[];
  hasWishlistStatus: boolean;
};

type Recommendation = SearchResult & {
  score?: number;
};

type SeasonSummary = {
  seasonNumber: number;
  episodeCount: number;
  watchedEpisodeCount?: number;
  name: string;
  overview?: string | null;
  posterPath?: string | null;
  airDate?: string | null;
  year?: string | null;
  voteAverage?: number | null;
};

type SeasonEpisode = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string | null;
  airDate: string | null;
  stillPath: string | null;
  runtime: number | null;
  voteAverage: number | null;
  watchedAt: string | null;
  watched: boolean;
  next: boolean;
};

type MovieOverview = {
  entry: Entry;
  movie: {
    title: string;
    year: string | null;
    overview: string | null;
    tagline: string | null;
    runtime: number | null;
    director: string | null;
    genres: string[];
    voteAverage: number | null;
    releaseDate: string | null;
  };
};

type SeriesOverview = {
  entry: Entry;
  series: {
    title: string;
    year: string | null;
    overview: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    voteAverage: number | null;
    genres: string[];
  };
  progress: {
    seasonNumber: number;
    episodeNumber: number;
  };
  seasons: SeasonSummary[];
};

type SeasonDetail = {
  entry: Entry;
  season: SeasonSummary | null;
  seasons: SeasonSummary[];
  selectedSeason: number;
  progress: {
    seasonNumber: number;
    episodeNumber: number;
  };
  episodes: SeasonEpisode[];
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const cfAccessClientId = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_ID ?? "";
const cfAccessClientSecret = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET ?? "";

const addAccessHeaders = (headers: Headers) => {
  if (cfAccessClientId && cfAccessClientSecret) {
    headers.set("CF-Access-Client-Id", cfAccessClientId);
    headers.set("CF-Access-Client-Secret", cfAccessClientSecret);
  }
};
const profileOrder: ProfileSlug[] = ["juntos", "juan", "cami"];
const listIconOptions = [
  "🍿", "🎬", "📺", "🎞️", "📽️", "🎥", "📼", "📀", "🎭", "🎟️",
  "⭐", "🌟", "✨", "💫", "🔥", "⚡", "💎", "🏆", "🥇", "🎯",
  "❤️", "💘", "💔", "😍", "🥰", "😂", "😭", "😱", "🤯", "😈",
  "🕵️", "🧙", "🧛", "🧟", "🦸", "🦹", "👑", "🤖", "👽", "👻",
  "🐉", "🦖", "🦇", "🐺", "🦊", "🐍", "🦁", "🐯", "🐻", "🐼",
  "🚀", "🛸", "🌌", "🌙", "☀️", "🌊", "❄️", "🧊", "🌋", "🌪️",
  "🏰", "🏙️", "🌃", "🏝️", "🏜️", "⛰️", "🏕️", "🏟️", "🎡", "🚓",
  "🔫", "🗡️", "🛡️", "💣", "🔮", "🪄", "🧪", "🧬", "🕰️", "🧩",
  "📚", "📰", "🔎", "🔐", "📌", "🧠", "🎲", "🎮", "🎧", "🎤",
  "🍕", "🍔", "🍟", "🌮", "🍣", "🍜", "🍩", "🍫", "☕", "🍷"
];

const posterUrl = (path: string | null, size = "w342") => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

const mediaLabel = (mediaType: MediaType) => (mediaType === "tv" ? "Serie" : "Pelicula");

const statusLabel: Record<WatchStatus, string> = {
  watching: "Viendo",
  watched: "Vista",
  paused: "Pausada",
  dropped: "Dejada",
  wishlist: "Quiero ver"
};

const statusIcon: Record<WatchStatus, typeof Bookmark> = {
  watching: Tv,
  watched: CheckCircle2,
  paused: Bookmark,
  dropped: Bookmark,
  wishlist: Bookmark
};

const normalizeSaveProfiles = (slugs: ProfileSlug[]) => {
  const selected = new Set(slugs);
  if (selected.has("juntos") || (selected.has("juan") && selected.has("cami"))) return ["juntos"] satisfies ProfileSlug[];
  return slugs.length ? slugs : (["juntos"] satisfies ProfileSlug[]);
};

const yearForMedia = (media: Pick<Media, "releaseDate" | "firstAirDate"> | SearchResult) => {
  const date = "year" in media && media.year ? media.year : media.releaseDate ?? media.firstAirDate;
  return date ? date.slice(0, 4) : "Sin fecha";
};

const formatDateAr = (value?: string | null) => {
  if (!value) return null;
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
};

const episodeLabel = (entry: Entry) => {
  if (!entry.progress || entry.progress.episodeNumber <= 0) return "Sin progreso";
  const season = entry.progress.seasonNumber === 0 ? "ESP" : `T${entry.progress.seasonNumber}`;
  return `${season} E${entry.progress.episodeNumber}`;
};

const providerTypeLabel: Record<Provider["type"], string> = {
  flatrate: "Ahora en streaming",
  free: "Gratis",
  ads: "Gratis con anuncios",
  rent: "Alquiler",
  buy: "Compra"
};

const initialSeasonForProgress = (progress?: { seasonNumber: number; episodeNumber?: number } | null, seasons: SeasonSummary[] = []) => {
  if (progress && (progress.seasonNumber > 0 || (progress.seasonNumber === 0 && (progress.episodeNumber ?? 0) > 0))) {
    return progress.seasonNumber;
  }
  return seasons.find((season) => season.seasonNumber > 0)?.seasonNumber ?? seasons[0]?.seasonNumber ?? 1;
};

const personalProfileFor = (profileSlug?: ProfileSlug | null): ProfileSlug => profileSlug === "cami" ? "cami" : "juan";

const pairedProfilesFor = (profileSlug?: ProfileSlug | null): ProfileSlug[] => ["juntos", personalProfileFor(profileSlug)];

const detailEntryKey = (entry: Entry) => `${entry.media.id}:${entry.profile.slug}`;

export default function HomePage() {
  const detailRequestKeyRef = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [homeTab, setHomeTab] = useState<"watch" | "wishlist">("watch");
  const [authReady, setAuthReady] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [activeDevEmail, setActiveDevEmail] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileSlug[]>(["juntos", "juan"]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTypeFilter, setSearchTypeFilter] = useState<ProfileMediaFilter>("all");
  const [searching, setSearching] = useState(false);
  const [openingResultKey, setOpeningResultKey] = useState<string | null>(null);
  const [saveDialogResult, setSaveDialogResult] = useState<SearchResult | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);
  const [saveProfiles, setSaveProfiles] = useState<ProfileSlug[]>(["juan"]);
  const [saveStatus, setSaveStatus] = useState<WatchStatus>("wishlist");
  const [saveRating, setSaveRating] = useState<number | null>(null);
  const [saveSeason, setSaveSeason] = useState(1);
  const [saveEpisode, setSaveEpisode] = useState(0);
  const [targetListId, setTargetListId] = useState("");
  const [detailListTargetId, setDetailListTargetId] = useState("");
  const [homeListId, setHomeListId] = useState("");
  const [homeListDetail, setHomeListDetail] = useState<ListDetail | null>(null);
  const [homeListDetails, setHomeListDetails] = useState<ListDetail[]>([]);
  const [homeWishlistProfileFilters, setHomeWishlistProfileFilters] = useState<ProfileSlug[]>(profileOrder);
  const [homeWishlistListFilters, setHomeWishlistListFilters] = useState<string[] | null>(null);
  const [loadingHomeList, setLoadingHomeList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState(listIconOptions[0]);
  const [newListProfile, setNewListProfile] = useState<ProfileSlug>("juntos");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listDetail, setListDetail] = useState<ListDetail | null>(null);
  const [loadingListDetail, setLoadingListDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState(false);
  const [listNameDraft, setListNameDraft] = useState("");
  const [listIconDraft, setListIconDraft] = useState(listIconOptions[0]);
  const [deleteListConfirmOpen, setDeleteListConfirmOpen] = useState(false);
  const [deletingList, setDeletingList] = useState(false);
  const [movingListItemId, setMovingListItemId] = useState<string | null>(null);
  const [recProfile, setRecProfile] = useState<ProfileSlug>("juntos");
  const [recMediaFilter, setRecMediaFilter] = useState<RecommendationMediaFilter>("all");
  const [recRefreshSeed, setRecRefreshSeed] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);
  const [detailListMemberships, setDetailListMemberships] = useState<SavedList[]>([]);
  const [detailUserEntry, setDetailUserEntry] = useState<Entry | null>(null);
  const [seriesOverview, setSeriesOverview] = useState<SeriesOverview | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [movieOverview, setMovieOverview] = useState<MovieOverview | null>(null);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [viewingSeason, setViewingSeason] = useState(false);
  const [detailSeason, setDetailSeason] = useState(1);
  const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [editingProfileEntry, setEditingProfileEntry] = useState<Entry | null>(null);
  const [movingEntry, setMovingEntry] = useState(false);
  const [profileEntries, setProfileEntries] = useState<Entry[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [profileStatusFilters, setProfileStatusFilters] = useState<WatchStatus[]>(["watching"]);
  const [profileMediaFilter, setProfileMediaFilter] = useState<ProfileMediaFilter>("all");
  const [profileRatingFilter, setProfileRatingFilter] = useState(0);
  const [profileSort, setProfileSort] = useState<ProfileSort>("updated_desc");
  const [exportingData, setExportingData] = useState(false);
  const [backingUpData, setBackingUpData] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestApi = async <T,>(path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (activeDevEmail) {
      headers.set("x-dev-user-email", activeDevEmail);
    }
    addAccessHeaders(headers);

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Error inesperado" }));
      throw new Error(payload.error ?? "Error inesperado");
    }

    return response.json() as Promise<T>;
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  };

  const fileDateAr = () => new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date()).replace(/\//g, "-");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportDataJson = async () => {
    setExportingData(true);
    setError(null);

    try {
      const headers = new Headers();
      if (activeDevEmail) {
        headers.set("x-dev-user-email", activeDevEmail);
      }
      addAccessHeaders(headers);

      const response = await fetch(`${apiBase}/export`, {
        headers,
        cache: "no-store"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "No se pudo exportar" }));
        throw new Error(payload.error ?? "No se pudo exportar");
      }

      const blob = await response.blob();
      downloadBlob(blob, `pipiseries-export-${fileDateAr()}.json`);
      showNotice("Exportacion JSON lista");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No se pudo exportar");
    } finally {
      setExportingData(false);
    }
  };

  const backupDataArchive = async () => {
    setBackingUpData(true);
    setError(null);

    try {
      const headers = new Headers();
      if (activeDevEmail) {
        headers.set("x-dev-user-email", activeDevEmail);
      }
      addAccessHeaders(headers);

      const response = await fetch(`${apiBase}/backup`, {
        headers,
        cache: "no-store"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "No se pudo generar el backup" }));
        throw new Error(payload.error ?? "No se pudo generar el backup");
      }

      const blob = await response.blob();
      downloadBlob(blob, `pipiseries-backup-${fileDateAr()}.tar.gz`);
      showNotice("Backup descargado");
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "No se pudo generar el backup");
    } finally {
      setBackingUpData(false);
    }
  };

  const loadDashboard = async (profiles = pairedProfilesFor(me?.user.profileSlug)) => {
    const params = new URLSearchParams({ profiles: profiles.join(",") });
    const data = await requestApi<Dashboard>(`/dashboard?${params.toString()}`);
    setDashboard(data);
  };

  const loadLists = async () => {
    const data = await requestApi<{ lists: SavedList[] }>("/lists");
    setLists(data.lists);
    setHomeListId((current) => current && data.lists.some((list) => list.id === current) ? current : data.lists[0]?.id ?? "");
  };

  const fetchListDetail = (listId: string) => requestApi<ListDetail>(`/lists/${listId}`);

  const loadListDetail = async (listId: string) => {
    setLoadingListDetail(true);
    setListError(null);
    try {
      const data = await fetchListDetail(listId);
      setSelectedListId(listId);
      setListDetail(data);
      setListNameDraft(data.list.name);
      setListIconDraft(data.list.icon ?? listIconOptions[0]);
    } catch (loadError) {
      setListError(loadError instanceof Error ? loadError.message : "No se pudo cargar la lista");
    } finally {
      setLoadingListDetail(false);
    }
  };

  const loadHomeListDetail = async (listId = homeListId) => {
    if (!listId) {
      setHomeListDetail(null);
      return;
    }

    setLoadingHomeList(true);
    try {
      setHomeListDetail(await fetchListDetail(listId));
    } catch {
      setHomeListDetail(null);
    } finally {
      setLoadingHomeList(false);
    }
  };

  const loadHomeListDetails = async (currentLists = lists) => {
    if (currentLists.length === 0) {
      setHomeListDetails([]);
      return;
    }

    setLoadingHomeList(true);
    try {
      const details = await Promise.all(currentLists.map((list) => fetchListDetail(list.id).catch(() => null)));
      setHomeListDetails(details.filter((detail): detail is ListDetail => Boolean(detail)));
    } finally {
      setLoadingHomeList(false);
    }
  };

  const loadDetailListMemberships = async (entry = detailEntry, currentLists = lists) => {
    if (!entry || currentLists.length === 0) {
      setDetailListMemberships([]);
      return;
    }

    const details = await Promise.all(currentLists.map((list) => fetchListDetail(list.id).catch(() => null)));
    setDetailListMemberships(details
      .filter((detail): detail is ListDetail => Boolean(detail))
      .filter((detail) => detail.items.some((item) => item.media.id === entry.media.id))
      .map((detail) => detail.list));
  };

  const currentPersonalProfileSlug = () => personalProfileFor(me?.user.profileSlug);

  const loadDetailUserEntry = async (entry = detailEntry) => {
    if (!entry) {
      setDetailUserEntry(null);
      return null;
    }

    // Miramos el estado para el perfil con el que se abrio el detalle (juntos/
    // juan/cami), no siempre el personal, asi el bookmark refleja lo guardado.
    const data = await requestApi<{ items: Entry[] }>(`/media?profiles=${entry.profile.slug}`);
    const existing = data.items.find((item) => item.media.id === entry.media.id) ?? null;
    setDetailUserEntry(existing);
    return existing;
  };

  const loadProfileCollections = async (profiles = selectedProfiles) => {
    const profileQuery = profiles.join(",");
    const allData = await requestApi<{ items: Entry[] }>(`/media?profiles=${profileQuery}`);
    setProfileEntries(allData.items);
  };

  const loadRecommendations = async (profile = recProfile, mediaFilter = recMediaFilter, seed = recRefreshSeed) => {
    setLoadingRecs(true);
    try {
      const params = new URLSearchParams({
        profileSlug: profile,
        mediaType: mediaFilter,
        seed: String(seed)
      });
      const data = await requestApi<{ results: Recommendation[] }>(`/recommendations?${params.toString()}`);
      setRecommendations(data.results);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadSeriesOverview = async (entry: Entry, options?: { preserveSeason?: boolean }) => {
    const requestKey = detailEntryKey(entry);
    setLoadingSeries(true);
    setSeriesError(null);
    try {
      const params = new URLSearchParams({ profileSlug: entry.profile.slug });
      const data = await requestApi<SeriesOverview>(`/media/${entry.media.id}/series?${params.toString()}`);
      if (detailRequestKeyRef.current !== requestKey) return;
      setSeriesOverview(data);
      setDetailEntry(data.entry);
      // Al refrescar (marcar un episodio, avanzar) no reseteamos la temporada
      // seleccionada: evita el salto de temporada y la pelea con loadSeasonDetail.
      if (!options?.preserveSeason) {
        setDetailSeason(initialSeasonForProgress(data.progress, data.seasons));
      }
    } catch (loadError) {
      if (detailRequestKeyRef.current !== requestKey) return;
      setSeriesOverview(null);
      const message = loadError instanceof Error ? loadError.message : "No se pudo cargar la serie";
      if (message === "Not Found" || message.includes("Route GET")) {
        try {
          const fallbackSeason = initialSeasonForProgress(entry.progress);
          const data = await loadSeasonDetailData(entry, fallbackSeason);
          if (detailRequestKeyRef.current !== requestKey) return;
          setSeasonDetail(data);
          setDetailEntry(data.entry);
          setDetailSeason(data.selectedSeason);
          setViewingSeason(true);
          setSeasonError(null);
          setSeriesError("El backend necesita reiniciarse para mostrar la lista de temporadas. Mientras tanto cargue los capitulos de la temporada actual.");
          return;
        } catch (fallbackError) {
          setSeriesError(fallbackError instanceof Error ? fallbackError.message : message);
          return;
        }
      }
      setSeriesError(message);
    } finally {
      setLoadingSeries(false);
    }
  };

  const loadMovieOverview = async (entry: Entry) => {
    const requestKey = detailEntryKey(entry);
    setLoadingMovie(true);
    try {
      const params = new URLSearchParams({ profileSlug: entry.profile.slug });
      const data = await requestApi<MovieOverview>(`/media/${entry.media.id}/movie?${params.toString()}`);
      if (detailRequestKeyRef.current !== requestKey) return;
      setMovieOverview(data);
      setDetailEntry(data.entry);
    } catch {
      if (detailRequestKeyRef.current !== requestKey) return;
      setMovieOverview(null);
    } finally {
      setLoadingMovie(false);
    }
  };

  const loadSeasonDetail = async (entry: Entry, seasonNumber = detailSeason) => {
    const requestKey = detailEntryKey(entry);
    setLoadingSeason(true);
    setSeasonError(null);
    try {
      const data = await loadSeasonDetailData(entry, seasonNumber);
      if (detailRequestKeyRef.current !== requestKey) return;
      setSeasonDetail(data);
      setDetailEntry(data.entry);
      setDetailSeason(data.selectedSeason);
    } catch (loadError) {
      if (detailRequestKeyRef.current !== requestKey) return;
      setSeasonDetail(null);
      setSeasonError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los capitulos");
    } finally {
      setLoadingSeason(false);
    }
  };

  const loadSeasonDetailData = async (entry: Entry, seasonNumber = detailSeason) => {
    const params = new URLSearchParams({
      profileSlug: entry.profile.slug,
      seasonNumber: String(seasonNumber)
    });
    return requestApi<SeasonDetail>(`/media/${entry.media.id}/season?${params.toString()}`);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const headers = new Headers();
        addAccessHeaders(headers);
        const response = await fetch(`${apiBase}/dev-auth/users`, { headers, cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { users: DevUser[] };
          setDevUsers(data.users);
          const stored = window.localStorage.getItem("pipiseries.devEmail");
          setActiveDevEmail(stored || data.users[0]?.email || null);
        }
      } finally {
        setAuthReady(true);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const loadMe = async () => {
      try {
        setError(null);
        const data = await requestApi<MeResponse>("/me");
        setMe(data);
        setSelectedProfiles(pairedProfilesFor(data.user.profileSlug));
        setSaveProfiles([data.user.profileSlug]);
        setRecProfile(data.user.profileSlug);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo iniciar sesion");
      }
    };

    void loadMe();
  }, [authReady, activeDevEmail]);

  useEffect(() => {
    if (!me) return;

    const refresh = async () => {
      try {
        setError(null);
        await Promise.all([loadDashboard(), loadLists(), loadRecommendations(), loadProfileCollections()]);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "No se pudo cargar la app");
      }
    };

    void refresh();
  }, [me, selectedProfiles.join(","), recProfile, recMediaFilter, recRefreshSeed]);

  const handleDevUserChange = (email: string) => {
    setActiveDevEmail(email);
    window.localStorage.setItem("pipiseries.devEmail", email);
  };

  const toggleProfileFilter = (slug: ProfileSlug) => {
    setSelectedProfiles((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug];
      if (next.includes("juan") && next.includes("cami")) return ["juntos"];
      return next.length ? profileOrder.filter((item) => next.includes(item)) : [activePersonalSlug];
    });
  };

  const toggleHomeWishlistProfileFilter = (slug: ProfileSlug) => {
    setHomeWishlistProfileFilters((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug];
      return profileOrder.filter((item) => next.includes(item));
    });
  };

  const toggleHomeWishlistListFilter = (listId: string) => {
    setHomeWishlistListFilters((current) => {
      const allIds = lists.map((list) => list.id);
      const selected = current ?? allIds;
      const next = selected.includes(listId)
        ? selected.filter((item) => item !== listId)
        : [...selected, listId];
      return allIds.filter((item) => next.includes(item));
    });
  };

  const selectAllHomeWishlistLists = () => {
    setHomeWishlistListFilters(null);
  };

  const toggleProfileStatusFilter = (status: WatchStatus) => {
    setProfileStatusFilters((current) => {
      const next = current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status];
      return next.length ? next : [status];
    });
  };

  const toggleSaveProfile = (slug: ProfileSlug) => {
    setSaveProfiles((current) => {
      if (slug === "juntos") return ["juntos"];
      const withoutShared = current.filter((item) => item !== "juntos");
      const next: ProfileSlug[] = withoutShared.includes(slug)
        ? withoutShared.filter((item) => item !== slug)
        : [...withoutShared, slug];
      return next.length ? profileOrder.filter((item) => next.includes(item)) : [slug];
    });
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        query: query.trim(),
        profiles: pairedProfilesFor(me?.user.profileSlug).join(",")
      });
      const data = await requestApi<{ results: SearchResult[] }>(`/search?${params.toString()}`);
      setSearchResults(data.results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar");
    } finally {
      setSearching(false);
    }
  };

  const saveMedia = async (result: SearchResult, status = saveStatus) => {
    const profiles = normalizeSaveProfiles(saveProfiles);
    const shouldSaveProgress = result.mediaType === "tv" && status === "watching";
    await requestApi("/media", {
      method: "POST",
      body: JSON.stringify({
        tmdbId: result.tmdbId,
        mediaType: result.mediaType,
        profileSlugs: profiles,
        status,
        rating: saveRating,
        seasonNumber: shouldSaveProgress ? saveSeason : undefined,
        episodeNumber: shouldSaveProgress ? saveEpisode : undefined,
        listId: targetListId || undefined
      })
    });
    showNotice(`${result.title} guardada para ${profiles.map((slug) => profileName(slug)).join(", ")}`);
    setSearchResults((current) => current.map((item) => (
      item.tmdbId === result.tmdbId && item.mediaType === result.mediaType
        ? {
          ...item,
          saved: {
            status,
            profileSlug: profiles[0],
            profileName: profileName(profiles[0]),
            rating: saveRating
          }
        }
        : item
    )));
    await Promise.all([
      loadDashboard(),
      loadLists(),
      loadRecommendations(),
      loadProfileCollections(),
      selectedListId ? loadListDetail(selectedListId) : Promise.resolve(),
      (targetListId && targetListId === homeListId) ? loadHomeListDetail(targetListId) : Promise.resolve()
    ]);
  };

  const openSaveDialog = (result: SearchResult, preferredStatus = saveStatus) => {
    setSaveDialogResult(result);
    setSaveStatus(result.saved?.status ?? preferredStatus);
    setSaveProfiles(result.saved ? [result.saved.profileSlug] : [me?.user.profileSlug ?? "juan"]);
    setSaveRating(result.saved?.rating ?? null);
    setSaveSeason(1);
    setSaveEpisode(0);
  };

  const closeSaveDialog = () => {
    if (savingMedia) return;
    setSaveDialogResult(null);
  };

  const confirmSaveDialog = async () => {
    if (!saveDialogResult) return;

    setSavingMedia(true);
    setError(null);
    try {
      await saveMedia(saveDialogResult, saveStatus);
      setSaveDialogResult(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSavingMedia(false);
    }
  };

  const createList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newListName.trim()) return;

    const created = await requestApi<{ id: string }>("/lists", {
      method: "POST",
      body: JSON.stringify({
        name: newListName.trim(),
        icon: newListIcon,
        profileSlug: newListProfile,
        visibility: newListProfile === "juntos" ? "shared" : "personal"
      })
    });
    setNewListName("");
    setNewListIcon(listIconOptions[0]);
    setTargetListId(created.id);
    setDetailListTargetId(created.id);
    await loadLists();
    await loadListDetail(created.id);
    showNotice("Lista creada");
  };

  const addDetailEntryToList = async () => {
    if (!detailEntry) return;
    const listId = detailListTargetId || lists[0]?.id;

    if (!listId) {
      showNotice("Primero crea una lista");
      return;
    }

    await requestApi(`/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ mediaItemId: detailEntry.media.id })
    });
    setDetailListTargetId(listId);
    await Promise.all([
      loadLists(),
      selectedListId === listId ? loadListDetail(listId) : Promise.resolve(),
      homeListId === listId ? loadHomeListDetail(listId) : Promise.resolve(),
      loadDetailListMemberships()
    ]);
    showNotice("Agregado a la lista");
  };

  const updateListName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listDetail || !listNameDraft.trim()) return;

    await requestApi(`/lists/${listDetail.list.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: listNameDraft.trim(), icon: listIconDraft })
    });
    setEditingListName(false);
    await Promise.all([loadLists(), loadListDetail(listDetail.list.id)]);
    showNotice("Lista renombrada");
  };

  const deleteSelectedList = async () => {
    if (!listDetail) return;
    setDeletingList(true);
    setError(null);
    try {
      await requestApi(`/lists/${listDetail.list.id}`, { method: "DELETE" });
      closeListDetail();
      await Promise.all([
        loadLists(),
        homeListId === listDetail.list.id ? loadHomeListDetail("") : Promise.resolve()
      ]);
      showNotice("Lista eliminada");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la lista");
    } finally {
      setDeletingList(false);
    }
  };

  const moveListItem = async (mediaId: string, targetListId: string) => {
    if (!listDetail || !targetListId || targetListId === listDetail.list.id) return;

    setMovingListItemId(mediaId);
    try {
      await requestApi(`/lists/${listDetail.list.id}/items/${mediaId}/move`, {
        method: "POST",
        body: JSON.stringify({ targetListId })
      });
      await Promise.all([
        loadLists(),
        loadListDetail(listDetail.list.id),
        homeListId === listDetail.list.id || homeListId === targetListId ? loadHomeListDetail(homeListId) : Promise.resolve()
      ]);
      showNotice("Item movido");
    } finally {
      setMovingListItemId(null);
    }
  };

  const removeListItem = async (mediaId: string) => {
    if (!listDetail) return;

    await requestApi(`/lists/${listDetail.list.id}/items/${mediaId}`, { method: "DELETE" });
    await Promise.all([
      loadLists(),
      loadListDetail(listDetail.list.id),
      homeListId === listDetail.list.id ? loadHomeListDetail(listDetail.list.id) : Promise.resolve()
    ]);
    showNotice("Item quitado de la lista");
  };

  const removeHomeListItem = async (mediaId: string, listId = homeListId) => {
    if (!listId) return;

    await requestApi(`/lists/${listId}/items/${mediaId}`, { method: "DELETE" });
    await Promise.all([loadLists(), loadHomeListDetails(lists), homeListId === listId ? loadHomeListDetail(listId) : Promise.resolve()]);
    showNotice("Item quitado de la lista");
  };

  const updateEntry = async (entry: Entry, patch: Partial<{ status: WatchStatus; rating: number | null; seasonNumber: number; episodeNumber: number }>) => {
    const shouldUpdateProgress = patch.seasonNumber !== undefined || patch.episodeNumber !== undefined;
    const body: {
      profileSlugs: ProfileSlug[];
      status: WatchStatus;
      rating: number | null;
      seasonNumber?: number;
      episodeNumber?: number;
    } = {
      profileSlugs: [entry.profile.slug],
      status: patch.status ?? entry.status,
      rating: patch.rating === undefined ? entry.rating : patch.rating
    };

    if (shouldUpdateProgress) {
      body.seasonNumber = patch.seasonNumber ?? entry.progress?.seasonNumber ?? 0;
      body.episodeNumber = patch.episodeNumber ?? entry.progress?.episodeNumber ?? 0;
    }

    await requestApi(`/media/${entry.media.id}/entry`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    await Promise.all([loadDashboard(), loadProfileCollections()]);
    if (detailEntry?.media.id === entry.media.id && detailEntry.profile.slug === entry.profile.slug) {
      await loadSeriesOverview(entry, { preserveSeason: true });
      if (viewingSeason) {
        await loadSeasonDetail(entry, detailSeason);
      }
    }
    await loadDetailUserEntry(entry);
  };

  // Fija/desfija una serie en Inicio para que muestre su siguiente capitulo
  // aparte del slot "default" (el mas reciente sin fijar).
  const togglePin = async (entry: Entry) => {
    await requestApi(`/media/${entry.media.id}/pin`, {
      method: "PUT",
      body: JSON.stringify({ profileSlug: entry.profile.slug, pinned: !entry.pinned })
    });
    await Promise.all([loadDashboard(), loadProfileCollections()]);
  };

  // Marca como visto el episodio mostrado (avanza el progreso). Solo marca la
  // serie completa como `watched` cuando ya no queda un proximo episodio.
  const markEntryEpisodeWatched = (entry: Entry, next?: { seasonNumber: number; episodeNumber: number } | null) => {
    if (next) {
      return updateEntry(entry, { status: "watching", seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber });
    }
    return updateEntry(entry, { status: "watched" });
  };

  const deleteEntry = async (entry: Entry) => {
    const params = new URLSearchParams({ profileSlug: entry.profile.slug });
    await requestApi(`/media/${entry.media.id}/entry?${params.toString()}`, { method: "DELETE" });
    await Promise.all([loadDashboard(), loadProfileCollections()]);
    showNotice(`${entry.media.title} eliminado de ${entry.profile.name}`);
  };

  const openEntryProfileEditor = (entry: Entry) => {
    setEditingProfileEntry(entry);
    setSaveProfiles([entry.profile.slug]);
  };

  const closeEntryProfileEditor = () => {
    if (movingEntry) return;
    setEditingProfileEntry(null);
  };

  const moveEntryToSelectedProfiles = async () => {
    if (!editingProfileEntry) return;

    const nextProfiles = normalizeSaveProfiles(saveProfiles);
    const nextProfile = nextProfiles[0];

    if (nextProfile === editingProfileEntry.profile.slug) {
      setEditingProfileEntry(null);
      return;
    }

    setMovingEntry(true);
    setError(null);
    try {
      const deleteParams = new URLSearchParams({ profileSlug: editingProfileEntry.profile.slug });
      await requestApi(`/media/${editingProfileEntry.media.id}/entry?${deleteParams.toString()}`, { method: "DELETE" });
      await requestApi(`/media/${editingProfileEntry.media.id}/entry`, {
        method: "POST",
        body: JSON.stringify({
          profileSlugs: nextProfiles,
          status: editingProfileEntry.status,
          rating: editingProfileEntry.rating,
          seasonNumber: editingProfileEntry.progress?.seasonNumber,
          episodeNumber: editingProfileEntry.progress?.episodeNumber
        })
      });

      if (detailEntry?.media.id === editingProfileEntry.media.id && detailEntry.profile.slug === editingProfileEntry.profile.slug) {
        detailRequestKeyRef.current = `${detailEntry.media.id}:${nextProfile}`;
        setDetailEntry({
          ...detailEntry,
          profile: {
            ...detailEntry.profile,
            slug: nextProfile,
            name: profileName(nextProfile)
          }
        });
      }

      setEditingProfileEntry(null);
      showNotice(`${editingProfileEntry.media.title} ahora la ve ${profileName(nextProfile)}`);
      await Promise.all([
        loadDashboard(),
        loadProfileCollections(),
        selectedListId ? loadListDetail(selectedListId) : Promise.resolve(),
        homeListId ? loadHomeListDetail(homeListId) : Promise.resolve()
      ]);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "No se pudo cambiar quien la ve");
    } finally {
      setMovingEntry(false);
    }
  };

  const openEntryDetail = (entry: Entry) => {
    detailRequestKeyRef.current = detailEntryKey(entry);
    setDetailEntry(entry);
    setDetailSeason(initialSeasonForProgress(entry.progress));
    setSeriesOverview(null);
    setMovieOverview(null);
    setSeasonDetail(null);
    setDetailListMemberships([]);
    setDetailUserEntry(null);
    setViewingSeason(false);
    setSeriesError(null);
    setSeasonError(null);
  };

  const openResultDetail = async (result: SearchResult, fallbackProfile: ProfileSlug) => {
    const resultKey = `${result.mediaType}-${result.tmdbId}`;
    setOpeningResultKey(resultKey);
    setError(null);
    try {
      const params = new URLSearchParams({
        tmdbId: String(result.tmdbId),
        mediaType: result.mediaType,
        profileSlug: result.saved?.profileSlug ?? fallbackProfile
      });
      const data = await requestApi<{ entry: Entry }>(`/media/preview?${params.toString()}`);
      openEntryDetail(data.entry);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "No se pudo abrir el detalle");
    } finally {
      setOpeningResultKey(null);
    }
  };

  const openSeasonDetail = (seasonNumber: number) => {
    setDetailSeason(seasonNumber);
    setSeasonDetail(null);
    setSeasonError(null);
    setViewingSeason(true);
  };

  const seasonsForProgress = () => seasonDetail?.seasons ?? seriesOverview?.seasons ?? [];

  const previousProgressForEpisode = (episode: SeasonEpisode) => {
    if (episode.episodeNumber > 1) {
      return {
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber - 1
      };
    }

    const previousSeason = seasonsForProgress()
      .filter((season) => season.seasonNumber > 0 && season.seasonNumber < episode.seasonNumber && season.episodeCount > 0)
      .sort((a, b) => b.seasonNumber - a.seasonNumber)[0];

    return previousSeason ? {
      seasonNumber: previousSeason.seasonNumber,
      episodeNumber: previousSeason.episodeCount
    } : {
      seasonNumber: 0,
      episodeNumber: 0
    };
  };

  const isLastKnownEpisode = (episode: SeasonEpisode) => {
    const lastSeason = seasonsForProgress()
      .filter((season) => season.seasonNumber > 0 && season.episodeCount > 0)
      .sort((a, b) => b.seasonNumber - a.seasonNumber)[0];

    return Boolean(lastSeason && episode.seasonNumber === lastSeason.seasonNumber && episode.episodeNumber >= lastSeason.episodeCount);
  };

  const markEpisodeWatched = async (episode: SeasonEpisode) => {
    if (!detailEntry) return;
    const nextProgress = episode.watched ? previousProgressForEpisode(episode) : {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber
    };
    const nextStatus: WatchStatus = episode.watched ? "watching" : isLastKnownEpisode(episode) ? "watched" : "watching";

    try {
      await requestApi(`/media/${detailEntry.media.id}/entry`, {
        method: "POST",
        body: JSON.stringify({
          profileSlugs: [detailEntry.profile.slug],
          status: nextStatus,
          rating: detailEntry.rating,
          seasonNumber: nextProgress.seasonNumber,
          episodeNumber: nextProgress.episodeNumber
        })
      });
      showNotice(episode.watched ? "Capitulo desmarcado" : `Marcado hasta T${episode.seasonNumber} E${episode.episodeNumber}`);
      await Promise.all([
        loadDashboard(),
        loadProfileCollections(),
        loadSeriesOverview(detailEntry, { preserveSeason: true }),
        loadSeasonDetail(detailEntry, episode.seasonNumber),
        loadDetailUserEntry(detailEntry)
      ]);
    } catch (markError) {
      setSeasonError(markError instanceof Error ? markError.message : "No se pudo marcar el episodio");
    }
  };

  const addDetailToWishlist = async (profileSlug: ProfileSlug) => {
    if (!detailEntry) return;

    const targetProfileName = profileName(profileSlug);
    // Chequeamos el estado de ESE perfil puntual para no pisar un watching/watched.
    const data = await requestApi<{ items: Entry[] }>(`/media?profiles=${profileSlug}`);
    const existing = data.items.find((item) => item.media.id === detailEntry.media.id) ?? null;

    if (existing) {
      showNotice(existing.status === "wishlist"
        ? `Ya esta en Quiero ver ${targetProfileName}`
        : `Ya esta en ${statusLabel[existing.status]} ${targetProfileName}`);
      return;
    }

    await requestApi(`/media/${detailEntry.media.id}/entry`, {
      method: "POST",
      body: JSON.stringify({
        profileSlugs: [profileSlug],
        status: "wishlist",
        rating: null
      })
    });
    showNotice(`Agregada a Quiero ver ${targetProfileName}`);
    await Promise.all([loadDashboard(), loadProfileCollections(), loadSeriesOverview(detailEntry, { preserveSeason: true }), loadDetailUserEntry(detailEntry)]);
  };

  const removeDetailFromCurrentWishlist = async () => {
    if (!detailEntry) return;

    const targetProfileSlug = detailEntry.profile.slug;
    const targetProfileName = detailEntry.profile.name;
    const existing = await loadDetailUserEntry(detailEntry);

    if (!existing || existing.status !== "wishlist") {
      showNotice(existing ? `Esta en ${statusLabel[existing.status]} ${targetProfileName}` : `No esta en Quiero ver ${targetProfileName}`);
      return;
    }

    const params = new URLSearchParams({ profileSlug: targetProfileSlug });
    await requestApi(`/media/${detailEntry.media.id}/entry?${params.toString()}`, { method: "DELETE" });
    setDetailUserEntry(null);
    showNotice(`Quitada de Quiero ver ${targetProfileName}`);
    await Promise.all([loadDashboard(), loadProfileCollections(), loadDetailUserEntry(detailEntry)]);
  };

  useEffect(() => {
    if (!detailEntry || detailEntry.media.mediaType !== "tv") return;

    void loadSeriesOverview(detailEntry);
  }, [detailEntry?.media.id, detailEntry?.profile.slug, detailEntry?.media.mediaType, activeDevEmail]);

  useEffect(() => {
    if (!detailEntry || detailEntry.media.mediaType !== "movie") return;

    void loadMovieOverview(detailEntry);
  }, [detailEntry?.media.id, detailEntry?.profile.slug, detailEntry?.media.mediaType, activeDevEmail]);

  useEffect(() => {
    if (!detailEntry || !viewingSeason) return;

    void loadSeasonDetail(detailEntry, detailSeason);
  }, [detailEntry?.media.id, detailEntry?.profile.slug, detailSeason, activeDevEmail, viewingSeason]);

  useEffect(() => {
    if (!selectedListId || tab !== "lists") return;

    void loadListDetail(selectedListId);
  }, [activeDevEmail]);

  useEffect(() => {
    void loadHomeListDetails(lists);
  }, [lists.map((list) => `${list.id}:${list.name}:${list.icon ?? ""}:${list.itemCount}`).join(","), activeDevEmail]);

  useEffect(() => {
    void loadDetailListMemberships();
  }, [detailEntry?.media.id, lists.map((list) => list.id).join(","), activeDevEmail]);

  useEffect(() => {
    void loadDetailUserEntry();
  }, [detailEntry?.media.id, me?.user.profileSlug, activeDevEmail]);

  const profileName = (slug: ProfileSlug) => me?.profiles.find((profile) => profile.slug === slug)?.name ?? slug;
  const saveWillBecomeJuntos = saveProfiles.includes("juan") && saveProfiles.includes("cami");
  const activePersonalSlug = currentPersonalProfileSlug();
  const personalWatching = dashboard?.watching.filter((entry) => entry.profile.slug === activePersonalSlug) ?? [];
  const sharedWatching = dashboard?.watching.filter((entry) => entry.profile.slug === "juntos") ?? [];
  // Siguiente capitulo: primero las fijadas (pinned) y luego un unico slot
  // "default" (la mas reciente que NO este fijada, para no duplicar).
  const nextChapterList = (list: Entry[]) => {
    const pinned = list.filter((entry) => entry.pinned);
    const auto = list.filter((entry) => !entry.pinned).slice(0, 1);
    return [...pinned, ...auto];
  };
  const personalNextChapters = nextChapterList(personalWatching);
  const sharedNextChapters = nextChapterList(sharedWatching);
  const personalNewEpisodes = dashboard?.newEpisodes.filter((entry) => entry.profile.slug === activePersonalSlug) ?? [];
  const sharedNewEpisodes = dashboard?.newEpisodes.filter((entry) => entry.profile.slug === "juntos") ?? [];
  const activeHomeWishlistListIds = homeWishlistListFilters ?? lists.map((list) => list.id);
  const homeWishlistSourceEntries = (dashboard?.wishlist ?? [])
    .filter((entry) => homeWishlistProfileFilters.includes(entry.profile.slug));
  const homeWishlistItemsMap = homeWishlistSourceEntries.reduce((grouped, entry) => {
    grouped.set(entry.media.id, {
      media: entry.media,
      entry,
      lists: [],
      hasWishlistStatus: true
    });
    return grouped;
  }, new Map<string, HomeWishlistItem>());
  const homeWishlistItems = Array.from(homeListDetails.reduce((grouped, detail) => {
    if (!activeHomeWishlistListIds.includes(detail.list.id)) return grouped;
    if (detail.list.profileSlug && !homeWishlistProfileFilters.includes(detail.list.profileSlug)) return grouped;

    detail.items.forEach((item) => {
      const current = grouped.get(item.media.id);
      if (!current) {
        grouped.set(item.media.id, {
          media: item.media,
          entry: item.entry,
          lists: [detail.list],
          hasWishlistStatus: false
        });
        return;
      }

      current.lists.push(detail.list);
      if (item.entry && (!current.entry || item.entry.status === "watching" || (current.entry.status === "wishlist" && item.entry.status !== "wishlist"))) {
        current.entry = item.entry;
      }
    });

    return grouped;
  }, homeWishlistItemsMap).values());
  const activeEntryMediaIds = new Set(profileEntries
    .filter((entry) => entry.status !== "wishlist")
    .map((entry) => entry.media.id));
  const profileSearchTerm = profileSearch.trim().toLowerCase();
  const filteredProfileEntries = profileEntries.filter((entry) => {
    if (entry.status === "wishlist" && activeEntryMediaIds.has(entry.media.id)) {
      return false;
    }

    const matchesSearch = !profileSearchTerm || [
      entry.media.title,
      entry.media.overview ?? "",
      entry.profile.name
    ].some((value) => value.toLowerCase().includes(profileSearchTerm));
    const matchesStatus = profileStatusFilters.includes(entry.status);
    const matchesMedia = profileMediaFilter === "all" || entry.media.mediaType === profileMediaFilter;
    const matchesRating = profileRatingFilter === 0 || (entry.rating ?? 0) >= profileRatingFilter;

    return matchesSearch && matchesStatus && matchesMedia && matchesRating;
  }).sort((a, b) => {
    if (profileSort === "name_asc") return a.media.title.localeCompare(b.media.title, "es");
    if (profileSort === "name_desc") return b.media.title.localeCompare(a.media.title, "es");
    if (profileSort === "added_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (profileSort === "watched_desc") return new Date(b.watchedAt ?? b.updatedAt).getTime() - new Date(a.watchedAt ?? a.updatedAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const closeDetail = () => {
    detailRequestKeyRef.current = null;
    setDetailEntry(null);
    setSeriesOverview(null);
    setMovieOverview(null);
    setSeasonDetail(null);
    setDetailListMemberships([]);
    setViewingSeason(false);
    setSeriesError(null);
    setSeasonError(null);
  };

  const closeListDetail = () => {
    setSelectedListId(null);
    setListDetail(null);
    setListError(null);
    setEditingListName(false);
    setListNameDraft("");
    setDeleteListConfirmOpen(false);
  };

  const navigateTab = (nextTab: Tab) => {
    closeDetail();
    closeListDetail();
    setTab(nextTab);
  };

  if (error && !me) {
    return (
      <main className="auth-error">
        <Clapperboard size={40} />
        <h1>PipiSeries</h1>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img className="brand-logo" src="/brand-logo.png" alt="PipiSeries" />
        </div>
        {devUsers.length > 0 && (
          <label className="dev-switch">
            <UserRound size={16} />
            <select value={activeDevEmail ?? ""} onChange={(event) => handleDevUserChange(event.target.value)}>
              {devUsers.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {notice && <div className="toast">{notice}</div>}
      {error && <div className="inline-error">{error}</div>}

      {detailEntry && (
        <SeriesDetail
          entry={detailEntry}
          overview={seriesOverview}
          movie={movieOverview?.movie ?? null}
          detail={seasonDetail}
          selectedSeason={detailSeason}
          viewingSeason={viewingSeason}
          loadingSeries={loadingSeries}
          loadingMovie={loadingMovie}
          loadingSeason={loadingSeason}
          seriesError={seriesError}
          seasonError={seasonError}
          lists={lists}
          listTargetId={detailListTargetId}
          listMemberships={detailListMemberships}
          onBack={() => {
            if (viewingSeason) {
              setViewingSeason(false);
              setSeasonDetail(null);
              setSeasonError(null);
              return;
            }
            closeDetail();
          }}
          onSeasonChange={setDetailSeason}
          onSeasonOpen={openSeasonDetail}
          onRetrySeries={() => loadSeriesOverview(detailEntry)}
          onRetrySeason={() => loadSeasonDetail(detailEntry, detailSeason)}
          onEpisodeWatched={markEpisodeWatched}
          onListTargetChange={setDetailListTargetId}
          onAddToList={addDetailEntryToList}
          onAddToWishlist={addDetailToWishlist}
          onRemoveFromWishlist={removeDetailFromCurrentWishlist}
          onEditProfile={() => openEntryProfileEditor(detailEntry)}
          onRating={(rating) => updateEntry(detailEntry, { rating })}
          onMarkWatched={() => updateEntry(detailEntry, { status: "watched" })}
          wishlistProfileName={detailEntry.profile.name}
          wishlistProfiles={profileOrder.map((slug) => ({ slug, name: profileName(slug) }))}
          wishlistEntryStatus={detailUserEntry?.status ?? null}
        />
      )}

      {!detailEntry && tab === "home" && (
        <section className="screen">
          <section className="watch-tabs">
            <button className={homeTab === "watch" ? "active" : ""} type="button" onClick={() => setHomeTab("watch")}>Viendo</button>
            <button className={homeTab === "wishlist" ? "active" : ""} type="button" onClick={() => setHomeTab("wishlist")}>Quiero ver</button>
            <button className="icon-tab" type="button" onClick={() => setTab("search")} aria-label="Ver posters">
              <Grid2X2 size={16} />
            </button>
          </section>

          {homeTab === "watch" && (
            <>
              <section className="hero-strip compact-stats">
                <div>
                  <span>Viendo ahora</span>
                  <strong>{dashboard?.watching.length ?? 0}</strong>
                </div>
                <div>
                  <span>Episodios nuevos</span>
                  <strong>{dashboard?.newEpisodes.length ?? 0}</strong>
                </div>
              </section>

              <ContentRail title={`Siguiente capitulo ${profileName(activePersonalSlug)}`} empty={`Todavia no hay series en curso para ${profileName(activePersonalSlug)}.`}>
                {personalNextChapters.map((entry) => (
                  <EntryCard
                    key={entry.entryId}
                    entry={entry}
                    emphasizeNext
                    pinned={entry.pinned}
                    onOpen={() => openEntryDetail(entry)}
                    onEditProfile={() => openEntryProfileEditor(entry)}
                    onTogglePin={() => togglePin(entry)}
                    onAdvance={() => updateEntry(entry, {
                      status: "watching",
                      seasonNumber: entry.episodeInfo?.nextEpisode?.seasonNumber ?? initialSeasonForProgress(entry.progress),
                      episodeNumber: entry.episodeInfo?.nextEpisode?.episodeNumber ?? (entry.progress?.episodeNumber ?? 0) + 1
                    })}
                    onMarkWatched={() => markEntryEpisodeWatched(entry, entry.episodeInfo?.nextEpisode)}
                  />
                ))}
              </ContentRail>

              <ContentRail title="Siguiente capitulo Juntos" empty="Todavia no hay series en curso para ver juntos.">
                {sharedNextChapters.map((entry) => (
                  <EntryCard
                    key={entry.entryId}
                    entry={entry}
                    emphasizeNext
                    pinned={entry.pinned}
                    onOpen={() => openEntryDetail(entry)}
                    onEditProfile={() => openEntryProfileEditor(entry)}
                    onTogglePin={() => togglePin(entry)}
                    onAdvance={() => updateEntry(entry, {
                      status: "watching",
                      seasonNumber: entry.episodeInfo?.nextEpisode?.seasonNumber ?? initialSeasonForProgress(entry.progress),
                      episodeNumber: entry.episodeInfo?.nextEpisode?.episodeNumber ?? (entry.progress?.episodeNumber ?? 0) + 1
                    })}
                    onMarkWatched={() => markEntryEpisodeWatched(entry, entry.episodeInfo?.nextEpisode)}
                  />
                ))}
              </ContentRail>

              <ContentRail title={`Capitulos nuevos ${profileName(activePersonalSlug)}`} empty={`Cuando haya capitulos nuevos para ${profileName(activePersonalSlug)}, van a aparecer aca.`}>
                {personalNewEpisodes.map((entry) => (
                  <EntryCard
                    key={`${entry.entryId}-new`}
                    entry={entry}
                    compact
                    onOpen={() => openEntryDetail(entry)}
                    onEditProfile={() => openEntryProfileEditor(entry)}
                    onAdvance={() => updateEntry(entry, {
                      status: "watching",
                      seasonNumber: entry.episodeInfo?.lastEpisodeToAir?.seasonNumber ?? entry.progress?.seasonNumber ?? 1,
                      episodeNumber: entry.episodeInfo?.lastEpisodeToAir?.episodeNumber ?? (entry.progress?.episodeNumber ?? 0) + 1
                    })}
                    onMarkWatched={() => markEntryEpisodeWatched(entry, entry.episodeInfo?.lastEpisodeToAir)}
                  />
                ))}
              </ContentRail>

              <ContentRail title="Capitulos nuevos Juntos" empty="Cuando haya capitulos nuevos para ver juntos, van a aparecer aca.">
                {sharedNewEpisodes.map((entry) => (
                  <EntryCard
                    key={`${entry.entryId}-shared-new`}
                    entry={entry}
                    compact
                    onOpen={() => openEntryDetail(entry)}
                    onEditProfile={() => openEntryProfileEditor(entry)}
                    onAdvance={() => updateEntry(entry, {
                      status: "watching",
                      seasonNumber: entry.episodeInfo?.lastEpisodeToAir?.seasonNumber ?? entry.progress?.seasonNumber ?? 1,
                      episodeNumber: entry.episodeInfo?.lastEpisodeToAir?.episodeNumber ?? (entry.progress?.episodeNumber ?? 0) + 1
                    })}
                    onMarkWatched={() => markEntryEpisodeWatched(entry, entry.episodeInfo?.lastEpisodeToAir)}
                  />
                ))}
              </ContentRail>
            </>
          )}

          {homeTab === "wishlist" && (
            <section className="content-rail configurable-rail">
              <div className="wishlist-filter-panel">
                <MultiFilterChips
                  title="Ver"
                  options={profileOrder.map((slug) => ({ id: slug, label: profileName(slug), icon: slug === "juntos" ? <Users size={14} /> : <UserRound size={14} /> }))}
                  selected={homeWishlistProfileFilters}
                  onToggle={(id) => toggleHomeWishlistProfileFilter(id as ProfileSlug)}
                />
                <ListFilterDropdown
                  lists={lists}
                  selected={activeHomeWishlistListIds}
                  onToggle={toggleHomeWishlistListFilter}
                  onSelectAll={selectAllHomeWishlistLists}
                />
              </div>
              {loadingHomeList && <div className="loading-line"><Loader2 className="spin" size={18} /> Cargando listas</div>}
              {!loadingHomeList && lists.length === 0 && homeWishlistItems.length === 0 && <EmptyState title="Todavia no hay nada en Quiero ver" />}
              {!loadingHomeList && lists.length > 0 && homeWishlistItems.length === 0 && <EmptyState title="No hay items para esos filtros" />}
              {!loadingHomeList && homeWishlistItems.length > 0 && (
                <div className="rail-items">
                  {homeWishlistItems.map((item) => (
                    <HomeWishlistCard
                      key={item.media.id}
                      item={item}
                      onOpen={() => item.entry ? openEntryDetail(item.entry) : undefined}
                      onEditProfile={() => item.entry ? openEntryProfileEditor(item.entry) : undefined}
                      onRemove={(listId) => removeHomeListItem(item.media.id, listId)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      )}

      {!detailEntry && tab === "search" && (
        <section className="screen">
          <form className="search-box" onSubmit={handleSearch}>
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar serie o pelicula" />
            <button type="submit" aria-label="Buscar">
              {searching ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            </button>
          </form>

          <div className="segmented compact-segmented">
            {([["all", "Todo"], ["tv", "Series"], ["movie", "Peliculas"]] as [ProfileMediaFilter, string][]).map(([value, label]) => (
              <button key={value} className={searchTypeFilter === value ? "active" : ""} type="button" onClick={() => setSearchTypeFilter(value)}>
                {label}
              </button>
            ))}
          </div>

          <p className="helper search-helper">Al guardar te voy a preguntar quien la ve, y despues tambien lo podes cambiar.</p>

          <div className="result-list poster-grid">
            {searchResults
              .filter((result) => searchTypeFilter === "all" || result.mediaType === searchTypeFilter)
              .map((result) => (
                <SearchCard
                  key={`${result.mediaType}-${result.tmdbId}`}
                  result={result}
                  opening={openingResultKey === `${result.mediaType}-${result.tmdbId}`}
                  onOpen={() => openResultDetail(result, me?.user.profileSlug ?? "juan")}
                  onSave={() => openSaveDialog(result, result.saved?.status ?? "wishlist")}
                />
              ))}
            {searchResults.length > 0 && searchResults.every((result) => searchTypeFilter !== "all" && result.mediaType !== searchTypeFilter) && (
              <EmptyState title={`No hay ${searchTypeFilter === "tv" ? "series" : "peliculas"} en estos resultados`} />
            )}
          </div>
        </section>
      )}

      {!detailEntry && tab === "lists" && selectedListId && (
        <ListDetailScreen
          detail={listDetail}
          lists={lists}
          loading={loadingListDetail}
          error={listError}
          editingName={editingListName}
          nameDraft={listNameDraft}
          movingItemId={movingListItemId}
          onBack={closeListDetail}
          onEditName={() => setEditingListName(true)}
          onDeleteList={() => setDeleteListConfirmOpen(true)}
          onCancelEdit={() => {
            setEditingListName(false);
            setListNameDraft(listDetail?.list.name ?? "");
            setListIconDraft(listDetail?.list.icon ?? listIconOptions[0]);
          }}
          onNameDraftChange={setListNameDraft}
          iconDraft={listIconDraft}
          onIconDraftChange={setListIconDraft}
          onNameSubmit={updateListName}
          onRetry={() => loadListDetail(selectedListId)}
          onOpenEntry={openEntryDetail}
          onRemoveItem={removeListItem}
          onMoveItem={moveListItem}
          onEditProfile={openEntryProfileEditor}
        />
      )}

      {!detailEntry && tab === "lists" && !selectedListId && (
        <section className="screen">
          <form className="list-form" onSubmit={createList}>
            <input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Nueva lista" />
            <select className="list-icon-select" value={newListIcon} onChange={(event) => setNewListIcon(event.target.value)} aria-label="Icono de lista">
              {listIconOptions.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <select value={newListProfile} onChange={(event) => setNewListProfile(event.target.value as ProfileSlug)}>
              {profileOrder.map((slug) => (
                <option key={slug} value={slug}>
                  {profileName(slug)}
                </option>
              ))}
            </select>
            <button type="submit" aria-label="Crear lista">
              <ListPlus size={18} />
            </button>
          </form>
          <p className="helper list-helper">Quiero ver es un estado. Para que algo aparezca aca, agregalo a una lista al buscarlo o desde el detalle de la serie.</p>

          <div className="list-grid">
            {lists.map((list) => (
              <button className="list-tile" key={list.id} type="button" onClick={() => loadListDetail(list.id)}>
                <div className="tile-icon">
                  {list.icon ? <span>{list.icon}</span> : list.profileSlug === "juntos" ? <Users size={20} /> : <UserRound size={20} />}
                </div>
                <div>
                  <h3>{list.name}</h3>
                  <p>{list.profileName ?? "Compartida"} · {list.itemCount} items</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!detailEntry && tab === "recs" && (
        <section className="screen">
          <div className="recommendation-controls">
            <div className="profile-tabs">
              {profileOrder.map((slug) => (
                <button key={slug} className={recProfile === slug ? "active" : ""} onClick={() => setRecProfile(slug)} type="button">
                  {profileName(slug)}
                </button>
              ))}
            </div>

            <div className="recommendation-toolbar">
              <div className="segmented recommendation-type-tabs" aria-label="Tipo de recomendacion">
                {[
                  ["all", "Todo"],
                  ["tv", "Series"],
                  ["movie", "Peliculas"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={recMediaFilter === value ? "active" : ""}
                    onClick={() => setRecMediaFilter(value as RecommendationMediaFilter)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="secondary-pill refresh-recs" type="button" onClick={() => setRecRefreshSeed(Date.now())} disabled={loadingRecs}>
                <RefreshCcw size={15} />
                <span>Otra tanda</span>
              </button>
            </div>
          </div>

          {loadingRecs && <div className="loading-line"><Loader2 className="spin" size={18} /> Buscando recomendados</div>}

          <div className="result-list poster-grid">
            {recommendations.map((result) => (
              <SearchCard
                key={`${result.mediaType}-${result.tmdbId}`}
                result={result}
                opening={openingResultKey === `${result.mediaType}-${result.tmdbId}`}
                onOpen={() => openResultDetail(result, recProfile)}
                onSave={() => openSaveDialog(result, result.saved?.status ?? "wishlist")}
              />
            ))}
            {!loadingRecs && recommendations.length === 0 && (
              <EmptyState title="Sin recomendados todavia" text="Cuando haya series o peliculas vistas en este perfil, TMDB nos va a dar ideas parecidas." />
            )}
          </div>
        </section>
      )}

      {!detailEntry && tab === "profile" && (
        <section className="screen">
          <div className="profile-header-tools">
            <ProfileMultiSelect profiles={me?.profiles ?? []} selected={selectedProfiles} onToggle={toggleProfileFilter} />
            <button className="profile-settings-trigger" type="button" onClick={() => setProfileSettingsOpen(true)}>
              <Settings size={17} />
              <span>Ajustes</span>
            </button>
          </div>

          <section className="profile-tools">
            <label className="profile-search">
              <Search size={17} />
              <input value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Filtrar por nombre" />
            </label>
            <div className="segmented compact-segmented">
              {(["watching", "watched", "wishlist"] as WatchStatus[]).map((status) => (
                <button key={status} className={profileStatusFilters.includes(status) ? "active" : ""} type="button" onClick={() => toggleProfileStatusFilter(status)}>
                  {statusLabel[status]}
                </button>
              ))}
            </div>
            <div className="segmented compact-segmented">
              {([["all", "Ambos"], ["tv", "Series"], ["movie", "Peliculas"]] as [ProfileMediaFilter, string][]).map(([value, label]) => (
                <button key={value} className={profileMediaFilter === value ? "active" : ""} type="button" onClick={() => setProfileMediaFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="profile-filter-row">
              <label className="mini-select">
                <select value={profileRatingFilter} onChange={(event) => setProfileRatingFilter(Number(event.target.value))}>
                  <option value={0}>Todas las estrellas</option>
                  <option value={5}>5 estrellas</option>
                  <option value={4}>4+ estrellas</option>
                  <option value={3}>3+ estrellas</option>
                </select>
              </label>
              <label className="mini-select">
                <select value={profileSort} onChange={(event) => setProfileSort(event.target.value as ProfileSort)}>
                  <option value="updated_desc">Actividad reciente</option>
                  <option value="added_desc">Agregado reciente</option>
                  <option value="name_asc">Nombre A-Z</option>
                  <option value="name_desc">Nombre Z-A</option>
                  <option value="watched_desc">Visto reciente</option>
                </select>
              </label>
            </div>
          </section>

          <ContentRail title={`${filteredProfileEntries.length} resultados`} empty="No hay items que coincidan con esos filtros.">
            {filteredProfileEntries.map((entry) => (
              <EntryCard
                key={entry.entryId}
                entry={entry}
                compact
                pinned={entry.pinned}
                onOpen={() => openEntryDetail(entry)}
                onEditProfile={() => openEntryProfileEditor(entry)}
                onTogglePin={entry.status === "watching" && entry.media.mediaType === "tv" ? () => togglePin(entry) : undefined}
                onRating={(rating) => updateEntry(entry, { rating })}
                onRemove={() => deleteEntry(entry)}
              />
            ))}
          </ContentRail>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Navegacion principal">
        <NavButton tab="home" active={tab} onClick={navigateTab} icon={Home} label="Inicio" />
        <NavButton tab="search" active={tab} onClick={navigateTab} icon={Search} label="Buscar" />
        <NavButton tab="lists" active={tab} onClick={navigateTab} icon={ListPlus} label="Listas" />
        <NavButton tab="recs" active={tab} onClick={navigateTab} icon={Sparkles} label="Ideas" />
        <NavButton tab="profile" active={tab} onClick={navigateTab} icon={UserRound} label="Perfil" />
      </nav>

      {saveDialogResult && (
        <MediaSaveDialog
          result={saveDialogResult}
          profiles={me?.profiles ?? []}
          selectedProfiles={saveProfiles}
          saveStatus={saveStatus}
          saveRating={saveRating}
          saveSeason={saveSeason}
          saveEpisode={saveEpisode}
          targetListId={targetListId}
          lists={lists}
          saveWillBecomeJuntos={saveWillBecomeJuntos}
          saving={savingMedia}
          onClose={closeSaveDialog}
          onToggleProfile={toggleSaveProfile}
          onStatusChange={setSaveStatus}
          onRatingChange={setSaveRating}
          onSeasonChange={setSaveSeason}
          onEpisodeChange={setSaveEpisode}
          onListChange={setTargetListId}
          onConfirm={confirmSaveDialog}
        />
      )}

      {editingProfileEntry && (
        <EntryProfileDialog
          entry={editingProfileEntry}
          profiles={me?.profiles ?? []}
          selectedProfiles={saveProfiles}
          saveWillBecomeJuntos={saveWillBecomeJuntos}
          saving={movingEntry}
          onClose={closeEntryProfileEditor}
          onToggleProfile={toggleSaveProfile}
          onConfirm={moveEntryToSelectedProfiles}
        />
      )}

      {deleteListConfirmOpen && listDetail && (
        <ConfirmDialog
          eyebrow="Eliminar lista"
          title={listDetail.list.name}
          text="Los items se quitan de esta lista, pero no se eliminan de tus series."
          confirmLabel="Eliminar"
          danger
          busy={deletingList}
          onCancel={() => setDeleteListConfirmOpen(false)}
          onConfirm={deleteSelectedList}
        />
      )}

      {profileSettingsOpen && (
        <SettingsDialog
          exporting={exportingData}
          backingUp={backingUpData}
          onClose={() => setProfileSettingsOpen(false)}
          onExport={exportDataJson}
          onBackup={backupDataArchive}
        />
      )}
    </main>
  );
}

function NavButton({ tab, active, onClick, icon: Icon, label }: { tab: Tab; active: Tab; onClick: (tab: Tab) => void; icon: typeof Home; label: string }) {
  return (
    <button className={active === tab ? "active" : ""} onClick={() => onClick(tab)} type="button">
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function ListDetailScreen({
  detail,
  lists,
  loading,
  error,
  editingName,
  nameDraft,
  iconDraft,
  movingItemId,
  onBack,
  onEditName,
  onDeleteList,
  onCancelEdit,
  onNameDraftChange,
  onIconDraftChange,
  onNameSubmit,
  onRetry,
  onOpenEntry,
  onRemoveItem,
  onMoveItem,
  onEditProfile
}: {
  detail: ListDetail | null;
  lists: SavedList[];
  loading: boolean;
  error: string | null;
  editingName: boolean;
  nameDraft: string;
  iconDraft: string;
  movingItemId: string | null;
  onBack: () => void;
  onEditName: () => void;
  onDeleteList: () => void;
  onCancelEdit: () => void;
  onNameDraftChange: (value: string) => void;
  onIconDraftChange: (value: string) => void;
  onNameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  onOpenEntry: (entry: Entry) => void;
  onRemoveItem: (mediaId: string) => void;
  onMoveItem: (mediaId: string, targetListId: string) => void;
  onEditProfile: (entry: Entry) => void;
}) {
  const moveTargetLists = detail ? lists.filter((list) => list.id !== detail.list.id) : [];

  return (
    <section className="screen list-detail">
      <button className="back-button list-back" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        Listas
      </button>

      {error && (
        <div className="detail-error">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Reintentar</button>
        </div>
      )}

      {detail && (
        <>
          <section className="list-detail-header">
            {editingName ? (
              <form className="list-title-form" onSubmit={onNameSubmit}>
                <select className="list-icon-select" value={iconDraft} onChange={(event) => onIconDraftChange(event.target.value)} aria-label="Icono de lista">
                  {listIconOptions.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <input value={nameDraft} onChange={(event) => onNameDraftChange(event.target.value)} autoFocus />
                <button type="submit" aria-label="Guardar nombre">
                  <Save size={16} />
                </button>
                <button className="quiet-action" type="button" onClick={onCancelEdit} aria-label="Cancelar">
                  <X size={16} />
                </button>
              </form>
            ) : (
              <div className="list-title-row">
                <div className="list-title-icon">{detail.list.icon ?? "🍿"}</div>
                <div>
                  <p className="eyebrow">{detail.list.profileName ?? "Compartida"}</p>
                  <h2>{detail.list.name}</h2>
                  <span>{detail.list.itemCount} items</span>
                </div>
                <div className="list-title-actions">
                  <button type="button" onClick={onEditName} aria-label="Editar nombre">
                    <Pencil size={16} />
                  </button>
                  <button className="danger-icon-action" type="button" onClick={onDeleteList} aria-label="Eliminar lista">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="rail-items">
            {detail.items.map((item) => item.entry ? (
              <div className="list-item-with-tools" key={item.media.id}>
                <EntryCard
                  entry={item.entry}
                  compact
                  onOpen={() => onOpenEntry(item.entry as Entry)}
                  onEditProfile={() => onEditProfile(item.entry as Entry)}
                  onRemove={() => onRemoveItem(item.media.id)}
                />
                {moveTargetLists.length > 0 && (
                  <label className="move-list-select">
                    <ListPlus size={14} />
                    <select
                      value=""
                      disabled={movingItemId === item.media.id}
                      onChange={(event) => {
                        onMoveItem(item.media.id, event.target.value);
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Mover a lista</option>
                      {moveTargetLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ) : (
              <div className="list-item-with-tools" key={item.media.id}>
                <ListMediaCard item={item} onRemove={() => onRemoveItem(item.media.id)} />
                {moveTargetLists.length > 0 && (
                  <label className="move-list-select">
                    <ListPlus size={14} />
                    <select
                      value=""
                      disabled={movingItemId === item.media.id}
                      onChange={(event) => {
                        onMoveItem(item.media.id, event.target.value);
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Mover a lista</option>
                      {moveTargetLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
            {!loading && detail.items.length === 0 && (
              <EmptyState title="Lista vacia" text="Cuando guardes algo con esta lista seleccionada, va a aparecer aca." />
            )}
          </div>
        </>
      )}

      {loading && <div className="loading-line"><Loader2 className="spin" size={18} /> Cargando lista</div>}
    </section>
  );
}

function ListMediaCard({ item, onRemove }: { item: ListDetailItem; onRemove: () => void }) {
  const poster = posterUrl(item.media.posterPath, "w342") ?? posterUrl(item.media.backdropPath, "w300");

  return (
    <article className="media-card compact">
      <div className="poster">
        {poster ? <img src={poster} alt="" /> : item.media.mediaType === "tv" ? <Tv size={28} /> : <Film size={28} />}
      </div>
      <div className="media-body">
        <div className="media-meta">
          <span>{mediaLabel(item.media.mediaType)}</span>
          <span>{yearForMedia(item.media)}</span>
          {item.addedByName && <span>{item.addedByName}</span>}
        </div>
        <h3>{item.media.title}</h3>
        {item.media.overview && <p>{item.media.overview}</p>}
        <div className="card-actions">
          <button className="delete-action" type="button" onClick={onRemove} aria-label="Quitar de la lista">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProfileFilter({ profiles, selected, onToggle }: { profiles: Profile[]; selected: ProfileSlug[]; onToggle: (slug: ProfileSlug) => void }) {
  return (
    <section className="profile-filter">
      {profiles.map((profile) => (
        <button key={profile.slug} className={selected.includes(profile.slug) ? "active" : ""} onClick={() => onToggle(profile.slug)} type="button">
          {profile.slug === "juntos" ? <Users size={16} /> : <UserRound size={16} />}
          {profile.name}
        </button>
      ))}
    </section>
  );
}

function ProfileMultiSelect({ profiles, selected, onToggle }: { profiles: Profile[]; selected: ProfileSlug[]; onToggle: (slug: ProfileSlug) => void }) {
  const [open, setOpen] = useState(false);
  const selectedNames = profiles
    .filter((profile) => selected.includes(profile.slug))
    .map((profile) => profile.name);
  const summary = selectedNames.length > 0 ? selectedNames.join(" + ") : "Elegir perfiles";

  return (
    <section className="profile-multi-select">
      <button className="profile-multi-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>
          <Users size={16} />
          Perfiles
        </span>
        <strong>{summary}</strong>
      </button>
      {open && (
        <>
          <button className="profile-multi-scrim" type="button" onClick={() => setOpen(false)} aria-label="Cerrar perfiles" />
          <div className="profile-multi-menu">
            {profiles.map((profile) => {
              const active = selected.includes(profile.slug);
              return (
                <button key={profile.slug} className={active ? "active" : ""} type="button" onClick={() => {
                  onToggle(profile.slug);
                  setOpen(false);
                }}>
                  {profile.slug === "juntos" ? <Users size={16} /> : <UserRound size={16} />}
                  <span>{profile.name}</span>
                  {active && <CheckCircle2 size={15} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function ProfilePicker({ profiles, selected, onToggle }: { profiles: Profile[]; selected: ProfileSlug[]; onToggle: (slug: ProfileSlug) => void }) {
  return (
    <div className="profile-picker">
      {profiles.map((profile) => (
        <button key={profile.slug} className={selected.includes(profile.slug) ? "active" : ""} onClick={() => onToggle(profile.slug)} type="button">
          {profile.slug === "juntos" ? <Users size={16} /> : <UserRound size={16} />}
          {profile.name}
        </button>
      ))}
    </div>
  );
}

function ContentRail({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(list) ? list.length === 0 : !list;

  return (
    <section className="content-rail">
      <h2><span>{title}</span></h2>
      {isEmpty ? <EmptyState title={empty} /> : <div className="rail-items">{children}</div>}
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty-state">
      <Clapperboard size={22} />
      <p>{title}</p>
      {text && <span>{text}</span>}
    </div>
  );
}

function MultiFilterChips({ title, options, selected, onToggle }: {
  title: string;
  options: Array<{ id: string; label: string; icon?: ReactNode }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="multi-filter-chips">
      <span>{title}</span>
      <div>
        {options.map((option) => (
          <button key={option.id} className={selected.includes(option.id) ? "active" : ""} type="button" onClick={() => onToggle(option.id)}>
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListFilterDropdown({ lists, selected, onToggle, onSelectAll }: {
  lists: SavedList[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (lists.length === 0) return null;

  const allSelected = selected.length === lists.length;
  const summary = allSelected ? "Todas las listas" : `${selected.length}/${lists.length} listas`;

  return (
    <section className="list-filter-dropdown">
      <span>Listas</span>
      <button className="list-filter-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ListPlus size={15} />
        <strong>{summary}</strong>
      </button>
      {open && (
        <>
          <button className="list-filter-scrim" type="button" onClick={() => setOpen(false)} aria-label="Cerrar listas" />
          <div className="list-filter-menu">
            <button className={allSelected ? "active" : ""} type="button" onClick={onSelectAll}>
              <span>✨ Todas</span>
              {allSelected && <CheckCircle2 size={15} />}
            </button>
            {lists.map((list) => {
              const active = selected.includes(list.id);
              return (
                <button key={list.id} className={active ? "active" : ""} type="button" onClick={() => onToggle(list.id)}>
                  <span>{list.icon ?? "🍿"} {list.name}</span>
                  {active && <CheckCircle2 size={15} />}
                </button>
              );
            })}
            <button className="list-filter-done" type="button" onClick={() => setOpen(false)}>Listo</button>
          </div>
        </>
      )}
    </section>
  );
}

function HomeWishlistCard({ item, onOpen, onEditProfile, onRemove }: {
  item: HomeWishlistItem;
  onOpen?: () => void;
  onEditProfile?: () => void;
  onRemove: (listId: string) => void;
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const entry = item.entry;
  const poster = posterUrl(entry?.media.posterPath ?? item.media.posterPath, "w342") ?? posterUrl(item.media.backdropPath, "w300");
  const StatusIcon = entry ? statusIcon[entry.status] : Bookmark;
  const canOpen = Boolean(entry && onOpen);
  const primaryList = item.lists[0];
  const isWatching = entry?.status === "watching";

  return (
    <article className={`media-card compact wishlist-card ${canOpen ? "clickable" : ""}`} onClick={canOpen ? onOpen : undefined}>
      <div className="poster">
        {poster ? <img src={poster} alt="" /> : item.media.mediaType === "tv" ? <Tv size={28} /> : <Film size={28} />}
      </div>
      <div className="media-body">
        <div className="media-meta">
          <span><StatusIcon size={14} /> {entry ? statusLabel[entry.status] : mediaLabel(item.media.mediaType)}</span>
          {entry?.profile.name && <span>{entry.profile.name}</span>}
        </div>
        <div className="series-pill"><span className="series-pill-title">{item.media.title}</span><span className="series-pill-chevron">›</span></div>
        <h3>{entry && item.media.mediaType === "tv" ? episodeLabel(entry) : yearForMedia(item.media)}</h3>
        <p className="entry-card-context">
          {mediaLabel(item.media.mediaType)} · {yearForMedia(item.media)}
          {entry?.rating ? ` · ${entry.rating} estrellas` : ""}
          {entry?.createdAt ? ` · Agregada ${formatDateAr(entry.createdAt)}` : ""}
        </p>
        <div className="wishlist-list-badges" aria-label="Listas">
          {item.hasWishlistStatus && (
            <span title="Pendiente">
              <Bookmark size={12} />
              Pendiente
            </span>
          )}
          {item.lists.map((list) => (
            <span key={list.id} title={list.name}>
              <i>{list.icon ?? "🍿"}</i>
              {list.name}
            </span>
          ))}
        </div>
        {isWatching && (
          <div className="wishlist-warning-wrap">
            <button type="button" onClick={(event) => {
              event.stopPropagation();
              setWarningOpen((open) => !open);
            }} aria-expanded={warningOpen} aria-label="Aviso de serie en progreso">
              <AlertTriangle size={15} />
              En progreso
            </button>
            {warningOpen && (
              <div className="wishlist-warning-popover">
                Esta serie ya se esta viendo. Si no la queres pendiente, conviene quitarla de esta lista.
              </div>
            )}
          </div>
        )}
        <div className="card-actions">
          {primaryList && (
            <button className="delete-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onRemove(primaryList.id);
            }} aria-label={`Quitar de ${primaryList.name}`}>
              <Trash2 size={15} />
            </button>
          )}
          {entry && onEditProfile && (
            <button className="profile-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onEditProfile();
            }} aria-label="Cambiar quien la ve">
              {entry.profile.slug === "juntos" ? <Users size={15} /> : <UserRound size={15} />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function SeriesDetail({
  entry,
  overview,
  movie,
  detail,
  selectedSeason,
  viewingSeason,
  loadingSeries,
  loadingMovie,
  loadingSeason,
  seriesError,
  seasonError,
  lists,
  listTargetId,
  listMemberships,
  wishlistProfileName,
  wishlistProfiles,
  wishlistEntryStatus,
  onBack,
  onSeasonChange,
  onSeasonOpen,
  onRetrySeries,
  onRetrySeason,
  onEpisodeWatched,
  onListTargetChange,
  onAddToList,
  onAddToWishlist,
  onRemoveFromWishlist,
  onEditProfile,
  onRating,
  onMarkWatched
}: {
  entry: Entry;
  overview: SeriesOverview | null;
  movie: MovieOverview["movie"] | null;
  detail: SeasonDetail | null;
  selectedSeason: number;
  viewingSeason: boolean;
  loadingSeries: boolean;
  loadingMovie: boolean;
  loadingSeason: boolean;
  seriesError: string | null;
  seasonError: string | null;
  lists: SavedList[];
  listTargetId: string;
  listMemberships: SavedList[];
  wishlistProfileName: string;
  wishlistProfiles: { slug: ProfileSlug; name: string }[];
  wishlistEntryStatus: WatchStatus | null;
  onBack: () => void;
  onSeasonChange: (season: number) => void;
  onSeasonOpen: (season: number) => void;
  onRetrySeries: () => void;
  onRetrySeason: () => void;
  onEpisodeWatched: (episode: SeasonEpisode) => void;
  onListTargetChange: (listId: string) => void;
  onAddToList: () => void | Promise<void>;
  onAddToWishlist: (profileSlug: ProfileSlug) => void | Promise<void>;
  onRemoveFromWishlist: () => void | Promise<void>;
  onEditProfile: () => void;
  onRating: (rating: number | null) => void;
  onMarkWatched: () => void | Promise<void>;
}) {
  const series = overview?.series;
  const providers = entry.media.providers?.providers ?? [];
  const visibleProviders = providers.slice(0, 5);
  const providerLink = entry.media.providers?.link ?? null;
  const visibleSeasons = overview?.seasons ?? [];
  const selectedSeasonInfo = detail?.season
    ?? detail?.seasons.find((season) => season.seasonNumber === selectedSeason)
    ?? visibleSeasons.find((season) => season.seasonNumber === selectedSeason);
  const showingSeasonHero = viewingSeason && Boolean(selectedSeasonInfo);
  const heroPosterPath = showingSeasonHero
    ? selectedSeasonInfo?.posterPath ?? series?.posterPath ?? entry.media.posterPath
    : series?.posterPath ?? entry.media.posterPath;
  const backdrop = posterUrl(series?.backdropPath ?? entry.media.backdropPath, "w780") ?? posterUrl(heroPosterPath, "w780");
  const poster = posterUrl(heroPosterPath ?? null, "w342");
  const ratingValue = showingSeasonHero ? selectedSeasonInfo?.voteAverage : series?.voteAverage ?? entry.media.voteAverage;
  const rating = Math.round(((ratingValue ?? 0) * 10));
  const description = showingSeasonHero ? selectedSeasonInfo?.overview : series?.overview ?? entry.media.overview;
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [markConfirmOpen, setMarkConfirmOpen] = useState(false);
  const [wishlistConfirmOpen, setWishlistConfirmOpen] = useState(false);
  const [wishlistPickerOpen, setWishlistPickerOpen] = useState(false);
  const activeListTargetId = listTargetId || lists[0]?.id || "";
  const isSavedEntry = !entry.entryId.startsWith("preview:");
  const canUseWishlistAction = entry.entryId.startsWith("preview:") || entry.status === "wishlist";
  const isInCurrentWishlist = canUseWishlistAction && wishlistEntryStatus === "wishlist";
  const isMovie = entry.media.mediaType === "movie";
  const heroYearRaw = series?.year ?? yearForMedia(entry.media);
  const heroYear = heroYearRaw && heroYearRaw !== "Sin fecha" ? heroYearRaw : null;
  const movieScore = Math.round((movie?.voteAverage ?? entry.media.voteAverage ?? 0) * 10);
  const movieRuntimeLabel = movie?.runtime
    ? [Math.floor(movie.runtime / 60) ? `${Math.floor(movie.runtime / 60)}h` : null, movie.runtime % 60 ? `${movie.runtime % 60}m` : null].filter(Boolean).join(" ") || null
    : null;
  const vibeBucket = movieScore >= 70 ? 0 : movieScore >= 50 ? 1 : 2;
  const vibeEmojis = ["🤩", "🙂", "😴"].map((emoji, index) => ({ emoji, active: index === vibeBucket }));
  const metaItems = showingSeasonHero ? (
    <>
      {selectedSeasonInfo?.year && <span>{selectedSeasonInfo.year}</span>}
      {selectedSeasonInfo && <span>{selectedSeasonInfo.episodeCount} episodios</span>}
      {selectedSeasonInfo && <span>{selectedSeasonInfo.watchedEpisodeCount ?? 0}/{selectedSeasonInfo.episodeCount} vistos</span>}
    </>
  ) : (
    series?.genres.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)
  );

  useEffect(() => {
    setDescriptionOpen(false);
    setListPickerOpen(false);
    setMarkConfirmOpen(false);
    setWishlistConfirmOpen(false);
  }, [entry.media.id, entry.profile.slug, selectedSeason, viewingSeason]);

  return (
    <section className="detail-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        {viewingSeason ? "Temporadas" : "Volver"}
      </button>

      <section className="tmdb-hero" style={backdrop ? { "--hero-image": `url(${backdrop})` } as CSSProperties : undefined}>
        <div className="tmdb-poster-stack">
          <div className="tmdb-poster">
            {poster ? <img src={poster} alt="" /> : isMovie ? <Film size={34} /> : <Tv size={34} />}
          </div>
          {visibleProviders.length > 0 && (
            <div className={`poster-provider-row ${visibleProviders.length === 1 ? "single" : ""}`} aria-label="Donde ver">
              {visibleProviders.map((provider) => {
                const logo = posterUrl(provider.logoPath, "w92");
                const label = `${providerTypeLabel[provider.type]}: ${provider.providerName}`;
                const logoNode = (
                  <span className="provider-logo" title={label}>
                    {logo ? <img src={logo} alt={provider.providerName} /> : <Film size={15} />}
                  </span>
                );

                return providerLink ? (
                  <a
                    className="provider-chip"
                    key={`${provider.providerId}-${provider.type}`}
                    href={providerLink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                  >
                    {logoNode}
                    {visibleProviders.length === 1 && (
                      <span className="provider-copy">
                        <small>Ahora en streaming</small>
                        <strong>Ver ahora</strong>
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="provider-chip" key={`${provider.providerId}-${provider.type}`} aria-label={label}>
                    {logoNode}
                    {visibleProviders.length === 1 && (
                      <span className="provider-copy">
                        <small>Ahora en streaming</small>
                        <strong>Ver ahora</strong>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="tmdb-copy">
          <div className="series-heading">
            <h2>{showingSeasonHero ? selectedSeasonInfo?.name : series?.title ?? entry.media.title}</h2>
            <div className="title-meta-line">
              {!showingSeasonHero && heroYear && <span className="series-year">{heroYear}</span>}
              <div className="tmdb-meta">
                {rating > 0 && <strong>{rating}%</strong>}
                {metaItems}
              </div>
            </div>
          </div>
          {!isMovie && description && (
            <button
              className="description-toggle subtle"
              type="button"
              aria-expanded={descriptionOpen}
              onClick={() => setDescriptionOpen((open) => !open)}
            >
              {descriptionOpen ? "Ocultar descripcion" : "Descripcion"}
            </button>
          )}
          {descriptionOpen && description ? (
            <div className="overview-block expanded">
              <p>{description}</p>
            </div>
          ) : (
            <>
              <section className="watch-owner-panel">
                {isSavedEntry ? (
                  <button className="detail-profile-button" type="button" onClick={onEditProfile}>
                    {entry.profile.slug === "juntos" ? <Users size={19} /> : <UserRound size={19} />}
                    <span>{entry.profile.name}</span>
                    <Pencil size={14} />
                  </button>
                ) : (
                  <div className="detail-profile-button detail-profile-unassigned">
                    <Bookmark size={19} />
                    <span>Sin asignar</span>
                  </div>
                )}
                <div className="watch-owner-copy">
                  <span>{isSavedEntry ? statusLabel[entry.status] : "Sin guardar"}</span>
                  {isSavedEntry && !isMovie && entry.status !== "wishlist" && <strong>{episodeLabel(entry)}</strong>}
                </div>
              </section>
              <div className="detail-action-row">
                <div className="list-action-stack">
                  {listMemberships.length > 0 && (
                    <span className="list-membership-badge" title={listMemberships.map((list) => list.name).join(", ")}>
                      En lista{listMemberships.length > 1 ? `s (${listMemberships.length})` : ""}
                    </span>
                  )}
                </div>
                <StarInput value={entry.rating} onChange={onRating} />
              </div>
              <div className="hero-quick-actions" aria-label="Acciones rapidas">
                <div className="quick-action-wrap">
                  <button
                    className="round-hero-action"
                    type="button"
                    onClick={() => {
                      setListPickerOpen((open) => !open);
                      setMarkConfirmOpen(false);
                      setWishlistConfirmOpen(false);
                      setWishlistPickerOpen(false);
                    }}
                    aria-label="Agregar a una lista"
                    aria-expanded={listPickerOpen}
                  >
                    <ListPlus size={19} />
                  </button>
                  {listPickerOpen && (
                    <div className="mini-popover list-picker-popover">
                      <p>Agregar a lista</p>
                      {listMemberships.length > 0 && (
                        <span>Ya esta en {listMemberships.map((list) => list.name).join(", ")}.</span>
                      )}
                      <div className="mini-list-picker">
                        <select
                          value={activeListTargetId}
                          onChange={(event) => onListTargetChange(event.target.value)}
                          aria-label="Lista destino"
                          disabled={lists.length === 0}
                        >
                          {lists.length === 0 ? (
                            <option value="">Sin listas</option>
                          ) : lists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name}
                            </option>
                          ))}
                        </select>
                        <div className="mini-list-actions">
                          <button type="button" onClick={() => setListPickerOpen(false)}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onAddToList();
                              setListPickerOpen(false);
                            }}
                            disabled={lists.length === 0}
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="quick-action-wrap">
                  <button
                    className={`round-hero-action ${isInCurrentWishlist ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setListPickerOpen(false);
                      setMarkConfirmOpen(false);
                      if (isInCurrentWishlist) {
                        setWishlistPickerOpen(false);
                        setWishlistConfirmOpen((open) => !open);
                        return;
                      }
                      setWishlistConfirmOpen(false);
                      setWishlistPickerOpen((open) => !open);
                    }}
                    aria-label={wishlistEntryStatus === "wishlist" ? `Quitar de Quiero ver ${wishlistProfileName}` : "Agregar a Quiero ver"}
                    aria-expanded={wishlistConfirmOpen || wishlistPickerOpen}
                    title={wishlistEntryStatus ? `Ya esta en ${statusLabel[wishlistEntryStatus]} ${wishlistProfileName}` : "Agregar a Quiero ver"}
                  >
                    <Bookmark size={18} />
                  </button>
                  {wishlistConfirmOpen && wishlistEntryStatus === "wishlist" && (
                    <div className="mini-popover wishlist-confirm-popover">
                      <p>Quitar de Quiero ver?</p>
                      <div className="mini-confirm-actions">
                        <button type="button" onClick={() => setWishlistConfirmOpen(false)}>Cancelar</button>
                        <button
                          type="button"
                          onClick={() => {
                            void onRemoveFromWishlist();
                            setWishlistConfirmOpen(false);
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}
                  {wishlistPickerOpen && !isInCurrentWishlist && (
                    <div className="mini-popover wishlist-picker-popover">
                      <p>Agregar a Quiero ver</p>
                      <div className="mini-profile-picker">
                        {wishlistProfiles.map((profile) => (
                          <button
                            key={profile.slug}
                            type="button"
                            onClick={() => {
                              void onAddToWishlist(profile.slug);
                              setWishlistPickerOpen(false);
                            }}
                          >
                            {profile.slug === "juntos" ? <Users size={15} /> : <UserRound size={15} />}
                            {profile.name}
                          </button>
                        ))}
                      </div>
                      <div className="mini-confirm-actions">
                        <button type="button" onClick={() => setWishlistPickerOpen(false)}>Cerrar</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="quick-action-wrap">
                  <button
                    className="round-hero-action"
                    type="button"
                    onClick={() => {
                      setMarkConfirmOpen((open) => !open);
                      setListPickerOpen(false);
                      setWishlistConfirmOpen(false);
                      setWishlistPickerOpen(false);
                    }}
                    disabled={entry.status === "watched"}
                    aria-label={isMovie ? "Marcar pelicula como vista" : "Marcar serie como vista"}
                    aria-expanded={markConfirmOpen}
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  {markConfirmOpen && (
                    <div className="mini-popover mark-confirm-popover">
                      <p>{isMovie ? "Marcar pelicula como vista?" : "Marcar serie como vista?"}</p>
                      <div className="mini-confirm-actions">
                        <button type="button" onClick={() => setMarkConfirmOpen(false)}>No</button>
                        <button
                          type="button"
                          onClick={() => {
                            void onMarkWatched();
                            setMarkConfirmOpen(false);
                          }}
                        >
                          Si
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isMovie && (
        <section className="movie-detail-body">
          {loadingMovie && !movie && <div className="loading-line"><Loader2 className="spin" size={18} /> Cargando pelicula</div>}
          {movie && (
            <>
              {movie.tagline && <p className="movie-tagline">“{movie.tagline}”</p>}
              <div className="movie-facts">
                {movieScore > 0 && <span className="movie-score"><Star size={13} /> {movieScore}%</span>}
                {movieRuntimeLabel && <span><Clock size={13} /> {movieRuntimeLabel}</span>}
                {movie.year && <span>{movie.year}</span>}
                {movie.genres.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}
              </div>
              {movie.director && (
                <div className="movie-director">
                  <span>Direccion</span>
                  <strong>{movie.director}</strong>
                </div>
              )}
              {movie.overview && (
                <div className="movie-overview">
                  <h3>Sinopsis</h3>
                  <p>{movie.overview}</p>
                </div>
              )}
              <div className="movie-vibe" aria-hidden="true">
                {vibeEmojis.map((item) => (
                  <span key={item.emoji} className={item.active ? "active" : ""}>{item.emoji}</span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {!isMovie && !viewingSeason && (
        <>
          {loadingSeries && <div className="loading-line"><Loader2 className="spin" size={18} /> Cargando temporadas</div>}

          {seriesError && !loadingSeries && (
            <div className="detail-error">
              <p>{seriesError}</p>
              <button type="button" onClick={onRetrySeries}>Reintentar</button>
            </div>
          )}

          <div className="season-list">
            {visibleSeasons.map((season) => (
              <button className="season-row" key={season.seasonNumber} type="button" onClick={() => onSeasonOpen(season.seasonNumber)}>
                <div className="season-poster">
                  {posterUrl(season.posterPath ?? null, "w185") ? <img src={posterUrl(season.posterPath ?? null, "w185") ?? ""} alt="" /> : <Tv size={24} />}
                </div>
                <div className="season-copy">
                  <h3>{season.name}</h3>
                  <div className="season-meta">
                    {season.voteAverage ? <strong><Star size={13} /> {Math.round(season.voteAverage * 10)}%</strong> : null}
                    <span>{season.year ?? "Sin fecha"} · {season.episodeCount} episodios</span>
                  </div>
                  <div className="season-progress">
                    <span>{season.watchedEpisodeCount ?? 0}/{season.episodeCount} vistos</span>
                    <i style={{ width: `${season.episodeCount ? ((season.watchedEpisodeCount ?? 0) / season.episodeCount) * 100 : 0}%` }} />
                  </div>
                  {season.overview && <p>{season.overview}</p>}
                </div>
              </button>
            ))}
            {!loadingSeries && !seriesError && overview && visibleSeasons.length === 0 && <EmptyState title="Sin temporadas en TMDB" />}
          </div>
        </>
      )}

      {viewingSeason && (
        <>
          <div className="season-strip">
            {(overview?.seasons ?? detail?.seasons ?? [{ seasonNumber: selectedSeason, episodeCount: 0, name: `Temporada ${selectedSeason}` }]).map((season) => (
              <button
                key={season.seasonNumber}
                className={selectedSeason === season.seasonNumber ? "active" : ""}
                type="button"
                onClick={() => onSeasonChange(season.seasonNumber)}
              >
                {season.seasonNumber === 0 ? "ESP" : `T${season.seasonNumber}`}
              </button>
            ))}
          </div>

          {loadingSeason && <div className="loading-line"><Loader2 className="spin" size={18} /> Cargando capitulos</div>}

          {seasonError && !loadingSeason && (
            <div className="detail-error">
              <p>{seasonError}</p>
              <button type="button" onClick={onRetrySeason}>Reintentar</button>
            </div>
          )}

          <div className="episode-list">
            {detail?.episodes.map((episode) => (
              <article className={`episode-row ${episode.watched ? "watched" : ""} ${episode.next ? "next" : ""}`} key={episode.id}>
                <div className="episode-still">
                  {posterUrl(episode.stillPath, "w300") ? <img src={posterUrl(episode.stillPath, "w300") ?? ""} alt="" /> : <Tv size={22} />}
                </div>
                <div className="episode-copy">
                  <div className="episode-kicker">
                    <span>{episode.episodeNumber}</span>
                    {episode.voteAverage ? <span><Star size={12} /> {Math.round(episode.voteAverage * 10)}%</span> : null}
                    {episode.airDate && <span><CalendarDays size={12} /> {formatDateAr(episode.airDate)}</span>}
                    {episode.watchedAt && <span>Vista {formatDateAr(episode.watchedAt)}</span>}
                    {episode.runtime ? <span>{episode.runtime}m</span> : null}
                  </div>
                  <h3>{episode.title}</h3>
                  {episode.overview && <p>{episode.overview}</p>}
                </div>
                <button type="button" onClick={() => onEpisodeWatched(episode)} aria-label={`Marcar episodio ${episode.episodeNumber} visto`}>
                  <CheckCircle2 size={18} />
                </button>
              </article>
            ))}
            {!loadingSeason && !seasonError && !detail && (
              <EmptyState title="Toca reintentar para cargar capitulos" />
            )}
            {!loadingSeason && detail && detail.episodes.length === 0 && <EmptyState title="Sin capitulos para esta temporada" />}
          </div>
        </>
      )}
    </section>
  );
}

function EntryCard({ entry, compact = false, emphasizeNext = false, pinned = false, onOpen, onAdvance, onMarkWatched, onRating, onRemove, onEditProfile, onTogglePin }: {
  entry: Entry;
  compact?: boolean;
  emphasizeNext?: boolean;
  pinned?: boolean;
  onOpen?: () => void;
  onAdvance?: () => void;
  onMarkWatched?: () => void;
  onRating?: (rating: number | null) => void;
  onRemove?: () => void;
  onEditProfile?: () => void;
  onTogglePin?: () => void;
}) {
  const preferredPoster = entry.media.mediaType === "tv"
    ? entry.episodeInfo?.seasonPosterPath ?? entry.media.posterPath
    : entry.media.posterPath;
  const poster = posterUrl(preferredPoster ?? null, "w342") ?? posterUrl(entry.media.backdropPath, "w300");
  const StatusIcon = statusIcon[entry.status];
  const canOpen = Boolean(onOpen);

  return (
    <article className={`media-card ${compact ? "compact" : ""} ${canOpen ? "clickable" : ""}`} onClick={canOpen ? onOpen : undefined}>
      <div className="poster">
        {poster ? <img src={poster} alt="" /> : entry.media.mediaType === "tv" ? <Tv size={28} /> : <Film size={28} />}
      </div>
      <div className="media-body">
        <div className="media-meta">
          <span className={`status-tag status-${entry.status}`}><StatusIcon size={13} /> {statusLabel[entry.status]}</span>
          <span>{entry.profile.name}</span>
          {pinned && <span className="pin-tag"><Pin size={12} /> Fijada</span>}
        </div>
        <div className="series-pill"><span className="series-pill-title">{entry.media.title}</span><span className="series-pill-chevron">›</span></div>
        <h3>{entry.media.mediaType === "tv"
          ? (emphasizeNext && entry.episodeInfo?.nextEpisode
              ? `T${entry.episodeInfo.nextEpisode.seasonNumber} E${entry.episodeInfo.nextEpisode.episodeNumber}`
              : episodeLabel(entry))
          : yearForMedia(entry.media)}</h3>
        <p className="entry-card-context">
          {mediaLabel(entry.media.mediaType)} · {yearForMedia(entry.media)}
          {entry.rating ? ` · ${entry.rating} estrellas` : ""}
          {entry.createdAt ? ` · Agregada ${formatDateAr(entry.createdAt)}` : ""}
        </p>
        {entry.episodeInfo?.nextEpisode && (
          <p className="next-episode">
            {emphasizeNext
              ? (entry.episodeInfo.nextEpisode.title ?? "Proximo episodio")
              : `Sigue T${entry.episodeInfo.nextEpisode.seasonNumber} E${entry.episodeInfo.nextEpisode.episodeNumber}${entry.episodeInfo.nextEpisode.title ? ` · ${entry.episodeInfo.nextEpisode.title}` : ""}`}
          </p>
        )}
        {entry.episodeInfo?.hasNewEpisode && <span className="new-badge">Nuevo disponible</span>}
        {onRating && <StarInput value={entry.rating} onChange={onRating} compact />}
        <div className="card-actions">
          {entry.media.mediaType === "tv" && onAdvance && (
            <button className="advance-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onAdvance();
            }}>
              <Plus size={15} />
              <span>Episodio</span>
            </button>
          )}
          {onMarkWatched && (
            <button className="check-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onMarkWatched();
            }} aria-label="Marcar como vista">
              <CheckCircle2 size={15} />
            </button>
          )}
          {onTogglePin && (
            <button className={`pin-action ${pinned ? "active" : ""}`} type="button" onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }} aria-label={pinned ? "Quitar de fijadas" : "Fijar en Inicio"}>
              <Pin size={15} />
            </button>
          )}
          {onRemove && (
            <button className="delete-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }} aria-label="Quitar de la lista">
              <Trash2 size={15} />
            </button>
          )}
          {onEditProfile && (
            <button className="profile-action" type="button" onClick={(event) => {
              event.stopPropagation();
              onEditProfile();
            }} aria-label="Cambiar quien la ve">
              {entry.profile.slug === "juntos" ? <Users size={15} /> : <UserRound size={15} />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function SearchCard({ result, opening = false, onOpen, onSave }: { result: SearchResult; opening?: boolean; onOpen?: () => void; onSave: () => void }) {
  const poster = posterUrl(result.posterPath);
  const canOpen = Boolean(onOpen);

  return (
    <article
      className={`search-card ${canOpen ? "clickable" : ""}`}
    >
      <button className="search-card-open" type="button" onClick={canOpen ? onOpen : undefined} disabled={!canOpen} aria-label={canOpen ? `Abrir ${result.title}` : undefined}>
        <span className="poster">
          {poster ? <img src={poster} alt="" /> : result.mediaType === "tv" ? <Tv size={28} /> : <Film size={28} />}
          {opening && <span className="poster-loading"><Loader2 className="spin" size={18} /></span>}
        </span>
        <span className="search-card-copy">
          <span className="media-meta">
            <span>{mediaLabel(result.mediaType)}</span>
            <span>{yearForMedia(result)}</span>
          </span>
          <span className="search-card-title">{result.title}</span>
          {result.saved && (
            <span className={`saved-badge ${result.saved.status}`}>
              {statusLabel[result.saved.status]} · {result.saved.profileName}
            </span>
          )}
          <span className="search-card-description">{result.overview || "Sin descripcion en TMDB."}</span>
        </span>
      </button>
      <button className="primary-action" type="button" onClick={onSave}>
        <Plus size={16} />
        Guardar
      </button>
    </article>
  );
}

function StarInput({ value, onChange, compact = false }: { value: number | null; onChange: (value: number | null) => void; compact?: boolean }) {
  return (
    <div className={`stars ${compact ? "compact" : ""}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" className={value && value >= star ? "active" : ""} onClick={(event) => {
          event.stopPropagation();
          onChange(value === star ? null : star);
        }} aria-label={`${star} estrellas`}>
          <Star size={compact ? 14 : 16} />
        </button>
      ))}
    </div>
  );
}

function MediaSaveDialog({
  result,
  profiles,
  selectedProfiles,
  saveStatus,
  saveRating,
  saveSeason,
  saveEpisode,
  targetListId,
  lists,
  saveWillBecomeJuntos,
  saving,
  onClose,
  onToggleProfile,
  onStatusChange,
  onRatingChange,
  onSeasonChange,
  onEpisodeChange,
  onListChange,
  onConfirm
}: {
  result: SearchResult;
  profiles: Profile[];
  selectedProfiles: ProfileSlug[];
  saveStatus: WatchStatus;
  saveRating: number | null;
  saveSeason: number;
  saveEpisode: number;
  targetListId: string;
  lists: SavedList[];
  saveWillBecomeJuntos: boolean;
  saving: boolean;
  onClose: () => void;
  onToggleProfile: (slug: ProfileSlug) => void;
  onStatusChange: (status: WatchStatus) => void;
  onRatingChange: (rating: number | null) => void;
  onSeasonChange: (season: number) => void;
  onEpisodeChange: (episode: number) => void;
  onListChange: (listId: string) => void;
  onConfirm: () => void;
}) {
  const needsProgress = result.mediaType === "tv" && saveStatus === "watching";

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={`Guardar ${result.title}`}>
      <section className="dialog-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Guardar</p>
            <h2 className="dialog-title">{result.title}</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-section">
            <p className="eyebrow">Guardar como</p>
            <div className="segmented">
              {(["wishlist", "watching", "watched"] as WatchStatus[]).map((status) => (
                <button key={status} className={saveStatus === status ? "active" : ""} onClick={() => onStatusChange(status)} type="button">
                  {statusLabel[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="dialog-section">
            <p className="eyebrow">Quien la ve</p>
            <ProfilePicker profiles={profiles} selected={selectedProfiles} onToggle={onToggleProfile} />
            {saveWillBecomeJuntos && <p className="helper">Juan + Cami se guarda como Juntos.</p>}
          </div>

          <label className="list-target">
            <Bookmark size={16} />
            <select value={targetListId} onChange={(event) => onListChange(event.target.value)}>
              <option value="">Sin lista especifica</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>

          <div className="dialog-row">
            {needsProgress && (
              <div className="progress-inputs">
                <label>
                  T
                  <input type="number" min="1" value={saveSeason} onChange={(event) => onSeasonChange(Number(event.target.value))} />
                </label>
                <label>
                  E
                  <input type="number" min="0" value={saveEpisode} onChange={(event) => onEpisodeChange(Number(event.target.value))} />
                </label>
              </div>
            )}
            {saveStatus === "watched" && <StarInput value={saveRating} onChange={onRatingChange} />}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="secondary-dialog-action" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="primary-dialog-action" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            <span>Guardar</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfirmDialog({ eyebrow, title, text, confirmLabel, danger = false, busy = false, onCancel, onConfirm }: {
  eyebrow: string;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}>
      <section className="dialog-panel confirm-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="dialog-title">{title}</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onCancel} aria-label="Cerrar" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="confirm-copy">{text}</p>

        <div className="dialog-footer">
          <button className="secondary-dialog-action" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className={`primary-dialog-action ${danger ? "danger" : ""}`} type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : danger ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsDialog({ exporting, backingUp, onClose, onExport, onBackup }: {
  exporting: boolean;
  backingUp: boolean;
  onClose: () => void;
  onExport: () => void;
  onBackup: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Ajustes">
      <section className="dialog-panel settings-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Configuracion</p>
            <h2 className="dialog-title">Datos y backups</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar" disabled={exporting || backingUp}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-action-list">
          <button className="settings-action" type="button" onClick={onExport} disabled={exporting || backingUp}>
            {exporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
            <span>
              <strong>Exportar JSON</strong>
              <small>Datos legibles para revisar o migrar.</small>
            </span>
          </button>
          <button className="settings-action" type="button" onClick={onBackup} disabled={exporting || backingUp}>
            {backingUp ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            <span>
              <strong>Backup DB</strong>
              <small>Descarga un `.tar.gz` con SQLite.</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

function EntryProfileDialog({
  entry,
  profiles,
  selectedProfiles,
  saveWillBecomeJuntos,
  saving,
  onClose,
  onToggleProfile,
  onConfirm
}: {
  entry: Entry;
  profiles: Profile[];
  selectedProfiles: ProfileSlug[];
  saveWillBecomeJuntos: boolean;
  saving: boolean;
  onClose: () => void;
  onToggleProfile: (slug: ProfileSlug) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={`Cambiar quien ve ${entry.media.title}`}>
      <section className="dialog-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Cambiar perfil</p>
            <h2 className="dialog-title">{entry.media.title}</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <p className="helper">Ahora esta en {entry.profile.name}. Elegi quien la ve desde ahora.</p>
          <ProfilePicker profiles={profiles} selected={selectedProfiles} onToggle={onToggleProfile} />
          {saveWillBecomeJuntos && <p className="helper">Si marcas Juan y Cami, la serie pasa a Juntos.</p>}
        </div>

        <div className="dialog-footer">
          <button className="secondary-dialog-action" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="primary-dialog-action" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Users size={16} />}
            <span>Actualizar</span>
          </button>
        </div>
      </section>
    </div>
  );
}
