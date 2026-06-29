// ── rss.js — RSS-parser og cache for Pleiboks ────────────────────
// NRK blokkerer direktefetch fra nettleseren (CORS).
// Vi ruter alle RSS-kall gjennom /api/rss?url=... (Vercel proxy).

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function proxyUrl(url) {
  return `/api/rss?url=${encodeURIComponent(url)}`;
}

export async function fetchRssFeed(url) {
  const cacheKey = `rss_cache_${encodeURIComponent(url)}`;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) return parsed;
    }
  } catch {}

  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`RSS proxy feilet: ${res.status}`);
  const text = await res.text();
  const result = parseRss(text);

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ...result, fetchedAt: Date.now() }));
  } catch {}

  return result;
}

function parseRss(xmlText) {
  // Strip namespace-prefixer før parsing — DOMParser håndterer
  // ikke itunes: pålitelig i Safari.
  const cleaned = xmlText
    .replace(/itunes:/g, "itunes_")
    .replace(/media:/g, "media_")
    .replace(/dc:/g, "dc_");

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "text/xml");

  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("XML parse-feil: " + parseErr.textContent.slice(0, 100));

  const channel = doc.querySelector("channel");
  const cover =
    channel?.querySelector("itunes_image")?.getAttribute("href") ||
    channel?.querySelector("image > url")?.textContent?.trim() ||
    null;

  const items = Array.from(doc.querySelectorAll("item")).map((item) => {
    const enclosure = item.querySelector("enclosure");
    const audioUrl  = enclosure?.getAttribute("url") || null;

    const guid =
      item.querySelector("guid")?.textContent?.trim() ||
      audioUrl ||
      item.querySelector("title")?.textContent?.trim();

    const durationRaw =
      item.querySelector("itunes_duration")?.textContent?.trim() || "";

    const pubDateStr = item.querySelector("pubDate")?.textContent?.trim();
    const pubDate = pubDateStr ? new Date(pubDateStr).toISOString() : null;

    const episodeCover =
      item.querySelector("itunes_image")?.getAttribute("href") || null;

    return {
      id:       guid,
      title:    item.querySelector("title")?.textContent?.trim() || "Ukjent",
      audioUrl,
      duration: parseDuration(durationRaw),
      pubDate,
      cover:    episodeCover || cover || null,
    };
  }).filter(ep => ep.audioUrl);

  return { cover, items };
}

function parseDuration(str) {
  if (!str) return null;
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = Number(str);
  return isNaN(n) ? null : n;
}

export async function fetchRssAudioUrl(rssUrl, episodeTitle) {
  const { items } = await fetchRssFeed(rssUrl);
  const lower = episodeTitle.toLowerCase();

  const ep =
    items.find(e => e.title.toLowerCase() === lower) ||
    items.find(e => e.title.toLowerCase().includes(lower)) ||
    items.find(e => lower.includes(e.title.toLowerCase()));

  if (!ep?.audioUrl) throw new Error(`Episode ikke funnet i RSS: ${episodeTitle}`);
  return ep.audioUrl;
}

export async function fetchRssCover(rssUrl) {
  try {
    const { cover } = await fetchRssFeed(rssUrl);
    return cover;
  } catch {
    return null;
  }
}
