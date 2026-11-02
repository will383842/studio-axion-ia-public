/**
 * PARCOURS « MOT → E-MAIL → GUIDE » côté Studio (PV-2). INERTE par défaut : tant que `PARCOURS_MOT_ENABLED` n'est pas
 * allumé, le crochet répond de façon neutre, n'écrit rien, et le travail de fond n'appelle ni Zernio ni le site.
 *
 *  1. Le crochet (`/api/crochets/zernio`) vérifie la signature, la fenêtre anti-rejeu et le doublon, puis DÉPOSE dans
 *     l'outbox (collection `evenementsFournisseurs`, fournisseur « zernio », ajout seul) l'identifiant du run : rien d'autre.
 *  2. Le travail de fond RELIT le run chez Zernio (la charge du crochet n'est jamais crue) et l'envoie au site, signé (v1).
 *  3. Le Studio ne conserve JAMAIS l'adresse e-mail : elle transite en mémoire le temps d'un appel. Le corps de l'appel est
 *     donc reconstruit à l'identique (ordre des clés fixe, même run relu) à chaque essai ; la clé d'idempotence (tirée de
 *     l'identifiant du run) est fixe. Si les octets divergeaient, le site répondrait 409 `cle_reutilisee` : définitif.
 *  Rien n'est supprimé : un événement traité reste en place avec son état.
 */
import "server-only";
import type { EvenementFournisseur } from "@/domaine/types";
import { cleIdempotence } from "@/domaine/guide-reseau/cle-idempotence";
import {
  conduiteApresReponse,
  corpsDemandeGuide,
  ESSAIS_MAX,
  lireEvenementRun,
  runValide,
  TAILLE_MAX_CROCHET,
  verifierSignatureZernio,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import { creerTransportHttp } from "@/fournisseurs/site/http";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { TransportSite } from "@/fournisseurs/site/types";
import { nouvelId } from "@/lib/ids";
import { depots, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";

export const VARIABLE_INTERRUPTEUR_PARCOURS = "PARCOURS_MOT_ENABLED";
export const VARIABLE_SECRET_CROCHET_ZERNIO = "ZERNIO_WEBHOOK_SECRET";
export const CHEMIN_DEMANDES_GUIDE = "/api/interne/demandes-guide-reseau";
const FOURNISSEUR = "zernio";
const ESSAIS_NONCE = 3;

/** Interrupteur du parcours : éteint par défaut (absent ou autre chose que 1/true/oui). */
export function parcoursMotActif(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR_PARCOURS]?.trim() ?? "");
}

/** Relit un run chez Zernio. Aucune implémentation réelle n'est branchée tant que le point d'accès n'est pas confirmé. */
export type LecteurRuns = (idRun: string) => Promise<RunLu | null>;
let lecteurInjecte: LecteurRuns | null = null;
let transportInjecte: TransportSite | null = null;
export function injecterLecteurRuns(l: LecteurRuns | null): void {
  lecteurInjecte = l;
}
export function injecterTransportSite(t: TransportSite | null): void {
  transportInjecte = t;
}

/** Réponse NEUTRE : identique pour « éteint », « pas de secret » et « déjà reçu » (rien n'est révélé). */
const NEUTRE = { statut: 200, corps: { recu: true } } as const;

export interface EntreeCrochetZernio {
  corps: string;
  signature: string | null;
  horodatage: string | null;
}

export async function recevoirCrochetZernio(entree: EntreeCrochetZernio, o: { env?: Record<string, string | undefined>; maintenantMs?: number } = {}): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const env = o.env ?? process.env;
  const secret = env[VARIABLE_SECRET_CROCHET_ZERNIO]?.trim();
  if (!parcoursMotActif(env) || !secret) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  if (Buffer.byteLength(entree.corps, "utf8") > TAILLE_MAX_CROCHET) return { statut: 413, corps: { erreur: "trop_volumineux" } };
  const verdict = verifierSignatureZernio({ secret, corps: entree.corps, horodatage: entree.horodatage, signature: entree.signature, maintenantMs: o.maintenantMs ?? Date.now() });
  if (verdict !== "ok") return { statut: 401, corps: { erreur: "signature_refusee" } };
  const evt = lireEvenementRun(entree.corps);
  if (!evt) return { statut: 422, corps: { erreur: "charge_inconnue" } };
  return sousVerrou(async () => {
    const d = depots();
    if (await d.evenementsFournisseurs.trouver((e) => e.fournisseur === FOURNISSEUR && e.idEvenement === evt.idEvenement)) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
    const entite: EvenementFournisseur = {
      id: nouvelId("evf"),
      fournisseur: FOURNISSEUR,
      idEvenement: evt.idEvenement,
      type: evt.type,
      recuLe: maintenant(),
      traite: false,
      // Seul l'identifiant (opaque) du run est gardé : ni adresse e-mail, ni contenu du crochet.
      charge: { idRun: evt.idRun, etat: "a_faire", essais: 0, prochainEssaiLe: null, dernierCode: null, accord: null },
      ...horodatage(),
    };
    await d.evenementsFournisseurs.enregistrer(entite);
    return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  });
}

function transportDuSite(env: Record<string, string | undefined>): { transport: TransportSite; secret: string } | null {
  const secret = env.SITE_VIDEOS_SECRET?.trim();
  if (transportInjecte) return { transport: transportInjecte, secret: secret || "secret-absent" };
  const url = env.SITE_VIDEOS_URL?.trim();
  if (!url || !secret || !/^https?:\/\//i.test(url)) return null;
  return { transport: creerTransportHttp({ url, fetch: (...a) => fetch(...a) }), secret };
}

let enCours = false;

export interface RapportOutbox {
  actif: boolean;
  traites: number;
  envoyes: number;
  definitifs: number;
  aReessayer: number;
}

/** Un passage sur l'outbox. Éteint, ou site/lecteur non reliés : aucun appel sortant. */
export async function traiterOutboxZernio(o: { env?: Record<string, string | undefined>; maintenantMs?: number } = {}): Promise<RapportOutbox> {
  const env = o.env ?? process.env;
  const rapport: RapportOutbox = { actif: parcoursMotActif(env), traites: 0, envoyes: 0, definitifs: 0, aReessayer: 0 };
  if (!rapport.actif || enCours) return rapport;
  const site = transportDuSite(env);
  const lire = lecteurInjecte;
  if (!site || !lire) return rapport;
  enCours = true;
  try {
    const now = o.maintenantMs ?? Date.now();
    const dus = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && !e.traite && (typeof e.charge.prochainEssaiLe !== "number" || e.charge.prochainEssaiLe <= now));
    for (const ev of dus) {
      rapport.traites++;
      const conduite = await tenter(ev, lire, site, now);
      if (conduite === "envoye") rapport.envoyes++;
      else if (conduite === "definitif") rapport.definitifs++;
      else rapport.aReessayer++;
    }
  } finally {
    enCours = false;
  }
  return rapport;
}

async function tenter(ev: EvenementFournisseur, lire: LecteurRuns, site: { transport: TransportSite; secret: string }, now: number): Promise<"envoye" | "definitif" | "reessai"> {
  const idRun = String(ev.charge.idRun);
  const essais = Number(ev.charge.essais ?? 0) + 1;
  let statut = 0;
  let corpsReponse: unknown = null;
  let code: string | null = null;
  try {
    const run = await lire(idRun);
    if (!run) code = "run_introuvable";
    else if (!runValide(run)) code = "run_invalide";
    else {
      // Octets FIGÉS pour tous les essais de ce passage ; clé fixe.
      const corps = corpsDemandeGuide(run, cleIdempotence(idRun));
      for (let n = 0; n < ESSAIS_NONCE; n++) {
        const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
        try {
          const r = await site.transport({ methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, entetes });
          statut = r.statut;
          corpsReponse = r.corps;
        } catch {
          statut = 0;
          corpsReponse = null;
        }
        const c = conduiteApresReponse(statut, corpsReponse, essais);
        if (!(c.genre === "reessayer" && c.nouveauNonce)) break;
      }
    }
  } catch {
    statut = 0; // lecture du run en échec : traitée comme une panne passagère
  }
  const c = code ? ({ genre: "definitif", code } as const) : conduiteApresReponse(statut, corpsReponse, essais);
  const charge: Record<string, unknown> = { ...ev.charge, essais };
  let issue: "envoye" | "definitif" | "reessai";
  let traite = true;
  if (c.genre === "termine") {
    Object.assign(charge, { etat: "envoye", dernierCode: "200", accord: c.accord, prochainEssaiLe: null });
    issue = "envoye";
  } else if (c.genre === "definitif") {
    Object.assign(charge, { etat: "definitif", dernierCode: c.code, prochainEssaiLe: null });
    issue = "definitif";
  } else if (essais >= ESSAIS_MAX) {
    Object.assign(charge, { etat: "abandonne", dernierCode: c.code, prochainEssaiLe: null });
    issue = "definitif";
  } else {
    traite = false;
    Object.assign(charge, { etat: "a_reessayer", dernierCode: c.code, prochainEssaiLe: now + c.apresMs });
    issue = "reessai";
  }
  await depots().evenementsFournisseurs.modifier(ev.id, { charge, traite });
  // Journal : identifiant d'événement, état et code seulement (jamais l'adresse, le corps, la clé ni le secret).
  await journaliser("parcours_mot", `Événement Zernio ${ev.idEvenement} : ${String(charge.etat)} (${String(charge.dernierCode)}), essai ${essais}.`);
  return issue;
}
