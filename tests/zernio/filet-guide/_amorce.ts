/**
 * Amorce commune du FILET de non-régression du mot GUIDE (tests de caractérisation : ils figent le comportement ACTUEL).
 * Réutilise les faux ports de ../aides/. Données 100 % fictives : adresse@exemple.test, identifiants « fictif-… », aucun réseau.
 * Ce fichier n'est pas un test (pas de suffixe .test) ; chaque test l'appelle depuis son propre `beforeEach`.
 */
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { COMPTE, ENV, T0, TITRE, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "../aides/conversation";

export { COMPTE, ENV, T0, TITRE };
export const ADRESSE = "adresse@exemple.test";
export const AUTEUR = "auteur-fictif-400";
export const SECRET_CROCHET = "secret-fictif-crochet-filet-guide";
export const ENV_CROCHET = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET };
export const T_CROCHET = Date.parse("2026-10-18T10:00:10.000Z");

export const C = await import("@/services/parcours-conversation");
export const pm = await import("@/services/parcours-mot");
export const Com = await import("@/services/_commun");
export const MS = await import("@/services/mots-service");
export const Opp = await import("@/services/oppositions-mots");
export const Z = await import("@/services/zernio");
export const { reinitialiserDepots, depots } = await import("@/donnees/memoire");

export interface Banc {
  port: ReturnType<typeof fauxPort>;
  site: ReturnType<typeof fauxSite>;
}
export const banc = {} as Banc;

/** À appeler dans `beforeEach` : base vide, faux port, faux site, mot GUIDE actif sur COMPTE, textes validés. */
export async function preparer(): Promise<void> {
  reinitialiserDepots();
  remettreCompteurEvenements();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  banc.port = fauxPort();
  banc.site = fauxSite();
  pm.injecterTransportSite(banc.site.transport);
  await registre("actif");
}
export function nettoyer(): void {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
}
export const registre = async (etat: string, compte: string = COMPTE): Promise<void> => {
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${compte}`]: { mot: "GUIDE", compte, etat, idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
};

export const passer = (ms: number = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) =>
  C.traiterConversations({ port: banc.port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
export const envoisSortants = (): number => banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length;
export const toutesLesConversations = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
export const alertes = async (): Promise<number> => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length;

/** Dépose un `comment.received` par le VRAI crochet (détection du mot, casse, espaces) ; rend le statut HTTP et ce qui a été déposé. */
let nEvt = 0;
export const remettreCompteurEvenements = (): void => { nEvt = 0; };
export async function crochetCommentaire(texte: string, o: { reseau?: "instagram" | "facebook"; idAuteur?: string } = {}): Promise<{ statut: number; deposes: Array<Record<string, any>> }> {
  const corps0 = JSON.parse(readFileSync(new URL("../fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));
  const n = ++nEvt;
  corps0.id = `evt_fictif_filet_${n}`;
  corps0.account.platform = o.reseau ?? "facebook";
  corps0.comment.id = `com-fictif-filet-${n}`;
  corps0.comment.text = texte;
  if (o.idAuteur) corps0.comment.author.id = o.idAuteur;
  const avant = (await depots().evenementsFournisseurs.lister(() => true)).length;
  const corps = Buffer.from(JSON.stringify(corps0));
  const r = await pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET_CROCHET, corps) }, { env: ENV_CROCHET, maintenantMs: T_CROCHET });
  const tous = await depots().evenementsFournisseurs.lister(() => true);
  return { statut: r.statut, deposes: tous.slice(avant).map((e: any) => e.charge) };
}

/** Une conversation déjà ouverte (M1 envoyé) pour AUTEUR, pour les tests qui partent de « attente_email ». */
export const graineConv = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "facebook", idCompte: COMPTE, idCommentaire: "com-fictif-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 3600_000).toISOString(), m1Le: new Date(T0 - 1800_000).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});

/** Tout ce que la base en mémoire contient (tous les dépôts), en texte : sert à prouver qu'une valeur n'y est JAMAIS écrite. */
export async function toutLeStockage(): Promise<string> {
  const morceaux: string[] = [];
  for (const [nom, d] of Object.entries(depots() as unknown as Record<string, any>)) {
    if (d && typeof d.lister === "function") morceaux.push(`${nom}=${JSON.stringify(await d.lister(() => true))}`);
  }
  return morceaux.join("\n");
}
export const lireTexteDe = (texte: string): void => {
  banc.port.reponses.texte = () => texte;
};
