// api/rss.js — Vercel serverless proxy for RSS-feeds
// Bruk: /api/rss?url=https://podkast.nrk.no/program/hallo_bablo.rss

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Mangler url-parameter" });
  }

  // Tillat bare NRK og andre godkjente podcast-domener
  const allowed = [
    "podkast.nrk.no",
    "feeds.acast.com",
    "anchor.fm",
    "feeds.buzzsprout.com",
    "feed.podbean.com",
  ];

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Ugyldig URL" });
  }

  if (!allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith("." + d))) {
    return res.status(403).json({ error: "Domene ikke tillatt: " + parsed.hostname });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Pleiboks/1.0 (podcast player)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream feil: ${upstream.status}` });
    }

    const text = await upstream.text();

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=1800"); // 30 min cache på Vercel
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
