/** L5-13 : onglets par réseau et cartes déjà traitées de « À traiter ». Données fictives, aucun réseau, rien d'envoyé. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: session }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const O = await import("@/services/a-traiter-onglets");
const A = await import("@/services/a-traiter");
const G = await import("@/services/a-traiter-gestes");
const { EcranATraiter } = await import("@/components/a-traiter/EcranATraiter");
type Carte = import("@/services/a-traiter-types").CarteATraiter;

const carte = (reseau: Carte["reseau"], n: number, sur: Partial<Carte> = {}): Carte => ({
  idEvenement: `evt-fictif-${reseau}-${n}`,
  reseau,
  post: `post_fictif_${n}`,
  lienPost: null,
  mot: "GUIDE",
  motif: "mot_manuel",
  extrait: `Extrait fictif ${reseau} ${n}`,
  creeLe: `2026-11-1${n}T10:00:00.000Z`,
  statut: "a_traiter",
  kit: "Merci pour votre intérêt !",
  ...sur,
});
const CINQ = [carte("linkedin", 1), carte("linkedin", 2), carte("instagram", 3), carte("youtube", 4), carte("tiktok", 5)];
const services = { fait: vi.fn(), ignorer: vi.fn(), stop: vi.fn() };
const vue = (cartes: Carte[]) => ({ etat: "normal" as const, cartes, compteur: cartes.length });
const rendre = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(EcranATraiter, { vue: vue(CINQ), services, compte: "", ...props } as never));

beforeEach(() => {
  reinitialiserDepots();
  session.mockClear();
});

describe("onglets (module pur)", () => {
  it("l'ordre est Tous, LinkedIn, Instagram, Facebook, TikTok", () => {
    expect(O.ONGLETS_A_TRAITER.map((o) => o.libelle)).toEqual(["Tous", "LinkedIn", "Instagram", "Facebook", "TikTok"]);
  });
  it("filtrerParOnglet : un réseau, ou tout pour « Tous » (YouTube seulement là)", () => {
    expect(O.filtrerParOnglet(CINQ, "tous")).toHaveLength(5);
    expect(O.filtrerParOnglet(CINQ, "linkedin").map((c) => c.reseau)).toEqual(["linkedin", "linkedin"]);
    expect(O.filtrerParOnglet(CINQ, "facebook")).toEqual([]);
    for (const o of ["linkedin", "instagram", "facebook", "tiktok"] as const) expect(O.filtrerParOnglet(CINQ, o).some((c) => c.reseau === "youtube")).toBe(false);
  });
  it("compterParOnglet : un nombre par onglet", () => {
    expect(O.compterParOnglet(CINQ)).toEqual({ tous: 5, linkedin: 2, instagram: 1, facebook: 0, tiktok: 1 });
  });
});

describe("écran", () => {
  it("5 onglets en tablist avec compteur, premier onglet choisi, une seule carte", () => {
    const h = rendre({});
    expect(h).toContain('role="tablist"');
    for (const t of ["Tous (5)", "LinkedIn (2)", "Instagram (1)", "Facebook (0)", "TikTok (1)"]) expect(h).toContain(t);
    expect(h.match(/role="tab"/g)).toHaveLength(5);
    expect(h).toContain("5 à traiter");
    expect(h.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(h).toMatch(/aria-selected="true"[^>]*>Tous/);
    expect(h.match(/data-carte="a-traiter"/g)).toHaveLength(1);
    expect(h).toContain("Extrait fictif linkedin 1");
  });
  it("plus rien à traiter : « Rien à traiter » ET le bloc « Déjà traitées » restent visibles", () => {
    const dejaTraitees = [{ idEvenement: "e1", reseau: "linkedin", extrait: "Ancien extrait fictif", creeLe: "2026-11-01T10:00:00.000Z", statut: "fait" }];
    const h = rendre({ vue: { etat: "vide", cartes: [], compteur: 0 }, dejaTraitees });
    expect(h).toContain("Rien à traiter");
    expect(h).toContain("Déjà traitées (1)");
    expect(h).toContain('role="tablist"');
    expect(h).toContain("Tous (0)");
  });
  it("une date mal formée ne fait pas tomber l'écran", () => {
    const h = rendre({ dejaTraitees: [{ idEvenement: "e9", reseau: "facebook", extrait: "Extrait fictif", creeLe: "pas-une-date", statut: "fait" }] });
    expect(h).toContain("Déjà traitées (1)");
    expect(h).toMatch(/reçue le (<!-- -->)?pas-une-da</);
  });
  it("le bloc suit l'onglet : seules les cartes du réseau", () => {
    const l = [
      { idEvenement: "e1", reseau: "linkedin", extrait: "Extrait un", creeLe: "2026-11-01T10:00:00.000Z", statut: "fait" },
      { idEvenement: "e2", reseau: "tiktok", extrait: "Extrait deux", creeLe: "2026-11-02T10:00:00.000Z", statut: "fait" },
    ];
    expect(O.filtrerParOnglet(l as never, "tiktok")).toHaveLength(1);
  });
  it("libellés conservés", () => {
    const h = rendre({});
    for (const l of ["Copier la réponse", "Fait", "Ignorer", "STOP", "Réponse proposée"]) expect(h).toContain(l);
    expect(renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "desactive", cartes: [], compteur: null }, services, compte: "" }))).toContain("Désactivé");
    expect(renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "vide", cartes: [], compteur: 0 }, services, compte: "" }))).toContain("Rien à traiter");
    expect(rendre({ vue: vue([carte("linkedin", 1, { opposee: true, kit: null })]) })).toContain("Classer la carte");
  });
  it("sans prop dejaTraitees : pas de bloc", () => {
    expect(rendre({})).not.toContain("Déjà traitées");
  });
  it("bloc « Déjà traitées (n) » replié, en lecture seule, sans bouton d'action dedans", () => {
    const dejaTraitees = [
      { idEvenement: "e1", reseau: "linkedin", extrait: "Ancien extrait fictif", creeLe: "2026-11-01T10:00:00.000Z", statut: "fait" },
      { idEvenement: "e2", reseau: "tiktok", extrait: "Autre extrait fictif", creeLe: "2026-11-02T10:00:00.000Z", statut: "ignore" },
    ];
    const h = rendre({ dejaTraitees });
    expect(h).toContain("<details");
    expect(h).not.toMatch(/<details[^>]*\sopen/);
    expect(h).toContain("Déjà traitées (2)");
    const bloc = h.slice(h.indexOf("<details"), h.indexOf("</details>"));
    expect(bloc).toContain("Ancien extrait fictif");
    expect(bloc).toContain("LinkedIn");
    expect(bloc).not.toContain("<button");
  });
  it("aucun prix ni bandeau d'alerte", () => {
    expect(rendre({})).not.toMatch(/€|\$|\bprix\b/i);
    expect(rendre({})).not.toContain('role="alert"');
  });
});

describe("geste « déjà traitées »", () => {
  const depotAvec = (cartes: Carte[]) => {
    const d = A.creerDepotMemoire();
    return d.ecrire(cartes).then(() => d);
  };
  const MIXTE = [carte("linkedin", 1, { statut: "fait" }), carte("tiktok", 2, { statut: "ignore" }), carte("instagram", 3)];

  it("session exigée en premier", async () => {
    await G.gesteLireDejaTraitees({ env: { A_TRAITER_ENABLED: "1" }, depot: await depotAvec(MIXTE) });
    expect(session).toHaveBeenCalledTimes(1);
  });
  it("éteint : liste vide, rien lu ni écrit", async () => {
    const depot = await depotAvec(MIXTE);
    const lire = vi.spyOn(depot, "lire");
    const ecrire = vi.spyOn(depot, "ecrire");
    expect(await G.gesteLireDejaTraitees({ env: {}, depot })).toEqual([]);
    expect(lire).not.toHaveBeenCalled();
    expect(ecrire).not.toHaveBeenCalled();
  });
  it("allumé : seulement fait et ignoré, forme réduite, aucune écriture", async () => {
    const depot = await depotAvec(MIXTE);
    const ecrire = vi.spyOn(depot, "ecrire");
    const l = await G.gesteLireDejaTraitees({ env: { A_TRAITER_ENABLED: "1" }, depot });
    expect(l.map((c) => c.statut).sort()).toEqual(["fait", "ignore"]);
    expect(Object.keys(l[0]).sort()).toEqual(["creeLe", "extrait", "idEvenement", "reseau", "statut"]);
    expect(ecrire).not.toHaveBeenCalled();
    expect(await depot.lire()).toHaveLength(3);
  });
  it("dépôt illisible : liste vide, pas de plantage", async () => {
    const depot = { lire: async () => { throw new Error("cartes_illisibles"); }, ecrire: async () => undefined };
    expect(await G.gesteLireDejaTraitees({ env: { A_TRAITER_ENABLED: "1" }, depot })).toEqual([]);
  });
  it("durable : une carte écrite dans le dépôt est relue par un nouvel appel (redémarrage simulé)", async () => {
    let stock: Carte[] = [];
    const fabrique = () => ({ lire: async () => stock.map((c) => ({ ...c })), ecrire: async (n: Carte[]) => void (stock = n.map((c) => ({ ...c }))) });
    await fabrique().ecrire([carte("facebook", 7, { statut: "fait" })]);
    const l = await G.gesteLireDejaTraitees({ env: { A_TRAITER_ENABLED: "1" }, depot: fabrique() });
    expect(l.map((c) => c.idEvenement)).toEqual(["evt-fictif-facebook-7"]);
    const vueRelue = await A.lireVueATraiter({ env: { A_TRAITER_ENABLED: "1" }, depot: fabrique() });
    expect(vueRelue.cartes).toEqual([]);
    stock = [...stock, carte("linkedin", 8)];
    expect((await A.lireVueATraiter({ env: { A_TRAITER_ENABLED: "1" }, depot: fabrique() })).cartes.map((c) => c.idEvenement)).toEqual(["evt-fictif-linkedin-8"]);
  });
});
