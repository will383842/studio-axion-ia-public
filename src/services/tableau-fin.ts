/**
 * FIN DU TABLEAU ANIMÉ (raccord 3) : la fin vient de `fiche.appelId`, par `finPour(reseau, appelId)` de
 * `src/briques/fins`. Injectée par les services dans la chaîne (`choisirFin`) : le moteur n'importe rien d'ici.
 *
 * Règle ferme : une fin NON validée par Will n'est jamais utilisée. La vidéo se fabrique alors SANS écran de fin et
 * le rapport le dit en une phrase claire ; jamais un échec. Aucune fin n'est validée ici (c'est Will qui valide).
 * Garde-fou (décision du propriétaire, 12/10/2026) : la fin au mot (« Écrivez MOT en commentaire. Je vous l'envoie. »)
 * n'est JAMAIS choisie pour TikTok ni YouTube Shorts (rien n'y est envoyé), quoi que dise la table : la fin validée
 * sans promesse d'envoi du réseau la remplace ; s'il n'y en a pas, la vidéo se termine sans appel et le rapport le dit.
 * Garde-fou LinkedIn (Will, 12/10/2026 ; base 7 de l'Usine) : aucun appel à commenter n'y est jamais dit ; la fin au mot
 * demandée pour la vidéo laisse le carré de LinkedIn sans appel (`FIN_SANS_APPEL_LINKEDIN`), et le rapport le dit.
 * PUR : aucun accès base ni réseau.
 */
import { APPEL_A_COMMENTER_LINKEDIN, choisirFinLiens, estObjectifFinLiens, EMPLACEMENT_MOT, ErreurFin, RESEAUX_SANS_APPEL_A_COMMENTER, TABLE_FINS, estAppelACommenter, finPour, groupeDe, type FinTable, type ReseauFin } from "@/briques/fins";
import type { CommandeFabrication } from "@/domaine/types";
import { lireEntreesTableau } from "@/moteurs/montage-tableau/etapes";
import { FIN_SANS_APPEL_LIENS, type FinRetenue } from "@/moteurs/montage-tableau/fabriquer";
import { FIN_SANS_APPEL_LINKEDIN } from "@/moteurs/montage-tableau/relecture";
import { RESEAUX_DES_SORTIES, reseauxDeLaSortie, VERTICAL_LIENS, type IdSortie } from "@/moteurs/montage-tableau/formats-sortie";

export const AUCUNE_FIN_VALIDEE = "Aucune fin validée pour ce réseau : la vidéo se termine sans écran de fin.";

/**
 * Réseau dont la fin est tirée : celui de la variante, sinon le premier réseau visé, sinon `instagram` (valeur
 * prudente : premier des `reseauxConseilles` du format, recopié ici pour ne pas charger tout le registre des formats).
 */
export function reseauDuTableau(c: Pick<CommandeFabrication, "reseaux" | "variante">): ReseauFin {
  return c.variante?.reseau ?? c.reseaux?.[0] ?? "instagram";
}

/** Réseaux où rien n'est envoyé : la fin au mot n'y est jamais choisie. */
export const RESEAUX_SANS_ENVOI: readonly ReseauFin[] = Object.freeze(["tiktok", "youtube-shorts"]);

/** Vrai pour une fin qui demande un mot en commentaire contre un envoi (« Écrivez MOT en commentaire. Je vous l'envoie. »). */
export function estFinAuMot(f: Pick<FinTable, "type" | "dit" | "ecran">): boolean {
  return f.type === "commentaire" || f.dit.includes(EMPLACEMENT_MOT) || f.ecran.includes(EMPLACEMENT_MOT) || /\bje vous (l['’]\s?|les )?envoie\b/i.test(f.dit);
}

/** Message du refus de la fin au mot pour TikTok ou Shorts. */
export const FIN_AU_MOT_REFUSEE = "La fin « Écrivez … en commentaire. Je vous l'envoie. » n'est jamais utilisée sur TikTok ni sur YouTube Shorts : rien n'y est envoyé.";

/** Réseaux servis par chaque sortie : la table de `formats-sortie.ts` (réexportée ici pour ses lecteurs d'avant). */
export { RESEAUX_DES_SORTIES };

/**
 * Réseau dont la fin d'une SORTIE est tirée : le premier réseau servi par ce format (vertical seul : Reels et TikTok
 * sont servis ensemble ; on garde le réseau de la vidéo s'il en fait partie). Quand les deux verticaux sont produits
 * (`sorties`, sinon celles des entrées de la commande), le vertical ne sert plus que les Reels et stories, le vertical
 * « liens » TikTok et Shorts. Table et règle : `reseauxDeLaSortie` de `formats-sortie.ts` (les réseaux posés sur chaque
 * fichier par le tableau, T4, en viennent aussi).
 */
export function reseauDeLaSortie(sortie: IdSortie, c: Pick<CommandeFabrication, "reseaux" | "variante"> & { entrees?: CommandeFabrication["entrees"] }, sorties?: readonly IdSortie[]): ReseauFin {
  const servis = reseauxDeLaSortie(sortie, sorties ?? lireEntreesTableau(c.entrees).sorties ?? []);
  const prefere = reseauDuTableau(c);
  return servis.includes(prefere) ? prefere : servis[0];
}

/** Une fin utilisable sur ce réseau : validée, de son groupe, prévue pour lui, jamais la fin au mot sur TikTok ou Shorts, jamais un appel à commenter sur LinkedIn. */
function permise(f: FinTable, reseau: ReseauFin): boolean {
  if (!f.validee || f.groupe !== groupeDe(reseau)) return false;
  if (f.reseaux && !f.reseaux.includes(reseau)) return false;
  if (RESEAUX_SANS_APPEL_A_COMMENTER.includes(reseau) && estAppelACommenter(f)) return false;
  return !(RESEAUX_SANS_ENVOI.includes(reseau) && estFinAuMot(f));
}

/** Appels proposés par « Changer la fin » : les fins VALIDÉES et permises sur ce réseau. */
export function appelsValides(reseau: ReseauFin, table: readonly FinTable[] = TABLE_FINS): FinTable[] {
  return table.filter((f) => permise(f, reseau));
}

/**
 * La fin d'un autre groupe, rendue dans le groupe du réseau : même nature et même phrase à l'écran (la fin choisie à
 * l'écran de création sert à chaque sortie, chacune dans le groupe de réseaux qu'elle sert). Sinon : celle demandée.
 */
function finDuGroupe(fin: FinTable, reseau: ReseauFin, table: readonly FinTable[]): FinTable {
  const groupe = groupeDe(reseau);
  if (fin.groupe === groupe) return fin;
  return table.find((f) => f.groupe === groupe && f.type === fin.type && f.ecran === fin.ecran) ?? fin;
}

/**
 * Fin retenue pour `appelId` (absent : la première fin validée du groupe), avec le mot à commenter s'il y en a un.
 * TikTok et Shorts : la fin au mot est remplacée par la première fin validée permise sur le réseau ; s'il n'y en a
 * aucune, la vidéo se termine SANS appel (`FIN_SANS_APPEL_LIENS`). Jamais d'exception.
 */
export function finDuTableau(reseau: ReseauFin, appelId: string | null, table: readonly FinTable[] = TABLE_FINS, options: { mot?: string } = {}): FinRetenue {
  const choix = choixDuTableau(reseau, appelId, table, options);
  return "absente" in choix ? choix : { id: choix.id, ecran: choix.ecran };
}

function choixDuTableau(reseau: ReseauFin, appelId: string | null, table: readonly FinTable[], options: { mot?: string }): { id: string; ecran: string; dit: string } | { absente: string } {
  const sansEnvoi = RESEAUX_SANS_ENVOI.includes(reseau);
  const sansCommentaire = RESEAUX_SANS_APPEL_A_COMMENTER.includes(reseau);
  try {
    const demandee = appelId ? table.find((f) => f.id === appelId) : appelsValides(reseau, table)[0];
    let fin = demandee ? finDuGroupe(demandee, reseau, table) : undefined;
    // LinkedIn : un appel à commenter n'y est jamais dit (quel que soit le groupe de la fin demandée) ; aucun appel.
    if (sansCommentaire && fin && (estAppelACommenter(fin) || (demandee && estAppelACommenter(demandee)))) return { absente: `${APPEL_A_COMMENTER_LINKEDIN} ${FIN_SANS_APPEL_LINKEDIN}` };
    // TikTok, Shorts : une fin au mot (ou une fin qui n'y est pas permise) cède la place à la fin validée du réseau.
    if (sansEnvoi && (!fin || !permise(fin, reseau))) {
      // Fin au mot que la table laisserait passer (table changée) : refusée ici, et le rapport dit pourquoi.
      const refusee = !!fin && fin.validee && fin.groupe === groupeDe(reseau) && (!fin.reseaux || fin.reseaux.includes(reseau)) && estFinAuMot(fin);
      fin = appelsValides(reseau, table)[0];
      if (!fin) return { absente: refusee ? `${FIN_AU_MOT_REFUSEE} ${FIN_SANS_APPEL_LIENS}` : FIN_SANS_APPEL_LIENS };
    }
    if (!fin?.validee) return { absente: AUCUNE_FIN_VALIDEE };
    // Garde-fou final, même si la table change : jamais la fin au mot sur TikTok ni Shorts, ni sur LinkedIn.
    if (sansEnvoi && estFinAuMot(fin)) throw new ErreurFin(FIN_AU_MOT_REFUSEE);
    if (sansCommentaire && estAppelACommenter(fin)) throw new ErreurFin(APPEL_A_COMMENTER_LINKEDIN);
    const choisie = finPour(reseau, fin.id, options.mot ? { mot: options.mot } : {}, table);
    return { id: choisie.id, ecran: choisie.ecran, dit: choisie.dit };
  } catch (err) {
    const raison = err instanceof ErreurFin ? err.message : "Cette fin n'a pas pu être lue.";
    return { absente: sansEnvoi ? `${raison} ${FIN_SANS_APPEL_LIENS}` : sansCommentaire ? `${raison} ${FIN_SANS_APPEL_LINKEDIN}` : `${raison} La vidéo se termine sans écran de fin.` };
  }
}

/**
 * La même fin, avec sa nature, sa phrase dite (mot rempli) et le mot saisi (capitales) quand c'est un appel à commenter :
 * l'écran d'appel du style « blocs/2 » les montre (le mot se tape dans la bulle ; une fin « diagnostic » montre l'écran
 * « Appel de diagnostic ») ; la phrase dite sert à repérer l'appel dans la voix et à dire la fin propre d'une sortie.
 */
export function finEtAppelDuTableau(reseau: ReseauFin, appelId: string | null, table: readonly FinTable[] = TABLE_FINS, options: { mot?: string } = {}): FinRetenue {
  const fin = choixDuTableau(reseau, appelId, table, options);
  if ("absente" in fin) return fin;
  const type = table.find((f) => f.id === fin.id)?.type;
  const mot = type === "commentaire" && options.mot?.trim() ? { mot: options.mot.trim().toUpperCase() } : {};
  return { id: fin.id, ecran: fin.ecran, dit: fin.dit, ...(type ? { type } : {}), ...mot };
}

/**
 * La fin de chaque sortie, comme la fabrication la demande (`choisirFin` de la chaîne) : la MÊME pour la relecture de
 * l'écran de création et pour la fabrication (une seule vérité). `sorties` : les fichiers produits (sinon ceux des
 * entrées de la commande) ; `mot` : le mot à commenter saisi à la création.
 */
export function choisirFinTableau(c: Pick<CommandeFabrication, "reseaux" | "variante"> & { entrees?: CommandeFabrication["entrees"] }, options: { mot?: string; sorties?: readonly IdSortie[]; finLiens?: string } = {}): (appelId: string | null, sortie: IdSortie) => FinRetenue {
  // TikTok et Shorts, choix forcé par le réglage de la fiche (sinon le moteur choisit selon le type de la fiche).
  const forcee = estObjectifFinLiens(options.finLiens) ? choisirFinLiens({ etapes: false, mot: false, question: false, probleme: false }, { force: options.finLiens }) : null;
  const finForcee: FinRetenue | null = forcee && forcee.objectif === options.finLiens ? { id: forcee.code, ecran: forcee.ecran, dit: forcee.dit, type: forcee.type, objectif: forcee.objectif } : null;
  return (appelId, sortie) =>
    sortie === VERTICAL_LIENS && finForcee
      ? finForcee
      : finEtAppelDuTableau(reseauDeLaSortie(sortie, c, options.sorties), appelId, TABLE_FINS, options.mot ? { mot: options.mot } : {});
}
