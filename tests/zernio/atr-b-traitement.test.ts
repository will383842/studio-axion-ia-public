/** ATR-B : traitement des commentaires LinkedIn/TikTok (file manuelle). Identifiants et textes FICTIFS, aucun envoi réel. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VARIABLE_SECRET_EMPREINTE } from "@/domaine/guide-reseau/empreinte-personne";
import type { EvenementFournisseur } from "@/domaine/types";
import { creerFauxClientZernio } from "./aides/faux-zernio";

const TEXTES = { mot: "DEMO", reponsePublique: "Merci pour votre message, le guide arrive.", messagePrive: "Bonjour, voici le guide.", relance: null, fin: "Bonne lecture.", etat: "valide", empreinteValidee: null };
vi.mock("@/services/mots-service", async (orig) => ({ ...(await orig<typeof import("@/services/mots-service")>()), chargerTextesFichier: vi.fn(async () => ({ ok: true, textes: TEXTES })) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const { PARAM_REGISTRE_MOTS, PARAM_VALIDATIONS_MOTS } = await import("@/services/mots-service");
const { PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { empreinteTextes } = await import("@/services/mots-textes");
const { creerDepotParametre, PARAM_CARTES_A_TRAITER } = await import("@/services/a-traiter-depot");
const { traiterCommentairesManuels, PARAM_RESEAUX_MANUELS } = await import("@/services/a-traiter-manuel");

const T0 = 1_760_781_600_000;
const ENV = { A_TRAITER_ENABLED: "1" };
const SECRET = "secret-fictif-atr-b-0123456789-abcdefghij";
let n = 0;
const evenement = async (charge: Record<string, unknown> = {}, id = `evt_${++n}`) => {
  const ev: EvenementFournisseur = {
    id: `evf_${id}`, fournisseur: "zernio", idEvenement: id, type: "zernio.commentaire_manuel", recuLe: "2026-01-01T00:00:00.000Z", traite: false,
    charge: { etat: "a_faire", idCommentaire: `com_${id}`, idCompte: "tt_1", reseau: "tiktok", repere: "post_1", lienPost: null, idAuteur: "auteur_1", proprio: false, motSeul: "DEMO", ...charge },
    creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
  } as EvenementFournisseur;
  await depots().evenementsFournisseurs.enregistrer(ev);
  return ev;
};
const poserMot = async () => {
  await Com.ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: "2026-01-01T00:00:00.000Z", comptes: [{ id: "tt_1", reseau: "tiktok", nom: "Compte" }, { id: "li_1", reseau: "linkedin", nom: "Compte" }] });
  await Com.ecrireParametre(PARAM_REGISTRE_MOTS, Object.fromEntries(["tt_1", "li_1"].map((c) => [`DEMO|${c}`, { mot: "DEMO", compte: c, etat: "actif", idWorkflow: null, raison: null, modifieLe: "2026-01-01T00:00:00.000Z" }])));
  await Com.ecrireParametre(PARAM_VALIDATIONS_MOTS, { DEMO: empreinteTextes(TEXTES) });
};
const cartes = () => creerDepotParametre().lire();
const lancer = (plus: Record<string, unknown> = {}) => traiterCommentairesManuels({ env: ENV, maintenantMs: T0, depot: creerDepotParametre(), ...plus });
const etatEv = async (id: string) => (await depots().evenementsFournisseurs.lister((e) => e.idEvenement === id))[0];

beforeEach(async () => {
  reinitialiserDepots();
  vi.stubEnv(VARIABLE_SECRET_EMPREINTE, SECRET);
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  await poserMot();
  await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("réglage : neuf = éteint", () => {
  it("nom du réglage", () => expect(PARAM_RESEAUX_MANUELS).toBe("a_traiter.reseaux_manuels"));
  it("réglage absent : rien, événement intact", async () => {
    await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, undefined);
    reinitialiserDepots(); await poserMot();
    await evenement({}, "e1");
    expect(await lancer()).toEqual({ actif: false, traites: 0, reportes: 0 });
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(false);
  });
  for (const v of ["true", 1, "1", {}, null]) it(`réglage ${JSON.stringify(v)} : éteint`, async () => {
    await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, v);
    await evenement({}, "e1");
    expect((await lancer()).actif).toBe(false);
    expect(await cartes()).toEqual([]);
  });
  it("réglage illisible (panne) : éteint", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base"));
    expect((await lancer()).actif).toBe(false);
  });
  it("interrupteur A_TRAITER_ENABLED éteint : rien", async () => {
    await evenement({}, "e1");
    expect((await lancer({ env: {} })).actif).toBe(false);
    expect(await cartes()).toEqual([]);
  });
  it("réglage vrai + interrupteur : actif", async () => expect((await lancer()).actif).toBe(true));
});

describe("traitement", () => {
  it("mot connu : une carte sans texte libre, réponse validée proposée, champs ATR-A", async () => {
    await evenement({}, "e1");
    expect(await lancer()).toEqual({ actif: true, traites: 1, reportes: 0 });
    const l = await cartes();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: "e1", reseau: "tiktok", post: "post_1", mot: "DEMO", motif: "mot_manuel", extrait: "DEMO", idCompte: "tt_1", cible: "post_1", message: "indisponible", raisonSansMessage: "tiktok_sans_message_prive", kit: TEXTES.reponsePublique });
    expect(l[0].empreintes?.length).toBeGreaterThan(0);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("LinkedIn : réseau « linkedin » et message à fabriquer", async () => {
    await evenement({ reseau: "linkedin_page", idCompte: "li_1" }, "e1");
    await lancer();
    expect((await cartes())[0]).toMatchObject({ reseau: "linkedin", message: "a_fabriquer" });
    expect((await cartes())[0].raisonSansMessage).toBeUndefined();
  });
  it("mot inconnu : carte sans réponse proposée", async () => {
    await evenement({ motSeul: "AUTRE" }, "e1");
    await lancer();
    expect((await cartes())[0]).toMatchObject({ motif: "mot_inconnu", kit: null, raisonSansMessage: "tiktok_sans_message_prive" });
  });
  it("textes modifiés depuis la validation : aucune réponse proposée", async () => {
    await Com.ecrireParametre(PARAM_VALIDATIONS_MOTS, { DEMO: "empreinte-perimee" });
    await evenement({}, "e1");
    await lancer();
    expect((await cartes())[0].kit).toBeNull();
  });
  it("aucun mot : événement clos, pas de carte", async () => {
    await evenement({ motSeul: null }, "e1");
    expect((await lancer()).traites).toBe(1);
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("notre propre commentaire : clos, pas de carte", async () => {
    await evenement({ proprio: true }, "e1");
    await lancer();
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("deux fois le même événement : une seule carte", async () => {
    await evenement({}, "e1");
    await lancer();
    await depots().evenementsFournisseurs.modifier((await etatEv("e1")).id, { traite: false });
    await lancer();
    await evenement({}, "e1");
    await lancer();
    expect(await cartes()).toHaveLength(1);
  });
  it("redémarrage simulé : les cartes restent", async () => {
    await evenement({}, "e1");
    await lancer();
    expect(await creerDepotParametre().lire()).toHaveLength(1);
    expect(await Com.lireParametre<unknown[]>(PARAM_CARTES_A_TRAITER, [])).toHaveLength(1);
  });
  it("lot de 20 : le reste attend le passage suivant", async () => {
    for (let i = 0; i < 25; i++) await evenement({}, `m${i}`);
    expect((await lancer()).traites).toBe(20);
    expect((await lancer()).traites).toBe(5);
    expect(await cartes()).toHaveLength(25);
  });
  it("autres états ou types : intacts", async () => {
    await evenement({ etat: "clos" }, "e1");
    const autre = await evenement({}, "e2");
    await depots().evenementsFournisseurs.modifier(autre.id, { type: "zernio.commentaire" });
    expect((await lancer()).traites).toBe(0);
  });
  it("aucune carte ne contient de texte libre, d'adresse ni d'identifiant de personne", async () => {
    await evenement({ commentaire: "Mon adresse lecteur@example.com", text: "texte libre", motSeul: "DEMO" }, "e1");
    await evenement({ motSeul: "INCONNU" }, "e2");
    await lancer();
    const s = JSON.stringify(await cartes());
    for (const x of ["lecteur@", "texte libre", "auteur_1"]) expect(s).not.toContain(x);
    for (const c of await cartes()) expect(c.extrait).toBe(c.mot);
  });
  it("événement refusé par la carte (réseau inconnu) : clos, sans carte, sans reprise sans fin", async () => {
    await evenement({ reseau: "youtube_x" }, "e1");
    await lancer();
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(true);
  });
});

describe("un stop gagne partout", () => {
  it("opposition : aucune carte, opposition inscrite, événement clos", async () => {
    await evenement({ motSeul: "STOP" }, "e1");
    const r = await lancer();
    expect(r).toEqual({ actif: true, traites: 1, reportes: 0 });
    expect(await cartes()).toEqual([]);
    expect(await Opp.personneOpposee("auteur_1")).toBe(true);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("personne déjà opposée : aucune carte, événement clos", async () => {
    await Opp.enregistrerOpposition("auteur_1");
    await evenement({}, "e1");
    await lancer();
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("opposée sur un AUTRE espace : aucune carte", async () => {
    await Opp.enregistrerOpposition("auteur_1", "instagram");
    await evenement({}, "e1");
    await lancer();
    expect(await cartes()).toEqual([]);
  });
  it("registre illisible : aucune carte, événement à refaire dans 5 min, rien d'écrit", async () => {
    await evenement({}, "e1");
    const enr = vi.spyOn(depots().parametres, "enregistrer");
    const vrai = depots().parametres.obtenir.bind(depots().parametres);
    vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id) => { if (id === Opp.PARAM_OPPOSITIONS_MOTS) throw new Error("base"); return vrai(id); });
    const r = await lancer();
    expect(r).toEqual({ actif: true, traites: 0, reportes: 1 });
    expect(enr).not.toHaveBeenCalled();
    const ev = await etatEv("e1");
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_faire", prochainEssaiLe: T0 + 5 * 60_000 });
    vi.restoreAllMocks();
    expect((await lancer({ maintenantMs: T0 + 60_000 })).traites).toBe(0); // pas avant l'échéance
    expect(await cartes()).toEqual([]);
    expect((await lancer({ maintenantMs: T0 + 5 * 60_000 })).traites).toBe(1); // puis repris
    expect(await cartes()).toHaveLength(1);
  });
  it("secret d'empreinte absent : doute, aucune carte, report", async () => {
    vi.stubEnv(VARIABLE_SECRET_EMPREINTE, "");
    await evenement({}, "e1");
    expect(await lancer()).toMatchObject({ traites: 0, reportes: 1 });
    expect(await cartes()).toEqual([]);
  });
  it("sans identifiant d'auteur : aucune carte, événement clos (vérification impossible)", async () => {
    await evenement({ idAuteur: null }, "e1");
    await lancer();
    expect(await cartes()).toEqual([]);
    expect((await etatEv("e1")).traite).toBe(true);
  });
  it("opposition dont l'inscription échoue : report, pas clos", async () => {
    await evenement({ motSeul: "STOP" }, "e1");
    vi.spyOn(Opp, "enregistrerOpposition").mockRejectedValue(new Error("base"));
    expect((await lancer()).reportes).toBe(1);
    expect((await etatEv("e1")).traite).toBe(false);
  });
});

describe("aucun envoi", () => {
  it("0 appel au faux port, 0 appel réseau", async () => {
    const { faux } = creerFauxClientZernio([]);
    const f = vi.spyOn(globalThis, "fetch");
    await evenement({}, "e1");
    await evenement({ motSeul: "STOP", idAuteur: "auteur_2" }, "e2");
    await lancer();
    expect(faux.appels).toHaveLength(0);
    expect(f).not.toHaveBeenCalled();
  });
  it("la source n'importe ni le port ni le branchement, et ne touche pas l'inbox", () => {
    const s = readFileSync("src/services/a-traiter-manuel.ts", "utf8") + readFileSync("src/services/a-traiter-depot.ts", "utf8");
    for (const x of ["zernio-inbox", "branchements-zernio", ".requete", "/v1/inbox", "emettreJetonNonOpposee"]) expect(s).not.toContain(x);
  });
});
