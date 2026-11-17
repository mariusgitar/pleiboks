// ── Bro mellom Pleiboks og Android-skallet (pleiboks-skall) ──────────
//
// Skallet (Kotlin, WebView) legger inn et objekt som heter `PleiboksSkall`
// via addJavascriptInterface. Pleiboks bruker det bare hvis det finnes —
// i vanlig nettleser og på iPhone er det borte, og alt annet virker som før.
//
// Skallet → Pleiboks:
//   window.pleiboksBrikke("04A31F")   når en NFC-brikke legges på
//
// Pleiboks → skallet (alle valgfrie, sjekkes før bruk):
//   PleiboksSkall.versjon()           → "1"
//   PleiboksSkall.nfcPaa()            → true/false
//   PleiboksSkall.aapneNfcInnstillinger()
//   PleiboksSkall.laas()              → sett som startskjerm + skjermfesting
//   PleiboksSkall.avsluttKiosk()

const HENDELSE = "pleiboks-brikke";
let ventende = null; // brikke som kom før noen lyttet (f.eks. under oppstart)
let lyttere = 0;

function skall() {
  return typeof window !== "undefined" ? window.PleiboksSkall : undefined;
}

export function erISkall() {
  return !!skall();
}

export function kallSkall(metode, ...args) {
  const s = skall();
  if (!s || typeof s[metode] !== "function") return undefined;
  try { return s[metode](...args); } catch (e) { console.warn("Skall-feil:", metode, e); return undefined; }
}

export function sendBrikke(uid) {
  if (!uid) return;
  const id = String(uid).trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!id) return;
  if (lyttere === 0) { ventende = id; return; }
  window.dispatchEvent(new CustomEvent(HENDELSE, { detail: id }));
}

// Lytt på brikker. Returnerer en funksjon som slutter å lytte.
export function lyttPaaBrikker(fn) {
  const h = (e) => fn(e.detail);
  window.addEventListener(HENDELSE, h);
  lyttere++;
  if (ventende) { const id = ventende; ventende = null; setTimeout(() => fn(id), 0); }
  return () => { window.removeEventListener(HENDELSE, h); lyttere--; };
}

if (typeof window !== "undefined") {
  window.pleiboksBrikke = sendBrikke;
  // Testing uten NFC: åpne /?kort=04A31F
  try {
    const p = new URLSearchParams(window.location.search);
    const kort = p.get("kort");
    if (kort) {
      p.delete("kort");
      const rest = p.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : ""));
      sendBrikke(kort);
    }
  } catch {}
}
