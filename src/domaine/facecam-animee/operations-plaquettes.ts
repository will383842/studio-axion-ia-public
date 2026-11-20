/**
 * S-15-OPERATIONS-v19c : retrouver une plaquette par son nom et la retirer (calcul pur).
 * S-15-a-v20l : changer son texte, la décaler, choisir une variante (tenue dans une table à part, hors du plan).
 * Ne lève jamais, ne modifie jamais la liste reçue. Aucun appelant : rien n'est branché.
 * Ces opérations ne parlent que des plaquettes du plan : la prise (le visage) n'en fait pas partie.
 */
import { nommerPlaquettes } from "./noms-plaquettes";
import { schemaElementV4, type ElementV4Plan } from "./plan";

export type RetraitPlaquette =
  | { ok: true; elements: ElementV4Plan[]; retiree: ElementV4Plan }
  | { ok: false; raison: string };

/** Retrouve une plaquette par son nom, ou null si elle n'existe pas. */
export function trouverPlaquette(
  elements: readonly ElementV4Plan[],
  uid: string,
): { index: number; element: ElementV4Plan } | null {
  const index = nommerPlaquettes(elements).findIndex((n) => n.uid === uid);
  return index < 0 ? null : { index, element: elements[index] };
}

/** Retire une plaquette ; les autres restent les mêmes objets, avec les mêmes noms. */
export function retirerPlaquette(elements: readonly ElementV4Plan[], uid: string): RetraitPlaquette {
  const avant = nommerPlaquettes(elements);
  const index = avant.findIndex((n) => n.uid === uid);
  if (index < 0) return { ok: false, raison: "Cette plaquette n'existe plus dans le plan." };
  const reste = elements.filter((_, i) => i !== index);
  const apres = nommerPlaquettes(reste).map((n) => n.uid);
  const attendus = avant.filter((_, i) => i !== index).map((n) => n.uid);
  if (apres.length !== attendus.length || apres.some((u, i) => u !== attendus[i])) {
    return { ok: false, raison: "Deux plaquettes identiques : dites laquelle par son moment." };
  }
  return { ok: true, elements: reste, retiree: elements[index] };
}

const INCONNUE = "Cette plaquette n'existe plus dans le plan.";
const IDENTIQUES = "Deux plaquettes identiques : dites laquelle par son moment.";

export type ModificationPlaquette =
  | { ok: true; elements: ElementV4Plan[]; element: ElementV4Plan; uid: string }
  | { ok: false; raison: string };

/** Remplace UNE plaquette par sa version modifiée : plan neuf, autres plaquettes inchangées (mêmes objets et mêmes noms), schéma revérifié. */
function remplacer(elements: readonly ElementV4Plan[], uid: string, fabriquer: (e: ElementV4Plan) => ElementV4Plan | string): ModificationPlaquette {
  try {
    const avant = nommerPlaquettes(elements);
    const index = avant.findIndex((n) => n.uid === uid);
    if (index < 0) return { ok: false, raison: INCONNUE };
    const neuf = fabriquer(elements[index]);
    if (typeof neuf === "string") return { ok: false, raison: neuf };
    if (!schemaElementV4.safeParse(neuf).success) return { ok: false, raison: "Cette modification n'est pas possible pour cette plaquette." };
    const liste = elements.map((e, i) => (i === index ? neuf : e));
    const apres = nommerPlaquettes(liste).map((n) => n.uid);
    const autres = avant.map((n) => n.uid).filter((_, i) => i !== index);
    if (apres.filter((_, i) => i !== index).some((u, i) => u !== autres[i]) || new Set(apres).size !== apres.length) return { ok: false, raison: IDENTIQUES };
    return { ok: true, elements: liste, element: neuf, uid: apres[index] };
  } catch {
    return { ok: false, raison: "Cette modification n'est pas possible pour cette plaquette." };
  }
}

/** Change les mots affichés d'une plaquette qui en a (1 à 8 mots de 1 à 40 caractères). Le nouveau nom est rendu : il suit le contenu. */
export function changerTextePlaquette(elements: readonly ElementV4Plan[], uid: string, mots: readonly string[]): ModificationPlaquette {
  return remplacer(elements, uid, (e) => {
    if (!e.mots) return "Cette plaquette n'a pas de texte à changer.";
    const propres = mots.map((m) => (typeof m === "string" ? m.trim() : ""));
    if (propres.length < 1 || propres.length > 8 || propres.some((m) => m.length < 1 || m.length > 40)) return "Le texte doit faire de 1 à 8 mots, de 1 à 40 caractères chacun.";
    return { ...e, mots: propres };
  });
}

/** Décale le début et la fin d'une plaquette du même temps (secondes) ; jamais avant 0 s, jamais de 0 s ni de valeur absurde (au plus 30 s). */
export function decalerPlaquette(elements: readonly ElementV4Plan[], uid: string, decalageSec: number): ModificationPlaquette {
  return remplacer(elements, uid, (e) => {
    if (!Number.isFinite(decalageSec) || decalageSec === 0 || Math.abs(decalageSec) > 30) return "Dites de combien de secondes décaler la plaquette (30 au plus).";
    if (e.debut + decalageSec < 0) return "La plaquette ne peut pas commencer avant le début de la vidéo.";
    return { ...e, debut: e.debut + decalageSec, fin: e.fin + decalageSec };
  });
}

export type ChoixVariante = { ok: true; variantes: Record<string, string> } | { ok: false; raison: string };

/** Choisit une variante pour une plaquette : la table `uid → variante` est neuve, le plan n'est jamais touché. */
export function choisirVariantePlaquette(elements: readonly ElementV4Plan[], variantes: Readonly<Record<string, string>>, uid: string, variante: string): ChoixVariante {
  try {
    if (!trouverPlaquette(elements, uid)) return { ok: false, raison: INCONNUE };
    if (typeof variante !== "string" || !/^[a-z0-9-]{1,40}$/.test(variante)) return { ok: false, raison: "Cette variante n'est pas valide." };
    return { ok: true, variantes: { ...variantes, [uid]: variante } };
  } catch {
    return { ok: false, raison: "Cette modification n'est pas possible pour cette plaquette." };
  }
}
