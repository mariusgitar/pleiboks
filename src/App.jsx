import { useState, useEffect, useRef } from "react";

// ── Innholdsdata ──────────────────────────────────────────────────
const NRK_SECTIONS = [
  {
    id: "hallo-bablo", label: "Hallo Bablo", icon: "📚", type: "podcast",
    items: [
      { id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9", title: "Oversvømmelse",    emoji: "🌊" },
      { id: "l_e6b980ce-8601-476a-b980-ce8601176a46", title: "Lottes banneshow", emoji: "🤐" },
      { id: "l_fbd86653-d114-44a4-9866-53d11464a4ae", title: "Ja-dag",           emoji: "✅" },
      { id: "l_8172372d-510a-49d6-b237-2d510af9d6ac", title: "Superlimet",       emoji: "🔧" },
    ],
  },
  {
    id: "kokosbananas", label: "Kokosbananas", icon: "🥥", type: "podcast",
    items: [
      { id: "l_810de249-e5d3-4a12-8de2-49e5d33a12d2", title: "Sykkelplanen", emoji: "🚲" },
      { id: "l_21414849-4480-4ca2-8148-494480fca285", title: "Kokosbananas", emoji: "🍌" },
    ],
  },
  {
    id: "fantorangen", label: "Fantorangen", icon: "🧡", type: "podcast",
    items: [
      { id: "l_8e42fb20-bb6f-404c-82fb-20bb6f004c5f", title: "Kjempe-Fantus",          emoji: "🌳" },
      { id: "l_01779e9e-49ad-41ff-b79e-9e49ad11ffc0", title: "Fantus forsvinn",         emoji: "📺" },
      { id: "l_9124669c-0fc4-4660-a466-9c0fc4b6609a", title: "Fantorangen tryllerydder",emoji: "🪄" },
    ],
  },
  {
    id: "karsten-petra", label: "Karsten og Petra", icon: "👫", type: "podcast",
    items: [
      { id: "MKTT05000605", title: "Bestevenner",                  emoji: "🤝", programType: "program" },
      { id: "MKTT05000505", title: "Petra begynner i barnehagen",  emoji: "🏫", programType: "program" },
      { id: "MKTT04000104", title: "Karsten kjører brannbil",      emoji: "🚒", programType: "program" },
    ],
  },
  {
    id: "blime", label: "BlimE!", icon: "🌈", type: "podcast",
    items: [
      { id: "l_bd313b9d-5f6b-44a1-b13b-9d5f6b84a16b", title: "Kom igjen 'a (2016)", emoji: "🎤" },
      { id: "l_2ae9578e-b9ef-4451-a957-8eb9ef0451f2", title: "Halloween",            emoji: "🎃" },
      { id: "l_184d0d69-e4ba-4316-8d0d-69e4bad3165a", title: "Kua mi",               emoji: "🐄" },
    ],
  },
];

const SPOTIFY_TRACKS = [
  { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake",  artist: "Kutoppen & Lisa Børud",          emoji: "🥤" },
  { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested",artist: "Kutoppen & Klara",                emoji: "🌈" },
  { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru",        artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
  { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare",    artist: "Kutoppen & Sol Heilo",            emoji: "😄" },
];

// ── Farger ────────────────────────────────────────────────────────
const BG       = "#FAF7F4";
const HEADER   = "#1B4D5C";
const YELLOW   = "#F5C842";

// NRK-seksjoner får egne accent-farger for spilleren
const SECTION_ACCENTS = {
  "hallo-bablo":  "#1B6B8A",
  "kokosbananas": "#B85A00",
  "fantorangen":  "#D4700A",
  "karsten-petra":"#2D6B4A",
  "blime":        "#6D28D9",
  "spotify":      "#6D28D9",
};
const SECTION_COLORS = {
  "hallo-bablo":  "#E3F2F9",
  "kokosbananas": "#FFF0DC",
  "fantorangen":  "#FFF3DC",
  "karsten-petra":"#E8F5EE",
  "blime":        "#EDE8FF",
  "spotify":      "#EDE8FF",
};

// ── NRK API ───────────────────────────────────────────────────────
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

// ── Spotify API ───────────────────────────────────────────────────
async function getMe() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchSpotifyCovers(tracks) {
  const results = await Promise.all(tracks.map((t) =>
    fetch(`/api/spotify-track?id=${t.id}`).then((r) => r.ok ? r.json() : null).catch(() => null)
  ));
  const map = {};
  results.forEach((r, i) => {
    if (r?.album?.images?.[0]?.url) map[tracks[i].id] = r.album.images[0].url;
  });
  return map;
}

async function spotifyPlay(uri, accessToken) {
  const res = await fetch("/api/spotify-play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackUri: uri, accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ukjent feil");
}

async function spotifyPause(accessToken) {
  await fetch("/api/spotify-pause", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// ── SVG-ikoner ────────────────────────────────────────────────────
function PlayIcon({ size = 24, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="7,4 20,12 7,20" fill={color} />
    </svg>
  );
}
function PauseIcon({ size = 24, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="4" width="4.5" height="16" rx="2.2" fill={color} />
      <rect x="14.5" y="4" width="4.5" height="16" rx="2.2" fill={color} />
    </svg>
  );
}

function PlayBtn({ playing, accent, size = 64, onClick, dark = false }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: "50%",
      background: playing
        ? (dark ? "rgba(255,255,255,0.14)" : accent + "22")
        : (dark ? "#fff" : accent),
      border: playing
        ? (dark ? "2.5px solid rgba(255,255,255,0.35)" : `2.5px solid ${accent}`)
        : "none",
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: playing ? "none" : (dark ? "0 6px 20px rgba(0,0,0,0.25)" : `0 4px 14px ${accent}55`),
      transition: "all 0.18s", padding: 0, flexShrink: 0,
    }}>
      {playing
        ? <PauseIcon size={size * 0.42} color={dark ? "#fff" : accent} />
        : <PlayIcon  size={size * 0.42} color={dark ? accent : "#fff"} />
      }
    </button>
  );
}

// ── Glødring ──────────────────────────────────────────────────────
function GlowRing({ radius, t, g }) {
  const grad = "linear-gradient(135deg,#FF6B6B,#FF9F45,#FFD93D,#6BCB77,#4D96FF,#845EC2,#FF6B6B)";
  return (
    <>
      <div style={{
        position: "absolute", inset: -(t + g),
        borderRadius: radius + t + g,
        background: grad,
        filter: `blur(${g}px)`,
        animation: "glowSwell 3s ease-in-out infinite",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", inset: -t,
        borderRadius: radius + t,
        background: grad,
        animation: "glowSwell 3s ease-in-out infinite",
        pointerEvents: "none", zIndex: 0,
      }} />
    </>
  );
}

// ── Coverbilde med glødring ───────────────────────────────────────
function Cover({ item, sectionColor, size, radius = 16, playing, onClick, mini = false }) {
  const [err, setErr] = useState(false);
  const t   = mini ? 2.5 : 5;
  const g   = mini ? 4   : 10;
  const pad = playing ? t + g : 0;

  return (
    <div onClick={onClick} style={{
      position: "relative",
      width: size + pad * 2, height: size + pad * 2,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: onClick ? "pointer" : "default", flexShrink: 0,
    }}>
      {playing && onClick && <GlowRing radius={radius} t={t} g={g} />}
      <div style={{
        width: size, height: size, borderRadius: radius,
        overflow: "hidden", background: sectionColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        {item.cover && !err ? (
          <img src={item.cover} alt={item.title}
            onError={() => setErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <span style={{ fontSize: size * 0.46 }}>{item.emoji}</span>
        )}
      </div>
    </div>
  );
}

// ── Spotify voksen-modal ──────────────────────────────────────────
function SpotifyVoksenModal({ onRetry, onDismiss }) {
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end",
      fontFamily: "'Nunito', system-ui, sans-serif",
    }} onClick={onDismiss}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: BG, width: "100%",
        borderRadius: "20px 20px 0 0",
        padding: "24px 24px 40px",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎵</div>
          <h2 style={{ fontWeight: 900, color: HEADER, fontSize: 22, margin: "0 0 8px" }}>
            Musikken er ikke klar!
          </h2>
          <p style={{ color: "#555", fontWeight: 700, fontSize: 15, margin: 0 }}>
            Hent en voksen — de vet hva de skal gjøre 😊
          </p>
        </div>
        <button onClick={() => setShowGuide(!showGuide)} style={{
          display: "block", width: "100%",
          background: "none", border: `2px solid ${HEADER}`, borderRadius: 12,
          padding: "10px 20px", color: HEADER, fontWeight: 800, fontSize: 14,
          cursor: "pointer", marginBottom: 16, fontFamily: "inherit",
        }}>
          {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
        </button>
        {showGuide && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontWeight: 900, color: HEADER, fontSize: 14, marginBottom: 10 }}>
              Slik kobler du til Spotify:
            </div>
            {["Åpne Spotify-appen på denne iPaden","Spill en hvilken som helst sang i noen sekunder","Gå tilbake til denne appen",'Trykk "Prøv igjen" nedenfor'].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: YELLOW,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 12, flexShrink: 0, color: HEADER,
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#333", lineHeight: 1.4, paddingTop: 3 }}>{step}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDismiss} style={{
            flex: 1, background: "#fff", color: HEADER,
            border: `2px solid ${HEADER}`, borderRadius: 14,
            padding: "12px", fontWeight: 900, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>Avbryt</button>
          <button onClick={onRetry} style={{
            flex: 2, background: HEADER, color: "#fff", border: "none",
            borderRadius: 14, padding: "12px", fontWeight: 900, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>Prøv igjen</button>
        </div>
      </div>
    </div>
  );
}

// ── Fullskjerm-spiller ────────────────────────────────────────────
function FullPlayer({ item, accent, sectionColor, source, playing, loading, onToggle, onClose, progress, duration, onSeek }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", flexDirection: "column",
      fontFamily: "'Nunito', system-ui, sans-serif",
      background: accent,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.3) 100%)",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", padding: "0 36px 52px", overflow: "hidden",
      }}>
        <div style={{
          paddingTop: 52, marginBottom: 24,
          color: "rgba(255,255,255,0.6)", fontSize: 12,
          fontWeight: 800, textTransform: "uppercase", letterSpacing: 3, textAlign: "center",
        }}>
          {source === "spotify" ? "Kutoppen · Spotify" : "NRK Super"}
        </div>

        {/* Cover — trykk for å lukke */}
        <div style={{ marginTop: "auto", marginBottom: 28 }}>
          <Cover item={item} sectionColor={sectionColor}
            size={220} radius={22} playing={playing} onClick={onClose} mini={false} />
        </div>

        <div style={{ width: "100%", textAlign: "left", marginBottom: 24 }}>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, lineHeight: 1.2, marginBottom: 4 }}>
            {item.title}
          </div>
          {item.artist && (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 700 }}>{item.artist}</div>
          )}
        </div>

        {/* Fremdriftslinje (kun NRK) */}
        {source !== "spotify" && (
          <div style={{ width: "100%", marginBottom: 8 }}>
            <div onClick={onSeek} style={{
              height: 5, background: "rgba(255,255,255,0.22)", borderRadius: 3,
              cursor: "pointer", position: "relative",
            }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#fff", borderRadius: 3 }} />
              <div style={{
                position: "absolute", top: "50%", left: `${pct}%`,
                transform: "translate(-50%,-50%)",
                width: 14, height: 14, borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.3)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginTop: 6,
            }}>
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          {loading
            ? <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 800 }}>Laster…</div>
            : <PlayBtn playing={playing} accent={accent} size={80} onClick={onToggle} dark />
          }
        </div>
      </div>
    </div>
  );
}

// ── Listekort ─────────────────────────────────────────────────────
function ItemCard({ item, accent, sectionColor, isActive, playing, onSelect }) {
  return (
    <div style={{
      borderRadius: 20, overflow: "hidden",
      boxShadow: isActive ? `0 6px 24px ${accent}44` : "0 2px 10px rgba(0,0,0,0.07)",
      border: isActive ? `2.5px solid ${accent}` : "2.5px solid transparent",
      background: "#fff", marginBottom: 16,
      transition: "all 0.18s ease",
    }}>
      <div onClick={onSelect} style={{
        width: "100%", aspectRatio: "16 / 9",
        background: item.cover ? undefined : `linear-gradient(145deg, ${sectionColor} 0%, ${accent}18 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", overflow: "hidden", position: "relative",
      }}>
        {item.cover ? (
          <img src={item.cover} alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 64 }}>{item.emoji}</span>
        )}
        {isActive && playing && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            background: accent, borderRadius: 20, padding: "5px 12px",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 3, borderRadius: 2, background: "#fff",
                animation: `eqbar 0.7s ${i*0.18}s ease-in-out infinite alternate`,
              }} />
            ))}
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, marginLeft: 3 }}>Spiller</span>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#1a1a1a", marginBottom: 2 }}>{item.emoji} {item.title}</div>
          {item.artist && <div style={{ fontSize: 12, fontWeight: 700, color: "#bbb" }}>{item.artist}</div>}
        </div>
        <PlayBtn playing={isActive && playing} accent={accent} size={46} onClick={onSelect} />
      </div>
    </div>
  );
}

// ── Hovedapp ──────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth]                       = useState(null);
  const [spotifyCovers, setSpotifyCovers]     = useState({});
  const [nrkCovers, setNrkCovers]             = useState({});
  const [source, setSource]                   = useState(null);
  const [activeItem, setActiveItem]           = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [playing, setPlaying]                 = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [fullscreen, setFullscreen]           = useState(false);
  const [showVoksenModal, setShowVoksenModal] = useState(false);
  const [pendingTrack, setPendingTrack]       = useState(null);

  const audioRef  = useRef(null);
  const [nrkUrl, setNrkUrl]       = useState(null);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);

  // Auth
  useEffect(() => {
    getMe().then((d) => setAuth(d?.loggedIn ? d : false));
  }, []);

  // NRK covers
  useEffect(() => {
    const allItems = NRK_SECTIONS.flatMap((s) => s.items);
    Promise.all(allItems.map((item) => fetchNrkCover(item.id, item.programType))).then((results) => {
      const map = {};
      results.forEach((url, i) => { if (url) map[allItems[i].id] = url; });
      setNrkCovers(map);
    });
  }, []);

  // Spotify covers
  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(SPOTIFY_TRACKS).then(setSpotifyCovers);
  }, [auth]);

  // NRK audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => setProgress(audio.currentTime);
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

  // Start NRK når URL er klar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nrkUrl) return;
    audio.src = nrkUrl;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [nrkUrl]);

  function stopAll() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setNrkUrl(null); setPlaying(false); setProgress(0); setDuration(0);
  }

  async function velgNrk(item, sectionId) {
    if (activeItem?.id === item.id && source === "nrk") return;
    stopAll();
    setSource("nrk"); setActiveItem({ ...item, cover: nrkCovers[item.id] });
    setActiveSectionId(sectionId); setLoading(true); setFullscreen(true);
    try {
      const url = await fetchNrkManifest(item.id, item.programType);
      setNrkUrl(url);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function velgSpotify(track) {
    if (!auth?.accessToken) {
      setPendingTrack(track); setShowVoksenModal(true); return;
    }
    if (activeItem?.id === track.id && source === "spotify") return;
    stopAll();
    setSource("spotify"); setActiveItem({ ...track, cover: spotifyCovers[track.id] });
    setActiveSectionId("spotify"); setLoading(true); setFullscreen(true);
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") { setPendingTrack(track); setShowVoksenModal(true); setFullscreen(false); }
    } finally { setLoading(false); }
  }

  async function handleVoksenRetry() {
    setShowVoksenModal(false);
    const freshAuth = await getMe();
    if (freshAuth?.loggedIn) setAuth(freshAuth);
    if (pendingTrack) {
      const t = pendingTrack; setPendingTrack(null);
      setTimeout(() => velgSpotify(t), 300);
    }
  }

  async function togglePlay() {
    if (source === "nrk") {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) { audio.pause(); setPlaying(false); }
      else { audio.play().then(() => setPlaying(true)); }
    } else if (source === "spotify" && auth?.accessToken) {
      if (playing) { await spotifyPause(auth.accessToken); setPlaying(false); }
      else { await spotifyPlay(activeItem.uri, auth.accessToken); setPlaying(true); }
    }
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const activeAccent      = SECTION_ACCENTS[activeSectionId] || HEADER;
  const activeSectionColor = SECTION_COLORS[activeSectionId]  || "#E3F2F9";

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes glowSwell {
          0%   { opacity: 0.6;  transform: scale(0.97); }
          50%  { opacity: 0.95; transform: scale(1.03); }
          100% { opacity: 0.6;  transform: scale(0.97); }
        }
        @keyframes eqbar { from{height:4px} to{height:15px} }
      `}</style>
      <audio ref={audioRef} />

      {/* Fullskjerm spiller */}
      {fullscreen && activeItem && (
        <FullPlayer
          item={activeItem}
          accent={activeAccent}
          sectionColor={activeSectionColor}
          source={source}
          playing={playing}
          loading={loading}
          progress={progress}
          duration={duration}
          onToggle={togglePlay}
          onClose={() => setFullscreen(false)}
          onSeek={seek}
        />
      )}

      {/* Voksen-modal */}
      {showVoksenModal && (
        <SpotifyVoksenModal
          onRetry={handleVoksenRetry}
          onDismiss={() => setShowVoksenModal(false)}
        />
      )}

      {/* Header */}
      <div style={{ background: HEADER, padding: "28px 20px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: YELLOW, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Pleiboks</div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>Hva vil du høre? 🎧</div>
      </div>

      {/* Innhold */}
      <div style={{ padding: "16px 20px 0", paddingBottom: activeItem ? 100 : 40, maxWidth: 480, margin: "0 auto" }}>

        {/* NRK-seksjoner */}
        {NRK_SECTIONS.map((section) => {
          const acc   = SECTION_ACCENTS[section.id] || HEADER;
          const color = SECTION_COLORS[section.id]  || "#E3F2F9";
          return (
            <div key={section.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, background: acc,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                }}>{section.icon}</div>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#1a1a1a" }}>{section.label}</span>
              </div>
              {section.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={{ ...item, cover: nrkCovers[item.id] }}
                  accent={acc}
                  sectionColor={color}
                  isActive={source === "nrk" && activeItem?.id === item.id}
                  playing={playing}
                  onSelect={() => velgNrk(item, section.id)}
                />
              ))}
            </div>
          );
        })}

        {/* Spotify-seksjon */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, background: SECTION_ACCENTS["spotify"],
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>🎵</div>
            <span style={{ fontWeight: 900, fontSize: 16, color: "#1a1a1a" }}>Kutoppen</span>
          </div>
          {SPOTIFY_TRACKS.map((track) => (
            <ItemCard
              key={track.id}
              item={{ ...track, cover: spotifyCovers[track.id] }}
              accent={SECTION_ACCENTS["spotify"]}
              sectionColor={SECTION_COLORS["spotify"]}
              isActive={source === "spotify" && activeItem?.id === track.id}
              playing={playing}
              onSelect={() => velgSpotify(track)}
            />
          ))}
          {!auth?.loggedIn && (
            <p style={{ color: "#aaa", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 4 }}>
              🔒 Trykk på en sang for å koble til Spotify
            </p>
          )}
        </div>
      </div>

      {/* Mini-spiller */}
      {activeItem && !fullscreen && (
        <div style={{
          position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)",
          width: "calc(100% - 24px)", maxWidth: 456,
          background: activeAccent,
          borderRadius: 22,
          padding: "12px 16px 14px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        }}>
          <Cover
            item={activeItem}
            sectionColor={activeSectionColor}
            size={56} radius={14}
            playing={playing}
            onClick={() => setFullscreen(true)}
            mini={true}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 800, marginBottom: 2 }}>Spiller nå</div>
            <div style={{
              color: "#fff", fontWeight: 900, fontSize: 15,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{activeItem.emoji} {activeItem.title}</div>
          </div>
          <PlayBtn playing={playing} accent={activeAccent} size={52} onClick={togglePlay} dark />
        </div>
      )}
    </div>
  );
}
