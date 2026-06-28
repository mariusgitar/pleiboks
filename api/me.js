// Returnerer access token til klienten så den kan sende play-kommandoer
export default function handler(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").filter(Boolean).map((c) => {
      const [k, ...v] = c.split("=");
      return [k, v.join("=")];
    })
  );
  const token = cookies.sp_access;
  if (!token) return res.status(401).json({ loggedIn: false });
  res.status(200).json({ loggedIn: true, accessToken: token });
}
