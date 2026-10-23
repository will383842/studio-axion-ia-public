/**
 * Heures des mots simulées, figées (aucune voix) : ordre de récit tronc, puis chaque branche (majoritaire d'abord) avec
 * retour au nœud de décision avant la suivante ; 8 mots par nœud à 2,75 mots/s, 4 mots de transition à chaque
 * changement de groupe. Même règle que `camera.test.ts`.
 */
import type { CarteImage } from "@/domaine/image-video/carte";
import type { MotParle } from "@/briques/schema-motion/types";

const DEBIT = 2.75;

export function motsSimules(carte: CarteImage): MotParle[] {
  const tries = [...carte.noeuds].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
  const branches = carte.groupes.filter((g) => g.sorte === "branche");
  const decision = carte.noeuds.find((n) => n.role === "decision");
  const suite: string[] = [];
  if (branches.length >= 2 && decision) {
    const dansBranche = new Set(branches.flatMap((g) => g.noeuds));
    const tronc = tries.filter((n) => !dansBranche.has(n.id));
    const ordonnees = [...branches].sort((a, b) => Number(!!b.majoritaire) - Number(!!a.majoritaire) || a.id.localeCompare(b.id));
    suite.push(...tronc.filter((n) => n.ordre <= decision.ordre).map((n) => n.id));
    ordonnees.forEach((g, i) => {
      if (i > 0) suite.push(decision.id);
      suite.push(...tries.filter((n) => g.noeuds.includes(n.id)).map((n) => n.id));
    });
    suite.push(...tronc.filter((n) => n.ordre > decision.ordre).map((n) => n.id));
  } else suite.push(...tries.map((n) => n.id));
  const groupeDe = new Map(carte.noeuds.map((n) => [n.id, n.groupe ?? ""]));
  const mots: MotParle[] = [];
  let t = 1;
  suite.forEach((id, i) => {
    if (i > 0 && groupeDe.get(id) !== groupeDe.get(suite[i - 1])) t += 4 / DEBIT;
    mots.push({ noeud: id, t: Math.round(t * 1000) / 1000 });
    t += 8 / DEBIT;
  });
  return mots;
}
