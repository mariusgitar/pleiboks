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
// Liste over brikkene + en veiviser: legg på brikken → velg innhold → velg merke → prøv den.
// Mens panelet er åpent kan man også bare legge en brikke på telefonen for å endre den.
const MERKER = ["🦖","🦕","🐯","🐨","🦁","🦒","🐶","🐱","🐘","🐻","🐸","🐰","🦊","🐼","🐧","🐙","🦋","🐞","🐳","🦄","🌙","⭐","☀️","🌈","🚒","🚗","🚂","🚀","⚽","🎵","🎤","🧸"];

function innholdFor(b, sections) {
  if (!b?.type) return null;
  if (b.type === "serie") {
    const s = sections.find((x) => x.id === b.id);
    return s ? { tittel: s.label, under: "Hele serien", ikon: s.icon, farge: s.color } : null;
  }
  for (const s of sections) {
    const i = s.items.find((x) => x.id === b.id);
    if (i) return { tittel: i.title, under: s.label, ikon: i.emoji, farge: s.color };
  }
  return null;
}

const KNAPP = { minHeight:48, borderRadius:14, border:"none", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit", padding:"0 18px" };
const PRIMAER = { ...KNAPP, background:"#1B4D5C", color:"#fff" };
const SEKUNDAER = { ...KNAPP, background:"#EEF2F3", color:"#1B4D5C" };

export function BrikkeOppsett({ sections, brikker, setBrikker, onTest }) {
  // veiviser: null (liste) eller { steg: "legg"|"innhold"|"merke"|"prov"|"ferdig", uid, ny, utkast, aapen }
  const [v, setV] = useState(null);
  const vRef = useRef(v); vRef.current = v;
  const bRef = useRef(brikker); bRef.current = brikker;

  function aapne(uid) {
    const b = bRef.current[uid];
    if (!b) setBrikker((prev) => ({ ...prev, [uid]: { navn: "", type: null, id: null, emoji: "", ny: true } }));
    setV({ steg: "innhold", uid, ny: !b?.type, utkast: { type: b?.type || null, id: b?.id || null, emoji: b?.emoji || "", navn: b?.navn || "" }, aapen: null });
  }

  useEffect(() => lyttPaaBrikker((uid) => {
    const cur = vRef.current;
    if (!cur || cur.steg === "legg") aapne(uid);
    else if (cur.steg === "prov" && uid === cur.uid) setV({ ...cur, steg: "ferdig" });
  }), []);

  function lagre() {
    const u = v.utkast;
    const navn = u.navn.trim() || innholdFor(u, sections)?.tittel || "";
    setBrikker((prev) => ({ ...prev, [v.uid]: { ...prev[v.uid], type: u.type, id: u.id, emoji: u.emoji, navn, ny: false } }));
    setV({ ...v, steg: "prov", utkast: { ...u, navn } });
  }
  function glem() {
    if (!confirm("Glemme brikken? Den blir ny igjen hvis den legges på.")) return;
    setBrikker((prev) => { const n = { ...prev }; delete n[v.uid]; return n; });
    setV(null);
  }
  const utkast = (felt) => setV((cur) => ({ ...cur, utkast: { ...cur.utkast, ...felt } }));

  const uider = Object.keys(brikker).sort((a, b) => (brikker[a].type ? 1 : 0) - (brikker[b].type ? 1 : 0));

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", background:"#fff", borderRadius:16, border:"2px solid #eee" }}>
      <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a", marginBottom:10 }}>🧩 Brikker</div>
      <button onClick={() => setV({ steg: "legg" })} style={{ ...PRIMAER, width:"100%", marginBottom:8 }}>➕ Legg til ny brikke</button>
      <div style={{ fontSize:11.5, color:"#888", fontWeight:700, marginBottom:10 }}>Du kan også legge en brikke på telefonen for å endre den.</div>

      {uider.length === 0 && <div style={{ fontSize:13, color:"#888", fontWeight:700 }}>Ingen brikker ennå.</div>}
      {uider.map((uid) => {
        const b = brikker[uid], inn = innholdFor(b, sections);
        return (
          <div key={uid} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderTop:"1px solid #f2f2f2" }}>
            <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, background: inn?.farge || "#F3F5F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>{b.emoji || inn?.ikon || "🧩"}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:14, color:"#1a1a1a" }}>{b.navn || (b.type ? inn?.tittel : "Ny brikke")}</div>
              <div style={{ fontSize:12, fontWeight:700, color: b.type ? "#888" : "#B85A00", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {b.type ? `${inn?.tittel || "?"} · ${inn?.under || ""}` : "Ikke satt opp – barnet har prøvd den"}
              </div>
            </div>
            {b.type && <button onClick={() => onTest(uid)} aria-label="Spill av" style={{ ...SEKUNDAER, minHeight:40, padding:"0 12px" }}>▶</button>}
            <button onClick={() => aapne(uid)} style={{ ...(b.type ? SEKUNDAER : PRIMAER), minHeight:40, padding:"0 12px", fontSize:13 }}>{b.type ? "Endre" : "Sett opp"}</button>
          </div>
        );
      })}

      {v && (
        <div style={{ position:"fixed", inset:0, zIndex:260, background:"#FAF7F4", overflowY:"auto", fontFamily:"'Nunito',system-ui,sans-serif" }}>
          <div style={{ position:"sticky", top:0, background:"#1B4D5C", padding:"18px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:1 }}>
            <div>
              <div style={{ color:"#F5C842", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }}>{v.ny === false ? "Endre brikke" : "Ny brikke"}</div>
              <div style={{ color:"#fff", fontSize:19, fontWeight:900 }}>
                {{ legg:"Legg på brikken", innhold:"Hva skal den spille?", merke:"Velg et merke", prov:"Prøv den", ferdig:"Ferdig!" }[v.steg]}
              </div>
            </div>
            <button onClick={() => setV(null)} aria-label="Lukk" style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", fontSize:18, cursor:"pointer" }}>✕</button>
          </div>

          <div style={{ padding:"20px 20px 40px", maxWidth:560, margin:"0 auto" }}>
            {v.steg === "legg" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, paddingTop:30, textAlign:"center" }}>
                <div style={{ position:"relative", width:170, height:170 }}>
                  <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"4px solid #AEE4FF", animation:"pbPulse 2.6s ease-out infinite" }} />
                  <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#E3F2F9", border:"4px dashed #1B6B8A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:64 }}>📲</div>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:"#1B4D5C", maxWidth:280 }}>Legg brikken på baksiden av telefonen, midt på.</div>
                <style>{`@keyframes pbPulse { 0%{transform:scale(1);opacity:.6} 70%{transform:scale(1.16);opacity:0} 100%{transform:scale(1.16);opacity:0} }`}</style>
              </div>
            )}

            {v.steg === "innhold" && (
              <>
                {sections.map((s) => {
                  const serieValgt = v.utkast.type === "serie" && v.utkast.id === s.id;
                  const epValgt = v.utkast.type === "episode" && s.items.some((i) => i.id === v.utkast.id);
                  const aapen = v.aapen === s.id || epValgt;
                  return (
                    <div key={s.id} style={{ background:"#fff", borderRadius:16, marginBottom:10, overflow:"hidden", border: serieValgt || epValgt ? `2.5px solid ${s.accent}` : "2px solid #eee" }}>
                      <button onClick={() => utkast({ type: "serie", id: s.id })} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 14px", background: serieValgt ? s.color : "#fff", border:"none", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                        <div style={{ width:38, height:38, borderRadius:11, background:s.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{s.icon}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:900, fontSize:15, color:"#1a1a1a" }}>{s.label}</div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#888" }}>Hele serien · fortsetter der barnet slapp</div>
                        </div>
                        {serieValgt && <span style={{ fontSize:20, color:s.accent, fontWeight:900 }}>✓</span>}
                      </button>
                      <button onClick={() => setV((cur) => ({ ...cur, aapen: aapen ? null : s.id }))} style={{ width:"100%", padding:"8px 14px", border:"none", borderTop:"1px solid #f2f2f2", background:"#fff", textAlign:"left", fontSize:13, fontWeight:800, color:s.accent, cursor:"pointer", fontFamily:"inherit" }}>
                        {aapen ? "Skjul episoder ▴" : `Velg én episode (${s.items.length}) ▾`}
                      </button>
                      {aapen && s.items.map((i) => {
                        const valgt = v.utkast.type === "episode" && v.utkast.id === i.id;
                        return (
                          <button key={i.id} onClick={() => utkast({ type: "episode", id: i.id })} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 14px", border:"none", borderTop:"1px solid #f6f6f6", background: valgt ? s.color : "#fff", textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}>
                            <span style={{ fontSize:20, width:28, textAlign:"center" }}>{i.emoji}</span>
                            <span style={{ flex:1, fontSize:14, fontWeight:800, color:"#1a1a1a" }}>{i.title}</span>
                            {valgt && <span style={{ color:s.accent, fontWeight:900 }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <div style={{ position:"sticky", bottom:0, paddingTop:10, background:"linear-gradient(180deg, rgba(250,247,244,0), #FAF7F4 30%)", display:"flex", gap:8 }}>
                  {v.ny === false && <button onClick={glem} style={{ ...KNAPP, background:"#fdecea", color:"#C0392B" }}>Glem</button>}
                  <button disabled={!v.utkast.type} onClick={() => setV({ ...v, steg: "merke" })} style={{ ...PRIMAER, flex:1, opacity: v.utkast.type ? 1 : 0.4 }}>Neste →</button>
                </div>
              </>
            )}

            {v.steg === "merke" && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:"#666", marginBottom:12, lineHeight:1.5 }}>
                  Velg samme figur som klistremerket på brikken. Den spretter frem på skjermen når barnet legger brikken på. Har brikken et bilde av innholdet, kan du velge «Ingen».
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6, minmax(0, 1fr))", gap:8, marginBottom:12 }}>
                  {MERKER.map((m) => (
                    <button key={m} onClick={() => utkast({ emoji: m })} aria-label={m} style={{ aspectRatio:"1", borderRadius:12, fontSize:26, cursor:"pointer", background: v.utkast.emoji === m ? "#FFF3DC" : "#fff", border: v.utkast.emoji === m ? "2.5px solid #D4700A" : "2px solid #eee" }}>{m}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:18 }}>
                  <button onClick={() => utkast({ emoji: "" })} style={{ ...SEKUNDAER, flex:1, minHeight:44, fontSize:14, border: !v.utkast.emoji ? "2.5px solid #1B4D5C" : "2px solid transparent" }}>Ingen</button>
                  <input value={MERKER.includes(v.utkast.emoji) ? "" : v.utkast.emoji} onChange={(e) => utkast({ emoji: e.target.value.trim().slice(0, 8) })} placeholder="Annen emoji" style={{ flex:1, minHeight:44, borderRadius:14, border:"2px solid #eee", padding:"0 12px", fontSize:18, fontFamily:"inherit", textAlign:"center" }} />
                </div>
                <label style={{ display:"block", fontSize:13, fontWeight:800, color:"#1a1a1a", marginBottom:6 }}>Navn (for deg)</label>
                <input value={v.utkast.navn} onChange={(e) => utkast({ navn: e.target.value })} placeholder={innholdFor(v.utkast, sections)?.tittel || "f.eks. Dinokuben"} style={{ width:"100%", boxSizing:"border-box", minHeight:46, borderRadius:12, border:"1.5px solid #d6dde0", padding:"0 12px", fontSize:15, fontFamily:"inherit", fontWeight:700, marginBottom:20 }} />
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setV({ ...v, steg: "innhold" })} style={SEKUNDAER}>← Tilbake</button>
                  <button onClick={lagre} style={{ ...PRIMAER, flex:1 }}>Lagre</button>
                </div>
              </>
            )}

            {(v.steg === "prov" || v.steg === "ferdig") && (() => {
              const inn = innholdFor(v.utkast, sections);
              return (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, paddingTop:20, textAlign:"center" }}>
                  <div style={{ width:150, height:150, borderRadius:36, background: inn?.farge || "#F3F5F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:84 }}>{v.utkast.emoji || inn?.ikon || "🧩"}</div>
                  <div>
                    <div style={{ fontSize:20, fontWeight:900, color:"#1a1a1a" }}>{v.utkast.navn}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#888" }}>{inn?.tittel} · {inn?.under}</div>
                  </div>
                  {v.steg === "prov" ? (
                    <>
                      <div style={{ background:"#E3F2F9", borderRadius:14, padding:"12px 16px", fontWeight:800, fontSize:14, color:"#1B4D5C" }}>📲 Legg brikken på igjen for å sjekke at den leses.</div>
                      <button onClick={() => setV({ ...v, steg: "ferdig" })} style={{ ...SEKUNDAER, width:"100%" }}>Hopp over</button>
                    </>
                  ) : (
                    <>
                      <div style={{ background:"#E8F5EE", borderRadius:14, padding:"12px 16px", fontWeight:800, fontSize:14, color:"#2D6B4A" }}>✅ Brikken virker.</div>
                      <div style={{ display:"flex", gap:8, width:"100%" }}>
                        <button onClick={() => setV({ steg: "legg" })} style={{ ...SEKUNDAER, flex:1 }}>➕ En til</button>
                        <button onClick={() => setV(null)} style={{ ...PRIMAER, flex:1 }}>Ferdig</button>
                      </div>
                      <button onClick={() => { setV(null); onTest(v.uid); }} style={{ ...SEKUNDAER, width:"100%", background:"none" }}>▶ Spill den nå</button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Barneskjermen ────────────────────────────────────────────────
// tilstand: "tom" | "ukjent" | "mangler" | "klar" | "laster" | "spiller" | "pause" | "ferdig"
export function BrikkeSkjerm({ tilstand, item, section, cover, merke, pop, progress, duration, sperret, onPause, onFraStart, onStartSperret }) {
  const [spor, setSpor] = useState([]);
  const [visPop, setVisPop] = useState(null);
  // Brikkens merke spretter frem når brikken legges på (pop = { emoji, n }, n endres hver gang)
  useEffect(() => {
    if (!pop?.emoji) return;
    setVisPop(pop);
    const t = setTimeout(() => setVisPop(null), 1400);
    return () => clearTimeout(t);
  }, [pop?.n]);
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
        @keyframes pbMerke { 0%{transform:scale(.2);opacity:0} 25%{transform:scale(1.15);opacity:1} 40%{transform:scale(.95)} 55%{transform:scale(1)} 80%{transform:scale(1);opacity:1} 100%{transform:scale(.6) translateY(-40px);opacity:0} }
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
            {merke && (
              <div style={{ position:"absolute", top:-16, left:-16, width:60, height:60, borderRadius:"50%", background:"#fff", boxShadow:"0 4px 14px rgba(0,0,0,0.22)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34 }}>{merke}</div>
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
      {visPop && (
        <div key={visPop.n} style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:2 }}>
          <div style={{ width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,0.95)", boxShadow:"0 16px 50px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:140, animation:"pbMerke 1.4s ease-out forwards" }}>{visPop.emoji}</div>
        </div>
      )}
      {poff && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <div style={{ width:250, height:250, borderRadius:"50%", border:"10px solid #F5C842", animation:"pbPoff 0.8s ease-out forwards" }} />
        </div>
      )}
    </div>
  );
}
