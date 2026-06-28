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

const accent = "#1B4D5C";
const yellow = "#F5C842";

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
  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px", fontFamily: "'Nunito', system-ui, sans-serif", textAlign: "center",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
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
  return (
    <div style={{
      minHeight: "100vh", background: "#FDF6EC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, fontFamily: "'Nunito', system-ui, sans-serif", textAlign: "center",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');`}</style>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🔐</div>
      <h2 style={{ fontWeight: 900, color: accent, fontSize: 24, margin: "0 0 10px" }}>Koble til Spotify</h2>
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

// ── Episodekort: 2x2, kvadratisk, cover fyller flaten ────────────
function MediaCard({ title, emoji, cover, isActive, playing, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", padding: 0,
      cursor: "pointer", textAlign: "left",
      transform: isActive ? "scale(1.04)" : "scale(1)",
      transition: "all 0.18s ease",
    }}>
      {/* Kvadratisk kortflate */}
      <div style={{
        width: "100%", aspectRatio: "1 / 1",
        background: cover ? `url(${cover}) center/cover no-repeat` : "#e8ddd0",
        borderRadius: 16,
        border: isActive ? `3px solid ${yellow}` : "3px solid transparent",
        boxShadow: isActive ? "0 6px 20px rgba(27,77,92,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!cover && <span style={{ fontSize: 44 }}>{emoji}</span>}
        {/* Gradient for tittellesbarhet */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.65) 100%)",
        }} />
        {/* Spilleindikator */}
        {isActive && playing && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 10, height: 10, borderRadius: "50%",
            background: yellow, boxShadow: `0 0 8px ${yellow}`,
          }} />
        )}
        {/* Emoji + tittel inne i kortet */}
        <div style={{
          position: "absolute", bottom: 8, left: 8, right: 8,
          color: "#fff", fontWeight: 800, fontSize: 12, lineHeight: 1.3,
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        }}>
          {emoji} {title}
        </div>
      </div>
    </button>
  );
}

// ── Innebygd spiller (ekspanderer under galleriet) ────────────────
function InlinePlayer({ item, source, cover, playing, loading, progress, duration, onToggle, onSeek }) {
  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      width: "100%",
    }}>
      {/* Stort coverbilde */}
      <div style={{
        width: "100%", aspectRatio: "16 / 9",
        background: cover
          ? `url(${cover}) center/cover no-repeat`
          : `linear-gradient(135deg, ${accent}, #2a6070)`,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!cover && <span style={{ fontSize: 80 }}>{item.emoji}</span>}
        {/* Gradient for tittellesbarhet */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }} />
        <div style={{
          position: "absolute", bottom: 14, left: 16, right: 16,
        }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
            {source === "nrk" ? "Hallo Bablo · NRK" : "Kutoppen · Spotify"}
          </div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 2 }}>
            {item.emoji} {item.title}
          </div>
          {item.artist && (
            <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 13 }}>{item.artist}</div>
          )}
        </div>
      </div>

      {/* Kontroller */}
      <div style={{ padding: "16px 18px 22px" }}>
        {loading && (
          <div style={{ textAlign: "center", color: accent, fontWeight: 800, fontSize: 15, padding: "8px 0" }}>
            Laster…
          </div>
        )}

        {!loading && source === "nrk" && duration > 0 && (
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

function SectionHeader({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 12 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontWeight: 900, fontSize: 17, color: accent }}>{label}</span>
    </div>
  );
}

// ── Hovedapp ──────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null);
  const [nrkCovers, setNrkCovers] = useState({});
  const [spotifyCovers, setSpotifyCovers] = useState({});
  const [source, setSource] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noDevice, setNoDevice] = useState(false);

  const audioRef = useRef(null);
  const playerRef = useRef(null);
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

  // Scroll spilleren inn i view når den dukker opp
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

  async function velgNrk(ep) {
    if (activeItem?.id === ep.id && source === "nrk") return; // allerede valgt
    stopAll(); setNoDevice(false); setSource("nrk"); setActiveItem(ep); setLoading(true);
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
    if (activeItem?.id === track.id && source === "spotify") return;
    stopAll(); setNoDevice(false); setSource("spotify"); setActiveItem(track); setLoading(true);
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") setNoDevice(true);
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

  const activeCover = activeItem ? (source === "nrk" ? nrkCovers : spotifyCovers)[activeItem.id] : null;

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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ width: "100%", background: accent, padding: "28px 24px 20px", marginBottom: 28, boxSizing: "border-box" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: yellow, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Pleiboks</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>Hva vil du høre?</h1>
        </div>

        <div style={{ width: "100%", maxWidth: 480, boxSizing: "border-box" }}>

          {/* Hallo Bablo */}
          <SectionHeader icon="📻" label="Hallo Bablo" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 16px", marginBottom: 32 }}>
            {EPISODES.map((ep) => (
              <MediaCard
                key={ep.id} title={ep.title} emoji={ep.emoji}
                cover={nrkCovers[ep.id]}
                isActive={source === "nrk" && activeItem?.id === ep.id}
                playing={playing}
                onClick={() => velgNrk(ep)}
              />
            ))}
          </div>

          {/* Kutoppen */}
          <SectionHeader icon="🎵" label="Kutoppen" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 16px", marginBottom: 28 }}>
            {TRACKS.map((track) => (
              <MediaCard
                key={track.id} title={track.title} emoji={track.emoji}
                cover={spotifyCovers[track.id]}
                isActive={source === "spotify" && activeItem?.id === track.id}
                playing={playing}
                onClick={() => velgSpotify(track)}
              />
            ))}
          </div>

          {/* Innebygd spiller */}
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
