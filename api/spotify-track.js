import { getSpotifyToken } from "./spotify-token.js";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Mangler track-id" });

  try {
    const token = await getSpotifyToken();
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!trackRes.ok) return res.status(trackRes.status).json({ error: "Spotify feil" });
    const data = await trackRes.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
