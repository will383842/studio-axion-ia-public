/**
 * MOTEUR « IMAGE → VIDÉO » (code IV, lot L15) : le contrat commun `MoteurVideo` posé sur la machine à états
 * `fabrication.ts`, sans rien réécrire.
 *
 * - Chaque `avancer` fait UN pas de la machine ; l'état (sérialisable) vit dans `travail.parametres.imageVideo`.
 * - Les deux portes de Will (carte, script) arrêtent le travail en échec RÉESSAYABLE, codes `IV_CARTE_A_VALIDER` et
 *   `IV_SCRIPT_A_VALIDER` (patron du cas concret, V4-3) : les services gardent la décision de Will, puis « Réessayer »
 *   la fait lire par la machine, sans rien repayer.
 * - « Réessayer » après un refus ne relance que l'étape arrêtée ; tout ce qui est payé reste dans l'état.
 * - Lancement réel REFUSÉ tant que le format est masqué et que Will n'a pas donné son accord d'essai
 *   (`entrees.imageVideo.accordEssaiReel`), même garde que la face caméra animée.
 * - Les outils réels (stockage, Claude, voix, rendu, budget) sont fournis par les SERVICES (`brancherServicesImageVideo`)
 *   ou injectés (tests) : ce moteur n'importe aucun service ni fournisseur.
 */
import type { AlerteQualite, CommandeFabrication, EtapeTravail, ErreurTravail, LigneCout, Travail } from "@/domaine/types";
import type { TypeImage } from "@/domaine/image-video/carte";
import { PHRASE_TIKTOK_RETIRE_IV, RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { formatImageVideo, ID_MOTEUR_IMAGE_VIDEO, schemaReglagesImageVideo } from "@/formats/image-video";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT, ZERO } from "@/lib/montants";
import type { Offre } from "./emprunts";
import {
  attendWillIV,
  avancerIV,
  centimesEurDeUsd,
  ETAPES_IV,
  etatInitialIV,
  PLAFOND_VIDEO_IV_CENTIMES,
  reprendreIV,
  tarifVoixCentimesEur,
  type DemandeFabricationIV,
  type EtapeChaineIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "./fabrication";

type MoteurVideo = import("@/moteurs/types").MoteurVideo;
type ContexteLancement = import("@/moteurs/types").ContexteLancement;
type DefinitionEtapeMoteur = import("@/moteurs/types").DefinitionEtapeMoteur;
type Estimation = import("@/moteurs/types").Estimation;
type ResultatFabrication = import("@/moteurs/types").ResultatFabrication;

export * from "./fabrication";
export const ID_MOTEUR_IV = ID_MOTEUR_IMAGE_VIDEO;

export const CODE_CARTE_A_VALIDER = "IV_CARTE_A_VALIDER";
export const CODE_SCRIPT_A_VALIDER = "IV_SCRIPT_A_VALIDER";
export const PHRASE_CARTE_A_VALIDER = "Vérifiez ce que j'ai compris de votre image, corrigez si besoin, puis validez la carte.";
export const PHRASE_SCRIPT_A_VALIDER = "Relisez le script et son prix, tranchez les phrases trop affirmatives, puis validez : la voix n'est payée qu'après.";
export const PHRASE_FORMAT_MASQUE = "Le format « Image → vidéo » n'est pas encore ouvert : un essai réel demande l'accord de Will.";

/* ------------------------------------------------------------------ */
/* Entrées de la commande                                                */
/* ------------------------------------------------------------------ */

/** Ce que la commande porte (`entrees.imageVideo`), posé par le service de lancement. */
export interface EntreesImageVideo {
  imageCle: string;
  empreinte?: string;
  reseaux: ReseauIV[];
  offre?: Offre;
  typeImpose?: TypeImage;
  /** Plafond de dépense de la vidéo (centimes d'euro) ; absent : `PLAFOND_VIDEO_IV_CENTIMES`. */
  plafondCentimes?: number;
  codeSuivi?: string;
  /** Accord de Will pour un essai réel tant que le format est masqué. */
  accordEssaiReel?: boolean;
  /**
   * Lot d'images : cette vidéo est fabriquée sans arrêt, contrôle automatique aux deux portes. `accordParVideoCentimes` :
   * le prix accordé pour cette vidéo, seul accord implicite de sa voix.
   */
  lot?: { id: string; rang: number; accordParVideoCentimes: number };
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function lireEntreesImageVideo(entrees: Record<string, unknown> | undefined): EntreesImageVideo {
  const e = objet(entrees?.imageVideo);
  const reseaux = Array.isArray(e.reseaux) ? RESEAUX_IV.filter((r) => (e.reseaux as unknown[]).includes(r)) : [...RESEAUX_IV];
  return {
    imageCle: typeof e.imageCle === "string" ? e.imageCle : "",
    ...(typeof e.empreinte === "string" ? { empreinte: e.empreinte } : {}),
    reseaux,
    ...(typeof e.offre === "string" ? { offre: e.offre as Offre } : {}),
    ...(typeof e.typeImpose === "string" ? { typeImpose: e.typeImpose as TypeImage } : {}),
    ...(typeof e.plafondCentimes === "number" && Number.isFinite(e.plafondCentimes) ? { plafondCentimes: e.plafondCentimes } : {}),
    ...(typeof e.codeSuivi === "string" ? { codeSuivi: e.codeSuivi } : {}),
    accordEssaiReel: e.accordEssaiReel === true,
    ...lotDe(e.lot),
  };
}

function lotDe(v: unknown): { lot?: NonNullable<EntreesImageVideo["lot"]> } {
  const l = objet(v);
  if (typeof l.id !== "string" || !l.id || typeof l.rang !== "number" || !Number.isInteger(l.rang) || l.rang < 1) return {};
  const accord = typeof l.accordParVideoCentimes === "number" && Number.isFinite(l.accordParVideoCentimes) ? Math.max(0, Math.floor(l.accordParVideoCentimes)) : 0;
  return { lot: { id: l.id, rang: l.rang, accordParVideoCentimes: accord } };
}

/** La demande de la machine pour une commande (réglages du format lus et bornés par son schéma). */
export function demandeDeLaCommande(commande: CommandeFabrication, versionId: string, numeroVersion?: number): DemandeFabricationIV {
  const e = lireEntreesImageVideo(commande.entrees);
  const reglages = schemaReglagesImageVideo.parse(commande.reglages ?? {});
  return {
    videoId: commande.videoId,
    versionId,
    image: { cle: e.imageCle, ...(e.empreinte ? { empreinte: e.empreinte } : {}) },
    reseaux: e.reseaux,
    ...(e.offre ? { offre: e.offre } : {}),
    ...(e.typeImpose ? { typeImpose: e.typeImpose } : {}),
    validationCarte: reglages.validationCarte,
    appelCommentaire: reglages.appelCommentaire,
    plafondCentimes: e.plafondCentimes ?? PLAFOND_VIDEO_IV_CENTIMES,
    tauxUsdEur: commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT,
    ...(numeroVersion !== undefined ? { numeroVersion } : {}),
    codeSuivi: e.codeSuivi ?? `iv-${commande.videoId}`,
    ...(e.lot ? { lot: { id: e.lot.id, rang: e.lot.rang } } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Outils fournis par les services                                       */
/* ------------------------------------------------------------------ */

export type FabriqueOutilsImageVideo = (commande: CommandeFabrication, travailId: string, options?: { relance: number }) => Promise<OutilsFabricationIV | null>;

export interface ServicesImageVideo {
  outils?: FabriqueOutilsImageVideo;
  /** Numéro de la version (liens suivis « 0042-IV-YS »). */
  numeroVersion?: (versionId: string) => Promise<number | undefined>;
}

const cleServices = Symbol.for("studio-axion-ia.image-video-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesImageVideo };

export function brancherServicesImageVideo(s: ServicesImageVideo): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesImageVideo(): ServicesImageVideo {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

export interface DependancesMoteurImageVideo extends ServicesImageVideo {
  /** Statut du format (tests) ; défaut : celui de la fiche. */
  statutFormat?: "masque" | "actif";
}

/* ------------------------------------------------------------------ */
/* Étapes et estimation                                                  */
/* ------------------------------------------------------------------ */

const NOMS: Readonly<Record<EtapeChaineIV, { nom: string; icone: string; dureeEstimeeSec: number }>> = {
  lecture: { nom: "La lecture de l'image", icone: "oeil", dureeEstimeeSec: 60 },
  "carte-a-valider": { nom: "Ce que j'ai compris", icone: "coche", dureeEstimeeSec: 5 },
  ecriture: { nom: "Le script", icone: "stylo", dureeEstimeeSec: 90 },
  "script-a-valider": { nom: "Votre script", icone: "coche", dureeEstimeeSec: 5 },
  voix: { nom: "La voix", icone: "micro", dureeEstimeeSec: 120 },
  "mise-en-scene": { nom: "La mise en scène", icone: "baguette", dureeEstimeeSec: 10 },
  rendu: { nom: "Le rendu", icone: "film", dureeEstimeeSec: 300 },
  controles: { nom: "Les contrôles", icone: "bouclier", dureeEstimeeSec: 120 },
  livraison: { nom: "Les versions par réseau", icone: "telecharger", dureeEstimeeSec: 5 },
};

export function etapesImageVideo(): DefinitionEtapeMoteur[] {
  return ETAPES_IV.map((cle, i) => ({ cle, ...NOMS[cle], dependDe: i ? [ETAPES_IV[i - 1]] : [] }));
}

/** Plan § 9, au pire (dollars) : lecture (2 lectures, une relance chacune), écriture (2 appels), relecture par version. */
export const PRIX_AU_PIRE_USD = Object.freeze({ lecture: 0.36, ecriture: 0.5, relectureParVersion: 0.5, transcriptionParVersion: 0.012 });
/** Caractères dits par seconde de voix (le débit de référence en mots de 6 caractères, espaces compris : 20,4 à 3,4 mots/s). */
const CARACTERES_PAR_SECONDE = DEBIT_MOTS_PAR_SEC * 6;

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, total: number, nature: LigneCout["nature"] = "estime"): LigneCout {
  return { etape, fournisseur, unite, quantite, prixUnitaire: centimes(quantite ? Math.ceil(total / quantite) : 0), total: centimes(total), nature };
}

/** Prix au pire d'une vidéo, avant toute lecture (la caisse réserve ensuite le pire coût exact de chaque appel). */
export function estimerImageVideo(commande: CommandeFabrication): Estimation {
  const e = lireEntreesImageVideo(commande.entrees);
  const taux = commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT;
  const reseaux = e.reseaux.length || RESEAUX_IV.length;
  // Versions : une par fin distincte (≤ réseaux), plus une courte au plus par version.
  const versions = 2 * reseaux;
  const caracteres = Math.ceil(Math.max(commande.dureeCibleSec || 50, 30) * CARACTERES_PAR_SECONDE) + reseaux * 160;
  const voix = Math.ceil(caracteres * 6 * tarifVoixCentimesEur(CENTIMES_USD_PAR_CARACTERE_HEYGEN, taux) - 1e-9);
  const lignes = [
    ligne("Lecture de l'image", "anthropic", "appel", 4, centimesEurDeUsd(PRIX_AU_PIRE_USD.lecture, taux)),
    ligne("Écriture du script", "anthropic", "appel", 2, centimesEurDeUsd(PRIX_AU_PIRE_USD.ecriture, taux)),
    ligne("Voix", "heygen", "caractere", caracteres * 6, voix),
    ligne("Relecture des images finales", "anthropic", "appel", versions, centimesEurDeUsd(PRIX_AU_PIRE_USD.relectureParVersion * versions, taux)),
    ligne("Écoute", "transcription", "appel", versions, centimesEurDeUsd(PRIX_AU_PIRE_USD.transcriptionParVersion * versions, taux)),
    ligne("Montage image → vidéo", "studio", "forfait", 1, 0),
  ];
  return { dureeFabricationSec: ETAPES_IV.reduce((s, k) => s + NOMS[k].dureeEstimeeSec, 0), lignes, total: centimes(lignes.reduce((s, l) => s + l.total.centimes, 0)) };
}

/** Étape de la chaîne où se paie chaque ligne du prix au pire (même ordre que `estimerImageVideo`). */
const ETAPE_DES_LIGNES: readonly EtapeChaineIV[] = ["lecture", "ecriture", "voix", "controles", "controles", "rendu"];

/**
 * Plafond proposé à Will pour « Relever le plafond » (centimes d'euro) : ce qui est déjà engagé, plus le pire coût de
 * tout ce qui reste à faire depuis l'étape courante (ou arrêtée), arrondi à l'euro au-dessus ; toujours au-dessus du
 * plafond actuel. PUR.
 */
export function plafondProposeIV(etat: Pick<EtatFabricationIV, "demande" | "caisse" | "etape" | "refus">): number {
  const engage = etat.caisse.reservations.reduce((s, r) => s + r.centimes, 0);
  const etape = etat.etape === "refusee" ? (etat.refus?.etape ?? "lecture") : etat.etape;
  const depuis = etape === "prete" ? ETAPES_IV.length : ETAPES_IV.indexOf(etape);
  const commande = { entrees: { imageVideo: { reseaux: [...etat.demande.reseaux] } }, tauxUsdEur: etat.demande.tauxUsdEur, dureeCibleSec: 50 } as unknown as CommandeFabrication;
  const restant = estimerImageVideo(commande).lignes.reduce((s, l, i) => s + (ETAPES_IV.indexOf(ETAPE_DES_LIGNES[i]) >= depuis ? l.total.centimes : 0), 0);
  return Math.max(Math.ceil((engage + restant) / 100) * 100, etat.caisse.plafondCentimes + 100);
}

/* ------------------------------------------------------------------ */
/* Travaux                                                               */
/* ------------------------------------------------------------------ */

const lireEtat = (t: Travail): EtatFabricationIV | null => {
  const e = t.parametres?.imageVideo as EtatFabricationIV | undefined;
  return e && typeof e === "object" && e.version === "fabrication-iv/1" ? e : null;
};
const avecEtat = (t: Travail, e: EtatFabricationIV): Travail => ({ ...t, parametres: { ...t.parametres, imageVideo: e } });

function nouveauTravail(ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatFabricationIV | null): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const type = ctx.type ?? "fabrication";
  const defs = etapesImageVideo();
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_IV,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: etat ? { imageVideo: etat } : {},
  };
}

/**
 * Fabrication MENÉE PAR LE LANCEUR (`scripts/image-video/fabriquer.ts`) : son travail n'est qu'une VITRINE (l'interface y
 * lit la carte et le script à valider, et y garde les décisions de Will) ; la boucle de fond ne le fait jamais avancer,
 * le lanceur seul avance la fabrication. Deux lanceurs sur la même vidéo s'excluent par un bail dans la base du studio
 * (`verrouillerLanceurIV`, services) ; cette marque ne protège QUE de la boucle de fond.
 */
export const CLE_LANCEUR_IV = "lanceurIV";

/** Travail vitrine d'une fabrication menée par le lanceur, d'après son état (PUR). */
export function travailVitrineIV(ctx: Pick<ContexteLancement, "travailId" | "versionId" | "titre" | "maintenant">, commande: CommandeFabrication, etat: EtatFabricationIV, avant?: Travail | null): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const base = avant ?? nouveauTravail({ ...ctx, type: "fabrication" } as ContexteLancement, commande, etat);
  const t = suivant({ ...base, parametres: { ...base.parametres, imageVideo: etat, [CLE_LANCEUR_IV]: true } }, etat, maintenant);
  return t;
}

const meneParLeLanceur = (t: Travail) => t.parametres?.[CLE_LANCEUR_IV] === true;

function travailRefuse(ctx: ContexteLancement, commande: CommandeFabrication, code: string, message: string): Travail {
  const t = nouveauTravail(ctx, commande, null);
  const erreur: ErreurTravail = { code, reessayable: false, messagePourWill: message };
  return { ...t, statut: "echec", erreur, termineLe: t.creeLe, etapes: t.etapes.map((e) => ({ ...e, statut: "ignoree" as const })) };
}

/** Voix payée pendant ce travail (chaque lecture HeyGen, dès qu'elle est lue). Les appels Claude sont déjà enregistrés par leur chemin de dépense. */
function lignesPayeesDe(etat: EtatFabricationIV | null): LigneCout[] {
  const payees = etat?.voix?.voix.payees ?? [];
  const total = payees.reduce((s, p) => s + p.coutCentimes, 0);
  if (!total) return [];
  return [ligne("Voix", payees[0]?.fournisseur ?? "heygen", "caractere", payees.reduce((s, p) => s + p.caracteres, 0), total, "reel")];
}

/** Erreur montrée pour l'état (porte de Will, refus) ; `null` : rien d'arrêté. */
function erreurDe(etat: EtatFabricationIV): { cle: EtapeChaineIV; erreur: ErreurTravail } | null {
  const will = attendWillIV(etat);
  // Lot : la vidéo a été mise de côté à cette porte ; Will voit pourquoi (les codes ne changent pas).
  const miseDeCote = etat.miseDeCote ? `Mise de côté : ${etat.miseDeCote.motif}` : null;
  if (will === "carte") return { cle: "carte-a-valider", erreur: { code: CODE_CARTE_A_VALIDER, reessayable: true, messagePourWill: miseDeCote ?? PHRASE_CARTE_A_VALIDER } };
  if (will === "script") return { cle: "script-a-valider", erreur: { code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: miseDeCote ?? PHRASE_SCRIPT_A_VALIDER } };
  if (etat.etape === "refusee" && etat.refus) {
    const r = etat.refus;
    return { cle: r.etape, erreur: { code: r.code, reessayable: r.reessayable, messagePourWill: r.message, ...(r.phrases?.length ? { detailTechnique: r.phrases.join("\n") } : {}) } };
  }
  return null;
}

function statutsDe(travail: Travail, etat: EtatFabricationIV): EtapeTravail[] {
  const arret = erreurDe(etat);
  const courante = etat.etape === "prete" ? ETAPES_IV.length : etat.etape === "refusee" ? ETAPES_IV.indexOf(etat.refus?.etape ?? "lecture") : ETAPES_IV.indexOf(etat.etape);
  return travail.etapes.map((e) => {
    const i = ETAPES_IV.indexOf(e.cle as EtapeChaineIV);
    if (arret && e.cle === arret.cle) return { ...e, statut: "echec" as const, progression: 0, erreur: arret.erreur };
    if (i < courante) return { ...e, statut: "terminee" as const, progression: 100, erreur: undefined, coutReel: e.cle === "voix" ? centimes(lignesPayeesDe(etat)[0]?.total.centimes ?? 0) : ZERO };
    if (i === courante) return { ...e, statut: "en_cours" as const, progression: 10, erreur: undefined };
    return { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined };
  });
}

function suivant(travail: Travail, etat: EtatFabricationIV, maintenant: number): Travail {
  const etapes = statutsDe(travail, etat);
  const enEchec = etapes.find((e) => e.statut === "echec");
  const fini = etat.etape === "prete";
  const iso = new Date(maintenant).toISOString();
  return {
    ...avecEtat(travail, etat),
    etapes,
    progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1)),
    statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
    erreur: enEchec?.erreur,
    modifieLe: iso,
    termineLe: fini || enEchec ? iso : undefined,
  };
}

export function resultatDe(etat: EtatFabricationIV, maintenant: number): ResultatFabrication {
  const mentions = etat.controles?.verdict?.mentions ?? [];
  const alertes: AlerteQualite[] = mentions.map((message) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message }));
  const note = Math.max(60, 90 - 3 * mentions.length);
  // Première livraison : de préférence un fichier 9:16 (Reel, Instagram…) ; LinkedIn seul (4:5) est déclaré en 4:5.
  const livrees = (etat.livraison ?? []).filter((l) => l.fichierCle);
  const premiere = livrees.find((l) => l.format !== "4:5") ?? livrees[0];
  const quatreCinq = premiere?.format === "4:5";
  const sorties = premiere
    ? [{ ratio: (quatreCinq ? "4:5" : "9:16") as "4:5" | "9:16", fichierCle: premiere.fichierCle!, vignetteCle: premiere.fichierCle!, resolution: quatreCinq ? "1080x1350" : "1080x1920", dureeSec: premiere.dureeSec ?? 0, taille: 0, rapportQualite: { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: true }, alertes, niveauSonoreLufs: -14 } }]
    : [];
  return {
    sorties,
    noteQualite: { globale: note, alertes },
    lignesReelles: [...lignesPayeesDe(etat), ligne("Montage image → vidéo", "studio", "forfait", 1, 0, "reel")],
    projetMontage: {
      moteur: ID_MOTEUR_IV,
      imageVideo: {
        livraison: etat.livraison,
        carte: etat.carte,
        fiche: etat.script?.fiche,
        verdict: etat.controles?.verdict,
        engageCentimes: etat.caisse.reservations.reduce((s, r) => s + r.centimes, 0),
        journal: etat.journal,
        le: new Date(maintenant).toISOString(),
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Le moteur                                                             */
/* ------------------------------------------------------------------ */

const NON_RELIE = "« Image → vidéo » n'est pas relié (stockage, voix, Claude ou serveur de rendu). Vérifiez Réglages > Connexions, puis réessayez.";
const VERSION_2 = "viendra plus tard";

export function creerMoteurMontageImageVideo(dep: DependancesMoteurImageVideo = {}): MoteurVideo {
  const fabrique = (): FabriqueOutilsImageVideo | undefined => dep.outils ?? servicesImageVideo().outils;
  const statut = () => dep.statutFormat ?? formatImageVideo.statut;
  function refusLancement(commande: CommandeFabrication): { code: string; message: string } | null {
    const e = lireEntreesImageVideo(commande.entrees);
    if (statut() === "masque" && !e.accordEssaiReel) return { code: "IV_FORMAT_MASQUE", message: PHRASE_FORMAT_MASQUE };
    if (!e.imageCle) return { code: "IV_SANS_IMAGE", message: "Déposez l'image de cette vidéo." };
    if (!e.reseaux.length) {
      const enregistres = objet(commande.entrees?.imageVideo).reseaux;
      const queTiktok = Array.isArray(enregistres) && enregistres.includes("tiktok");
      return { code: "IV_SANS_RESEAU", message: queTiktok ? PHRASE_TIKTOK_RETIRE_IV : "Cochez au moins un réseau." };
    }
    const reglages = schemaReglagesImageVideo.safeParse(commande.reglages ?? {});
    if (!reglages.success) return { code: "IV_REGLAGE", message: "Ce réglage n'existe pas pour « Image → vidéo » (une image très complexe donne une seule vidéo en chapitres)." };
    return null;
  }

  return {
    id: ID_MOTEUR_IV,
    nom: "Montage image → vidéo",
    capacites: { dureeMaxSec: 90, ratios: ["9:16"], langues: ["fr-FR"], retoucheParPlan: false, asynchrone: true, accordExige: false, maquette: false },

    async estimer(commande) {
      return estimerImageVideo(commande);
    },
    async estimerRetouche() {
      return { dureeFabricationSec: 10, lignes: [ligne("Montage image → vidéo", "studio", "forfait", 1, 0)], total: ZERO };
    },
    async estimerReexport() {
      return { dureeFabricationSec: 10, lignes: [ligne("Montage image → vidéo", "studio", "forfait", 1, 0)], total: ZERO };
    },

    etapes: () => etapesImageVideo(),

    refusAuLancement: refusLancement,
    refusRetouche: () => ({ code: "RETOUCHE_NON_PRISE_EN_CHARGE", message: `La retouche d'une vidéo « Image → vidéo » ${VERSION_2}.` }),

    async lancer(commande, contexte) {
      const refus = refusLancement(commande);
      if (refus) return travailRefuse(contexte, commande, refus.code, refus.message);
      const numero = await (dep.numeroVersion ?? servicesImageVideo().numeroVersion)?.(contexte.versionId);
      // Refus au lancement, avant toute dépense : sans numéro de version, le lien suivi ne peut pas être posé (ADR 0002).
      if (numero === undefined) return travailRefuse(contexte, commande, "NUMERO_VERSION_INTROUVABLE", "Le numéro de la version est introuvable : le lien suivi ne peut pas être posé.");
      return nouveauTravail(contexte, commande, etatInitialIV(demandeDeLaCommande(commande, contexte.versionId, numero)));
    },

    async avancer(travail, commande, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule" || travail.statut === "echec") return { travail };
      // Menée par le lanceur : il avance seul la fabrication (la vitrine n'est que lue et mise à jour par lui).
      if (meneParLeLanceur(travail)) return { travail };
      const etat = lireEtat(travail);
      if (!etat) return { travail: { ...travail, statut: "echec", erreur: { code: "IV_SANS_ETAT", reessayable: false, messagePourWill: "Cette fabrication a perdu son état : relancez la vidéo." }, termineLe: new Date(maintenant).toISOString() } };
      let outils: OutilsFabricationIV | null = null;
      try {
        outils = (await fabrique()?.(commande, travail.id, { relance: Math.max(0, travail.tentatives - 1) })) ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { travail: { ...suivant(travail, etat, maintenant), statut: "echec", erreur: { code: "IV_NON_RELIE", reessayable: true, messagePourWill: `${message} Vous pouvez réessayer.` } } };
      }
      if (!outils) return { travail: { ...suivant(travail, etat, maintenant), statut: "echec", erreur: { code: "IV_NON_RELIE", reessayable: true, messagePourWill: NON_RELIE } } };
      const apres = await avancerIV(etat, outils);
      const t = suivant(travail, apres, maintenant);
      return apres.etape === "prete" ? { travail: t, resultat: resultatDe(apres, maintenant) } : { travail: t };
    },

    async reessayer(travail, maintenant = Date.now()) {
      const etat = lireEtat(travail);
      const repris = etat ? reprendreIV(etat) : null;
      // 18/10 (v-dd3049053f88, lancée par le lanceur) : un état sans numéro de version fait échouer les contrôles (« Le numéro
      // de la version est introuvable : le lien suivi ne peut pas être posé »). Le numéro est relu dans la version du travail.
      if (repris && repris.demande.numeroVersion === undefined && travail.versionId) {
        const numero = await (dep.numeroVersion ?? servicesImageVideo().numeroVersion)?.(travail.versionId);
        if (numero !== undefined) repris.demande = { ...repris.demande, numeroVersion: numero };
      }
      const base = repris ? avecEtat(travail, repris) : travail;
      return {
        ...base,
        etapes: travail.etapes.map((e) => (e.statut === "echec" ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)),
        statut: "en_cours",
        erreur: undefined,
        termineLe: undefined,
        tentatives: travail.tentatives + 1,
        modifieLe: new Date(maintenant).toISOString(),
      };
    },

    async retoucher({ commande, contexte }) {
      return travailRefuse({ ...contexte, type: "retouche" }, commande, "RETOUCHE_NON_PRISE_EN_CHARGE", `La retouche ${VERSION_2} : relancez une vidéo depuis l'image.`);
    },
    async reexporter({ commande, contexte }) {
      return travailRefuse({ ...contexte, type: "reexport" }, commande, "REEXPORT_NON_PRIS_EN_CHARGE", `Un autre format d'image ${VERSION_2} : la vidéo sort déjà une version par réseau coché.`);
    },
    async recalquer({ commande, contexte }) {
      return travailRefuse({ ...contexte, type: "recalque-sous-titres" }, commande, "RECALQUE_NON_PRIS_EN_CHARGE", `La correction des sous-titres seuls ${VERSION_2} : ils suivent la voix.`);
    },
    async maquette(commande) {
      return { dureeSec: commande.dureeCibleSec };
    },

    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return { ...travail, statut: "annule", etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, coutReel: undefined, erreur: undefined })), erreur: undefined, modifieLe: iso, termineLe: iso };
    },

    lignesPayees(travail) {
      return lignesPayeesDe(lireEtat(travail));
    },
  };
}

export const moteurMontageImageVideo = creerMoteurMontageImageVideo();
