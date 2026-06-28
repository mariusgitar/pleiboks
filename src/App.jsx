import { useState, useEffect, useRef } from "react";

const EPISODES = [
  {
    id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9",
    title: "Oversvømmelse",
    emoji: "🌊",
    description: "Tor og Agate jobber hardt for å unngå oversvømmelse.",
  },
  {
    id: "l_e6b980ce-8601-476a-b980-ce8601176a46",
    title: "Lottes banneshow",
    emoji: "🤐",
    description: "Obs! Det bannes ikke i denne episoden.",
  },
  {
    id: "l_fbd86653-d114-44a4-9866-53d11464a4ae",
    title: "Ja-dag",
    emoji: "✅",
    description: "Even hikker så det høres ut som han sier «ja». Ja-dag!",
  },
  {
    id: "l_8172372d-510a-49d6-b237-2d510af9d6ac",
    title: "Superlimet",
    emoji: "🔧",
    description: "Tor har limt seg fast i taket.",
  },
];

async function fetchStreamUrl(episodeId) {
  const res = await fetch(`/api/manifest?id=${episodeId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const assets = data?.playable?.assets;
  if (!assets || assets.length === 0) throw new Error("Ingen assets i respons");

  const mp3 = assets.find((a) => a.format === "MP3") || assets[0];
  if (!mp3?.url) throw new Error("Ingen URL i asset");

  return mp3.url;
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function App() {
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  async function velgEpisode(episode) {
    if (activeEpisode?.id === episode.id) return;
    setLoading(true);
    setError(null);
    setStreamUrl(null);
    setPlaying(false);
    setProgress(0);
    setActiveEpisode(episode);
    try {
      const url = await fetchStreamUrl(episode.id);
      setStreamUrl(url);
    } catch (e) {
      console.error("Feil ved henting av episode:", e);
      setError(`Klarte ikke laste episoden: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    audio.src = streamUrl;
    audio.play()
      .then(() => setPlaying(true))
      .catch((e) => {
        console.error("Autoplay blokkert:", e);
        setPlaying(false);
      });
  }, [streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
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
    const x = (e.clientX - rect.left) / rect.width;
    audio.currentTime = x * duration;
  }

  const progressPct = duration ? (progress / duration) * 100 : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <audio ref={audioRef} />

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>📚</div>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: 0 }}>
          Hallo Bablo
        </h1>
        <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 15 }}>
          Velg en episode å høre på
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
        width: "100%",
        maxWidth: 480,
        marginBottom: 28,
      }}>
        {EPISODES.map((ep) => {
          const isActive = activeEpisode?.id === ep.id;
          return (
            <button
              key={ep.id}
              onClick={() => velgEpisode(ep)}
              style={{
                background: isActive
                  ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                  : "rgba(255,255,255,0.07)",
                border: isActive ? "2px solid #a78bfa" : "2px solid transparent",
                borderRadius: 20,
                padding: "22px 14px",
                cursor: "pointer",
                textAlign: "center",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>{ep.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
                {ep.title}
              </div>
            </button>
          );
        })}
      </div>

      {activeEpisode && (
        <div style={{
          background: "rgba(255,255,255,0.06)",
          borderRadius: 24,
          padding: "24px 20px",
          width: "100%",
          maxWidth: 480,
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{activeEpisode.emoji}</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
              {activeEpisode.title}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
              {activeEpisode.description}
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: "center", color: "#a78bfa", padding: "16px 0" }}>
              Laster episode…
            </div>
          )}

          {error && (
            <div style={{ textAlign: "center", color: "#f87171", padding: "8px 0", fontSize: 13 }}>
              {error}
            </div>
          )}

          {streamUrl && !loading && (
            <>
              <div
                onClick={seek}
                style={{
                  height: 8,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 4,
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                <div style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
                  borderRadius: 4,
                  transition: "width 0.5s linear",
                }} />
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#64748b",
                fontSize: 12,
                marginBottom: 20,
              }}>
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <div style={{ textAlign: "center" }}>
                <button
                  onClick={togglePlayPause}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 30px rgba(124,58,237,0.5)",
                  }}
                >
                  {playing ? "⏸" : "▶️"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
