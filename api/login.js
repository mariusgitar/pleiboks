export default function handler(req, res) {
  const scopes = [
    "streaming",                    // <-- NY: Web Playback SDK
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: "https://pleiboks.vercel.app/api/callback",
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
