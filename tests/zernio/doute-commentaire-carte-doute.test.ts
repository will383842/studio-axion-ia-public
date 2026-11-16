/**
 * PR C · un commentaire LinkedIn/TikTok en doute d'opposition (« stop pls ») : déposé par le crochet, puis traité par a-traiter-manuel.
 * Jamais d'opposition inscrite ni d'envoi ; une carte « À traiter » sans texte du commentaire. Données 100 % fictives, aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { VARIABLE_SECRET_EMPREINTE } from "@/domaine/guide-reseau/empreinte-personne";

const opp = vi.hoisted(() => ({ appels: [] as unknown[][] }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/oppositions-mots", async (orig) => {
  const m = await orig<typeof import("@/services/oppositions-mots")>();
  return { ...m, enregistrerOpposition: vi.fn(async (...a: unknown[]) => { opp.appels.push(a); return (m.enregistrerOpposition as any)(...a); }) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");
const { extraitLisible } = await import("@/services/a-traiter-types");
const { traiterCommentairesManuels, PARAM_RESEAUX_MANUELS, EXTRAIT_DOUTE } = await import("@/services/a-traiter-manuel");

const SECRET = "secret-fictif-crochet-doute-c";
const SECRET_EMP = "secret-fictif-doute-c-0123456789-abcdefghij";
const T = Date.parse("2026-10-18T10:00:10.000Z");
const ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET, A_TRAITER_ENABLED: "1" };
const AUTEUR = "auteur-fictif-400";
let n = 0;
const manuel = (plateforme: string, texte: string, c: Record<string, unknown> = {}) => ({
  id: `evt_c_${plateforme}_${++n}`, event: "comment.received", timestamp: "2026-10-18T10:00:00.000Z",
  account: { accountId: "compte-fictif-100", platform: plateforme },
  comment: { id: `com-c-${n}`, platformPostId: "post-plateforme-fictif-200", text: texte, author: { id: AUTEUR }, ...c },
});
const envoyer = (o: unknown) => {
  const corps = Buffer.from(JSON.stringify(o));
  return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T });
};
const lancer = () => traiterCommentairesManuels({ env: ENV, maintenantMs: T, depot: creerDepotParametre() });
const cartes = () => creerDepotParametre().lire();
const evenements = () => depots().evenementsFournisseurs.lister(() => true);
const opposee = async () => (await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { douteBloque: true })).opposee;

beforeEach(async () => {
  reinitialiserDepots();
  opp.appels.length = 0;
  vi.stubEnv(VARIABLE_SECRET_EMPREINTE, SECRET_EMP);
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe.each(["linkedin", "tiktok"])("%s · doute « stop pls »", (p) => {
  it("C1 · enregistrerOpposition jamais appelé, registre inchangé, événement clos", async () => {
    await envoyer(manuel(p, "stop pls"));
    expect(await evenements()).toHaveLength(1);
    expect(await lancer()).toMatchObject({ actif: true, traites: 1, reportes: 0 });
    expect(opp.appels).toEqual([]);
    expect(await opposee()).toBe(false);
    const [ev] = await evenements();
    expect(ev.traite).toBe(true);
    expect(ev.charge.etat).not.toBe("opposition");
  });
  it("C2 · une carte, sans texte du commentaire, mot null, opposée, extrait fixe", async () => {
    await envoyer(manuel(p, "stop pls"));
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    const c = l[0];
    expect(c).toMatchObject({ mot: null, opposee: true, kit: null, motif: "mot_manuel", message: "indisponible", statut: "a_traiter", reseau: p === "tiktok" ? "tiktok" : "linkedin" });
    expect(extraitLisible(c.extrait)).toBe(EXTRAIT_DOUTE);
    expect(EXTRAIT_DOUTE).toBe("Demande d'arrêt possible : à vérifier, rien n'est proposé");
    const brut = JSON.stringify({ l, e: await evenements() }).toLowerCase();
    expect(brut).not.toContain("pls");
    expect(JSON.stringify(l)).not.toContain(AUTEUR); // la carte ne garde que des empreintes opaques
  });
  it("C5 · rejeu du même événement : une seule carte", async () => {
    const x = manuel(p, "stop pls");
    await envoyer(x);
    await envoyer(x);
    await lancer();
    await lancer();
    expect(await cartes()).toHaveLength(1);
  });
  it("C5 · événement relancé à la main (rouvert) : toujours une seule carte", async () => {
    await envoyer(manuel(p, "stop pls"));
    await lancer();
    const [ev] = await evenements();
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire" } });
    await lancer();
    expect(await cartes()).toHaveLength(1);
  });
  it("C6 · doute du compte propriétaire : rien (ni dépôt, ni carte ; chargé à la main : clos propre compte)", async () => {
    await envoyer(manuel(p, "stop pls", { author: { id: "compte-fictif-100" } }));
    expect(await evenements()).toHaveLength(0);
    await depots().evenementsFournisseurs.enregistrer({
      id: "evf_prop", fournisseur: "zernio", idEvenement: "prop", type: "zernio.commentaire_manuel", recuLe: "2026-01-01T00:00:00.000Z", traite: false,
      charge: { etat: "a_faire", idCommentaire: "c", idCompte: "compte-fictif-100", reseau: p, repere: "post_1", lienPost: null, idAuteur: "compte-fictif-100", proprio: true, motSeul: null, doute: true },
      creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
    } as any);
    await lancer();
    expect(await cartes()).toEqual([]);
    expect(opp.appels).toEqual([]);
    expect((await evenements())[0].charge.etat).toBe("propre_compte");
  });
  it("personne déjà opposée : silence, aucune carte", async () => {
    await Opp.enregistrerOpposition(AUTEUR, Opp.ESPACE_CONTACT_ZERNIO);
    opp.appels.length = 0;
    await envoyer(manuel(p, "stop pls"));
    await lancer();
    expect(await cartes()).toEqual([]);
    expect(opp.appels).toEqual([]);
  });
  it("C3 · « STOP » clair : inscrit au registre, aucune carte", async () => {
    await envoyer(manuel(p, "STOP"));
    await lancer();
    expect(opp.appels).toHaveLength(1);
    expect(await opposee()).toBe(true);
    expect(await cartes()).toEqual([]);
  });
  it("C4 · un GUIDE manuel : carte comme avant (mot, extrait = le mot, non opposée)", async () => {
    await envoyer(manuel(p, "GUIDE"));
    await lancer();
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ mot: "GUIDE", extrait: "GUIDE", motif: "mot_inconnu" });
    expect(l[0].opposee).toBeUndefined();
    expect(opp.appels).toEqual([]);
  });
});

describe("C7 · aucun schéma persisté nouveau", () => {
  it("MOTIFS inchangé", async () => {
    const t = await import("@/services/a-traiter-types");
    expect([...t.MOTIFS]).toEqual(["echec_envoi", "mot_dans_phrase", "mot_inconnu", "mot_manuel"]);
  });
  it("le fichier des types garde les mêmes réseaux et raisons (aucune énumération ajoutée)", () => {
    const src = readFileSync(new URL("../../src/services/a-traiter-types.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/doute/i);
  });
});
