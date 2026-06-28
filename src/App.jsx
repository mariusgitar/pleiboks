import { useState, useEffect, useRef } from "react";

const EPISODES = [
  { id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9", title: "Oversvømmelse", emoji: "🌊" },
  { id: "l_e6b980ce-8601-476a-b980-ce8601176a46", title: "Lottes banneshow", emoji: "🤐" },
  { id: "l_fbd86653-d114-44a4-9866-53d11464a4ae", title: "Ja-dag", emoji: "✅" },
  { id: "l_8172372d-510a-49d6-b237-2d510af9d6ac", title: "Superlimet", emoji: "🔧" },
];

const TRACKS = [
  { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake", artist: "Kutoppen & Lisa Børud", emoji: "🥤" },
  { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested", artist: "Kutoppen & Klara", emoji: "🌈" },
  { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru", artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
  { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare", artist: "Kutoppen & Sol Heilo", emoji: "😄" },
];

// ── API ───────────────────────────────────────────────────────────
async function fetchNrkManifest(id) {
  const res = await fetch(`/api/manifest?id=${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const assets = data?.playable?.assets;
  if (!assets?.length) throw new Error("Ingen assets");
  const mp3 = assets.find((a) => a.format === "MP3") || assets[0];
  if (!mp3?.url) throw new Error("Ingen URL");
  return mp3.url;
}

async function fetchNrkCover(id) {
  try {
    const res = await fetch(`/api/metadata?id=${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const images = data?.preplay?.poster?.images || data?.preplay?.images || data?.images || data?.image;
    if (!images) return null;
    const arr = Array.isArray(images) ? images : [images];
    return arr.filter((i) => i?.url).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;
  } catch { return null; }
}

async function getMe() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
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

// ── Hent voksen ───────────────────────────────────────────────────
function HentVoksenSkjerm({ onRetry }) {
  const [showGuide, setShowGuide] = useState(false);
  const accent = "#1B4D5C";
  const yellow = "#F5C842";
  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px", fontFamily: "'Nunito', system-ui, sans-serif", textAlign: "center",
    }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🎵</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, color: accent, margin: "0 0 12px" }}>Musikken er ikke klar!</h2>
      <p style={{ fontSize: 17, color: "#555", fontWeight: 700, margin: "0 0 32px", lineHeight: 1.5 }}>
        Hent en voksen — de vet hva de skal gjøre 😊
      </p>
      <button onClick={() => setShowGuide(!showGuide)} style={{
        background: "none", border: `2px solid ${accent}`, borderRadius: 12,
        padding: "10px 20px", color: accent, fontWeight: 800, fontSize: 14,
        cursor: "pointer", marginBottom: 24, fontFamily: "inherit",
      }}>
        {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
      </button>
      {showGuide && (
        <div style={{
          background: "#fff", borderRadius: 16, padding: "20px 24px",
          maxWidth: 340, textAlign: "left", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 24,
        }}>
          <div style={{ fontWeight: 900, color: accent, fontSize: 15, marginBottom: 12 }}>Slik kobler du til Spotify:</div>
          {["Åpne Spotify-appen på denne iPaden", "Spill en hvilken som helst sang i noen sekunder", "Gå tilbake til denne appen", 'Trykk "Prøv igjen" nedenfor'].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: yellow,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, flexShrink: 0, color: accent,
              }}>{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#333", lineHeight: 1.4, paddingTop: 3 }}>{step}</div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onRetry} style={{
        background: accent, color: "#fff", border: "none", borderRadius: 14,
        padding: "14px 32px", fontWeight: 900, fontSize: 16,
        cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(27,77,92,0.3)",
      }}>Prøv igjen</button>
    </div>
  );
}

function InnloggingSkjerm() {
  const accent = "#1B4D5C";
  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, fontFamily: "'Nunito', system-ui, sans-serif", textAlign: "center",
    }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🔐</div>
      <h2 style={{ fontWeight: 900, color: "#1B4D5C", fontSize: 24, margin: "0 0 10px" }}>Koble til Spotify</h2>
      <p style={{ color: "#666", fontWeight: 700, marginBottom: 32, fontSize: 15 }}>
        Logg inn med Spotify én gang, så er alt klart for barnet.
      </p>
      <a href="/api/login" style={{
        background: "#1DB954", color: "#fff", borderRadius: 14,
        padding: "14px 32px", fontWeight: 900, fontSize: 16,
        textDecoration: "none", display: "inline-block",
      }}>Logg inn med Spotify</a>
    </div>
  );
}

// ── Galleri-kort: 3:4 ratio, emoji + tittel under bildet ─────────
function MediaCard({ title, emoji, cover, isActive, playing, onClick }) {
  const yellow = "#F5C842";
  const accent = "#1B4D5C";
  return (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", padding: 0,
        cursor: "pointer", textAlign: "left",
        transform: isActive ? "scale(1.03)" : "scale(1)",
        transition: "all 0.18s ease",
      }}
    >
      {/* Bildeflate — 3:4 ratio, viser mer av bildet */}
      <div style={{
        width: "100%",
        aspectRatio: "3 / 4",
        background: cover ? `url(${cover}) center/contain no-repeat #f0e8de` : "#e8ddd0",
        borderRadius: 14,
        border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
        boxShadow: isActive ? "0 8px 24px rgba(27,77,92,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {!cover && <span style={{ fontSize: 52 }}>{emoji}</span>}

        {/* Spilleindikator */}
        {isActive && playing && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 10, height: 10, borderRadius: "50%",
            background: yellow, boxShadow: `0 0 8px ${yellow}`,
          }} />
        )}
      </div>

      {/* Tittel under bildet med stor emoji */}
      <div style={{ marginTop: 8, paddingLeft: 2 }}>
        <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 3 }}>{emoji}</div>
        <div style={{
          fontSize: 13, fontWeight: 800,
          color: isActive ? accent : "#333",
          lineHeight: 1.3,
        }}>{title}</div>
      </div>
    </button>
  );
}

// ── Fullskjerm-spiller ────────────────────────────────────────────
function FullscreenPlayer({ item, source, cover, playing, loading, progress, duration, onToggle, onSeek, onClose }) {
  const accent = "#1B4D5C";
  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", flexDirection: "column",
      background: cover ? "transparent" : accent,
    }}>
      {/* Bakgrunnsbilde med blur */}
      {cover && (
        <>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) brightness(0.4)",
            transform: "scale(1.1)",
          }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
        </>
      )}

      {/* Innhold */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", height: "100%",
        padding: "0 24px 48px",
      }}>
        {/* Lukk-knapp */}
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", paddingTop: 56 }}>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: 12, padding: "8px 16px",
            color: "#fff", fontWeight: 800, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ← Tilbake
          </button>
        </div>

        {/* Stort cover */}
        <div style={{
          width: "100%", maxWidth: 320,
          marginTop: "auto", marginBottom: 32,
        }}>
          {cover ? (
            <img
              src={cover}
              alt={item.title}
              style={{
                width: "100%", borderRadius: 20,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                display: "block",
              }}
            />
          ) : (
            <div style={{
              aspectRatio: "1", borderRadius: 20,
              background: "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 100,
            }}>{item.emoji}</div>
          )}
        </div>

        {/* Tittel og artist */}
        <div style={{ width: "100%", maxWidth: 320, marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
            {item.emoji} {item.title}
          </div>
          {item.artist && (
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{item.artist}</div>
          )}
          {!item.artist && (
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              {source === "nrk" ? "Hallo Bablo · NRK" : "Kutoppen"}
            </div>
          )}
        </div>

        {/* Fremdriftslinje (kun NRK) */}
        {source === "nrk" && duration > 0 && (
          <div style={{ width: "100%", maxWidth: 320, marginBottom: 8 }}>
            <div onClick={onSeek} style={{
              height: 6, background: "rgba(255,255,255,0.25)",
              borderRadius: 3, cursor: "pointer", position: "relative",
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${pct}%`, background: "#fff", borderRadius: 3,
                transition: "width 0.4s linear",
              }} />
              <div style={{
                position: "absolute", top: "50%", left: `${pct}%`,
                transform: "translate(-50%, -50%)",
                width: 14, height: 14, borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, marginTop: 6,
            }}>
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Play/pause */}
        <div style={{ marginTop: source === "nrk" ? 16 : 0 }}>
          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 800, fontSize: 16 }}>Laster…</div>
          ) : (
            <button onClick={onToggle} style={{
              width: 80, height: 80, borderRadius: "50%",
              background: playing ? "rgba(255,255,255,0.15)" : "#fff",
              border: playing ? "2px solid rgba(255,255,255,0.4)" : "none",
              cursor: "pointer", fontSize: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: playing ? "#fff" : accent,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              transition: "all 0.18s ease",
            }}>
              {playing ? "⏸" : "▶"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Seksjonstittel ────────────────────────────────────────────────
function SectionHeader({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 14 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontWeight: 900, fontSize: 17, color: "#1B4D5C" }}>{label}</span>
    </div>
  );
}

// ── Hovedapp ──────────────────────────────────────────────────────
export default function App() {
  const accent = "#1B4D5C";
  const yellow = "#F5C842";

  const [auth, setAuth] = useState(null);
  const [nrkCovers, setNrkCovers] = useState({});
  const [spotifyCovers, setSpotifyCovers] = useState({});
  const [source, setSource] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noDevice, setNoDevice] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const audioRef = useRef(null);
  const [nrkUrl, setNrkUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { getMe().then((d) => setAuth(d?.loggedIn ? d : false)); }, []);

  useEffect(() => {
    Promise.all(EPISODES.map((ep) => fetchNrkCover(ep.id))).then((results) => {
      const map = {};
      results.forEach((url, i) => { if (url) map[EPISODES[i].id] = url; });
      setNrkCovers(map);
    });
  }, []);

  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(TRACKS).then(setSpotifyCovers);
  }, [auth]);

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

  function stopAll() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setNrkUrl(null); setPlaying(false); setProgress(0); setDuration(0);
  }

  async function velgNrk(ep) {
    stopAll(); setNoDevice(false); setSource("nrk"); setActiveItem(ep); setLoading(true); setShowFullscreen(true);
    try {
      const url = await fetchNrkManifest(ep.id);
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
    if (!auth?.accessToken) return;
    stopAll(); setNoDevice(false); setSource("spotify"); setActiveItem(track); setLoading(true); setShowFullscreen(true);
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") { setNoDevice(true); setShowFullscreen(false); }
    } finally { setLoading(false); }
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
    ? (source === "nrk" ? nrkCovers : spotifyCovers)[activeItem.id]
    : null;

  if (auth === null) return (
    <div style={{ minHeight: "100vh", background: "#FDF6EC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', system-ui, sans-serif", fontSize: 18, color: accent, fontWeight: 800 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      Laster…
    </div>
  );
  if (auth === false) return <InnloggingSkjerm />;
  if (noDevice) return <HentVoksenSkjerm onRetry={() => { setNoDevice(false); if (activeItem && source === "spotify") velgSpotify(activeItem); }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#FDF6EC", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <audio ref={audioRef} />

      {/* Fullskjerm-spiller */}
      {showFullscreen && activeItem && (
        <FullscreenPlayer
          item={activeItem}
          source={source}
          cover={activeCover}
          playing={playing}
          loading={loading}
          progress={progress}
          duration={duration}
          onToggle={togglePlay}
          onSeek={seek}
          onClose={() => setShowFullscreen(false)}
        />
      )}

      {/* Galleri-visning */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 48 }}>
        {/* Header */}
        <div style={{ width: "100%", background: accent, padding: "28px 24px 20px", marginBottom: 28, boxSizing: "border-box" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: yellow, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Pleiboks</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>Hva vil du høre?</h1>
        </div>

        <div style={{ width: "100%", maxWidth: 480, boxSizing: "border-box" }}>

          {/* Mini-spiller stripe (vises når fullskjerm er lukket) */}
          {activeItem && !showFullscreen && (
            <div
              onClick={() => setShowFullscreen(true)}
              style={{
                margin: "0 16px 24px",
                background: accent, borderRadius: 16,
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", boxShadow: "0 4px 14px rgba(27,77,92,0.25)",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                background: activeCover ? `url(${activeCover}) center/cover` : "#2a6070",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>
                {!activeCover && activeItem.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                  {playing ? "Spiller nå" : "Pauset"}
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeItem.emoji} {activeItem.title}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: playing ? "rgba(255,255,255,0.15)" : "#fff",
                  border: "none", cursor: "pointer", fontSize: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: playing ? "#fff" : accent, flexShrink: 0,
                }}
              >
                {playing ? "⏸" : "▶"}
              </button>
            </div>
          )}

          {/* Hallo Bablo */}
          <SectionHeader icon="📻" label="Hallo Bablo" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "0 16px", marginBottom: 32 }}>
            {EPISODES.map((ep) => (
              <MediaCard
                key={ep.id}
                title={ep.title}
                emoji={ep.emoji}
                cover={nrkCovers[ep.id]}
                isActive={source === "nrk" && activeItem?.id === ep.id}
                playing={playing}
                onClick={() => velgNrk(ep)}
              />
            ))}
          </div>

          {/* Kutoppen */}
          <SectionHeader icon="🎵" label="Kutoppen" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "0 16px" }}>
            {TRACKS.map((track) => (
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
        </div>
      </div>
    </div>
  );
}
