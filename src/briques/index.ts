/**
 * BRIQUES COMMUNES DE FABRICATION (PLAN B.6.4 bis ; moteur avocat B.0 §10).
 * Les moteurs de format n'implémentent pas les savoir-faire : ils ORCHESTRENT ces briques.
 * Chaque brique a un contrat stable, une version (enregistrée dans la recette de montage
 * pour refaire une vidéo à l'identique) et une implémentation simulée.
 * Rien de propre au format avocat n'entre ici (B.12) : les règles chiffrées viennent de la commande.
 */
import type {
  AlerteQualite,
  BaseSousTitres,
  CommandeFabrication,
  IdReseau,
  IntensiteSousTitres,
  LigneCout,
  MotHorodate,
  Ratio,
  RapportQualite,
  SegmentSousTitres,
  ValeurStyleSousTitres,
} from "@/domaine/types";
import { horodaterTexte } from "@/domaine/derivations";
import { idFournisseur } from "@/domaine/credits";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { anglePrincipalDe, visagePrincipalResolu } from "@/domaine/distribution";
import { fabriquerSousTitres, VERSION_BRIQUE_SOUS_TITRES } from "./sous-titres";
import { trouverFormat, zoneDuree } from "@/formats";
import { centimes, multiplier, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { obtenirReseau } from "@/reseaux";
import { idMoteurDeCommande } from "@/moteurs/ids";

export type IdBrique =
  | "sous-titres"
  | "voix"
  | "nettoyage-blancs"
  | "decoupage-plans"
  | "visage"
  | "etalonnage"
  | "illustrations"
  | "decor"
  | "composition"
  | "son"
  | "habillage"
  | "export"
  | "controle-qualite";

export interface Brique<Entree, Sortie> {
  id: IdBrique;
  version: string;
  nom: string;
  /** Lignes de coût estimées pour une commande (AV2.2-9). */
  estimer(commande: CommandeFabrication): LigneCout[];
  executer(entree: Entree): Promise<Sortie>;
}

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, prixCentimes: number): LigneCout {
  const prix = centimes(prixCentimes);
  return { etape, fournisseur, unite, quantite, prixUnitaire: prix, total: multiplier(prix, quantite), nature: "estime" };
}

/** Ligne d'un tarif en DOLLARS, convertie en euros au taux figé dans la commande (B.0 §9). */
function ligneUsd(c: CommandeFabrication, etape: string, unite: LigneCout["unite"], quantite: number, centimesUsd: number, fournisseur = "simulation"): LigneCout {
  const prixEur = centimesUsd * (c.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT);
  return { etape, fournisseur, unite, quantite, prixUnitaire: centimes(prixEur), total: centimes(prixEur * quantite), nature: "estime" };
}

/** Débit de la recette du format de la commande (mots/s) ; 2,6 si le format est inconnu. */
function motsParSecondeDe(c: Pick<CommandeFabrication, "formatId">): number {
  return trouverFormat(c.formatId)?.recetteScript.motsParSeconde ?? 2.6;
}

/* --- Contrats ----------------------------------------------------- */

export interface EntreeSousTitres {
  texte: string;
  dureeSec: number;
  motsParLigne: number;
  prononciations: { mot: string; prononciation: string }[];
  emphase: string[];
  /** Horodatage réel des mots (audio maître) : prime sur la répartition uniforme. */
  mots?: MotHorodate[];
  /** Lot M2 (ajouts purs, facultatifs) : style de base, mélange, coupes, réseaux, verrous de la version précédente. */
  style?: ValeurStyleSousTitres | null;
  base?: BaseSousTitres;
  intensite?: IntensiteSousTitres;
  coupesSec?: number[];
  ratio?: Ratio;
  reseaux?: IdReseau[];
  motsTitre?: string[];
  ancres?: number[];
  anciens?: SegmentSousTitres[];
}
export interface EntreeVoix {
  texte: string;
  idVoixFournisseur?: string;
  /** Débit de la recette du format (mots/s). */
  motsParSeconde: number;
}
export interface EntreeNettoyageBlancs {
  pisteVoixCle: string;
  mots: MotHorodate[];
  regles: { seuilMs: number; cibleMs: [number, number]; fonduMs: [number, number]; teteMaxMs: number };
}
export interface EntreeDecoupagePlans {
  mots: MotHorodate[];
  dureeSec: number;
}
export interface EntreeVisage {
  /** Le visage parle TOUJOURS sur un son déjà fabriqué. */
  pisteVoixCle: string;
  idVisageFournisseur?: string;
  angle?: string;
  fond: "transparent" | "uni";
  ratio: Ratio;
  motionPrompt?: string;
  /** Second angle : seulement ses segments (± 1 s). */
  segments?: { debutSec: number; finSec: number }[];
}
export interface EntreeEtalonnage {
  planCle: string;
  lutId?: string;
  intensite: number;
}
export interface EntreeIllustrations {
  plans: { id: string; requete?: string; verrouille: boolean }[];
}
export interface EntreeDecor {
  decorId?: string;
  ratio: Ratio;
}
export interface EntreeComposition {
  ratio: Ratio;
  calques: { type: string; cle: string }[];
}
export interface EntreeSon {
  voixCle: string;
  musiqueId?: string;
  niveauCibleLufs: number;
}
export interface EntreeHabillage {
  videoCle: string;
  habillageId?: string;
}
export interface EntreeExport {
  masterCle: string;
  ratios: Ratio[];
}
export interface EntreeControle {
  dureeSec: number;
  dureeCibleSec: number;
  ratios: Ratio[];
  /** Format de la vidéo : un format « depuis-script » remplace l'écart à la cible par les zones de durée. */
  formatId?: string;
}

/* --- Implémentations simulées ------------------------------------- */

/**
 * Sous-titres (lot M2) : délègue à la brique commune `briques/sous-titres` (groupes de 2 à 4 mots, largeur depuis
 * les zones protégées, calage sur les coupes, emphase par jeton, mélange des styles). Signature inchangée.
 */
export const briqueSousTitres: Brique<EntreeSousTitres, SegmentSousTitres[]> = {
  id: "sous-titres",
  version: VERSION_BRIQUE_SOUS_TITRES,
  nom: "Sous-titres",
  estimer: (c) => (c.briques["sous-titres"] ? [ligne("Sous-titres", "simulation", "seconde", c.dureeCibleSec, 0.1)] : []),
  async executer(entree) {
    return fabriquerSousTitres({
      texte: entree.texte,
      dureeSec: entree.dureeSec,
      mots: entree.mots,
      prononciations: entree.prononciations,
      emphase: entree.emphase,
      motsParLigne: entree.motsParLigne,
      style: entree.style,
      base: entree.base,
      intensite: entree.intensite,
      coupesSec: entree.coupesSec,
      ratio: entree.ratio,
      reseaux: entree.reseaux,
      motsTitre: entree.motsTitre,
      ancres: entree.ancres,
      anciens: entree.anciens,
    });
  },
};

export const briqueVoix: Brique<EntreeVoix, { pisteCle: string; dureeSec: number; mots: MotHorodate[] }> = {
  id: "voix",
  version: "sim-2",
  nom: "Voix",
  // Sans personnage (Motion), aucune voix n'est fabriquée : rien à facturer.
  // Lot « crédits » (02/10) : la ligne porte le fournisseur de la voix choisie (« heygen » pour une voix reliée), pour que
  // le pré-vol contrôle et réserve le bon crédit ; le prix estimé ne change pas.
  // INTÉGRATION FINALE : une voix HeyGen est annoncée à son vrai tarif (au caractère, en dollars), arrondi au centime
  // SUPÉRIEUR : jamais « 0 € » pour une voix qui sera payée.
  estimer: (c) => {
    if (!c.distribution.length) return [];
    const fournisseur = c.distribution[0]?.fournisseurVoix ?? "simulation";
    const n = c.script.texteComplet.length;
    if (idFournisseur(fournisseur) !== "heygen") return [ligne("Voix", fournisseur, "caractere", n, 0.02)];
    const parCaractere = CENTIMES_USD_PAR_CARACTERE_HEYGEN * (c.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT);
    return [{ etape: "Voix", fournisseur, unite: "caractere", quantite: n, prixUnitaire: centimes(parCaractere), total: centimes(Math.ceil(n * parCaractere - 1e-9)), nature: "estime" }];
  },
  async executer({ texte, motsParSeconde }) {
    // Débit de la recette (et non plus 2,6 en dur), avec l'horodatage de chaque mot (même contrat que la voix réelle).
    const mots = horodaterTexte(texte, motsParSeconde);
    return { pisteCle: "/demo/essai-voix.mp3", dureeSec: Math.max(1, Math.round(mots.at(-1)?.finSec ?? 1)), mots };
  },
};

/** Raccourcit les blancs trop longs ; les horodatages sont décalés d'autant (calcul PUR, coupe du son par FFmpeg au lot M1). */
export const briqueNettoyageBlancs: Brique<EntreeNettoyageBlancs, { pisteCle: string; mots: MotHorodate[] }> = {
  id: "nettoyage-blancs",
  version: "sim-1",
  nom: "Nettoyage des blancs",
  estimer: () => [],
  async executer({ pisteVoixCle, mots, regles }) {
    const cible = (regles.cibleMs[0] + regles.cibleMs[1]) / 2000;
    let decalage = Math.max(0, (mots[0]?.debutSec ?? 0) - regles.teteMaxMs / 1000);
    const sortie: MotHorodate[] = [];
    mots.forEach((m, i) => {
      if (i > 0) {
        const blanc = m.debutSec - mots[i - 1].finSec;
        if (blanc * 1000 > regles.seuilMs) decalage += blanc - cible;
      }
      sortie.push({ ...m, debutSec: +(m.debutSec - decalage).toFixed(3), finSec: +(m.finSec - decalage).toFixed(3) });
    });
    return { pisteCle: pisteVoixCle, mots: sortie };
  },
};

/** Découpage en plans sur l'audio maître (simulé : un plan par tranche de 3 s ; le vrai découpage est au lot M1). */
export const briqueDecoupagePlans: Brique<EntreeDecoupagePlans, { coupesSec: number[] }> = {
  id: "decoupage-plans",
  version: "sim-1",
  nom: "Découpage en plans",
  estimer: () => [],
  async executer({ dureeSec }) {
    const coupesSec: number[] = [];
    for (let t = 3; t < dureeSec; t += 3) coupesSec.push(t);
    return { coupesSec };
  },
};

/** E2E-1 n° 10 (03/10) : fichier d'une brique simulée, neutre (aucun format : jamais la vidéo d'essai de l'avocat). */
const CLE_BRIQUE_SIMULEE = "simulation/brique-simulee.mp4";

export const briqueVisage: Brique<EntreeVisage, { planCle: string }> = {
  id: "visage",
  version: "sim-2",
  nom: "Visage",
  estimer: (c) => {
    const double = c.distribution.find((d) => d.source === "double");
    if (!double) return [];
    // v2 : l'angle principal sur toute la durée, le second sur sa part (× 1,3 pour les marges de ± 1 s).
    if (c.versionContrat === 2) {
      const second = double.modeAngles === "deux-angles" ? (double.repartitionAngles?.second ?? 0) : 0;
      // Lot R7d : un double RÉEL est estimé au nom de son fournisseur (le crédit HeyGen est alors contrôlé et réservé).
      // Correcteur 4 : l'angle principal est celui de la recette figée dans la commande (plus « trois-quarts » en dur).
      const principal = visagePrincipalResolu(double.visagesResolus, anglePrincipalDe(c.recetteMontage));
      // Lot R7e : seulement si Will a allumé « Votre avatar parle dans le studio » (figé dans la commande) ; sinon rien
      // n'est annoncé ni réservé chez HeyGen.
      // CORRECTEUR FINAL A (VERIF-E2E-1) : le moteur d'essai ne fait jamais parler le double chez HeyGen : aucun prix
      // d'avatar n'est annoncé pour une vidéo d'essai.
      // Relecture finale : le moteur se lit comme partout (`idMoteurDeCommande`) ; une commande sans moteur (ou à moteur
      // inconnu) retombe sur celui de son format, la simulation pour l'avocat : jamais de prix HeyGen pour un essai.
      const f = idMoteurDeCommande(c) !== "simulation" && c.renduDouble?.allume === true && principal?.fournisseur && principal.fournisseur !== "simulation" ? principal.fournisseur : "simulation";
      const lignes = [ligneUsd(c, "Double, angle principal", "seconde", c.dureeCibleSec, 7, f)];
      if (second > 0) lignes.push(ligneUsd(c, "Double, second angle", "seconde", Math.ceil(c.dureeCibleSec * second * 1.3 + 2), 7, f));
      return lignes;
    }
    return [ligne("Double", "simulation", "seconde", c.dureeCibleSec, 3)];
  },
  async executer() {
    return { planCle: CLE_BRIQUE_SIMULEE };
  },
};

export const briqueEtalonnage: Brique<EntreeEtalonnage, { planCle: string }> = {
  id: "etalonnage",
  version: "sim-1",
  nom: "Étalonnage",
  estimer: (c) => (c.styles.lut ? [ligne("Étalonnage", "simulation", "seconde", c.dureeCibleSec, 0.2)] : []),
  async executer({ planCle }) {
    return { planCle };
  },
};

export const briqueIllustrations: Brique<EntreeIllustrations, { choix: Record<string, string> }> = {
  id: "illustrations",
  version: "sim-1",
  nom: "Images d'illustration",
  estimer: (c) => {
    if (!c.briques.illustrations) return [];
    const n = c.plans.filter((p) => p.sourceImage === "illustration" && !p.illustration?.verrouille).length || Math.ceil(c.dureeCibleSec / 12);
    return [ligne("Illustrations", "simulation", "image", n, 5)];
  },
  async executer({ plans }) {
    // Un choix verrouillé par Will n'est JAMAIS remplacé (AV2.3-6).
    const choix: Record<string, string> = {};
    for (const p of plans) if (!p.verrouille) choix[p.id] = "auto";
    return { choix };
  },
};

/** Décor posé derrière le double détouré (gratuit : composition locale). */
export const briqueDecor: Brique<EntreeDecor, { decorCle: string }> = {
  id: "decor",
  version: "sim-1",
  nom: "Décor",
  estimer: () => [],
  async executer() {
    return { decorCle: "/demo/illustrations/illu-03.jpg" };
  },
};

/** Composition des calques (Remotion dans `studio-rendu`, lot M4) : simulée ici. */
export const briqueComposition: Brique<EntreeComposition, { masterSansTexteCle: string }> = {
  id: "composition",
  version: "sim-1",
  nom: "Composition",
  estimer: () => [],
  async executer() {
    return { masterSansTexteCle: CLE_BRIQUE_SIMULEE };
  },
};

export const briqueSon: Brique<EntreeSon, { mixageCle: string; niveauLufs: number }> = {
  id: "son",
  version: "sim-1",
  nom: "Son",
  // Brique coupée : seul le niveau de la voix est réglé ; sans voix, rien (AV2.7).
  estimer: (c) =>
    c.briques.son
      ? [ligne("Mixage", "simulation", "seconde", c.dureeCibleSec, 0.3)]
      : c.distribution.length
        ? [ligne("Niveau de la voix", "simulation", "seconde", c.dureeCibleSec, 0.1)]
        : [],
  async executer({ voixCle, niveauCibleLufs }) {
    return { mixageCle: voixCle, niveauLufs: niveauCibleLufs };
  },
};

export const briqueHabillage: Brique<EntreeHabillage, { videoCle: string }> = {
  id: "habillage",
  version: "sim-1",
  nom: "Habillage",
  estimer: (c) => (c.styles.habillage ? [ligne("Habillage", "simulation", "forfait", 1, 10)] : []),
  async executer({ videoCle }) {
    return { videoCle };
  },
};

export const briqueExport: Brique<EntreeExport, { sorties: { ratio: Ratio; cle: string }[] }> = {
  id: "export",
  version: "sim-1",
  nom: "Export par réseau",
  estimer: (c) => [ligne("Export", "simulation", "seconde", c.dureeCibleSec * c.ratios.length, 0.5)],
  async executer({ masterCle, ratios }) {
    return { sorties: ratios.map((ratio) => ({ ratio, cle: masterCle })) };
  },
};

/* E2E-1 n° 4 (03/10) : plus AUCUNE alerte ni message sur la mention IA (facultative, coupée par défaut, décision de Will). */

/** Contrôle de durée (B.0 §18) : zones de durée pour un format « depuis-script », écart à la cible sinon. */
export function alertesDuree({ dureeSec, dureeCibleSec, ratios, formatId }: EntreeControle): AlerteQualite[] {
  const alertes: AlerteQualite[] = [];
  const format = formatId ? trouverFormat(formatId) : undefined;
  const zone = format ? zoneDuree(format, dureeSec) : null;
  if (zone === "orange") alertes.push({ code: "duree", gravite: "info", message: "Un peu long (40 à 50 s)." });
  else if (zone === "hors-zone") alertes.push({ code: "duree", gravite: "info", message: "Hors zone : plus de 50 s." });
  else if (zone === null && Math.abs(dureeSec - dureeCibleSec) > dureeCibleSec * 0.2) {
    alertes.push({ code: "duree", gravite: "attention", message: "La durée s'écarte de la cible." });
  }
  if (ratios.includes("9:16") && dureeSec > obtenirReseau("youtube-shorts").dureeMaxSec) {
    alertes.push({ code: "duree", gravite: "info", message: "Trop longue pour Shorts.", reseau: "youtube-shorts" });
  }
  return alertes;
}

export const briqueControleQualite: Brique<EntreeControle, RapportQualite> = {
  id: "controle-qualite",
  version: "sim-2",
  nom: "Contrôle qualité",
  estimer: () => [],
  async executer(entree) {
    return {
      note: 86,
      verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: false },
      alertes: alertesDuree(entree),
      niveauSonoreLufs: -14,
    };
  },
};

export const BRIQUES = [
  briqueVoix,
  briqueNettoyageBlancs,
  briqueDecoupagePlans,
  briqueVisage,
  briqueIllustrations,
  briqueDecor,
  briqueComposition,
  briqueEtalonnage,
  briqueSon,
  briqueSousTitres,
  briqueHabillage,
  briqueExport,
  briqueControleQualite,
] as const;

/** Versions des briques (figées dans la recette de montage de chaque version de vidéo). */
export function versionsBriques(): Record<IdBrique, string> {
  return Object.fromEntries(BRIQUES.map((b) => [b.id, b.version])) as Record<IdBrique, string>;
}

/** Débit (mots/s) utilisé par la voix simulée pour une commande. */
export function debitDeCommande(c: Pick<CommandeFabrication, "formatId">): number {
  return motsParSecondeDe(c);
}
