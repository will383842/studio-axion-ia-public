/**
 * RES-3 · LANCEMENT SANS CLIC d'un élément de la réserve (ADAPTATEUR qui remplace `deposerTutoriel`, lequel exige une
 * session : le tirage tourne dans la minuterie ou sur appel de l'usine, sans cookie).
 *
 * ARGENT. Ce fichier ne décide d'aucune dépense : les conditions (plafond par vidéo, plafond du mois, autonomie de l'usine,
 * devis, interrupteurs) sont vérifiées par `tirerSuivantReserve` AVANT de l'appeler. Ici :
 *  - origine « usine » partout (`avecOrigineFournisseur`, origine figée dans la commande par la constante ORIGINE_RESERVE : le
 *    test de garde d'origine interdit d'écrire l'origine en dur sous la forme d'un champ littéral) ;
 *  - SANS VOIX par défaut (`entreeModeVoix(MODE_SANS_VOIX)`) : aucune voix cherchée, aucun appel de voix ;
 *  - montant de lancement nul (format sans prix) : l'argent reste gardé par les plafonds Claude et le devis ;
 *  - la vidéo reste « à valider » : rien n'est publié, aucun créneau, aucun envoi.
 * Un échec abandonne le brouillon (archivé, jamais effacé).
 * DOUBLE LANCEMENT : le numéro de la vidéo est noté sur l'élément (`noterBrouillon`) APRÈS la création du brouillon et AVANT le
 * lancement ; si la note ne tient pas, rien n'est lancé. Un élément « pris » porte donc toujours la vidéo qui pourrait être payée.
 */
import "server-only";
import type { Distribution, Id, Ratio, Script, Video } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { MODE_AVEC_VOIX, MODE_SANS_VOIX, entreeModeVoix } from "@/formats/tutoriel-outil/mode-sans-voix";
import { ENTREE_TUTORIEL, type DepotTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { nouvelId } from "@/lib/ids";
import type { ElementReserve } from "@/domaine/tutoriel-reserve";
import { depots, ErreurStudio, horodatage } from "./_commun";
import type { EntreeBrouillonFormat } from "./creation-format";
import { avecOrigineFournisseur } from "./plafond-fournisseur";
import type { OrigineLancement } from "./budget-mensuel";

export const ID_FORMAT_TUTORIEL_RESERVE = "tutoriel-outil";
export const RATIOS_RESERVE: readonly Ratio[] = ["4:5", "9:16", "1:1"];
export const PHRASE_DOUBLE_ABSENT = "Ajoutez votre double dans Personnages avant d'allumer la voix.";
export const PHRASE_PANNE_LANCEMENT = "Le lancement n'a pas pu se faire pour le moment : nouvel essai plus tard.";

/** « usine » : seul endroit de ce fichier ; passé comme valeur (jamais un champ littéral), comme les autres lanceurs. */
const ORIGINE_RESERVE: OrigineLancement = "usine";

/**
 * Codes d'erreur qui disent « cette entrée est invalide » : refus DÉFINITIF (l'élément passe à revoir). Tout le reste (plafond,
 * crédit, autonomie éteinte, vidéo déjà en fabrication, numéros de suivi épuisés, panne…) est passager : nouvel essai plus tard.
 */
const CODES_DEFINITIFS: ReadonlySet<string> = new Set(["SCRIPT_MANQUANT", "SCRIPT_NON_RELU", "FORMAT_INCONNU", "INTROUVABLE", "REGLAGES_INVALIDES", "CAS_TRAITE", "CAS_RETIRE", "DISTRIBUTION_INCOMPLETE"]);

export type IssueLancementReserve = { statut: "lancee"; videoId: string } | { statut: "refusee"; phrase: string; definitif: boolean };

export interface DependancesLancementReserve {
  /** Distribution par défaut (le double de Williams) ; par défaut `distributionParDefaut` (videos.ts). */
  distribution?: (formatId: string) => Promise<Distribution[]>;
  /** Brouillon SANS session ; par défaut `creerBrouillonFormatSansSession`. */
  brouillon?: (e: EntreeBrouillonFormat) => Promise<Pick<Video, "id">>;
  /** Script rattaché SANS session ; par défaut une copie de la branche « nouveau script » de `enregistrerScriptDuBrouillon`. */
  script?: (videoId: Id, texte: string) => Promise<void>;
  ratios?: (videoId: Id, ratios: Ratio[]) => Promise<void>;
  /** Lancement confirmé sans session ; par défaut `lancerFabricationConfirmee`. */
  lancer?: (videoId: Id, options: { confirme: number; origine: OrigineLancement }) => Promise<unknown>;
  /**
   * Note la vidéo sur l'élément pris, APRÈS le brouillon et AVANT le lancement. Doit lever si la note n'est pas relue à l'identique.
   * Absente : refus non définitif, rien n'est lancé (échec fermé).
   */
  noterBrouillon?: (videoId: Id) => Promise<void>;
  /** Un travail en file ou en cours existe pour cette vidéo ? Défaut : lecture des travaux (même règle que le lancement). */
  travailEnCours?: (videoId: Id) => Promise<boolean>;
  /** Abandon sans session (archivé si encore brouillon) ; par défaut `abandonnerSansSession`. */
  abandonner?: (videoId: Id) => Promise<void>;
}

/** Pur : les entrées `video.entrees`, même forme que `deposerTutoriel` (test de contrat). */
export function entreesDepuisReserve(e: ElementReserve, o: { voix: boolean; fichierId?: string }): Record<string, unknown> {
  const s = e.source;
  const depot: DepotTutoriel =
    s.type === "idee"
      ? { mode: "phrase", phrase: s.phrase }
      : s.type === "dossier"
        ? { mode: "dossier", fichierId: o.fichierId ?? s.fichierId, attestationImages: s.attestationImages === true }
        : { mode: "dossier", fichierId: o.fichierId ?? s.fichierId ?? "", attestationImages: false };
  const script = typeof e.script === "string" && e.script.trim() !== "" ? e.script : "";
  return {
    [ENTREE_TUTORIEL]: {
      depot,
      fin: e.fin,
      ...entreeModeVoix(o.voix ? MODE_AVEC_VOIX : MODE_SANS_VOIX),
      ...(script ? { scriptColle: true } : {}),
    },
  };
}

async function distributionParDefaut(formatId: string): Promise<Distribution[]> {
  const { distributionParDefaut: lire } = await import("./videos");
  return lire(formatId);
}

async function brouillonParDefaut(e: EntreeBrouillonFormat): Promise<Pick<Video, "id">> {
  const { creerBrouillonFormatSansSession } = await import("./creation-format");
  return creerBrouillonFormatSansSession(e);
}

/** Copie de la branche « nouveau script » de `enregistrerScriptDuBrouillon` (videos.ts), sans session : brouillon neuf seulement. */
async function scriptParDefaut(videoId: Id, texte: string): Promise<void> {
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const format = trouverFormat(v.formatId);
  if (!format) throw new ErreurStudio("FORMAT_INCONNU", "Ce format n'existe pas.");
  const script: Script = {
    id: nouvelId("script"),
    formatId: v.formatId,
    versionFormat: format.version,
    sujet: v.sujet || v.titre,
    dureeCibleSec: v.dureeCibleSec,
    adresse: v.adresse,
    version: 1,
    blocs: [{ id: `${videoId}-b1`, blocRecette: "corps", segments: [{ id: `${videoId}-s1`, texte }] }],
    favori: false,
    reference: false,
    statutEditorial: "brouillon",
    marqueId: v.marqueId,
    creePourVideoId: videoId,
    ...horodatage(),
  };
  await d.scripts.enregistrer(script);
  await d.videos.modifier(videoId, { scriptId: script.id });
}

async function ratiosParDefaut(videoId: Id, ratios: Ratio[]): Promise<void> {
  await depots().videos.modifier(videoId, { ratios });
}

async function lancerParDefaut(videoId: Id, options: { confirme: number; origine: OrigineLancement }): Promise<unknown> {
  const { lancerFabricationConfirmee } = await import("./fabrication");
  return lancerFabricationConfirmee(videoId, options);
}

/** Même règle que `lancerSousVerrou` (fabrication.ts) : un travail en file ou en cours pour cette vidéo. */
async function travailEnCoursParDefaut(videoId: Id): Promise<boolean> {
  return !!(await depots().travaux.trouver((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file")));
}

/** `abandonnerBrouillon` exige une session : même geste sans elle (archivé, jamais effacé). */
export async function abandonnerParDefaut(videoId: Id): Promise<void> {
  const v = await depots().videos.obtenir(videoId);
  if (v?.statut === "brouillon") await depots().videos.modifier(videoId, { statut: "archivee", statutAvantArchive: "brouillon" });
}

/**
 * Lance la fabrication de l'élément, sans session. Le double (1 personne) est obligatoire AVEC ou SANS voix, comme dans `deposerTutoriel`
 * (la garde de fabrication l'exige) : sinon refus DÉFINITIF. Erreur d'entrée (liste CODES_DEFINITIFS) : refus définitif ; tout le reste :
 * refus non définitif (nouvel essai plus tard).
 */
export async function lancerDepuisReserve(e: ElementReserve, o: { voix: boolean; fichierId?: string }, dep: DependancesLancementReserve = {}): Promise<IssueLancementReserve> {
  // Comme `deposerTutoriel` : la garde de fabrication exige encore UNE personne en sans-voix (format tutoriel-outil, personnages.min = 1,
  // `DISTRIBUTION_INCOMPLETE`). Personne de disponible : refus lisible, jamais un brouillon impossible à lancer.
  let distribution: Distribution[] = [];
  try {
    const trouvee = await (dep.distribution ?? distributionParDefaut)(ID_FORMAT_TUTORIEL_RESERVE);
    distribution = trouvee.filter((x) => !!x?.personnageId).slice(0, 1);
  } catch (err) {
    return { statut: "refusee", phrase: err instanceof ErreurStudio ? err.message : PHRASE_DOUBLE_ABSENT, definitif: err instanceof ErreurStudio };
  }
  if (distribution.length === 0) return { statut: "refusee", phrase: PHRASE_DOUBLE_ABSENT, definitif: true };

  const titre = e.titre.slice(0, 80);
  let videoId: Id | null = null;
  const abandonner = async () => {
    if (videoId) await (dep.abandonner ?? abandonnerParDefaut)(videoId).catch(() => undefined);
  };
  try {
    const video = await (dep.brouillon ?? brouillonParDefaut)({ formatId: ID_FORMAT_TUTORIEL_RESERVE, titre, sujet: titre, distribution, entrees: entreesDepuisReserve(e, o) });
    videoId = video.id;
    // ARGENT : la vidéo est notée sur l'élément AVANT tout lancement. Note impossible : brouillon abandonné, rien n'est lancé.
    try {
      await (dep.noterBrouillon ?? refuserSansNote)(video.id);
    } catch {
      await abandonner();
      return { statut: "refusee", phrase: PHRASE_PANNE_LANCEMENT, definitif: false };
    }
    await (dep.script ?? scriptParDefaut)(video.id, typeof e.script === "string" ? e.script : "");
    await (dep.ratios ?? ratiosParDefaut)(video.id, [...RATIOS_RESERVE]);
    // ARGENT : origine « usine » figée, montant nul (format sans prix). Les dépenses Claude restent gardées par leur plafond propre.
    await avecOrigineFournisseur(ORIGINE_RESERVE, () => (dep.lancer ?? lancerParDefaut)(video.id, { confirme: 0, origine: ORIGINE_RESERVE }));
    return { statut: "lancee", videoId: video.id };
  } catch (err) {
    // Le lancement a pu lever APRÈS la création du travail (ex. la file) : un travail en file ou en cours pour cette vidéo vaut
    // « lancée » (jamais abandonnée ni relancée : ce serait payer deux fois). Lecture impossible : même prudence (le suivi tranchera).
    if (videoId) {
      let enCours = true;
      try {
        enCours = await (dep.travailEnCours ?? travailEnCoursParDefaut)(videoId);
      } catch {
        enCours = true;
      }
      if (enCours) return { statut: "lancee", videoId };
    }
    await abandonner();
    // Seule une entrée invalide (liste explicite) est définitive ; tout le reste (argent, autonomie éteinte, panne) est passager.
    if (err instanceof ErreurStudio) return { statut: "refusee", phrase: err.message, definitif: CODES_DEFINITIFS.has(err.code) };
    return { statut: "refusee", phrase: PHRASE_PANNE_LANCEMENT, definitif: false };
  }
}

async function refuserSansNote(): Promise<void> {
  throw new Error("noterBrouillon absent");
}
