import { useState, useEffect } from "react";
import { erISkall, kallSkall, lyttPaaBrikker } from "./skall.js";

// ── Foreldre-onboarding ────────────────────────────────────────────
// Vises kun ved første åpning (styrt av pb_onboarded i localStorage,
// se loadOnboarded/saveOnboarded i App.jsx). Barnet ser aldri dette —
// det er en ren oppsett-guide for forelderen: installer som app,
// lås enheten, sett opp foreldretilgang, og velg Spotify av/på.

const ACCENT = "#1B4D5C";
const YELLOW = "#F5C842";

function Step({ number, title, children }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", background: YELLOW,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 14, color: ACCENT, flexShrink: 0,
      }}>{number}</div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 14, color: "#1a1a1a", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#555", lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

function OSToggle({ platform, setPlatform }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      <button onClick={() => setPlatform("ios")} style={{
        flex: 1, padding: "10px", borderRadius: 12,
        background: platform === "ios" ? ACCENT : "#f0f0f0",
        color: platform === "ios" ? "#fff" : "#666",
        border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
      }}>📱 iPhone/iPad</button>
      <button onClick={() => setPlatform("android")} style={{
        flex: 1, padding: "10px", borderRadius: 12,
        background: platform === "android" ? ACCENT : "#f0f0f0",
        color: platform === "android" ? "#fff" : "#666",
        border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
      }}>🤖 Android</button>
    </div>
  );
}

function Screen1Welcome({ onNext }) {
  return (
    <div style={{ padding: "48px 28px", textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎧</div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px" }}>
        Velkommen til Pleiboksen
      </h1>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#666", lineHeight: 1.6, margin: "0 0 8px" }}>
        En enkel lydapp for barn — uten reklame, uten algoritmer, uten overraskelser.
      </p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#999", lineHeight: 1.5, margin: "0 0 32px" }}>
        Denne oppsett-guiden er kun for deg som forelder. Barnet trenger ikke se dette — du gjør alt klart først.
      </p>
      <button onClick={onNext} style={{
        background: ACCENT, color: "#fff", border: "none",
        borderRadius: 16, padding: "15px 36px", fontWeight: 900, fontSize: 15,
        cursor: "pointer", width: "100%", fontFamily: "inherit",
      }}>
        Sett opp Pleiboksen →
      </button>
    </div>
  );
}

function Screen2InstallPWA({ onNext, onBack }) {
  const [platform, setPlatform] = useState("ios");

  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: YELLOW, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
        Steg 1 av 4
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "0 0 6px" }}>
        Legg appen på hjemskjermen
      </h2>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
        Da åpnes Pleiboksen som en egen app — uten adressefelt eller andre nettleser-distraksjoner.
      </p>

      <OSToggle platform={platform} setPlatform={setPlatform} />

      {platform === "ios" ? (
        <div>
          <Step number="1" title="Trykk på Del-knappen">
            Den firkantede ikonet med en pil opp, nederst i Safari.
          </Step>
          <Step number="2" title='Velg "Legg til på Hjemskjerm"'>
            Du må kanskje scrolle litt ned i menyen for å finne den.
          </Step>
          <Step number="3" title='Trykk "Legg til"'>
            Pleiboksen dukker opp som et eget ikon på hjemskjermen.
          </Step>
        </div>
      ) : (
        <div>
          <Step number="1" title="Trykk på menyknappen (⋮)">
            Øverst til høyre i Chrome.
          </Step>
          <Step number="2" title='Velg "Legg til på startskjermen"'>
            Eller "Installer app", avhengig av telefonen din.
          </Step>
          <Step number="3" title="Bekreft">
            Pleiboksen dukker opp som et eget ikon.
          </Step>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onBack} style={{
          flex: 1, background: "#fff", color: ACCENT, border: `2px solid ${ACCENT}`,
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Tilbake</button>
        <button onClick={onNext} style={{
          flex: 2, background: ACCENT, color: "#fff", border: "none",
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Neste →</button>
      </div>
    </div>
  );
}

function Screen3LockedMode({ onNext, onBack }) {
  const [platform, setPlatform] = useState("ios");

  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: YELLOW, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
        Steg 2 av 4
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "0 0 6px" }}>
        Lås enheten til kun Pleiboksen
      </h2>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
        Dette er en innebygd funksjon på telefonen/nettbrettet — ikke noe i selve appen. Den hindrer barnet fra å trykke seg ut til andre apper.
      </p>

      <OSToggle platform={platform} setPlatform={setPlatform} />

      {platform === "ios" ? (
        <div>
          <Step number="1" title="Slå på Guidet tilgang">
            Innstillinger → Tilgjengelighet → Guidet tilgang → skru på, og sett en kode.
          </Step>
          <Step number="2" title="Åpne Pleiboksen">
            Trykk på ikonet du nettopp la til på hjemskjermen.
          </Step>
          <Step number="3" title="Trippel-klikk sideknappen">
            (Eller Hjem-knappen på eldre iPad.) Trykk "Start" øverst til høyre.
          </Step>
          <Step number="4" title="For å avslutte senere">
            Trippel-klikk igjen, skriv inn koden din.
          </Step>
        </div>
      ) : (
        <div>
          <Step number="1" title="Slå på Fest app">
            Innstillinger → Sikkerhet → Fest app (kan hete "App-pinning" på enkelte telefoner) → skru på.
          </Step>
          <Step number="2" title="Åpne Pleiboksen">
            Trykk på ikonet du nettopp la til på hjemskjermen.
          </Step>
          <Step number="3" title="Åpne oversikt-knappen">
            Hold inne firkant/oversikt-knappen, trykk på Pleiboksen-ikonet øverst i kortet, velg "Fest".
          </Step>
          <Step number="4" title="For å avslutte senere">
            Hold inne Tilbake- og Oversikt-knappen samtidig.
          </Step>
        </div>
      )}

      <div style={{
        background: "#FFF8E8", borderRadius: 14, padding: "12px 16px",
        fontSize: 12, fontWeight: 600, color: "#7a6020", marginTop: 4, marginBottom: 4,
        lineHeight: 1.5,
      }}>
        💡 Dette er valgfritt, men anbefales sterkt — uten det kan barnet trykke seg til andre apper eller nettsider.
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onBack} style={{
          flex: 1, background: "#fff", color: ACCENT, border: `2px solid ${ACCENT}`,
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Tilbake</button>
        <button onClick={onNext} style={{
          flex: 2, background: ACCENT, color: "#fff", border: "none",
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Neste →</button>
      </div>
    </div>
  );
}

function Screen4ParentAccess({ onNext, onBack }) {
  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: YELLOW, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
        Steg 3 av 4
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "0 0 6px" }}>
        Velg hva barnet skal se
      </h2>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
        Pleiboksen har et skjult panel der du som forelder velger innhold — barnet ser det aldri.
      </p>

      <div style={{ background: "#FFF8E8", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#8a6d1a", marginBottom: 6 }}>
          ☀️ Slik åpner du panelet
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6020", lineHeight: 1.5 }}>
          Trykk 5 ganger raskt på solen øverst i appen. Du blir bedt om en PIN-kode.
        </div>
      </div>

      <div style={{ background: "#fff", border: "2px solid #eee", borderRadius: 16, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#1a1a1a", marginBottom: 6 }}>
          🔑 PIN-kode
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT, letterSpacing: 4, marginBottom: 6 }}>
          1 2 3 4
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#888" }}>
          Du kan endre denne i kildekoden (PARENT_PIN i App.jsx) når som helst.
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
        Inni panelet kan du:
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#555", lineHeight: 1.7, marginBottom: 22 }}>
        🌱 Velge <b>Mini</b> — et lite, oversiktlig utvalg med store kort<br/>
        🌳 Velge <b>Junior</b> — hele katalogen<br/>
        🎵 Skru Spotify av/på, og krysse av hvilke episoder/sanger som skal vises
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{
          flex: 1, background: "#fff", color: ACCENT, border: `2px solid ${ACCENT}`,
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Tilbake</button>
        <button onClick={onNext} style={{
          flex: 2, background: ACCENT, color: "#fff", border: "none",
          borderRadius: 14, padding: "13px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}>Neste →</button>
      </div>
    </div>
  );
}

function Screen5SpotifyChoice({ onChoice, onBack }) {
  function handleConnect() {
    // Sender til ekte Spotify OAuth. Etter vellykket innlogging
    // redirectes brukeren tilbake til appen med ?spotify=connected,
    // som App.jsx sjekker for å fullføre onboarding med spotifyEnabled=true.
    window.location.href = "/api/login?returnTo=onboarding";
  }

  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: YELLOW, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
        Steg 4 av 4
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "0 0 6px" }}>
        Vil du bruke Spotify?
      </h2>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
        Pleiboksen kan spille musikk fra Spotify i tillegg til NRK. Helt valgfritt.
      </p>

      <div style={{
        background: "#FFF4F0", borderRadius: 14, padding: "14px 16px",
        fontSize: 12, fontWeight: 600, color: "#8a4a2a", marginBottom: 20,
        lineHeight: 1.55,
      }}>
        ⚠️ <b>Verdt å vite:</b> Krever Spotify Premium på kontoen som kobles til.
        Tilkoblingen kan noen ganger bli ustabil — om musikken ikke spiller, hjelper
        det ofte å åpne Spotify-appen et øyeblikk og deretter gå tilbake til Pleiboksen.
      </div>

      <button
        onClick={handleConnect}
        style={{
          width: "100%", background: "#1DB954", color: "#fff", border: "none",
          borderRadius: 14, padding: "15px", fontWeight: 900, fontSize: 14,
          cursor: "pointer", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "inherit",
        }}
      >
        🎵 Koble til Spotify
      </button>

      <button
        onClick={() => onChoice(false)}
        style={{
          width: "100%", background: "#fff", color: "#666", border: "2px solid #eee",
          borderRadius: 14, padding: "13px", fontWeight: 800, fontSize: 13, cursor: "pointer",
          marginBottom: 22, fontFamily: "inherit",
        }}
      >
        Nei takk, bare NRK
      </button>

      <button onClick={onBack} style={{
        width: "100%", background: "none", color: "#999", border: "none",
        fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 8, fontFamily: "inherit",
      }}>← Tilbake</button>
    </div>
  );
}

function Screen6Done({ spotifyEnabled }) {
  return (
    <div style={{ padding: "60px 28px", textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px" }}>
        Klar for barnet ditt!
      </h2>
      <div style={{
        display: "inline-block", background: spotifyEnabled ? "#E8F8EE" : "#F0F0F0",
        borderRadius: 12, padding: "8px 16px", marginBottom: 18,
        fontSize: 12.5, fontWeight: 800, color: spotifyEnabled ? "#1a7a3e" : "#777",
      }}>
        {spotifyEnabled ? "🎵 Spotify er koblet til" : "🔕 Spotify er skrudd av"}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#666", lineHeight: 1.6, margin: "0 0 8px" }}>
        Du kan endre alt dette senere — trykk 5 ganger på solen i appen.
      </p>
    </div>
  );
}

// ── Onboarding inne i Android-skallet (Pleiboks-boksen) ─────────────
// Skallet er installert som app, så «legg på hjemskjermen» og «fest app»
// trengs ikke. I stedet ber knappene skallet om NFC og låsing, og vi
// avslutter med å teste en ekte brikke. Spotify er på vent og hoppes over.
function Knapp({ onClick, disabled, children, sekundaer }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", minHeight: 52, borderRadius: 16, fontWeight: 900, fontSize: 15, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
      background: sekundaer ? "#fff" : disabled ? "#B8C4C9" : ACCENT,
      color: sekundaer ? "#999" : "#fff", border: "none", marginTop: sekundaer ? 4 : 0,
    }}>{children}</button>
  );
}

function SkallOnboarding({ onDone }) {
  const [steg, setSteg] = useState(0);
  const [nfcPaa, setNfcPaa] = useState(() => kallSkall("nfcPaa") === true);
  const [test, setTest] = useState(null); // { emoji, tekst }

  // Når forelderen kommer tilbake fra NFC-innstillingene: sjekk på nytt
  useEffect(() => {
    if (steg !== 1) return;
    const sjekk = () => setNfcPaa(kallSkall("nfcPaa") === true);
    document.addEventListener("visibilitychange", sjekk);
    window.addEventListener("focus", sjekk);
    return () => { document.removeEventListener("visibilitychange", sjekk); window.removeEventListener("focus", sjekk); };
  }, [steg]);

  // Brikketest: lytt på brikker bare på dette steget
  useEffect(() => {
    if (steg !== 4) return;
    return lyttPaaBrikker((uid) => {
      let kjent = null;
      try {
        const alle = JSON.parse(localStorage.getItem("pb_brikker") || "{}");
        kjent = alle[uid];
        if (!kjent) {
          alle[uid] = { navn: "", type: null, id: null, ny: true };
          localStorage.setItem("pb_brikker", JSON.stringify(alle));
        }
      } catch {}
      setTest(kjent
        ? { emoji: "✅", tekst: `NFC virker! Fant «${kjent.navn || "brikken"}».` }
        : { emoji: "✅", tekst: "NFC virker! Brikken er lagret. Du kobler den til en serie eller episode i foreldrepanelet." });
    });
  }, [steg]);

  const neste = () => setSteg(s => s + 1);
  const kicker = (n) => (
    <div style={{ fontSize: 12, fontWeight: 800, color: "#C49A12", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Steg {n} av 4</div>
  );
  const tittel = (t) => <h2 style={{ fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "0 0 6px" }}>{t}</h2>;
  const tekst = (t) => <p style={{ fontSize: 13.5, fontWeight: 600, color: "#666", margin: "0 0 18px", lineHeight: 1.55 }}>{t}</p>;

  let innhold;
  if (steg === 0) {
    innhold = (
      <div style={{ padding: "48px 28px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎧</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px" }}>Velkommen til Pleiboksen</h1>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#666", lineHeight: 1.6, margin: "0 0 32px" }}>
          Denne telefonen blir en lydboks. Barnet legger på en brikke, og lyden starter – uten reklame og uten algoritmer.
        </p>
        <Knapp onClick={neste}>Sett opp Pleiboksen →</Knapp>
      </div>
    );
  } else if (steg === 1) {
    innhold = (
      <div style={{ padding: "28px 28px 32px" }}>
        {kicker(1)}{tittel("📶 Slå på NFC")}
        {tekst("Pleiboksen leser brikkene med NFC. Du sendes til innstillingene og kommer rett tilbake hit.")}
        {nfcPaa
          ? <div style={{ background: "#E8F5EE", borderRadius: 14, padding: "12px 14px", fontWeight: 800, fontSize: 14, color: "#2D6B4A", marginBottom: 14 }}>✅ NFC er på</div>
          : <div style={{ marginBottom: 10 }}><Knapp onClick={() => kallSkall("aapneNfcInnstillinger")}>Åpne NFC-innstillinger</Knapp></div>}
        <Knapp onClick={neste} sekundaer={!nfcPaa}>{nfcPaa ? "Neste →" : "Hopp over"}</Knapp>
      </div>
    );
  } else if (steg === 2) {
    innhold = (
      <div style={{ padding: "28px 28px 32px" }}>
        {kicker(2)}{tittel("🔒 Lås til Pleiboksen")}
        {tekst("Telefonen starter rett i Pleiboksen, og barnet kommer ikke ut. Du låser opp med sola i foreldrepanelet.")}
        <Knapp onClick={() => { kallSkall("laas"); neste(); }}>Lås telefonen</Knapp>
        <Knapp onClick={neste} sekundaer>Ikke nå</Knapp>
      </div>
    );
  } else if (steg === 3) {
    innhold = (
      <div style={{ padding: "28px 28px 32px" }}>
        {kicker(3)}{tittel("☀️ Foreldretilgang")}
        {tekst("Det skjulte panelet er der du velger modus, kobler brikker og avslutter kiosk. Barnet ser det aldri.")}
        <div style={{ background: "#FFF8E8", borderRadius: 16, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13.5, color: "#8a6d1a", marginBottom: 4 }}>Slik åpner du panelet</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#7a6020", lineHeight: 1.5 }}>Trykk 5 ganger raskt på sola øverst. Du blir bedt om PIN-koden.</div>
        </div>
        <div style={{ border: "2px solid #eee", borderRadius: 16, padding: "12px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 900, fontSize: 13.5 }}>🔑 PIN-kode</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: 4 }}>1234</span>
        </div>
        <Knapp onClick={neste}>Neste →</Knapp>
      </div>
    );
  } else if (steg === 4) {
    innhold = (
      <div style={{ padding: "28px 28px 32px" }}>
        {kicker(4)}{tittel("🧩 Test en brikke")}
        {tekst("Legg en brikke på baksiden av telefonen, midt på.")}
        <div style={{ borderRadius: 18, padding: 16, marginBottom: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: test ? "#E8F5EE" : "#F3F7F9" }}>
          <span style={{ fontSize: 40 }}>{test ? test.emoji : "📲"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1B2B33" }}>{test ? test.tekst : "Venter på en brikke …"}</span>
        </div>
        <Knapp onClick={neste} disabled={!test || test.emoji === "⏳"}>Neste →</Knapp>
        {!test && <Knapp onClick={neste} sekundaer>Hopp over</Knapp>}
      </div>
    );
  } else {
    innhold = (
      <div style={{ padding: "60px 28px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px" }}>Klar for barnet ditt!</h2>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#666", lineHeight: 1.6, margin: "0 0 28px" }}>
          Pleiboksen starter i Brikke-modus. Du kan endre alt senere: trykk 5 ganger på sola.
        </p>
        <Knapp onClick={() => onDone(false, { mode: "brikke" })}>Åpne Pleiboksen 🎧</Knapp>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "linear-gradient(180deg,#AEE4FF 0%,#C8F0FF 45%,#DAFFC8 100%)",
      fontFamily: "'Nunito', system-ui, sans-serif", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "20px 16px", overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        {steg >= 1 && steg <= 4 && (
          <div style={{ display: "flex", gap: 6, padding: "20px 28px 0" }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= steg ? ACCENT : "#eee" }} />
            ))}
          </div>
        )}
        {innhold}
      </div>
    </div>
  );
}

// ── Hovedkomponent ──────────────────────────────────────────────────
export default function Onboarding(props) {
  if (erISkall()) return <SkallOnboarding onDone={props.onDone} />;
  return <NettleserOnboarding {...props} />;
}

function NettleserOnboarding({ onDone, initialSpotifyConnected = false }) {
  // Hvis brukeren akkurat kom tilbake fra Spotify OAuth (App.jsx sender
  // initialSpotifyConnected=true når den ser ?spotify=connected i URL),
  // hopp rett til siste skjerm med riktig status.
  const [screen, setScreen] = useState(initialSpotifyConnected ? 5 : 0);
  const [spotifyEnabled, setSpotifyEnabled] = useState(initialSpotifyConnected);

  function handleSpotifyChoice(useSpotify) {
    setSpotifyEnabled(useSpotify);
    setScreen(5);
  }

  // Auto-fullfør et lite øyeblikk etter siste skjerm vises, slik at
  // forelderen rekker å se bekreftelsen før appen åpnes.
  function handleFinish() {
    onDone(spotifyEnabled);
  }

  const screens = [
    <Screen1Welcome key="1" onNext={() => setScreen(1)} />,
    <Screen2InstallPWA key="2" onNext={() => setScreen(2)} onBack={() => setScreen(0)} />,
    <Screen3LockedMode key="3" onNext={() => setScreen(3)} onBack={() => setScreen(1)} />,
    <Screen4ParentAccess key="4" onNext={() => setScreen(4)} onBack={() => setScreen(2)} />,
    <Screen5SpotifyChoice key="5" onChoice={handleSpotifyChoice} onBack={() => setScreen(3)} />,
    <Screen6Done key="6" spotifyEnabled={spotifyEnabled} />,
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "linear-gradient(180deg,#AEE4FF 0%,#C8F0FF 45%,#DAFFC8 100%)",
      fontFamily: "'Nunito', system-ui, sans-serif", display: "flex",
      alignItems: "flex-start", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#fff",
        borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        minHeight: 540, marginTop: "max(20px, env(safe-area-inset-top))",
      }}>
        {screen < 5 && (
          <div style={{ display: "flex", gap: 6, padding: "20px 28px 0" }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= screen ? ACCENT : "#eee",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        )}
        {screens[screen]}

        {screen === 5 && (
          <div style={{ padding: "0 28px 32px" }}>
            <button onClick={handleFinish} style={{
              width: "100%", background: ACCENT, color: "#fff", border: "none",
              borderRadius: 16, padding: "15px", fontWeight: 900, fontSize: 15,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Åpne Pleiboksen 🎧
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
