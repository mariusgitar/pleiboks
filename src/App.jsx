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
    // Prøv ulike stier der NRK lagrer bilder
    const images =
      data?.preplay?.poster?.images ||
      data?.preplay?.images ||
      data?.images ||
      data?.image;
    if (!images) return null;
    const arr = Array.isArray(images) ? images : [images];
    // Velg største bilde
    const sorted = arr
      .filter((i) => i?.url)
      .sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || null;
  } catch {
    return null;
  }
}

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function App() {
  const [active, setActive] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  async function velgEpisode(ep) {
    // Stopp og nullstill gammel episode umiddelbart
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setPlaying(false);
    setStreamUrl(null);
    setProgress(0);
    setDuration(0);
    setError(null);
    setCoverUrl(null);
    setActive(ep);
    setLoading(true);

    try {
      // Hent manifest og coverbilde parallelt
      const [url, cover] = await Promise.all([
        fetchManifest(ep.id),
        fetchCoverImage(ep.id),
      ]);
      setStreamUrl(url);
      setCoverUrl(cover);
    } catch (e) {
      setError(`Klarte ikke laste: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Sett src og forsøk autoplay når streamUrl er klar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    audio.src = streamUrl;
    audio.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // Autoplay blokkert → bruker trykker play selv
  }, [streamUrl]);

  // Lydhendelser
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
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true));
    }
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d1117 0%, #1a1f35 60%, #0d2137 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px 48px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <audio ref={audioRef} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h1 style={{
          color: "#fff",
          fontSize: 30,
          fontWeight: 900,
          margin: 0,
          letterSpacing: -0.5,
        }}>Hallo Bablo</h1>
        <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 14 }}>
          Velg en episode
        </p>
      </div>

      {/* Episodegrid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        width: "100%",
        maxWidth: 460,
        marginBottom: 32,
      }}>
        {EPISODES.map((ep) => {
          const isActive = active?.id === ep.id;
          return (
            <button
              key={ep.id}
              onClick={() => velgEpisode(ep)}
              style={{
                background: isActive
                  ? "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)"
                  : "rgba(255,255,255,0.05)",
                border: isActive
                  ? "2px solid #8b5cf6"
                  : "2px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: "20px 12px",
                cursor: "pointer",
                textAlign: "center",
                color: "#fff",
                transition: "all 0.15s ease",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Spilleindikator */}
              {isActive && playing && (
                <div style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 6px #4ade80",
                }} />
              )}
              <div style={{ fontSize: 40, marginBottom: 10 }}>{ep.emoji}</div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.3,
                color: isActive ? "#fff" : "#cbd5e1",
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
          maxWidth: 460,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          {/* Coverbilde eller fargeflate */}
          <div style={{
            width: "100%",
            aspectRatio: "16/9",
            background: coverUrl
              ? `url(${coverUrl}) center/cover no-repeat`
              : "linear-gradient(135deg, #1e1b4b, #312e81)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
            position: "relative",
          }}>
            {!coverUrl && <span>{active.emoji}</span>}

            {/* Mørklegg litt for tekst-lesbarhet */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)",
            }} />

            {/* Tittel over bildet */}
            <div style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              color: "#fff",
              fontWeight: 800,
              fontSize: 20,
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}>
              {active.title}
            </div>
          </div>

          {/* Kontroller */}
          <div style={{ padding: "20px 20px 24px" }}>
            {loading && (
              <div style={{
                textAlign: "center",
                color: "#8b5cf6",
                padding: "12px 0",
                fontSize: 15,
              }}>
                Laster episode…
              </div>
            )}

            {error && (
              <div style={{
                textAlign: "center",
                color: "#f87171",
                fontSize: 13,
                padding: "8px 0",
              }}>
                {error}
              </div>
            )}

            {streamUrl && !loading && (
              <>
                {/* Fremdriftslinje */}
                <div
                  onClick={seek}
                  style={{
                    height: 6,
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: 3,
                    cursor: "pointer",
                    marginBottom: 8,
                    position: "relative",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                    borderRadius: 3,
                    transition: "width 0.4s linear",
                  }} />
                  {/* Dragnål */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: `${pct}%`,
                    transform: "translate(-50%, -50%)",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#a78bfa",
                    boxShadow: "0 0 8px rgba(139,92,246,0.8)",
                  }} />
                </div>

                {/* Tider */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#475569",
                  fontSize: 12,
                  marginBottom: 24,
                }}>
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Play/pause */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={togglePlay}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: playing
                        ? "rgba(139,92,246,0.2)"
                        : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      border: playing
                        ? "2px solid #8b5cf6"
                        : "none",
                      cursor: "pointer",
                      fontSize: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: playing
                        ? "none"
                        : "0 0 28px rgba(124,58,237,0.5)",
                      transition: "all 0.2s ease",
                      color: "#fff",
                    }}
                  >
                    {playing ? "⏸" : "▶"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
