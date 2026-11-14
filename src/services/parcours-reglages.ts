/**
 * Interrupteurs de l'écran /mots : « Mode plusieurs mots » (réglage « plusieurs mots ») et « Instagram : suivre le compte puis OK »
 * (réglage « Instagram »). Écriture par la couche de données normale (mémoire ET base, via les modules des réglages), puis RELECTURE de la valeur.
 * Règle : Instagram ne s'allume que si plusieurs mots est allumé ; éteindre est toujours possible (éteindre « plusieurs mots » éteint aussi Instagram).
 * Chaque bascule est journalisée (type « mots »), sans aucune donnée personnelle.
 */
import "server-only";
import { journaliser } from "./_commun";

/** Lecture et écriture des deux réglages, injectées par `parcours-conversation` (seul fichier de production autorisé à citer les modules des réglages). */
export interface AccesReglages {
  lire(): Promise<EtatReglagesParcours>;
  ecrireMotsMultiples(allume: boolean): Promise<void>;
  ecrireInstagramSuivre(allume: boolean): Promise<void>;
}

export type ReglageParcours = "mots_multiples" | "instagram_suivre";
export interface EtatReglagesParcours {
  motsMultiples: boolean;
  instagramSuivre: boolean;
}
export type ResultatReglage = { ok: true; etat: EtatReglagesParcours } | { ok: false; raison: "reglage_inconnu" | "plusieurs_mots_eteint" | "ecriture_non_relue"; etat: EtatReglagesParcours };

const LIBELLES: Record<ReglageParcours, string> = { mots_multiples: "Mode plusieurs mots", instagram_suivre: "Instagram : suivre le compte puis OK" };

/** Fixe un réglage (le client n'envoie qu'un nom et un booléen). Appelé seulement par un geste qui a exigé la session. */
export async function appliquerReglageParcours(acces: AccesReglages, reglage: ReglageParcours, allume: boolean): Promise<ResultatReglage> {
  const avant = await acces.lire();
  if (reglage !== "mots_multiples" && reglage !== "instagram_suivre") return { ok: false, raison: "reglage_inconnu", etat: avant };
  if (typeof allume !== "boolean") return { ok: false, raison: "reglage_inconnu", etat: avant };
  if (reglage === "instagram_suivre" && allume && !avant.motsMultiples) return { ok: false, raison: "plusieurs_mots_eteint", etat: avant };
  if (reglage === "mots_multiples") await acces.ecrireMotsMultiples(allume);
  else await acces.ecrireInstagramSuivre(allume);
  // Éteindre « plusieurs mots » éteint aussi Instagram : Instagram ne tourne jamais sans lui.
  const coupeInstagram = reglage === "mots_multiples" && !allume && avant.instagramSuivre;
  if (coupeInstagram) await acces.ecrireInstagramSuivre(false);
  const apres = await acces.lire();
  const attendu = reglage === "mots_multiples" ? apres.motsMultiples === allume : apres.instagramSuivre === allume;
  if (!attendu || (coupeInstagram && apres.instagramSuivre)) return { ok: false, raison: "ecriture_non_relue", etat: apres };
  await journaliser("mots", `Réglage « ${LIBELLES[reglage]} » ${allume ? "allumé" : "éteint"} par l'opérateur${coupeInstagram ? " (Instagram éteint avec lui)" : ""}.`);
  return { ok: true, etat: apres };
}
