/**
 * CRÉDITS DES FOURNISSEURS — calculs PURS (lot « crédits », 02/10, D2 ; consigne `CREDITS-ET-CLES.md`).
 * Aucun appel réseau, aucune base : `services/credits.ts` lit, ce fichier calcule (testé).
 *
 * Montants : en CENTIMES de la devise du fournisseur (HeyGen, fal.ai, Claude : dollars). Les dépenses du studio
 * (`DepenseEnregistree`) sont en euros : elles sont converties au taux dollar → euro du studio (`taux.usdEur`).
 */
import type { DepenseEnregistree, LigneCout, RechargeCredit, ReleveSolde, ReservationCredit } from "./types";
import { formateurNombre } from "@/lib/intl";

/** Marge de sécurité ajoutée à chaque estimation (consigne §3 : +20 %). */
export const MARGE = 0.2;
/** Seuils d'alerte, en pourcentage du solde de référence (consigne §5). */
export const SEUILS_ALERTE = [50, 25, 10] as const;
/** Rapprochement quotidien : un écart de plus de 10 % = « dépense inexpliquée ». */
export const ECART_RAPPROCHEMENT = 0.1;
/** Rappel d'expiration des crédits (fal.ai : 365 jours après l'achat), 30 jours avant. */
export const RAPPEL_EXPIRATION_JOURS = 30;
export const DUREE_CREDITS_FAL_JOURS = 365;
/** « ≈ N vidéos restantes » : coût moyen réel des 10 dernières vidéos. */
export const VIDEOS_POUR_LA_MOYENNE = 10;
/** Alerte « tôt » : il reste ≈ 10 vidéos (ou 10 scripts pour Claude) ou moins, même si aucun pourcentage n'est franchi. */
export const SEUIL_VIDEOS_ALERTE = 10;
/** Une alerte « épuisé » n'est pas répétée avant une recharge constatée ou déclarée, ou ce délai. */
export const DELAI_RAPPEL_EPUISE_MS = 24 * 60 * 60_000;

/** Identifiant canonique d'un fournisseur payant (« fal.ai », « fal-ai » → « fal »). */
export function idFournisseur(f: string): string {
  const x = f.trim().toLowerCase();
  if (x === "fal.ai" || x === "fal-ai" || x === "fal") return "fal";
  if (x === "claude") return "anthropic";
  return x;
}

/** Une ligne d'euros convertie en centimes de dollar (taux dollar → euro du studio). */
export function eurVersUsd(centimesEur: number, tauxUsdEur: number): number {
  return tauxUsdEur > 0 ? centimesEur / tauxUsdEur : centimesEur;
}

/** « 29,83 $ » (le studio ne compte qu'en euros : les dollars des fournisseurs s'affichent ici). */
export function formaterDollars(centimesUsd: number, court = false): string {
  const rond = Math.round(centimesUsd) % 100 === 0;
  return formateurNombre("fr-FR", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: court && rond ? 0 : 2, maximumFractionDigits: court && rond ? 0 : 2 }).format(Math.round(centimesUsd) / 100);
}

/* --- Clés : jamais affichées, jamais journalisées ------------------- */

/** « …a1B2 » : les 4 derniers caractères, jamais plus (et rien si la clé est trop courte pour rester secrète). */
export function finDeCle(cle: string | undefined | null): string | undefined {
  const c = cle?.trim();
  if (!c || c.length < 12) return undefined;
  return `…${c.slice(-4)}`;
}

/** Remplace toute clé connue par « ••• » dans un texte (message d'erreur d'un fournisseur, journal). */
export function masquerCles(texte: string, cles: (string | undefined)[]): string {
  let sortie = texte;
  for (const cle of cles) {
    const c = cle?.trim();
    if (c && c.length >= 8) sortie = sortie.split(c).join("•••");
  }
  return sortie;
}

/* --- Soldes ---------------------------------------------------------- */

/** Dépense d'un fournisseur (centimes de dollar) dans des dépenses en euros, depuis une date (incluse). */
export function depenseDuFournisseur(depenses: Pick<DepenseEnregistree, "lignes" | "date">[], fournisseur: string, tauxUsdEur: number, depuis?: string): number {
  const id = idFournisseur(fournisseur);
  let total = 0;
  for (const d of depenses) {
    if (depuis && d.date < depuis) continue;
    for (const l of d.lignes) if (l.nature === "reel" && idFournisseur(l.fournisseur) === id) total += eurVersUsd(l.total.centimes, tauxUsdEur);
  }
  return total;
}

/**
 * Solde « suivi » (fal.ai, Claude : aucune lecture possible sans clé ADMIN) : dernière recharge déclarée moins les
 * dépenses réelles enregistrées depuis. `null` : aucune recharge déclarée (solde inconnu, rien n'est bloqué).
 */
export function soldeSuivi(recharges: Pick<RechargeCredit, "fournisseur" | "centimes" | "date">[], depenses: Pick<DepenseEnregistree, "lignes" | "date">[], fournisseur: string, tauxUsdEur: number): { centimes: number; depuis: string; recharge: number } | null {
  const id = idFournisseur(fournisseur);
  const siennes = recharges.filter((r) => idFournisseur(r.fournisseur) === id).sort((a, b) => a.date.localeCompare(b.date));
  const derniere = siennes.at(-1);
  if (!derniere) return null;
  const depense = depenseDuFournisseur(depenses, id, tauxUsdEur, derniere.date);
  return { centimes: Math.round(derniere.centimes - depense), depuis: derniere.date, recharge: derniere.centimes };
}

/** Somme des réservations ACTIVES d'un fournisseur (centimes de dollar). */
export function totalReserve(reservations: Pick<ReservationCredit, "fournisseur" | "centimes" | "statut">[], fournisseur: string, sauf?: (r: Pick<ReservationCredit, "fournisseur" | "centimes" | "statut">) => boolean): number {
  const id = idFournisseur(fournisseur);
  return reservations.filter((r) => r.statut === "active" && idFournisseur(r.fournisseur) === id && !sauf?.(r)).reduce((s, r) => s + r.centimes, 0);
}

/**
 * Solde de référence de la jauge : le solde juste après la dernière recharge (une hausse entre deux relevés, ou une
 * recharge déclarée), puis le plus haut depuis. La jauge et les seuils 50 / 25 / 10 % se lisent par rapport à lui.
 */
export function soldeDeReference(releves: Pick<ReleveSolde, "centimes" | "luLe">[], recharges: Pick<RechargeCredit, "centimes" | "date">[] = []): number | null {
  const points = [...releves.map((r) => ({ t: r.luLe, c: r.centimes, recharge: false })), ...recharges.map((r) => ({ t: r.date, c: r.centimes, recharge: true }))].sort((a, b) => a.t.localeCompare(b.t));
  let reference: number | null = null;
  let precedent: number | null = null;
  for (const p of points) {
    if (p.recharge) {
      // Une recharge déclarée s'ajoute au dernier solde connu (sur un solde lu) ; c'est le nouveau départ.
      reference = (precedent ?? 0) + p.c;
      precedent = reference;
      continue;
    }
    if (reference === null || precedent === null || p.c > precedent) reference = p.c;
    else reference = Math.max(reference, p.c);
    precedent = p.c;
  }
  return reference;
}

/** Coût moyen RÉEL d'une vidéo chez un fournisseur (centimes de dollar), sur ses 10 dernières vidéos qui l'ont payé. */
export function coutMoyenVideo(depenses: Pick<DepenseEnregistree, "videoId" | "lignes" | "date">[], fournisseur: string, tauxUsdEur: number, n: number = VIDEOS_POUR_LA_MOYENNE): number | null {
  const id = idFournisseur(fournisseur);
  const parVideo = new Map<string, { date: string; total: number }>();
  for (const d of depenses) {
    if (!d.videoId) continue;
    const part = d.lignes.filter((l) => l.nature === "reel" && idFournisseur(l.fournisseur) === id).reduce((s, l) => s + eurVersUsd(l.total.centimes, tauxUsdEur), 0);
    if (part <= 0) continue;
    const v = parVideo.get(d.videoId) ?? { date: d.date, total: 0 };
    parVideo.set(d.videoId, { date: v.date > d.date ? v.date : d.date, total: v.total + part });
  }
  const dernieres = [...parVideo.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  if (!dernieres.length) return null;
  return dernieres.reduce((s, v) => s + v.total, 0) / dernieres.length;
}

/** Coût moyen RÉEL d'un script Claude (centimes de dollar), sur ses `n` derniers scripts payés (dépenses rattachées à un script maître). */
export function coutMoyenScript(depenses: Pick<DepenseEnregistree, "scriptMaitreId" | "lignes" | "date">[], fournisseur: string, tauxUsdEur: number, n: number = VIDEOS_POUR_LA_MOYENNE): number | null {
  const id = idFournisseur(fournisseur);
  const parScript = new Map<string, { date: string; total: number }>();
  for (const d of depenses) {
    if (!d.scriptMaitreId) continue;
    const part = d.lignes.filter((l) => l.nature === "reel" && idFournisseur(l.fournisseur) === id).reduce((s, l) => s + eurVersUsd(l.total.centimes, tauxUsdEur), 0);
    if (part <= 0) continue;
    const v = parScript.get(d.scriptMaitreId) ?? { date: d.date, total: 0 };
    parScript.set(d.scriptMaitreId, { date: v.date > d.date ? v.date : d.date, total: v.total + part });
  }
  const derniers = [...parScript.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  if (!derniers.length) return null;
  return derniers.reduce((s, v) => s + v.total, 0) / derniers.length;
}

/** Coût moyen de ce qu'un fournisseur fabrique : des scripts pour Claude (à défaut, des vidéos), des vidéos pour les autres. */
export function coutMoyenUnite(depenses: Pick<DepenseEnregistree, "videoId" | "scriptMaitreId" | "lignes" | "date">[], fournisseur: string, tauxUsdEur: number): number | null {
  if (idFournisseur(fournisseur) === "anthropic") return coutMoyenScript(depenses, fournisseur, tauxUsdEur) ?? coutMoyenVideo(depenses, fournisseur, tauxUsdEur);
  return coutMoyenVideo(depenses, fournisseur, tauxUsdEur);
}

/** « ≈ 8 vidéos » / « ≈ 1 script » : le reste, dans l'unité du fournisseur (Claude : scripts). */
export function texteRestant(fournisseur: string, n: number): string {
  const mot = idFournisseur(fournisseur) === "anthropic" ? "script" : "vidéo";
  return `≈ ${n} ${mot}${n > 1 ? "s" : ""}`;
}

/** « ≈ 8 vidéos restantes » / « ≈ 1 script restant » (accord compris). */
export function texteRestants(fournisseur: string, n: number): string {
  const claude = idFournisseur(fournisseur) === "anthropic";
  return `${texteRestant(fournisseur, n)} restant${claude ? "" : "e"}${n > 1 ? "s" : ""}`;
}

/** « ≈ N vidéos restantes » (null : pas encore de vidéo payée chez ce fournisseur). */
export function videosRestantes(disponible: number, coutMoyen: number | null): number | null {
  if (coutMoyen === null || coutMoyen <= 0) return null;
  return Math.max(0, Math.floor(disponible / coutMoyen));
}

/** `neutre` : solde inconnu (audit 4.10), jamais vert par défaut. */
export type TonJauge = "vert" | "orange" | "rouge" | "neutre";

/** Vert ; orange sous 25 % ; rouge sous 10 % ou s'il reste moins d'une vidéo (consigne §2). */
export function tonJauge(disponible: number, reference: number | null, coutMoyen: number | null): TonJauge {
  const pct = reference && reference > 0 ? (disponible / reference) * 100 : 100;
  if (pct < 10 || (coutMoyen !== null && coutMoyen > 0 && disponible < coutMoyen)) return "rouge";
  if (pct < 25) return "orange";
  return "vert";
}

export function pourcentage(disponible: number, reference: number | null): number | null {
  if (!reference || reference <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((disponible / reference) * 100)));
}

/**
 * Alerte à envoyer quand le solde baisse : le seuil le plus bas FRANCHI depuis la dernière alerte (50, 25, 10 %), ou
 * « une-video » quand il reste moins d'une vidéo. `deja` : seuils déjà signalés depuis la dernière recharge.
 */
export function alerteAEnvoyer(pct: number | null, disponible: number, coutMoyen: number | null, deja: string[]): { cle: string; email: boolean } | null {
  if (coutMoyen !== null && coutMoyen > 0 && disponible < coutMoyen && !deja.includes("une-video")) return { cle: "une-video", email: true };
  if (coutMoyen !== null && coutMoyen > 0 && Math.floor(disponible / coutMoyen) <= SEUIL_VIDEOS_ALERTE && !deja.includes("10-videos") && !deja.includes("une-video")) return { cle: "10-videos", email: true };
  if (pct === null) return null;
  for (const seuil of [...SEUILS_ALERTE].sort((a, b) => a - b)) {
    if (pct < seuil) {
      const cle = String(seuil);
      if (deja.includes(cle)) return null;
      return { cle, email: seuil <= 10 };
    }
  }
  return null;
}

/** Titre et texte d'une alerte de solde : fournisseur, solde, ≈ N restants, action. Vouvoiement, court. */
export function messageAlerteCredit(a: { nom: string; fournisseur: string; cle: string; disponibleTexte: string; restantes: number | null }): { titre: string; message: string } {
  const reste = a.restantes === null ? null : texteRestants(a.fournisseur, a.restantes);
  const titre =
    a.cle === "une-video" ? `${a.nom} : plus qu'${idFournisseur(a.fournisseur) === "anthropic" ? "un script" : "une vidéo"}`
    : a.cle === "10-videos" ? `${a.nom} : ${reste ?? "crédit bientôt épuisé"}`
    : `${a.nom} : crédit sous ${a.cle} %${reste ? ` · ${reste}` : ""}`;
  return { titre, message: `Il reste ${a.disponibleTexte}${reste ? ` (${reste})` : ""}. Rechargez votre compte ${a.nom}.` };
}

/**
 * Phrase (sans le mot « recharger » : un forfait se renouvelle, il ne se recharge pas) quand tous les comptes retenus
 * sont épuisés. `comptes` : nombre de comptes retenus par le choix (clés posées, distinctes, non désactivées).
 */
export function messageComptesEpuises(comptes: number): string {
  if (comptes <= 1) return "Le compte Claude est épuisé jusqu'à son renouvellement.";
  if (comptes === 2) return "Les 2 comptes Claude sont épuisés jusqu'à leur renouvellement.";
  return "Les comptes Claude 1, 2 et 3 sont épuisés jusqu'à leur renouvellement.";
}

/** Titre et texte de l'alerte « épuisé » (une seule fois par fournisseur jusqu'à la recharge). */
export function messageEpuise(a: { nom: string; fournisseur: string; disponibleTexte: string | null; restantes: number | null; comptes?: number }): { titre: string; message: string } {
  // Comptes Claude d'abonnement tous épuisés : un forfait se renouvelle, il ne se recharge pas.
  if (a.comptes !== undefined && idFournisseur(a.fournisseur) === "anthropic") return { titre: "Comptes Claude épuisés", message: `${messageComptesEpuises(a.comptes)} L'écriture reprendra au renouvellement : touchez « Reprendre » sur l'écriture.` };
  const solde = a.disponibleTexte ? `Solde ${a.disponibleTexte}${a.restantes !== null ? `, ${texteRestants(a.fournisseur, a.restantes)}` : ""}. ` : "";
  // Une écriture Claude ne repart pas seule après la recharge (« Reprendre ») ; les vidéos, si.
  const suite = idFournisseur(a.fournisseur) === "anthropic" ? ". Après la recharge, touchez « Reprendre » sur l'écriture." : " : la fabrication reprendra toute seule, rien n'est repayé.";
  return { titre: `Crédit ${a.nom} épuisé`, message: `${solde}Rechargez votre compte ${a.nom}${suite}` };
}

/** Dernier recours (aucune attente enregistrée) : phrase de la page d'un sujet dont l'écriture attend du crédit. */
export function messageAttenteEcritureParDefaut(abonnements: boolean): string {
  return abonnements ? "Écriture en attente : touchez « Reprendre » quand ce sera possible." : "Crédit Claude insuffisant : rechargez-le, puis touchez « Reprendre ».";
}

/** Claude en mode « abonnements » sans aucun compte utilisable : ni renouvellement ni recharge, il faut poser une clé. */
export const MESSAGE_AUCUN_COMPTE_CLAUDE = "Aucun compte Claude actif : posez une clé d'abonnement ou passez en API payante.";

/** Le bandeau de l'Accueil : un fournisseur épuisé ou à ≈ 10 unités ou moins (`null` : rien à signaler). */
export function bandeauCredit(cartes: { fournisseur: string; nom: string; cleRefusee: boolean; videosRestantes: number | null; enAttente: number; epuise?: boolean; comptesEpuises?: number; abonnements?: boolean; aucunCompte?: boolean }[]): { epuise: boolean; lignes: string[] } | null {
  const lignes: string[] = [];
  let epuise = false;
  for (const c of cartes) {
    // Claude en abonnements sans aucun compte utilisable : dit avant tout, même si une clé a été refusée.
    if (c.abonnements && c.aucunCompte) {
      lignes.push(MESSAGE_AUCUN_COMPTE_CLAUDE);
      continue;
    }
    if (c.cleRefusee) continue;
    // Claude en abonnements : un forfait se renouvelle, il ne se recharge pas. Seul l'état « tous épuisés » est signalé.
    // Des travaux en attente sans comptes épuisés (limite du mois, budget, seuil…) : une ligne neutre, sans alarme ni « recharger ».
    if (c.abonnements && c.comptesEpuises === undefined) {
      if (c.enAttente > 0) lignes.push(`${c.nom} : ${c.enAttente} ${c.enAttente > 1 ? "travaux" : "travail"} en attente.`);
      continue;
    }
    if (c.enAttente > 0 || c.videosRestantes === 0 || c.epuise || c.comptesEpuises !== undefined) {
      epuise = true;
      lignes.push(c.comptesEpuises !== undefined ? messageComptesEpuises(c.comptesEpuises) : `${c.nom} épuisé : rechargez votre compte.`);
    } else if (c.videosRestantes !== null && c.videosRestantes <= SEUIL_VIDEOS_ALERTE) {
      lignes.push(`${c.nom} : ${texteRestants(c.fournisseur, c.videosRestantes)}. Rechargez bientôt.`);
    }
  }
  return lignes.length ? { epuise, lignes } : null;
}

/* --- Pré-vol --------------------------------------------------------- */

/** Ce qu'une fabrication demande à un fournisseur, marge comprise. */
export interface BesoinFournisseur {
  fournisseur: string;
  /** Estimation sans marge, centimes de dollar. */
  estimation: number;
  /** Estimation + 20 %. */
  avecMarge: number;
  /** Étapes concernées (« Voix », « Illustrations à fabriquer »). */
  etapes: string[];
}

/** Regroupe des lignes déjà rattachées à leur fournisseur payant (centimes de dollar) et ajoute la marge. */
export function besoinsParFournisseur(lignes: { fournisseur: string; centimesUsd: number; etape: string }[], marge: number = MARGE): BesoinFournisseur[] {
  const parId = new Map<string, BesoinFournisseur>();
  for (const l of lignes) {
    if (l.centimesUsd <= 0) continue;
    const id = idFournisseur(l.fournisseur);
    const b = parId.get(id) ?? { fournisseur: id, estimation: 0, avecMarge: 0, etapes: [] };
    b.estimation += l.centimesUsd;
    if (!b.etapes.includes(l.etape)) b.etapes.push(l.etape);
    parId.set(id, b);
  }
  return [...parId.values()].map((b) => ({ ...b, estimation: Math.round(b.estimation), avecMarge: Math.ceil(b.estimation * (1 + marge)) }));
}

export interface Manque {
  fournisseur: string;
  /** Solde moins réservations actives. */
  disponible: number;
  /** Estimation + 20 %. */
  demande: number;
}

/**
 * Le pré-vol (consigne §3) : pour CHAQUE fournisseur, solde − réservations ≥ estimation × 1,2. Renvoie tous les
 * manques (un seul suffit à bloquer). Un fournisseur sans solde connu (`null`) ne bloque pas.
 */
export function manques(besoins: BesoinFournisseur[], disponibles: Record<string, number | null>): Manque[] {
  const sortie: Manque[] = [];
  for (const b of besoins) {
    const dispo = disponibles[b.fournisseur];
    if (dispo === null || dispo === undefined) continue;
    if (dispo < b.avecMarge) sortie.push({ fournisseur: b.fournisseur, disponible: dispo, demande: b.avecMarge });
  }
  return sortie;
}

/* --- Rapprochement et expiration ------------------------------------- */

/** Écart relatif entre le solde lu et le solde attendu ; « inexpliqué » si le solde lu est plus bas de plus de 10 %. */
export function rapprochement(lu: number, attendu: number): { ecart: number; inexplique: boolean; recharge: boolean } {
  const base = Math.max(1, Math.abs(attendu));
  const ecart = (lu - attendu) / base;
  return { ecart, inexplique: ecart < -ECART_RAPPROCHEMENT, recharge: ecart > ECART_RAPPROCHEMENT };
}

/** Recharges dont les crédits expirent dans moins de 30 jours (et pas encore expirées). */
export function expirationsProches<R extends Pick<RechargeCredit, "expireLe">>(recharges: R[], maintenant: number, jours: number = RAPPEL_EXPIRATION_JOURS): R[] {
  return recharges.filter((r) => {
    if (!r.expireLe) return false;
    const t = new Date(r.expireLe).getTime();
    return t > maintenant && t - maintenant <= jours * 86_400_000;
  });
}

/** Date d'expiration par défaut d'une recharge fal.ai (365 jours après l'achat). */
export function expirationParDefaut(fournisseur: string, date: string): string | undefined {
  if (idFournisseur(fournisseur) !== "fal") return undefined;
  return new Date(new Date(date).getTime() + DUREE_CREDITS_FAL_JOURS * 86_400_000).toISOString();
}

/** Lot R2 : la seule règle du tri — une ligne `facultative` ne bloque jamais un lancement. */
function estFacultative(l: LigneCout): boolean {
  return !!l.facultative;
}

/** Lot R2 : les lignes qui peuvent bloquer un lancement. */
export function lignesBloquantes(lignes: LigneCout[]): LigneCout[] {
  return lignes.filter((l) => !estFacultative(l));
}

/**
 * Lot R2 : la part du total qui peut bloquer un lancement, en centimes. Part du TOTAL (qui peut ne pas être la somme
 * des lignes) et en retire les lignes facultatives.
 */
export function centimesBloquants(estimation: { lignes: LigneCout[]; total: { centimes: number } }): number {
  return estimation.total.centimes - estimation.lignes.filter(estFacultative).reduce((s, l) => s + l.total.centimes, 0);
}

/** Lignes réelles d'un fournisseur (pour « consommé ce mois »). */
export function lignesDuFournisseur(lignes: LigneCout[], fournisseur: string): LigneCout[] {
  const id = idFournisseur(fournisseur);
  return lignes.filter((l) => idFournisseur(l.fournisseur) === id);
}
