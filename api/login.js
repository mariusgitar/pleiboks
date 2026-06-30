export default function handler(req, res) {
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  // Bær videre hvor brukeren skal sendes etter OAuth (f.eks. "onboarding").
  // Spotify ekkoer "state" uendret tilbake til callback.js.
  const returnTo = req.query.returnTo || "";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: "https://pleiboks.vercel.app/api/callback",
    state: returnTo,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
