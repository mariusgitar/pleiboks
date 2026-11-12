import { useState, useEffect, useRef, memo, useCallback } from "react";
import { fetchRssFeed, fetchRssAudioUrl, fetchRssCover } from "./rss.js";
import Onboarding from "./Onboarding.jsx";
import STANDARD_EPISODER from "./episoder-standard.json";
import { synk, lokalUrl, status as offlineStatus, lagredeIder } from "./offline.js";

// ── Innholdsdata ──────────────────────────────────────────────────
// PSAPI-BASERT VERSJON (stabil, brukt til brukertesting).
// RSS-koden (rss.js, fetchRssAudioUrl m.fl.) er beholdt i kodebasen
// som dormant infrastruktur for en fremtidig RSS-POC, men ingen
// seksjoner bruker source:"rss" lenger — NRK sine RSS-feeds viste
// seg for upålitelige (litt vindu med nyeste episoder, treffer
// sjelden de kuraterte favorittene) til å bruke i en stabil prototype.
// Se chat-historikk for detaljer rundt avgjørelsen.

const RSS = {
  halloBablo:             "https://podkast.nrk.no/program/hallo_bablo.rss",
  kokosbananas:           "https://podkast.nrk.no/program/kokosbananas.rss",
  // Fantorangen og Fantorangenfortellinger er samme feed
  fantorangenfortellinger:"https://podkast.nrk.no/program/fantorangenfortellinger.rss",
  brannbamsenBjornis:     "https://podkast.nrk.no/program/brannbamsen_bjoernis.rss",
  // BlimE, Fantus musikantus, Fantorangens verden har ikke egne RSS-feeds —
  // disse bruker psapi-IDer (source: "api")
};

// Episodelisten hentes fra /api/episodes (redigeres på /admin.html).
// episoder-standard.json er reserve: brukes før første henting og hvis nettet er nede.
const LS_EPISODER = "pb_episoder";

const LS_COVERS = "pb_covers_v2"; // v2: høyere oppløsning (v1 kunne inneholde små bilder)
function loadCovers() {
  try { return JSON.parse(localStorage.getItem(LS_COVERS)) || {}; } catch { return {}; }
}

function formatMB(bytes) {
  return bytes >= 1e9 ? (bytes / 1e9).toFixed(1).replace(".", ",") + " GB" : Math.round(bytes / 1e6) + " MB";
}

function loadEpisoder() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_EPISODER));
    if (Array.isArray(d?.sections)) return d.sections;
  } catch {}
  return STANDARD_EPISODER.sections;
}

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
  mode:          "pb_mode",            // "mini" | "miniplus" | "junior"
  miniplusSerier:"pb_miniplus_serier", // JSON array av seksjons-IDer (maks 5, i fane-rekkefølge)
  miniplusStil:  "pb_miniplus_stil",   // "cover" | "ikon" — hva seriefanene viser
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
function loadJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const MAKS_SERIER = 5;
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
    // NRK oppgir bredde som pixelWidth (av og til width). Velg største; uten størrelser: siste (NRK lister minst → størst).
    const bredde = (i) => i.pixelWidth || i.width || 0;
    const med = arr.filter((i) => i?.url);
    if (!med.some(bredde)) return med[med.length - 1]?.url || null;
    return med.sort((a, b) => bredde(b) - bredde(a))[0]?.url || null;
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
function ParentPanel({ nrkSections, offline, mode, setMode, miniIds, setMiniIds, miniplusSerier, setMiniplusSerier, miniplusStil, setMiniplusStil, spotifyEnabled, setSpotifyEnabled, onClose }) {
  function toggleItem(id) {
    setMiniIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const allSections = [...nrkSections, ...((SHOW_SPOTIFY && spotifyEnabled) ? [SPOTIFY_SECTION] : [])];

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

        {/* Offline-status */}
        <div style={{ marginBottom:28, padding:"14px 16px", background:"#fff", borderRadius:16, border:"2px solid #eee" }}>
          <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:4 }}>
            {offline.lagret === offline.totalt ? "✅" : "⬇️"} Lagret på telefonen
          </div>
          <div style={{ fontSize:13, color:"#555", fontWeight:700 }}>
            {offline.lagret} av {offline.totalt} episoder · {formatMB(offline.bytes)}
          </div>
          <div style={{ fontSize:11, color:"#888", fontWeight:700, marginTop:4 }}>
            {!offline.online ? "Uten nett nå — viser bare lagrede episoder."
              : offline.lagret < offline.totalt ? "Laster ned på wifi i bakgrunnen mens appen er åpen."
              : "Alt kan spilles uten nett."}
            {offline.totalt < offline.antall && ` ${offline.antall - offline.totalt} radioprogram krever nett.`}
          </div>
        </div>

        {/* Modusvalg */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:10 }}>Visningsmodus</div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { id:"mini",     ikon:"🌱", navn:"Mini",   tekst:"Få, store valg" },
              { id:"miniplus", ikon:"🌿", navn:"Mini+",  tekst:"Serier, store kort" },
              { id:"junior",   ikon:"🌳", navn:"Junior", tekst:"Hele katalogen" },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                flex:1, padding:"14px 10px", borderRadius:16,
                background: mode === m.id ? "#1B4D5C" : "#fff",
                color: mode === m.id ? "#fff" : "#1a1a1a",
                border: mode === m.id ? "none" : "2px solid #eee",
                fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                textAlign:"left",
              }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{m.ikon}</div>
                {m.navn}
                <div style={{ fontWeight:700, fontSize:11, opacity:0.7, marginTop:2 }}>{m.tekst}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mini+-utvalg: serier */}
        {mode === "miniplus" && (
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:4 }}>Velg serier for Mini+</div>
            <div style={{ fontSize:12, color:"#888", fontWeight:700, marginBottom:14 }}>
              Opptil {MAKS_SERIER}. Rekkefølgen du velger i blir rekkefølgen på fanene.
            </div>
            <div style={{ fontWeight:800, fontSize:13, color:"#1a1a1a", marginBottom:6 }}>Fanene viser</div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{ id:"cover", navn:"Coverbilde" }, { id:"ikon", navn:"Ikon" }].map(v => (
                <button key={v.id} onClick={() => setMiniplusStil(v.id)} style={{
                  flex:1, padding:"10px", borderRadius:12, fontFamily:"inherit", fontWeight:800, fontSize:13, cursor:"pointer",
                  background: miniplusStil === v.id ? "#1B4D5C" : "#fff",
                  color: miniplusStil === v.id ? "#fff" : "#1a1a1a",
                  border: miniplusStil === v.id ? "none" : "2px solid #eee",
                }}>{v.navn}</button>
              ))}
            </div>
            {nrkSections.map(section => {
              const nr = miniplusSerier.indexOf(section.id);
              const valgt = nr >= 0;
              const full = !valgt && miniplusSerier.length >= MAKS_SERIER;
              return (
                <button key={section.id} disabled={full} onClick={() => setMiniplusSerier(prev => valgt ? prev.filter(x => x !== section.id) : [...prev, section.id])} style={{
                  display:"flex", alignItems:"center", gap:10, width:"100%", marginBottom:8,
                  padding:"10px 12px", borderRadius:14, fontFamily:"inherit", cursor: full ? "default" : "pointer",
                  background:"#fff", border: valgt ? `2.5px solid ${section.accent}` : "2px solid #eee",
                  opacity: full ? 0.45 : 1, textAlign:"left",
                }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:section.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{section.icon}</div>
                  <span style={{ flex:1, fontWeight:800, fontSize:14, color:"#1a1a1a" }}>{section.label}</span>
                  <span style={{ fontSize:12, fontWeight:800, color: valgt ? section.accent : "#aaa" }}>
                    {valgt ? `#${nr + 1}` : `${section.items.length} ep.`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

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
function CoverImg({ item, sectionColor, size, width, radius, playing, onClick, mini = false }) {
  const [err, setErr] = useState(false);
  const t   = mini ? 2.5 : 5;
  const g   = mini ? 4   : 10;
  const pad = playing ? t + g : 0;
  const boxW = width || size; // tillater bredformat uten å påvirke GlowRing/høyde
  return (
    <div onClick={onClick} style={{ position:"relative", width:boxW+pad*2, height:size+pad*2, display:"flex", alignItems:"center", justifyContent:"center", cursor:onClick?"pointer":"default", flexShrink:0 }}>
      {playing && onClick && <GlowRing radius={radius} mini={mini} />}
      <div style={{ width:boxW, height:size, borderRadius:radius, overflow:"hidden", background:sectionColor, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:1, flexShrink:0 }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
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
        <CoverImg item={item} sectionColor={section.color} size={236} width={300} radius={28} playing={playing} onClick={onClose} mini={false} />
      </div>
      <div style={{ position:"relative", zIndex:1, width:"100%", textAlign:"left", marginBottom:"auto" }}>
        <div style={{ color:"#fff", fontSize:"1.5rem", fontWeight:900, lineHeight:1.2, marginBottom:4 }}>{item.emoji && <span style={{ marginRight:8 }}>{item.emoji}</span>}{item.title}</div>
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
// Deterministisk liten rotasjon per kort basert på ID — gir lekenhet
// uten at kortene hopper rundt ved re-render. Aktive/spillende kort
// retter seg opp (rotate(0)) for å skille seg ut.
function cardTilt(id, range = 2.2) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const t = (Math.abs(hash) % 1000) / 1000; // 0..1
  return (t - 0.5) * 2 * range; // -range..+range grader
}

// "Klipp-ut"-hjørner: en SVG clip-path med litt ujevne, håndtegnede
// kurver i stedet for perfekt geometrisk border-radius. Deterministisk
// per ID slik at samme kort alltid får samme (subtilt unike) form.
function clipPathStyle(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const seed = Math.abs(hash);
  // 4 hjørne-"bites" med litt variasjon i hvor langt de stikker inn
  const a = 2 + (seed % 3);          // 2-4%
  const b = 2 + ((seed >> 3) % 3);   // 2-4%
  const c = 2 + ((seed >> 6) % 3);
  const d = 2 + ((seed >> 9) % 3);
  return {
    clipPath: `polygon(
      ${a}% 0%, ${100-b}% 0%,
      100% ${b}%, 100% ${100-c}%,
      ${100-c}% 100%, ${d}% 100%,
      0% ${100-d}%, 0% ${a}%
    )`,
  };
}

const MiniCard = memo(function MiniCard({ item, section, isActive, playing, onClick }) {
  const [err, setErr] = useState(false);
  const tilt = cardTilt(item.id, 2.4);
  return (
    <button onClick={onClick} style={{
      display:"block", width:"100%", textAlign:"left",
      background:"#fff", border:"none", borderRadius:24,
      overflow:"hidden", padding:0, cursor:"pointer",
      marginBottom:18, fontFamily:"inherit",
      boxShadow: isActive ? `0 8px 28px ${section.accent}55` : "0 3px 14px rgba(0,0,0,0.10)",
      outline: isActive ? `3px solid ${section.accent}` : "3px solid transparent",
      transform: `rotate(${isActive ? 0 : tilt}deg) scale(${isActive ? 1.015 : 1})`,
      transition:"all 0.22s cubic-bezier(.34,1.4,.64,1)",
      animation: (isActive && playing) ? "cardBreatheMini 2.6s ease-in-out infinite" : "none",
    }}>
      <div style={{
        width:"100%", aspectRatio:"4 / 3",
        background: item.cover ? section.color : `linear-gradient(135deg, ${section.color}, ${section.accent}22)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative", overflow:"hidden",
        ...clipPathStyle(item.id),
      }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
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
  const tilt = cardTilt(item.id, 3.2);
  return (
    <button onClick={onClick} style={{
      flexShrink:0, width:110, borderRadius:19, overflow:"hidden",
      background:"#fff", border:`3px solid ${isActive ? section.accent : "transparent"}`,
      boxShadow: isActive ? `0 5px 16px ${section.accent}66` : "0 2px 8px rgba(0,0,0,0.09)",
      cursor:"pointer", padding:0, textAlign:"left",
      transition:"transform 0.18s cubic-bezier(.34,1.56,.64,1), border-color 0.14s",
      transform: isActive ? "rotate(0deg) scale(1.06)" : `rotate(${tilt}deg) scale(1)`,
      animation: (isActive && playing) ? "cardBreathePb 2.6s ease-in-out infinite" : "none",
      scrollSnapAlign:"start",
    }}>
      <div style={{ width:"100%", aspectRatio:"1", background:section.color, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", ...clipPathStyle(item.id) }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
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


// ── Mini+: store kort, gruppert i serier med faste faner øverst ────
const MiniPlus = memo(function MiniPlus({ sections, covers, stil, activeId, source, playing, onSelectNrk }) {
  const [aktiv, setAktiv] = useState(() => sections.find(s => s.items.some(i => i.id === activeId))?.id || sections[0]?.id);
  const markorRef = useRef(null); // usynlig markør rett over fanene
  const sveip = useRef(null);
  const [festet, setFestet] = useState(false); // true når fanene ligger fast øverst

  useEffect(() => {
    const el = markorRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setFestet(!e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const serie = sections.find(s => s.id === aktiv) || sections[0];

  function bytt(id) {
    if (id === serie?.id) return;
    setAktiv(id);
    // Hopp tilbake til toppen av serien hvis man har scrollet forbi fanene
    const el = markorRef.current;
    if (el) {
      const topp = el.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > topp) window.scrollTo(0, topp);
    }
  }
  function onTouchStart(e) { sveip.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  function onTouchEnd(e) {
    const st = sveip.current; sveip.current = null;
    if (!st || !serie) return;
    const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = sections.findIndex(s => s.id === serie.id), j = i + (dx < 0 ? 1 : -1);
    if (j >= 0 && j < sections.length) bytt(sections[j].id);
  }

  if (!serie) return null;
  return (
    <div>
      <div ref={markorRef} style={{ height:1 }} />
      <div style={{
        position:"sticky", top:0, zIndex:10, margin:"0 -1.1rem 6px", // Høyre side holdes fri for sola (foreldreinngang), så barnet ikke treffer den i stedet for en fane
        padding:"calc(10px + env(safe-area-inset-top)) 76px 12px 1.1rem",
        background: festet ? "linear-gradient(180deg, rgba(174,228,255,0.97) 75%, rgba(174,228,255,0))" : "transparent",
        transition:"background 0.2s",
        display:"flex", justifyContent:"center", gap:10,
      }}>
        {sections.map(s => {
          const on = s.id === serie.id;
          const spillerHer = playing && source === "nrk" && s.items.some(i => i.id === activeId);
          const cover = stil === "cover" ? s.items.map(i => covers[i.id]).find(Boolean) : null;
          return (
            <button key={s.id} onClick={() => bytt(s.id)} style={{
              position:"relative", flex:"0 1 76px", aspectRatio:"1", padding:0, border:"none", borderRadius:22,
              overflow:"hidden", cursor:"pointer", background: cover ? "#fff" : s.color,
              boxShadow: on ? `0 6px 18px ${s.accent}55` : "0 3px 10px rgba(0,0,0,0.12)",
              outline: on ? `4px solid ${s.accent}` : "none", outlineOffset:-1,
              opacity: on ? 1 : 0.72, filter: on ? "none" : "saturate(0.75)",
              transform: on ? "scale(1.06) rotate(0deg)" : `scale(0.86) rotate(${cardTilt(s.id, 3)}deg)`,
              transition:"transform 0.28s cubic-bezier(.34,1.5,.64,1), opacity 0.2s, filter 0.2s",
            }}>
              {cover
                ? <img src={cover} alt={s.label} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                : <span style={{ fontSize:38 }}>{s.icon}</span>}
              {spillerHer && (
                <span style={{ position:"absolute", bottom:6, left:"50%", marginLeft:-6, width:12, height:12, borderRadius:"50%", background:s.accent, border:"2px solid #fff", animation:"glowSwell 1.2s ease-in-out infinite" }} />
              )}
            </button>
          );
        })}
      </div>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"2px 2px 14px" }}>
          <div style={{ width:34, height:34, borderRadius:10, background:serie.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem" }}>{serie.icon}</div>
          <span style={{ fontSize:"1.15rem", fontWeight:900, color:"#1a1a1a" }}>{serie.label}</span>
        </div>
        {serie.items.map(item => (
          <MiniCard
            key={item.id}
            item={{ ...item, cover: covers[item.id] }}
            section={serie}
            isActive={activeId === item.id && source === "nrk"}
            playing={playing}
            onClick={() => onSelectNrk(item, serie)}
          />
        ))}
      </div>
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
            <CoverImg item={activeItem} sectionColor={activeSection.color} size={220} width={280} radius={24} playing={playing} onClick={undefined} mini={false} />
          </div>
          <div style={{ width:"100%", textAlign:"center" }}>
            <div style={{ color:"#fff", fontSize:"1.45rem", fontWeight:900, lineHeight:1.2, marginBottom:6 }}>{activeItem.emoji && <span style={{ marginRight:8 }}>{activeItem.emoji}</span>}{activeItem.title}</div>
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
  const [nrkSections, setNrkSections]         = useState(loadEpisoder);
  const [nrkCovers, setNrkCovers]             = useState(loadCovers);
  const [online, setOnline]                   = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [lagret, setLagret]                   = useState(lagredeIder);
  const [laster, setLaster]                   = useState(false);
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
  const [miniplusSerier, setMiniplusSerierState] = useState(() => loadJson(LS_KEYS.miniplusSerier, []));
  const [miniplusStil, setMiniplusStilState]     = useState(() => loadJson(LS_KEYS.miniplusStil, "cover"));
  const [spotifyEnabled, setSpotifyEnabledState] = useState(() => loadSpotifyEnabled());
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboarded());
  const [showPinModal, setShowPinModal]     = useState(false);
  const [showParentPanel, setShowParentPanel] = useState(false);
  const sunTapCount = useRef(0);
  const sunTapTimer = useRef(null);

  // Sjekk om vi nettopp kom tilbake fra Spotify OAuth under onboarding
  // (login.js redirecter til /?spotify=connected etter vellykket innlogging)
  const [onboardingSpotifyConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("spotify") === "connected";
    if (connected) {
      // Rydd opp URL-en så ?spotify=connected ikke henger igjen ved refresh
      window.history.replaceState({}, "", window.location.pathname);
    }
    return connected;
  });

  function setMode(m)    { setModeState(m); saveMode(m); }
  function setMiniplusSerier(updater) {
    setMiniplusSerierState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveJson(LS_KEYS.miniplusSerier, next);
      return next;
    });
  }
  function setMiniplusStil(v) { setMiniplusStilState(v); saveJson(LS_KEYS.miniplusStil, v); }
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

  function handleOnboardingDone(spotifyChoice) {
    setSpotifyEnabled(spotifyChoice);
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

  // Nett av/på
  useEffect(() => {
    const på = () => setOnline(true), av = () => setOnline(false);
    window.addEventListener("online", på); window.addEventListener("offline", av);
    return () => { window.removeEventListener("online", på); window.removeEventListener("offline", av); };
  }, []);

  // Offline-synk: last ned nye episoder, slett fjernede
  useEffect(() => {
    if (!online) return;
    synk(nrkSections, (item) => fetchNrkManifest(item.id, item.programType), (info) => {
      setLagret(lagredeIder());
      if (info) setLaster(info.aktiv);
    });
  }, [nrkSections, online]);

  // Husk coverbilde-URL-er så de kan vises uten nett
  useEffect(() => {
    try { localStorage.setItem(LS_COVERS, JSON.stringify(nrkCovers)); } catch {}
  }, [nrkCovers]);

  // Hent oppdatert episodeliste ved oppstart. Faller stille tilbake til lagret/standard liste.
  useEffect(() => {
    fetch("/api/episodes", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!Array.isArray(d?.sections)) return;
        try { localStorage.setItem(LS_EPISODER, JSON.stringify({ sections: d.sections, oppdatert: d.oppdatert })); } catch {}
        setNrkSections(prev => JSON.stringify(prev) === JSON.stringify(d.sections) ? prev : d.sections);
      })
      .catch(() => {});
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

      await Promise.all(nrkSections.map(async (section) => {
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
          await Promise.all(section.items.filter(item => !nrkCovers[item.id]).map(async (item) => {
            const url = await fetchNrkCover(item.id, item.programType);
            if (url) map[item.id] = url;
          }));
        }
      }));

      setNrkCovers(prev => ({ ...prev, ...map }));
    }

    loadAllCovers();
  }, [nrkSections]);

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
        url = await lokalUrl(item.id) || await fetchNrkManifest(item.id, item.programType);
      }

      if (requestId !== requestIdRef.current) {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      setNrkUrl(prev => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
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
    tilgjengeligeSections.forEach(s => s.items.forEach(item => all.push({ item, section: s, type: "nrk" })));
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
  // Uten nett: vis bare episoder som er lagret på telefonen
  const tilgjengeligeSections = online
    ? nrkSections
    : nrkSections
        .map(s => ({ ...s, items: s.items.filter(i => lagret.has(i.id)) }))
        .filter(s => s.items.length > 0);

  const visibleNrkSections = mode === "mini"
    ? tilgjengeligeSections
        .map(s => ({ ...s, items: s.items.filter(i => miniIds.includes(i.id)) }))
        .filter(s => s.items.length > 0)
    : mode === "miniplus"
    ? miniplusSerier.map(id => tilgjengeligeSections.find(s => s.id === id)).filter(Boolean)
    : tilgjengeligeSections;

  const visibleSpotifySection = mode !== "junior"
    ? { ...SPOTIFY_SECTION, items: SPOTIFY_SECTION.items.filter(i => miniIds.includes(i.id)) }
    : SPOTIFY_SECTION;

  const showSpotifySection = SHOW_SPOTIFY && spotifyEnabled && mode !== "miniplus" && (mode === "junior" || visibleSpotifySection.items.length > 0);

  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Nunito',system-ui,sans-serif", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        @keyframes cloudDrift { from{transform:translateX(0)} to{transform:translateX(110vw)} }
        @keyframes sunSpin    { from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
        @keyframes glowSwell  { 0%,100%{opacity:0.6;transform:scale(0.97)} 50%{opacity:0.95;transform:scale(1.03)} }
        @keyframes eqbar      { from{height:3px} to{height:13px} }
        @keyframes cardBreathePb   { 0%,100%{ transform: rotate(0deg) scale(1.06) }  50%{ transform: rotate(0deg) scale(1.1) } }
        @keyframes cardBreatheMini { 0%,100%{ transform: rotate(0deg) scale(1.015) } 50%{ transform: rotate(0deg) scale(1.04) } }
        @keyframes bob        { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        .pb-row::-webkit-scrollbar { display:none }
      `}</style>

      {/* Nedlastingsindikator: tynn linje øverst mens episoder lastes ned for offline */}
      {laster && (() => {
        const st = offlineStatus(nrkSections);
        if (st.lagret >= st.totalt) return null;
        return (
          <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, pointerEvents:"none" }}>
            <div style={{ height:3, background:"rgba(255,255,255,0.35)" }}>
              <div style={{ height:"100%", width:`${(st.lagret / st.totalt) * 100}%`, background:"#1B4D5C", transition:"width 0.4s" }} />
            </div>
            <div style={{ position:"absolute", top:6, right:8, fontSize:10, fontWeight:800, color:"#1B4D5C", opacity:0.55 }}>
              ⬇ {st.lagret}/{st.totalt}
            </div>
          </div>
        );
      })()}

      {showOnboarding && (
        <Onboarding
          onDone={handleOnboardingDone}
          initialSpotifyConnected={onboardingSpotifyConnected}
        />
      )}

      {showPinModal && (
        <ParentPinModal
          onSuccess={() => { setShowPinModal(false); setShowParentPanel(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {showParentPanel && (
        <ParentPanel
          nrkSections={nrkSections}
          offline={{ ...offlineStatus(nrkSections), online, antall: nrkSections.reduce((n, s) => n + s.items.length, 0) }}
          mode={mode} setMode={setMode}
          miniIds={miniIds} setMiniIds={setMiniIds}
          miniplusSerier={miniplusSerier} setMiniplusSerier={setMiniplusSerier}
          miniplusStil={miniplusStil} setMiniplusStil={setMiniplusStil}
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
              {visibleNrkSections.length === 0 && (mode === "junior" || !showSpotifySection || visibleSpotifySection.items.length === 0) && (
                <div style={{ textAlign:"center", padding:"40px 20px", color:"#1B4D5C99" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🌱</div>
                  <div style={{ fontWeight:800, fontSize:14 }}>Ingen innhold valgt ennå.</div>
                  <div style={{ fontWeight:700, fontSize:12, marginTop:4 }}>En voksen kan velge innhold i foreldrepanelet.</div>
                </div>
              )}
              {mode === "miniplus" ? (
                <MiniPlus
                  sections={visibleNrkSections}
                  covers={nrkCovers}
                  stil={miniplusStil}
                  activeId={activeItem?.id} source={source} playing={playing}
                  onSelectNrk={velgNrkCb}
                />
              ) : mode === "mini" ? (
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
