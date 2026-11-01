/**
 * IMP-3 (a) — RETRAIT DU JUMEAU BUFFER. RÈGLE ABSOLUE : on ne SUPPRIME JAMAIS un post Buffer.
 * Le seul retrait possible est le passage en brouillon, UN SEUL post à la fois, après relecture (GET) du brouillon
 * Zernio jumeau et vérification qu'il correspond. Le dépôt n'offre aucune mutation Buffer : sans fonction
 * `passerEnBrouillon` injectée ET sans `confirmerRetrait`, on produit seulement la LISTE des posts que l'opérateur retire à la main.
 * Zernio : lectures seules, via le client à liste fermée.
 */
import type { ClientZernio, PostZernio } from "../../fournisseurs/publication/zernio-client";
import { listerTousLesPosts, ORIGINE_IMPORT } from "./creer-brouillons";
import type { PostBuffer } from "./types";

const texteDe = (z: PostZernio): string => {
  const c = z.platforms?.[0]?.customContent;
  return (typeof c === "string" ? c : (z.content ?? "")).trim();
};

/** Écarts (en phrases) entre un post Buffer et son jumeau Zernio ; vide = le jumeau correspond. */
export function ecartsJumeau(post: PostBuffer, z: PostZernio): string[] {
  const e: string[] = [];
  if (z.metadata?.origine !== ORIGINE_IMPORT) e.push("origine");
  if (z.metadata?.bufferId !== post.id) e.push("bufferId");
  if (texteDe(z) !== post.texte.trim()) e.push("texte");
  if (Date.parse(z.scheduledFor ?? "") !== Date.parse(post.dateUtc ?? "")) e.push("date");
  if ((z.mediaItems?.length ?? 0) !== post.medias.length) e.push("nombre de médias");
  return e;
}

/** Ordre de traitement : date croissante, puis identifiant (déterministe, reprenable). */
export const trierParDate = <T extends { dateUtc?: string; id: string }>(l: T[]): T[] =>
  [...l].sort((a, b) => (Date.parse(a.dateUtc ?? "") || 0) - (Date.parse(b.dateUtc ?? "") || 0) || a.id.localeCompare(b.id));

export type EtatRetrait = "a-retirer-a-la-main" | "retire" | "deja-retire" | "sans-jumeau" | "jumeau-different" | "echec" | "arret";

export interface LigneRetrait {
  bufferId: string;
  canalId: string;
  zernioId?: string;
  dateIso?: string;
  etat: EtatRetrait;
  raison?: string;
}

export interface ResultatRetrait {
  lignes: LigneRetrait[];
  /** Posts à repasser en brouillon à la main dans Buffer (jamais à supprimer). */
  liste: LigneRetrait[];
}

/** Passage en brouillon d'UN post Buffer. Aucune implémentation dans le dépôt (aucune mutation Buffer sûre connue). */
export type PasserEnBrouillon = (bufferId: string) => Promise<{ ok: boolean; raison?: string }>;

export interface OptionsRetrait {
  client: ClientZernio;
  /** Posts Buffer à venir (lecture IMP-1). Tout statut autre que « draft » (scheduled, needs_approval, error…) est à retirer : il peut encore partir. */
  posts: PostBuffer[];
  /** Option explicite --confirmer-retrait : sans elle (ou sans `passerEnBrouillon`), AUCUNE action Buffer. */
  confirmerRetrait?: boolean;
  passerEnBrouillon?: PasserEnBrouillon;
  /** Reprise : identifiants Buffer déjà passés en brouillon (journal). */
  dejaRetires?: ReadonlySet<string>;
  /** Appelé après chaque décision (journal de l'appelant). */
  journaliser?: (l: LigneRetrait) => void | Promise<void>;
}

export async function retirerJumeaux(o: OptionsRetrait): Promise<ResultatRetrait> {
  const agir = !!o.confirmerRetrait && !!o.passerEnBrouillon;
  const res: ResultatRetrait = { lignes: [], liste: [] };
  const brouillons = await listerTousLesPosts(o.client, "draft");
  const parBuffer = new Map<string, PostZernio>();
  for (const z of brouillons) if (z.metadata?.origine === ORIGINE_IMPORT && typeof z.metadata.bufferId === "string") parBuffer.set(z.metadata.bufferId, z);
  let arret = false;
  for (const post of trierParDate(o.posts.filter((p) => p.statut !== "draft" || o.dejaRetires?.has(p.id)))) {
    const l: LigneRetrait = { bufferId: post.id, canalId: post.canalId, dateIso: post.dateUtc, etat: "arret" };
    res.lignes.push(l);
    const fin = async () => void (await o.journaliser?.(l));
    if (o.dejaRetires?.has(post.id)) {
      l.etat = "deja-retire";
      await fin();
      continue;
    }
    if (arret) {
      l.raison = "arrêt avant ce post";
      await fin();
      continue;
    }
    const liste = parBuffer.get(post.id);
    if (!liste) {
      l.etat = "sans-jumeau";
      l.raison = "aucun brouillon Zernio jumeau : le post reste actif dans Buffer";
      await fin();
      continue;
    }
    l.zernioId = liste._id;
    // Relecture du jumeau au moment même du retrait (jamais sur la seule liste).
    let z: PostZernio;
    try {
      z = await o.client.lirePost(liste._id);
    } catch {
      l.etat = "echec";
      l.raison = "jumeau Zernio illisible : post Buffer non touché";
      await fin();
      continue;
    }
    const ecarts = z.status === "draft" ? ecartsJumeau(post, z) : [`statut ${z.status}`];
    if (ecarts.length) {
      l.etat = "jumeau-different";
      l.raison = `le jumeau ne correspond pas (${ecarts.join(", ")}) : post Buffer non touché`;
      await fin();
      continue;
    }
    if (!agir) {
      l.etat = "a-retirer-a-la-main";
      l.raison = "à repasser en brouillon dans Buffer (jamais à supprimer)";
      res.liste.push(l);
      await fin();
      continue;
    }
    try {
      const r = await o.passerEnBrouillon!(post.id);
      if (r.ok) l.etat = "retire";
      else {
        l.etat = "echec";
        l.raison = r.raison ?? "passage en brouillon refusé";
        arret = true;
      }
    } catch (e) {
      l.etat = "echec";
      l.raison = e instanceof Error ? e.message : "erreur";
      arret = true; // aucun nouvel essai automatique
    }
    await fin();
  }
  return res;
}

const csv = (v: string | undefined): string => `"${(v ?? "").replace(/"/g, '""')}"`;
/** Liste à la main pour l'opérateur : identifiants et dates seulement (aucun texte, aucune clé). */
export function listeCsv(liste: LigneRetrait[]): string {
  return ["bufferId,canalId,zernioId,date,action", ...liste.map((l) => [l.bufferId, l.canalId, l.zernioId, l.dateIso, "repasser en brouillon"].map(csv).join(","))].join("\n");
}
