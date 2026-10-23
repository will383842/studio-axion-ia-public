/**
 * MONTAGE RÉEL DANS `studio-rendu` — brique commune « composition » (née au lot M4 ; plan B.7, B.9 ter). Une demande `composition` par format d'image (file
 * longue : un montage à la fois côté conteneur), suivie tour après tour par la boucle de fond, jamais attendue :
 *   soumise → (en file, en cours…) → faite (vidéo, master sans texte, vignette, mesures du fichier exporté).
 * Échec passager : nouvelle demande, 3 fois au plus ; 404 (conteneur redémarré) : même demande, même identifiant
 * (`suivreRendu`). Le même mécanisme sert à la fabrication, au format ajouté et au recalque des sous-titres.
 * PUR en dehors des appels au service de rendu et au stockage, tous deux injectés. La recette du format arrive par
 * les outils (`OutilsMontage.recette`).
 */
import type { AlerteQualite, CommandeFabrication, MotHorodate, RapportIntensite, Ratio, SegmentSousTitres } from "@/domaine/types";
import type { BruitagePlace } from "@/briques/intensite/types";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import { lireRenduGarde, type GardeRendu, type VeilleRendu } from "@/fournisseurs/rendu/garde";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import type { PlanProduit } from "@/moteurs/types";
import { controlesExport } from "./controles";
import { parametresComposition, type EntreeComposition } from "./parametres";
import type { RecetteComposition } from "./recette";
import type { ParametresDemandeComposition, RatioScene } from "./scene";

/** Ce qu'il faut pour composer (produit par la voix et le découpage, ou relu dans le projet de montage du parent). */
export interface BaseComposition {
  plans: PlanProduit[];
  segments: SegmentSousTitres[];
  dureeSec: number;
  mots?: MotHorodate[];
  audioCle?: string;
  pistesDouble?: Partial<Record<"trois-quarts" | "face" | "profil", string>>;
  /** Lot R7d : passages du second angle (un webm par passage). */
  tranchesDouble?: Partial<Record<"trois-quarts" | "face" | "profil", { cle: string; debutSec: number; finSec: number }[]>>;
  /** G6b : la piste du double est une vidéo opaque (prises filmées assemblées, décor compris). */
  pistesDepuisLook?: boolean;
  /** Lot R7e : avatar rendu sur un fond uni (pistes opaques). */
  doubleFondUni?: boolean;
  /** Recalque : master sans texte déjà fabriqué, par format d'image. */
  masters?: Partial<Record<Ratio, string>>;
  /** Lot « intensité · bruitages » (02/10) : sons posés et rapport du chef d'orchestre. */
  bruitages?: BruitagePlace[];
  rapportIntensite?: RapportIntensite;
  /**
   * Facecam lot E (ajout pur) : champs face caméra de l'entrée de la composition (piste pré-cadrée 10 bits, écrans
   * partagés, cartes plein écran, ligne des sous-titres, Look des B-roll), posés tels quels. Absent : rien ne change.
   */
  supplements?: Pick<EntreeComposition, "sourcePreCadree" | "source10bits" | "ecransPartages" | "positionSousTitresPct" | "cartesPleinEcran" | "lookBroll" | "echelleSousTitres" | "textesAffiches" | "controleCouleurs" | "instantsBords" | "passagesClairs">;
  /** Facecam lot G (ajout pur) : mises en page (côté, vignette), posées telles quelles. Absent : rien ne change. */
  supplementsMiseEnPage?: Pick<EntreeComposition, "misesEnPage">;
  /**
   * Mission H (ajout pur, tous les formats) : champs propres à UN format d'image (une carte motion est rendue à la
   * taille du ratio) et piste multicaméra (source du visage plan par plan). Absents : rien ne change.
   */
  supplementsParRatio?: Partial<Record<Ratio, Pick<EntreeComposition, "cartesPleinEcran" | "textesAffiches">>>;
  multicamera?: EntreeComposition["multicamera"];
}

/** Mode d'une composition : tout, le texte seul (recalque), ou le son puis le texte (remixage des bruitages). */
export type ModeComposition = "complet" | "recalque" | "remixage";

export type EtatComposition =
  | {
      phase: "soumise";
      demande: DemandeRendu;
      essai?: number;
      progression: number;
      alertes: AlerteQualite[];
      /**
       * ESSAI RÉEL n° 1 (04/10) : série d'essais en cours (1 par défaut) et numéro d'essai où elle a commencé. Après
       * ESSAIS échecs passagers d'une série, on attend `relanceApres` puis une NOUVELLE demande part (avant : le même
       * échec, gardé en mémoire par studio-rendu, était relu sans fin et la vidéo restait bloquée).
       */
      serie?: number;
      debutSerie?: number;
      relanceApres?: string;
      /** Délai de garde (`OutilsMontage.garde`) : dernier état lu et depuis quand. */
      veille?: VeilleRendu;
      /** Nouvelles demandes déjà faites par le délai de garde (une au plus, puis échec définitif). */
      relancesGarde?: number;
    }
  | { phase: "faite"; sortieCle: string; masterCle?: string; vignetteCle: string; mesures?: Record<string, number>; alertes: AlerteQualite[] };

export type EtatMontage = Partial<Record<Ratio, EtatComposition>>;

export interface OutilsMontage {
  rendu: () => ServiceRendu;
  /** Adresses signées : lecture des entrées (nom → clé) et dépôts des sorties (clé → type). */
  signer: (lectures: Record<string, string>, depots: { cle: string; mime: string }[]) => Promise<{ lectures: Record<string, string>; depots: Record<string, string> }>;
  /** Clé de stockage d'une sortie de la vidéo. */
  cle: (c: CommandeFabrication, nom: string) => string;
  /** Recette de composition du format (ce que la brique ne sait pas d'elle-même). */
  recette: RecetteComposition;
  /**
   * Séries d'essais au plus quand l'échec est `fichier-inaccessible` (une entrée absente du stockage ne revient pas en
   * attendant). Absent : `SERIES_COMPOSITION`, comme toute autre erreur passagère (formats qui ne le posent pas : inchangés).
   */
  seriesFichierInaccessible?: number;
  /**
   * Délai de garde à la lecture (incident du 12/10, `fournisseurs/rendu/garde.ts`) : une composition en cours figée ou
   * inconnue du serveur est soumise UNE fois de plus sous un autre identifiant, puis l'échec est définitif. Absent :
   * inchangé (reprise sous le même identifiant après un 404).
   */
  garde?: GardeRendu;
}

const ESSAIS = 3;
/** Attente entre deux séries d'essais d'une composition (échec passager : fichier absent, conteneur occupé…). */
export const ATTENTE_SERIE_COMPOSITION_MS = 10 * 60_000;
/** Séries au plus (≈ 1 h de reprises) avant l'échec définitif, montré à Will. */
export const SERIES_COMPOSITION = 6;
const nomRatio = (r: Ratio) => r.replace(":", "x");

/** Demande de composition d'un format d'image (complet ou recalque). */
export async function demandeComposition(c: CommandeFabrication, ratio: Ratio, base: BaseComposition, mode: ModeComposition, idBase: string, outils: OutilsMontage, essai = 0): Promise<{ demande: DemandeRendu; alertes: AlerteQualite[] }> {
  const r = ratio as RatioScene;
  const p = parametresComposition(c, { ratio: r, plans: base.plans, segments: base.segments, dureeSec: base.dureeSec, mots: base.mots, audioCle: base.audioCle, pistesDouble: base.pistesDouble, ...(base.tranchesDouble ? { tranchesDouble: base.tranchesDouble } : {}), ...(base.pistesDepuisLook ? { pistesDepuisLook: true } : {}), ...(base.doubleFondUni ? { doubleFondUni: true } : {}), ...(base.bruitages?.length ? { bruitages: base.bruitages } : {}), ...(base.supplements ?? {}), ...(base.supplementsMiseEnPage ?? {}), ...(base.supplementsParRatio?.[ratio] ?? {}), ...(base.multicamera ? { multicamera: base.multicamera } : {}) }, outils.recette);
  const suffixe = `${idBase}-${nomRatio(ratio)}`;
  const sortieCle = outils.cle(c, `${suffixe}.mp4`);
  const vignetteCle = outils.cle(c, `${suffixe}.jpg`);
  const masterCle = outils.cle(c, `${suffixe}-master-sans-texte.mov`);
  let parametres: ParametresDemandeComposition;
  let lectures: Record<string, string>;
  let depots: { cle: string; mime: string }[];
  if (mode === "complet") {
    lectures = p.entrees;
    depots = [
      { cle: sortieCle, mime: "video/mp4" },
      { cle: masterCle, mime: "video/quicktime" },
      { cle: vignetteCle, mime: "image/jpeg" },
    ];
  } else {
    const master = base.masters?.[ratio];
    if (!master) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Aucune image sans texte pour le format ${ratio} : il faut refaire ce format.` });
    // Remixage (lot « bruitages ») : le son est refait, donc la voix, le ton de pièce et les bruitages sont lus aussi.
    const sons = mode === "remixage" ? Object.fromEntries(Object.entries(p.entrees).filter(([nom]) => nom === "voix" || nom === "ton-piece" || nom.startsWith("bruitage-"))) : {};
    lectures = { master, ...sons, ...Object.fromEntries(Object.entries(p.entrees).filter(([nom]) => nom.startsWith("objet-"))) };
    depots = [
      { cle: sortieCle, mime: "video/mp4" },
      { cle: vignetteCle, mime: "image/jpeg" },
      ...(mode === "remixage" ? [{ cle: masterCle, mime: "video/quicktime" }] : []),
    ];
  }
  const signees = await outils.signer(lectures, depots);
  if (mode === "complet") {
    parametres = { mode, ratio: r, dureeSec: base.dureeSec, image: p.image, texte: p.texte, couleurs: p.couleurs, son: p.son, export: p.export, depots: { master: { urlDepot: signees.depots[masterCle], cle: masterCle }, vignette: { urlDepot: signees.depots[vignetteCle], cle: vignetteCle } }, ...(p.controleCouleurs ? { controleCouleurs: p.controleCouleurs } : {}) };
  } else {
    parametres = {
      mode: "recalque",
      ratio: r,
      dureeSec: base.dureeSec,
      texte: p.texte,
      export: p.export,
      son: { lufs: p.son.lufs, toleranceLufs: p.son.toleranceLufs, creteVraieMaxDbtp: p.son.creteVraieMaxDbtp, pauses: p.son.pauses },
      depots: { vignette: { urlDepot: signees.depots[vignetteCle], cle: vignetteCle }, ...(mode === "remixage" ? { master: { urlDepot: signees.depots[masterCle], cle: masterCle } } : {}) },
      ...(mode === "remixage" ? { remixage: { son: p.son } } : {}),
    };
  }
  const demande: DemandeRendu = {
    idRendu: `${suffixe}-${mode === "complet" ? "compo" : mode}${essai ? `-e${essai}` : ""}`,
    operation: "composition",
    file: "longue",
    entrees: signees.lectures,
    sortie: { urlDepot: signees.depots[sortieCle], cle: sortieCle },
    parametres: parametres as unknown as Record<string, unknown>,
  };
  return { demande, alertes: p.alertes };
}

/** Clé du master et de la vignette d'une demande (lus dans ses paramètres). */
function clesDe(d: DemandeRendu): { masterCle?: string; vignetteCle: string } {
  const p = d.parametres as unknown as ParametresDemandeComposition;
  return { masterCle: p.mode === "complet" ? p.depots.master.cle : p.depots.master?.cle, vignetteCle: p.depots.vignette.cle };
}

/** Fait avancer les compositions d'UN tour (soumission, suivi, reprise). Lève une `ErreurRendu` définitive. */
export async function avancerCompositions(etat: EtatMontage, c: CommandeFabrication, ratios: Ratio[], base: BaseComposition, mode: ModeComposition, idBase: string, outils: OutilsMontage): Promise<EtatMontage> {
  const suite: EtatMontage = { ...etat };
  for (const ratio of ratios) {
    const e = suite[ratio];
    if (!e) {
      const { demande, alertes } = await demandeComposition(c, ratio, base, mode, idBase, outils);
      await outils.rendu().soumettre(demande);
      suite[ratio] = { phase: "soumise", demande, progression: 0, alertes };
      continue;
    }
    if (e.phase === "faite") continue;
    if (e.relanceApres) {
      // Attente entre deux séries : l'ancien échec n'est plus relu ; à l'heure dite, une nouvelle demande part.
      if (Date.now() < Date.parse(e.relanceApres)) continue;
      const essai = (e.essai ?? 0) + 1;
      const { demande } = await demandeComposition(c, ratio, base, mode, idBase, outils, essai);
      await outils.rendu().soumettre(demande);
      suite[ratio] = { ...e, demande, essai, progression: 0, relanceApres: undefined };
      continue;
    }
    const lu = outils.garde ? await lireRenduGarde(outils.rendu(), e.demande, e.veille, outils.garde) : null;
    if (lu?.sansNouvelle && lu.etat.statut === "echec") {
      // Rendu figé ou oublié par le serveur : une nouvelle demande (autre identifiant), une seule fois.
      if ((e.relancesGarde ?? 0) >= 1) throw new ErreurRendu({ ...lu.etat.erreur, reessayable: false });
      const essai = (e.essai ?? 0) + 1;
      const { demande } = await demandeComposition(c, ratio, base, mode, idBase, outils, essai);
      await outils.rendu().soumettre(demande);
      suite[ratio] = { ...e, demande, essai, progression: 0, relancesGarde: (e.relancesGarde ?? 0) + 1, veille: undefined };
      continue;
    }
    if (lu?.veille) suite[ratio] = { ...e, veille: lu.veille };
    const s = lu ? lu.etat : await suivreRendu(outils.rendu(), e.demande);
    if (s.statut === "echec") {
      const essai = (e.essai ?? 0) + 1;
      if (!s.erreur.reessayable) throw new ErreurRendu(s.erreur);
      if (essai - (e.debutSerie ?? 0) > ESSAIS) {
        // Série épuisée : on n'insiste pas tout de suite (et on ne relit plus cet échec) ; nouvelle série plus tard.
        const serie = (e.serie ?? 1) + 1;
        // Échec DÉFINITIF : non réessayable, sinon la reprise du travail relirait ce même échec pendant 24 h.
        const plafond = s.erreur.code === "fichier-inaccessible" && outils.seriesFichierInaccessible ? outils.seriesFichierInaccessible : SERIES_COMPOSITION;
        if (serie > plafond) throw new ErreurRendu({ ...s.erreur, reessayable: false });
        suite[ratio] = { ...e, serie, debutSerie: e.essai ?? 0, relanceApres: new Date(Date.now() + ATTENTE_SERIE_COMPOSITION_MS).toISOString(), progression: 0 };
        continue;
      }
      const { demande } = await demandeComposition(c, ratio, base, mode, idBase, outils, essai);
      await outils.rendu().soumettre(demande);
      suite[ratio] = { ...e, demande, essai, progression: 0 };
    } else if (s.statut === "en_cours") suite[ratio] = { ...e, progression: s.progression, ...(lu?.veille ? { veille: lu.veille } : {}) };
    else if (s.statut === "termine") {
      const p = e.demande.parametres as unknown as ParametresDemandeComposition;
      const cles = clesDe(e.demande);
      suite[ratio] = { phase: "faite", sortieCle: s.sortieCle, masterCle: cles.masterCle, vignetteCle: cles.vignetteCle, mesures: s.mesures, alertes: [...e.alertes, ...controlesExport(s.mesures, p.son, p.export)] };
    }
  }
  return suite;
}

/** Progression d'ensemble (0-100) des compositions. */
export function progressionMontage(etat: EtatMontage, ratios: Ratio[]): number {
  if (!ratios.length) return 100;
  return ratios.reduce((s, r) => s + (etat[r]?.phase === "faite" ? 100 : (etat[r] as { progression?: number } | undefined)?.progression ?? 0), 0) / ratios.length;
}

/** Toutes les compositions sont faites. */
export function montageFini(etat: EtatMontage, ratios: Ratio[]): boolean {
  return ratios.every((r) => etat[r]?.phase === "faite");
}

/**
 * Avancement des étapes vues par Will pendant la composition (une seule opération côté conteneur) :
 * son 3-8 %, montage 8-45 %, couleurs 45-55 %, formats d'image (texte et export) 55-100 %.
 */
export const PLAGES_ETAPES: Record<string, [number, number]> = { son: [3, 8], montage: [8, 45], etalonnage: [45, 55], export: [55, 100] };

export function avancementEtape(cle: string, progression: number): number {
  const plage = PLAGES_ETAPES[cle];
  if (!plage) return 0;
  return Math.round(Math.min(100, Math.max(0, ((progression - plage[0]) / (plage[1] - plage[0])) * 100)));
}
