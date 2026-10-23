/**
 * Source « GitHub » : dernière version publiée (`releases/latest`), à défaut la plus grande étiquette stable
 * (FFmpeg ne publie pas de « release »). Fichiers surveillés (ex. `LICENSE.md` de Remotion) : leur empreinte
 * est relevée chaque jour ; un changement = alerte rouge (décidé par la comparaison, pas ici).
 * Pour un dépôt publié sur npm (Remotion), la version npm fait foi : c'est elle qu'on installe.
 * `GITHUB_TOKEN_VEILLE` (facultatif) n'augmente que le quota de lecture.
 */
import { empreinte, lireJson, lireTexte, SourceMuette } from "./http";
import { lireNpm } from "./npm";
import type { ContexteLecture, Lecture } from "./types";
import { plusRecente } from "./versions";

/** Dépôts dont la version installée vient de npm. */
export const PAQUETS_NPM: Record<string, string> = { "remotion-dev/remotion": "remotion" };

interface Release {
  tag_name: string;
  published_at?: string;
  html_url?: string;
  body?: string;
}

function entetes(env: ContexteLecture["env"]): Record<string, string> {
  const jeton = env.GITHUB_TOKEN_VEILLE?.trim();
  return { accept: "application/vnd.github+json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) };
}

async function derniereVersion(depot: string, c: ContexteLecture): Promise<{ version: string; date?: string; lien: string; notes: string }> {
  try {
    const r = await lireJson<Release>(c.appeler, `https://api.github.com/repos/${depot}/releases/latest`, c.delaiMs, entetes(c.env));
    return { version: r.tag_name.replace(/^v/i, ""), date: r.published_at, lien: r.html_url ?? `https://github.com/${depot}/releases`, notes: (r.body ?? "").slice(0, 3000) };
  } catch (e) {
    if (!(e instanceof SourceMuette) || e.raison !== "Adresse introuvable.") throw e;
  }
  // Pas de « release » : étiquettes du dépôt (une seule lecture, toutes les étiquettes).
  const refs = await lireJson<{ ref: string }[]>(c.appeler, `https://api.github.com/repos/${depot}/git/matching-refs/tags/`, c.delaiMs, entetes(c.env));
  const v = plusRecente(refs.map((r) => r.ref.replace("refs/tags/", "")));
  if (!v) throw new SourceMuette("Aucune version stable trouvée.");
  return { version: v, lien: `https://github.com/${depot}/tags`, notes: `${depot} ${v}` };
}

export async function lireGithub(depot: string, fichiersSurveilles: string[] = [], c: ContexteLecture): Promise<Lecture> {
  try {
    const gh = await derniereVersion(depot, c);
    let { version, date } = gh;
    const paquet = PAQUETS_NPM[depot];
    if (paquet) {
      const npm = await lireNpm(paquet, c);
      if (npm.ok && npm.version) {
        version = npm.version;
        date = npm.date ?? date;
      }
    }
    const fichiers: Record<string, string> = {};
    for (const f of fichiersSurveilles) {
      // Branche par défaut (HEAD) : c'est le texte en vigueur pour les nouvelles versions.
      fichiers[f] = empreinte(normaliserFichier(await lireTexte(c.appeler, `https://raw.githubusercontent.com/${depot}/HEAD/${f}`, c.delaiMs)));
    }
    return { ok: true, version, date, lien: gh.lien, notes: gh.notes, empreinte: empreinte(version), ...(fichiersSurveilles.length ? { fichiers } : {}) };
  } catch (e) {
    return { ok: false, raison: e instanceof SourceMuette ? e.raison : "La source ne répond pas." };
  }
}

/**
 * Un fichier surveillé est comparé SANS ses espaces de fin de ligne ni l'année du copyright
 * (« Copyright © 2026 » qui passe à 2027 n'est pas un changement de licence).
 */
export function normaliserFichier(texte: string): string {
  return texte
    .replace(/\r\n/g, "\n")
    .replace(/(copyright\s*(?:©|\(c\))?\s*)\d{4}(\s*[-–]\s*\d{4})?/gi, "$1AAAA")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}
