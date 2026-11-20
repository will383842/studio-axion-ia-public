/**
 * Lot C : la légende relue et enregistrée par la personne est reportée sur le créneau du visuel. Un texte automatique
 * (« simulation ») n'est jamais copié. Dépôts et geste de modification passés en paramètre (doublures en test) ;
 * aucun appel au réseau ici : la garde du geste réel décide de tout.
 */
import "server-only";
import { modifierTexteProgramme, depsDeplacementServeur, type DemandeTexte, type ResultatDeplacement } from "@/services/deplacer-programmation";
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
  // Aussi un créneau resté « valide » ou « a_valider » par une panne après l'écriture du texte : le rejeu termine le travail.
  const c = await d.passerelle.creneaux.trouver((x) => x.visuelId === visuelId && (x.statut === "programme" || x.statut === "valide" || x.statut === "a_valider") && !x.retireLe);
  if (!c || !Object.hasOwn(c.heuresParReseau ?? {}, reseau)) return { ok: true };
  if (c.textes?.[reseau]?.texte === texte) {
    if (c.statut !== "programme") await programmerEnUnClic(d.passerelle, visuelId, "", maintenant);
    return { ok: true };
  }
  const r = await d.modifierTexte({ creneauId: c.id, reseau, texte, auteur: "will", cle: `lg${empreinte(`${reseau}|${texte}`)}` });
  if (!r.ok) return { ok: false, message: r.message };
  await programmerEnUnClic(d.passerelle, visuelId, "", maintenant);
  return { ok: true };
}

/**
 * Geste de modification du texte pour la fiche carrousel : port de retrait à `null`. Jamais de retrait chez le diffuseur
 * depuis ce chemin ; si un post est possible, la garde rend sa phrase et rien n'est écrit.
 */
export async function modifierTexteSansRetrait(demande: DemandeTexte): Promise<ResultatDeplacement> {
  return modifierTexteProgramme(await depsDeplacementServeur(null), demande);
}

/**
 * Réseaux « à compléter » d'une fiche : d'après le texte du créneau vivant s'il existe (c'est lui qui part), sinon d'après la
 * légende enregistrée du visuel. Une légende enregistrée mais jamais reportée (garde refusée) reste donc signalée au rechargement.
 */
export async function reseauxACompleter(creneaux: DepotsPasserelle["creneaux"], visuelId: string, reseaux: readonly IdReseau[], legendes: Partial<Record<IdReseau, { texte?: string; simulation?: boolean }>>): Promise<IdReseau[]> {
  const c = await creneaux.trouver((x) => x.visuelId === visuelId && !x.retireLe && x.statut !== "archive");
  return reseaux.filter((r) => {
    if (c) return !c.textes?.[r]?.texte?.trim();
    const l = legendes[r];
    return !l?.texte?.trim() || l.simulation === true;
  });
}

/** Code court de l'adresse (`?report=`) : la phrase est écrite ici, jamais lue dans l'adresse. Un code inconnu ne montre rien. */
export const PHRASE_REPORT_REFUSE = "La légende est enregistrée, mais elle n'a pas pu être reportée sur la publication programmée : rien n'a été changé chez le diffuseur. Modifiez le texte depuis le calendrier ou chez le diffuseur.";
export function phraseDuCodeReport(code: string | undefined): string | undefined {
  return code === "refus" ? PHRASE_REPORT_REFUSE : undefined;
}
