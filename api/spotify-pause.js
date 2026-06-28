export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: "Mangler accessToken" });

  const spotifyRes = await fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  res.status(spotifyRes.status === 204 ? 200 : spotifyRes.status).json({ ok: true });
}
