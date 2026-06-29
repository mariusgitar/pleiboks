// ── rss.js — RSS-parser og cache for Pleiboks ────────────────────
//
// Brukes for NRK-podcaster som har RSS-feed. Fordeler over psapi:
// - Stabile, offentlige URLer (ikke udokumentert API)
// - Ingen CORS-problemer fra NRK sine feeds
// - Inneholder både lydURL og cover direkte — ingen proxy nødvendig
// - Åpner for engelskspråklige feeds fremover
//
// Cache: sessionStorage per feed-URL. Forsvinner når fanen lukkes.
// Format i cache: { items: [...], cover: "url", fetchedAt: timestamp }

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// ── Hent og parse én RSS-feed ─────────────────────────────────────
export async function fetchRssFeed(url) {
  const cacheKey = `rss_cache_${encodeURIComponent(url)}`;

  // Sjekk cache
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  // Fetch og parse
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RSS fetch feilet: ${res.status}`);
  const text = await res.text();
  const result = parseRss(text);

  // Lagre i cache
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      ...result,
      fetchedAt: Date.now(),
    }));
  } catch {}

  return result;
}

// ── XML-parser ────────────────────────────────────────────────────
function parseRss(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // Serieinfo
  const channel = doc.querySelector("channel");
  const cover =
    channel?.querySelector("image > url")?.textContent?.trim() ||
    channel?.querySelector("itunes\\:image, image[href]")?.getAttribute("href") ||
    doc.querySelector("[href]")?.getAttribute("href") ||
    null;

  // Episoder
  const items = Array.from(doc.querySelectorAll("item")).map((item) => {
    const enclosure = item.querySelector("enclosure");
    const audioUrl = enclosure?.getAttribute("url") || null;

    const guid =
      item.querySelector("guid")?.textContent?.trim() ||
      audioUrl ||
      item.querySelector("title")?.textContent?.trim();

    const durationRaw =
      item.querySelector("itunes\\:duration")?.textContent?.trim() ||
      item.querySelector("duration")?.textContent?.trim() ||
      "";
    const duration = parseDuration(durationRaw);

    const pubDateStr = item.querySelector("pubDate")?.textContent?.trim();
    const pubDate = pubDateStr ? new Date(pubDateStr).toISOString() : null;

    const episodeCover =
      item.querySelector("itunes\\:image, image[href]")?.getAttribute("href") ||
      null;

    return {
      id:       guid,
      title:    item.querySelector("title")?.textContent?.trim() || "Ukjent",
      audioUrl,
      duration,           // sekunder (tall) eller null
      pubDate,
      cover:    episodeCover || cover || null,
    };
  }).filter(ep => ep.audioUrl); // kast episoder uten lyd-URL

  return { cover, items };
}

// ── Konverter itunes:duration til sekunder ────────────────────────
// Format: "HH:MM:SS", "MM:SS", eller rå sekunder som streng
function parseDuration(str) {
  if (!str) return null;
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = Number(str);
  return isNaN(n) ? null : n;
}

// ── Finn én episode i en feed ved tittel-match ────────────────────
// Brukes for å slå opp én spesifikk episode fra en feed
// matchTitle: streng som skal finnes i episodetittelen (case-insensitiv)
export async function findEpisodeByTitle(rssUrl, matchTitle) {
  const { items } = await fetchRssFeed(rssUrl);
  const lower = matchTitle.toLowerCase();
  return items.find(ep => ep.title.toLowerCase().includes(lower)) || null;
}

// ── Hent lydURL for én episode (til velgNrk) ─────────────────────
// Returnerer audioUrl direkte fra RSS-feeden
export async function fetchRssAudioUrl(rssUrl, episodeTitle) {
  const ep = await findEpisodeByTitle(rssUrl, episodeTitle);
  if (!ep?.audioUrl) throw new Error(`Episode ikke funnet i RSS: ${episodeTitle}`);
  return ep.audioUrl;
}

// ── Hent cover for en hel serie (til cover-lasting) ──────────────
export async function fetchRssCover(rssUrl) {
  try {
    const { cover } = await fetchRssFeed(rssUrl);
    return cover;
  } catch {
    return null;
  }
}
