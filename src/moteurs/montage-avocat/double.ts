/**
 * LE DOUBLE DANS LE MOTEUR AVOCAT (lot R7d ; plan double B.1 « Rendu », B.2 bis, plan avocat B.2-B.3).
 *
 * « Le son d'abord » : l'angle PRINCIPAL est rendu en UNE piste continue sur l'audio maître entier (gestes continus) ;
 * le SECOND angle seulement sur ses passages, ± 1 s, chacun sur la tranche de l'audio maître de ce moment-là
 * (opération `extrait` de `studio-rendu`, coupe à l'échantillon), en parallèle. Les lèvres des deux angles suivent
 * exactement le même son. Rendu toujours webm 1080p transparent (le décor est posé par la composition).
 *
 * ARGENT : chaque rendu porte une clé stable `rendu:{travail}:{angle}:{n}:e{essai}` ; la MÊME clé est rejouée tant
 * qu'on ignore si la demande est arrivée (panne, délai) ; une clé NEUVE seulement après un rendu échoué connu (son
 * illisible : nouvelle adresse). Ce qui est soumis est compté comme payé (HeyGen le facture même si l'on arrête).
 * GARDE-FOUS : un montage réel n'utilise jamais le double d'essai ni un double non choisi (`refusDouble`) ; le lancement
 * avec un double réel exige TOUJOURS la confirmation du prix (`partDoubleReel`, contrôlée dans `credits.ts`) ; jamais
 * plus de `PLAFOND_DEPASSEMENT` fois les secondes annoncées ne sont envoyées au fournisseur (`plafondSec`).
 *
 * LOT R7e — allumé par le réglage de Will (figé dans la commande, `renduAllumeDans`), éteint par défaut.
 *  - « La voix d'abord » : le son est fabriqué UNE fois (audio maître, voix clonée HeyGen du personnage) ; chaque angle
 *    parle SUR CE MÊME SON (lèvres pilotées par l'audio : `audio_url`), jamais sur un texte à relire.
 *  - REPRISE APRÈS PANNE : l'envoi payant se fait en deux tours. Tour 1 : la pièce passe en « envoi » (titre unique,
 *    clé, secondes comptées) SANS appel — cet état est gardé. Tour 2 : on cherche d'abord (gratuit) un rendu de même
 *    titre chez le fournisseur ; s'il existe (la demande était arrivée avant la panne), il est repris SANS second envoi ;
 *    sinon l'envoi part, avec la même clé d'idempotence.
 *  - Le second angle attend que l'angle principal soit accepté : un refus « sans fond » se voit avant toute dépense.
 *  - FOND : sans fond (webm transparent posé sur nos décors) ; si le fournisseur refuse (avatar créé sans détourage)
 *    et que rien n'est encore parti, repli automatique sur le fond uni (mp4, décor non posé) ; sinon refus clair.
 */
import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import type { AngleVisage, CommandeFabrication, LigneCout, VisageResolu } from "@/domaine/types";
import type { RecetteMontage } from "@/formats/types";
import { lookDuDecor } from "@/domaine/decors";
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V } from "@/fournisseurs/heygen/rendus";
import type { DemandeRendu, FondRenduVisage, FournisseurVisage, ServiceRendu } from "@/fournisseurs/types";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import type { PlanProduit } from "../types";

/** Marge de chaque passage du second angle (plan double B.2 bis). */
export const MARGE_SECOND_SEC = 1;
/** Rendus échoués connus repris (clé neuve) avant l'échec de l'étape. */
const ESSAIS_PIECE = 3;
/** Pannes de soumission (même clé) avant de laisser la reprise de la boucle prendre le relais. */
const PANNES_SOUMISSION = 3;

export interface PieceDouble {
  angle: AngleVisage;
  index: number;
  debutSec: number;
  finSec: number;
  /** Second angle : une tranche de l'audio maître est découpée d'abord. */
  tranche: boolean;
  /** « envoi » (lot R7e) : envoi payant décidé et gardé, pas encore confirmé par le fournisseur. */
  phase: "a-trancher" | "tranche" | "a-rendre" | "envoi" | "rendu" | "faite" | "echec";
  /** Lot R7e : titre UNIQUE du rendu chez le fournisseur (retrouvé après une panne). */
  titreRendu?: string;
  /** Lot R7e (relecture n° 6) : date de la décision d'envoi (la recherche de reprise ne remonte pas plus loin). */
  decideLe?: string;
  audioCle?: string;
  demandeTranche?: DemandeRendu;
  essai: number;
  pannes?: number;
  idExterne?: string;
  callbackId?: string;
  videoCle?: string;
  dureeSec?: number;
  /** Phrase simple pour Will (jamais le texte brut du fournisseur). */
  erreur?: string;
  /** Texte brut du fournisseur (code, message anglais) : détail technique seulement, jamais à l'écran. */
  detail?: string;
  /** Rendu accepté mais jamais terminé dans `DELAI_MAX_RENDU_DOUBLE_MS` : l'identifiant chez le fournisseur est gardé. */
  delaiDepasse?: boolean;
  /**
   * Après « Réessayer » d'un rendu trop long : l'ancien rendu est relu d'abord ; fini entre-temps, il est gardé ;
   * toujours en cours, rien n'est renvoyé (relecture finale E1) ; échoué chez HeyGen, seule cette pièce repart.
   */
  reverifier?: boolean;
  /** Relecture finale E1 : l'ancien rendu était encore en cours au dernier « Réessayer » (phrase pour Will). */
  toujoursEnCours?: boolean;
  /**
   * Relecture finale 2, D1 : refus net pendant le suivi d'un rendu ACCEPTÉ (clé refusée, rendu introuvable, téléchargement
   * refusé après la fin…). L'identifiant est gardé, la pièce reste comptée ; « Réessayer » la relit (`reverifier`).
   */
  suiviRefuse?: boolean;
  /** Correcteur réel 2 : rendu déjà payé par une fabrication précédente, repris sans renvoi ni nouveau coût. */
  reutilise?: boolean;
}

/**
 * Vérification E2E n° 1 (agent g, parcours E) — décision du propriétaire : un rendu du double accepté par le
 * fournisseur qui reste « en cours » plus de 6 heures après la décision d'envoi (`decideLe`) passe en échec
 * réessayable, avec une phrase pour Will et une notification. « Réessayer » ne relance que cette pièce, et relit
 * d'abord l'ancien rendu (`reverifier`) avant toute nouvelle soumission.
 */
export const DELAI_MAX_RENDU_DOUBLE_MS = 6 * 3600_000;
export const MESSAGE_DELAI_RENDU_DOUBLE = "HeyGen n'a pas terminé votre double en 6 heures. Touchez « Reprendre » : le rendu déjà payé est relu d'abord, il n'est jamais renvoyé tant que HeyGen y travaille.";
/**
 * RELECTURE FINALE E1 : « Réessayer » alors que l'ancien rendu est TOUJOURS « en cours » chez HeyGen. Rien n'est
 * renvoyé (il serait payé deux fois) : la pièce reste en échec, avec l'identifiant de l'ancien rendu, toujours comptée.
 */
export const MESSAGE_DOUBLE_SUIVI_REFUSE = "HeyGen a refusé de nous répondre sur ce rendu. Il est déjà compté : touchez « Reprendre », il sera relu, jamais renvoyé tant que HeyGen y travaille.";
/** D1 : phrase pour Will, avec la raison simple du refus (déjà en français, sans code) quand elle est connue. */
export const messageSuiviRefuse = (raison?: string) => (raison ? `${MESSAGE_DOUBLE_SUIVI_REFUSE} Raison : ${raison}` : MESSAGE_DOUBLE_SUIVI_REFUSE);
/** Pièce en échec dont l'ancien rendu, accepté par HeyGen, est gardé et compté : « Réessayer » le relit, sans renvoi. */
export const renduARelire = (p: PieceDouble) => p.phase === "echec" && !!p.idExterne && !!(p.delaiDepasse || p.suiviRefuse);
export const MESSAGE_DOUBLE_TOUJOURS_EN_COURS = "HeyGen travaille encore sur votre double. Il est déjà payé et compté : rien n'est renvoyé tant qu'il n'est pas fini. Touchez « Reprendre » plus tard.";

export interface EtatDoubleMoteur {
  fournisseur: string;
  lookIds: Partial<Record<AngleVisage, string>>;
  pieces: PieceDouble[];
  /**
   * Secondes envoyées au fournisseur (comptées à la décision d'envoi, rendues si l'envoi est refusé avant acceptation ;
   * chaque demande acceptée reste comptée, essais compris) : comparées au plafond.
   */
  secondesEnvoyees?: number;
  /**
   * Lot R7e : « sans-fond » (défaut) ou « uni » (repli, ou choix de Will). Correcteur réel 2 : « decor-du-look » quand
   * le décor choisi est relié à un look HeyGen (le double est rendu sur ce look, AVEC son fond ; pas de détourage).
   */
  fond?: "sans-fond" | "uni" | "decor-du-look";
  /** Correcteur réel 2 (F4) : par angle, le look FILMÉ (gestes appris) quand le rendu se fait sur un look du décor. */
  referenceLookIds?: Partial<Record<AngleVisage, string>>;
}

/**
 * Correcteur réel 2 (04/10) : le décor de la commande est-il relié à un look HeyGen pour l'angle principal ? Alors
 * chaque angle est rendu sur le look du décor (même tarif à la seconde). Null : rendu habituel (sans fond ou uni).
 */
export function decorDuLook(c: Pick<CommandeFabrication, "styles">, recette: RecetteMontage): { nom: string; valide: boolean; lookPour: (a: AngleVisage) => string | undefined } | null {
  const d = c.styles?.decor;
  const v = d?.valeur;
  if (!d || !v || !lookDuDecor(v, recette.angles.principal)) return null;
  return { nom: d.nom, valide: v.statut === "valide", lookPour: (a) => lookDuDecor(v, a) };
}

/** Plafond : jamais plus de 1,5 fois les secondes annoncées (et confirmées) ne partent chez le fournisseur. */
export const PLAFOND_DEPASSEMENT = 1.5;

export { partDoubleReel, phraseAvatarParle } from "@/domaine/double-reel";

/** Secondes de double annoncées par l'estimation (même règle que la brique « visage » : principal + second × 1,3 + 2). */
export function secondesAnnonceesDouble(c: Pick<CommandeFabrication, "distribution" | "dureeCibleSec">): number {
  const d = c.distribution.find((x) => x.source === "double");
  if (!d) return 0;
  const second = d.modeAngles === "deux-angles" ? (d.repartitionAngles?.second ?? 0) : 0;
  return c.dureeCibleSec + (second > 0 ? Math.ceil(c.dureeCibleSec * second * 1.3 + 2) : 0);
}

/** Angles et visages du double de la commande (principal, et second si la distribution le demande). */
export function anglesDuDouble(c: CommandeFabrication, recette: RecetteMontage): { angle: AngleVisage; visage?: VisageResolu; principal: boolean }[] {
  const d = c.distribution[0];
  if (!d || d.source !== "double") return [];
  const principal = recette.angles.principal;
  const sortie: { angle: AngleVisage; visage?: VisageResolu; principal: boolean }[] = [{ angle: principal, visage: d.visagesResolus?.[principal] ?? (principal === "trois-quarts" ? d.visagesResolus?.face : undefined), principal: true }];
  if (d.modeAngles === "deux-angles" && recette.angles.second) sortie.push({ angle: recette.angles.second, visage: d.visagesResolus?.[recette.angles.second], principal: false });
  return sortie;
}

/** Le visage est-il un double RÉEL validé (fournisseur réel, statut « prêt », identifiant chez le fournisseur) ? */
export function doubleReelPret(v: VisageResolu | undefined, fournisseurReel: (id: string) => boolean): boolean {
  return !!v && !!v.fournisseur && v.fournisseur !== "simulation" && v.statut === "pret" && !!v.idExterne && fournisseurReel(v.fournisseur);
}

/**
 * GARDE-FOU (lot R7d) : message de refus si un montage RÉEL utiliserait le double d'essai (ou un double pas encore
 * validé, ou un fournisseur réel non branché). Null : rien à refuser.
 */
export function refusDouble(c: CommandeFabrication, recette: RecetteMontage, fournisseurReel: (id: string) => boolean, renduAutorise = renduAllumeDans(c)): string | null {
  // Lot R7e : réglage éteint (par défaut) → le studio ne fait pas parler l'avatar.
  // Correcteur réel 2 : un seul angle, déjà rendu et payé sur cette voix : rien n'est envoyé, le réglage n'est pas exigé.
  const toutRepris = anglesDuDouble(c, recette).length === 1 && principalDejaRendu(c, recette);
  if (!renduAutorise && !toutRepris && anglesDuDouble(c, recette).length) return MESSAGE_DOUBLE_DANS_HEYGEN;
  for (const a of anglesDuDouble(c, recette)) {
    if (doubleReelPret(a.visage, fournisseurReel)) continue;
    const v = a.visage;
    const raison = !v
      ? "aucun double n'est choisi pour cet angle"
      : !v.fournisseur || v.fournisseur === "simulation"
        ? "c'est le double d'essai, qui ne sert jamais dans une vraie vidéo"
        : v.statut !== "pret"
          ? "choisissez-le dans Personnages, « Votre double HeyGen »"
          : "le double réel n'est pas branché sur le serveur";
    return `Votre double n'est pas prêt (${a.principal ? "angle principal" : "second angle"} : ${raison}).`;
  }
  // Correcteur réel 2 : décor relié à un look HeyGen. Il part validé par Will sur sa vignette, et chaque angle rendu a
  // son look (sinon le second angle serait détouré sur un décor absent). Refusé AVANT toute dépense.
  const dl = decorDuLook(c, recette);
  if (dl) {
    if (!dl.valide) return `Validez d'abord le décor « ${dl.nom} » sur sa vignette (Bibliothèque, Décors).`;
    const sans = anglesDuDouble(c, recette).find((a) => !dl.lookPour(a.angle));
    if (sans) return `Le décor « ${dl.nom} » n'a pas de look HeyGen pour le second angle : reliez-en un dans Bibliothèque, Décors, ou faites la vidéo avec un seul angle.`;
  }
  return null;
}

/** Message clair quand une vidéo demanderait au studio de faire parler l'avatar alors que le réglage est éteint. */
export const MESSAGE_DOUBLE_DANS_HEYGEN = "Votre avatar ne parle pas dans le studio : allumez-le dans Réglages, Connexions, Double, ou faites la vidéo dans l'application HeyGen et rattachez-la à sa version (Sujets, « Ma vidéo HeyGen »).";

/** Lot R7e : le réglage de Will, figé dans la commande au lancement (absent = éteint). */
export const renduAllumeDans = (c: Pick<CommandeFabrication, "renduDouble">) => c.renduDouble?.allume === true;

/** Passages du second angle : ses plans, ± 1 s, fusionnés quand ils se touchent, bornés à la durée. */
export function passagesSecondAngle(plans: PlanProduit[], angle: AngleVisage, dureeSec: number, marge = MARGE_SECOND_SEC): { debutSec: number; finSec: number }[] {
  const bruts = plans
    .filter((p) => p.angle === angle && p.sourceImage !== "illustration")
    .map((p) => ({ debutSec: Math.max(0, p.debutSec - marge), finSec: Math.min(dureeSec, p.finSec + marge) }))
    .sort((a, b) => a.debutSec - b.debutSec);
  const sortie: { debutSec: number; finSec: number }[] = [];
  for (const x of bruts) {
    const der = sortie.at(-1);
    if (der && x.debutSec <= der.finSec) der.finSec = Math.max(der.finSec, x.finSec);
    else sortie.push({ ...x });
  }
  return sortie.map((x) => ({ debutSec: Math.round(x.debutSec * 1000) / 1000, finSec: Math.round(x.finSec * 1000) / 1000 }));
}

/** État initial : la piste principale (audio maître entier) et les passages du second angle. */
export function etatInitialDouble(c: CommandeFabrication, recette: RecetteMontage, plans: PlanProduit[], audio: { fichierCle: string; dureeSec: number }): EtatDoubleMoteur {
  const angles = anglesDuDouble(c, recette);
  const pieces: PieceDouble[] = [];
  const lookIds: Partial<Record<AngleVisage, string>> = {};
  // Correcteur réel 2 : décor relié à un look HeyGen (et validé) : chaque angle parle SUR le look du décor.
  const dl = decorDuLook(c, recette);
  const surLeLook = !!dl?.valide;
  const referenceLookIds: Partial<Record<AngleVisage, string>> = {};
  for (const a of angles) {
    const look = (surLeLook ? dl!.lookPour(a.angle) : undefined) ?? a.visage?.idExterne;
    if (look) lookIds[a.angle] = look;
    // F4 : sur un look généré (décor), les gestes appris du look filmé de la personne servent de référence.
    if (look && a.visage?.idExterne && look !== a.visage.idExterne) referenceLookIds[a.angle] = a.visage.idExterne;
    if (a.principal) pieces.push({ angle: a.angle, index: 0, debutSec: 0, finSec: audio.dureeSec, tranche: false, phase: "a-rendre", audioCle: audio.fichierCle, essai: 0 });
    else passagesSecondAngle(plans, a.angle, audio.dureeSec).forEach((p, i) => pieces.push({ angle: a.angle, index: i, ...p, tranche: true, phase: "a-trancher", essai: 0 }));
  }
  // Correcteur réel 2 : un rendu déjà payé sur CE son, ce look et ce fond est repris tel quel (rien n'est renvoyé).
  const fond: EtatDoubleMoteur["fond"] = surLeLook ? "decor-du-look" : c.renduDouble?.fond === "uni" ? "uni" : "sans-fond";
  for (const p of pieces) {
    const deja = renduReutilisable(c, audio.fichierCle, fond, lookIds[p.angle], p);
    if (deja) Object.assign(p, { phase: "faite", videoCle: deja.videoCle, dureeSec: deja.dureeSec ?? p.finSec - p.debutSec, reutilise: true });
  }
  return { fournisseur: angles[0]?.visage?.fournisseur ?? "simulation", lookIds, pieces, fond, ...(Object.keys(referenceLookIds).length ? { referenceLookIds } : {}) };
}

/**
 * Correcteur réel 2 : la pièce déjà rendue et payée (même audio maître, même look, même fond, même passage), si la
 * commande en porte une. Null : à rendre.
 */
export function renduReutilisable(c: Pick<CommandeFabrication, "doubleDejaRendu">, audioCle: string, fond: EtatDoubleMoteur["fond"], lookId: string | undefined, p: Pick<PieceDouble, "angle" | "tranche" | "debutSec" | "finSec">): { videoCle: string; dureeSec?: number } | null {
  const d = c.doubleDejaRendu;
  if (!d || !lookId || d.audioCle !== audioCle || (d.fond ?? "sans-fond") !== (fond ?? "sans-fond") || d.lookIds[p.angle] !== lookId) return null;
  const x = d.pieces.find((q) => q.angle === p.angle && q.tranche === p.tranche && Math.abs(q.debutSec - p.debutSec) < 0.002 && Math.abs(q.finSec - p.finSec) < 0.002);
  return x ? { videoCle: x.videoCle, ...(x.dureeSec ? { dureeSec: x.dureeSec } : {}) } : null;
}

export { doubleDejaRenduDepuis } from "@/domaine/double-reel";


/**
 * Correcteur réel 2 — pour l'ESTIMATION (avant les plans) : l'angle principal sera-t-il repris sans repayer ? Même
 * règle que l'état initial (le principal couvre l'audio maître entier).
 */
export function principalDejaRendu(c: CommandeFabrication, recette: RecetteMontage): boolean {
  const a = anglesDuDouble(c, recette).find((x) => x.principal);
  const audio = c.audioMaitre;
  if (!a || !audio || !c.doubleDejaRendu || c.doubleDejaRendu.empreinteAudio !== audio.empreinte) return false;
  const dl = decorDuLook(c, recette);
  const surLeLook = !!dl?.valide;
  const look = (surLeLook ? dl!.lookPour(a.angle) : undefined) ?? a.visage?.idExterne;
  const fond: EtatDoubleMoteur["fond"] = surLeLook ? "decor-du-look" : c.renduDouble?.fond === "uni" ? "uni" : "sans-fond";
  return renduReutilisable(c, audio.fichierCle, fond, look, { angle: a.angle, tranche: false, debutSec: 0, finSec: audio.dureeSec }) !== null;
}

export const doubleFini = (e: EtatDoubleMoteur) => e.pieces.every((p) => p.phase === "faite");
export const doubleEnEchec = (e: EtatDoubleMoteur) => e.pieces.find((p) => p.phase === "echec");

export function progressionDouble(e: EtatDoubleMoteur): number {
  const poids: Record<PieceDouble["phase"], number> = { "a-trancher": 0, tranche: 10, "a-rendre": 15, envoi: 20, rendu: 50, faite: 100, echec: 100 };
  return e.pieces.length ? Math.min(99, Math.round(e.pieces.reduce((s, p) => s + poids[p.phase], 0) / e.pieces.length)) : 100;
}

/**
 * Lignes payées du double : la durée rendue pour une pièce faite, la durée demandée pour une pièce soumise (HeyGen la
 * rendra et la facturera). Au nom du fournisseur réel.
 */
export function lignesDouble(e: EtatDoubleMoteur | undefined, tauxUsdEur = TAUX_USD_EUR_PAR_DEFAUT, nature: LigneCout["nature"] = "reel"): LigneCout[] {
  if (!e) return [];
  const prix = centimes(CENTIMES_USD_PAR_SECONDE_AVATAR_V * tauxUsdEur);
  return e.pieces
    // Un rendu accepté mais trop long (`delaiDepasse`), ou dont le suivi a été refusé (`suiviRefuse`, D1), reste compté :
    // le fournisseur peut encore le finir et le facturer.
    // Correcteur réel 2 : un rendu repris d'une fabrication précédente est déjà payé : aucune ligne.
    .filter((p) => !p.reutilise && (p.phase === "faite" || p.phase === "rendu" || (p.phase === "echec" && (p.delaiDepasse || p.suiviRefuse))))
    .map((p) => {
      const quantite = Math.round((p.dureeSec ?? p.finSec - p.debutSec) * 100) / 100;
      return { etape: p.index === 0 && !p.tranche ? "Double, angle principal" : `Double, second angle (passage ${p.index + 1})`, fournisseur: e.fournisseur, unite: "seconde" as const, quantite, prixUnitaire: prix, total: centimes(CENTIMES_USD_PAR_SECONDE_AVATAR_V * tauxUsdEur * quantite), nature };
    });
}

export const cleRendu = (travailId: string, p: Pick<PieceDouble, "angle" | "index" | "essai">) => `rendu:${travailId}:${p.angle}:${p.index}:e${p.essai}`.replace(/[^A-Za-z0-9_:.-]/g, "-").slice(0, 255);

/** Lot R7e : titre UNIQUE d'un rendu (≤ 120 caractères) : titre de la vidéo, angle, empreinte de la clé d'idempotence. */
export function titreRendu(titre: string, p: Pick<PieceDouble, "tranche" | "index">, cle: string): string {
  const empreinte = createHash("sha256").update(cle).digest("hex").slice(0, 12);
  return `${titre.slice(0, 70)} · ${p.tranche ? `second angle ${p.index + 1}` : "angle principal"} · ${empreinte}`;
}

export interface OutilsDouble {
  visage: FournisseurVisage;
  rendu: ServiceRendu;
  /** Adresse de lecture signée (secondes). */
  lecture: (cle: string, secondes: number) => Promise<string>;
  /** Adresse de dépôt signée. */
  depot: (cle: string, mime: string) => Promise<string>;
  /** Clé de stockage d'un fichier de la vidéo. */
  cle: (nom: string) => string;
  travailId: string;
  idBase: string;
  titre: string;
  audioMaitreCle: string;
  consigne: (angle: AngleVisage) => string | undefined;
  /** Plafond de secondes envoyées au fournisseur pour cette vidéo (annoncées × `PLAFOND_DEPASSEMENT`). */
  plafondSec: number;
}

/** Fait avancer le double d'UN tour (appels hors verrou ; chaque pièce indépendante). */
export async function avancerDouble(etat: EtatDoubleMoteur, o: OutilsDouble): Promise<EtatDoubleMoteur> {
  const pieces: PieceDouble[] = [];
  let envoyees = etat.secondesEnvoyees ?? 0;
  let fond = etat.fond ?? "sans-fond";
  // Le second angle attend que l'angle principal soit accepté par le fournisseur (lot R7e).
  const principalAccepte = etat.pieces.filter((x) => !x.tranche).every((x) => x.phase === "rendu" || x.phase === "faite");
  for (const p0 of etat.pieces) {
    const p: PieceDouble = { ...p0 };
    try {
      if (p.phase === "a-trancher") {
        const cle = o.cle(`${o.idBase}-tranche-${p.angle}-${p.index}.wav`);
        const demande: DemandeRendu = { idRendu: `${o.idBase}-tranche-${p.angle}-${p.index}`, operation: "extrait", file: "courte", entrees: { media: await o.lecture(o.audioMaitreCle, 3600) }, sortie: { urlDepot: await o.depot(cle, "audio/wav"), cle }, parametres: { type: "audio", debutSec: p.debutSec, dureeSec: Math.round((p.finSec - p.debutSec) * 1000) / 1000 } };
        await o.rendu.soumettre(demande);
        Object.assign(p, { phase: "tranche", demandeTranche: demande });
      } else if (p.phase === "tranche") {
        const e = await o.rendu.etat(p.demandeTranche!.idRendu);
        if (e.statut === "inconnu") await o.rendu.soumettre(p.demandeTranche!);
        else if (e.statut === "echec") {
          if (!e.erreur.reessayable) Object.assign(p, { phase: "echec", erreur: e.erreur.message });
          else Object.assign(p, { phase: "a-trancher", demandeTranche: undefined });
        } else if (e.statut === "termine") Object.assign(p, { phase: "a-rendre", audioCle: e.sortieCle });
      } else if (p.phase === "a-rendre") {
        if (p.tranche && !principalAccepte) {
          pieces.push(p);
          continue;
        }
        if (!etat.lookIds[p.angle]) throw Object.assign(new Error("Ce double n'a pas d'identifiant chez le fournisseur."), { reessayable: false });
        // GARDE-FOU (plafond) : rien ne part si l'envoi dépasserait le prix annoncé et confirmé (× 1,5).
        const duree = Math.max(0, p.finSec - p.debutSec);
        if (envoyees + duree > o.plafondSec) throw Object.assign(new Error("Votre avatar coûterait plus que le prix annoncé : rien de plus n'est envoyé. Relancez la vidéo pour voir le nouveau prix."), { reessayable: false });
        // Tour 1 de l'envoi : la décision est GARDÉE (titre unique, rappel imprévisible), sans appel. Les secondes sont
        // comptées une fois par essai (la même clé rejouée après une panne n'est pas recomptée).
        const cle = cleRendu(o.travailId, p);
        envoyees += duree;
        Object.assign(p, { phase: "envoi", titreRendu: titreRendu(o.titre, p, cle), decideLe: new Date().toISOString(), callbackId: p.callbackId ?? `cb-${randomBytes(16).toString("hex")}`, pannes: 0 });
      } else if (p.phase === "envoi") {
        // Tour 2 : la demande est peut-être déjà arrivée (panne juste après l'envoi) : on la cherche d'abord, gratuitement.
        // Recherche impossible (réseau) : l'envoi part quand même avec la MÊME clé d'idempotence (jamais payé deux fois).
        const deja = o.visage.retrouverRendu && p.titreRendu ? await o.visage.retrouverRendu(p.titreRendu, p.decideLe ? { depuis: p.decideLe } : undefined).catch(() => null) : null;
        if (deja) Object.assign(p, { phase: "rendu", idExterne: deja.idTravailExterne, pannes: 0 });
        else {
          try {
            const r = await o.visage.rendre({ visageId: etat.lookIds[p.angle]!, audioCle: p.audioCle!, audioUrl: await o.lecture(p.audioCle!, 24 * 3600), fond: fondDuRendu(fond), ratio: "9:16", motionPrompt: o.consigne(p.angle), cleIdempotence: cleRendu(o.travailId, p), callbackId: p.callbackId, titre: p.titreRendu, ...(etat.referenceLookIds?.[p.angle] ? { referenceLookId: etat.referenceLookIds[p.angle] } : {}) });
            Object.assign(p, { phase: "rendu", idExterne: r.idTravailExterne, pannes: 0 });
          } catch (err) {
            if (!(err as { sansFondImpossible?: boolean })?.sansFondImpossible || fond === "decor-du-look") throw err;
            const dejaParti = etat.pieces.some((x) => x !== p0 && (x.phase === "rendu" || x.phase === "faite" || x.phase === "envoi"));
            if (dejaParti) throw err;
            // Rien n'est encore parti : repli automatique sur le fond uni pour TOUS les angles (clé neuve). Refusé avant
            // tout rendu : ces secondes ne sont pas parties.
            envoyees -= Math.max(0, p.finSec - p.debutSec);
            fond = "uni";
            Object.assign(p, { phase: "a-rendre", essai: p.essai + 1, titreRendu: undefined, callbackId: undefined });
          }
        }
      } else if (p.phase === "rendu") {
        const e = await o.visage.suivreRendu(p.idExterne!);
        const reverifier = p.reverifier;
        p.reverifier = undefined;
        if (e.statut === "termine") {
          const rec = await o.visage.recuperer(p.idExterne!, { fond: fondDuRendu(fond) });
          Object.assign(p, { phase: "faite", videoCle: rec.videoCle, dureeSec: rec.dureeSec });
        } else if (e.statut === "echec") {
          // Rendu échoué CONNU : clé neuve (la même clé rejouerait l'échec), adresse neuve, quelques essais.
          if (e.erreur.reessayable && p.essai + 1 < ESSAIS_PIECE) Object.assign(p, { phase: "a-rendre", essai: p.essai + 1, idExterne: undefined, callbackId: undefined, titreRendu: undefined });
          else Object.assign(p, { phase: "echec", erreur: e.erreur.message, detail: e.erreur.detailTechnique });
        } else if (reverifier) {
          // RELECTURE FINALE E1 — « Réessayer » après un rendu trop long, toujours pas fini : RIEN n'est renvoyé (HeyGen
          // peut encore le finir et le facturer : un second envoi serait payé deux fois). La pièce reste en échec avec
          // l'identifiant de l'ancien rendu (relu au prochain « Réessayer ») et reste comptée (`delaiDepasse`).
          Object.assign(p, { phase: "echec", delaiDepasse: true, toujoursEnCours: true, erreur: MESSAGE_DOUBLE_TOUJOURS_EN_COURS, detail: `Rendu ${p.idExterne} toujours « en cours » au « Réessayer ».` });
        } else {
          // Délai maximal : compté depuis la décision d'envoi (posée ici pour un état ancien qui ne l'avait pas).
          const depuis = p.decideLe ? Date.parse(p.decideLe) : NaN;
          if (!Number.isFinite(depuis)) p.decideLe = new Date().toISOString();
          else if (Date.now() - depuis > DELAI_MAX_RENDU_DOUBLE_MS) Object.assign(p, { phase: "echec", erreur: MESSAGE_DELAI_RENDU_DOUBLE, delaiDepasse: true, detail: `Rendu ${p.idExterne} encore « en cours » après ${Math.round((Date.now() - depuis) / 3600_000)} h.` });
        }
      }
    } catch (err) {
      const x = err as { reessayable?: boolean; message?: string; erreur?: { reessayable?: boolean; message?: string } };
      const reessayable = x?.reessayable ?? x?.erreur?.reessayable ?? true;
      if (!reessayable && p.phase === "rendu" && p.idExterne) {
        // RELECTURE FINALE 2, D1 — refus net PENDANT le suivi (ou la relecture) d'un rendu déjà accepté par HeyGen : il
        // peut être fini, ou finir, et être facturé. Il reste compté, avec son identifiant ; « Réessayer » le relit
        // (jamais renvoyé tant que HeyGen y travaille). La raison brute reste en détail technique.
        Object.assign(p, { phase: "echec", suiviRefuse: true, reverifier: undefined, erreur: messageSuiviRefuse(x?.message), detail: `Rendu ${p.idExterne} : suivi refusé (${x?.message ?? "sans raison"}).` });
      } else if (!reessayable) {
        // Envoi refusé AVANT acceptation (réglage éteint, crédits épuisés, refus du fournisseur) : rien n'est parti, les
        // secondes comptées au tour 1 sont rendues (sinon « Réessayer » buterait sur un plafond faussement atteint).
        if (p.phase === "envoi") envoyees -= Math.max(0, p.finSec - p.debutSec);
        Object.assign(p, { phase: "echec", erreur: x?.message ?? "Le double n'a pas pu être rendu." });
      } else if (p.phase === "envoi") {
        // On ignore si la demande est arrivée : elle sera cherchée, puis la MÊME clé rejouée (jamais payée deux fois).
        p.pannes = (p.pannes ?? 0) + 1;
        if (p.pannes >= PANNES_SOUMISSION) throw err;
      }
    }
    pieces.push(p);
  }
  return { ...etat, pieces, secondesEnvoyees: Math.round(envoyees * 1000) / 1000, fond };
}

/** Fond demandé au fournisseur pour l'état du double. */
const fondDuRendu = (fond: NonNullable<EtatDoubleMoteur["fond"]>): FondRenduVisage => (fond === "uni" ? "uni" : fond === "decor-du-look" ? "decor-du-look" : "transparent");

/**
 * Ce que la composition reçoit du double réel (correcteur réel 2 : extrait du moteur, PUR, testé) : pistes, passages ;
 * fond uni → pistes opaques sans décor ; décor du look → pistes opaques qui PORTENT le décor (chemin `lookReel`).
 */
export function compositionDuDouble(e: EtatDoubleMoteur): { pistesDouble: Partial<Record<AngleVisage, string>>; tranchesDouble?: Partial<Record<AngleVisage, { cle: string; debutSec: number; finSec: number }[]>>; doubleFondUni?: true; pistesDepuisLook?: true } {
  const r = pistesPourComposition(e);
  return { pistesDouble: r.pistesDouble, ...(Object.keys(r.tranchesDouble).length ? { tranchesDouble: r.tranchesDouble } : {}), ...(e.fond === "uni" ? { doubleFondUni: true as const } : {}), ...(e.fond === "decor-du-look" ? { pistesDepuisLook: true as const } : {}) };
}

/** Pistes pour la composition : la piste continue de l'angle principal, les passages du second. */
export function pistesPourComposition(e: EtatDoubleMoteur | undefined): { pistesDouble: Partial<Record<AngleVisage, string>>; tranchesDouble: Partial<Record<AngleVisage, { cle: string; debutSec: number; finSec: number }[]>> } {
  const pistesDouble: Partial<Record<AngleVisage, string>> = {};
  const tranchesDouble: Partial<Record<AngleVisage, { cle: string; debutSec: number; finSec: number }[]>> = {};
  for (const p of e?.pieces ?? []) {
    if (p.phase !== "faite" || !p.videoCle) continue;
    if (!p.tranche) pistesDouble[p.angle] = p.videoCle;
    else (tranchesDouble[p.angle] ??= []).push({ cle: p.videoCle, debutSec: p.debutSec, finSec: p.finSec });
  }
  return { pistesDouble, tranchesDouble };
}
