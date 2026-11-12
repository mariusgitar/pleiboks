// Episodeliste for Pleiboks — lagres som én JSON-fil i Vercel Blob.
//   GET  /api/episodes  → { sections, oppdatert, kilde }   (åpen, appen henter denne)
//   POST /api/episodes  → lagrer ny liste                    (krever header x-admin-passord)
//
// Miljøvariabler i Vercel:
//   BLOB_READ_WRITE_TOKEN  — settes automatisk når Blob-lageret kobles til prosjektet
//   ADMIN_PASSORD          — passordet til /admin.html (velg noe langt, ikke 1234)
import { put, get } from "@vercel/blob";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const standard = require("../src/episoder-standard.json");

const PATH = "pleiboks/episoder.json";
const ACCESS = process.env.BLOB_ACCESS || "private";

async function lesListe() {
  const r = await get(PATH, { access: ACCESS, useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

function valider(data) {
  if (!data || !Array.isArray(data.sections)) return "Mangler sections";
  for (const s of data.sections) {
    if (!s.id || !s.label || !Array.isArray(s.items)) return `Ugyldig seksjon: ${s.id || "?"}`;
    for (const i of s.items) {
      if (!i.id || !i.title) return `Ugyldig episode i ${s.label}`;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const lagret = await lesListe();
      if (lagret) return res.status(200).json({ ...lagret, kilde: "lagret" });
    } catch (e) {
      console.error("episodes GET:", e.message);
    }
    return res.status(200).json({ ...standard, oppdatert: null, kilde: "standard" });
  }

  if (req.method === "POST") {
    const passord = process.env.ADMIN_PASSORD;
    if (!passord) return res.status(500).json({ error: "ADMIN_PASSORD er ikke satt i Vercel" });
    if (req.headers["x-admin-passord"] !== passord) return res.status(401).json({ error: "Feil passord" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body?.bareSjekk) return res.status(200).json({ ok: true });

    const feil = valider(body);
    if (feil) return res.status(400).json({ error: feil });

    const data = { sections: body.sections, oppdatert: new Date().toISOString() };
    await put(PATH, JSON.stringify(data), {
      access: ACCESS,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return res.status(200).json({ ok: true, oppdatert: data.oppdatert });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Metode ikke støttet" });
}
