/**
 * APPLICATION DES OPÉRATIONS DU MONTEUR (plan facecam v4, B.14, B.16, B.19, B.21 et lot D). PUR, sans dépôt ni réseau.
 *
 * `appliquerOperations(etat, operations, contexte)` rend un NOUVEL état (rien n'est modifié en place : chaque échange
 * avec le monteur donne une nouvelle version, l'ancienne reste intacte). Le moteur relit cet état dans `retoucher()`.
 *
 * Garde-fous imposés ici, quelle que soit la source (Claude, simulation, version simple) :
 * - grammaire de montage (B.19) : zoom flou 2 au plus par vidéo (au-delà : punch-in), zoom lent 3 %/s au plus, entrée
 *   de l'écran partagé en 9 images, jamais de fondu sur le visage ;
 * - cartes de 3 à 8 s (B.10) ; un titre plein écran n'est jamais automatique (B.21) ;
 * - détourage (`masquerPersonne`, `texteDerriere`) : JAMAIS par défaut, seulement sur une demande de Will (B.16) ;
 * - vitesse bornée à 0,5-2 ; arrêt sur image de 0,5 à 4 s ; générique de 2 à 8 s.
 * Toute opération corrigée ou refusée laisse une alerte lisible (rien n'est perdu en silence).
 */
import type { ConsigneFacecam, CranImage, EntreesFacecam, ImageFacecam, PassageFacecam } from "@/domaine/facecam";
import type { CodeCarte, OperationFacecam } from "./operations";
import { coupesActives, priseVersMontee, type CoupeDemandee, type MotMonteur } from "./temps";
import { appliquerEffetSpecial, estEffetSpecial } from "./effets";
import { preparerEffetRealiste, type EffetAConfirmer } from "./effet-realiste";
import type { AjustementCarteAuto } from "../cartes-video";
import { bruitageDeLaBanque, disponibiliteOperation } from "./disponibilite";

/** D'où vient une opération : décidée seule par le studio, ou demandée par Will (consigne dite, écrite, fil). */
export type OrigineOperation = "auto" | "demande";

/** Passage posé par le monteur : le passage commun, plus son ancre dans la prise et l'opération qui l'a créé. */
export interface PassageMonteur extends PassageFacecam {
  origine: OrigineOperation;
  consigneId?: string;
  /** Ancre dans la prise d'origine (les temps montés se recalculent après une coupe rétablie). */
  ancre: { debutPriseSec: number; finPriseSec: number };
  /** Opération d'origine, garde-fous appliqués (paramètres lus par la composition). */
  operation: OperationFacecam;
  /** Effet à détourage : variante sans détourage à livrer si les bords sont ratés. */
  detourage?: boolean;
  /** Bords ratés à la relecture : la variante sans détourage est livrée (« Effet non réussi — Réessayer »). */
  sansDetourage?: boolean;
}

/** Bruitage demandé par Will, posé au mot (temps du montage) ; `famille` : son de la banque du studio (V6). */
export interface BruitageDemande {
  id: string;
  nom: string;
  monteeSec: number;
  consigneId?: string;
  famille?: NonNullable<ReturnType<typeof bruitageDeLaBanque>>;
}

/** Réglages hors passages, gardés à part (`entrees.facecamMonteur`) : le lecteur commun de `entrees.facecam` les ignore. */
export interface ReglagesMonteur {
  teinte: "neutre" | "plus-chaud" | "plus-froid";
  son: { nettoyer: boolean; musique: string | null; volume: "normal" | "plus-fort" | "moins-fort"; bruitages: BruitageDemande[] };
  coupesDemandees: CoupeDemandee[];
  /** Vérif V1 : cartes automatiques retirées par Will (identifiants `auto-…` de `entrees.facecam.cartesAuto`). */
  cartesAutoRetirees: string[];
  /**
   * Vérif V1 : mots corrigés dans les sous-titres depuis le fil (« écris Certifexemple et pas Calliopi »). Rangés dans la
   * version : chaque habillage les réapplique (une retouche suivante ne les perd pas).
   */
  correctionsSousTitres: CorrectionSousTitres[];
  /** Ce que chaque consigne a changé (pour « Annuler » une consigne sans toucher aux autres). */
  traces: TraceConsigne[];
  /** 10/10 : gestes de Will sur les cartes AUTOMATIQUES (retirée, déplacée, texte changé), repérées par leur clé. */
  cartesAuto: AjustementCarteAuto[];
}

export interface CorrectionSousTitres {
  ancien: string;
  nouveau: string;
}

export interface TraceConsigne {
  consigneId: string;
  imageAvant?: Partial<ImageFacecam>;
  teinteAvant?: ReglagesMonteur["teinte"];
  sonAvant?: Omit<ReglagesMonteur["son"], "bruitages">;
  retablies?: string[];
  /** Vérif V1 : cartes automatiques retirées par cette consigne. */
  cartesAutoRetirees?: string[];
  /** Cartes automatiques remises par cette consigne (« remets la carte … ») : Annuler les retire de nouveau. */
  cartesAutoRemises?: string[];
}

export interface EtatMonteur {
  facecam: EntreesFacecam;
  reglages: ReglagesMonteur;
}

export function reglagesMonteurVides(): ReglagesMonteur {
  return { teinte: "neutre", son: { nettoyer: true, musique: null, volume: "normal", bruitages: [] }, coupesDemandees: [], cartesAutoRetirees: [], correctionsSousTitres: [], traces: [], cartesAuto: [] };
}

/** Lit `entrees.facecamMonteur` sans jamais lever (absent ou mal formé : valeurs par défaut). */
export function lireReglagesMonteur(entrees: Record<string, unknown> | null | undefined): ReglagesMonteur {
  const v = reglagesMonteurVides();
  const b = (entrees?.facecamMonteur ?? {}) as Partial<ReglagesMonteur>;
  const son = (b.son ?? {}) as Partial<ReglagesMonteur["son"]>;
  return {
    teinte: b.teinte === "plus-chaud" || b.teinte === "plus-froid" ? b.teinte : "neutre",
    son: {
      nettoyer: son.nettoyer !== false,
      musique: typeof son.musique === "string" ? son.musique : null,
      volume: son.volume === "plus-fort" || son.volume === "moins-fort" ? son.volume : "normal",
      bruitages: Array.isArray(son.bruitages) ? son.bruitages : [],
    },
    coupesDemandees: Array.isArray(b.coupesDemandees) ? b.coupesDemandees : v.coupesDemandees,
    cartesAutoRetirees: Array.isArray(b.cartesAutoRetirees) ? b.cartesAutoRetirees.filter((x): x is string => typeof x === "string") : v.cartesAutoRetirees,
    correctionsSousTitres: Array.isArray(b.correctionsSousTitres) ? b.correctionsSousTitres.filter((x): x is CorrectionSousTitres => typeof x?.ancien === "string" && typeof x?.nouveau === "string") : v.correctionsSousTitres,
    traces: Array.isArray(b.traces) ? b.traces : v.traces,
    cartesAuto: Array.isArray(b.cartesAuto) ? b.cartesAuto.filter((a) => typeof a?.cle === "string") : v.cartesAuto,
  };
}

/* ------------------------------------------------------------------ */
/* Grammaire (constantes du code, B.19)                                */
/* ------------------------------------------------------------------ */

export const GRAMMAIRE_MONTAGE = {
  zoomsFlousMax: 2,
  zoomLentMaxParSec: 0.03,
  entreeEcranPartageImages: 9,
  carteMinSec: 3,
  carteMaxSec: 8,
  vitesseMin: 0.5,
  vitesseMax: 2,
  arretMinSec: 0.5,
  arretMaxSec: 4,
  generiqueMinSec: 2,
  generiqueMaxSec: 8,
  /** Jamais de fondu sur le visage : seule la plaque vide (cache-moi) fond, Will n'est jamais fondu sur lui-même. */
  fonduSurVisage: false,
} as const;

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export interface ContexteApplication {
  /** Transcription de la prise, vue par le monteur (index → temps). */
  mots: MotMonteur[];
  dureePriseSec: number;
  origine: OrigineOperation;
  /** Consigne à laquelle répondent ces opérations (Annuler la retire seule). */
  consigneId?: string;
  /** Fabrique d'identifiants (déterministe dans les tests). */
  nouvelId: (prefixe: string) => string;
  /** Clé R2 où déposer le code d'une carte sur mesure (le document Video ne garde que la clé). */
  cleCarte?: (passageId: string) => string;
  /** Lot K : part de plan large autour d'un instant de la prise (0-1), pour le bon endroit d'un effet réaliste. */
  largeurPlan?: (priseSec: number) => number;
  /** Lot K : image de référence d'un effet réaliste (« logo-axion », identifiant de Mes images) → clé R2. */
  imageReference?: (ref: string) => string | undefined;
  /**
   * Cartes automatiques de la vidéo, posées ou non (planification réelle) : identifiant stable `auto-…` et clé de la
   * fiche. « remettre » s'y applique ; absent : seules les cartes rangées dans la version et les retirées sont connues.
   */
  cartesAutoConnues?: { id: string; cle?: string }[];
}

export interface ResultatApplication {
  etat: EtatMonteur;
  /** Opérations réellement appliquées (garde-fous compris), dans l'ordre. */
  appliquees: OperationFacecam[];
  /** Ce qui a été corrigé ou refusé, en phrases simples. */
  alertes: string[];
  /** Contenus lourds à déposer sur R2 (code des cartes sur mesure). */
  aDeposer: { cle: string; contenu: CodeCarte }[];
  /** Index (dans `operations`) des opérations refusées. */
  refusees: number[];
  /** V6 « interdit de mentir » : opérations refusées parce qu'elles ne sont pas encore rendues (phrase pour Will). */
  indisponibles: { index: number; phrase: string }[];
  /** Lot K : effets réalistes préparés, PAYANTS : rien n'est posé avant « Confirmer » (carte avec aperçu). */
  aConfirmer: EffetAConfirmer[];
}

const OPERATIONS_DETOURAGE = new Set<OperationFacecam["type"]>(["masquerPersonne", "texteDerriere"]);

/** Type de passage commun d'une opération (null : réglage global, pas de passage). */
function typePassage(op: OperationFacecam): PassageFacecam["type"] | null {
  switch (op.type) {
    case "ajouterCarte":
      return op.disposition === "ecran-partage" ? "ecran-partage" : "carte";
    case "ecranPartage":
      return "ecran-partage";
    case "zoom":
      return "zoom";
    case "titre":
      return "titre";
    case "generique":
      return "generique";
    case "miseEnPage":
    case "masquerPersonne":
    case "texteDerriere":
    case "vitesse":
    case "arretImage":
      return "autre";
    default:
      return null;
  }
}

export function appliquerOperations(depart: EtatMonteur, operations: OperationFacecam[], ctx: ContexteApplication): ResultatApplication {
  const facecam: EntreesFacecam = {
    ...depart.facecam,
    coupes: { auto: [...depart.facecam.coupes.auto], retablies: [...depart.facecam.coupes.retablies] },
    image: { ...depart.facecam.image },
    passages: [...depart.facecam.passages],
    consignes: [...depart.facecam.consignes],
  };
  const reglages: ReglagesMonteur = {
    ...depart.reglages,
    son: { ...depart.reglages.son, bruitages: [...depart.reglages.son.bruitages] },
    coupesDemandees: [...depart.reglages.coupesDemandees],
    cartesAutoRetirees: [...(depart.reglages.cartesAutoRetirees ?? [])],
    traces: [...depart.reglages.traces],
    cartesAuto: [...depart.reglages.cartesAuto],
  };
  const trace: TraceConsigne | null = ctx.consigneId ? { consigneId: ctx.consigneId } : null;
  const alertes: string[] = [];
  const appliquees: OperationFacecam[] = [];
  const aDeposer: ResultatApplication["aDeposer"] = [];
  const refusees: number[] = [];
  const aConfirmer: EffetAConfirmer[] = [];
  const indisponibles: ResultatApplication["indisponibles"] = [];
  const n = ctx.mots.length;
  const indexMot = (i: number) => borne(Math.round(i), 0, Math.max(0, n - 1));
  // Les opérations d'un même appel se calent sur les coupes D'AVANT l'appel (celles que Claude a vues).
  const coupesVues = coupesActives(depart.facecam, depart.reglages.coupesDemandees);
  const debutDe = (i: number) => (n ? ctx.mots[indexMot(i)].debutPriseSec : 0);
  const finDe = (i: number) => (n ? ctx.mots[indexMot(i)].finPriseSec : ctx.dureePriseSec);
  const zoomsFlous = () => facecam.passages.filter((p) => (p as PassageMonteur).operation?.type === "zoom" && ((p as PassageMonteur).operation as { style?: string }).style === "flou").length;

  operations.forEach((brute, index) => {
    let op: OperationFacecam = brute;
    // V6 « interdit de mentir » : une opération que la vidéo ne rend pas encore n'est jamais enregistrée comme faite.
    const dispo = disponibiliteOperation(op);
    if (!dispo.rendu) {
      refusees.push(index);
      indisponibles.push({ index, phrase: dispo.phrase });
      alertes.push(dispo.phrase);
      return;
    }
    if (OPERATIONS_DETOURAGE.has(op.type) && ctx.origine !== "demande") {
      refusees.push(index);
      alertes.push("Effet de détourage écarté : il ne s'applique que si vous le demandez.");
      return;
    }
    // Lot K : effet réaliste par IA — option payante : préparé (moment vérifié, consigne vidéo écrite), JAMAIS posé
    // ici ; il attend la confirmation de Will (le service montre la carte avec l'aperçu du moment).
    if (op.type === "effetRealisteIA") {
      const r = preparerEffetRealiste(op, {
        mots: ctx.mots,
        dureePriseSec: ctx.dureePriseSec,
        origine: ctx.origine,
        ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}),
        passages: facecam.passages,
        versMontee: (s) => priseVersMontee(s, coupesVues),
        nouvelId: ctx.nouvelId,
        ...(ctx.largeurPlan ? { largeurPlan: ctx.largeurPlan } : {}),
        ...(ctx.imageReference ? { imageReference: ctx.imageReference } : {}),
      });
      alertes.push(...r.alertes);
      if (!r.ok) {
        refusees.push(index);
        return;
      }
      aConfirmer.push(r.aConfirmer);
      appliquees.push(op);
      return;
    }
    // Lot F3 : effets spéciaux (à la demande seulement ; garde-fous dans `effets.ts`).
    if (estEffetSpecial(op)) {
      const r = appliquerEffetSpecial(op, { origine: ctx.origine, consigneId: ctx.consigneId, passages: facecam.passages, debutDe, finDe, versMontee: (s) => priseVersMontee(s, coupesVues), dureePriseSec: ctx.dureePriseSec, nouvelId: ctx.nouvelId });
      alertes.push(...r.alertes);
      if (!r.ok) {
        refusees.push(index);
        return;
      }
      facecam.passages.push(r.passage);
      appliquees.push(r.operation);
      return;
    }
    switch (op.type) {
      case "couleurs": {
        if (trace) trace.imageAvant = { ...(trace.imageAvant ?? {}), [op.reglage]: trace.imageAvant?.[op.reglage] ?? facecam.image[op.reglage] };
        facecam.image[op.reglage] = op.cran as CranImage;
        if (op.teinte) {
          if (trace && trace.teinteAvant === undefined) trace.teinteAvant = reglages.teinte;
          reglages.teinte = op.teinte;
        }
        appliquees.push(op);
        return;
      }
      case "son": {
        if (trace && !trace.sonAvant) trace.sonAvant = { nettoyer: reglages.son.nettoyer, musique: reglages.son.musique, volume: reglages.son.volume };
        if (op.action === "nettoyer") reglages.son.nettoyer = true;
        else if (op.action === "musique") reglages.son.musique = op.precision?.trim() || "calme";
        else if (op.action === "sans-musique") reglages.son.musique = null;
        else if (op.action === "plus-fort" || op.action === "moins-fort") reglages.son.volume = op.action;
        else if (op.action === "bruitage") {
          const sec = op.debutMot !== null ? priseVersMontee(debutDe(op.debutMot), coupesVues) : 0;
          const famille = bruitageDeLaBanque(op.precision) ?? undefined;
          reglages.son.bruitages.push({ id: ctx.nouvelId("bru"), nom: op.precision?.trim() || "whoosh", monteeSec: sec, consigneId: ctx.consigneId, ...(famille ? { famille } : {}) });
        }
        appliquees.push(op);
        return;
      }
      case "couper": {
        const debutSec = debutDe(Math.min(op.debutMot, op.finMot));
        const finSec = finDe(Math.max(op.debutMot, op.finMot));
        reglages.coupesDemandees.push({ id: ctx.nouvelId("cpd"), debutSec, finSec, consigneId: ctx.consigneId });
        appliquees.push(op);
        return;
      }
      case "retablir": {
        const coupeId = op.coupeId;
        if (!facecam.coupes.auto.some((c) => c.id === coupeId)) {
          refusees.push(index);
          alertes.push("Passage à rétablir introuvable.");
          return;
        }
        if (!facecam.coupes.retablies.includes(op.coupeId)) {
          facecam.coupes.retablies.push(op.coupeId);
          if (trace) trace.retablies = [...(trace.retablies ?? []), op.coupeId];
        }
        appliquees.push(op);
        return;
      }
      case "retirer": {
        const avant = facecam.passages.length;
        const passageId = op.passageId;
        facecam.passages = facecam.passages.filter((p) => p.id !== passageId);
        // Vérif V1 : une carte automatique (posée par l'habillage d'après le texte) se retire aussi, par son id.
        if (facecam.passages.length === avant && estCarteAutoActive(facecam, reglages, passageId)) {
          reglages.cartesAutoRetirees.push(passageId);
          if (trace) trace.cartesAutoRetirees = [...(trace.cartesAutoRetirees ?? []), passageId];
          appliquees.push(op);
          return;
        }
        if (facecam.passages.length === avant) {
          refusees.push(index);
          alertes.push("Élément à retirer introuvable.");
          return;
        }
        appliquees.push(op);
        return;
      }
      case "changerTitreCouverture": {
        // Test en prod du 11/10 : rien dans la vidéo ; le service refait l'image de la couverture. À la demande seulement.
        if (ctx.origine !== "demande" || !op.texte.trim()) {
          refusees.push(index);
          alertes.push("Titre de couverture écarté : il ne change que si vous le demandez.");
          return;
        }
        appliquees.push({ ...op, texte: op.texte.trim() });
        return;
      }
      case "remettre": {
        // La MÊME carte automatique revient (comme « Remettre » de la fiche) : retirée depuis le chat ou la fiche, ou
        // effacée par une autre carte (le pilote lui rend alors sa place, voir `cartes-chat.ts`).
        const id = op.passageId;
        const connue = ctx.cartesAutoConnues?.find((c) => c.id === id);
        if (!connue && !reglages.cartesAutoRetirees.includes(id) && !facecam.cartesAuto?.some((c) => c.id === id)) {
          refusees.push(index);
          alertes.push("Carte à remettre introuvable.");
          return;
        }
        if (reglages.cartesAutoRetirees.includes(id)) {
          reglages.cartesAutoRetirees = reglages.cartesAutoRetirees.filter((x) => x !== id);
          if (trace) trace.cartesAutoRemises = [...(trace.cartesAutoRemises ?? []), id];
        }
        if (connue?.cle) {
          reglages.cartesAuto = reglages.cartesAuto.flatMap((a) => {
            if (a.cle !== connue.cle || !a.retiree) return [a];
            const { retiree: _r, ...reste } = a;
            void _r;
            return reste.debutPriseSec !== undefined || reste.textes?.length ? [reste] : [];
          });
        }
        appliquees.push(op);
        return;
      }
    }

    // Opérations posées comme un passage.
    let debutPrise: number;
    let finPrise: number;
    if (op.type === "generique") {
      const duree = borne(op.dureeSec, GRAMMAIRE_MONTAGE.generiqueMinSec, GRAMMAIRE_MONTAGE.generiqueMaxSec);
      op = { ...op, dureeSec: duree };
      debutPrise = op.position === "debut" ? 0 : ctx.dureePriseSec;
      finPrise = debutPrise;
    } else if (op.type === "arretImage") {
      const duree = borne(op.dureeSec, GRAMMAIRE_MONTAGE.arretMinSec, GRAMMAIRE_MONTAGE.arretMaxSec);
      if (duree !== op.dureeSec) alertes.push(`Arrêt sur image ramené à ${duree.toLocaleString("fr-FR")} s.`);
      op = { ...op, dureeSec: duree };
      debutPrise = debutDe(op.auMot);
      finPrise = debutPrise;
    } else if (op.type === "titre" && (op.debutMot === null || op.finMot === null)) {
      debutPrise = 0;
      finPrise = ctx.dureePriseSec;
    } else {
      const o = op as { debutMot: number; finMot: number };
      debutPrise = debutDe(Math.min(o.debutMot, o.finMot));
      finPrise = finDe(Math.max(o.debutMot, o.finMot));
    }

    if (op.type === "titre" && op.pleinEcran && ctx.origine !== "demande") {
      op = { ...op, pleinEcran: false };
      alertes.push("Titre plein écran remplacé par un titre simple : il n'apparaît que si vous le demandez.");
    }
    if (op.type === "vitesse") {
      const f = borne(op.facteur, GRAMMAIRE_MONTAGE.vitesseMin, GRAMMAIRE_MONTAGE.vitesseMax);
      if (f !== op.facteur) alertes.push(`Vitesse ramenée à ×${f.toLocaleString("fr-FR")}.`);
      op = { ...op, facteur: f };
    }
    if (op.type === "zoom" && op.style === "flou" && zoomsFlous() >= GRAMMAIRE_MONTAGE.zoomsFlousMax) {
      op = { ...op, style: "punch-in" };
      alertes.push("Zoom flou remplacé par un zoom net : 2 zooms flous au plus par vidéo.");
    }
    // V6 : la réalisation ne rend que le zoom net (plan serré) sur le visage : le reste est dit, jamais promis.
    if (op.type === "zoom" && (op.style !== "punch-in" || op.cible !== "visage")) {
      const quoi = [op.style === "lent" ? "le zoom lent" : op.style === "flou" ? "le zoom flou" : null, op.cible === "main" ? "le zoom sur la main" : null].filter(Boolean).join(" et ");
      alertes.push(`${quoi.charAt(0).toUpperCase()}${quoi.slice(1)} : pas encore possible, j'ai mis un zoom net sur votre visage.`);
      op = { ...op, style: "punch-in", cible: "visage" };
    }
    if (op.type === "ajouterCarte" && op.modele === null && !op.html && !op.animationGardeeId) {
      // Carte sur mesure sans code : elle sera écrite par la brique motion (repli sur un modèle fixe si le code manque).
      alertes.push(`Carte « ${op.description.slice(0, 60)} » : animation à composer.`);
    }

    // Cartes et écrans partagés : 3 à 8 s (la carte s'allonge sur la parole suivante, jamais au-delà de 8 s).
    if (op.type === "ajouterCarte" || op.type === "ecranPartage") {
      const duree = finPrise - debutPrise;
      if (duree < GRAMMAIRE_MONTAGE.carteMinSec) finPrise = Math.min(ctx.dureePriseSec, debutPrise + GRAMMAIRE_MONTAGE.carteMinSec);
      if (duree > GRAMMAIRE_MONTAGE.carteMaxSec) finPrise = debutPrise + GRAMMAIRE_MONTAGE.carteMaxSec;
    }

    const id = ctx.nouvelId("pas");
    const debutSec = priseVersMontee(debutPrise, coupesVues);
    let finSec = Math.max(debutSec, priseVersMontee(finPrise, coupesVues));
    if (op.type === "generique" || op.type === "arretImage") finSec = debutSec + op.dureeSec;
    const parametres: Record<string, unknown> = {};
    if (op.type === "zoom" && op.style === "lent") parametres.vitesseMaxParSec = GRAMMAIRE_MONTAGE.zoomLentMaxParSec;
    if (op.type === "ecranPartage" || (op.type === "ajouterCarte" && op.disposition === "ecran-partage")) parametres.entreeImages = GRAMMAIRE_MONTAGE.entreeEcranPartageImages;

    let operation: OperationFacecam = op;
    let contenuCle: string | undefined;
    if (op.type === "ajouterCarte" && op.html) {
      // Le code (lourd) part sur R2 ; le document Video ne garde que la clé.
      contenuCle = ctx.cleCarte ? ctx.cleCarte(id) : `facecam/cartes/${id}.json`;
      aDeposer.push({ cle: contenuCle, contenu: op.html });
      operation = { ...op, html: null };
    }
    const texte = textePassage(op);
    const passage: PassageMonteur = {
      id,
      type: typePassage(op) ?? "autre",
      debutSec,
      finSec,
      ...(op.type === "ajouterCarte" ? { modele: op.modele ?? (op.animationGardeeId ? `garde:${op.animationGardeeId}` : "sur-mesure") } : {}),
      ...(contenuCle ? { contenuCle } : {}),
      ...(texte ? { texte } : {}),
      origine: ctx.origine,
      ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}),
      ancre: { debutPriseSec: debutPrise, finPriseSec: finPrise },
      operation: Object.keys(parametres).length ? ({ ...operation, ...parametres } as OperationFacecam) : operation,
      ...(OPERATIONS_DETOURAGE.has(op.type) ? { detourage: true } : {}),
    };
    facecam.passages.push(passage);
    appliquees.push(op);
  });

  if (trace && (trace.imageAvant || trace.teinteAvant || trace.sonAvant || trace.retablies || trace.cartesAutoRetirees || trace.cartesAutoRemises)) reglages.traces.push(trace);
  return { etat: { facecam, reglages }, appliquees, alertes, aDeposer, refusees, aConfirmer, indisponibles };
}

/** Vérif V1 : carte automatique posée dans la version et pas encore retirée. */
export function estCarteAutoActive(facecam: Pick<EntreesFacecam, "cartesAuto">, reglages: Pick<ReglagesMonteur, "cartesAutoRetirees">, id: string): boolean {
  return !!facecam.cartesAuto?.some((c) => c.id === id) && !(reglages.cartesAutoRetirees ?? []).includes(id);
}

/** Cartes automatiques encore posées (ni retirées, ni recouvertes par une carte du monteur : l'habillage en décide). */
export function cartesAutoActives(etat: EtatMonteur): NonNullable<EntreesFacecam["cartesAuto"]> {
  return (etat.facecam.cartesAuto ?? []).filter((c) => !(etat.reglages.cartesAutoRetirees ?? []).includes(c.id));
}

function textePassage(op: OperationFacecam): string | undefined {
  switch (op.type) {
    case "ajouterCarte":
      return op.textes.length ? op.textes.join(" · ") : op.description;
    case "ecranPartage":
      return op.textes.length ? op.textes.join(" · ") : op.description;
    case "miseEnPage":
      return op.description;
    case "texteDerriere":
    case "titre":
    case "generique":
      return op.texte;
    case "arretImage":
      return op.texte ?? undefined;
    default:
      return undefined;
  }
}

/** Recalcule les temps montés des passages après un changement de coupes (rétablir, couper) : ancres inchangées. */
export function recalerPassages(etat: EtatMonteur): EtatMonteur {
  const coupes = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
  return {
    ...etat,
    facecam: {
      ...etat.facecam,
      passages: etat.facecam.passages.map((p) => {
        const a = (p as PassageMonteur).ancre;
        if (!a) return p;
        const op = (p as PassageMonteur).operation as { type?: string; dureeSec?: number } | undefined;
        const debutSec = priseVersMontee(a.debutPriseSec, coupes);
        const finSec = op?.type === "generique" || op?.type === "arretImage" ? debutSec + (op.dureeSec ?? 0) : Math.max(debutSec, priseVersMontee(a.finPriseSec, coupes));
        return { ...p, debutSec, finSec };
      }),
    },
  };
}

/**
 * « Annuler » une consigne comprise : retire ses passages, ses coupes et ses bruitages, et remet l'image, la teinte, le
 * son et les coupes rétablies comme avant elle (sauf ce qu'une consigne plus récente a changé depuis). La consigne
 * reste visible, marquée « annulée ».
 */
export function annulerConsigne(etat: EtatMonteur, consigneId: string): EtatMonteur {
  const trace = etat.reglages.traces.find((t) => t.consigneId === consigneId);
  const plusRecentes = trace ? etat.reglages.traces.slice(etat.reglages.traces.indexOf(trace) + 1) : [];
  const image = { ...etat.facecam.image };
  for (const [cle, valeur] of Object.entries(trace?.imageAvant ?? {}) as [keyof ImageFacecam, CranImage][]) {
    if (!plusRecentes.some((t) => t.imageAvant && cle in t.imageAvant)) image[cle] = valeur;
  }
  let teinte = etat.reglages.teinte;
  if (trace?.teinteAvant !== undefined && !plusRecentes.some((t) => t.teinteAvant !== undefined)) teinte = trace.teinteAvant;
  let son = { ...etat.reglages.son };
  if (trace?.sonAvant && !plusRecentes.some((t) => t.sonAvant)) son = { ...son, ...trace.sonAvant };
  son.bruitages = son.bruitages.filter((b) => b.consigneId !== consigneId);
  const retablies = etat.facecam.coupes.retablies.filter((id) => !trace?.retablies?.includes(id));
  const consignes: ConsigneFacecam[] = etat.facecam.consignes.map((c) => (c.id === consigneId ? { ...c, etat: "annulee" } : c));
  return recalerPassages({
    facecam: {
      ...etat.facecam,
      image,
      coupes: { ...etat.facecam.coupes, retablies },
      passages: etat.facecam.passages.filter((p) => (p as PassageMonteur).consigneId !== consigneId),
      consignes,
    },
    reglages: {
      ...etat.reglages,
      teinte,
      son,
      coupesDemandees: etat.reglages.coupesDemandees.filter((c) => c.consigneId !== consigneId),
      cartesAutoRetirees: [...(etat.reglages.cartesAutoRetirees ?? []).filter((id) => !trace?.cartesAutoRetirees?.includes(id)), ...(trace?.cartesAutoRemises ?? [])],
      traces: etat.reglages.traces.filter((t) => t.consigneId !== consigneId),
    },
  });
}
