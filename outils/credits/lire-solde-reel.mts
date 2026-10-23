/**
 * PREUVE D2 (crédits) — lecture RÉELLE et GRATUITE du solde HeyGen par le lecteur du studio
 * (`src/fournisseurs/credits/heygen.ts`, `GET /v3/users/me`), puis « Tester la connexion » et, s'il y a une clé,
 * la liste des voix (`GET /v3/voices`, gratuite). Aucun appel payant.
 *
 * La clé se lit dans un fichier hors du dépôt (`STUDIO_ENV`, par défaut `~/.claude/secrets/studio.env`), seulement
 * dans CE processus. Elle n'est jamais affichée ni écrite : la sortie ne garde que ses 4 derniers caractères.
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/credits/lire-solde-reel.mts`
 * Sortie : docs/captures/d2-credits/lecture-heygen-reelle.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { creerLecteurHeygen } from "../../src/fournisseurs/credits/heygen";
import { creerClientHeygen } from "../../src/fournisseurs/heygen/client";
import { formaterDollars, masquerCles } from "../../src/domaine/credits";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "../..");
const FICHIER = process.env.STUDIO_ENV ?? join(homedir(), ".claude", "secrets", "studio.env");

function lireEnv(chemin: string): Record<string, string> {
  if (!existsSync(chemin)) throw new Error("Fichier des clés introuvable.");
  const sortie: Record<string, string> = {};
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
    if (m && m[2]) sortie[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return sortie;
}

const env = { HEYGEN_API_KEY: lireEnv(FICHIER).HEYGEN_API_KEY };
const cle = env.HEYGEN_API_KEY;
const lecteur = creerLecteurHeygen(env);
const debut = Date.now();
const lu = await lecteur.lireSolde!();
const dureeMs = Date.now() - debut;
const test = await lecteur.testerConnexion();
let voix: number | null = null;
if (cle) {
  const r = await creerClientHeygen({ cle }).requeteEntiere<{ data?: unknown[] }>("GET", "/v3/voices?type=private&limit=100");
  voix = r.data?.length ?? 0;
}
const resultat = {
  _source: "Lecture réelle par le lecteur du studio (src/fournisseurs/credits/heygen.ts). Gratuit, aucun appel payant.",
  point: "GET https://api.heygen.com/v3/users/me",
  luLe: lu.luLe,
  dureeMs,
  soldeCentimesUsd: lu.centimes,
  soldeAffiche: formaterDollars(lu.centimes),
  testerConnexion: test,
  voixPriveesListees: voix,
  coutDesAppels: "0 $ (lectures gratuites)",
};
const texte = masquerCles(JSON.stringify(resultat, null, 2), [cle]);
if (cle && texte.includes(cle)) throw new Error("garde-fou : la clé apparaîtrait dans la sortie");
mkdirSync(join(RACINE, "docs/captures/d2-credits"), { recursive: true });
writeFileSync(join(RACINE, "docs/captures/d2-credits/lecture-heygen-reelle.json"), texte + "\n");
console.log(texte);
