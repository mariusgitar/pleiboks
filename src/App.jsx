import { useState, useEffect, useRef } from "react";

// ── NRK Hallo Bablo-episoder ─────────────────────────────────────
const EPISODES = [
  { id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9", title: "Oversvømmelse", emoji: "🌊" },
  { id: "l_e6b980ce-8601-476a-b980-ce8601176a46", title: "Lottes banneshow", emoji: "🤐" },
  { id: "l_fbd86653-d114-44a4-9866-53d11464a4ae", title: "Ja-dag", emoji: "✅" },
  { id: "l_8172372d-510a-49d6-b237-2d510af9d6ac", title: "Superlimet", emoji: "🔧" },
];

// ── Kutoppen-sanger ──────────────────────────────────────────────
const TRACKS = [
  { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake", artist: "Kutoppen & Lisa Børud", emoji: "🥤" },
  { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested", artist: "Kutoppen & Klara", emoji: "🌈" },
  { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru", artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
  { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare", artist: "Kutoppen & Sol Heilo", emoji: "😄" },
];

// ── NRK API ──────────────────────────────────────────────────────
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
    const sorted = arr.filter((i) => i?.url).sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || null;
  } catch { return null; }
}

// ── Spotify API ──────────────────────────────────────────────────
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

// ── Hent voksen-skjerm ───────────────────────────────────────────
function HentVoksenSkjerm({ onRetry }) {
  const [showGuide, setShowGuide] = useState(false);
  const accent = "#1B4D5C";
  const yellow = "#F5C842";
  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px", fontFamily: "'Nunito', system-ui, sans-serif",
      textAlign: "center",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🎵</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, color: accent, margin: "0 0 12px" }}>
        Musikken er ikke klar!
      </h2>
      <p style={{ fontSize: 17, color: "#555", fontWeight: 700, margin: "0 0 32px", lineHeight: 1.5 }}>
        Hent en voksen — de vet hva de skal gjøre 😊
      </p>
      <button onClick={() => setShowGuide(!showGuide)} style={{
        background: "none", border: `2px solid ${accent}`,
        borderRadius: 12, padding: "10px 20px",
        color: accent, fontWeight: 800, fontSize: 14,
        cursor: "pointer", marginBottom: 24, fontFamily: "inherit",
      }}>
        {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
      </button>
      {showGuide && (
        <div style={{
          background: "#fff", borderRadius: 16, padding: "20px 24px",
          maxWidth: 340, textAlign: "left",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 24,
        }}>
          <div style={{ fontWeight: 900, color: accent, fontSize: 15, marginBottom: 12 }}>
            Slik kobler du til Spotify:
          </div>
          {[
            "Åpne Spotify-appen på denne iPaden",
            "Spill en hvilken som helst sang i noen sekunder",
            "Gå tilbake til denne appen",
            'Trykk "Prøv igjen" nedenfor',
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: yellow,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, flexShrink: 0, color: accent,
              }}>{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#333", lineHeight: 1.4, paddingTop: 3 }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onRetry} style={{
        background: accent, color: "#fff", border: "none",
        borderRadius: 14, padding: "14px 32px",
        fontWeight: 900, fontSize: 16, cursor: "pointer",
        fontFamily: "inherit", boxShadow: "0 4px 14px rgba(27,77,92,0.3)",
      }}>
        Prøv igjen
      </button>
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
      padding: 32, fontFamily: "'Nunito', system-ui, sans-serif",
      textAlign: "center",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🔐</div>
      <h2 style={{ fontWeight: 900, color: accent, fontSize: 24, margin: "0 0 10px" }}>
        Koble til Spotify
      </h2>
      <p style={{ color: "#666", fontWeight: 700, marginBottom: 32, fontSize: 15 }}>
        Logg inn med Spotify én gang, så er alt klart for barnet.
      </p>
      <a href="/api/login" style={{
        background: "#1DB954", color: "#fff", borderRadius: 14,
        padding: "14px 32px", fontWeight: 900, fontSize: 16,
        textDecoration: "none", display: "inline-block",
      }}>
        Logg inn med Spotify
      </a>
    </div>
  );
}

// ── Kortkomponent ────────────────────────────────────────────────
function MediaCard({ title, emoji, cover, isActive, playing, onClick }) {
  const yellow = "#F5C842";
  return (
    <button
      onClick={onClick}
      style={{
        background: cover ? `url(${cover}) center/cover no-repeat` : "#e8ddd0",
        border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
        borderRadius: 16, padding: 0, cursor: "pointer",
        aspectRatio: "1 / 1", position: "relative", overflow: "hidden",
        boxShadow: isActive ? "0 8px 24px rgba(27,77,92,0.35)" : "0 2px 8px rgba(0,0,0,0.10)",
        transform: isActive ? "scale(1.03)" : "scale(1)",
        transition: "all 0.18s ease",
      }}
    >
      {!cover && (
        <span style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 48,
        }}>{emoji}</span>
      )}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.72) 100%)",
      }} />
      {isActive && playing && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 10, height: 10, borderRadius: "50%",
          background: yellow, boxShadow: `0 0 8px ${yellow}`,
        }} />
      )}
      <div style={{
        position: "absolute", bottom: 10, left: 10, right: 10,
        color: "#fff", fontWeight: 800, fontSize: 13,
        lineHeight: 1.3, textAlign: "left",
        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      }}>{title}</div>
    </button>
  );
}

// ── Seksjonstittel ───────────────────────────────────────────────
function SectionHeader({ icon, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "0 16px", marginBottom: 12,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontWeight: 900, fontSize: 16, color: "#1B4D5C", letterSpacing: 0.3 }}>{label}</span>
    </div>
  );
}

// ── Hovedapp ─────────────────────────────────────────────────────
export default function App() {
  const accent = "#1B4D5C";
  const yellow = "#F5C842";

  // Auth
  const [auth, setAuth] = useState(null);

  // Covers
  const [nrkCovers, setNrkCovers] = useState({});
  const [spotifyCovers, setSpotifyCovers] = useState({});

  // Aktiv kilde: "nrk" | "spotify" | null
  const [source, setSource] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noDevice, setNoDevice] = useState(false);

  // NRK audio
  const audioRef = useRef(null);
  const [nrkUrl, setNrkUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sjekk Spotify-innlogging
  useEffect(() => {
    getMe().then((data) => setAuth(data?.loggedIn ? data : false));
  }, []);

  // Last NRK-covers
  useEffect(() => {
    Promise.all(EPISODES.map((ep) => fetchNrkCover(ep.id))).then((results) => {
      const map = {};
      results.forEach((url, i) => { if (url) map[EPISODES[i].id] = url; });
      setNrkCovers(map);
    });
  }, []);

  // Last Spotify-covers (bare hvis innlogget)
  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(TRACKS).then(setSpotifyCovers);
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

  // Stopp NRK når Spotify starter og omvendt
  function stopAll() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setNrkUrl(null);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }

  async function velgNrk(ep) {
    stopAll();
    setNoDevice(false);
    setSource("nrk");
    setActiveItem(ep);
    setLoading(true);
    try {
      const url = await fetchNrkManifest(ep.id);
      setNrkUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nrkUrl) return;
    audio.src = nrkUrl;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [nrkUrl]);

  async function velgSpotify(track) {
    if (!auth?.accessToken) return;
    stopAll();
    setNoDevice(false);
    setSource("spotify");
    setActiveItem(track);
    setLoading(true);
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") setNoDevice(true);
    } finally {
      setLoading(false);
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

  const pct = duration ? (progress / duration) * 100 : 0;

  // ── Render ───────────────────────────────────────────────────
  if (auth === null) {
    return (
      <div style={{
        minHeight: "100vh", background: "#FDF6EC",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Nunito', system-ui, sans-serif",
        fontSize: 18, color: accent, fontWeight: 800,
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
        Laster…
      </div>
    );
  }

  if (auth === false) return <InnloggingSkjerm />;
  if (noDevice) return <HentVoksenSkjerm onRetry={() => { setNoDevice(false); if (activeItem && source === "spotify") velgSpotify(activeItem); }} />;

  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Nunito', system-ui, sans-serif", paddingBottom: 48,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <audio ref={audioRef} />

      {/* Header */}
      <div style={{
        width: "100%", background: accent,
        padding: "28px 24px 20px", marginBottom: 28, boxSizing: "border-box",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: yellow, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Pleiboks
        </div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
          Hva vil du høre?
        </h1>
      </div>

      <div style={{ width: "100%", maxWidth: 480, padding: "0 0 28px", boxSizing: "border-box" }}>

        {/* ── NRK-seksjon ── */}
        <SectionHeader icon="📻" label="Hallo Bablo" />
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 12, padding: "0 16px", marginBottom: 32,
        }}>
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

        {/* ── Spotify-seksjon ── */}
        <SectionHeader icon="🎵" label="Kutoppen" />
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 12, padding: "0 16px", marginBottom: 28,
        }}>
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

      {/* ── Spiller ── */}
      {activeItem && (
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px", boxSizing: "border-box" }}>
          <div style={{
            background: "#fff", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          }}>
            {/* Info-stripe */}
            <div style={{
              background: accent, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: (source === "nrk" ? nrkCovers : spotifyCovers)[activeItem.id]
                  ? `url(${(source === "nrk" ? nrkCovers : spotifyCovers)[activeItem.id]}) center/cover`
                  : "#2a6070",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {!(source === "nrk" ? nrkCovers : spotifyCovers)[activeItem.id] && activeItem.emoji}
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                  {source === "nrk" ? "Hallo Bablo" : "Kutoppen"} · Spiller nå
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{activeItem.title}</div>
                {activeItem.artist && (
                  <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12 }}>{activeItem.artist}</div>
                )}
              </div>
            </div>

            {/* Kontroller */}
            <div style={{ padding: "20px 18px 24px" }}>
              {loading && (
                <div style={{ textAlign: "center", color: accent, fontWeight: 800, fontSize: 15 }}>Laster…</div>
              )}

              {!loading && source === "nrk" && nrkUrl && (
                <>
                  <div onClick={seek} style={{
                    height: 8, background: "#EDE8E1", borderRadius: 4,
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
                    color: "#a09888", fontSize: 12, fontWeight: 700, marginBottom: 20,
                  }}>
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </>
              )}

              {!loading && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button onClick={togglePlay} style={{
                    width: 68, height: 68, borderRadius: "50%",
                    background: playing ? "#fff" : accent,
                    border: playing ? `3px solid ${accent}` : "none",
                    cursor: "pointer", fontSize: 26,
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
        </div>
      )}
    </div>
  );
}
