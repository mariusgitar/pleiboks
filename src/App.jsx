import { useState, useEffect, useRef } from "react";

// ── Innholdsdata ──────────────────────────────────────────────────

const NRK_SECTIONS = [
  {
    id: "hallo-bablo",
    label: "Hallo Bablo",
    icon: "📚",
    type: "podcast",
    items: [
      { id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9", title: "Oversvømmelse", emoji: "🌊" },
      { id: "l_e6b980ce-8601-476a-b980-ce8601176a46", title: "Lottes banneshow", emoji: "🤐" },
      { id: "l_fbd86653-d114-44a4-9866-53d11464a4ae", title: "Ja-dag", emoji: "✅" },
      { id: "l_8172372d-510a-49d6-b237-2d510af9d6ac", title: "Superlimet", emoji: "🔧" },
    ],
  },
  {
    id: "kokosbananas",
    label: "Kokosbananas",
    icon: "🥥",
    type: "podcast",
    items: [
      { id: "l_810de249-e5d3-4a12-8de2-49e5d33a12d2", title: "Sykkelplanen", emoji: "🚲" },
      { id: "l_21414849-4480-4ca2-8148-494480fca285", title: "Kokosbananas", emoji: "🍌" },
    ],
  },
  {
    id: "fantorangen",
    label: "Fantorangen",
    icon: "🧡",
    type: "podcast",
    items: [
      { id: "l_8e42fb20-bb6f-404c-82fb-20bb6f004c5f", title: "Kjempe-Fantus", emoji: "🌳" },
      { id: "l_01779e9e-49ad-41ff-b79e-9e49ad11ffc0", title: "Fantus forsvinn", emoji: "📺" },
      { id: "l_9124669c-0fc4-4660-a466-9c0fc4b6609a", title: "Fantorangen tryllerydder", emoji: "🪄" },
    ],
  },
  {
    id: "karsten-petra",
    label: "Karsten og Petra",
    icon: "👫",
    type: "podcast",
    // Karsten og Petra er radioprogram — vi bruker musikk_fra_nrk_super-podkasten for
    // de episodene som finnes der, ellers program-endepunktet
    items: [
      { id: "MKTT05000605", title: "Bestevenner", emoji: "🤝", programType: "program" },
      { id: "MKTT05000505", title: "Petra begynner i barnehagen", emoji: "🏫", programType: "program" },
      { id: "MKTT04000104", title: "Karsten kjører brannbil", emoji: "🚒", programType: "program" },
    ],
  },
  {
    id: "blime",
    label: "BlimE!",
    icon: "🌈",
    type: "podcast",
    items: [
      { id: "l_bd313b9d-5f6b-44a1-b13b-9d5f6b84a16b", title: "Kom igjen 'a (2016)", emoji: "🎤" },
      { id: "l_2ae9578e-b9ef-4451-a957-8eb9ef0451f2", title: "Halloween", emoji: "🎃" },
      { id: "l_184d0d69-e4ba-4316-8d0d-69e4bad3165a", title: "Kua mi", emoji: "🐄" },
    ],
  },
];

const SPOTIFY_TRACKS = [
  { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake", artist: "Kutoppen & Lisa Børud", emoji: "🥤" },
  { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested", artist: "Kutoppen & Klara", emoji: "🌈" },
  { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru", artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
  { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare", artist: "Kutoppen & Sol Heilo", emoji: "😄" },
];

const accent = "#1B4D5C";
const yellow = "#F5C842";

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

// ── Hent voksen (kun for Spotify) ────────────────────────────────
function SpotifyVoksenModal({ onRetry, onDismiss }) {
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end",
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FDF6EC", width: "100%",
          borderRadius: "20px 20px 0 0",
          padding: "24px 24px 40px",
          maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎵</div>
          <h2 style={{ fontWeight: 900, color: accent, fontSize: 22, margin: "0 0 8px" }}>
            Musikken er ikke klar!
          </h2>
          <p style={{ color: "#555", fontWeight: 700, fontSize: 15, margin: 0 }}>
            Hent en voksen — de vet hva de skal gjøre 😊
          </p>
        </div>

        <button onClick={() => setShowGuide(!showGuide)} style={{
          display: "block", width: "100%",
          background: "none", border: `2px solid ${accent}`, borderRadius: 12,
          padding: "10px 20px", color: accent, fontWeight: 800, fontSize: 14,
          cursor: "pointer", marginBottom: 16, fontFamily: "inherit",
        }}>
          {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
        </button>

        {showGuide && (
          <div style={{
            background: "#fff", borderRadius: 16, padding: "16px 20px", marginBottom: 16,
          }}>
            <div style={{ fontWeight: 900, color: accent, fontSize: 14, marginBottom: 10 }}>
              Slik kobler du til Spotify:
            </div>
            {["Åpne Spotify-appen på denne iPaden", "Spill en hvilken som helst sang i noen sekunder", "Gå tilbake til denne appen", 'Trykk "Prøv igjen" nedenfor'].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: yellow,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 12, flexShrink: 0, color: accent,
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#333", lineHeight: 1.4, paddingTop: 3 }}>{step}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDismiss} style={{
            flex: 1, background: "#fff", color: accent,
            border: `2px solid ${accent}`, borderRadius: 14,
            padding: "12px", fontWeight: 900, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>Avbryt</button>
          <button onClick={onRetry} style={{
            flex: 2, background: accent, color: "#fff", border: "none",
            borderRadius: 14, padding: "12px", fontWeight: 900, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>Prøv igjen</button>
        </div>
      </div>
    </div>
  );
}

// ── Mediakort ─────────────────────────────────────────────────────
function MediaCard({ title, emoji, cover, isActive, playing, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", padding: 0,
      cursor: "pointer", textAlign: "left",
      transform: isActive ? "scale(1.04)" : "scale(1)",
      transition: "all 0.18s ease",
    }}>
      <div style={{
        width: "100%", aspectRatio: "1 / 1",
        background: cover ? `url(${cover}) center/cover no-repeat` : "#e8ddd0",
        borderRadius: 14,
        border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
        boxShadow: isActive ? "0 6px 20px rgba(27,77,92,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!cover && <span style={{ fontSize: 36 }}>{emoji}</span>}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }} />
        {isActive && playing && (
          <div style={{
            position: "absolute", top: 7, right: 7,
            width: 9, height: 9, borderRadius: "50%",
            background: yellow, boxShadow: `0 0 6px ${yellow}`,
          }} />
        )}
        <div style={{
          position: "absolute", bottom: 7, left: 7, right: 7,
          color: "#fff", fontWeight: 800, fontSize: 11, lineHeight: 1.3,
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        }}>
          {emoji} {title}
        </div>
      </div>
    </button>
  );
}

// ── Seksjonstittel ────────────────────────────────────────────────
function SectionHeader({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontWeight: 900, fontSize: 16, color: accent }}>{label}</span>
    </div>
  );
}

// ── Innebygd spiller ──────────────────────────────────────────────
function InlinePlayer({ item, source, cover, playing, loading, progress, duration, onToggle, onSeek }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
    }}>
      <div style={{
        width: "100%", aspectRatio: "16 / 9",
        background: cover ? `url(${cover}) center/cover no-repeat` : `linear-gradient(135deg, ${accent}, #2a6070)`,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!cover && <span style={{ fontSize: 72 }}>{item.emoji}</span>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
            {source === "spotify" ? "Kutoppen · Spotify" : "NRK Super"} · Spiller nå
          </div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, marginTop: 2 }}>
            {item.emoji} {item.title}
          </div>
          {item.artist && <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 12 }}>{item.artist}</div>}
        </div>
      </div>

      <div style={{ padding: "16px 18px 22px" }}>
        {loading && <div style={{ textAlign: "center", color: accent, fontWeight: 800, fontSize: 15, padding: "8px 0" }}>Laster…</div>}

        {!loading && source !== "spotify" && duration > 0 && (
          <>
            <div onClick={onSeek} style={{
              height: 7, background: "#EDE8E1", borderRadius: 4,
              cursor: "pointer", position: "relative", marginBottom: 8,
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${pct}%`, background: accent, borderRadius: 4,
                transition: "width 0.4s linear",
              }} />
              <div style={{
                position: "absolute", top: "50%", left: `${pct}%`,
                transform: "translate(-50%, -50%)",
                width: 16, height: 16, borderRadius: "50%",
                background: accent, border: "3px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              color: "#a09888", fontSize: 12, fontWeight: 700, marginBottom: 16,
            }}>
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </>
        )}

        {!loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: source === "spotify" ? 8 : 0 }}>
            <button onClick={onToggle} style={{
              width: 72, height: 72, borderRadius: "50%",
              background: playing ? "#fff" : accent,
              border: playing ? `3px solid ${accent}` : "none",
              cursor: "pointer", fontSize: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: playing ? accent : "#fff",
              boxShadow: playing ? "none" : "0 4px 16px rgba(27,77,92,0.35)",
              transition: "all 0.18s ease", fontFamily: "inherit",
            }}>
              {playing ? "⏸" : "▶"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hovedapp ──────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null); // null=laster, false=ikke logget inn, obj=innlogget
  const [spotifyCovers, setSpotifyCovers] = useState({});
  const [nrkCovers, setNrkCovers] = useState({});

  const [source, setSource] = useState(null); // "nrk" | "spotify"
  const [activeItem, setActiveItem] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVoksenModal, setShowVoksenModal] = useState(false);
  const [pendingSpotifyTrack, setPendingSpotifyTrack] = useState(null);

  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const [nrkUrl, setNrkUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sjekk Spotify stille i bakgrunnen (ikke blokker appen)
  useEffect(() => {
    getMe().then((d) => setAuth(d?.loggedIn ? d : false));
  }, []);

  // Last NRK-covers for alle seksjoner
  useEffect(() => {
    const allItems = NRK_SECTIONS.flatMap((s) => s.items);
    Promise.all(allItems.map((item) => fetchNrkCover(item.id, item.programType))).then((results) => {
      const map = {};
      results.forEach((url, i) => { if (url) map[allItems[i].id] = url; });
      setNrkCovers(map);
    });
  }, []);

  // Last Spotify-covers (bare hvis innlogget)
  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(SPOTIFY_TRACKS).then(setSpotifyCovers);
  }, [auth]);

  // NRK audio-events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
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

  // Scroll til spiller
  useEffect(() => {
    if (activeItem && playerRef.current) {
      setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }, [activeItem]);

  function stopAll() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setNrkUrl(null); setPlaying(false); setProgress(0); setDuration(0);
  }

  async function velgNrk(item) {
    if (activeItem?.id === item.id && source === "nrk") return;
    stopAll(); setSource("nrk"); setActiveItem(item); setLoading(true);
    try {
      const url = await fetchNrkManifest(item.id, item.programType);
      setNrkUrl(url);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nrkUrl) return;
    audio.src = nrkUrl;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [nrkUrl]);

  async function velgSpotify(track) {
    // Ikke innlogget ennå — vis voksenskjerm og lagre track for retry
    if (!auth?.accessToken) {
      setPendingSpotifyTrack(track);
      setShowVoksenModal(true);
      return;
    }
    if (activeItem?.id === track.id && source === "spotify") return;
    stopAll(); setSource("spotify"); setActiveItem(track); setLoading(true);
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") {
        setPendingSpotifyTrack(track);
        setShowVoksenModal(true);
      }
    } finally { setLoading(false); }
  }

  async function handleVoksenRetry() {
    setShowVoksenModal(false);
    // Prøv å hente token på nytt
    const freshAuth = await getMe();
    if (freshAuth?.loggedIn) setAuth(freshAuth);

    if (pendingSpotifyTrack) {
      const track = pendingSpotifyTrack;
      setPendingSpotifyTrack(null);
      // Vent litt så auth er oppdatert
      setTimeout(() => velgSpotify(track), 300);
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

  const activeCover = activeItem
    ? (source === "spotify" ? spotifyCovers : nrkCovers)[activeItem.id]
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#FDF6EC", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap'); * { box-sizing: border-box; }`}</style>
      <audio ref={audioRef} />

      {/* Voksen-modal for Spotify */}
      {showVoksenModal && (
        <SpotifyVoksenModal
          onRetry={handleVoksenRetry}
          onDismiss={() => setShowVoksenModal(false)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ width: "100%", background: accent, padding: "28px 24px 20px", marginBottom: 24, boxSizing: "border-box" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: yellow, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Pleiboks</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>Hva vil du høre?</h1>
        </div>

        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* NRK-seksjoner */}
          {NRK_SECTIONS.map((section) => (
            <div key={section.id} style={{ marginBottom: 28 }}>
              <SectionHeader icon={section.icon} label={section.label} />
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(section.items.length, 4)}, 1fr)`,
                gap: 10, padding: "0 16px",
              }}>
                {section.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    title={item.title}
                    emoji={item.emoji}
                    cover={nrkCovers[item.id]}
                    isActive={source === "nrk" && activeItem?.id === item.id}
                    playing={playing}
                    onClick={() => velgNrk(item)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Spotify-seksjon */}
          <div style={{ marginBottom: 28 }}>
            <SectionHeader icon="🎵" label="Kutoppen" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "0 16px" }}>
              {SPOTIFY_TRACKS.map((track) => (
                <MediaCard
                  key={track.id}
                  title={track.title}
                  emoji={track.emoji}
                  cover={spotifyCovers[track.id]}
                  isActive={source === "spotify" && activeItem?.id === track.id}
                  playing={playing}
                  onClick={() => velgSpotify(track)}
                />
              ))}
            </div>
            {!auth?.loggedIn && (
              <p style={{ color: "#a09888", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 8, padding: "0 16px" }}>
                🔒 Trykk på en sang for å koble til Spotify
              </p>
            )}
          </div>

          {/* Spiller */}
          {activeItem && (
            <div ref={playerRef} style={{ padding: "0 16px" }}>
              <InlinePlayer
                item={activeItem}
                source={source}
                cover={activeCover}
                playing={playing}
                loading={loading}
                progress={progress}
                duration={duration}
                onToggle={togglePlay}
                onSeek={seek}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
