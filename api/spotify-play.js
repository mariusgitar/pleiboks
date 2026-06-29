export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { trackUri, accessToken } = req.body;
  const { device_id } = req.query;

  if (!trackUri || !accessToken) {
    return res.status(400).json({ error: "Mangler trackUri eller accessToken" });
  }

  const url = device_id
    ? `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`
    : `https://api.spotify.com/v1/me/player/play`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [trackUri] }),
  });

  if (response.status === 204 || response.ok) {
    return res.status(200).json({ ok: true });
  }

  const error = await response.json().catch(() => ({}));
  const msg = error?.error?.message || "ukjent feil";

  // Kjente feil med klare årsaker
  if (msg.includes("No active device") || response.status === 404) {
    return res.status(404).json({ error: "no_device" });
  }
  if (response.status === 403) {
    return res.status(403).json({ error: "premium_required" });
  }

  return res.status(response.status).json({ error: msg });
}
