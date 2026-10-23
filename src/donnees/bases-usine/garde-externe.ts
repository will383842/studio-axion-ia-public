/**
 * GARDE EXTERNE (ADR 0001 § 4b) : `source.json` = manifeste ACTUEL de depot-prive (branche `main`). Le réseau est injecté
 * (`lire`) pour tester sans jeton. Règle : jeton absent, manifeste inaccessible (réseau, 404) ou illisible = ROUGE,
 * jamais vert par défaut. Le seul saut permis (PR de dépôt tiers, sans accès aux secrets) est décidé par l'appelant et
 * affiché : `sauteParFork`.
 */
import { ecartsExternes, type ManifesteBases, type SourceBases } from "./empreintes";

export const MANIFESTE_URL = "https://api.github.com/repos/<proprietaire>/<depot-prive-des-bases>/contents/usine/bases/pour-la-machine/MANIFESTE-BASES.json?ref=main";

export type ResultatGarde = { statut: "vert" } | { statut: "rouge"; raisons: string[] } | { statut: "saute"; raison: string };

export async function gardeExterne(
  source: SourceBases,
  opts: { jeton: string | undefined; sauteParFork: boolean; lire: (url: string, entetes: Record<string, string>) => Promise<{ status: number; texte: string }> },
): Promise<ResultatGarde> {
  if (opts.sauteParFork) return { statut: "saute", raison: "PR d'un dépôt tiers : pas d'accès au jeton, garde externe NON exécutée (ce n'est pas un succès)" };
  if (!opts.jeton) return { statut: "rouge", raisons: ["jeton BASES_PRIVEES_LECTURE absent ou vide : garde externe impossible"] };
  let rep: { status: number; texte: string };
  try {
    rep = await opts.lire(MANIFESTE_URL, { Authorization: `Bearer ${opts.jeton}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" });
  } catch (e) {
    return { statut: "rouge", raisons: [`manifeste inaccessible : ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (rep.status !== 200) return { statut: "rouge", raisons: [`manifeste inaccessible : HTTP ${rep.status} (jeton expiré, droit insuffisant, ou MANIFESTE-BASES.json absent de depot-prive)`] };
  let manifeste: ManifesteBases;
  try {
    manifeste = JSON.parse(rep.texte) as ManifesteBases;
  } catch {
    return { statut: "rouge", raisons: ["manifeste illisible (JSON invalide)"] };
  }
  if (typeof manifeste.empreinte !== "string" || typeof manifeste.commit !== "string" || typeof manifeste.fichiers !== "object" || manifeste.fichiers === null) {
    return { statut: "rouge", raisons: ["manifeste illisible (champs commit / fichiers / empreinte manquants)"] };
  }
  const ecarts = ecartsExternes(source, manifeste);
  return ecarts.length === 0 ? { statut: "vert" } : { statut: "rouge", raisons: ecarts };
}
