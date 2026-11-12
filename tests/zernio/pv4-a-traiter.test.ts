/** PV4 : écran « À traiter à la main ». Inerte, idempotent, échappé, sans donnée de personne. Aucun réseau ; mots interdits en JETONS. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: session }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const A = await import("@/services/a-traiter");
const G = await import("@/services/a-traiter-gestes");
const { EcranATraiter } = await import("@/components/a-traiter/EcranATraiter");

const J = (...p: string[]) => p.join("");
const TOKENS = { lieu: J("Gren", "oble"), label: J("Quali", "opi"), participe: J("cert", "ifié"), gain: J("Aucun gain ", "garanti") };
const ALLUME = { A_TRAITER_ENABLED: "1" };
const REPONSE = "Bonjour ! le guide est sur la page indiquée.";
const entree = (o: Partial<import("@/services/a-traiter").EntreeATraiter> = {}) => ({ idEvenement: "ev-1", reseau: "linkedin", post: "post-1", mot: "GUIDE", motif: "mot_manuel", commentaire: "GUIDE", reponse: REPONSE, ...o });
let depot = A.creerDepotMemoire();

beforeEach(() => {
  reinitialiserDepots();
  depot = A.creerDepotMemoire();
  session.mockClear();
});

describe("pv4 · interrupteur", () => {
  it("éteint par défaut : seules les valeurs exactes 1 et true allument", () => {
    expect(A.aTraiterActif({})).toBe(false);
    for (const v of ["0", "", "yes", "TRUE", "True", " 1", "on"]) expect(A.aTraiterActif({ A_TRAITER_ENABLED: v })).toBe(false);
    expect(A.aTraiterActif({ A_TRAITER_ENABLED: "1" })).toBe(true);
    expect(A.aTraiterActif({ A_TRAITER_ENABLED: "true" })).toBe(true);
  });
  it("éteint : rien n'est écrit, vue « désactivé », pas de compteur", async () => {
    expect(await A.enregistrerATraiter(entree(), { env: {}, depot })).toEqual({ issue: "simule", raison: "interrupteur_eteint" });
    expect(await depot.lire()).toEqual([]);
    expect(await A.lireVueATraiter({ env: {}, depot })).toEqual({ etat: "desactive", cartes: [], compteur: null });
    expect(await A.compteurMenu({ env: {}, depot })).toBeNull();
    expect((await A.marquerCarteFaite("ev-1", { env: {}, depot })).issue).toBe("simule");
    expect((await A.arreterDepuisCarte("ev-1", "c", { env: {}, depot })).issue).toBe("simule");
  });
  it("la page désactivée l'écrit", () => {
    const h = renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "desactive", cartes: [], compteur: null }, services: {} as never, compte: "c" }));
    expect(h).toContain("Désactivé");
  });
});

describe("pv4 · enregistrement et idempotence", () => {
  it("le même événement rejoué ne crée pas deux cartes", async () => {
    const o = { env: ALLUME, depot };
    expect((await A.enregistrerATraiter(entree(), o)).raison).toBe("ajoute");
    expect((await A.enregistrerATraiter(entree(), o)).raison).toBe("deja_present");
    expect(await depot.lire()).toHaveLength(1);
    await A.enregistrerATraiter(entree({ idEvenement: "ev-2" }), o);
    expect(await depot.lire()).toHaveLength(2);
  });
  it("événements simultanés : une seule carte", async () => {
    await Promise.all([1, 2, 3].map(() => A.enregistrerATraiter(entree(), { env: ALLUME, depot })));
    expect(await depot.lire()).toHaveLength(1);
  });
  it("refuse réseau, motif, identifiant, mot et lien invalides", async () => {
    const o = { env: ALLUME, depot };
    expect((await A.enregistrerATraiter(entree({ reseau: "autre" }), o)).raison).toBe("reseau_inconnu");
    expect((await A.enregistrerATraiter(entree({ motif: "x" }), o)).raison).toBe("motif_inconnu");
    expect((await A.enregistrerATraiter(entree({ idEvenement: "a b" }), o)).raison).toBe("id_invalide");
    expect((await A.enregistrerATraiter(entree({ mot: "pas un mot" }), o)).raison).toBe("mot_invalide");
    expect((await A.enregistrerATraiter(entree({ lienPost: "http://exemple.test/p" }), o)).raison).toBe("lien_invalide");
    expect(await depot.lire()).toEqual([]);
  });
});

describe("pv4 · statuts et priorité", () => {
  it("fait et ignorer sortent la carte de la file ; carte inconnue refusée", async () => {
    const o = { env: ALLUME, depot };
    for (const id of ["a", "b", "c"]) await A.enregistrerATraiter(entree({ idEvenement: id }), o);
    expect((await A.marquerCarteFaite("a", o)).issue).toBe("execute");
    expect((await A.ignorerCarte("b", o)).issue).toBe("execute");
    expect((await A.marquerCarteFaite("zzz", o)).raison).toBe("carte_inconnue");
    const statuts = Object.fromEntries((await depot.lire()).map((c) => [c.idEvenement, c.statut]));
    expect(statuts).toEqual({ a: "fait", b: "ignore", c: "a_traiter" });
    expect(await A.compteurMenu(o)).toBe(1);
  });
  it("les échecs d'envoi passent d'abord", async () => {
    const o = { env: ALLUME, depot };
    await A.enregistrerATraiter(entree({ idEvenement: "m", motif: "mot_manuel" }), o);
    await A.enregistrerATraiter(entree({ idEvenement: "e", motif: "echec_envoi" }), o);
    await A.enregistrerATraiter(entree({ idEvenement: "i", motif: "mot_inconnu", mot: "ZORG" }), o);
    expect((await A.lireVueATraiter(o)).cartes.map((c) => c.idEvenement)).toEqual(["e", "i", "m"]);
  });
  it("états vide et source non lisible", async () => {
    expect((await A.lireVueATraiter({ env: ALLUME, depot })).etat).toBe("vide");
    expect(await A.compteurMenu({ env: ALLUME, depot })).toBeNull();
    const casse = { lire: async () => { throw new Error("x"); }, ecrire: async () => {} };
    expect((await A.lireVueATraiter({ env: ALLUME, depot: casse })).etat).toBe("illisible");
    const h = renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "vide", cartes: [], compteur: 0 }, services: {} as never, compte: "c" }));
    expect(h).toContain("Rien à traiter");
  });
  it("STOP : simulation de PV-3 uniquement, la carte est mise de côté", async () => {
    const o = { env: ALLUME, depot };
    await A.enregistrerATraiter(entree(), o);
    const r = await A.arreterDepuisCarte("ev-1", "compte-1", o);
    expect(r).toEqual({ issue: "simule", raison: "stop_simule" });
    expect((await depot.lire())[0].statut).toBe("fait");
  });
});

describe("pv4 · échappement et données de personne", () => {
  it("l'extrait est échappé et limité à 140 caractères", () => {
    const e = A.fabriquerExtrait(`<script>alert("x")</script> & '${"a".repeat(300)}`);
    expect(e).not.toContain("<");
    expect(e).toContain("&lt;script&gt;");
    expect(e.length).toBeLessThanOrEqual(140);
    expect(A.fabriquerExtrait("<".repeat(200)).length).toBeLessThanOrEqual(140);
    expect(A.fabriquerExtrait("<".repeat(200))).toMatch(/^(&lt;)+$/);
  });
  it("aucune adresse e-mail ni pseudo n'est conservé", async () => {
    await A.enregistrerATraiter(entree({ commentaire: "GUIDE svp @jean.dupont ou jean@exemple.test merci" }), { env: ALLUME, depot });
    const brut = JSON.stringify(await depot.lire());
    expect(brut).not.toContain("@");
    expect(brut).not.toContain("jean");
  });
  it("la carte ne porte que les champs prévus", async () => {
    await A.enregistrerATraiter(entree(), { env: ALLUME, depot });
    expect(Object.keys((await depot.lire())[0]).sort()).toEqual(["creeLe", "extrait", "idEvenement", "kit", "lienPost", "mot", "motif", "post", "reseau", "statut"]);
  });
  it("le rendu échappe le HTML et n'utilise jamais de HTML brut", async () => {
    await A.enregistrerATraiter(entree({ commentaire: "<img src=x onerror=alert(1)>" }), { env: ALLUME, depot });
    const vue = await A.lireVueATraiter({ env: ALLUME, depot });
    const h = renderToStaticMarkup(createElement(EcranATraiter, { vue, services: {} as never, compte: "c" }));
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img");
    for (const f of ["components/a-traiter/EcranATraiter.tsx", "components/a-traiter/CarteATraiter.tsx"]) {
      expect(require("node:fs").readFileSync(`src/${f}`, "utf8")).not.toContain(J("dangerously", "SetInnerHTML"));
    }
  });
});

describe("pv4 · kit de réponse et mots interdits", () => {
  it("un kit conforme est gardé", async () => {
    await A.enregistrerATraiter(entree(), { env: ALLUME, depot });
    expect((await depot.lire())[0].kit).toBe(REPONSE);
  });
  it("un kit refusé par le contrôle de sortie est vidé, la carte reste", async () => {
    const mauvais = [`${TOKENS.lieu} ${REPONSE}`, `${TOKENS.label} ${REPONSE}`, `${TOKENS.participe} ${REPONSE}`, `${TOKENS.gain} ${REPONSE}`, `${REPONSE} ${J("ST", "OP")}`, `${REPONSE} a@b.test`];
    for (const [i, rep] of mauvais.entries()) await A.enregistrerATraiter(entree({ idEvenement: `k${i}`, reponse: rep }), { env: ALLUME, depot });
    const cartes = await depot.lire();
    expect(cartes).toHaveLength(mauvais.length);
    expect(cartes.every((c) => c.kit === null)).toBe(true);
  });
  it("les textes d'interface ne contiennent aucun mot interdit", () => {
    const vue = { etat: "normal" as const, compteur: 1, cartes: [{ idEvenement: "x", reseau: "youtube" as const, post: "p", lienPost: "https://exemple.test/p", mot: "GUIDE", motif: "mot_dans_phrase" as const, extrait: "merci", creeLe: "2026-01-01T00:00:00Z", statut: "a_traiter" as const, kit: REPONSE }] };
    const h = renderToStaticMarkup(createElement(EcranATraiter, { vue, services: {} as never, compte: "c" }));
    for (const t of Object.values(TOKENS)) expect(h.toLowerCase()).not.toContain(t.toLowerCase());
    expect(h).toContain("Copier la réponse");
    expect(h).toContain("STOP");
  });
});

describe("pv4 · gestes", () => {
  it("refusent sans session et n'écrivent rien", async () => {
    session.mockRejectedValue(new Error("pas de session"));
    await expect(G.gesteLireATraiter()).rejects.toThrow();
    await expect(G.gesteCarteFaite("a")).rejects.toThrow();
    await expect(G.gesteCarteIgnorer("a")).rejects.toThrow();
    await expect(G.gesteCarteStop("a", "c")).rejects.toThrow();
    session.mockImplementation(async () => ({}));
  });
  it("avec session, éteint : simulation", async () => {
    expect((await G.gesteCarteFaite("a")).issue).toBe("simule");
    expect((await G.gesteLireATraiter()).etat).toBe("desactive");
    expect(session).toHaveBeenCalled();
  });
});
