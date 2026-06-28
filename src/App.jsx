import { useState, useEffect, useRef } from "react";

// ── Kutoppen-sanger ──────────────────────────────────────────────
const TRACKS = [
  {
    id: "1SMtaNiuQHnLXDB03mEAY3",
    uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3",
    title: "Milkshake",
    artist: "Kutoppen & Lisa Børud",
    emoji: "🥤",
  },
  {
    id: "2qSh87wxgTnzmm3NvTMmVR",
    uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR",
    title: "Drømmested",
    artist: "Kutoppen & Klara",
    emoji: "🌈",
  },
  {
    id: "3MLes59DmfRs7PU5fz29Rn",
    uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn",
    title: "Tru",
    artist: "Odd Nordstoga & Eva Weel Skram",
    emoji: "⭐",
  },
  {
    id: "01zmwhYAqUx66RcPTgXuLF",
    uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF",
    title: "Le Bare",
    artist: "Kutoppen & Sol Heilo",
    emoji: "😄",
  },
];

// ── API-hjelpere ─────────────────────────────────────────────────
async function getMe() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}

async function refreshToken() {
  const res = await fetch("/api/refresh", { method: "POST" });
  return res.ok;
}

async function fetchTrackInfo(id) {
  const res = await fetch(`/api/spotify-track?id=${id}`);
  if (!res.ok) return null;
  return res.json();
}

async function playTrack(uri, accessToken) {
  const res = await fetch("/api/spotify-play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackUri: uri, accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ukjent feil");
  return data;
}

async function pauseTrack(accessToken) {
  await fetch("/api/spotify-pause", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

// ── Komponenter ──────────────────────────────────────────────────
function HentVoksenSkjerm({ onRetry }) {
  const [showGuide, setShowGuide] = useState(false);
  const accent = "#1B4D5C";
  const yellow = "#F5C842";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FDF6EC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 24px",
      fontFamily: "'Nunito', system-ui, sans-serif",
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

      <button
        onClick={() => setShowGuide(!showGuide)}
        style={{
          background: "none",
          border: `2px solid ${accent}`,
          borderRadius: 12,
          padding: "10px 20px",
          color: accent,
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 24,
          fontFamily: "inherit",
        }}
      >
        {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
      </button>

      {showGuide && (
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: "20px 24px",
          maxWidth: 340,
          textAlign: "left",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: 24,
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
            <div key={i} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              marginBottom: 10,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: yellow,
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

      <button
        onClick={onRetry}
        style={{
          background: accent,
          color: "#fff",
          border: "none",
          borderRadius: 14,
          padding: "14px 32px",
          fontWeight: 900,
          fontSize: 16,
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: "0 4px 14px rgba(27,77,92,0.3)",
        }}
      >
        Prøv igjen
      </button>
    </div>
  );
}

function InnloggingSkjerm() {
  const accent = "#1B4D5C";
  return (
    <div style={{
      minHeight: "100vh",
      background: "#FDF6EC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      fontFamily: "'Nunito', system-ui, sans-serif",
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
        background: "#1DB954",
        color: "#fff",
        borderRadius: 14,
        padding: "14px 32px",
        fontWeight: 900,
        fontSize: 16,
        textDecoration: "none",
        display: "inline-block",
      }}>
        Logg inn med Spotify
      </a>
    </div>
  );
}

// ── Hovedapp ─────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null); // null = laster, false = ikke logget inn, {accessToken} = OK
  const [covers, setCovers] = useState({});
  const [active, setActive] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noDevice, setNoDevice] = useState(false);

  const accent = "#1B4D5C";
  const yellow = "#F5C842";

  // Sjekk innlogging
  useEffect(() => {
    getMe().then((data) => {
      if (data?.loggedIn) setAuth(data);
      else setAuth(false);
    });
  }, []);

  // Hent coverbilder
  useEffect(() => {
    if (!auth?.loggedIn) return;
    Promise.all(TRACKS.map((t) => fetchTrackInfo(t.id))).then((results) => {
      const map = {};
      results.forEach((r, i) => {
        if (r?.album?.images?.[0]?.url) {
          map[TRACKS[i].id] = r.album.images[0].url;
        }
      });
      setCovers(map);
    });
  }, [auth]);

  async function velgSang(track) {
    if (!auth?.accessToken) return;
    setNoDevice(false);
    setActive(track);
    setLoading(true);
    setPlaying(false);
    try {
      await playTrack(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") setNoDevice(true);
    } finally {
      setLoading(false);
    }
  }

  async function togglePlay() {
    if (!auth?.accessToken || !active) return;
    if (playing) {
      await pauseTrack(auth.accessToken);
      setPlaying(false);
    } else {
      await playTrack(active.uri, auth.accessToken);
      setPlaying(true);
    }
  }

  async function handleRetry() {
    setNoDevice(false);
    if (active) await velgSang(active);
  }

  // Laster
  if (auth === null) {
    return (
      <div style={{
        minHeight: "100vh", background: "#FDF6EC",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Nunito', system-ui, sans-serif",
        fontSize: 18, color: "#1B4D5C", fontWeight: 800,
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
        Laster…
      </div>
    );
  }

  if (auth === false) return <InnloggingSkjerm />;
  if (noDevice) return <HentVoksenSkjerm onRetry={handleRetry} />;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FDF6EC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Nunito', system-ui, sans-serif",
      paddingBottom: 48,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>

      {/* Header */}
      <div style={{
        width: "100%",
        background: accent,
        padding: "28px 24px 20px",
        marginBottom: 24,
        boxSizing: "border-box",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: yellow, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Kutoppen
        </div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
          Musikk
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "6px 0 0", fontWeight: 700 }}>
          Velg en sang
        </p>
      </div>

      {/* Sanggrid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
        width: "100%",
        maxWidth: 480,
        padding: "0 16px",
        marginBottom: 28,
        boxSizing: "border-box",
      }}>
        {TRACKS.map((track) => {
          const isActive = active?.id === track.id;
          const cover = covers[track.id];
          return (
            <button
              key={track.id}
              onClick={() => velgSang(track)}
              style={{
                background: cover ? `url(${cover}) center/cover no-repeat` : "#e8ddd0",
                border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
                borderRadius: 16,
                padding: 0,
                cursor: "pointer",
                aspectRatio: "1 / 1",
                position: "relative",
                overflow: "hidden",
                boxShadow: isActive ? `0 8px 24px rgba(27,77,92,0.35)` : "0 2px 8px rgba(0,0,0,0.10)",
                transform: isActive ? "scale(1.03)" : "scale(1)",
                transition: "all 0.18s ease",
              }}
            >
              {!cover && (
                <span style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 48,
                }}>{track.emoji}</span>
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
              }}>
                {track.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Spiller */}
      {active && (
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px", boxSizing: "border-box" }}>
          <div style={{
            background: "#fff",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          }}>
            {/* Sang-stripe */}
            <div style={{
              background: accent,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: covers[active.id] ? `url(${covers[active.id]}) center/cover` : "#2a6070",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {!covers[active.id] && active.emoji}
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                  Spiller nå
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{active.title}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12 }}>{active.artist}</div>
              </div>
            </div>

            {/* Kontroller */}
            <div style={{ padding: "20px 18px 24px", display: "flex", justifyContent: "center" }}>
              {loading ? (
                <div style={{ color: accent, fontWeight: 800, fontSize: 15 }}>Laster…</div>
              ) : (
                <button
                  onClick={togglePlay}
                  style={{
                    width: 68, height: 68, borderRadius: "50%",
                    background: playing ? "#fff" : accent,
                    border: playing ? `3px solid ${accent}` : "none",
                    cursor: "pointer",
                    fontSize: 26,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: playing ? accent : "#fff",
                    boxShadow: playing ? "none" : "0 4px 16px rgba(27,77,92,0.35)",
                    transition: "all 0.18s ease",
                    fontFamily: "inherit",
                  }}
                >
                  {playing ? "⏸" : "▶"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
