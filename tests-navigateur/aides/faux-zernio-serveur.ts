/**
 * NAV · FAUX Zernio : petit serveur HTTP local (boucle locale seulement), sans clé réelle, sans réseau.
 * Le Studio croit parler à l'API Zernio : le préchargement (precharge.cjs) redirige l'adresse vers ce serveur.
 * Comptes fictifs (« exemple-… »). Réglage du comportement par les routes de contrôle /__regler, /__appels, /__vider.
 */
import { createServer } from "node:http";

export type ModeFauxZernio = "normal" | "vide" | "erreur" | "cle-refusee" | "lent";

/** Les 6 comptes du Studio : Facebook ×2, Instagram, LinkedIn page et profil, TikTok. Tout est fictif. */
export const COMPTES_FICTIFS = [
  { _id: "exemple-compte-facebook-1", platform: "facebook", displayName: "Exemple Facebook A", isActive: true },
  { _id: "exemple-compte-facebook-2", platform: "facebook", displayName: "Exemple Facebook B", isActive: true },
  { _id: "exemple-compte-instagram", platform: "instagram", displayName: "Exemple Instagram", isActive: true },
  { _id: "exemple-compte-linkedin-page", platform: "linkedin", displayName: "Exemple LinkedIn page", isActive: true },
  { _id: "exemple-compte-linkedin-profil", platform: "linkedin", displayName: "Exemple LinkedIn profil", isActive: true },
  { _id: "exemple-compte-tiktok", platform: "tiktok", displayName: "Exemple TikTok", isActive: true },
];

const port = Number(process.env.NAV_FAUX_ZERNIO_PORT ?? 3921);
let mode: ModeFauxZernio = "normal";
const appels: { methode: string; chemin: string; ecriture: boolean }[] = [];

const serveur = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const json = (statut: number, corps: unknown) => {
    res.writeHead(statut, { "content-type": "application/json" });
    res.end(JSON.stringify(corps));
  };
  if (url.pathname === "/__regler") {
    const m = url.searchParams.get("mode") as ModeFauxZernio | null;
    if (m) mode = m;
    return json(200, { mode });
  }
  if (url.pathname === "/__appels") return json(200, { appels });
  if (url.pathname === "/__vider") {
    appels.length = 0;
    return json(200, { ok: true });
  }
  if (url.pathname === "/__sante") return json(200, { ok: true });

  const ecriture = req.method !== "GET" && req.method !== "HEAD";
  appels.push({ methode: req.method ?? "GET", chemin: url.pathname, ecriture });
  req.resume();
  const repondre = () => {
    if (mode === "erreur") return json(503, { error: "indisponible (essai)" });
    if (mode === "cle-refusee") return json(401, { error: "clé refusée (essai)" });
    if (url.pathname.endsWith("/v1/accounts") && req.method === "GET") return json(200, { accounts: mode === "vide" ? [] : COMPTES_FICTIFS });
    return json(404, { error: "route inconnue du faux Zernio" });
  };
  if (mode === "lent") setTimeout(repondre, 4000);
  else repondre();
});

serveur.listen(port, "127.0.0.1", () => console.log(`[faux-zernio] à l'écoute sur 127.0.0.1:${port}`));
