/**
 * L4-10 — Import du plan LinkedIn, À BLANC par défaut. Les posts sont déjà chez le diffuseur : aucune écriture
 * avant le relevé RC-24 (garde explicite). Aucun envoi, aucun appel réseau ; l'horloge est injectée.
 */
import { lireCalendrierCsv } from "./csv-calendrier";
import { cleIdempotente, compterTu, type EntreePlan, type Horloge, VERSION_REFONDU } from "./formats";
import { lirePostsMarkdown } from "./markdown-posts";

export interface EntreesImport {
  csv: string;
  markdown: string;
  horloge: Horloge;
}

export interface RapportImport {
  entrees: EntreePlan[];
  passeInconnu: number;
  alertesTu: number;
  doublonsIgnores: number;
  refondusIgnores: number;
  sansTexte: number[];
}

export function planifierImport(p: EntreesImport & { clesExistantes: ReadonlySet<string> }): RapportImport {
  const maintenant = p.horloge().toISOString().slice(0, 10);
  const textes = lirePostsMarkdown(p.markdown);
  const r: RapportImport = { entrees: [], passeInconnu: 0, alertesTu: 0, doublonsIgnores: 0, refondusIgnores: 0, sansTexte: [] };
  const vus = new Set<number>();
  for (const l of lireCalendrierCsv(p.csv)) {
    if (l.version === VERSION_REFONDU) {
      r.refondusIgnores++;
      continue;
    }
    if (vus.has(l.numero)) continue;
    vus.add(l.numero);
    const cle = cleIdempotente(l.numero);
    if (p.clesExistantes.has(cle)) {
      r.doublonsIgnores++;
      continue;
    }
    const t = textes.get(l.numero);
    if (!t) {
      r.sansTexte.push(l.numero);
      continue;
    }
    const passeInconnu = l.date < maintenant;
    const alerteTu = compterTu(`${t.texte}\n${t.premierCommentaire}`) > 0;
    if (passeInconnu) r.passeInconnu++;
    if (alerteTu) r.alertesTu++;
    r.entrees.push({ cle, numero: l.numero, date: l.date, heure: l.heure, texte: t.texte, premierCommentaire: t.premierCommentaire, passeInconnu, alerteTu, statut: "Publié", verrouille: true, boutonPrincipal: null });
  }
  return r;
}

export interface DepotPlan {
  cles(): Promise<ReadonlySet<string>>;
  ajouter(entree: EntreePlan): Promise<void>;
}

export async function importerPlan(p: EntreesImport & { depot: DepotPlan; aBlanc?: boolean; releveRc24Fait?: boolean }): Promise<RapportImport> {
  const aBlanc = p.aBlanc ?? true;
  if (!aBlanc && !p.releveRc24Fait) throw new Error("Écriture refusée : le relevé RC-24 n'est pas fait (posts possiblement déjà chez le diffuseur).");
  const rapport = planifierImport({ ...p, clesExistantes: await p.depot.cles() });
  if (!aBlanc) for (const e of rapport.entrees) await p.depot.ajouter(e);
  return rapport;
}
