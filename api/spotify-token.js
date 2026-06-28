// Henter og cacher Spotify client credentials token
let cachedToken = null;
let tokenExpiry = 0;

export async function getSpotifyToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("Klarte ikke hente Spotify-token");
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}
