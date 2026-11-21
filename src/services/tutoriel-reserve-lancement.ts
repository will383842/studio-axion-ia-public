/**
 * RES-3 · LANCEMENT SANS CLIC d'un élément de la réserve (ADAPTATEUR qui remplace `deposerTutoriel`, lequel exige une
 * session : le tirage tourne dans la minuterie ou sur appel de l'usine, sans cookie).
 *
 * ARGENT. Ce fichier ne décide d'aucune dépense : les conditions (plafond par vidéo, plafond du mois, autonomie de l'usine,
 * devis, interrupteurs) sont vérifiées par `tirerSuivantReserve` AVANT de l'appeler. Ici :
 *  - origine « usine » partout (`avecOrigineFournisseur`, `origine: "usine"` figée dans la commande) ;
 *  - SANS VOIX par défaut (`entreeModeVoix(MODE_SANS_VOIX)`) : aucune voix cherchée, aucun appel de voix ;
 *  - montant de lancement nul (format sans prix) : l'argent reste gardé par les plafonds Claude et le devis ;
 *  - la vidéo reste « à valider » : rien n'est publié, aucun créneau, aucun envoi.
 * Un échec abandonne le brouillon (archivé, jamais effacé).
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

export const ID_FORMAT_TUTORIEL_RESERVE = "tutoriel-outil";
export const RATIOS_RESERVE: readonly Ratio[] = ["4:5", "9:16", "1:1"];
export const PHRASE_DOUBLE_ABSENT = "Ajoutez votre double dans Personnages avant d'allumer la voix.";
export const PHRASE_PANNE_LANCEMENT = "Le lancement n'a pas pu se faire pour le moment : nouvel essai plus tard.";

const REFUS_ARGENT = /ACCORD|CONFIRMATION|PLAFOND|CREDIT|BUDGET|QUOTA|VERROU/;

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
  lancer?: (videoId: Id, options: { confirme: number; origine: "usine" }) => Promise<unknown>;
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

async function lancerParDefaut(videoId: Id, options: { confirme: number; origine: "usine" }): Promise<unknown> {
  const { lancerFabricationConfirmee } = await import("./fabrication");
  return lancerFabricationConfirmee(videoId, options);
}

/** `abandonnerBrouillon` exige une session : même geste sans elle (archivé, jamais effacé). */
async function abandonnerParDefaut(videoId: Id): Promise<void> {
  const v = await depots().videos.obtenir(videoId);
  if (v?.statut === "brouillon") await depots().videos.modifier(videoId, { statut: "archivee", statutAvantArchive: "brouillon" });
}

/**
 * Lance la fabrication de l'élément, sans session. Sans voix (sauf `voix` allumée par Williams) : la distribution est
 * facultative (le double, 1 personne au plus). Avec voix : le double est obligatoire (sinon refus DÉFINITIF).
 * Erreur d'entrée (ErreurStudio) : refus définitif ; autre panne : refus non définitif (nouvel essai plus tard).
 */
export async function lancerDepuisReserve(e: ElementReserve, o: { voix: boolean; fichierId?: string }, dep: DependancesLancementReserve = {}): Promise<IssueLancementReserve> {
  let distribution: Distribution[] = [];
  try {
    const trouvee = await (dep.distribution ?? distributionParDefaut)(ID_FORMAT_TUTORIEL_RESERVE);
    const avecPersonne = trouvee.filter((x) => !!x?.personnageId);
    if (o.voix) {
      if (avecPersonne.length === 0) return { statut: "refusee", phrase: PHRASE_DOUBLE_ABSENT, definitif: true };
      distribution = avecPersonne.slice(0, 1);
    } else {
      distribution = avecPersonne.slice(0, 1);
    }
  } catch (err) {
    if (o.voix) return { statut: "refusee", phrase: err instanceof ErreurStudio ? err.message : PHRASE_DOUBLE_ABSENT, definitif: err instanceof ErreurStudio };
    distribution = [];
  }

  const titre = e.titre.slice(0, 80);
  let videoId: Id | null = null;
  const abandonner = async () => {
    if (videoId) await (dep.abandonner ?? abandonnerParDefaut)(videoId).catch(() => undefined);
  };
  try {
    const video = await (dep.brouillon ?? brouillonParDefaut)({ formatId: ID_FORMAT_TUTORIEL_RESERVE, titre, sujet: titre, distribution, entrees: entreesDepuisReserve(e, o) });
    videoId = video.id;
    await (dep.script ?? scriptParDefaut)(video.id, typeof e.script === "string" ? e.script : "");
    await (dep.ratios ?? ratiosParDefaut)(video.id, [...RATIOS_RESERVE]);
    // ARGENT : origine « usine » figée, montant nul (format sans prix). Les dépenses Claude restent gardées par leur plafond propre.
    await avecOrigineFournisseur("usine", () => (dep.lancer ?? lancerParDefaut)(video.id, { confirme: 0, origine: "usine" }));
    return { statut: "lancee", videoId: video.id };
  } catch (err) {
    await abandonner();
    // Un refus d'argent (accord, plafond, crédit, budget) n'est pas une entrée refusée : l'élément pourra être retenté.
    if (err instanceof ErreurStudio) return { statut: "refusee", phrase: err.message, definitif: !REFUS_ARGENT.test(err.code) };
    return { statut: "refusee", phrase: PHRASE_PANNE_LANCEMENT, definitif: false };
  }
}
