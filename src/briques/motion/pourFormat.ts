/**
 * API UNIQUE DU MOTION DESIGN POUR TOUS LES FORMATS (brique `motion`, mission H : « qualité extrême et CENTRALISÉ »).
 *
 * Un format (avocat, face caméra, podcast, écran partagé, tout format futur) ne connaît QUE cette fonction :
 *
 *   cartesPourFormat({ format, ratio, phrases, intensite, demandes, mots })
 *
 * Elle rend les cartes prêtes à rendre par l'opération `composition` EXISTANTE de `studio-rendu` (sans mode), chacune
 * avec ses instants dans la vidéo. Le format n'a ensuite qu'à les faire rendre (`rendu-cartes.ts`) et à les poser
 * (`EntreeComposition.cartesPleinEcran`, ou la moitié haute d'un écran partagé).
 *
 * Mêmes règles partout :
 *  - modèle : choisi d'après la phrase (`choisirModele`), ou demandé explicitement (titre à l'écran, consigne
 *    « Monteur, … », fil de discussion) ; le titre plein écran n'est JAMAIS choisi seul (B.21) ;
 *  - style : `choisirStyleMotion` (demande > habitude > intensité > « sobre ») ; « sobre » n'est pas écrit dans les
 *    propriétés (mêmes paramètres qu'au lot C) ;
 *  - durée : celle de la phrase, bornée par la fiche du modèle et le garde-fou commun (3 à 8 s) ;
 *  - chaque élément de la carte apparaît au mot dit (`calerCarte`) ;
 *  - jamais deux cartes qui se chevauchent ; au plus `maxCartes`.
 *
 * Le catalogue passe par `CATALOGUE_ACTIF` (jamais une liste en dur dans un format) : il pointe sur le catalogue
 * étendu du lot F2 (13 modèles, `catalogue-actif-etendu.ts`) ; aucun format n'a rien eu à changer.
 * PUR, sans alias « @/ ».
 */
import { DUREE_CARTE_SEC, ficheModele, IDS_MODELES_MOTION } from "./catalogue";
import { CATALOGUE_ACTIF_ETENDU } from "./catalogue-actif-etendu";
import { calerCarte, type MotCalage } from "./calage";
import { choisirModele } from "./choix";
import { miseEnPage, preparerCarte, type ParametresRenduCarte } from "./demande";
import type { RatioMotion } from "./jetons";
import { choisirStyleMotion, lireDemandeStyle, type IntensiteMotion, type StyleMotion } from "./style";
import { carteDepuisTextes } from "./textes";
import type { CarteModele, DispositionCarte, IdModeleMotion, MiseEnPageCarte } from "./types";

/** Ce que le format sait du catalogue : passé par ici, jamais par une liste en dur. */
export interface CatalogueMotionActif {
  ids: () => readonly string[];
  fiche: (id: string) => { composition: string; dureeSec: [number, number]; automatique: boolean } | undefined;
  choisir: (phrase: string) => { modele: string; carte: CarteModele; confiance: number; raison: string } | null;
  depuisTextes: (modele: string, textes: string[]) => CarteModele | null;
  caler: (carte: CarteModele, mots: MotCalage[], debutCarteSec: number, dureeSec: number) => CarteModele;
  parametres: (carte: CarteModele, mp: MiseEnPageCarte) => ParametresRenduCarte | null;
}

/** Catalogue des 6 modèles validés du lot C (gardé : référence et non-régression). */
export const CATALOGUE_ACTIF_BASE: CatalogueMotionActif = {
  ids: () => IDS_MODELES_MOTION,
  fiche: (id) => ficheModele(id),
  choisir: (phrase) => choisirModele(phrase),
  depuisTextes: (modele, textes) => ((IDS_MODELES_MOTION as readonly string[]).includes(modele) ? carteDepuisTextes(modele as IdModeleMotion, textes) : null),
  caler: (carte, mots, debut, duree) => calerCarte(carte, mots, debut, duree),
  parametres: (carte, mp) => preparerCarte({ carte }, mp).parametres,
};

/**
 * Catalogue utilisé par TOUS les formats : les 13 modèles (lot F2, branché à l'intégration Z). Les 6 premiers gardent
 * leurs règles et leurs paramètres à l'identique ; le titre plein écran n'est jamais choisi seul.
 */
export const CATALOGUE_ACTIF: CatalogueMotionActif = CATALOGUE_ACTIF_ETENDU;

/** Ratios où une carte motion se compose (le 16:9 n'a pas encore de mise en page motion). */
export const RATIOS_MOTION: readonly RatioMotion[] = ["9:16", "4:5", "1:1"];

/** Les ratios d'une vidéo qui reçoivent des cartes. */
export function ratiosMotion(ratios: readonly string[]): RatioMotion[] {
  return ratios.filter((r): r is RatioMotion => (RATIOS_MOTION as readonly string[]).includes(r));
}

/** Une phrase de la vidéo (temps de la VIDÉO livrée), à l'endroit où le format accepte une carte. */
export interface PhraseMotion {
  id: string;
  texte: string;
  debutSec: number;
  finSec: number;
  /**
   * Ce que le format pose là aujourd'hui (avocat : `illustration`, `titreEcran`, `emphase`) : une « place » prévue.
   * « titre » : la carte titre est permise (c'est une demande) ; les autres : choix automatique d'après la phrase.
   */
  place?: "illustration" | "titre" | "emphase" | "libre";
  /** Demande explicite : modèle du catalogue et ses textes (convention `CONVENTION_TEXTES`). */
  modele?: string;
  textes?: string[];
  /** Mots mis en valeur (aident à retrouver un chiffre dit). */
  emphase?: string[];
  /** Phrase de Will propre à cette carte (« fais-la en spectaculaire »). */
  demande?: string;
}

export interface DemandeCartesFormat {
  /** Identifiant du format qui demande (journal, identifiants stables). */
  format: string;
  ratio: RatioMotion;
  phrases: readonly PhraseMotion[];
  /** Intensité de la vidéo (Très dynamique → spectaculaire). */
  intensite?: IntensiteMotion | null;
  /** Phrases de Will valables pour toute la vidéo (consignes, fil, « pour les prochaines »). */
  demandes?: readonly string[];
  /** « Mes habitudes » (style déjà décidé ou phrases). */
  habitude?: StyleMotion | string | readonly string[] | null;
  /** Mots horodatés de la vidéo (calage au mot dit). */
  mots?: readonly MotCalage[];
  disposition?: DispositionCarte;
  /** Confiance minimale d'un choix automatique (0,6 par défaut). */
  confianceMin?: number;
  /** Nombre de cartes au plus (défaut : sans limite). */
  maxCartes?: number;
  /** Écart minimal entre deux cartes (s, 0,5 par défaut). */
  ecartMinSec?: number;
  /** Fin de la vidéo (une carte n'est jamais prolongée au-delà). */
  dureeVideoSec?: number;
  catalogue?: CatalogueMotionActif;
}

export interface CarteFormat {
  /** Identifiant stable (format, ratio, phrase). */
  id: string;
  phraseId: string;
  format: string;
  ratio: RatioMotion;
  debutSec: number;
  finSec: number;
  modele: string;
  carte: CarteModele;
  style: StyleMotion;
  disposition: DispositionCarte;
  origine: "automatique" | "demande";
  raison: string;
  /** Paramètres de l'opération `composition` (sans mode). */
  parametres: ParametresRenduCarte;
}

const nettoyer = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60);

/** Style de toute la vidéo : la DERNIÈRE demande qui parle de style l'emporte. */
function demandeDeStyle(demandes: readonly string[] | undefined): StyleMotion | null {
  for (let i = (demandes?.length ?? 0) - 1; i >= 0; i--) {
    const s = lireDemandeStyle(demandes![i]);
    if (s) return s;
  }
  return null;
}

/**
 * LA fonction que tout format appelle. Pure et déterministe : mêmes phrases, mêmes cartes. Une phrase sans modèle
 * assez sûr, un titre automatique, des textes qui ne suffisent pas ou une carte qui en chevauche une autre : rien.
 */
export function cartesPourFormat(d: DemandeCartesFormat): CarteFormat[] {
  const cat = d.catalogue ?? CATALOGUE_ACTIF;
  const min = d.confianceMin ?? 0.6;
  const ecart = d.ecartMinSec ?? 0.5;
  const disposition = d.disposition ?? "plein-ecran";
  const mots = [...(d.mots ?? [])];
  const styleVideo = demandeDeStyle(d.demandes);
  const sortie: CarteFormat[] = [];
  let finPrecedente = -Infinity;
  const phrases = [...d.phrases].filter((p) => p.finSec > p.debutSec).sort((a, b) => a.debutSec - b.debutSec);
  for (const p of phrases) {
    if (d.maxCartes !== undefined && sortie.length >= d.maxCartes) break;
    if (p.debutSec < finPrecedente + ecart) continue;
    // 1. Le modèle : demandé, sinon choisi d'après la phrase.
    let choix: { modele: string; carte: CarteModele; raison: string; origine: CarteFormat["origine"] } | null = null;
    const modeleDemande = p.modele ?? (p.place === "titre" ? "titre" : undefined);
    if (modeleDemande && cat.fiche(modeleDemande)) {
      const textes = p.textes?.length ? p.textes : [p.texte];
      const carte = cat.depuisTextes(modeleDemande, textes);
      if (carte) choix = { modele: modeleDemande, carte, raison: "demandé", origine: "demande" };
    }
    if (!choix) {
      const auto = cat.choisir([p.texte, ...(p.emphase ?? [])].join(" ").trim());
      const fiche = auto ? cat.fiche(auto.modele) : undefined;
      if (auto && fiche?.automatique && auto.confiance >= min) choix = { modele: auto.modele, carte: auto.carte, raison: auto.raison, origine: "automatique" };
    }
    if (!choix) continue;
    // 2. La durée : celle de la phrase, bornée par la fiche et le garde-fou commun, jamais au-delà de la vidéo.
    const fiche = cat.fiche(choix.modele)!;
    const dMin = Math.max(DUREE_CARTE_SEC.min, fiche.dureeSec[0]);
    const dMax = Math.min(DUREE_CARTE_SEC.max, fiche.dureeSec[1]);
    const duree = Math.min(dMax, Math.max(dMin, p.finSec - p.debutSec));
    const fin = Math.min(p.debutSec + duree, d.dureeVideoSec ?? Infinity);
    if (fin - p.debutSec < DUREE_CARTE_SEC.min - 1e-6) continue;
    // 3. Le style : demande de la carte > demande de la vidéo > habitude > intensité.
    const style = choisirStyleMotion({ intensite: d.intensite, demande: lireDemandeStyle(p.demande) ?? styleVideo, habitude: d.habitude });
    const mp0 = miseEnPage(d.ratio, disposition, fin - p.debutSec);
    const mp: MiseEnPageCarte = style === "sobre" ? mp0 : { ...mp0, style };
    // 4. Calage au mot dit, puis paramètres du rendu.
    const carte = cat.caler(choix.carte, mots, p.debutSec, mp.images / mp.fps);
    const parametres = cat.parametres(carte, mp);
    if (!parametres) continue;
    sortie.push({
      id: `${nettoyer(d.format)}-${d.ratio.replace(":", "x")}-${nettoyer(p.id)}`,
      phraseId: p.id,
      format: d.format,
      ratio: d.ratio,
      debutSec: +p.debutSec.toFixed(3),
      finSec: +(p.debutSec + mp.images / mp.fps).toFixed(3),
      modele: choix.modele,
      carte,
      style,
      disposition,
      origine: choix.origine,
      raison: choix.raison,
      parametres,
    });
    finPrecedente = p.debutSec + mp.images / mp.fps;
  }
  return sortie;
}
