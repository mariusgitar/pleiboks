export default async function handler(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map((c) => c.split("="))
  );
  const refreshToken = cookies.sp_refresh;
  if (!refreshToken) return res.status(401).json({ error: "Ikke innlogget" });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) return res.status(500).json({ error: "Refresh feilet" });

  res.setHeader("Set-Cookie",
    `sp_access=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${tokens.expires_in}; Path=/`
  );
  res.status(200).json({ ok: true });
}
