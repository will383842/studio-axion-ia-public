/**
 * IMP-1 — EXPORT DES STATISTIQUES PASSÉES, PAR POST (lecture seule). Posts envoyés et leurs mesures (vues, likes…)
 * telles que Buffer les donne ; aucune écriture, aucune clé en sortie.
 */
import type { ClientLecture } from "./lire-buffer";
import { REQUETE_POSTS_ENVOYES_STATS } from "./requetes-lecture";
import type { MesureBuffer, StatistiquesPost } from "./types";

type Brut = Record<string, unknown>;
const objet = (x: unknown): Brut | undefined => (x && typeof x === "object" && !Array.isArray(x) ? (x as Brut) : undefined);
const texte = (x: unknown): string | undefined => (typeof x === "string" && x ? x : undefined);

export function normaliserStatistiques(n: Brut): StatistiquesPost {
  const mesures: MesureBuffer[] = [];
  for (const m of Array.isArray(n.metrics) ? n.metrics : []) {
    const o = objet(m);
    if (o && typeof o.value === "number" && Number.isFinite(o.value)) mesures.push({ type: String(o.type ?? "other"), nom: texte(o.name), valeur: o.value });
  }
  return { postId: String(n.id ?? ""), canalId: String(n.channelId ?? ""), envoyeLe: texte(n.sentAt), misesAJourLe: texte(n.metricsUpdatedAt), mesures };
}

const PAGES_MAX = 100;

export async function lireStatistiquesPassees(client: ClientLecture, organisationId: string, taillePage = 50): Promise<StatistiquesPost[]> {
  const res: StatistiquesPost[] = [];
  let apres: string | undefined;
  for (let page = 0; page < PAGES_MAX; page++) {
    const posts = objet((await client.lire(REQUETE_POSTS_ENVOYES_STATS, { organizationId: organisationId, apres, nombre: taillePage })).posts);
    for (const e of Array.isArray(posts?.edges) ? posts.edges : []) {
      const n = objet(objet(e)?.node);
      if (n) res.push(normaliserStatistiques(n));
    }
    const info = objet(posts?.pageInfo);
    apres = texte(info?.endCursor);
    if (info?.hasNextPage !== true || !apres) break;
  }
  return res;
}

/** CSV : une ligne par post et par mesure. */
export function statistiquesEnCsv(stats: StatistiquesPost[]): string {
  const L = ["post;canal;envoye_le;mesure;valeur"];
  for (const s of stats) for (const m of s.mesures) L.push([s.postId, s.canalId, s.envoyeLe ?? "", m.type, m.valeur].join(";"));
  return L.join("\n");
}
