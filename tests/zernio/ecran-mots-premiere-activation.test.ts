/** Première activation du mot GUIDE depuis /mots : validation côté serveur, bouton par compte, aucun texte côté client, aucun réseau. Valeurs fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";

let session = true;
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session) throw new Error("NON_CONNECTE");
    return {};
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const reseau = vi.fn(async () => new Response("{}"));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre } = await import("@/services/_commun");
const S = await import("@/services/mots-service");
const Ges = await import("@/services/mots-gestes");
const actions = await import("@/app/(studio)/mots/actions");
const { default: PageMots } = await import("@/app/(studio)/mots/page");
const { EcranMots } = await import("@/components/mots/EcranMots");
const { phraseRefus } = await import("@/components/mots/etat-mots");

const COMPTE = "compte_fictif_1";
const ligne = async () => (await lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {}))[`GUIDE|${COMPTE}`];
const ENV = { MOTS_ENABLED: "1", PARCOURS_CONVERSATION_TITRE_GUIDE: "Guide fictif" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  reinitialiserDepots();
  S.injecterExecuteurMots(async () => {
    throw new Error("appel réseau interdit");
  });
  session = true;
  vi.stubEnv("MOTS_ENABLED", "1");
  vi.stubEnv("PARCOURS_CONVERSATION_TITRE_GUIDE", "Guide fictif");
  vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", `${COMPTE}, compte_fictif_2`);
});

describe("service : source officielle et validation serveur", () => {
  it("la saisie du dictionnaire est acceptée par construireGrapheMot", async () => {
    const { saisieGuideDepuisDictionnaire } = await import("@/services/mots-guide-source");
    const { textesDepuisSaisie, validerTextes } = await import("@/services/mots-textes");
    const { construireGrapheMot } = await import("@/services/mots-graphe");
    const s = saisieGuideDepuisDictionnaire(process.env);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(construireGrapheMot(validerTextes(textesDepuisSaisie(s.saisie))).ok).toBe(true);
  });

  it("sans titre du guide, la source du dictionnaire refuse (aucun texte à trous)", async () => {
    const { saisieGuideDepuisDictionnaire } = await import("@/services/mots-guide-source");
    expect(saisieGuideDepuisDictionnaire({}).ok).toBe(false);
  });

  it("sans validation : l'activation est refusée avec mot_non_valide, aucune ligne", async () => {
    const r = await actions.activerMotLocalAction(COMPTE);
    expect(r).toMatchObject({ issue: "refuse", raison: "mot_non_valide" });
    expect(await ligne()).toBeUndefined();
    expect(phraseRefus("mot_non_valide")).toBe("Les textes de ce mot ne sont pas validés.");
  });

  it("validation puis activation : ligne GUIDE|compte actif, idWorkflow null, raison local, sans réseau", async () => {
    expect((await S.lireVueMots(ENV)).guideValide).toBe(false);
    const v = await actions.validerMotGuideAction();
    expect(v).toEqual({ ok: true, raison: "valide" });
    expect((await S.lireVueMots(ENV)).guideValide).toBe(true);
    const r = await actions.activerMotLocalAction(COMPTE);
    expect(r.issue).toBe("execute");
    expect(await ligne()).toMatchObject({ mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local" });
    expect(reseau).not.toHaveBeenCalled();
  });

  it("la vue n'expose aucun texte, seulement un booléen", async () => {
    await actions.validerMotGuideAction();
    const vue = await S.lireVueMots(ENV);
    expect(JSON.stringify(vue)).not.toMatch(/Message automatique/);
    expect(typeof vue.guideValide).toBe("boolean");
  });
});

describe("session exigée", () => {
  it("sans session : page et actions refusent, rien n'est écrit", async () => {
    session = false;
    await expect(PageMots()).rejects.toThrow("NON_CONNECTE");
    await expect(actions.validerMotGuideAction()).rejects.toThrow("NON_CONNECTE");
    await expect(Ges.gesteComptesGuide()).rejects.toThrow("NON_CONNECTE");
    session = true;
    expect((await S.lireVueMots(ENV)).guideValide).toBe(false);
  });
  it("la page transmet les comptes (identifiants seulement)", async () => {
    const el = (await PageMots()) as { props: { comptes: string[] } };
    expect(el.props.comptes).toEqual([COMPTE, "compte_fictif_2"]);
  });
});

const vueVide = { interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 100 }, lignes: [] as LigneMot[], oppositions: 0, guideValide: false };
const services = () => ({
  mettreEnPause: vi.fn(),
  reactiver: vi.fn(),
  activerLocal: vi.fn(),
  mettreEnPauseLocal: vi.fn(),
  refermerDisjoncteur: vi.fn(),
  reglerPlafonds: vi.fn(),
  validerGuide: vi.fn(),
});

describe("écran", () => {
  it("bloc Mot GUIDE toujours visible, avec bouton de validation et un bouton Activer par compte sans ligne", () => {
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: vueVide, services: services() as never, comptes: [COMPTE, "compte_fictif_2"] }));
    expect(html).toContain("Mot GUIDE");
    expect(html).toContain("Valider les textes du mot GUIDE");
    expect(html.match(/Activer le mot GUIDE/g)).toHaveLength(2);
    expect(html).toContain(COMPTE);
    expect(html).toContain("Aucun mot posé");
  });
  it("un compte qui a déjà une ligne GUIDE n'a plus le bouton d'activation du bloc", () => {
    const l: LigneMot = { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local", modifieLe: "" };
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: { ...vueVide, lignes: [l] }, services: services() as never, comptes: [COMPTE, "compte_fictif_2"] }));
    expect(html.match(/Activer le mot GUIDE/g)).toHaveLength(1);
    expect(html).toContain("Mettre en pause");
  });
  it("le composant client ne contient aucun texte du mot ni du dictionnaire", () => {
    for (const f of ["src/components/mots/EcranMots.tsx", "src/components/mots/EcranMotsConnecte.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/Message automatique|reponsePublique|messagePrive/);
    }
    // l'action de validation ne prend aucun argument : le client ne peut rien transmettre
    expect(actions.validerMotGuideAction.length).toBe(0);
  });
  it("dictionnaire inchangé", () => {
    const h = createHash("sha256").update(readFileSync("contrats/dictionnaire-textes-mp.v2.json")).digest("hex");
    expect(h).toBe("2acad2a6ed24250b65df4e6693c6e0614bafe4921140e119aa53b21d9ee4671e");
  });
});
