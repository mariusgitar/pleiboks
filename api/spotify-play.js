// Sender play-kommando til brukerens aktive Spotify-enhet
// Krever brukerens access token (ikke client credentials)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { trackUri, accessToken } = req.body;
  if (!trackUri || !accessToken) {
    return res.status(400).json({ error: "Mangler trackUri eller accessToken" });
  }

  const spotifyRes = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [trackUri] }),
  });

  if (spotifyRes.status === 204) {
    return res.status(200).json({ ok: true });
  }
  if (spotifyRes.status === 404) {
    return res.status(404).json({ error: "no_device" });
  }
  const err = await spotifyRes.json().catch(() => ({}));
  res.status(spotifyRes.status).json({ error: err?.error?.message || "Ukjent feil" });
}
