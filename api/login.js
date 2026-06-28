export default function handler(req, res) {
  const scopes = "user-read-playback-state user-modify-playback-state";
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: "https://pleiboks.vercel.app/api/callback",
    scope: scopes,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
