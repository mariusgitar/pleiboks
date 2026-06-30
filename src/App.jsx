import { useState, useEffect, useRef, memo, useCallback } from "react";
import { fetchRssFeed, fetchRssAudioUrl, fetchRssCover } from "./rss.js";

// ── Innholdsdata ──────────────────────────────────────────────────
// source: "rss"  → henter lyd og cover fra RSS-feed (robust, ingen proxy)
// source: "api"  → bruker psapi.nrk.no via Vercel proxy (fallback)
// rssUrl på seksjon: brukes til cover-lasting og episode-oppslag
// rssUrl på item: overstyrer seksjonens feed (f.eks. BlimE fra musik-feed)

const RSS = {
  halloBablo:             "https://podkast.nrk.no/program/hallo_bablo.rss",
  kokosbananas:           "https://podkast.nrk.no/program/kokosbananas.rss",
  // Fantorangen og Fantorangenfortellinger er samme feed
  fantorangenfortellinger:"https://podkast.nrk.no/program/fantorangenfortellinger.rss",
  brannbamsenBjornis:     "https://podkast.nrk.no/program/brannbamsen_bjoernis.rss",
  // BlimE, Fantus musikantus, Fantorangens verden har ikke egne RSS-feeds —
  // disse bruker psapi-IDer (source: "api")
};

const NRK_SECTIONS = [
  {
    id: "hallo-bablo", label: "Hallo Bablo", icon: "📚",
    accent: "#1B6B8A", color: "#E3F2F9",
    source: "rss", rssUrl: RSS.halloBablo,
    items: [
      { id: "hb-oversvommelse",    title: "Oversvømmelse",               emoji: "🌊", source: "rss" },
      { id: "hb-ja-dag",           title: "Ja-dag",                      emoji: "✅", source: "rss" },
      { id: "hb-superlimet",       title: "Superlimet",                  emoji: "🔧", source: "rss" },
      { id: "hb-lottes-banneshow", title: "Lottes banneshow",            emoji: "🤐", source: "rss" },
      { id: "hb-fiskoteket",       title: "Fiskoteket",                  emoji: "🐟", source: "rss" },
      { id: "hb-dinosaurmysteriet",title: "Dinosaurmysteriet",           emoji: "🦕", source: "rss" },
      { id: "hb-det-snor-inne",    title: "Det snør inne",               emoji: "❄️", source: "rss" },
      { id: "hb-egget",            title: "Hva er inni det store egget?",emoji: "🥚", source: "rss" },
      { id: "hb-lotte-leker-dod",  title: "Lotte leker død",            emoji: "💀", source: "rss" },
      { id: "hb-bremsespor",       title: "Bremsespor-mysteriet",        emoji: "🚗", source: "rss" },
      { id: "hb-fantasibygging",   title: "Fantasibygging",              emoji: "🏗️", source: "rss" },
    ],
  },
  {
    id: "kokosbananas", label: "Kokosbananas", icon: "🥥",
    accent: "#B85A00", color: "#FFF0DC",
    source: "rss", rssUrl: RSS.kokosbananas,
    items: [
      { id: "kok-sykkel",    title: "Superdupersykkelen", emoji: "🚲", source: "rss" },
      { id: "kok-melon",     title: "Melonhvalen",        emoji: "🍉🐋", source: "rss" },
      { id: "kok-brakebyraa",title: "Bråkebyrået",        emoji: "🔊", source: "rss" },
    ],
  },
  {
    // Kjempe-Fantus, Fantus forsvinn etc. er fra 2024 og kan falle ut av RSS-feed.
    // Bruker psapi-IDer for pålitelig avspilling.
    id: "fantorangen", label: "Fantorangen", icon: "🧡",
    accent: "#D4700A", color: "#FFF3DC",
    source: "api",
    items: [
      { id: "l_8e42fb20-bb6f-404c-82fb-20bb6f004c5f", title: "Kjempe-Fantus",   emoji: "🌳", source: "api" },
      { id: "l_01779e9e-49ad-41ff-b79e-9e49ad11ffc0", title: "Fantus forsvinn",  emoji: "📺", source: "api" },
      { id: "l_9124669c-0fc4-4660-a466-9c0fc4b6609a", title: "Tryllerydding",    emoji: "🪄", source: "api" },
    ],
  },
  {
    // Gøy natt er fersk nok til å være i RSS. Bursdagen/Superdropsa (27. mars) og
    // Fantorangen sit fast i do (04.07.2025) har falt ut av RSS-feedens vindu —
    // bruker psapi-IDer for disse i stedet.
    id: "fantorangenfortellinger", label: "Fantorangenfortellinger", icon: "🎭",
    accent: "#B85A00", color: "#FFF3DC",
    source: "rss", rssUrl: RSS.fantorangenfortellinger,
    items: [
      { id: "ff-goy-natt",                                  title: "Gøy natt",                 emoji: "🌙", source: "rss" },
      { id: "l_f17536cc-f908-4c2d-b536-ccf908ec2df1",       title: "Bursdagen",                emoji: "🎂", source: "api" },
      { id: "l_55d4584b-3c22-48a6-9458-4b3c2278a6f4",       title: "Superdropsa",              emoji: "🍬", source: "api" },
      { id: "l_1d43056a-1d70-40e3-8305-6a1d7090e32d",       title: "Fantorangen sit fast i do", emoji: "🚽", source: "api" },
    ],
  },
  {
    // Karsten og Petra: ingen RSS — beholder psapi
    id: "karsten-petra", label: "Karsten og Petra", icon: "👫",
    accent: "#2D6B4A", color: "#E8F5EE",
    source: "api",
    items: [
      { id: "MKTT05000605", title: "Bestevenner",                 emoji: "🤝", source: "api", programType: "program" },
      { id: "MKTT05000505", title: "Petra begynner i barnehagen", emoji: "🏫", source: "api", programType: "program" },
      { id: "MKTT04000104", title: "Karsten kjører brannbil",     emoji: "🚒", source: "api", programType: "program" },
    ],
  },
  {
    id: "blime", label: "BlimE!", icon: "🌈",
    accent: "#4f46e5", color: "#EDE8FF",
    source: "api",
    items: [
      { id: "l_bd313b9d-5f6b-44a1-b13b-9d5f6b84a16b", title: "Kom igjen 'a",  emoji: "🎤", source: "api" },
      { id: "l_2ae9578e-b9ef-4451-a957-8eb9ef0451f2", title: "Halloween",     emoji: "🎃", source: "api" },
      { id: "l_184d0d69-e4ba-4316-8d0d-69e4bad3165a", title: "Kua mi",        emoji: "🐄", source: "api" },
      { id: "l_227c72ee-f0d8-477e-bc72-eef0d8877e3e", title: "Ferdig snakka", emoji: "🤫", source: "api" },
      { id: "l_ee431198-066e-4814-8311-98066e98148b", title: "Være med",      emoji: "🙌", source: "api" },
      { id: "l_ff643c27-b82e-44bd-a43c-27b82e34bd5f", title: "Sveve høyt",    emoji: "🪁", source: "api" },
      { id: "l_2a2d7975-67b3-48e2-ad79-7567b3c8e2ba", title: "Dynamitt",      emoji: "💥", source: "api" },
      { id: "l_d8d2e266-5ed9-41e0-92e2-665ed9b1e074", title: "Ser deg",       emoji: "👀", source: "api" },
    ],
  },
  {
    id: "fantus-musikantus", label: "Fantus musikantus", icon: "🎹",
    accent: "#D4700A", color: "#FFF3DC",
    source: "api",
    items: [
      { id: "l_25663b06-aad8-4b84-a63b-06aad84b841a", title: "Hjulene på bussen", emoji: "🚌", source: "api" },
      { id: "l_704cb2d9-785e-4907-8cb2-d9785e490790", title: "Ma me mo",          emoji: "🎵", source: "api" },
      { id: "l_7514e801-f102-40bf-94e8-01f10200bffb", title: "Eggesangen",        emoji: "🥚", source: "api" },
      { id: "l_d121604d-3d7f-4c8c-a160-4d3d7f9c8cc9", title: "Fader Jakob",       emoji: "🔔", source: "api" },
      { id: "l_a0ef8d4a-c61d-4009-af8d-4ac61d3009ad", title: "Klappesangen",      emoji: "👏", source: "api" },
    ],
  },
  {
    id: "musikk-fantorangens-verden", label: "Fantorangens verden", icon: "🎶",
    accent: "#D4700A", color: "#FFF3DC",
    source: "api",
    items: [
      { id: "l_b34a81e1-a911-4824-8a81-e1a9118824e2", title: "Snibel Snabel",   emoji: "🐘", source: "api" },
      { id: "l_d2c4eeae-55c8-4cfc-84ee-ae55c80cfc0d", title: "Tannpussesangen", emoji: "🪥", source: "api" },
      { id: "l_08f018af-0656-48dd-b018-af065638ddd4", title: "Sjøbanan",        emoji: "🍌", source: "api" },
      { id: "l_6c29c28c-69a1-43ef-a9c2-8c69a1b3efab", title: "Ryddesang",       emoji: "🧹", source: "api" },
      { id: "l_5e1b5f7f-abe9-4c8a-9b5f-7fabe9bc8a9f", title: "Tallsangen",      emoji: "🔢", source: "api" },
      { id: "l_7733df85-6d87-4e44-b3df-856d876e44cb", title: "Bæsjesangen",     emoji: "💩", source: "api" },
    ],
  },
  {
    id: "brannbamsen-bjornis", label: "Brannbamsen Bjørnis", icon: "🧸",
    accent: "#C0392B", color: "#FDECEA",
    source: "rss", rssUrl: RSS.brannbamsenBjornis,
    items: [
      { id: "bb-finger",   title: "Fingeren sitter fast", emoji: "🤞", source: "rss" },
      { id: "bb-vinden",   title: "Tatt av vinden",       emoji: "💨", source: "rss" },
      { id: "bb-biblio",   title: "På biblioteket",       emoji: "📖", source: "rss" },
      { id: "bb-hund",     title: "Hund i fare",          emoji: "🐕", source: "rss" },
      { id: "bb-stranda",  title: "Tur på stranda",       emoji: "🏖️", source: "rss" },
    ],
  },
];

const SPOTIFY_SECTION = {
  id: "spotify", label: "Musikk", icon: "🎵",
  accent: "#6D28D9", color: "#EDE8FF",
  items: [
    { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake",              artist: "Kutoppen & Lisa Børud",          emoji: "🥤" },
    { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested",            artist: "Kutoppen & Klara",               emoji: "🌈" },
    { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru",                   artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
    { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare",               artist: "Kutoppen & Sol Heilo",           emoji: "😄" },
    { id: "2TxCwUlqaOH3TIyJqGgR91", uri: "spotify:track:2TxCwUlqaOH3TIyJqGgR91", title: "Mamma Mia",            artist: "ABBA",                           emoji: "💃" },
    { id: "5BckPAYcKEJuYs1eV1BHHe", uri: "spotify:track:5BckPAYcKEJuYs1eV1BHHe", title: "Take A Chance On Me",  artist: "ABBA",                           emoji: "🎲" },
    { id: "0J2p4KYdr6Mg4ET6JPlbe1", uri: "spotify:track:0J2p4KYdr6Mg4ET6JPlbe1", title: "Super Trouper",        artist: "ABBA",                           emoji: "🌟" },
    { id: "5lVR0Vs7ArN4H3aINtqOp2", uri: "spotify:track:5lVR0Vs7ArN4H3aINtqOp2", title: "Stor Stjerne",         artist: "",                               emoji: "⭐" },
    { id: "2RLEsQw1rGsoGgMjRF1MRl", uri: "spotify:track:2RLEsQw1rGsoGgMjRF1MRl", title: "Ryddetid i barnehagen",artist: "",                               emoji: "🧹" },
    { id: "14Jj4ua0vyRkzCao3gbxGh", uri: "spotify:track:14Jj4ua0vyRkzCao3gbxGh", title: "Gi Meg Slim",          artist: "",                               emoji: "🟢" },
    { id: "0tNP8wQGYCNPlJe31ef86t", uri: "spotify:track:0tNP8wQGYCNPlJe31ef86t", title: "Alene Er Jeg Suveren", artist: "",                               emoji: "🦸" },
    { id: "2t9PjZ9bX4VPPzJnJ3tN8H", uri: "spotify:track:2t9PjZ9bX4VPPzJnJ3tN8H", title: "Fisk Og Brokkoli",    artist: "",                               emoji: "🐟" },
    { id: "5vNRhkKd0yEAg8suGBpjeY", uri: "spotify:track:5vNRhkKd0yEAg8suGBpjeY", title: "APT.",                 artist: "ROSÉ & Bruno Mars",              emoji: "🌹" },
  ],
};

const SHOW_SPOTIFY = true;

// ── Foreldrekontroll ───────────────────────────────────────────────
// Endre PIN her ved behov. Lagres ikke noe sted — bare i kildekoden.
const PARENT_PIN = "1234";

const LS_KEYS = {
  mode:          "pb_mode",            // "mini" | "junior"
  miniIds:       "pb_mini_ids",        // JSON array av valgte item-IDer
  onboarded:     "pb_onboarded",       // "1" når onboarding er fullført
  spotifyEnabled:"pb_spotify_enabled", // "1" | "0" — global bryter for begge moduser
};

function loadMode() {
  try { return localStorage.getItem(LS_KEYS.mode) || "junior"; }
  catch { return "junior"; }
}
function saveMode(mode) {
  try { localStorage.setItem(LS_KEYS.mode, mode); } catch {}
}
function loadMiniIds() {
  try {
    const raw = localStorage.getItem(LS_KEYS.miniIds);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveMiniIds(ids) {
  try { localStorage.setItem(LS_KEYS.miniIds, JSON.stringify(ids)); } catch {}
}
function loadOnboarded() {
  try { return localStorage.getItem(LS_KEYS.onboarded) === "1"; }
  catch { return false; }
}
function saveOnboarded() {
  try { localStorage.setItem(LS_KEYS.onboarded, "1"); } catch {}
}
function loadSpotifyEnabled() {
  try {
    const v = localStorage.getItem(LS_KEYS.spotifyEnabled);
    return v === null ? true : v === "1"; // default: på
  } catch { return true; }
}
function saveSpotifyEnabled(enabled) {
  try { localStorage.setItem(LS_KEYS.spotifyEnabled, enabled ? "1" : "0"); } catch {}
}

// ── API ───────────────────────────────────────────────────────────
async function fetchNrkManifest(id, programType) {
  const endpoint = programType === "program" ? "program" : "podcast";
  const res = await fetch(`/api/manifest?id=${id}&type=${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const assets = data?.playable?.assets;
  if (!assets?.length) throw new Error("Ingen assets");
  const mp3 = assets.find((a) => a.format === "MP3") || assets[0];
  if (!mp3?.url) throw new Error("Ingen URL");
  return mp3.url;
}

async function fetchNrkCover(id, programType) {
  try {
    const endpoint = programType === "program" ? "program" : "podcast";
    const res = await fetch(`/api/metadata?id=${id}&type=${endpoint}`);
    if (!res.ok) return null;
    const data = await res.json();
    const images = data?.preplay?.poster?.images || data?.preplay?.images || data?.images || data?.image;
    if (!images) return null;
    const arr = Array.isArray(images) ? images : [images];
    return arr.filter((i) => i?.url).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;
  } catch { return null; }
}

async function getMe() {
  try { const res = await fetch("/api/me"); if (!res.ok) return null; return res.json(); }
  catch { return null; }
}

async function fetchSpotifyCovers(tracks) {
  const results = await Promise.all(tracks.map((t) =>
    fetch(`/api/spotify-track?id=${t.id}`).then((r) => r.ok ? r.json() : null).catch(() => null)
  ));
  const map = {};
  results.forEach((r, i) => { if (r?.album?.images?.[0]?.url) map[tracks[i].id] = r.album.images[0].url; });
  return map;
}

async function spotifyPlay(uri, accessToken) {
  const res = await fetch("/api/spotify-play", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackUri: uri, accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ukjent feil");
}

async function spotifyPause(accessToken) {
  await fetch("/api/spotify-pause", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// ── SVG-ikoner ────────────────────────────────────────────────────
function PlayIcon({ size = 22, color = "#fff" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><polygon points="7,4 20,12 7,20" fill={color}/></svg>;
}
function PauseIcon({ size = 22, color = "#fff" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="4.5" height="16" rx="2" fill={color}/><rect x="14.5" y="4" width="4.5" height="16" rx="2" fill={color}/></svg>;
}
function PrevIcon({ size = 22, color = "rgba(255,255,255,0.75)" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><polygon points="13,5 3,12 13,19" fill={color}/><rect x="14" y="5" width="5" height="14" rx="1.5" fill={color}/></svg>;
}
function NextIcon({ size = 22, color = "rgba(255,255,255,0.75)" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><polygon points="11,5 21,12 11,19" fill={color}/><rect x="5" y="5" width="5" height="14" rx="1.5" fill={color}/></svg>;
}

// ── Bakgrunnsdekor ────────────────────────────────────────────────
function SkyBg({ onSunTap }) {
  return (
    <>
      <div style={{ position:"fixed", inset:0, zIndex:0, background:"linear-gradient(180deg,#AEE4FF 0%,#C8F0FF 45%,#DAFFC8 100%)", pointerEvents:"none" }} />
      {[
        { top:"7%",  delay:0,   dur:"38s", size:"2rem"   },
        { top:"15%", delay:-18, dur:"52s", size:"1.5rem" },
        { top:"4%",  delay:-30, dur:"44s", size:"2.2rem" },
      ].map((c, i) => (
        <div key={i} style={{
          position:"fixed", top:c.top, left:"-80px", fontSize:c.size,
          opacity:0.5, pointerEvents:"none", zIndex:0,
          animation:`cloudDrift ${c.dur} linear ${c.delay}s infinite`,
        }}>☁️</div>
      ))}
      {/* Sola — skjult inngang til foreldrepanel: trykk 5 ganger */}
      <div
        onClick={onSunTap}
        style={{
          position:"fixed", top:"1rem", right:"1rem", fontSize:"2.6rem",
          pointerEvents:"auto", zIndex:5, cursor:"default",
          animation:"sunSpin 22s linear infinite",
          padding:"0.5rem", margin:"-0.5rem", // større trykkflate uten å endre visuell størrelse
        }}
      >☀️</div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:0, fontSize:"1.8rem", letterSpacing:"-0.25rem", textAlign:"center", opacity:0.3, pointerEvents:"none", lineHeight:1 }}>🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿</div>
    </>
  );
}

// ── Spotify voksen-modal ──────────────────────────────────────────
function SpotifyVoksenModal({ onRetry, onDismiss }) {
  const [showGuide, setShowGuide] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  async function handleReconnect() {
    setReconnecting(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } catch {}
    // Tving ny innlogging — sender til Spotify OAuth
    window.location.href = "/api/login";
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", fontFamily:"'Nunito',system-ui,sans-serif" }} onClick={onDismiss}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background:"#fff", width:"100%", borderRadius:"20px 20px 0 0", padding:"24px 24px 40px", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🎵</div>
          <h2 style={{ fontWeight:900, color:"#1B4D5C", fontSize:22, margin:"0 0 8px" }}>Musikken er ikke klar!</h2>
          <p style={{ color:"#555", fontWeight:700, fontSize:15, margin:0 }}>Hent en voksen — de vet hva de skal gjøre 😊</p>
        </div>

        <button onClick={()=>setShowGuide(!showGuide)} style={{ display:"block", width:"100%", background:"none", border:"2px solid #1B4D5C", borderRadius:12, padding:"10px 20px", color:"#1B4D5C", fontWeight:800, fontSize:14, cursor:"pointer", marginBottom:12, fontFamily:"inherit" }}>
          {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
        </button>

        {showGuide && (
          <div style={{ background:"#f8f8f8", borderRadius:16, padding:"16px 20px", marginBottom:12 }}>
            {["Åpne Spotify-appen på denne iPaden","Spill en hvilken som helst sang i noen sekunder","Gå tilbake til denne appen",'Trykk "Prøv igjen" nedenfor'].map((step,i)=>(
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:"#F5C842", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:12, flexShrink:0, color:"#1B4D5C" }}>{i+1}</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#333", lineHeight:1.4, paddingTop:3 }}>{step}</div>
              </div>
            ))}
          </div>
        )}

        {/* Koble til på nytt — tving ny OAuth-login */}
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          style={{ display:"block", width:"100%", background:"none", border:"2px solid #aaa", borderRadius:12, padding:"10px 20px", color:"#666", fontWeight:800, fontSize:13, cursor:"pointer", marginBottom:12, fontFamily:"inherit" }}
        >
          {reconnecting ? "Kobler til…" : "🔄 Koble appen til Spotify på nytt"}
        </button>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onDismiss} style={{ flex:1, background:"#fff", color:"#1B4D5C", border:"2px solid #1B4D5C", borderRadius:14, padding:"12px", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Avbryt</button>
          <button onClick={onRetry} style={{ flex:2, background:"#1B4D5C", color:"#fff", border:"none", borderRadius:14, padding:"12px", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Prøv igjen</button>
        </div>
      </div>
    </div>
  );
}

// ── PIN-modal for foreldretilgang ──────────────────────────────────
function ParentPinModal({ onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  function press(digit) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (next === PARENT_PIN) {
        setTimeout(onSuccess, 150);
      } else {
        setShake(true);
        setTimeout(() => { setPin(""); setShake(false); }, 450);
      }
    }
  }
  function backspace() { setPin(p => p.slice(0, -1)); }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:300,
      background:"rgba(10,20,30,0.92)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Nunito',system-ui,sans-serif", padding:"0 32px",
    }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🔒</div>
      <div style={{ color:"#fff", fontWeight:900, fontSize:18, marginBottom:4 }}>Foreldretilgang</div>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:13, fontWeight:700, marginBottom:24 }}>Skriv inn PIN-kode</div>

      <div style={{
        display:"flex", gap:14, marginBottom:32,
        animation: shake ? "shakeX 0.4s ease" : "none",
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:16, height:16, borderRadius:"50%",
            background: i < pin.length ? "#fff" : "rgba(255,255,255,0.2)",
            border: "2px solid rgba(255,255,255,0.3)",
            transition:"background 0.15s",
          }} />
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 64px)", gap:14, marginBottom:20 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} style={{
            width:64, height:64, borderRadius:"50%",
            background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.18)",
            color:"#fff", fontSize:24, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
          }}>{n}</button>
        ))}
        <div />
        <button onClick={() => press("0")} style={{
          width:64, height:64, borderRadius:"50%",
          background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.18)",
          color:"#fff", fontSize:24, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
        }}>0</button>
        <button onClick={backspace} style={{
          width:64, height:64, borderRadius:"50%",
          background:"none", border:"none",
          color:"rgba(255,255,255,0.6)", fontSize:20, cursor:"pointer", fontFamily:"inherit",
        }}>⌫</button>
      </div>

      <button onClick={onCancel} style={{
        background:"none", border:"none", color:"rgba(255,255,255,0.4)",
        fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", padding:10,
      }}>Avbryt</button>

      <style>{`@keyframes shakeX { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  );
}

// ── Foreldrepanel: bytt modus og velg Mini-utvalg ─────────────────
function ParentPanel({ mode, setMode, miniIds, setMiniIds, spotifyEnabled, setSpotifyEnabled, onClose }) {
  function toggleItem(id) {
    setMiniIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const allSections = [...NRK_SECTIONS, ...((SHOW_SPOTIFY && spotifyEnabled) ? [SPOTIFY_SECTION] : [])];

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:250,
      background:"#FAF7F4", overflowY:"auto",
      fontFamily:"'Nunito',system-ui,sans-serif",
    }}>
      <div style={{ position:"sticky", top:0, background:"#1B4D5C", padding:"20px 20px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:1 }}>
        <div>
          <div style={{ color:"#F5C842", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }}>Foreldrepanel</div>
          <div style={{ color:"#fff", fontSize:20, fontWeight:900 }}>Innstillinger</div>
        </div>
        <button onClick={onClose} style={{
          width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.15)",
          border:"none", color:"#fff", fontSize:18, cursor:"pointer", fontFamily:"inherit",
        }}>✕</button>
      </div>

      <div style={{ padding:"20px 20px 60px", maxWidth:560, margin:"0 auto" }}>
        {/* Spotify-bryter */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"#fff", borderRadius:16, padding:"14px 16px", marginBottom:24,
          border:"2px solid #eee",
        }}>
          <div>
            <div style={{ fontWeight:900, fontSize:14, color:"#1a1a1a" }}>🎵 Spotify</div>
            <div style={{ fontWeight:700, fontSize:11, color:"#888", marginTop:2 }}>
              {spotifyEnabled ? "Vises i begge moduser" : "Skjult — bruk hvis ustabilt eller uten Premium"}
            </div>
          </div>
          <button
            onClick={() => setSpotifyEnabled(!spotifyEnabled)}
            style={{
              width:52, height:30, borderRadius:15, padding:3,
              background: spotifyEnabled ? "#1B4D5C" : "#ddd",
              border:"none", cursor:"pointer", flexShrink:0,
              transition:"background 0.18s",
            }}
          >
            <div style={{
              width:24, height:24, borderRadius:"50%", background:"#fff",
              transform: spotifyEnabled ? "translateX(22px)" : "translateX(0)",
              transition:"transform 0.18s",
            }} />
          </button>
        </div>

        {/* Modusvalg */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:10 }}>Visningsmodus</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setMode("mini")} style={{
              flex:1, padding:"16px 12px", borderRadius:16,
              background: mode === "mini" ? "#1B4D5C" : "#fff",
              color: mode === "mini" ? "#fff" : "#1a1a1a",
              border: mode === "mini" ? "none" : "2px solid #eee",
              fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit",
              textAlign:"left",
            }}>
              <div style={{ fontSize:22, marginBottom:4 }}>🌱</div>
              Mini
              <div style={{ fontWeight:700, fontSize:11, opacity:0.7, marginTop:2 }}>Få, store valg</div>
            </button>
            <button onClick={() => setMode("junior")} style={{
              flex:1, padding:"16px 12px", borderRadius:16,
              background: mode === "junior" ? "#1B4D5C" : "#fff",
              color: mode === "junior" ? "#fff" : "#1a1a1a",
              border: mode === "junior" ? "none" : "2px solid #eee",
              fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit",
              textAlign:"left",
            }}>
              <div style={{ fontSize:22, marginBottom:4 }}>🌳</div>
              Junior
              <div style={{ fontWeight:700, fontSize:11, opacity:0.7, marginTop:2 }}>Hele katalogen</div>
            </button>
          </div>
        </div>

        {/* Mini-utvalg */}
        {mode === "mini" && (
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:4 }}>Velg innhold for Mini</div>
            <div style={{ fontSize:12, color:"#888", fontWeight:700, marginBottom:14 }}>
              {miniIds.length === 0 ? "Ingen valgt ennå" : `${miniIds.length} valgt`}
            </div>
            {allSections.map(section => (
              <div key={section.id} style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ width:26, height:26, borderRadius:8, background:section.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{section.icon}</div>
                  <span style={{ fontWeight:800, fontSize:14, color:"#1a1a1a" }}>{section.label}</span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {section.items.map(item => {
                    const checked = miniIds.includes(item.id);
                    return (
                      <button key={item.id} onClick={() => toggleItem(item.id)} style={{
                        display:"flex", alignItems:"center", gap:6,
                        padding:"8px 12px", borderRadius:20,
                        background: checked ? section.accent : "#fff",
                        color: checked ? "#fff" : "#555",
                        border: checked ? "none" : "1.5px solid #eee",
                        fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                      }}>
                        <span>{checked ? "✓" : item.emoji}</span>
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onboarding (vises kun første gang) ────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [chosenMode, setChosenMode] = useState("junior");

  const steps = [
    {
      emoji: "🎧",
      title: "Velkommen til Pleiboksen!",
      text: "En enkel lydspiller laget for barn — trygt, lekent og uten reklame.",
    },
    {
      emoji: "🔒",
      title: "Begrenset tilgang",
      text: "Pleiboksen viser bare innholdet du velger som forelder. Du kan alltid endre dette senere ved å trykke 5 ganger på sola øverst i appen.",
    },
    {
      emoji: chosenMode === "mini" ? "🌱" : "🌳",
      title: "Velg en startmodus",
      text: "Mini gir et lite, oversiktlig utvalg. Junior viser hele katalogen. Du kan bytte når som helst i foreldrepanelet.",
      isModeStep: true,
    },
  ];

  const s = steps[step];

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:400,
      background:"linear-gradient(180deg,#AEE4FF 0%,#C8F0FF 45%,#DAFFC8 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"0 32px", fontFamily:"'Nunito',system-ui,sans-serif", textAlign:"center",
    }}>
      <div style={{ fontSize:64, marginBottom:20 }}>{s.emoji}</div>
      <div style={{ fontWeight:900, fontSize:24, color:"#1B4D5C", marginBottom:12, lineHeight:1.2 }}>{s.title}</div>
      <div style={{ fontWeight:700, fontSize:15, color:"#1B4D5C", opacity:0.75, lineHeight:1.5, marginBottom:32, maxWidth:340 }}>{s.text}</div>

      {s.isModeStep && (
        <div style={{ display:"flex", gap:12, marginBottom:32, width:"100%", maxWidth:340 }}>
          <button onClick={() => setChosenMode("mini")} style={{
            flex:1, padding:"18px 12px", borderRadius:18,
            background: chosenMode === "mini" ? "#1B4D5C" : "#fff",
            color: chosenMode === "mini" ? "#fff" : "#1B4D5C",
            border: chosenMode === "mini" ? "none" : "2px solid #1B4D5C44",
            fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit",
          }}>🌱 Mini</button>
          <button onClick={() => setChosenMode("junior")} style={{
            flex:1, padding:"18px 12px", borderRadius:18,
            background: chosenMode === "junior" ? "#1B4D5C" : "#fff",
            color: chosenMode === "junior" ? "#fff" : "#1B4D5C",
            border: chosenMode === "junior" ? "none" : "2px solid #1B4D5C44",
            fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit",
          }}>🌳 Junior</button>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 8, height:8, borderRadius:4,
            background: i === step ? "#1B4D5C" : "#1B4D5C33",
            transition:"all 0.2s",
          }} />
        ))}
      </div>

      <button
        onClick={() => {
          if (step < steps.length - 1) setStep(step + 1);
          else onDone(chosenMode);
        }}
        style={{
          background:"#1B4D5C", color:"#fff", border:"none",
          borderRadius:16, padding:"14px 36px", fontWeight:900, fontSize:16,
          cursor:"pointer", fontFamily:"inherit",
        }}
      >
        {step < steps.length - 1 ? "Neste" : "Kom i gang!"}
      </button>
    </div>
  );
}

// ── Glødring ──────────────────────────────────────────────────────
function GlowRing({ radius, mini = false }) {
  const t = mini ? 2.5 : 5;
  const g = mini ? 4   : 10;
  const grad = "linear-gradient(135deg,#FF6B6B,#FF9F45,#FFD93D,#6BCB77,#4D96FF,#845EC2,#FF6B6B)";
  return (
    <>
      <div style={{ position:"absolute", inset:-(t+g), borderRadius:radius+t+g, background:grad, filter:`blur(${g}px)`, animation:"glowSwell 3s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"absolute", inset:-t, borderRadius:radius+t, background:grad, animation:"glowSwell 3s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
    </>
  );
}

// ── Coverbilde ────────────────────────────────────────────────────
function CoverImg({ item, sectionColor, size, radius, playing, onClick, mini = false }) {
  const [err, setErr] = useState(false);
  const t   = mini ? 2.5 : 5;
  const g   = mini ? 4   : 10;
  const pad = playing ? t + g : 0;
  return (
    <div onClick={onClick} style={{ position:"relative", width:size+pad*2, height:size+pad*2, display:"flex", alignItems:"center", justifyContent:"center", cursor:onClick?"pointer":"default", flexShrink:0 }}>
      {playing && onClick && <GlowRing radius={radius} mini={mini} />}
      <div style={{ width:size, height:size, borderRadius:radius, overflow:"hidden", background:sectionColor, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:1, flexShrink:0 }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          : <span style={{ fontSize:size*0.46 }}>{item.emoji}</span>
        }
      </div>
    </div>
  );
}

// ── Fullskjerm-spiller ────────────────────────────────────────────
function FullPlayer({ item, section, source, playing, loading, progress, duration, onToggle, onClose, onSeek, onPrev, onNext }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:section.accent, display:"flex", flexDirection:"column", alignItems:"center", padding:"0 32px 48px", fontFamily:"'Nunito',system-ui,sans-serif" }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(0,0,0,0.28) 100%)", pointerEvents:"none" }} />
      <div style={{ position:"relative", zIndex:1, width:"100%", display:"flex", justifyContent:"center", paddingTop:16, paddingBottom:8, cursor:"pointer" }} onClick={onClose}>
        <div style={{ width:36, height:5, borderRadius:3, background:"rgba(255,255,255,0.35)" }} />
      </div>
      <div style={{ position:"relative", zIndex:1, fontSize:"0.68rem", fontWeight:800, color:"rgba(255,255,255,0.5)", letterSpacing:"0.18em", textTransform:"uppercase", marginTop:"auto", marginBottom:"1.2rem" }}>
        {source === "spotify" ? "Kutoppen · Spotify" : "NRK Super"}
      </div>
      <div style={{ position:"relative", zIndex:1, marginBottom:"1.6rem" }}>
        <CoverImg item={item} sectionColor={section.color} size={220} radius={24} playing={playing} onClick={onClose} mini={false} />
      </div>
      <div style={{ position:"relative", zIndex:1, width:"100%", textAlign:"left", marginBottom:"auto" }}>
        <div style={{ color:"#fff", fontSize:"1.5rem", fontWeight:900, lineHeight:1.2, marginBottom:4 }}>{item.title}</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.85rem", fontWeight:700 }}>{item.artist || section.label}</div>
      </div>
      {source !== "spotify" && (
        <div style={{ position:"relative", zIndex:1, width:"100%", marginBottom:8, marginTop:16 }}>
          <div onClick={onSeek} style={{ height:5, background:"rgba(255,255,255,0.22)", borderRadius:3, cursor:"pointer", position:"relative" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:"#fff", borderRadius:3 }} />
            <div style={{ position:"absolute", top:"50%", left:`${pct}%`, transform:"translate(-50%,-50%)", width:14, height:14, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 6px rgba(0,0,0,0.3)" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", color:"rgba(255,255,255,0.32)", fontSize:"0.7rem", fontWeight:700, marginTop:6 }}>
            <span>{formatTime(progress)}</span><span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
      <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:24, marginTop:20 }}>
        <button onClick={onPrev} style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"2px solid rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}><PrevIcon /></button>
        {loading
          ? <div style={{ color:"rgba(255,255,255,0.6)", fontWeight:800, fontSize:14 }}>Laster…</div>
          : <button onClick={onToggle} style={{ width:78, height:78, borderRadius:"50%", background:"#fff", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 6px 22px rgba(0,0,0,0.25)", padding:0 }}>
              {playing ? <PauseIcon size={34} color={section.accent} /> : <PlayIcon size={34} color={section.accent} />}
            </button>
        }
        <button onClick={onNext} style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"2px solid rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}><NextIcon /></button>
      </div>
    </div>
  );
}

// ── FIX 3+4: PbCard og PbSection memoisert utenfor App ───────────
// Disse tar IKKE progress/duration som props — rendres bare når
// activeid, playing eller covers endrer seg.
// ── Mini-modus: store kort, vertikal scroll (prototype-I-stil) ───
const MiniCard = memo(function MiniCard({ item, section, isActive, playing, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} style={{
      display:"block", width:"100%", textAlign:"left",
      background:"#fff", border:"none", borderRadius:24,
      overflow:"hidden", padding:0, cursor:"pointer",
      marginBottom:18, fontFamily:"inherit",
      boxShadow: isActive ? `0 8px 28px ${section.accent}55` : "0 3px 14px rgba(0,0,0,0.10)",
      outline: isActive ? `3px solid ${section.accent}` : "3px solid transparent",
      transition:"all 0.18s ease",
    }}>
      <div style={{
        width:"100%", aspectRatio:"4 / 3",
        background: item.cover ? undefined : `linear-gradient(135deg, ${section.color}, ${section.accent}22)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative", overflow:"hidden",
      }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <span style={{ fontSize:84 }}>{item.emoji}</span>
        }
        {isActive && playing && (
          <div style={{
            position:"absolute", top:14, right:14,
            background:section.accent, borderRadius:24, padding:"7px 14px",
            display:"flex", alignItems:"center", gap:5,
          }}>
            {[0,0.18,0.1].map((d,i)=>(
              <div key={i} style={{ width:4, borderRadius:2, background:"#fff", animation:`eqbar 0.7s ${d}s ease-in-out infinite alternate` }} />
            ))}
            <span style={{ color:"#fff", fontSize:13, fontWeight:800, marginLeft:2 }}>Spiller</span>
          </div>
        )}
      </div>
      <div style={{ padding:"18px 20px 22px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#1a1a1a", lineHeight:1.25 }}>{item.emoji} {item.title}</div>
        </div>
        <div style={{
          width:56, height:56, borderRadius:"50%", flexShrink:0,
          background: isActive ? section.accent : section.accent + "1A",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          {isActive && playing
            ? <PauseIcon size={22} color="#fff" />
            : <PlayIcon size={22} color={isActive ? "#fff" : section.accent} />
          }
        </div>
      </div>
    </button>
  );
});

const PbCard = memo(function PbCard({ item, section, isActive, playing, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} style={{
      flexShrink:0, width:110, borderRadius:19, overflow:"hidden",
      background:"#fff", border:`3px solid ${isActive ? section.accent : "transparent"}`,
      boxShadow: isActive ? `0 5px 16px ${section.accent}66` : "0 2px 8px rgba(0,0,0,0.09)",
      cursor:"pointer", padding:0, textAlign:"left",
      transition:"transform 0.14s cubic-bezier(.34,1.56,.64,1), border-color 0.14s",
      transform: isActive ? "scale(1.05)" : "scale(1)",
      scrollSnapAlign:"start",
    }}>
      <div style={{ width:"100%", aspectRatio:"1", background:section.color, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          : <span style={{ fontSize:42 }}>{item.emoji}</span>
        }
        {isActive && playing && (
          <div style={{ position:"absolute", bottom:5, right:5, display:"flex", gap:2, alignItems:"flex-end", background:"rgba(0,0,0,0.45)", borderRadius:6, padding:"3px 4px" }}>
            {[0,0.2,0.1].map((d,i)=>(
              <div key={i} style={{ width:3, borderRadius:2, background:"#fff", animation:`eqbar 0.65s ease-in-out ${d}s infinite alternate` }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ padding:"7px 8px 9px", fontSize:"0.78rem", fontWeight:800, color:"#1a1a1a", lineHeight:1.25 }}>
        {item.emoji} {item.title}
      </div>
    </button>
  );
});

const PbSection = memo(function PbSection({ section, covers, activeId, activeSource, playing, onSelect }) {
  const isNrk = section.id !== "spotify";
  return (
    <div style={{ marginBottom:"1rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, paddingLeft:2 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:section.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", flexShrink:0 }}>{section.icon}</div>
        <span style={{ fontSize:"1rem", fontWeight:900, color:"#1a1a1a" }}>{section.label}</span>
        {!isNrk && <span style={{ fontSize:"0.7rem", fontWeight:800, color:section.accent, marginLeft:2 }}>Spotify</span>}
      </div>
      <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8, scrollSnapType:"x mandatory", WebkitOverflowScrolling:"touch" }} className="pb-row">
        {section.items.map((item) => (
          <PbCard
            key={item.id}
            item={{ ...item, cover: covers[item.id] }}
            section={section}
            isActive={activeId === item.id && activeSource === (isNrk ? "nrk" : "spotify")}
            playing={playing}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
      <div style={{ height:1, background:"rgba(27,77,92,0.1)", margin:"0.2rem 0 0.8rem", borderRadius:1 }} />
    </div>
  );
});

// ── Mini-modus: flat, vertikal liste av store kort på tvers av seksjoner ──
const MiniGrid = memo(function MiniGrid({ sections, covers, activeId, source, playing, onSelectNrk, onSelectSpotify }) {
  // Flat ut alle valgte items fra alle seksjoner (NRK + evt. Spotify) til én liste
  const flat = [];
  sections.forEach(section => {
    const isSpotify = section.id === "spotify";
    section.items.forEach(item => {
      flat.push({ item, section, isSpotify });
    });
  });

  return (
    <div>
      {flat.map(({ item, section, isSpotify }) => (
        <MiniCard
          key={item.id}
          item={{ ...item, cover: covers[item.id] }}
          section={section}
          isActive={activeId === item.id && source === (isSpotify ? "spotify" : "nrk")}
          playing={playing}
          onClick={() => isSpotify ? onSelectSpotify(item) : onSelectNrk(item, section)}
        />
      ))}
    </div>
  );
});


// ── iPad spiller — også utenfor App ──────────────────────────────
const IpadPlayer = memo(function IpadPlayer({ activeItem, activeSection, source, playing, loading, progress, duration, onToggle, onPrev, onNext, onSeek }) {
  if (!activeItem || !activeSection) return null;
  return (
    <div style={{ width:"100%", height:"clamp(560px, 72vh, 680px)", background:activeSection.accent, borderRadius:28, display:"flex", flexDirection:"column", padding:"28px 28px 32px", position:"sticky", top:32, alignSelf:"start", overflow:"hidden", boxShadow:"0 10px 36px rgba(0,0,0,0.18)", transition:"background 0.3s" }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,rgba(255,255,255,0.06) 0%,rgba(0,0,0,0.18) 100%)", pointerEvents:"none" }} />
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ color:"rgba(255,255,255,0.55)", fontSize:"0.7rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.18em", textAlign:"center" }}>
          {source === "spotify" ? "Kutoppen · Spotify" : "NRK Super"}
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 0 12px" }}>
          <div style={{ marginBottom:28 }}>
            <CoverImg item={activeItem} sectionColor={activeSection.color} size={230} radius={22} playing={playing} onClick={undefined} mini={false} />
          </div>
          <div style={{ width:"100%", textAlign:"center" }}>
            <div style={{ color:"#fff", fontSize:"1.45rem", fontWeight:900, lineHeight:1.2, marginBottom:6 }}>{activeItem.title}</div>
            <div style={{ color:"rgba(255,255,255,0.58)", fontSize:"0.9rem", fontWeight:700 }}>{activeItem.artist || activeSection.label}</div>
          </div>
        </div>
        <div style={{ width:"100%", marginTop:"auto" }}>
          {source !== "spotify" && (
            <div style={{ width:"100%", marginBottom:22 }}>
              <div onClick={onSeek} style={{ height:5, background:"rgba(255,255,255,0.2)", borderRadius:3, cursor:"pointer", position:"relative" }}>
                <div style={{ height:"100%", width:`${duration ? (progress/duration)*100 : 0}%`, background:"#fff", borderRadius:3 }} />
                <div style={{ position:"absolute", top:"50%", left:`${duration ? (progress/duration)*100 : 0}%`, transform:"translate(-50%,-50%)", width:13, height:13, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 5px rgba(0,0,0,0.3)" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", color:"rgba(255,255,255,0.32)", fontSize:"0.68rem", fontWeight:700, marginTop:5 }}>
                <span>{formatTime(progress)}</span><span>{formatTime(duration)}</span>
              </div>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
            <button onClick={onPrev} style={{ width:48, height:48, borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"2px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}><PrevIcon size={20} /></button>
            {loading
              ? <div style={{ color:"rgba(255,255,255,0.6)", fontWeight:800, fontSize:13 }}>Laster…</div>
              : <button onClick={onToggle} style={{ width:72, height:72, borderRadius:"50%", background:"#fff", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 6px 20px rgba(0,0,0,0.22)", padding:0 }}>
                  {playing ? <PauseIcon size={30} color={activeSection.accent} /> : <PlayIcon size={30} color={activeSection.accent} />}
                </button>
            }
            <button onClick={onNext} style={{ width:48, height:48, borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"2px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}><NextIcon size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Hovedapp ──────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth]                       = useState(null);
  const [nrkCovers, setNrkCovers]             = useState({});
  const [spotifyCovers, setSpotifyCovers]     = useState({});
  const [source, setSource]                   = useState(null);
  const [activeItem, setActiveItem]           = useState(null);
  const [activeSection, setActiveSection]     = useState(null);
  const [playing, setPlaying]                 = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [fullscreen, setFullscreen]           = useState(false);
  const [showVoksen, setShowVoksen]           = useState(false);
  const [pendingTrack, setPendingTrack]       = useState(null);
  const [isWide, setIsWide]                   = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );

  // Foreldrekontroll
  const [mode, setModeState]       = useState(() => loadMode());
  const [miniIds, setMiniIdsState] = useState(() => loadMiniIds());
  const [spotifyEnabled, setSpotifyEnabledState] = useState(() => loadSpotifyEnabled());
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboarded());
  const [showPinModal, setShowPinModal]     = useState(false);
  const [showParentPanel, setShowParentPanel] = useState(false);
  const sunTapCount = useRef(0);
  const sunTapTimer = useRef(null);

  function setMode(m)    { setModeState(m); saveMode(m); }
  function setMiniIds(updater) {
    setMiniIdsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveMiniIds(next);
      return next;
    });
  }
  function setSpotifyEnabled(enabled) { setSpotifyEnabledState(enabled); saveSpotifyEnabled(enabled); }

  function handleSunTap() {
    sunTapCount.current += 1;
    clearTimeout(sunTapTimer.current);
    sunTapTimer.current = setTimeout(() => { sunTapCount.current = 0; }, 1500);
    if (sunTapCount.current >= 5) {
      sunTapCount.current = 0;
      setShowPinModal(true);
    }
  }

  function handleOnboardingDone(chosenMode) {
    setMode(chosenMode);
    saveOnboarded();
    setShowOnboarding(false);
  }

  const audioRef       = useRef(null);
  const requestIdRef   = useRef(0);
  const lastProgressTs = useRef(0);

  // Spotify Web Playback SDK
  const sdkPlayer   = useRef(null);
  const sdkDeviceId = useRef(null);
  const sdkReady    = useRef(false);

  const [nrkUrl, setNrkUrl]     = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { getMe().then((d) => setAuth(d?.loggedIn ? d : false)); }, []);

  useEffect(() => {
    const handler = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    async function loadAllCovers() {
      const map = {};

      // Cache RSS-feeds så vi ikke fetcher samme feed flere ganger
      // (f.eks. musikk_fra_nrk_super brukes av tre seksjoner)
      const feedCache = {};
      async function getFeed(url) {
        if (!feedCache[url]) feedCache[url] = fetchRssFeed(url);
        return feedCache[url];
      }

      await Promise.all(NRK_SECTIONS.map(async (section) => {
        if (section.source === "rss" && section.rssUrl) {
          try {
            const { cover: sectionCover, items: feedItems } = await getFeed(section.rssUrl);

            section.items.forEach(item => {
              // Finn episode i feed ved eksakt eller delvis tittel-match
              // Samme normalisering som rss.js sin fetchRssAudioUrl —
              // KUN eksakt match, ingen "includes"-fallback (ga falske treff).
              const norm = s => s.toLowerCase().normalize("NFKD").replace(/[?!.,:;'’]/g, "").replace(/\s+/g, " ").trim();
              const titleNorm = norm(item.title);
              const feedEp = feedItems.find(ep => norm(ep.title) === titleNorm);

              // Episodespesifikt cover > serie-cover fra feed-header
              map[item.id] = feedEp?.cover || sectionCover || null;
            });
          } catch (e) {
            console.warn("RSS cover-feil:", section.id, e.message);
          }
        } else {
          // API: psapi via Vercel proxy (Karsten og Petra)
          await Promise.all(section.items.map(async (item) => {
            const url = await fetchNrkCover(item.id, item.programType);
            if (url) map[item.id] = url;
          }));
        }
      }));

      setNrkCovers(map);
    }

    loadAllCovers();
  }, []);

  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(SPOTIFY_SECTION.items).then(setSpotifyCovers);
    // Init Spotify SDK når bruker er innlogget
    initSpotifySDK(auth.accessToken);
  }, [auth]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // FIX 1: throttle timeupdate til maks 4 ganger/sekund
    const onTime = () => {
      const now = performance.now();
      if (now - lastProgressTs.current < 250) return;
      lastProgressTs.current = now;
      setProgress(audio.currentTime);
    };
    const onMeta  = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nrkUrl) return;
    audio.src = nrkUrl;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [nrkUrl]);

  // Spotify Web Playback SDK init
  function initSpotifySDK(initialToken) {
    // Last SDK-script én gang
    if (!document.querySelector('script[src*="spotify-player"]')) {
      window.onSpotifyWebPlaybackSDKReady = () => createSDKPlayer(initialToken);
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js";
      document.head.appendChild(s);
    } else if (window.Spotify && !sdkPlayer.current) {
      createSDKPlayer(initialToken);
    }
  }

  function createSDKPlayer(initialToken) {
    if (sdkPlayer.current) return; // allerede opprettet

    const player = new window.Spotify.Player({
      name: "Pleiboksen",
      getOAuthToken: async (cb) => {
        // Prøv refresh om token er gammelt
        try {
          await fetch("/api/refresh", { method: "POST" });
        } catch {}
        const fresh = await getMe();
        cb(fresh?.accessToken || initialToken);
      },
      volume: 0.8,
    });

    player.addListener("ready", ({ device_id }) => {
      sdkDeviceId.current = device_id;
      sdkReady.current = true;
    });
    player.addListener("not_ready", () => {
      sdkReady.current = false;
    });
    player.addListener("authentication_error", () => {
      sdkReady.current = false;
    });
    player.addListener("account_error", () => {
      sdkReady.current = false;
    });

    player.connect();
    sdkPlayer.current = player;
  }

  function stopAll() {
    // Stopp NRK audio
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    // Stopp Spotify SDK om det spiller
    if (sdkPlayer.current && sdkReady.current) {
      sdkPlayer.current.pause().catch(() => {});
    }
    setNrkUrl(null); setPlaying(false); setProgress(0); setDuration(0);
  }

  async function velgNrk(item, section) {
    if (activeItem?.id === item.id && source === "nrk") return;
    const requestId = ++requestIdRef.current;
    stopAll();
    setSource("nrk");
    setActiveItem({ ...item, cover: nrkCovers[item.id] });
    setActiveSection(section);
    setLoading(true);
    setFullscreen(!isWide);
    try {
      let url;
      const itemSource = item.source || section.source || "api";

      if (itemSource === "rss") {
        // RSS: finn episode i feed ved tittel-match, hent direkte lydURL
        const rssUrl = section.rssUrl;
        url = await fetchRssAudioUrl(rssUrl, item.title);
      } else {
        // API: bruk psapi via Vercel proxy (Karsten og Petra m.fl.)
        url = await fetchNrkManifest(item.id, item.programType);
      }

      if (requestId !== requestIdRef.current) return;
      setNrkUrl(url);
    } catch (e) {
      console.error("velgNrk feil:", item.title, e.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  async function velgSpotify(track) {
    if (!auth?.accessToken) { setPendingTrack(track); setShowVoksen(true); return; }
    if (activeItem?.id === track.id && source === "spotify") return;

    // iOS-FIX: activateElement() MÅ kalles synkront fra touch-event.
    // Dette låser opp Safari sin autoplay-blokkering for denne sesjonen.
    // Gjøres FØR enhver await, ellers mister vi touch-event-konteksten.
    if (sdkPlayer.current) {
      try { await sdkPlayer.current.activateElement(); } catch {}
    }

    stopAll();
    setSource("spotify");
    setActiveItem({ ...track, cover: spotifyCovers[track.id] });
    setActiveSection(SPOTIFY_SECTION);
    setLoading(true);
    setFullscreen(!isWide);

    // Ingen while-løkke — deviceId er klar etter SDK-init ved innlogging.
    // Hvis ikke klar ennå: vent maks 2 sek med kortere intervall.
    if (!sdkDeviceId.current) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (!sdkDeviceId.current) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const deviceId = sdkDeviceId.current;

    try {
      const url = deviceId
        ? `/api/spotify-play?device_id=${deviceId}`
        : `/api/spotify-play`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: track.uri, accessToken: auth.accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "feil");

      // Etter play-kommandoen: resume() for å sikre at iOS starter lyden
      if (sdkPlayer.current) {
        try { await sdkPlayer.current.resume(); } catch {}
      }

      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") { setPendingTrack(track); setShowVoksen(true); setFullscreen(false); }
      console.error("Spotify play feil:", e);
    } finally { setLoading(false); }
  }

  async function handleVoksenRetry() {
    setShowVoksen(false);
    const freshAuth = await getMe();
    if (freshAuth?.loggedIn) setAuth(freshAuth);
    if (pendingTrack) { const t = pendingTrack; setPendingTrack(null); setTimeout(() => velgSpotify(t), 300); }
  }

  async function togglePlay() {
    if (source === "nrk") {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) { audio.pause(); setPlaying(false); }
      else { audio.play().then(() => setPlaying(true)); }
    } else if (source === "spotify") {
      if (sdkPlayer.current && sdkReady.current) {
        // iOS-FIX: aktiver AudioContext synkront før togglePlay
        try { await sdkPlayer.current.activateElement(); } catch {}
        await sdkPlayer.current.togglePlay();
        setPlaying(p => !p);
      } else if (auth?.accessToken) {
        if (playing) { await spotifyPause(auth.accessToken); setPlaying(false); }
        else { await spotifyPlay(activeItem.uri, auth.accessToken); setPlaying(true); }
      }
    }
  }

  function getFlattened() {
    const all = [];
    NRK_SECTIONS.forEach(s => s.items.forEach(item => all.push({ item, section: s, type: "nrk" })));
    SPOTIFY_SECTION.items.forEach(item => all.push({ item, section: SPOTIFY_SECTION, type: "spotify" }));
    return all;
  }
  function navigate(dir) {
    const all = getFlattened();
    const idx = all.findIndex(e => e.item.id === activeItem?.id);
    const next = all[idx + dir];
    if (!next) return;
    if (next.type === "nrk") velgNrk(next.item, next.section);
    else velgSpotify(next.item);
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  // Stabile callbacks — hindrer PbSection fra å re-rendre ved progress-oppdatering
  const velgNrkCb     = useCallback(velgNrk,     [nrkCovers, source, activeItem, isWide]);
  const velgSpotifyCb = useCallback(velgSpotify, [auth, spotifyCovers, source, activeItem, isWide]);

  // ── Mini-modus: filtrer seksjoner til kun valgte items ──────────
  const visibleNrkSections = mode === "mini"
    ? NRK_SECTIONS
        .map(s => ({ ...s, items: s.items.filter(i => miniIds.includes(i.id)) }))
        .filter(s => s.items.length > 0)
    : NRK_SECTIONS;

  const visibleSpotifySection = mode === "mini"
    ? { ...SPOTIFY_SECTION, items: SPOTIFY_SECTION.items.filter(i => miniIds.includes(i.id)) }
    : SPOTIFY_SECTION;

  const showSpotifySection = SHOW_SPOTIFY && spotifyEnabled && (mode === "junior" || visibleSpotifySection.items.length > 0);

  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Nunito',system-ui,sans-serif", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        @keyframes cloudDrift { from{transform:translateX(0)} to{transform:translateX(110vw)} }
        @keyframes sunSpin    { from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
        @keyframes glowSwell  { 0%,100%{opacity:0.6;transform:scale(0.97)} 50%{opacity:0.95;transform:scale(1.03)} }
        @keyframes eqbar      { from{height:3px} to{height:13px} }
        @keyframes bob        { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        .pb-row::-webkit-scrollbar { display:none }
      `}</style>

      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}

      {showPinModal && (
        <ParentPinModal
          onSuccess={() => { setShowPinModal(false); setShowParentPanel(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {showParentPanel && (
        <ParentPanel
          mode={mode} setMode={setMode}
          miniIds={miniIds} setMiniIds={setMiniIds}
          spotifyEnabled={spotifyEnabled} setSpotifyEnabled={setSpotifyEnabled}
          onClose={() => setShowParentPanel(false)}
        />
      )}

      <SkyBg onSunTap={handleSunTap} />
      <audio ref={audioRef} />

      {showVoksen && <SpotifyVoksenModal onRetry={handleVoksenRetry} onDismiss={() => setShowVoksen(false)} />}

      {isWide ? (
        // ── iPad: to kolonner ──
        <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns: activeItem ? "340px minmax(0,1fr)" : "minmax(0,1fr)", gap:28, padding:"32px 32px 48px", maxWidth: activeItem ? 1040 : 620, margin:"0 auto", alignItems:"stretch" }}>
          <IpadPlayer
            activeItem={activeItem} activeSection={activeSection} source={source}
            playing={playing} loading={loading} progress={progress} duration={duration}
            onToggle={togglePlay} onPrev={() => navigate(-1)} onNext={() => navigate(1)} onSeek={seek}
          />
          <div style={{ minWidth:0 }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:"1.8rem", animation:"bob 3s ease-in-out infinite", display:"inline-block" }}>🎧</div>
              <h1 style={{ fontSize:"1.6rem", fontWeight:900, color:"#1B4D5C", margin:"0.2rem 0 0" }}>Pleiboksen</h1>
              <p style={{ fontSize:"0.78rem", fontWeight:700, color:"#1B4D5C", opacity:0.5, margin:0 }}>Hva vil du høre?</p>
            </div>
            {visibleNrkSections.map((section) => (
              <PbSection key={section.id} section={section} covers={nrkCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={(item) => velgNrkCb(item, section)} />
            ))}
            {showSpotifySection && (
              <PbSection section={visibleSpotifySection} covers={spotifyCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={velgSpotifyCb} />
            )}
            {showSpotifySection && !auth?.loggedIn && <p style={{ color:"#888", fontSize:"0.75rem", fontWeight:700, textAlign:"center", marginTop:-4, marginBottom:12 }}>🔒 Trykk på en sang for å koble til Spotify</p>}
          </div>
        </div>
      ) : (
        // ── Mobil ──
        <>
          {fullscreen && activeItem && activeSection && (
            <FullPlayer item={activeItem} section={activeSection} source={source} playing={playing} loading={loading} progress={progress} duration={duration} onToggle={togglePlay} onClose={() => setFullscreen(false)} onSeek={seek} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
          )}
          <div style={{ position:"relative", zIndex:1, maxWidth:480, margin:"0 auto", padding:"0 0 120px" }}>
            <div style={{ padding:"3rem 1.1rem 1rem" }}>
              <div style={{ fontSize:"2rem", animation:"bob 3s ease-in-out infinite", display:"inline-block" }}>🎧</div>
              <h1 style={{ fontSize:"1.8rem", fontWeight:900, color:"#1B4D5C", margin:"0.3rem 0 0.1rem" }}>Pleiboksen</h1>
              <p style={{ fontSize:"0.8rem", fontWeight:700, color:"#1B4D5C", opacity:0.5, margin:0 }}>Hva vil du høre?</p>
            </div>
            <div style={{ padding:"0.2rem 1.1rem 0" }}>
              {visibleNrkSections.length === 0 && (mode !== "mini" || !showSpotifySection || visibleSpotifySection.items.length === 0) && (
                <div style={{ textAlign:"center", padding:"40px 20px", color:"#1B4D5C99" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🌱</div>
                  <div style={{ fontWeight:800, fontSize:14 }}>Ingen innhold valgt ennå.</div>
                  <div style={{ fontWeight:700, fontSize:12, marginTop:4 }}>En voksen kan velge innhold i foreldrepanelet.</div>
                </div>
              )}
              {mode === "mini" ? (
                <MiniGrid
                  sections={[...visibleNrkSections, ...(showSpotifySection ? [visibleSpotifySection] : [])]}
                  covers={{ ...nrkCovers, ...spotifyCovers }}
                  activeId={activeItem?.id} source={source} playing={playing}
                  onSelectNrk={velgNrkCb} onSelectSpotify={velgSpotifyCb}
                />
              ) : (
                <>
                  {visibleNrkSections.map((section) => (
                    <PbSection key={section.id} section={section} covers={nrkCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={(item) => velgNrkCb(item, section)} />
                  ))}
                  {showSpotifySection && (
                    <PbSection section={visibleSpotifySection} covers={spotifyCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={velgSpotifyCb} />
                  )}
                </>
              )}
              {showSpotifySection && !auth?.loggedIn && <p style={{ color:"#888", fontSize:"0.75rem", fontWeight:700, textAlign:"center", marginTop:-4, marginBottom:12 }}>🔒 Trykk på en sang for å koble til Spotify</p>}
            </div>
          </div>
          {activeItem && !fullscreen && (
            <div style={{ position:"fixed", bottom:12, left:12, right:12, zIndex:50, maxWidth:456, margin:"0 auto", background:activeSection?.accent || "#1B4D5C", borderRadius:22, padding:"12px 14px 14px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 8px 32px rgba(0,0,0,0.25)", cursor:"pointer" }} onClick={() => setFullscreen(true)}>
              <CoverImg item={activeItem} sectionColor={activeSection?.color || "#E3F2F9"} size={50} radius={12} playing={playing} onClick={(e) => { e.stopPropagation(); setFullscreen(true); }} mini={true} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.65rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Spiller nå</div>
                <div style={{ color:"#fff", fontWeight:900, fontSize:"0.95rem", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{activeItem.emoji} {activeItem.title}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{ width:50, height:50, borderRadius:"50%", background:"rgba(255,255,255,0.18)", border:"2.5px solid rgba(255,255,255,0.35)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0, flexShrink:0 }}>
                {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
