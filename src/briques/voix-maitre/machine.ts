/**
 * SOUS-MACHINE « TEXTE VALIDÉ → SON MAÎTRE » (ORG-07b, U-5 partie 2). Déplacée telle quelle depuis `avancerVoix`
 * (`src/moteurs/montage-avocat/index.ts`) : lecture par la voix (payée UNE fois), copie différée du son, calage des
 * mots (aligneur réel seulement), analyse des respirations puis nettoyage des blancs (`studio-rendu`, opération
 * `nettoyage-audio`, file courte). Phases `a-lire` … `faite` ; les phases propres à l'avocat (prises filmées,
 * assemblage d'une version par réseau) restent dans le moteur.
 *
 * Tout ce qui touche l'extérieur est INJECTÉ (comme `briques/motion/rendu-cartes.ts`) : voix, stockage, aligneur,
 * service de rendu, clés de stockage, empreinte, contrôle avant lecture (budget, réservation, voix compatible). La
 * brique n'importe aucun moteur ni aucun fournisseur réel ; elle se teste avec des doubles.
 *
 * Reprise après panne : l'état rendu après CHAQUE phase est gardé par l'appelant ; la voix payée est rendue tout de
 * suite (jamais relue) ; un son maître déjà fait dont l'empreinte est égale est repris sans être repayé.
 *
 * VOIX DE RÉFÉRENCE (14/10, `reference.ts`) : avec `ressemblance` actif et un rendu réel, chaque lecture payée et rangée
 * est MESURÉE (`studio-rendu`, `nettoyage-audio` mode `mesure-voix`) ; hors tolérance, la voix est relue (nouvelle
 * demande, budget revérifié par `avantLecture`) au plus `relancesMax` fois, puis la prise la plus proche est gardée et
 * TOUTES les lectures sont comptées (`coutCentimes`, `caracteres`) et tracées (`brut.ressemblance`). Coupé, absent ou
 * rendu simulé : phases et demandes d'avant, strictement. Une relance est toujours une lecture NEUVE (`nouvelleLecture`,
 * 15/10) : relire le même texte sans elle rend le même son.
 *
 * RE-MESURE (15/10, mesure version 2, v-dd3049053f88) : un son maître fait dont une prise a été mesurée par une version
 * antérieure de la mesure (`VERSION_MESURE_VOIX`) peut repartir en « a-remesurer » (`versRemesure`) : chaque prise
 * ancienne est mesurée de nouveau (`studio-rendu`, gratuit) sur SON fichier déjà payé, son verdict est recalculé, puis
 * le son maître redevient « faite ». Aucune de ces phases n'appelle la voix : rien n'est relu ni repayé. La prise gardée
 * (`retenue`, déjà nettoyée et montée) ne change pas ; seul son verdict suit la mesure juste.
 */
import { appliquerAlignement, causeApproximation, demandeAlignement, ESSAIS_ALIGNEMENT } from "@/briques/calage/alignement";
import { horodaterTexte } from "@/domaine/derivations";
import type { RapportAlignement, ReglagesVoix } from "@/domaine/types";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { blancsLongs, calculerCoupures, coupuresAppliquees, debitEtVitesseConseillee, decalerMots, intervallesDesMesures, type Coupure, type Intervalle, type ReglesNettoyage } from "./nettoyage";
import { choisirMeilleurePrise, comparerAReference, lecturesVoixMax, REFERENCE_V4, mesureVoixDesMesures, rangMesureAncienne, versionMesureDesMesures, VERSION_MESURE_VOIX, type MesureVoix, type ReglageRessemblanceVoix, type TraitementMesureVoix } from "./reference";
import type { AudioBrut, AudioMaitre, PriseVoixMesuree, RapportRessemblanceVoix } from "./types";

/** Nouvelles demandes au conteneur après un échec passager d'une opération (puis la reprise de la boucle prend le relais). */
export const ESSAIS_RENDU = 3;

/**
 * Lot R6 : durée des adresses signées du son données à l'aligneur (15 min). Il le lit dès qu'il prend la demande ; une
 * adresse périmée (file longue) revient « à refaire » et la demande suivante en porte une neuve.
 */
export const DUREE_ADRESSE_CALAGE_SEC = 900;

/** Où en est la voix maître (gardé par l'appelant entre deux tours de la boucle). */
export type EtatVoixMaitre =
  | { phase: "a-lire" }
  /* CORRECTEUR 1 — B2 : voix lue et payée, son à ranger dans le stockage (`brut.copieEnAttente`). */
  | { phase: "a-copier"; brut: AudioBrut; texte: string; prises?: PriseVoixMesuree[] }
  /* 14/10, voix de référence : lecture rangée, à mesurer (`prises` : les lectures déjà mesurées de ce texte). */
  | { phase: "a-mesurer"; brut: AudioBrut; texte: string; prises: PriseVoixMesuree[] }
  | { phase: "mesure"; brut: AudioBrut; texte: string; prises: PriseVoixMesuree[]; demande: DemandeRendu; essai?: number }
  /* Toutes les lectures faites s'écartent de la référence : une nouvelle lecture payée (budget revérifié avant). */
  | { phase: "a-relire"; texte: string; prises: PriseVoixMesuree[] }
  /* Lot « calage » (02/10) : seulement quand l'aligneur est réel. */
  | { phase: "a-aligner"; brut: AudioBrut; texte: string; essai?: number }
  | { phase: "alignement"; brut: AudioBrut; texte: string; demande: DemandeAlignement; essai?: number }
  | { phase: "a-analyser"; brut: AudioBrut }
  | { phase: "analyse"; brut: AudioBrut; demande: DemandeRendu; essai?: number }
  | { phase: "nettoyage"; brut: AudioBrut; coupures: Coupure[]; respirations: Intervalle[]; demande: DemandeRendu; essai?: number }
  | { phase: "faite"; audio: AudioMaitre }
  /* 15/10 : son maître fait, prise `rang` du rapport de ressemblance à re-mesurer (mesure d'une version antérieure). */
  | { phase: "a-remesurer"; audio: AudioMaitre; rang: number }
  | { phase: "remesure"; audio: AudioMaitre; rang: number; demande: DemandeRendu; essai?: number };

/** Ce que la sous-machine demande à son appelant (tout est injecté ; rien n'est lu ailleurs). */
export interface OutilsVoixMaitre {
  voix: () => FournisseurVoix;
  stockage: () => StockageFichiers;
  aligneur: () => FournisseurAlignement;
  rendu: () => ServiceRendu;
  /** Rendu simulé : aucun fichier produit, le son brut sert de son maître ; adresses non `https` tolérées. */
  renduEstSimule: () => boolean;
  /** Clé de stockage d'un fichier produit (`analyse.json`, `audio-maitre.wav`). */
  cle: (nom: string) => string;
  /** Préfixe des identifiants des demandes (rendu, alignement). */
  idBase: string;
  /** Texte à lire (prononciations déjà substituées), calculé seulement quand la voix est lue. */
  texte: () => string;
  /** Empreinte du son maître attendu (même texte, même voix, mêmes réglages = même empreinte). */
  empreinte: () => string;
  /** Son maître déjà fait (maquette) : repris sans être repayé si son empreinte est égale. */
  existant?: Pick<AudioMaitre, "fichierCle" | "empreinte" | "mots" | "dureeSec" | "sousTitresApproximatifs">;
  /** Lecture : identifiant de la voix chez le fournisseur, réglages, taux de change figé. */
  idVoix: string;
  reglages?: ReglagesVoix;
  tauxUsdEur?: number;
  /** Fournisseur noté sur un son repris (sinon « simulation »). */
  fournisseurVoix?: string;
  /** Faut-il caler les mots sur le son (lot R6, C6) ? */
  caler: (motsEstimes: boolean) => boolean;
  /** Lecture neuve demandée au fournisseur (cache ignoré) : relecture d'une prise refusée. */
  nouvelleLecture?: boolean;
  /** Traitement de la mesure de voix demandé au rendu (19/10, Image → vidéo). Jamais dans l'empreinte. */
  mesureVoix?: TraitementMesureVoix;
  /** Référence de la voix (20/10, Image → vidéo : 158,4 Hz, puis 188,2 Hz depuis le 23/10/2026). Absente : `REFERENCE_V4` (nouvelle voix depuis le 23/10/2026). Jamais dans l'empreinte. */
  reference?: Readonly<MesureVoix>;
  regles: ReglesNettoyage;
  /**
   * Appelé juste AVANT la lecture payante (budget, réservation, voix compatible) : lever une erreur l'interdit, aucun
   * appel n'est alors fait à la voix.
   */
  avantLecture?: () => void | Promise<void>;
  /** Erreur levée quand le stockage n'est pas relié (l'appelant garde son erreur typée). Défaut : `ErreurVoixMaitre`. */
  erreurStockage?: (message: string) => Error;
  /**
   * 14/10 (ajout pur) : contrôle de ressemblance à la voix de référence (réglage global `voix.ressemblance`, figé au
   * lancement). Absent ou coupé : comportement d'avant strictement. Le prix confirmé doit couvrir `lecturesVoixMax`.
   */
  ressemblance?: ReglageRessemblanceVoix;
}

export class ErreurVoixMaitre extends Error {
  constructor(
    public readonly code: "STOCKAGE_NON_RELIE",
    public readonly messagePourWill: string,
  ) {
    super(messagePourWill);
    this.name = "ErreurVoixMaitre";
  }
}

/**
 * Lot R6 : la voix passe à l'analyse, sa cause d'approximation décidée UNE fois (`causeApproximation`) et gardée dans
 * l'état (puis dans `voixBrute`) : `motsEstimes` ne sert plus, rien n'est recalculé à la reprise.
 */
export function versAnalyse(brut: AudioBrut, aligneurReel: boolean, rapport?: RapportAlignement): Extract<EtatVoixMaitre, { phase: "a-analyser" }> {
  const { motsEstimes, ...reste } = brut;
  const approximatif = causeApproximation({ motsEstimes: !!motsEstimes, aligneurReel, rapport });
  return { phase: "a-analyser", brut: { ...reste, ...(approximatif ? { approximatif } : {}) } };
}

async function adresses(o: OutilsVoixMaitre, cleEntree: string, cleSortie: string, mime: string): Promise<{ entree: string; depot: string }> {
  const s = o.stockage();
  const entree = s.urlLectureDuree ? await s.urlLectureDuree(cleEntree, 3600) : await s.urlLecture(cleEntree);
  const depot = s.urlDepotDuree ? await s.urlDepotDuree(cleSortie, 3600, mime) : "";
  if (!o.renduEstSimule() && (!/^https?:\/\//.test(entree) || !depot)) {
    const message = "Le stockage des fichiers n'est pas relié : le son ne peut pas être préparé. Vérifiez Réglages > Connexions.";
    throw o.erreurStockage ? o.erreurStockage(message) : new ErreurVoixMaitre("STOCKAGE_NON_RELIE", message);
  }
  return { entree: /^https?:\/\//.test(entree) ? entree : `https://simulation.invalid${entree.startsWith("/") ? "" : "/"}${entree}`, depot };
}

async function soumettre(o: OutilsVoixMaitre, brut: AudioBrut, nom: "analyse" | "nettoyage", parametres: Record<string, unknown>, essai = 0): Promise<DemandeRendu> {
  const idBase = o.idBase;
  const sortieCle = o.cle(nom === "analyse" ? "analyse.json" : "audio-maitre.wav");
  const { entree, depot } = await adresses(o, brut.fichierCle, sortieCle, nom === "analyse" ? "application/json" : "audio/wav");
  const demande: DemandeRendu = { idRendu: essai ? `${idBase}-${nom}-e${essai}` : `${idBase}-${nom}`, operation: "nettoyage-audio", file: "courte", entrees: { audio: entree }, sortie: { urlDepot: depot, cle: sortieCle }, parametres };
  await o.rendu().soumettre(demande);
  return demande;
}

/** Le contrôle de ressemblance tourne-t-il ? (actif, et rendu réel : en simulation rien n'est mesuré). */
const ressemblanceActive = (o: OutilsVoixMaitre) => !!o.ressemblance?.actif && !o.renduEstSimule();

/** Empreinte de la demande de la `n`-ième lecture d'un même texte (1 = la première). */
const empreinteDemande = (o: OutilsVoixMaitre, n: number) => `${o.empreinte()}#lecture-${n}`;

async function soumettreMesure(o: OutilsVoixMaitre, brut: Pick<AudioBrut, "fichierCle">, n: number, essai = 0, remesure = false): Promise<DemandeRendu> {
  // Re-mesure : autre fichier de sortie, autre identifiant (le service ne rend jamais l'ancienne mesure gardée).
  const suffixe = remesure ? `-v${VERSION_MESURE_VOIX}` : "";
  const sortieCle = o.cle(`mesure-voix${suffixe}-l${n}.json`);
  const { entree, depot } = await adresses(o, brut.fichierCle, sortieCle, "application/json");
  const id = `${o.idBase}-${remesure ? "remesure" : "mesure"}${suffixe}-l${n}`;
  const demande: DemandeRendu = { idRendu: essai ? `${id}-e${essai}` : id, operation: "nettoyage-audio", file: "courte", entrees: { audio: entree }, sortie: { urlDepot: depot, cle: sortieCle }, parametres: { mode: "mesure-voix", ...(o.mesureVoix ? { traitement: o.mesureVoix } : {}) } };
  await o.rendu().soumettre(demande);
  return demande;
}

/** Lecture payée de la voix (budget vérifié juste avant). Rend le son brut ; rien d'autre n'est appelé dans ce tour. */
async function lireLaVoix(o: OutilsVoixMaitre, relance = false): Promise<{ brut: AudioBrut; texte: string }> {
  await o.avantLecture?.();
  const voix = o.voix();
  const texte = o.texte();
  const reglages: ReglagesVoix = o.reglages ?? { vitesse: 1, stabilite: 45, emotion: 30 };
  // Les prononciations sont DÉJÀ substituées (report.ts garde la correspondance) : la voix ne les refait pas.
  // CORRECTEUR 1 — B2 : copie du son dans le stockage DIFFÉRÉE (tour suivant) : le son payé est gardé dès la réponse.
  const r = await voix.lire({ idExterne: o.idVoix, texte, reglages, prononciations: [], motsParSeconde: 4.4, copieDifferee: true, ...(o.tauxUsdEur ? { tauxUsdEur: o.tauxUsdEur } : {}), ...(o.nouvelleLecture || relance ? { nouvelleLecture: true } : {}) });
  const mots = r.mots.length ? r.mots : horodaterTexte(texte, 4.4, reglages.vitesse || 1);
  const motsEstimes = !r.mots.length || voix.capacites.horodatageMots === false;
  const brut: AudioBrut = { fichierCle: r.fichierCle, dureeSec: Math.max(r.dureeSec, mots.at(-1)?.finSec ?? 0), mots, coutCentimes: r.cout.centimes, fournisseur: voix.id, caracteres: texte.length, ...(motsEstimes ? { motsEstimes: true } : {}), ...(r.copieEnAttente ? { copieEnAttente: { ...r.copieEnAttente, idExterne: o.idVoix } } : {}) };
  return { brut, texte };
}

/**
 * La prise gardée (celle qui ressemble, sinon la plus proche) devient LE son brut : toutes les lectures payées sont
 * comptées dans son coût et ses caractères, et le rapport les trace une à une.
 */
function priseRetenue(prises: PriseVoixMesuree[], reference: Readonly<MesureVoix> = REFERENCE_V4): AudioBrut {
  const derniere = prises.length - 1;
  const retenue = prises[derniere].ressemblante ? derniere : Math.max(0, choisirMeilleurePrise(prises.map((p) => ({ mesure: p.mesure ?? { hauteurHz: Number.NaN, variationHz: Number.NaN, energie: Number.NaN, dynamique: Number.NaN, rythmePicsParSec: Number.NaN, partieParole: Number.NaN } })), reference));
  const rapport: RapportRessemblanceVoix = {
    prises: prises.map((p) => ({ empreinteDemande: p.empreinteDemande, fichierCle: p.brut.fichierCle, coutCentimes: p.brut.coutCentimes, caracteres: p.brut.caracteres, mesure: p.mesure, ...(p.versionMesure !== undefined ? { versionMesure: p.versionMesure } : {}), ressemblante: p.ressemblante, ecarts: p.ecarts })),
    retenue,
    ressemblante: prises[retenue].ressemblante,
  };
  return { ...prises[retenue].brut, coutCentimes: prises.reduce((s, p) => s + p.brut.coutCentimes, 0), caracteres: prises.reduce((s, p) => s + p.brut.caracteres, 0), ressemblance: rapport };
}

/**
 * Reprise d'un son maître fait : « a-remesurer » si une de ses prises a une mesure ancienne, sinon l'état tel quel. Les
 * phases de re-mesure n'appellent jamais la voix (rien n'est relu ni repayé). PUR.
 */
export function versRemesure(etat: EtatVoixMaitre): EtatVoixMaitre {
  if (etat.phase !== "faite") return etat;
  const rang = rangMesureAncienne(etat.audio.ressemblance);
  return rang < 0 ? etat : { phase: "a-remesurer", audio: structuredClone(etat.audio), rang };
}

/** Une phase de la voix maître. Lève une erreur typée (réessayable ou non) que la boucle de fond sait reprendre. */
export async function avancerVoixMaitre(etat: EtatVoixMaitre, o: OutilsVoixMaitre): Promise<EtatVoixMaitre> {
  const regles = o.regles;
  const idBase = o.idBase;
  const vitesse = o.reglages?.vitesse ?? 1;
  const versAnalyseDe = (brut: AudioBrut, rapport?: RapportAlignement) => versAnalyse(brut, o.aligneur().mode !== "simulation", rapport);
  /** Son brut rangé : mesuré (contrôle de ressemblance), sinon calé ou analysé comme avant. */
  const apresRangement = (brut: AudioBrut, texte: string, prises?: PriseVoixMesuree[]): EtatVoixMaitre => {
    if (ressemblanceActive(o)) return { phase: "a-mesurer", brut, texte, prises: prises ?? [] };
    return o.caler(!!brut.motsEstimes) ? { phase: "a-aligner", brut, texte } : versAnalyseDe(brut);
  };
  if (etat.phase === "a-relire") {
    // 14/10 : nouvelle lecture payée du même texte (la précédente s'écarte de la référence) ; jamais refaite à la reprise.
    // 15/10 (v-dd3049053f88) : lecture NEUVE (cache du fournisseur ignoré) ; sans elle, HeyGen rend le même son au même
    // texte, et la relance payée mesurait la même voix (deux fichiers, mesures identiques au 5e chiffre).
    const { brut, texte } = await lireLaVoix(o, true);
    if (brut.copieEnAttente) return { phase: "a-copier", brut, texte, prises: etat.prises };
    return apresRangement(brut, texte, etat.prises);
  }
  if (etat.phase === "a-remesurer") {
    const p = etat.audio.ressemblance!.prises[etat.rang];
    return { ...etat, phase: "remesure", demande: await soumettreMesure(o, p, etat.rang + 1, 0, true) };
  }
  if (etat.phase === "remesure") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreMesure(o, etat.audio.ressemblance!.prises[etat.rang], etat.rang + 1, essai, true) };
    }
    if (e.statut !== "termine") return etat;
    const versionMesure = versionMesureDesMesures(e.mesures);
    // Service de rendu pas encore à jour : la mesure ancienne n'est pas reprise pour neuve (la reprise suivante réessaie).
    if (versionMesure < VERSION_MESURE_VOIX) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Le service de rendu mesure encore la voix avec la version ${versionMesure} : mettez-le à jour puis réessayez (aucune voix n'est relue).` });
    const mesure = mesureVoixDesMesures(e.mesures);
    const c = mesure ? comparerAReference(mesure, o.reference ?? REFERENCE_V4) : { ressemblante: false, ecarts: [{ libelle: "mesure illisible" }] };
    const audio = structuredClone(etat.audio);
    const r = audio.ressemblance!;
    r.prises[etat.rang] = { ...r.prises[etat.rang], mesure, versionMesure, ressemblante: c.ressemblante, ecarts: c.ecarts.map((x) => x.libelle) };
    r.ressemblante = r.prises[r.retenue]?.ressemblante ?? false;
    const suivante = rangMesureAncienne(audio.ressemblance);
    return suivante < 0 ? { phase: "faite", audio } : { phase: "a-remesurer", audio, rang: suivante };
  }
  if (etat.phase === "a-mesurer") {
    return { ...etat, phase: "mesure", demande: await soumettreMesure(o, etat.brut, etat.prises.length + 1) };
  }
  if (etat.phase === "mesure") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    const n = etat.prises.length + 1;
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreMesure(o, etat.brut, n, essai) };
    }
    if (e.statut !== "termine") return etat;
    const mesure = mesureVoixDesMesures(e.mesures);
    const c = mesure ? comparerAReference(mesure, o.reference ?? REFERENCE_V4) : { ressemblante: false, ecarts: [{ libelle: "mesure illisible" }] };
    const { ressemblance: _r, copieEnAttente: _c, ...son } = etat.brut;
    void _r;
    void _c;
    const prises: PriseVoixMesuree[] = [...etat.prises, { brut: son, empreinteDemande: empreinteDemande(o, n), mesure, versionMesure: versionMesureDesMesures(e.mesures), ressemblante: c.ressemblante, ecarts: c.ecarts.map((x) => x.libelle) }];
    // Hors tolérance et relance permise : une nouvelle lecture (budget revérifié) ; sinon la prise la plus proche.
    if (!c.ressemblante && prises.length < lecturesVoixMax(o.ressemblance)) return { phase: "a-relire", texte: etat.texte, prises };
    const brut = priseRetenue(prises, o.reference ?? REFERENCE_V4);
    return o.caler(!!brut.motsEstimes) ? { phase: "a-aligner", brut, texte: etat.texte } : versAnalyseDe(brut);
  }
  if (etat.phase === "a-lire") {
    // Réutilisation de l'audio maître de la maquette : pas repayé (B.0 §19). Sa cause d'approximation (correcteur R6)
    // vient avec lui (`...existant`) : jamais recalculée.
    if (o.existant && o.existant.empreinte === o.empreinte()) {
      const d = debitEtVitesseConseillee(o.existant.mots, vitesse);
      return { phase: "faite", audio: { ...o.existant, reutilise: true, coutCentimes: 0, fournisseur: o.fournisseurVoix ?? "simulation", caracteres: 0, coupures: 0, respirations: 0, ...d } };
    }
    const { brut, texte } = await lireLaVoix(o);
    const motsEstimes = !!brut.motsEstimes;
    if (brut.copieEnAttente) return { phase: "a-copier", brut, texte };
    // Lot « calage » (02/10) : un aligneur réel peut recaler les mots AVANT le nettoyage. Simulation : sauté (rien ne
    // change).
    // E2E-1 n° 1 (03/10) : la voix PAYÉE est rendue tout de suite, SANS enchaîner l'appel suivant (aligneur ou
    // studio-rendu) dans le même tour. L'appelant l'enregistre dans le travail AVANT tout autre appel : une panne de
    // l'analyse ou du calage ne relance plus que l'analyse ou le calage, jamais la lecture (jamais repayée).
    // Lot R6 (C6) : la voix de synthèse garde son horodatage (plus juste que le calage, mesure D3), sauf réglage
    // `alignement.voixSynthese` ou voix sans horodatage des mots.
    // 14/10 : contrôle de ressemblance actif (rendu réel) : la lecture est d'abord mesurée.
    if (ressemblanceActive(o)) return apresRangement(brut, texte);
    if (o.caler(motsEstimes)) return { phase: "a-aligner", brut, texte };
    return versAnalyseDe(brut);
  }
  if (etat.phase === "a-copier") {
    // CORRECTEUR 1 — B2 : le son déjà payé est rangé dans le stockage. Une copie ratée lève une panne passagère : le
    // tour suivant refait la COPIE (l'état gardé est « a-copier »), jamais la lecture.
    const copie = etat.brut.copieEnAttente;
    const v = o.voix();
    if (!copie || !v.copierSon) return ressemblanceActive(o) ? apresRangement(etat.brut, etat.texte, etat.prises) : o.caler(!!etat.brut.motsEstimes) ? { phase: "a-aligner", brut: etat.brut, texte: etat.texte } : versAnalyseDe(etat.brut);
    const fichierCle = await v.copierSon(copie.adresse, copie.idExterne, copie.idDemande);
    const { copieEnAttente: _fait, ...reste } = etat.brut;
    void _fait;
    const brut: AudioBrut = { ...reste, fichierCle };
    if (ressemblanceActive(o)) return apresRangement(brut, etat.texte, etat.prises);
    return o.caler(!!brut.motsEstimes) ? { phase: "a-aligner", brut, texte: etat.texte } : versAnalyseDe(brut);
  }
  if (etat.phase === "a-aligner") {
    const s = o.stockage();
    const audio = s.urlLectureDuree ? await s.urlLectureDuree(etat.brut.fichierCle, DUREE_ADRESSE_CALAGE_SEC) : await s.urlLecture(etat.brut.fichierCle);
    const demande = demandeAlignement({ idBase, essai: etat.essai, audio, texte: etat.texte, reference: etat.brut.mots });
    await o.aligneur().soumettre(demande);
    return { phase: "alignement", brut: etat.brut, texte: etat.texte, demande, essai: etat.essai };
  }
  if (etat.phase === "alignement") {
    const e = await o.aligneur().suivre(etat.demande.idAlignement);
    if (e.statut === "en_file" || e.statut === "en_cours") return etat;
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      // Panne passagère : nouvel essai ; au-delà, l'horodatage de la voix est gardé (jamais une vidéo bloquée).
      if (e.erreur.reessayable && essai < ESSAIS_ALIGNEMENT) return { phase: "a-aligner", brut: etat.brut, texte: etat.texte, essai };
      const { mots, rapport } = appliquerAlignement(etat.brut.mots, null, etat.brut.dureeSec);
      return avancerVoixMaitre(versAnalyseDe({ ...etat.brut, mots, alignement: rapport }, rapport), o);
    }
    const { mots, rapport } = appliquerAlignement(etat.brut.mots, e.resultat, etat.brut.dureeSec);
    return avancerVoixMaitre(versAnalyseDe({ ...etat.brut, mots, alignement: rapport }, rapport), o);
  }
  if (etat.phase === "a-analyser") {
    // Les respirations se reconnaissent dans le son : seulement s'il y a des blancs à raccourcir.
    const blancs = blancsLongs(etat.brut.mots, regles.seuilMs).map(({ debutSec, finSec }) => ({ debutSec, finSec }));
    const demande = await soumettre(o, etat.brut, "analyse", { mode: "analyse", blancs });
    return { phase: "analyse", brut: etat.brut, demande };
  }
  if (etat.phase === "analyse") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      // Échec passager du conteneur : nouvelle demande (nouvel identifiant), 3 fois au plus, puis la boucle reprend la main.
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettre(o, etat.brut, "analyse", etat.demande.parametres, essai) };
    }
    if (e.statut !== "termine") return etat;
    const respirations = intervallesDesMesures(e.mesures, "respiration");
    const plan = calculerCoupures({ mots: etat.brut.mots, dureeSec: etat.brut.dureeSec, regles, respirations });
    const fonduMs = (regles.fonduMs[0] + regles.fonduMs[1]) / 2;
    // Correcteur réel 2 : silence de fin ajouté (vraie respiration ; l'avatar finit bouche fermée).
    const demande = await soumettre(o, etat.brut, "nettoyage", { mode: "appliquer", fonduMs, coupures: plan.coupures.map(({ debutSec, finSec }) => ({ debutSec, finSec })), ...(plan.silenceFinSec > 0 ? { silenceFinSec: plan.silenceFinSec } : {}) });
    return { phase: "nettoyage", brut: etat.brut, coupures: plan.coupures, respirations: plan.respirationsGardees, demande };
  }
  if (etat.phase === "nettoyage") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettre(o, etat.brut, "nettoyage", etat.demande.parametres, essai) };
    }
    if (e.statut !== "termine") return etat;
    // Les instants réellement coupés (recalés sur un passage par zéro) font foi pour décaler les mots.
    const appliquees = coupuresAppliquees(etat.coupures, e.mesures);
    const mots = decalerMots(etat.brut.mots, appliquees);
    const retire = appliquees.reduce((s, x) => s + (x.finSec - x.debutSec), 0);
    const d = debitEtVitesseConseillee(mots, vitesse);
    return {
      phase: "faite",
      audio: {
        // Rendu simulé : aucun fichier n'est produit, le son brut sert d'audio maître (horodatages décalés quand même).
        fichierCle: o.renduEstSimule() ? etat.brut.fichierCle : e.sortieCle,
        dureeSec: +(e.mesures?.dureeSec ?? etat.brut.dureeSec - retire).toFixed(3),
        mots,
        empreinte: o.empreinte(),
        reutilise: false,
        coutCentimes: etat.brut.coutCentimes,
        fournisseur: etat.brut.fournisseur,
        caracteres: etat.brut.caracteres,
        coupures: appliquees.length,
        respirations: etat.respirations.length,
        ...d,
        ...(etat.brut.alignement ? { alignement: etat.brut.alignement } : {}),
        ...(etat.brut.approximatif ? { sousTitresApproximatifs: etat.brut.approximatif } : {}),
        ...(etat.brut.ressemblance ? { ressemblance: etat.brut.ressemblance } : {}),
      },
    };
  }
  return etat;
}
