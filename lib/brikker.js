// Brikker (NFC-kort/kuber) for Brikke-modus — lagres som én JSON-fil i Vercel Blob.
// Nås via /api/episodes?liste=brikker (Hobby-planen tillater maks 12 serverfunksjoner,
// så dette er en hjelpemodul utenfor api/, ikke en egen funksjon).
//   GET  ?liste=brikker                       → { brikker: { [uid]: Brikke }, oppdatert }
//   POST ?liste=brikker  { registrer: uid }   → legger til ukjent brikke som «ny» (åpen, brukes av boksen)
//   POST ?liste=brikker  { brikker }          → lagrer hele listen (krever header x-admin-passord)
//
// Brikke: { navn, type: "episode" | "serie" | null, id: episode-ID eller seksjons-ID | null, ny, sett }
import { put, get } from "@vercel/blob";

const PATH = "pleiboks/brikker.json";
const ACCESS = process.env.BLOB_ACCESS || "private";
const UID = /^[0-9A-Za-z:_-]{2,64}$/;

async function les() {
  try {
    const r = await get(PATH, { access: ACCESS, useCache: false });
    if (!r || r.statusCode !== 200) return { brikker: {}, oppdatert: null };
    const d = JSON.parse(await new Response(r.stream).text());
    return { brikker: d.brikker || {}, oppdatert: d.oppdatert || null };
  } catch {
    return { brikker: {}, oppdatert: null };
  }
}

async function skriv(brikker) {
  const data = { brikker, oppdatert: new Date().toISOString() };
  await put(PATH, JSON.stringify(data), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return data;
}

function valider(brikker) {
  if (!brikker || typeof brikker !== "object" || Array.isArray(brikker)) return "Mangler brikker";
  for (const [uid, b] of Object.entries(brikker)) {
    if (!UID.test(uid)) return `Ugyldig brikke-ID: ${uid}`;
    if (b.type && !["episode", "serie"].includes(b.type)) return `Ugyldig type på ${uid}`;
    if (b.type && !b.id) return `${uid} mangler innhold`;
  }
  return null;
}

export async function brikkerHandler(req, res) {
  if (req.method === "GET") return res.status(200).json(await les());

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Boksen melder fra om en ukjent brikke. Åpent, men kan bare legge til nye, tomme brikker.
    if (body?.registrer) {
      const uid = String(body.registrer);
      if (!UID.test(uid)) return res.status(400).json({ error: "Ugyldig brikke-ID" });
      const { brikker } = await les();
      if (brikker[uid]) return res.status(200).json({ ok: true, brikke: brikker[uid] });
      if (Object.keys(brikker).length >= 500) return res.status(400).json({ error: "For mange brikker" });
      brikker[uid] = { navn: "Ny brikke", type: null, id: null, ny: true, sett: new Date().toISOString() };
      await skriv(brikker);
      return res.status(200).json({ ok: true, brikke: brikker[uid] });
    }

    const passord = process.env.ADMIN_PASSORD;
    if (!passord) return res.status(500).json({ error: "ADMIN_PASSORD er ikke satt i Vercel" });
    if (req.headers["x-admin-passord"] !== passord) return res.status(401).json({ error: "Feil passord" });

    const feil = valider(body?.brikker);
    if (feil) return res.status(400).json({ error: feil });
    const data = await skriv(body.brikker);
    return res.status(200).json({ ok: true, oppdatert: data.oppdatert });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Metode ikke støttet" });
}
