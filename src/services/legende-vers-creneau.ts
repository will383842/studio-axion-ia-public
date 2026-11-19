/**
 * Lot C : la légende relue et enregistrée par la personne est reportée sur le créneau du visuel. Un texte automatique
 * (« simulation ») n'est jamais copié. Dépôts et geste de modification passés en paramètre (doublures en test) ;
 * aucun appel au réseau ici : la garde du geste réel décide de tout.
 */
import "server-only";
import { programmerEnUnClic, type TextesCreneau } from "@/components/visuels/BoutonProgrammerVisuel";
import type { IdReseau } from "@/domaine/types";
import type { DepotsPasserelle } from "@/services/plan-vers-publication";

/** Les légendes que la personne a enregistrées : pas de texte automatique, pas de texte vide. */
export async function legendesEnregistrees(reseaux: readonly IdReseau[], lire: (reseau: IdReseau) => Promise<unknown>): Promise<TextesCreneau> {
  const textes: TextesCreneau = {};
  for (const r of reseaux) {
    const v = (await lire(r)) as { texte?: unknown; simulation?: unknown } | null;
    if (!v || v.simulation === true || typeof v.texte !== "string" || !v.texte.trim()) continue;
    textes[r] = { texte: v.texte, premierCommentaire: "" };
  }
  return textes;
}

export interface DemandeReport { creneauId: string; reseau: string; texte: string; auteur: "will"; cle: string }
export type ResultatGeste = { ok: true; [k: string]: unknown } | { ok: false; message: string; [k: string]: unknown };
export interface DepsReport {
  passerelle: DepotsPasserelle;
  modifierTexte(demande: DemandeReport): Promise<ResultatGeste>;
}

function empreinte(texte: string): string {
  let h = 5381;
  for (const c of texte) h = ((h * 33) ^ c.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

/**
 * Visuel déjà « programme » : range la légende sur son créneau vivant (version +1 par le geste existant), puis le
 * repasse « valide » et « programme » par `programmerEnUnClic`. Garde refusée : rien n'est changé, la phrase est rendue.
 * Visuel non programmé ou même texte : rien à faire.
 */
export async function reporterLegendeSurCreneau(d: DepsReport, visuelId: string, reseau: IdReseau, texte: string, maintenant: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = await d.passerelle.visuels.obtenir(visuelId);
  if (!v || v.statut !== "programme") return { ok: true };
  const c = await d.passerelle.creneaux.trouver((x) => x.visuelId === visuelId && x.statut === "programme" && !x.retireLe);
  if (!c || !Object.hasOwn(c.heuresParReseau ?? {}, reseau)) return { ok: true };
  if (c.textes?.[reseau]?.texte === texte) return { ok: true };
  const r = await d.modifierTexte({ creneauId: c.id, reseau, texte, auteur: "will", cle: `lg${empreinte(`${reseau}|${texte}`)}` });
  if (!r.ok) return { ok: false, message: r.message };
  await programmerEnUnClic(d.passerelle, visuelId, "", maintenant);
  return { ok: true };
}
