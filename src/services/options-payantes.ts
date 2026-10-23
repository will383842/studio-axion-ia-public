/**
 * SERVICE « OPTIONS PAYANTES » (lot J, décision de Will du 09/10). Serveur seulement.
 *
 * Exception à « aucun prix » du face caméra : chaque fois qu'une option payante est demandée (Décor IA, effets main
 * « ultra réaliste », multicaméra réelle avocat ou face caméra), le studio prévient AVANT de dépenser avec une carte
 * « Option payante — environ X € pris sur vos crédits <outil>. [Confirmer] [Annuler] ».
 *  - `demanderOptionPayante` : crée la demande (24 h), sauf plafond du mois atteint (le plafond passe avant tout) ;
 *  - `confirmerOptionPayante` : une NOUVELLE VERSION part, qui porte le jeton dans ses entrées ;
 *  - `annulerOptionPayante` : rien n'est dépensé, la version gratuite reste ;
 *  - `gardePourTravail` : la garde que les fournisseurs réels exigent au moment de l'appel (consomme le jeton porté par
 *    la version du travail, une seule fois, et revérifie le plafond).
 * Les demandes vivent dans le paramètre `optionsPayantes.demandes` (liste courte, rangée à chaque écriture).
 *
 * HORS PORTE (L3-01, audit argent) : ces passes (décor IA Higgsfield, ultra réaliste et effet réaliste IA, multicaméra
 * HeyGen) ne passent PAS par une porte de credits.ts (ni verrou Postgres, ni réservation, ni origine). Raison : aucun
 * appel réel ne part sans le jeton d'une demande confirmée, et seule `confirmerOptionPayante` confirme, derrière
 * `exigerSession()` : c'est une action de clic « Confirmer » de Will uniquement, qu'une commande de l'Usine ne peut pas
 * produire. Le plafond du mois est revérifié au moment de l'appel (`autoriser`). Liste fermée des points d'entrée :
 * tests/l3-0-garde-origine.test.ts, § 5. Si l'Usine doit un jour déclencher une option, elle passera sous le verrou
 * des crédits avec réservation et origine (lot 4).
 */
import "server-only";
import {
  annuler,
  avecAccord,
  confirmer,
  consommer,
  demanderConfirmation,
  etatActuel,
  lireEntreesOptions,
  MESSAGE_NON_CONFIRMEE,
  MESSAGE_OPTION_RETIREE,
  optionDemandeePourVersion,
  optionRetiree,
  phraseCarte,
  ranger,
  REPONSE_MONTEUR_ANNULEE,
  REPONSE_MONTEUR_CONFIRMEE,
  REPONSE_MONTEUR_COUPEES,
  REPONSE_MONTEUR_PLAFOND,
  REPONSE_MONTEUR_A_CONFIRMER,
  TARIFS_PAR_DEFAUT,
  verifier,
  vueCarte,
  type ContexteOption,
  type DemandeConfirmation,
  type GardeOptionPayante,
  type IdOptionPayante,
  type OrigineDemande,
  type Tarifs,
  type VueCarteConfirmation,
} from "@/briques/options-payantes";
import type { Id } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { resumeBudget } from "./couts";

export const PARAM_DEMANDES = "optionsPayantes.demandes";
/** Prix d'un crédit Higgsfield (centimes d'euro), réglable sans changer le code ; défaut : celui du lot E1. */
export const PARAM_PRIX_CREDIT_HIGGSFIELD = "optionsPayantes.prixCreditHiggsfieldCentimes";
/**
 * Vérif V4 : interrupteur « Couper toutes les options payantes » (Réglages › Budget). Coupé : aucune carte payante
 * n'est proposée (fabrication, monteur, Réglages), les cartes ouvertes ne se confirment plus et la garde refuse tout
 * appel payant, même déjà confirmé. Éteint par défaut (les options gardent leur carte de confirmation).
 */
export const PARAM_OPTIONS_COUPEES = "optionsPayantes.coupees";
export const MESSAGE_OPTIONS_COUPEES = "Les options payantes sont coupées dans Réglages : rien n'est dépensé, la version gratuite sort.";

export async function optionsPayantesCoupees(): Promise<boolean> {
  return (await lireParametre<unknown>(PARAM_OPTIONS_COUPEES, false)) === true;
}

export async function definirOptionsPayantesCoupees(coupees: boolean): Promise<boolean> {
  await exigerSession();
  await ecrireParametre(PARAM_OPTIONS_COUPEES, coupees === true);
  await journaliser("reglages", coupees ? "Options payantes coupées" : "Options payantes permises (chacune demande votre accord)");
  return coupees === true;
}

/** Vérif V4 : l'option peut-elle être proposée et dépensée (ni retirée, ni coupée par l'interrupteur) ? */
async function refusOption(optionId: IdOptionPayante): Promise<string | null> {
  if (optionRetiree(optionId)) return MESSAGE_OPTION_RETIREE;
  if (await optionsPayantesCoupees()) return MESSAGE_OPTIONS_COUPEES;
  return null;
}

/* ------------------------------------------------------------------ */
/* Stockage (lecture-écriture en file : une consommation à la fois)    */
/* ------------------------------------------------------------------ */

let file: Promise<unknown> = Promise.resolve();
function enFile<T>(f: () => Promise<T>): Promise<T> {
  const suite = file.then(f, f);
  file = suite.catch(() => undefined);
  return suite;
}

async function lireDemandes(): Promise<DemandeConfirmation[]> {
  const brut = await lireParametre<unknown>(PARAM_DEMANDES, []);
  return Array.isArray(brut) ? (brut as DemandeConfirmation[]).filter((d) => d && typeof d.jeton === "string" && typeof d.optionId === "string") : [];
}

async function ecrireDemandes(liste: DemandeConfirmation[]): Promise<void> {
  await ecrireParametre(PARAM_DEMANDES, ranger(liste, new Date()));
}

async function remplacer(d: DemandeConfirmation): Promise<void> {
  const liste = await lireDemandes();
  await ecrireDemandes(liste.map((x) => (x.jeton === d.jeton ? d : x)));
}

export async function tarifs(): Promise<Tarifs> {
  const prix = await lireParametre<number>(PARAM_PRIX_CREDIT_HIGGSFIELD, TARIFS_PAR_DEFAUT.prixCreditHiggsfieldCentimes);
  const t = await lireParametre<number>("taux.usdEur", TARIFS_PAR_DEFAUT.tauxUsdEur);
  return {
    prixCreditHiggsfieldCentimes: Number.isFinite(prix) && prix > 0 ? prix : TARIFS_PAR_DEFAUT.prixCreditHiggsfieldCentimes,
    tauxUsdEur: Number.isFinite(t) && t > 0 ? t : TARIFS_PAR_DEFAUT.tauxUsdEur,
  };
}

const jetonNeuf = () => `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`.replace(/-/g, "");

/* ------------------------------------------------------------------ */
/* Demander                                                            */
/* ------------------------------------------------------------------ */

export type ResultatDemandeOption = { statut: "a-confirmer"; carte: VueCarteConfirmation; demande: DemandeConfirmation } | { statut: "plafond" | "coupee"; message: string };

/**
 * Demande la confirmation d'une option payante pour cette version. Une demande encore ouverte pour la même option, la
 * même vidéo et la même version est rendue telle quelle (une seule carte à la fois).
 */
export async function demanderOptionPayante(
  optionId: IdOptionPayante,
  contexte: ContexteOption,
  origine: OrigineDemande,
  message?: string,
  /** Lot K (facultatif) : ce que l'option fera (effet préparé) ; une demande ouverte de la même option et de la même vidéo est alors REMPLACÉE (annulée, sans dépense). */
  o: { details?: Record<string, unknown>; remplacerOuverte?: boolean } = {},
): Promise<ResultatDemandeOption> {
  const refus = await refusOption(optionId);
  if (refus) return { statut: "coupee", message: refus };
  const [budget, t] = await Promise.all([resumeBudget(), tarifs()]);
  return enFile(async () => {
    let liste = await lireDemandes();
    const now = new Date();
    if (o.remplacerOuverte) {
      liste = liste.map((d) => (d.optionId === optionId && d.videoId === contexte.videoId && etatActuel(d, now) === "en-attente" ? { ...d, etat: "annulee" as const, traiteeLe: now.toISOString() } : d));
    } else {
      const ouverte = liste.find((d) => d.optionId === optionId && d.videoId === contexte.videoId && d.versionOrigineId === contexte.versionId && etatActuel(d, now) === "en-attente");
      if (ouverte) return { statut: "a-confirmer" as const, carte: vueCarte(ouverte), demande: ouverte };
    }
    const r = demanderConfirmation(optionId, contexte, { maintenant: now, jeton: jetonNeuf(), origine, restantDuMoisCentimes: budget.restant.centimes, tarifs: t, ...(message ? { message } : {}) });
    if (r.statut !== "a-confirmer") {
      if (o.remplacerOuverte) await ecrireDemandes(liste);
      return r;
    }
    if (o.details) r.demande.details = o.details;
    await ecrireDemandes([...liste, r.demande]);
    await journaliser("depenses", `Option payante à confirmer : ${r.demande.libelle}`, { type: "video", id: contexte.videoId });
    return { statut: "a-confirmer" as const, carte: vueCarte(r.demande), demande: r.demande };
  });
}

/** Lot K : la demande encore ouverte de cette option pour cette vidéo (« Changer de moment »). */
export async function demandeOuverte(optionId: IdOptionPayante, videoId: Id): Promise<DemandeConfirmation | null> {
  const now = new Date();
  return [...(await lireDemandes())].reverse().find((d) => d.optionId === optionId && d.videoId === videoId && etatActuel(d, now) === "en-attente") ?? null;
}

/** Cartes en attente d'une vidéo (« Votre vidéo »). */
export async function cartesEnAttente(videoId: Id): Promise<VueCarteConfirmation[]> {
  // Vérif V4 : options coupées → aucune carte ; une option retirée (Décor IA) n'est jamais montrée, même ancienne.
  if (await optionsPayantesCoupees()) return [];
  const now = new Date();
  return (await lireDemandes()).filter((d) => d.videoId === videoId && d.origine !== "monteur" && !optionRetiree(d.optionId) && etatActuel(d, now) === "en-attente").map((d) => vueCarte(d));
}

/** Estimation seule, pour la carte de Réglages (allumer une option) : rien n'est enregistré. */
export async function carteReglages(optionId: IdOptionPayante, contexte: Omit<ContexteOption, "videoId" | "versionId">): Promise<{ phrase: string } | { plafond: string }> {
  const refus = await refusOption(optionId);
  if (refus) return { plafond: refus };
  const [budget, t] = await Promise.all([resumeBudget(), tarifs()]);
  const r = demanderConfirmation(optionId, { ...contexte, videoId: "reglages", versionId: "reglages" }, { maintenant: new Date(), jeton: jetonNeuf(), origine: "reglages", restantDuMoisCentimes: budget.restant.centimes, tarifs: t });
  if (r.statut !== "a-confirmer") return { plafond: r.message };
  return { phrase: phraseCarte({ montantCentimes: r.demande.montantCentimes, outil: r.demande.outil, precision: "par vidéo d'une minute" }) };
}

/* ------------------------------------------------------------------ */
/* Répondre                                                            */
/* ------------------------------------------------------------------ */

const MESSAGES_REFUS: Record<string, string> = {
  jeton: "Cette demande n'existe plus.",
  expiree: "Cette demande a expiré : rien n'a été dépensé. Redemandez l'option si vous la voulez toujours.",
  "deja-traitee": "Cette demande a déjà reçu une réponse.",
};

async function trouver(jeton: string): Promise<DemandeConfirmation> {
  const d = (await lireDemandes()).find((x) => x.jeton === jeton);
  if (!d) throw new ErreurStudio("INTROUVABLE", MESSAGES_REFUS.jeton);
  return d;
}

/** Met à jour la carte gardée dans le fil du monteur (même jeton) et ajoute la réponse du monteur. */
async function repondreDansLeFil(d: DemandeConfirmation, texte: string, extra: { versionId?: Id; travailId?: Id } = {}): Promise<void> {
  const { filMonteur, FIL_MAX } = await import("./monteur-facecam");
  const fil = (await filMonteur(d.videoId)).map((e) => (e.confirmation?.jeton === d.jeton ? { ...e, confirmation: { ...e.confirmation, etat: d.etat } } : e));
  fil.push({ id: nouvelId("fil"), le: maintenant(), de: "monteur", texte, ...extra });
  await ecrireParametre(`facecam.fil.${d.videoId}`, fil.slice(-FIL_MAX));
}

/**
 * « Confirmer » : la demande est confirmée PUIS une nouvelle version part, qui porte le jeton (et l'option demandée)
 * dans ses entrées. Au moment de l'appel payant, la garde consommera ce jeton une seule fois.
 */
export async function confirmerOptionPayante(jeton: string): Promise<{ travailId: Id; versionId?: Id }> {
  await exigerSession();
  // Vérif V4 : option retirée (Décor IA) ou options coupées : « Confirmer » vaut « Annuler » (zéro dépense, aucune
  // version), et Will lit pourquoi.
  const demande = await trouver(jeton);
  const refus = await refusOption(demande.optionId);
  if (refus) {
    const annulee = await enFile(async () => {
      const r = annuler(await trouver(jeton), jeton, new Date());
      if (!r.ok) return null;
      await remplacer(r.demande);
      return r.demande;
    });
    if (annulee) {
      await journaliser("depenses", `Option payante non faite (${optionRetiree(annulee.optionId) ? "retirée" : "options coupées"}) : ${annulee.libelle}`, { type: "video", id: annulee.videoId });
      if (annulee.origine === "monteur") await repondreDansLeFil(annulee, refus);
    }
    throw new ErreurStudio("REFUSE", refus);
  }
  const confirmee = await enFile(async () => {
    const r = confirmer(await trouver(jeton), jeton, new Date());
    if (!r.ok) throw new ErreurStudio("REFUSE", MESSAGES_REFUS[r.raison] ?? MESSAGES_REFUS["deja-traitee"]);
    await remplacer(r.demande);
    return r.demande;
  });
  const d = depots();
  const version = await d.versions.obtenir(confirmee.versionOrigineId);
  const entrees = avecAccord((version?.commande.entrees ?? {}) as Record<string, unknown>, confirmee.optionId, confirmee.jeton);
  // Face caméra : l'étape « Le décor » ne tourne que si la commande la demande (`facecamDecorIa`, lot E).
  if (confirmee.optionId === "decor-ia") entrees.facecamDecorIa = true;
  // Lot K : l'effet réaliste préparé (moment, consigne vidéo, vitre brisée et repli 3D liés) entre dans la piste.
  let reponse = REPONSE_MONTEUR_CONFIRMEE;
  if (confirmee.optionId === "effet-realiste-ia") {
    const { entreesAvecEffet } = await import("./effet-realiste-ia");
    Object.assign(entrees, entreesAvecEffet(entrees, confirmee.details));
  }
  const { lancerRetouche } = await import("./fabrication");
  const consigne = confirmee.message ? `Monteur : ${confirmee.message}` : `${confirmee.libelle} (option payante confirmée)`;
  const r = await lancerRetouche(confirmee.videoId, [], consigne, { entrees });
  const travail = await d.travaux.obtenir(r.travailId);
  // Vérif V4 : la confirmation ne vaut que pour la version qu'elle vient de lancer.
  if (travail?.versionId) {
    const versionCibleId = travail.versionId;
    await enFile(async () => {
      const liste = await lireDemandes();
      await ecrireDemandes(liste.map((x) => (x.jeton === confirmee.jeton && x.etat === "confirmee" && !x.versionCibleId ? { ...x, versionCibleId } : x)));
    });
  }
  await journaliser("depenses", `Option payante confirmée : ${confirmee.libelle}`, { type: "video", id: confirmee.videoId });
  if (confirmee.optionId === "effet-realiste-ia") {
    // Lot K : la version actuelle reste visible pendant la fabrication ; « Prête vers 14 h 35 ».
    const { reponseEffetConfirme } = await import("./effet-realiste-ia");
    reponse = reponseEffetConfirme(travail?.finEstimee);
  }
  if (confirmee.origine === "monteur") await repondreDansLeFil(confirmee, reponse, { travailId: r.travailId, ...(travail?.versionId ? { versionId: travail.versionId } : {}) });
  return { travailId: r.travailId, ...(travail?.versionId ? { versionId: travail.versionId } : {}) };
}

/** « Annuler » : rien n'est dépensé ; la version gratuite (celle qui est déjà là) reste. */
export async function annulerOptionPayante(jeton: string): Promise<void> {
  await exigerSession();
  const annulee = await enFile(async () => {
    const r = annuler(await trouver(jeton), jeton, new Date());
    if (!r.ok) throw new ErreurStudio("REFUSE", MESSAGES_REFUS[r.raison] ?? MESSAGES_REFUS["deja-traitee"]);
    await remplacer(r.demande);
    return r.demande;
  });
  await journaliser("depenses", `Option payante annulée : ${annulee.libelle}`, { type: "video", id: annulee.videoId });
  if (annulee.origine === "monteur") await repondreDansLeFil(annulee, REPONSE_MONTEUR_ANNULEE);
}

/* ------------------------------------------------------------------ */
/* Garde au moment de l'appel fournisseur                              */
/* ------------------------------------------------------------------ */

/** Ce qu'un travail présente : sa vidéo, sa version, et le jeton que la version porte pour cette option. */
async function presentation(optionId: IdOptionPayante, travailId: Id) {
  const d = depots();
  const travail = await d.travaux.obtenir(travailId);
  if (!travail?.versionId) return null;
  const version = await d.versions.obtenir(travail.versionId);
  const jeton = lireEntreesOptions((version?.commande.entrees ?? {}) as Record<string, unknown>).accords[optionId];
  return { optionId, videoId: travail.cibleId, versionId: travail.versionId, jeton: jeton ?? "" };
}

/** Vrai si la version de ce travail demande l'option (après « Confirmer » dans le fil ou sur « Votre vidéo »). */
export async function optionDemandeePourTravail(optionId: IdOptionPayante, travailId: Id): Promise<boolean> {
  const d = depots();
  const travail = await d.travaux.obtenir(travailId);
  const version = travail?.versionId ? await d.versions.obtenir(travail.versionId) : null;
  return optionDemandeePourVersion((version?.commande.entrees ?? {}) as Record<string, unknown>, optionId);
}

/** Décision SANS consommer : la version de ce travail a-t-elle une confirmation valide pour cette option ? */
export async function accordValide(optionId: IdOptionPayante, travailId: Id): Promise<boolean> {
  if (await refusOption(optionId)) return false;
  const p = await presentation(optionId, travailId);
  if (!p?.jeton) return false;
  return verifier((await lireDemandes()).find((x) => x.jeton === p.jeton), p, new Date()).ok;
}

/**
 * La garde exigée par les fournisseurs réels. `autoriser` consomme la confirmation (une seule fois) et refuse si le
 * plafond du mois ne couvre plus l'estimation : le plafond reste prioritaire, même après « Confirmer ».
 */
export function gardePourTravail(optionId: IdOptionPayante, travailId: Id): GardeOptionPayante {
  return {
    optionId,
    async autoriser() {
      // Vérif V4 : option retirée ou options coupées → refus, même après « Confirmer ».
      if (await refusOption(optionId)) return false;
      const p = await presentation(optionId, travailId);
      if (!p?.jeton) return false;
      const budget = await resumeBudget();
      return enFile(async () => {
        const liste = await lireDemandes();
        const demande = liste.find((x) => x.jeton === p.jeton);
        if (demande && demande.montantCentimes > budget.restant.centimes) return false;
        const r = consommer(demande, p, new Date());
        if (!r.ok) {
          console.warn(`[options-payantes] ${optionId} refusée pour ${travailId} : ${r.raison}`);
          return false;
        }
        await ecrireDemandes(liste.map((x) => (x.jeton === p.jeton ? r.demande : x)));
        await journaliser("depenses", `Option payante utilisée : ${r.demande.libelle}`, { type: "video", id: p.videoId });
        return true;
      });
    },
  };
}

/**
 * Point d'entrée commun des passes payantes (décor, ultra réaliste, multicaméra), en RÉEL seulement : si la version
 * du travail porte une confirmation valide, la garde est rendue (à passer au fournisseur) ; sinon la demande est créée
 * (carte sur « Votre vidéo ») et la passe doit sortir la version gratuite.
 */
export async function preparerOptionPayante(
  optionId: IdOptionPayante,
  o: { travailId: Id; dureeSec: number; passagesSec?: number[]; modele?: ContexteOption["modele"]; angles?: number },
): Promise<{ statut: "autorisee"; garde: GardeOptionPayante } | { statut: "a-confirmer" | "plafond" | "coupee" | "non-confirmee"; message: string }> {
  if (await accordValide(optionId, o.travailId)) return { statut: "autorisee", garde: gardePourTravail(optionId, o.travailId) };
  const refus = await refusOption(optionId);
  if (refus) return { statut: "coupee", message: refus };
  const travail = await depots().travaux.obtenir(o.travailId);
  if (!travail?.versionId) return { statut: "a-confirmer", message: MESSAGE_EN_ATTENTE };
  // Vérif V4 : la version porte déjà cette option (recopiée d'une version confirmée, reprise après redémarrage, autre
  // effet de la même version) : sa confirmation a servi ou n'est pas la sienne. Aucune carte n'est recréée en douce
  // (un « Confirmer » de plus repaierait le même travail) ; la version gratuite sort. Will redemande au monteur.
  const version = await depots().versions.obtenir(travail.versionId);
  const entreesVersion = lireEntreesOptions((version?.commande.entrees ?? {}) as Record<string, unknown>);
  if (entreesVersion.demandees.includes(optionId) || entreesVersion.accords[optionId]) return { statut: "non-confirmee", message: MESSAGE_NON_CONFIRMEE };
  const r = await demanderOptionPayante(optionId, { videoId: travail.cibleId, versionId: travail.versionId, dureeSec: o.dureeSec, ...(o.passagesSec ? { passagesSec: o.passagesSec } : {}), ...(o.modele ? { modele: o.modele } : {}), ...(o.angles ? { angles: o.angles } : {}) }, "fabrication");
  return r.statut === "a-confirmer" ? { statut: "a-confirmer", message: MESSAGE_EN_ATTENTE } : { statut: r.statut, message: r.message };
}

export const MESSAGE_EN_ATTENTE = "Option payante en attente de votre accord : la vidéo sort dans sa version gratuite.";

/* ------------------------------------------------------------------ */
/* Monteur                                                             */
/* ------------------------------------------------------------------ */

/**
 * Le fil « Discuter avec mon monteur » : une opération payante détectée n'est pas exécutée. Le monteur répond avec la
 * carte (ou, plafond atteint, sans carte). Rend `null` si le message ne demande aucune option payante.
 */
export async function reponseMonteurOptionPayante(
  optionIds: IdOptionPayante[],
  o: { videoId: Id; versionId: Id; dureeSec: number; message: string },
): Promise<{ texte: string; confirmation?: VueCarteConfirmation } | null> {
  const optionId = optionIds[0];
  if (!optionId) return null;
  const r = await demanderOptionPayante(optionId, { videoId: o.videoId, versionId: o.versionId, dureeSec: o.dureeSec }, "monteur", o.message);
  if (r.statut !== "a-confirmer") return { texte: r.statut === "plafond" ? REPONSE_MONTEUR_PLAFOND : optionRetiree(optionId) ? MESSAGE_OPTION_RETIREE : REPONSE_MONTEUR_COUPEES };
  return { texte: REPONSE_MONTEUR_A_CONFIRMER, confirmation: r.carte };
}
