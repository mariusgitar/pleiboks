export default async function handler(req, res) {
  const { id, type = "podcast" } = req.query;
  if (!id) return res.status(400).json({ error: "Mangler id" });

  const nrkRes = await fetch(
    `https://psapi.nrk.no/playback/manifest/${type}/${id}`,
    { headers: { Accept: "application/json" } }
  );
  if (!nrkRes.ok) return res.status(nrkRes.status).json({ error: "NRK feil" });
  const data = await nrkRes.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}
