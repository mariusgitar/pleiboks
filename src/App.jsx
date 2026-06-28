import { useState, useEffect, useRef } from "react";

const EPISODES = [
  {
    id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9",
    title: "Oversvømmelse",
    emoji: "🌊",
  },
  {
    id: "l_e6b980ce-8601-476a-b980-ce8601176a46",
    title: "Lottes banneshow",
    emoji: "🤐",
  },
  {
    id: "l_fbd86653-d114-44a4-9866-53d11464a4ae",
    title: "Ja-dag",
    emoji: "✅",
  },
  {
    id: "l_8172372d-510a-49d6-b237-2d510af9d6ac",
    title: "Superlimet",
    emoji: "🔧",
  },
];

async function fetchManifest(id) {
  const res = await fetch(`/api/manifest?id=${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const assets = data?.playable?.assets;
  if (!assets?.length) throw new Error("Ingen assets");
  const mp3 = assets.find((a) => a.format === "MP3") || assets[0];
  if (!mp3?.url) throw new Error("Ingen URL");
  return mp3.url;
}

async function fetchCoverImage(id) {
  try {
    const res = await fetch(`/api/metadata?id=${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const images =
      data?.preplay?.poster?.images ||
      data?.preplay?.images ||
      data?.images ||
      data?.image;
    if (!images) return null;
    const arr = Array.isArray(images) ? images : [images];
    const sorted = arr.filter((i) => i?.url).sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || null;
  } catch {
    return null;
  }
}

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Hent coverbilder for alle episoder ved oppstart
async function prefetchCovers(episodes) {
  const results = await Promise.all(episodes.map((ep) => fetchCoverImage(ep.id)));
  return Object.fromEntries(episodes.map((ep, i) => [ep.id, results[i]]));
}

export default function App() {
  const [covers, setCovers] = useState({});
  const [active, setActive] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  // Last coverbilder ved oppstart
  useEffect(() => {
    prefetchCovers(EPISODES).then(setCovers);
  }, []);

  async function velgEpisode(ep) {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setPlaying(false);
    setStreamUrl(null);
    setProgress(0);
    setDuration(0);
    setError(null);
    setActive(ep);
    setLoading(true);
    try {
      const url = await fetchManifest(ep.id);
      setStreamUrl(url);
    } catch (e) {
      setError(`Klarte ikke laste: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    audio.src = streamUrl;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [streamUrl]);

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

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else audio.play().then(() => setPlaying(true));
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const pct = duration ? (progress / duration) * 100 : 0;
  const accent = "#1B4D5C";
  const yellow = "#F5C842";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FDF6EC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif",
      paddingBottom: 48,
    }}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <audio ref={audioRef} />

      {/* Header */}
      <div style={{
        width: "100%",
        background: accent,
        padding: "28px 24px 20px",
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          color: yellow,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 4,
        }}>NRK Super</div>
        <h1 style={{
          color: "#fff",
          fontSize: 32,
          fontWeight: 900,
          margin: 0,
          lineHeight: 1.1,
        }}>Hallo Bablo</h1>
        <p style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 14,
          margin: "6px 0 0",
          fontWeight: 700,
        }}>Velg en episode å høre på</p>
      </div>

      {/* Episodegrid */}
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
        {EPISODES.map((ep) => {
          const isActive = active?.id === ep.id;
          const cover = covers[ep.id];
          return (
            <button
              key={ep.id}
              onClick={() => velgEpisode(ep)}
              style={{
                background: cover
                  ? `url(${cover}) center/cover no-repeat`
                  : "#e8ddd0",
                border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
                borderRadius: 16,
                padding: 0,
                cursor: "pointer",
                aspectRatio: "1 / 1",
                position: "relative",
                overflow: "hidden",
                boxShadow: isActive
                  ? `0 8px 24px rgba(27,77,92,0.35)`
                  : "0 2px 8px rgba(0,0,0,0.10)",
                transform: isActive ? "scale(1.03)" : "scale(1)",
                transition: "all 0.18s ease",
              }}
            >
              {/* Fallback emoji */}
              {!cover && (
                <span style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 48,
                }}>{ep.emoji}</span>
              )}

              {/* Gradient overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.72) 100%)",
              }} />

              {/* Spillindikator */}
              {isActive && playing && (
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  width: 10, height: 10, borderRadius: "50%",
                  background: yellow,
                  boxShadow: `0 0 8px ${yellow}`,
                }} />
              )}

              {/* Tittel */}
              <div style={{
                position: "absolute",
                bottom: 10, left: 10, right: 10,
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                lineHeight: 1.3,
                textAlign: "left",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}>
                {ep.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Spiller */}
      {active && (
        <div style={{
          width: "100%",
          maxWidth: 480,
          padding: "0 16px",
          boxSizing: "border-box",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          }}>
            {/* Episodenavn-stripe */}
            <div style={{
              background: accent,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: covers[active.id]
                  ? `url(${covers[active.id]}) center/cover`
                  : "#2a6070",
                flexShrink: 0,
                fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {!covers[active.id] && active.emoji}
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Spiller nå</div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{active.title}</div>
              </div>
            </div>

            {/* Kontroller */}
            <div style={{ padding: "20px 18px 24px" }}>
              {loading && (
                <div style={{ textAlign: "center", color: accent, padding: "16px 0", fontWeight: 700 }}>
                  Laster episode…
                </div>
              )}
              {error && (
                <div style={{ textAlign: "center", color: "#e53e3e", fontSize: 13, padding: "8px 0" }}>
                  {error}
                </div>
              )}

              {streamUrl && !loading && (
                <>
                  {/* Fremdriftslinje */}
                  <div
                    onClick={seek}
                    style={{
                      height: 8,
                      background: "#EDE8E1",
                      borderRadius: 4,
                      cursor: "pointer",
                      position: "relative",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: accent,
                      borderRadius: 4,
                      transition: "width 0.4s linear",
                    }} />
                    <div style={{
                      position: "absolute",
                      top: "50%", left: `${pct}%`,
                      transform: "translate(-50%, -50%)",
                      width: 16, height: 16, borderRadius: "50%",
                      background: accent,
                      border: "3px solid #fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    }} />
                  </div>

                  {/* Tider */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    color: "#a09888", fontSize: 12, fontWeight: 700,
                    marginBottom: 20,
                  }}>
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {/* Play/pause */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
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
                        fontWeight: 900,
                      }}
                    >
                      {playing ? "⏸" : "▶"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
