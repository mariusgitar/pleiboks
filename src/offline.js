// ── Offline-lagring av NRK-episoder ───────────────────────────────
// Alle MP3-episoder i episodelisten lastes ned automatisk (én om gangen)
// og lagres i Cache API. Episoder som fjernes fra listen slettes.
// HLS-programmer (programType: "program") hoppes over — de spilles bare med nett.

const CACHE = "pleiboks-lyd-v1";
const META_KEY = "pb_offline_meta"; // { [id]: { bytes, dato } }
const key = (id) => `/offline-lyd/${id}`;

export const kanLagres = (item) => item.programType !== "program";

function lesMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function skrivMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}

export function lagredeIder() {
  return new Set(Object.keys(lesMeta()));
}

export function status(sections) {
  const meta = lesMeta();
  const aktuelle = sections.flatMap(s => s.items).filter(kanLagres);
  const lagret = aktuelle.filter(i => meta[i.id]);
  return {
    lagret: lagret.length,
    totalt: aktuelle.length,
    bytes: lagret.reduce((n, i) => n + (meta[i.id].bytes || 0), 0),
  };
}

// Returnerer en blob-URL for lokal kopi, eller null.
export async function lokalUrl(id) {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(key(id));
    if (!res) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

function erMobildata() {
  const c = navigator.connection;
  return !!(c && (c.type === "cellular" || c.saveData));
}

let kjorer = false;
let igjen = null;

// hentLydUrl(item) → direkte MP3-URL (bruker samme manifest-oppslag som avspilling)
// onEndring(info) kalles etter hver nedlastet/slettet fil, så UI kan oppdatere status.
// info = { aktiv: true|false } når en nedlastingsrunde starter/slutter.
export async function synk(sections, hentLydUrl, onEndring) {
  if (!("caches" in window)) return;
  if (kjorer) { igjen = sections; return; }
  kjorer = true;
  try {
    try { await navigator.storage?.persist?.(); } catch {}

    const cache = await caches.open(CACHE);
    const meta = lesMeta();
    const onsket = new Map();
    sections.forEach(s => s.items.filter(kanLagres).forEach(i => onsket.set(i.id, i)));

    // Rydd: slett filer som ikke lenger står i listen
    for (const req of await cache.keys()) {
      const id = new URL(req.url).pathname.replace("/offline-lyd/", "");
      if (!onsket.has(id)) {
        await cache.delete(req);
        delete meta[id];
        skrivMeta(meta);
        onEndring?.();
      }
    }
    // Meta uten fil (f.eks. cache tømt av systemet) → glem den
    for (const id of Object.keys(meta)) {
      if (!(await cache.match(key(id)))) { delete meta[id]; skrivMeta(meta); onEndring?.(); }
    }

    // Last ned det som mangler — bare uten mobildata og med nett
    const mangler = [...onsket].filter(([id]) => !meta[id]);
    if (mangler.length && navigator.onLine && !erMobildata()) {
      onEndring?.({ aktiv: true });
      for (const [id, item] of mangler) {
        if (!navigator.onLine || erMobildata()) break;
        try {
          const url = await hentLydUrl(item);
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          // Strøm rett til cache — hele fila holdes aldri i minnet
          let bytes = parseInt(res.headers.get("content-length")) || 0;
          await cache.put(key(id), res);
          if (!bytes) bytes = (await (await cache.match(key(id))).blob()).size;
          if (bytes < 10000) { await cache.delete(key(id)); throw new Error("For liten fil"); }
          meta[id] = { bytes, dato: new Date().toISOString() };
          skrivMeta(meta);
          onEndring?.();
        } catch (e) {
          console.warn("Offline-nedlasting feilet:", item.title, e.message);
        }
      }
    }
  } finally {
    kjorer = false;
    onEndring?.({ aktiv: false });
    if (igjen) { const s = igjen; igjen = null; synk(s, hentLydUrl, onEndring); }
  }
}
