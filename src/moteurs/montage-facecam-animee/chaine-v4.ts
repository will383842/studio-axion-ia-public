/**
 * CHAÎNE DE PRODUCTION du face caméra animé v4 (Lot I, 17/10/2026) — machine à états PURE, outils injectés.
 *
 *   prise déposée par Will → transcription horodatée (conteneur `studio-aligneur`, celle du studio) → coupes des silences (`calculerCoupes`,
 *   recalées sur 30 i/s) → réalisateur (Claude Opus, consigne v4, `verifierPlan`, 3 essais ; repli : plan v4 minimal) → rendu de la composition
 *   `InterfaceClaireFaceCameraV4` par le service de rendu (opération `composition`, mode `facecam-v4`) → vidéo finale rangée dans le studio.
 *
 * Chaque `avancerChaineV4` fait UN pas et rend le nouvel état (sérialisable, gardé dans le travail) : un « Réessayer » ne refait que l'étape
 * arrêtée. Un outil qui attend un travail extérieur (transcription, rendu) lève `EnCoursChaineV4` : le pas sera refait au passage suivant
 * de la boucle (les travaux extérieurs sont repris par leur identifiant, jamais relancés en double).
 * PRISE HORIZONTALE (essai réel du 17/10 : IMG_7747 filmée en 3840 × 2160 à l'iPhone) : à l'étape des coupes, le visage est repéré
 * (route `visages` du conteneur, `outils.reperer`) et la prise est recadrée en vertical par le service de rendu : colonne 9:16 de TOUTE la
 * hauteur, centrée sur le visage, FIXE (aucun zoom en plus, aucun mouvement de cadrage), ramenée à 1080 × 1920 (`recadrageVerticalV4`).
 * Visage introuvable : colonne centrée. Une prise verticale n'est jamais touchée.
 * Aucune musique, jamais : le plan v4 n'a pas de piste de sons (les plaquettes jouent leurs bruitages) et le service de rendu refuse un plan
 * qui en porterait.
 */
import { appliquerRecalages, calculerCoupes, motsDuMontage, versPrise } from "@/briques/coupes";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { DUREE_MIN_SEC } from "@/domaine/facecam-parcours";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { MotHorodate } from "@/domaine/types";
import { MENTION_PLAFOND_FACECAM_ANIMEE } from "./index";
import { PHRASE_REALISATEUR_PANNE, realiser, type DependancesRealisateur, type EntreeRealisateur, type HistoriqueVideo, type MotTranscrit } from "./realisateur";
import { controlerDiversiteV4, estRendableV4 } from "./realisateur/regles-v4";
import { plaquettesSansVideo, retirerPlaquettesSansVideo, type PlaquetteRetireeV4 } from "./videos-v4";
import { ESSAIS_REPLI_SANS_VIDEO_V4, IDS_PLAQUETTES_A_VIDEO_V4, elementsPourRepliV4, erreursRepliV4, nomsRetireesV4, phraseRepliEchecV4, phraseRepliOkV4 } from "./repli-sans-video-v4";

export const VERSION_CHAINE_V4 = "chaine-facecam-v4/1";
/** Nom de la prise montée dans le dossier servi par le service de rendu (`studio-rendu/src/operations/facecam-v4.ts`). */
export const PRISE_MONTEE_V4 = "prise-montee.mp4";
/** Cadence du rendu v4 : les intervalles gardés sont recalés sur cette grille. */
const GRILLE_V4 = 30;

export type EtapeChaineV4 = "transcription" | "coupes" | "mise-en-scene" | "videos" | "rendu" | "prete";
export const ETAPES_CHAINE_V4: readonly EtapeChaineV4[] = Object.freeze(["transcription", "coupes", "mise-en-scene", "videos", "rendu", "prete"]);

/** Un fichier de vidéo d'illustration préparé par le studio : `nom` dans le dossier servi au rendu, `cle` de stockage. */
export interface FichierVideoV4 {
  nom: string;
  cle: string;
}

/** D'où vient une vidéo d'illustration (preuve de licence et de contrôle, pour le rapport). */
export interface ChoixVideoV4 {
  fichier: string;
  source: string;
  id: string;
  page?: string;
  auteur?: string;
  licence?: string;
  scene: string;
  verdict?: string;
}

export interface GardeV4 {
  debutSec: number;
  finSec: number;
}

export interface DemandeChaineV4 {
  videoId: string;
  versionId: string;
  /** Clé de stockage de la prise BRUTE déposée par Will. */
  priseCle: string;
  titre?: string;
  /** Texte que Will a dit (facultatif) : coupes en mode « texte » et orthographe des sous-titres. */
  texteValide?: string;
}

export interface EtatChaineV4 {
  version: typeof VERSION_CHAINE_V4;
  etape: EtapeChaineV4;
  demande: DemandeChaineV4;
  /** `largeur` / `hauteur` : la prise après rotation (absentes : inconnues, prise traitée comme verticale). */
  transcription?: { mots: MotHorodate[]; dureeSec: number; largeur?: number; hauteur?: number };
  /** Prise horizontale : colonne 9:16 gardée (pixels de la prise) et visage dans cette colonne (fractions). */
  cadrage?: RecadrageV4;
  coupes?: { gardes: GardeV4[]; dureeSec: number; mots: MotTranscrit[] };
  realisation?: { version: "complete" | "simple"; essais: number; erreurs?: string[]; avertissements: number; phrase?: string; plan: PlanFacecamAnimee };
  /**
   * Étape « videos » (18/10) : fichiers préparés pour les plaquettes à vidéo, plaquettes RETIRÉES faute de vidéo littérale, manques,
   * dépense Claude du contrôle visuel (dollars) et résultat des contrôles du plan APRÈS retrait (rapport : rien n'est assoupli).
   * Absent des anciens états (un état à « rendu » sans ce champ relit son plan : s'il manque des vidéos, retour à « videos »).
   */
  videos?: { fichiers: FichierVideoV4[]; choix?: ChoixVideoV4[]; retirees: PlaquetteRetireeV4[]; manques: string[]; depenseUsd?: number; controle?: { rendable: boolean; erreurs: string[] } };
  /**
   * Repli « sans vidéo » (19/10) : aucune vidéo fidèle ET plan hors règles sans elles → UNE fois, retour à la mise en scène, plaquettes à vidéo interdites
   * (`repli-sans-video-v4.ts`). `fait` : le repli a réussi (pas de second repli) ; `essais` : appels Claude du repli.
   */
  repliSansVideo?: { retirees: PlaquetteRetireeV4[]; manques: string[]; elementsPrecedents: ElementV4Plan[]; fait?: boolean; essais?: number };
  rendu?: { cle: string; vignetteCle: string; dureeSec: number; taille: number };
}

export interface OutilsChaineV4 {
  /** Transcription horodatée au mot de la prise brute (temps de la prise). Lève `EnCoursChaineV4` tant qu'elle n'est pas finie. */
  transcrire(d: { priseCle: string; appelId: string }): Promise<{ mots: MotHorodate[]; dureeSec: number; largeurSource?: number; hauteurSource?: number }>;
  /**
   * Prise horizontale : visage repéré sur la prise entière (fractions de la prise ; `null` : introuvable). Lève `EnCoursChaineV4` tant que
   * le repérage tourne. Absent : colonne centrée.
   */
  reperer?(d: { priseCle: string; appelId: string }): Promise<{ centreX: number; yeux?: number; largeurVisage?: number } | null>;
  /** Plafond Claude du mois atteint : version simple sans appel. */
  plafondClaudeAtteint(): Promise<boolean>;
  /** UN appel Claude Opus (rôle réalisateur) ; absent : version simple. */
  appelerRealisateur?: DependancesRealisateur["appeler"];
  /** Les 5 dernières vidéos v4 (variété d'une vidéo à l'autre). */
  historique?(): Promise<HistoriqueVideo[]>;
  /**
   * Vidéos d'illustration des plaquettes qui en exigent (AvantApres, MosaiqueVideos, duel-video) : cherche, contrôle (littéral) et prépare
   * une vidéo par `recherche`, rend le plan avec ses `medias` remplis, les fichiers préparés et les manques. Lève `EnCoursChaineV4` si
   * un travail extérieur tourne. Absent : les plaquettes à vidéo sont retirées du plan. Les plaquettes encore sans vidéo au retour sont retirées.
   */
  videos?(d: { videoId: string; plan: PlanFacecamAnimee; mots: MotTranscrit[] }): Promise<{ plan: PlanFacecamAnimee; fichiers: FichierVideoV4[]; manques: string[]; depenseUsd?: number; choix?: ChoixVideoV4[] }>;
  /** Rendu de la vidéo par le service de rendu (lève `EnCoursChaineV4` tant qu'il tourne). `videos` : fichiers d'illustration à envoyer avec la demande. */
  rendre(d: { idRendu: string; priseCle: string; plan: PlanFacecamAnimee; gardes: GardeV4[]; recadrage?: RecadrageV4; videos?: FichierVideoV4[] }): Promise<{ cle: string; vignetteCle: string; dureeSec: number; taille: number }>;
}

/** Un travail extérieur tourne encore : rien n'a changé, le même pas sera refait au passage suivant. */
export class EnCoursChaineV4 extends Error {
  constructor(public readonly quoi: string) {
    super(`${quoi} est en cours.`);
    this.name = "EnCoursChaineV4";
  }
}

/** Arrêt de la chaîne avec une phrase pour Will (réessayable ou non). */
export class ErreurChaineV4 extends Error {
  /** `etat` : état à GARDER dans le travail malgré l'arrêt (diagnostic ; la reprise repart de cet état). */
  constructor(message: string, public readonly reessayable: boolean, public readonly detail?: string, public readonly etat?: EtatChaineV4) {
    super(message);
    this.name = "ErreurChaineV4";
  }
}

export function etatInitialV4(demande: DemandeChaineV4): EtatChaineV4 {
  return { version: VERSION_CHAINE_V4, etape: "transcription", demande };
}

export function lireEtatV4(x: unknown): EtatChaineV4 | null {
  const e = x as EtatChaineV4 | undefined;
  return e && typeof e === "object" && e.version === VERSION_CHAINE_V4 && ETAPES_CHAINE_V4.includes(e.etape) ? e : null;
}

const r3 = (x: number) => +x.toFixed(3);

/** Taille de la vidéo v4 (verticale). */
export const SORTIE_V4 = Object.freeze({ largeur: 1080, hauteur: 1920 });

/** Colonne 9:16 gardée d'une prise horizontale (pixels de la prise, après rotation) et visage dans cette colonne (fractions). */
export interface RecadrageV4 {
  x: number;
  largeur: number;
  hauteur: number;
  /** Visage repéré (sinon colonne centrée). */
  visage: boolean;
  centreX: number;
  yeux?: number;
  largeurVisage?: number;
}

/** La prise est-elle horizontale (plus large que haute) ? PUR. */
export function priseHorizontale(t: { largeur?: number; hauteur?: number } | undefined): boolean {
  return !!t?.largeur && !!t.hauteur && t.largeur > t.hauteur;
}

/**
 * Recadrage vertical d'une prise horizontale : colonne 9:16 de TOUTE la hauteur (aucun zoom en plus : l'image est seulement ramenée à
 * 1080 × 1920), centrée sur le visage, bornée aux bords, coordonnées paires (YUV 4:2:0). FIXE : un seul cadre pour toute la vidéo. PUR.
 */
export function recadrageVerticalV4(prise: { largeur: number; hauteur: number }, visage: { centreX: number; yeux?: number; largeurVisage?: number } | null): RecadrageV4 {
  const hauteur = prise.hauteur - (prise.hauteur % 2);
  const largeur = Math.min(prise.largeur - (prise.largeur % 2), Math.round((hauteur * 9) / 16 / 2) * 2);
  const centre = visage && Number.isFinite(visage.centreX) ? Math.min(1, Math.max(0, visage.centreX)) : 0.5;
  let x = Math.round(centre * prise.largeur - largeur / 2);
  x = Math.max(0, Math.min(prise.largeur - largeur, x));
  x -= x % 2;
  const bornes = (v: number, min: number, max: number) => +Math.min(max, Math.max(min, v)).toFixed(4);
  return {
    x,
    largeur,
    hauteur,
    visage: !!visage,
    // Le visage dans la colonne (fractions de la colonne) : les plaquettes et les sous-titres l'évitent.
    centreX: bornes((centre * prise.largeur - x) / largeur, 0.1, 0.9),
    ...(visage?.yeux !== undefined ? { yeux: bornes(visage.yeux, 0.1, 0.7) } : {}),
    ...(visage?.largeurVisage !== undefined ? { largeurVisage: bornes((visage.largeurVisage * prise.largeur) / largeur, 0.15, 0.7) } : {}),
  };
}

/**
 * COUPES DE LA PRISE pour le rendu v4 (même calcul que la répétition générale validée, `outils/facecam-animee-v4/preparer-prise.ts`) :
 * `calculerCoupes` (silences, reprises, consignes) → intervalles gardés recalés sur la grille de 30 i/s → mots de la vidéo MONTÉE sur ces
 * intervalles (avec l'orthographe du texte dit quand Will l'a donné). PUR.
 */
export function couperPriseV4(e: { mots: MotHorodate[]; dureeSec: number; texteValide?: string }): { gardes: GardeV4[]; dureeSec: number; mots: MotTranscrit[] } {
  const texteValide = e.texteValide?.trim() || undefined;
  const plan = calculerCoupes({ mots: e.mots, dureeSec: e.dureeSec, ...(texteValide ? { texteValide } : {}) });
  const mots = appliquerRecalages(e.mots, plan.recalages);
  const gardes = plan.gardes.map((g) => ({ debutSec: Math.round(g.debutSec * GRILLE_V4) / GRILLE_V4, finSec: Math.round(g.finSec * GRILLE_V4) / GRILLE_V4, debutOrigine: g.debutSec, finOrigine: g.finSec })).filter((g) => g.finSec > g.debutSec);
  const debuts: number[] = [];
  let cumul = 0;
  for (const g of gardes) {
    debuts.push(cumul);
    cumul += g.finSec - g.debutSec;
  }
  /** Instant de la prise brute → ligne de temps montée à 30 i/s (null : hors des intervalles gardés). */
  const versMontee = (t: number, milieu: number) => {
    const k = gardes.findIndex((g) => milieu >= g.debutOrigine && milieu <= g.finOrigine);
    if (k < 0) return null;
    const g = gardes[k];
    return r3(debuts[k] + Math.min(Math.max(t, g.debutOrigine), g.finOrigine) - g.debutOrigine);
  };
  const enMontee = (m: { mot: string; debutSec: number; finSec: number }): MotTranscrit | null => {
    const milieu = (m.debutSec + m.finSec) / 2;
    const a = versMontee(m.debutSec, milieu);
    const f = versMontee(m.finSec, milieu);
    return a === null || f === null ? null : { w: m.mot, a, f: Math.max(f, r3(a + 0.04)) };
  };
  let montes = mots.map(enMontee).filter((x): x is MotTranscrit => x !== null);
  const phrases = plan.phrases.filter((p) => p.debutSec !== undefined).map((p) => p.texte);
  if (texteValide && phrases.length) {
    // Orthographe du texte dit posée sur les instants de la voix (chaîne réelle du studio), puis ramenée sur la grille de 30 i/s.
    const motsTexte = horodaterMotsPrononces(phrases.join(" ").split(/\s+/).filter(Boolean), motsDuMontage(mots, plan.gardes));
    const avecTexte = motsTexte
      .map((m) => {
        const brut = versPrise(m.debutSec, plan.gardes);
        return enMontee({ mot: m.mot, debutSec: brut, finSec: Math.max(versPrise(m.finSec, plan.gardes), brut + 0.04) });
      })
      .filter((x): x is MotTranscrit => x !== null);
    if (avecTexte.length) montes = avecTexte;
  }
  return { gardes: gardes.map((g) => ({ debutSec: g.debutSec, finSec: g.finSec })), dureeSec: r3(cumul), mots: montes };
}

/** Entrée du réalisateur pour la prise montée (sans écran de fin : la v4 se termine sur la dernière plaquette). PUR. */
export function entreeRealisateurV4(etat: Pick<EtatChaineV4, "demande" | "coupes" | "cadrage">, options: { plafondAtteint?: boolean; historique?: HistoriqueVideo[] } = {}): EntreeRealisateur {
  const c = etat.coupes;
  if (!c) throw new ErreurChaineV4("Les coupes de la prise manquent : réessayez.", true);
  return {
    mots: c.mots,
    dureeSec: c.dureeSec,
    ...(etat.demande.titre ? { titre: etat.demande.titre } : {}),
    ...(etat.demande.videoId ? { videoId: etat.demande.videoId } : {}),
    ...(options.historique?.length ? { historique: options.historique } : {}),
    ...(options.plafondAtteint ? { plafondAtteint: true } : {}),
    prise: {
      src: PRISE_MONTEE_V4,
      finSec: c.dureeSec,
      // Prise recadrée sur le visage : sa position dans la colonne gardée (une prise verticale garde les valeurs par défaut, comme avant).
      ...(etat.cadrage?.visage ? { centreX: etat.cadrage.centreX, ...(etat.cadrage.yeux !== undefined ? { yeux: etat.cadrage.yeux } : {}), ...(etat.cadrage.largeurVisage !== undefined ? { largeurVisage: etat.cadrage.largeurVisage } : {}) } : {}),
    },
    fin: { debut: c.dureeSec, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
  };
}

/** Prise trop courte ou muette : aucune vidéo (phrase pour Will). */

/** UN pas de la chaîne. */
export async function avancerChaineV4(etat: EtatChaineV4, outils: OutilsChaineV4): Promise<EtatChaineV4> {
  switch (etat.etape) {
    case "transcription": {
      const t = await outils.transcrire({ priseCle: etat.demande.priseCle, appelId: `fa4-mots-${etat.demande.versionId}` });
      if (!t.mots.length) throw new ErreurChaineV4("Je n'entends aucun mot dans cette vidéo : vérifiez le son de la prise, puis déposez-la à nouveau.", false);
      const dims = t.largeurSource && t.hauteurSource ? { largeur: t.largeurSource, hauteur: t.hauteurSource } : {};
      return { ...etat, etape: "coupes", transcription: { mots: t.mots, dureeSec: t.dureeSec, ...dims } };
    }
    case "coupes": {
      const t = etat.transcription;
      if (!t) return { ...etat, etape: "transcription" };
      const coupes = couperPriseV4({ mots: t.mots, dureeSec: t.dureeSec, texteValide: etat.demande.texteValide });
      if (coupes.dureeSec < DUREE_MIN_SEC || !coupes.mots.length) throw new ErreurChaineV4("Après les coupes, il reste moins de 5 secondes de parole : la vidéo est trop courte pour être animée.", false);
      // Prise horizontale : cadre vertical fixe sur le visage (repérage extérieur repris au passage suivant tant qu'il tourne).
      let cadrage = etat.cadrage;
      if (!cadrage && priseHorizontale(t)) {
        let visage: Awaited<ReturnType<NonNullable<OutilsChaineV4["reperer"]>>> = null;
        if (outils.reperer) {
          try {
            visage = await outils.reperer({ priseCle: etat.demande.priseCle, appelId: `fa4-visage-${etat.demande.versionId}` });
          } catch (e) {
            if (e instanceof EnCoursChaineV4) throw e;
            visage = null; // repérage raté : colonne centrée (la vidéo est quand même fabriquée)
          }
        }
        cadrage = recadrageVerticalV4({ largeur: t.largeur as number, hauteur: t.hauteur as number }, visage);
      }
      return { ...etat, etape: "mise-en-scene", coupes, ...(cadrage ? { cadrage } : {}) };
    }
    case "mise-en-scene": {
      const [plafondAtteint, historique] = await Promise.all([outils.plafondClaudeAtteint(), outils.historique?.() ?? Promise.resolve([])]);
      const repli = etat.repliSansVideo && !etat.repliSansVideo.fait ? etat.repliSansVideo : null;
      // État abîmé (repli commencé mais plan d'Opus perdu) : on le dit, on ne refait pas une mise en scène ordinaire à la place.
      if (repli && !etat.realisation) throw new ErreurChaineV4(phraseRepliEchecV4(repli.retirees), true, "repli sans vidéo : le plan précédent est introuvable", etat);
      const entree = entreeRealisateurV4(etat, { plafondAtteint, historique });
      const r = await realiser(
        repli ? { ...entree, repli: { interdites: IDS_PLAQUETTES_A_VIDEO_V4, elementsPrecedents: repli.elementsPrecedents, erreurs: erreursRepliV4(etat.realisation!.plan, repli.retirees), essaisMax: ESSAIS_REPLI_SANS_VIDEO_V4 } } : entree,
        { appeler: outils.appelerRealisateur },
      );
      if (repli) {
        // Repli : seule une version complète et rendable est acceptée (jamais la version simple, jamais un contrôle assoupli).
        // Pas d'appel Claude (plafond atteint, panne) : phrase dédiée, ce n'est pas un échec des contrôles.
        if (r.essais === 0 || r.phrase === MENTION_PLAFOND_FACECAM_ANIMEE) throw new ErreurChaineV4("Le plafond Claude de cette vidéo est atteint : la mise en scène sans vidéo n'a pas pu être refaite. Reprendre la relancera quand Claude sera de nouveau disponible.", true, undefined, etat);
        if (r.phrase === PHRASE_REALISATEUR_PANNE) throw new ErreurChaineV4("Claude est indisponible : la mise en scène sans vidéo n'a pas pu être refaite. Reprendre la relancera dans un instant.", true, (r.erreurs ?? []).slice(0, 2).join(" | "), etat);
        if (r.version !== "complete" || !r.rendable || !r.plan.elementsV4?.length) {
          throw new ErreurChaineV4(phraseRepliEchecV4(repli.retirees), true, (r.erreurs ?? []).slice(0, 5).join(" | "), etat);
        }
        return { ...etat, etape: "videos", repliSansVideo: { ...repli, fait: true, essais: r.essais }, realisation: { version: r.version, essais: (etat.realisation?.essais ?? 0) + r.essais, avertissements: r.avertissements.length, phrase: phraseRepliOkV4(repli.retirees), plan: r.plan } };
      }
      if (!r.rendable || !r.plan.elementsV4?.length) {
        throw new ErreurChaineV4("La mise en scène n'a pas passé les contrôles : la vidéo n'est pas fabriquée. Réessayez.", true, (r.erreurs ?? []).slice(0, 5).join(" | "));
      }
      return { ...etat, etape: "videos", realisation: { version: r.version, essais: r.essais, ...(r.erreurs?.length ? { erreurs: r.erreurs.slice(0, 20) } : {}), avertissements: r.avertissements.length, ...(r.phrase ? { phrase: r.phrase } : {}), plan: r.plan } };
    }
    case "videos": {
      if (!etat.realisation || !etat.coupes) return { ...etat, etape: etat.coupes ? "mise-en-scene" : "coupes" };
      let plan = etat.realisation.plan;
      let fichiers = etat.videos?.fichiers ?? [];
      let manques: string[] = [];
      let choix = etat.videos?.choix;
      let depenseUsd = etat.videos?.depenseUsd;
      // Seules les plaquettes qui exigent des vidéos qu'elles n'ont pas déclenchent la recherche (une reprise ne refait pas ce qui est fait).
      if (plaquettesSansVideo(plan).length) {
        if (outils.videos) {
          const r = await outils.videos({ videoId: etat.demande.videoId, plan, mots: etat.coupes.mots });
          plan = r.plan;
          // Fusion avec les fichiers déjà prêts (reprise d'un plan à moitié rempli), un seul fichier par nom ; le plus récent l'emporte.
          fichiers = [...fichiers.filter((f) => !r.fichiers.some((n) => n.nom === f.nom)), ...r.fichiers];
          manques = r.manques;
          depenseUsd = r.depenseUsd;
          choix = r.choix;
        }
      }
      // Décision de Will (18/10) : sans vidéo littérale, la plaquette est RETIRÉE (le visage reste seul), jamais remplacée par une approximation.
      const retrait = retirerPlaquettesSansVideo(plan);
      // Contrôles relancés sur le plan APRÈS retrait (le visage seul peut violer H1, H2 : c'est noté dans le rapport, aucune règle n'est assouplie).
      const controle = retrait.retirees.length ? controlerDiversiteV4(retrait.plan, { mots: etat.coupes.mots }) : null;
      const resume = {
        fichiers: [] as FichierVideoV4[],
        retirees: retrait.retirees,
        manques,
        ...(depenseUsd !== undefined ? { depenseUsd } : {}),
        ...(controle ? { controle: { rendable: estRendableV4(controle.erreurs), erreurs: controle.erreurs.slice(0, 20) } } : {}),
      };
      // H1 et H2 sont BLOQUANTS (règle de Will) : un plan hors règles, ou vidé de ses plaquettes, n'est jamais rendu. Décision de Will : on bloque.
      if (retrait.retirees.length && (!retrait.plan.elementsV4?.length || (controle && !estRendableV4(controle.erreurs)))) {
        // Repli « sans vidéo » (une seule fois) : Opus refait sa mise en scène sans plaquette à vidéo ; l'état garde le plan qu'il avait écrit.
        if (!etat.repliSansVideo && outils.appelerRealisateur) {
          return { ...etat, etape: "mise-en-scene", repliSansVideo: { retirees: retrait.retirees, manques, elementsPrecedents: elementsPourRepliV4(plan) }, videos: { ...resume, fichiers, ...(choix?.length ? { choix } : {}) } };
        }
        // Seulement le nom lisible de la plaquette (fiche du catalogue) et l'instant : jamais le texte écrit par Claude.
        const quoi = nomsRetireesV4(retrait.retirees);
        throw new ErreurChaineV4(
          `Je n'ai pas trouvé de vidéo fidèle à ce que vous dites pour ${quoi} : monter la vidéo sans elle casserait votre rythme. Reprendre relance la recherche.`,
          true,
          (controle?.erreurs ?? []).slice(0, 5).join(" | "),
          // état gardé : le plan PARTIELLEMENT rempli, sans retrait (la reprise ne cherche que les plaquettes manquantes et ne repaie pas les contrôles faits) + le diagnostic
          { ...etat, etape: "videos", realisation: { ...etat.realisation, plan }, videos: { ...resume, fichiers, ...(choix?.length ? { choix } : {}) } },
        );
      }
      return {
        ...etat,
        etape: "rendu",
        realisation: { ...etat.realisation, plan: retrait.plan },
        videos: {
          fichiers: fichiers.filter((f) => (retrait.plan.elementsV4 ?? []).some((e) => (e.medias ?? []).some((m) => m.endsWith(`/${f.nom}`) || m === f.nom))),
          ...(choix?.length ? { choix: choix.filter((c) => (retrait.plan.elementsV4 ?? []).some((e) => (e.medias ?? []).some((m) => m.endsWith(`/${c.fichier}`) || m === c.fichier))) } : {}),
          retirees: retrait.retirees,
          manques,
          ...(depenseUsd !== undefined ? { depenseUsd } : {}),
          ...(controle ? { controle: { rendable: estRendableV4(controle.erreurs), erreurs: controle.erreurs.slice(0, 20) } } : {}),
        },
      };
    }
    case "rendu": {
      if (!etat.realisation || !etat.coupes) return { ...etat, etape: etat.coupes ? "mise-en-scene" : "coupes" };
      // Jamais de rendu d'une plaquette à vidéo sans vidéo (v-60359dd080b1 : `broll/` sans nom de fichier, 404 à 99 %) ; sert aussi à reprendre un travail déjà à « rendu ».
      if (plaquettesSansVideo(etat.realisation.plan).length) return { ...etat, etape: "videos" };
      const rendu = await outils.rendre({ idRendu: `fa4-${etat.demande.versionId}`, priseCle: etat.demande.priseCle, plan: etat.realisation.plan, gardes: etat.coupes.gardes, ...(etat.cadrage ? { recadrage: etat.cadrage } : {}), ...(etat.videos?.fichiers.length ? { videos: etat.videos.fichiers } : {}) });
      return { ...etat, etape: "prete", rendu };
    }
    case "prete":
      return etat;
  }
}
