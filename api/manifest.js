export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Mangler episode-id" });
  }

  const nrkRes = await fetch(
    `https://psapi.nrk.no/playback/manifest/podcast/${id}`,
    { headers: { Accept: "application/json" } }
  );

  if (!nrkRes.ok) {
    return res.status(nrkRes.status).json({ error: "NRK svarte med feil" });
  }

  const data = await nrkRes.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}
