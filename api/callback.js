export default async function handler(req, res) {
  const { code, state } = req.query;
  if (!code) return res.status(400).send("Mangler kode");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://pleiboks.vercel.app/api/callback",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) return res.status(500).send("Klarte ikke hente token");

  // Lagre tokens i en cookie (httpOnly, sikker)
  const maxAge = tokens.expires_in;
  res.setHeader("Set-Cookie", [
    `sp_access=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`,
    `sp_refresh=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000; Path=/`,
  ]);

  // Hvis innlogging skjedde fra onboarding-flyten, send tilbake med en
  // markør Onboarding.jsx/App.jsx kan lese for å hoppe til riktig steg.
  const redirectUrl = state === "onboarding" ? "/?spotify=connected" : "/";
  res.redirect(redirectUrl);
}
