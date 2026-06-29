import { useState, useEffect, useRef, memo, useCallback } from "react";

// ── Innholdsdata ──────────────────────────────────────────────────
const NRK_SECTIONS = [
  {
    id: "hallo-bablo", label: "Hallo Bablo", icon: "📚",
    accent: "#1B6B8A", color: "#E3F2F9",
    items: [
      { id: "l_b9a1151b-f64b-4658-a115-1bf64ba658f9", title: "Oversvømmelse",    emoji: "🌊" },
      { id: "l_e6b980ce-8601-476a-b980-ce8601176a46", title: "Lottes banneshow", emoji: "🤐" },
      { id: "l_fbd86653-d114-44a4-9866-53d11464a4ae", title: "Ja-dag",           emoji: "✅" },
      { id: "l_8172372d-510a-49d6-b237-2d510af9d6ac", title: "Superlimet",       emoji: "🔧" },
    ],
  },
  {
    id: "kokosbananas", label: "Kokosbananas", icon: "🥥",
    accent: "#B85A00", color: "#FFF0DC",
    items: [
      { id: "l_810de249-e5d3-4a12-8de2-49e5d33a12d2", title: "Sykkelplanen", emoji: "🚲" },
      { id: "l_21414849-4480-4ca2-8148-494480fca285", title: "Kokosbananas", emoji: "🍌" },
    ],
  },
  {
    id: "fantorangen", label: "Fantorangen", icon: "🧡",
    accent: "#D4700A", color: "#FFF3DC",
    items: [
      { id: "l_8e42fb20-bb6f-404c-82fb-20bb6f004c5f", title: "Kjempe-Fantus",          emoji: "🌳" },
      { id: "l_01779e9e-49ad-41ff-b79e-9e49ad11ffc0", title: "Fantus forsvinn",         emoji: "📺" },
      { id: "l_9124669c-0fc4-4660-a466-9c0fc4b6609a", title: "Fantorangen tryllerydder",emoji: "🪄" },
    ],
  },
  {
    id: "karsten-petra", label: "Karsten og Petra", icon: "👫",
    accent: "#2D6B4A", color: "#E8F5EE",
    items: [
      { id: "MKTT05000605", title: "Bestevenner",                 emoji: "🤝", programType: "program" },
      { id: "MKTT05000505", title: "Petra begynner i barnehagen", emoji: "🏫", programType: "program" },
      { id: "MKTT04000104", title: "Karsten kjører brannbil",     emoji: "🚒", programType: "program" },
    ],
  },
  {
    id: "blime", label: "BlimE!", icon: "🌈",
    accent: "#4f46e5", color: "#EDE8FF",
    items: [
      { id: "l_bd313b9d-5f6b-44a1-b13b-9d5f6b84a16b", title: "Kom igjen 'a", emoji: "🎤" },
      { id: "l_2ae9578e-b9ef-4451-a957-8eb9ef0451f2", title: "Halloween",    emoji: "🎃" },
      { id: "l_184d0d69-e4ba-4316-8d0d-69e4bad3165a", title: "Kua mi",       emoji: "🐄" },
    ],
  },
];

const SPOTIFY_SECTION = {
  id: "spotify", label: "Kutoppen", icon: "🎵",
  accent: "#6D28D9", color: "#EDE8FF",
  items: [
    { id: "1SMtaNiuQHnLXDB03mEAY3", uri: "spotify:track:1SMtaNiuQHnLXDB03mEAY3", title: "Milkshake",  artist: "Kutoppen & Lisa Børud",          emoji: "🥤" },
    { id: "2qSh87wxgTnzmm3NvTMmVR", uri: "spotify:track:2qSh87wxgTnzmm3NvTMmVR", title: "Drømmested", artist: "Kutoppen & Klara",                emoji: "🌈" },
    { id: "3MLes59DmfRs7PU5fz29Rn", uri: "spotify:track:3MLes59DmfRs7PU5fz29Rn", title: "Tru",        artist: "Odd Nordstoga & Eva Weel Skram", emoji: "⭐" },
    { id: "01zmwhYAqUx66RcPTgXuLF", uri: "spotify:track:01zmwhYAqUx66RcPTgXuLF", title: "Le Bare",    artist: "Kutoppen & Sol Heilo",            emoji: "😄" },
  ],
};

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
    return arr.filter((i) => i?.url).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;
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
function SkyBg() {
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
      <div style={{ position:"fixed", top:"1rem", right:"1rem", fontSize:"2.6rem", pointerEvents:"none", zIndex:0, animation:"sunSpin 22s linear infinite" }}>☀️</div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:0, fontSize:"1.8rem", letterSpacing:"-0.25rem", textAlign:"center", opacity:0.3, pointerEvents:"none", lineHeight:1 }}>🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿</div>
    </>
  );
}

// ── Spotify voksen-modal ──────────────────────────────────────────
function SpotifyVoksenModal({ onRetry, onDismiss }) {
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", fontFamily:"'Nunito',system-ui,sans-serif" }} onClick={onDismiss}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background:"#fff", width:"100%", borderRadius:"20px 20px 0 0", padding:"24px 24px 40px", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🎵</div>
          <h2 style={{ fontWeight:900, color:"#1B4D5C", fontSize:22, margin:"0 0 8px" }}>Musikken er ikke klar!</h2>
          <p style={{ color:"#555", fontWeight:700, fontSize:15, margin:0 }}>Hent en voksen — de vet hva de skal gjøre 😊</p>
        </div>
        <button onClick={()=>setShowGuide(!showGuide)} style={{ display:"block", width:"100%", background:"none", border:"2px solid #1B4D5C", borderRadius:12, padding:"10px 20px", color:"#1B4D5C", fontWeight:800, fontSize:14, cursor:"pointer", marginBottom:16, fontFamily:"inherit" }}>
          {showGuide ? "Skjul guide" : "👨‍👩‍👧 Voksenguide"}
        </button>
        {showGuide && (
          <div style={{ background:"#f8f8f8", borderRadius:16, padding:"16px 20px", marginBottom:16 }}>
            {["Åpne Spotify-appen på denne iPaden","Spill en hvilken som helst sang i noen sekunder","Gå tilbake til denne appen",'Trykk "Prøv igjen" nedenfor'].map((step,i)=>(
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:"#F5C842", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:12, flexShrink:0, color:"#1B4D5C" }}>{i+1}</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#333", lineHeight:1.4, paddingTop:3 }}>{step}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onDismiss} style={{ flex:1, background:"#fff", color:"#1B4D5C", border:"2px solid #1B4D5C", borderRadius:14, padding:"12px", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Avbryt</button>
          <button onClick={onRetry} style={{ flex:2, background:"#1B4D5C", color:"#fff", border:"none", borderRadius:14, padding:"12px", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Prøv igjen</button>
        </div>
      </div>
    </div>
  );
}

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
function CoverImg({ item, sectionColor, size, radius, playing, onClick, mini = false }) {
  const [err, setErr] = useState(false);
  const t   = mini ? 2.5 : 5;
  const g   = mini ? 4   : 10;
  const pad = playing ? t + g : 0;
  return (
    <div onClick={onClick} style={{ position:"relative", width:size+pad*2, height:size+pad*2, display:"flex", alignItems:"center", justifyContent:"center", cursor:onClick?"pointer":"default", flexShrink:0 }}>
      {playing && onClick && <GlowRing radius={radius} mini={mini} />}
      <div style={{ width:size, height:size, borderRadius:radius, overflow:"hidden", background:sectionColor, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:1, flexShrink:0 }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
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
        <CoverImg item={item} sectionColor={section.color} size={220} radius={24} playing={playing} onClick={onClose} mini={false} />
      </div>
      <div style={{ position:"relative", zIndex:1, width:"100%", textAlign:"left", marginBottom:"auto" }}>
        <div style={{ color:"#fff", fontSize:"1.5rem", fontWeight:900, lineHeight:1.2, marginBottom:4 }}>{item.title}</div>
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
const PbCard = memo(function PbCard({ item, section, isActive, playing, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} style={{
      flexShrink:0, width:110, borderRadius:19, overflow:"hidden",
      background:"#fff", border:`3px solid ${isActive ? section.accent : "transparent"}`,
      boxShadow: isActive ? `0 5px 16px ${section.accent}66` : "0 2px 8px rgba(0,0,0,0.09)",
      cursor:"pointer", padding:0, textAlign:"left",
      transition:"transform 0.14s cubic-bezier(.34,1.56,.64,1), border-color 0.14s",
      transform: isActive ? "scale(1.05)" : "scale(1)",
      scrollSnapAlign:"start",
    }}>
      <div style={{ width:"100%", aspectRatio:"1", background:section.color, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
        {item.cover && !err
          ? <img src={item.cover} alt={item.title} onError={()=>setErr(true)} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
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
            <CoverImg item={activeItem} sectionColor={activeSection.color} size={230} radius={22} playing={playing} onClick={undefined} mini={false} />
          </div>
          <div style={{ width:"100%", textAlign:"center" }}>
            <div style={{ color:"#fff", fontSize:"1.45rem", fontWeight:900, lineHeight:1.2, marginBottom:6 }}>{activeItem.title}</div>
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
  const [nrkCovers, setNrkCovers]             = useState({});
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

  const audioRef       = useRef(null);
  const requestIdRef   = useRef(0);            // FIX 2: race condition guard
  const lastProgressTs = useRef(0);            // FIX 1: throttle ref

  const [nrkUrl, setNrkUrl]     = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { getMe().then((d) => setAuth(d?.loggedIn ? d : false)); }, []);

  useEffect(() => {
    const handler = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const allItems = NRK_SECTIONS.flatMap((s) => s.items);
    Promise.all(allItems.map((item) => fetchNrkCover(item.id, item.programType))).then((results) => {
      const map = {};
      results.forEach((url, i) => { if (url) map[allItems[i].id] = url; });
      setNrkCovers(map);
    });
  }, []);

  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchSpotifyCovers(SPOTIFY_SECTION.items).then(setSpotifyCovers);
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

  function stopAll() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    setNrkUrl(null); setPlaying(false); setProgress(0); setDuration(0);
  }

  // FIX 2: requestIdRef hindrer gammel fetch fra å "vinne"
  async function velgNrk(item, section) {
    if (activeItem?.id === item.id && source === "nrk") return;
    const requestId = ++requestIdRef.current;
    stopAll();
    setSource("nrk");
    setActiveItem({ ...item, cover: nrkCovers[item.id] });
    setActiveSection(section);
    setLoading(true);
    setFullscreen(!isWide);  // FIX 3: ikke åpne fullskjerm på iPad
    try {
      const url = await fetchNrkManifest(item.id, item.programType);
      if (requestId !== requestIdRef.current) return;
      setNrkUrl(url);
    } catch (e) { console.error(e); }
    finally { if (requestId === requestIdRef.current) setLoading(false); }
  }

  async function velgSpotify(track) {
    if (!auth?.accessToken) { setPendingTrack(track); setShowVoksen(true); return; }
    if (activeItem?.id === track.id && source === "spotify") return;
    stopAll();
    setSource("spotify");
    setActiveItem({ ...track, cover: spotifyCovers[track.id] });
    setActiveSection(SPOTIFY_SECTION);
    setLoading(true);
    setFullscreen(!isWide);  // FIX 3: ikke åpne fullskjerm på iPad
    try {
      await spotifyPlay(track.uri, auth.accessToken);
      setPlaying(true);
    } catch (e) {
      if (e.message === "no_device") { setPendingTrack(track); setShowVoksen(true); setFullscreen(false); }
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
    } else if (source === "spotify" && auth?.accessToken) {
      if (playing) { await spotifyPause(auth.accessToken); setPlaying(false); }
      else { await spotifyPlay(activeItem.uri, auth.accessToken); setPlaying(true); }
    }
  }

  function getFlattened() {
    const all = [];
    NRK_SECTIONS.forEach(s => s.items.forEach(item => all.push({ item, section: s, type: "nrk" })));
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

  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Nunito',system-ui,sans-serif", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        @keyframes cloudDrift { from{transform:translateX(0)} to{transform:translateX(110vw)} }
        @keyframes sunSpin    { from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
        @keyframes glowSwell  { 0%,100%{opacity:0.6;transform:scale(0.97)} 50%{opacity:0.95;transform:scale(1.03)} }
        @keyframes eqbar      { from{height:3px} to{height:13px} }
        @keyframes bob        { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        .pb-row::-webkit-scrollbar { display:none }
      `}</style>

      <SkyBg />
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
            {NRK_SECTIONS.map((section) => (
              <PbSection key={section.id} section={section} covers={nrkCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={(item) => velgNrkCb(item, section)} />
            ))}
            <PbSection section={SPOTIFY_SECTION} covers={spotifyCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={velgSpotifyCb} />
            {!auth?.loggedIn && <p style={{ color:"#888", fontSize:"0.75rem", fontWeight:700, textAlign:"center", marginTop:-4, marginBottom:12 }}>🔒 Trykk på en Kutoppen-sang for å koble til Spotify</p>}
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
              {NRK_SECTIONS.map((section) => (
                <PbSection key={section.id} section={section} covers={nrkCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={(item) => velgNrkCb(item, section)} />
              ))}
              <PbSection section={SPOTIFY_SECTION} covers={spotifyCovers} activeId={activeItem?.id} activeSource={source} playing={playing} onSelect={velgSpotifyCb} />
              {!auth?.loggedIn && <p style={{ color:"#888", fontSize:"0.75rem", fontWeight:700, textAlign:"center", marginTop:-4, marginBottom:12 }}>🔒 Trykk på en Kutoppen-sang for å koble til Spotify</p>}
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
