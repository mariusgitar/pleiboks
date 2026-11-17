import { useState, useRef, useEffect } from "react";
import { lyttPaaBrikker } from "./skall.js";

// ── Brikke-modus ──────────────────────────────────────────────────
// Barnet legger en brikke (NFC-kort/kube) på telefonen, og lyden starter.
// Regler (bestemt 17.11.2026, se backlog):
//   • Fjerne brikken styrer ingenting — lyden spiller videre.
//   • Samme brikke igjen = fortsett. Ny brikke = bytt (husker posisjon per episode).
//   • Samme brikke mens den spiller = ignoreres (hindrer doble lesinger).
//   • Start forfra hvis episoden er ferdig, under 10 % igjen, eller pausen er lengre enn grensen.
//   • Stopp: tegn en sirkel. Fra start: hold fingeren i ro i 2 sekunder.

const LS_POS   = "pb_posisjon";        // { [itemId]: { t, d, ts, ferdig } }
const LS_SERIE = "pb_brikke_serie";    // { [sectionId]: itemId } — hvor serie-brikker står
export const LS_GRENSE  = "pb_brikke_grense";  // "6" | "12" | "24" | "aldri"
export const LS_BRIKKER = "pb_brikker";        // { [uid]: { navn, type: "episode"|"serie"|null, id, ny } } — lagres bare på telefonen
export const GRENSER = [["6", "6 t"], ["12", "12 t"], ["24", "24 t"], ["aldri", "Aldri"]];

function les(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function skriv(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export function lagrePosisjon(itemId, t, d, ferdig = false) {
  if (!itemId || isNaN(t)) return;
  const alle = les(LS_POS, {});
  alle[itemId] = { t, d: d || alle[itemId]?.d || 0, ts: Date.now(), ferdig };
  skriv(LS_POS, alle);
}

function erFerdig(p) {
  return !!p && (p.ferdig || (p.d > 0 && p.t >= p.d * 0.9));
}

// Finn hva en brikke skal spille, og hvor i episoden vi starter.
// Returnerer { item, section, startFra, grunn } eller null.
export function tolkBrikke(brikke, sections, grense) {
  if (!brikke?.type || !brikke.id) return null;
  const posisjoner = les(LS_POS, {});
  let item, section;

  if (brikke.type === "episode") {
    for (const s of sections) {
      const i = s.items.find((x) => x.id === brikke.id);
      if (i) { item = i; section = s; break; }
    }
  } else {
    section = sections.find((s) => s.id === brikke.id);
    if (!section?.items.length) return null;
    const peker = les(LS_SERIE, {})[section.id];
    let idx = Math.max(0, section.items.findIndex((x) => x.id === peker));
    if (erFerdig(posisjoner[section.items[idx].id])) idx = (idx + 1) % section.items.length;
    item = section.items[idx];
  }
  if (!item) return null;

  const p = posisjoner[item.id];
  const grenseMs = grense === "aldri" ? Infinity : Number(grense || 12) * 3600e3;
  let startFra = p?.t || 0, grunn = null;
  if (p && erFerdig(p)) { startFra = 0; grunn = "ferdig"; }
  else if (p && Date.now() - p.ts > grenseMs) { startFra = 0; grunn = "lenge-siden"; }
  return { item, section, startFra, grunn };
}

export function huskSerie(section, item) {
  const m = les(LS_SERIE, {});
  m[section.id] = item.id;
  skriv(LS_SERIE, m);
}

// ── Koble brikker (i foreldrepanelet) ────────────────────────────
// Mens panelet er åpent: legg en brikke på telefonen, så dukker den opp her
// (ny eller kjent) og kan kobles til en serie eller episode.
export function BrikkeOppsett({ sections, brikker, setBrikker, onTest }) {
  const [sist, setSist] = useState(null); // uid som nettopp ble lagt på

  useEffect(() => lyttPaaBrikker((uid) => {
    setBrikker((prev) => prev[uid] ? prev : { ...prev, [uid]: { navn: "", type: null, id: null, ny: true } });
    setSist(uid);
  }), []);

  function endre(uid, felt) {
    setBrikker((prev) => ({ ...prev, [uid]: { ...prev[uid], ...felt } }));
  }
  function glem(uid) {
    if (!confirm(`Glemme «${brikker[uid]?.navn || "brikken"}»? Den blir ny igjen hvis den legges på.`)) return;
    setBrikker((prev) => { const n = { ...prev }; delete n[uid]; return n; });
  }

  const uider = Object.keys(brikker).sort((a, b) => (a === sist ? -1 : b === sist ? 1 : (brikker[b].ny ? 1 : 0) - (brikker[a].ny ? 1 : 0)));
  const felt = { width:"100%", padding:"10px 12px", fontSize:15, border:"1.5px solid #d6dde0", borderRadius:10, background:"#fff", fontFamily:"inherit", fontWeight:700, color:"#1a1a1a" };

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"#fff", borderRadius:16, border:"2px solid #eee" }}>
      <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:4 }}>🧩 Brikker</div>
      <div style={{ background:"#E3F2F9", borderRadius:12, padding:"10px 12px", fontSize:13, fontWeight:800, color:"#1B4D5C", marginBottom:10 }}>
        📲 Legg en brikke på telefonen for å koble den.
      </div>
      {uider.length === 0 && <div style={{ fontSize:13, color:"#888", fontWeight:700 }}>Ingen brikker ennå.</div>}
      {uider.map((uid) => {
        const b = brikker[uid];
        const verdi = b.type ? `${b.type}|${b.id}` : "";
        return (
          <div key={uid} style={{ padding:"12px 0", borderTop:"1px solid #f2f2f2", ...(uid === sist ? { background:"#FFF8E8", margin:"0 -16px", padding:"12px 16px" } : {}) }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
              <input value={b.navn || ""} placeholder="Navn, f.eks. Dinokort" onChange={(e) => endre(uid, { navn: e.target.value })} style={{ ...felt, flex:1 }} />
              {b.ny && !b.type && <span style={{ fontSize:11, fontWeight:800, background:"#FFF3DC", color:"#B85A00", borderRadius:6, padding:"2px 7px" }}>Ny</span>}
            </div>
            <select value={verdi} onChange={(e) => {
              const [type, id] = e.target.value ? e.target.value.split("|") : [null, null];
              endre(uid, { type, id, ny: type ? false : b.ny });
            }} style={felt}>
              <option value="">Ikke koblet</option>
              <optgroup label="Hele serien (fortsetter der barnet slapp)">
                {sections.map((s) => <option key={s.id} value={`serie|${s.id}`}>{s.icon} {s.label}</option>)}
              </optgroup>
              {sections.map((s) => (
                <optgroup key={s.id} label={s.label}>
                  {s.items.map((i) => <option key={i.id} value={`episode|${i.id}`}>{i.emoji} {i.title}</option>)}
                </optgroup>
              ))}
            </select>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button disabled={!b.type} onClick={() => onTest(uid)} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background: b.type ? "#E3F2F9" : "#f2f2f2", color: b.type ? "#1B4D5C" : "#aaa", fontWeight:800, fontSize:13, cursor: b.type ? "pointer" : "default", fontFamily:"inherit" }}>▶ Test</button>
              <button onClick={() => glem(uid)} style={{ padding:"9px 14px", borderRadius:10, border:"none", background:"#fdecea", color:"#C0392B", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Glem</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Barneskjermen ────────────────────────────────────────────────
// tilstand: "tom" | "ukjent" | "mangler" | "klar" | "laster" | "spiller" | "pause" | "ferdig"
export function BrikkeSkjerm({ tilstand, item, section, cover, progress, duration, sperret, onPause, onFraStart, onStartSperret }) {
  const [spor, setSpor] = useState([]);
  const [poff, setPoff] = useState(false);
  const [hold, setHold] = useState(0);
  const [snurr, setSnurr] = useState(false);
  const [hoyde, setHoyde] = useState(() => window.innerHeight);
  const g = useRef({ tegner: false, pkt: [], sum: 0, sistA: null, start: null, holdT: null });

  useEffect(() => {
    const f = () => setHoyde(window.innerHeight);
    window.addEventListener("resize", f);
    return () => { window.removeEventListener("resize", f); clearInterval(g.current.holdT); };
  }, []);

  const spiller = tilstand === "spiller";
  const medBilde = ["klar", "laster", "spiller", "pause", "ferdig"].includes(tilstand) && item && section;

  function avbrytHold() {
    clearInterval(g.current.holdT);
    g.current.holdT = null;
    g.current.start = null;
    setHold(0);
  }

  function ned(e) {
    if (!spiller) return;
    const s = g.current;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    s.tegner = true; s.pkt = []; s.sum = 0; s.sistA = null;
    s.start = { x: e.clientX, y: e.clientY };
    clearInterval(s.holdT);
    let h = 0;
    s.holdT = setInterval(() => {
      h += 5;
      if (h >= 100) {
        avbrytHold(); s.tegner = false; setSpor([]);
        setSnurr(true); setTimeout(() => setSnurr(false), 750);
        onFraStart();
        return;
      }
      setHold(h);
    }, 100);
    leggTil(e.clientX, e.clientY);
  }

  function flytt(e) {
    const s = g.current;
    if (!s.tegner) return;
    if (s.start && Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) > 14) avbrytHold();
    leggTil(e.clientX, e.clientY);
  }

  function opp() {
    avbrytHold();
    g.current.tegner = false;
    setSpor([]);
  }

  function leggTil(x, y) {
    const s = g.current, pkt = s.pkt, sist = pkt[pkt.length - 1];
    if (sist && Math.hypot(x - sist.x, y - sist.y) < 4) return;
    pkt.push({ x, y });
    if (pkt.length > 4) {
      let cx = 0, cy = 0;
      pkt.forEach((q) => { cx += q.x; cy += q.y; });
      cx /= pkt.length; cy /= pkt.length;
      const a = Math.atan2(y - cy, x - cx);
      if (s.sistA !== null) {
        let d = a - s.sistA;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        s.sum += d;
      }
      s.sistA = a;
    }
    // Hel sirkel (~310°) → pause
    if (Math.abs(s.sum) > 5.4 && pkt.length >= 14) {
      s.tegner = false; avbrytHold(); setSpor([]);
      setPoff(true); setTimeout(() => setPoff(false), 850);
      onPause();
      return;
    }
    if (pkt.length >= 3) setSpor(pkt.slice(-28));
  }

  const coverH = Math.round(Math.max(130, Math.min(230, hoyde - 360)));
  const coverW = Math.round(coverH * 300 / 236);
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const hint = sperret ? null
    : tilstand === "klar" ? "Klar! Legg brikken på igjen."
    : tilstand === "pause" ? "Legg brikken på for å fortsette."
    : tilstand === "ferdig" ? "Ferdig! Legg på en brikke."
    : null;

  return (
    <div
      onPointerDown={ned} onPointerMove={flytt} onPointerUp={opp} onPointerCancel={opp}
      style={{ position:"fixed", inset:0, zIndex:4, touchAction:"none", userSelect:"none", WebkitUserSelect:"none", fontFamily:"'Nunito',system-ui,sans-serif" }}
    >
      <style>{`
        @keyframes pbPulse { 0%{transform:scale(1);opacity:.6} 70%{transform:scale(1.16);opacity:0} 100%{transform:scale(1.16);opacity:0} }
        @keyframes pbPoff  { 0%{transform:scale(.4);opacity:.95} 100%{transform:scale(1.6);opacity:0} }
        @keyframes pbSnurr { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
      `}</style>

      {medBilde && (
        <div style={{ position:"absolute", inset:0, background:section.accent, display:"flex", flexDirection:"column", alignItems:"center", padding:"72px 28px 36px" }}>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(0,0,0,0.28) 100%)", pointerEvents:"none" }} />
          <div style={{ position:"relative", fontSize:"0.68rem", fontWeight:800, color:"rgba(255,255,255,0.55)", letterSpacing:"0.18em", textTransform:"uppercase", marginTop:"auto", marginBottom:18 }}>NRK Super</div>
          <div style={{ position:"relative", width:coverW, height:coverH, marginBottom:24 }}>
            {spiller && (
              <>
                <div style={{ position:"absolute", inset:-15, borderRadius:43, background:"linear-gradient(135deg,#FF6B6B,#FF9F45,#FFD93D,#6BCB77,#4D96FF,#845EC2,#FF6B6B)", filter:"blur(10px)", animation:"glowSwell 3s ease-in-out infinite" }} />
                <div style={{ position:"absolute", inset:-5, borderRadius:33, background:"linear-gradient(135deg,#FF6B6B,#FF9F45,#FFD93D,#6BCB77,#4D96FF,#845EC2,#FF6B6B)", animation:"glowSwell 3s ease-in-out infinite" }} />
              </>
            )}
            <div style={{
              position:"absolute", inset:0, borderRadius:28, overflow:"hidden", background:section.color,
              display:"flex", alignItems:"center", justifyContent:"center",
              opacity: spiller || tilstand === "klar" || tilstand === "laster" ? 1 : 0.5, transition:"opacity 0.3s",
              animation: snurr ? "pbSnurr 0.7s ease-out" : "none",
            }}>
              {cover
                ? <img src={cover} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
                : <span style={{ fontSize:coverH * 0.46 }}>{item.emoji}</span>}
            </div>
            {tilstand === "pause" && !sperret && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ width:82, height:82, borderRadius:"50%", background:"#fff", boxShadow:"0 6px 22px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", justifyContent:"center", gap:9 }}>
                  <span style={{ width:10, height:30, borderRadius:3, background:section.accent }} />
                  <span style={{ width:10, height:30, borderRadius:3, background:section.accent }} />
                </div>
              </div>
            )}
            {hold > 0 && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ position:"relative", width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.92)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }} aria-hidden="true">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#E6ECEE" strokeWidth="8" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke={section.accent} strokeWidth="8" strokeLinecap="round" strokeDasharray="326.7" strokeDashoffset={326.7 * (1 - hold / 100)} />
                  </svg>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={section.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position:"relative" }} aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
                </div>
              </div>
            )}
          </div>
          <div style={{ position:"relative", width:"100%", marginBottom:"auto" }}>
            <div style={{ color:"#fff", fontSize:"1.45rem", fontWeight:900, lineHeight:1.2, marginBottom:4 }}>{item.emoji && <span style={{ marginRight:8 }}>{item.emoji}</span>}{item.title}</div>
            <div style={{ color:"rgba(255,255,255,0.6)", fontSize:"0.85rem", fontWeight:700 }}>{section.label}</div>
          </div>
          {tilstand !== "klar" && (
            <div style={{ position:"relative", width:"100%", height:5, borderRadius:3, background:"rgba(255,255,255,0.22)", marginTop:18 }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"#fff", borderRadius:3 }} />
            </div>
          )}
          {tilstand === "laster" && <div style={{ position:"relative", marginTop:16, color:"rgba(255,255,255,0.7)", fontWeight:800, fontSize:14 }}>Laster …</div>}
          {hint && <div style={{ position:"relative", marginTop:18, fontSize:17, fontWeight:900, color:"#fff", textAlign:"center", background:"rgba(0,0,0,0.18)", borderRadius:16, padding:"10px 16px" }}>{hint}</div>}
          {sperret && (
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onStartSperret} style={{ position:"relative", marginTop:18, minHeight:56, padding:"0 24px", borderRadius:28, border:"none", background:"#fff", color:section.accent, fontSize:17, fontWeight:900, fontFamily:"inherit", boxShadow:"0 6px 22px rgba(0,0,0,0.25)" }}>
              ▶ Trykk for å starte
            </button>
          )}
        </div>
      )}

      {tilstand === "tom" && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:30, paddingBottom:40 }}>
          <div style={{ position:"relative", width:210, height:210 }}>
            <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"4px solid #fff", animation:"pbPulse 2.6s ease-out infinite" }} />
            <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"rgba(255,255,255,0.75)", border:"4px dashed #1B6B8A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:76 }}>✨</div>
          </div>
          <div style={{ fontSize:27, fontWeight:900, color:"#1B4D5C" }}>Legg brikken her</div>
        </div>
      )}

      {(tilstand === "ukjent" || tilstand === "mangler") && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:28, padding:"30px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center", boxShadow:"0 12px 40px rgba(0,0,0,0.12)", maxWidth:300 }}>
            <span style={{ fontSize:84 }}>{tilstand === "ukjent" ? "❓" : "🔍"}</span>
            <span style={{ fontSize:23, fontWeight:900, color:"#1B4D5C" }}>{tilstand === "ukjent" ? "Ny brikke!" : "Finner ikke innholdet"}</span>
            <span style={{ fontSize:15, fontWeight:700, color:"#666" }}>{tilstand === "ukjent" ? "En voksen må koble den til noe først." : "En voksen kan sjekke brikken i admin."}</span>
          </div>
        </div>
      )}

      {spor.map((p, i) => (
        <span key={i} style={{ position:"absolute", left:p.x - 8, top:p.y - 8, width:16, height:16, borderRadius:"50%", background:"#F5C842", boxShadow:"0 0 10px rgba(245,200,66,0.8)", opacity:(i + 1) / spor.length, pointerEvents:"none" }} />
      ))}
      {poff && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <div style={{ width:250, height:250, borderRadius:"50%", border:"10px solid #F5C842", animation:"pbPoff 0.8s ease-out forwards" }} />
        </div>
      )}
    </div>
  );
}
