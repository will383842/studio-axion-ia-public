/**
 * RAP-1 · PHOTOGRAPHIE EN LECTURE SEULE des posts à venir chez Zernio (scheduled, draft, publishing).
 *
 * Pour chaque post : identifiant, statut, `scheduledFor`, plateforme, compte, `metadata.origine` et empreinte sha256 du texte
 * (jamais le texte, jamais une adresse de média). Écrit dans le fichier demandé, HORS du dépôt (dépôt public).
 * `--comparer <avant.json>` affiche les différences entre deux photographies.
 *
 * Usage (racine du dépôt), la clé dans l'environnement du SEUL processus :
 *   ZERNIO_API_KEY=… pnpm exec tsx outils/zernio/ecart-calendrier.mts --sortie <fichier> [--comparer <avant.json>]
 *
 * Ne touche ni la base ni le calendrier du Studio (la comparaison avec le calendrier est faite par le serveur, RAP-2) ;
 * l'interrupteur d'envoi est forcé à FAUX : toute écriture est refusée avant le réseau.
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { creerClientZernio, type ClientZernio, type PostZernio } from "../../src/fournisseurs/publication/zernio-client";
import { estErreurZernio } from "../../src/fournisseurs/publication/zernio-erreurs";
import { STATUTS_RAPATRIES } from "../../src/domaine/rapatriement-zernio";

const RACINE_DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function arreter(message: string): never {
  console.error(message);
  process.exit(1);
}
const arg = (nom: string): string | undefined => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const estDans = (chemin: string, parent: string): boolean => {
  const rel = relative(parent, chemin);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};
function dossierReel(chemin: string): string {
  let d = dirname(chemin);
  for (;;) {
    try {
      return realpathSync(d);
    } catch {
      const parent = dirname(d);
      if (parent === d) return d;
      d = parent;
    }
  }
}

export interface LignePhoto {
  id: string;
  statut: string;
  scheduledFor: string | null;
  plateforme: string;
  compte: string;
  origine: string;
  empreinteTexte: string;
}

export function ligneDe(post: PostZernio): LignePhoto[] {
  const empreinte = createHash("sha256").update(String(post.content ?? "")).digest("hex");
  const plateformes = Array.isArray(post.platforms) && post.platforms.length > 0 ? post.platforms : [{ platform: "inconnue", accountId: "" } as PostZernio["platforms"][number]];
  return plateformes.map((pf) => ({
    id: post._id,
    statut: post.status,
    scheduledFor: typeof post.scheduledFor === "string" ? post.scheduledFor : null,
    plateforme: typeof pf.platform === "string" && pf.platform ? pf.platform : "inconnue",
    compte: typeof pf.accountId === "string" ? pf.accountId : String(pf.accountId?._id ?? ""),
    origine: typeof post.metadata?.origine === "string" ? post.metadata.origine : "externe",
    empreinteTexte: empreinte,
  }));
}

const PAGES_MAX = 50;

/** Lit tous les posts à venir ; `complete:false` si le plafond de pages est atteint sur une page encore pleine (il peut en rester). */
export async function lirePhotographie(client: Pick<ClientZernio, "listerPosts">, pagesMax: number = PAGES_MAX): Promise<{ lignes: LignePhoto[]; posts: number; complete: boolean }> {
  const lignes: LignePhoto[] = [];
  const vus = new Set<string>();
  let complete = true;
  for (const status of STATUTS_RAPATRIES) {
    for (let page = 1; page <= pagesMax; page++) {
      const lus = await client.listerPosts({ status, page, limit: 100 });
      for (const p of lus) {
        if (vus.has(p._id)) continue;
        vus.add(p._id);
        lignes.push(...ligneDe(p));
      }
      if (lus.length < 100) break;
      if (page === pagesMax) complete = false;
    }
  }
  return { lignes, posts: vus.size, complete };
}

export function comparer(avant: LignePhoto[], apres: LignePhoto[]): { ajoutes: LignePhoto[]; disparus: LignePhoto[]; modifies: { id: string; avant: LignePhoto; apres: LignePhoto }[] } {
  const cle = (l: LignePhoto): string => `${l.id}|${l.compte}`;
  const a = new Map(avant.map((l) => [cle(l), l]));
  const b = new Map(apres.map((l) => [cle(l), l]));
  return {
    ajoutes: [...b].filter(([k]) => !a.has(k)).map(([, l]) => l),
    disparus: [...a].filter(([k]) => !b.has(k)).map(([, l]) => l),
    modifies: [...b].filter(([k, l]) => a.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(l)).map(([k, l]) => ({ id: l.id, avant: a.get(k)!, apres: l })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = arg("--sortie");
  if (!sortie) arreter("Usage : --sortie <fichier> [--comparer <avant.json>]");
  const chemin = resolve(sortie);
  if (estDans(chemin, RACINE_DEPOT) || estDans(dossierReel(chemin), realpathSync(RACINE_DEPOT))) arreter("Sortie refusée : le fichier doit être écrit HORS du dépôt (dépôt public).");
  const cle = process.env.ZERNIO_API_KEY?.trim();
  if (!cle) arreter("ZERNIO_API_KEY absente de l'environnement : rien n'est lu.");
  const client = creerClientZernio({ cle, envoiAutorise: () => false });
  try {
    const { lignes, posts, complete } = await lirePhotographie(client);
    mkdirSync(dirname(chemin), { recursive: true, mode: 0o700 });
    writeFileSync(chemin, JSON.stringify({ photographieLe: new Date().toISOString(), complete, lignes }, null, 2) + "\n", { mode: 0o600 });
    chmodSync(chemin, 0o600);
    console.log(`Photographie : ${posts} post(s), ${lignes.length} ligne(s). Écrite dans le fichier demandé (hors dépôt).`);
    if (!complete) console.warn("ATTENTION : lecture INCOMPLÈTE (plafond de pages atteint) ; ne pas la présenter comme complète.");
    const avantChemin = arg("--comparer");
    if (avantChemin) {
      const avant = (JSON.parse(readFileSync(resolve(avantChemin), "utf8")) as { lignes: LignePhoto[] }).lignes;
      const d = comparer(avant, lignes);
      console.log(`Différences : ${d.ajoutes.length} ajouté(s), ${d.disparus.length} disparu(s), ${d.modifies.length} modifié(s).`);
      for (const m of d.modifies) console.log(`  modifié ${m.id.slice(0, 6)} : ${m.avant.statut}/${m.avant.scheduledFor} → ${m.apres.statut}/${m.apres.scheduledFor}`);
    }
  } catch (e) {
    arreter(estErreurZernio(e) ? `Lecture impossible (${e.code}) : ${e.message}` : "Lecture impossible (erreur inconnue).");
  }
}
