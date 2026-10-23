/**
 * « Idées de l'usine » : le comité éditorial branché sur l'AFFICHAGE (livré éteint).
 *  - éteint : affichage identique à aujourd'hui (idées brutes de la porte) ;
 *  - allumé + réserve : les idées retenues d'abord, dans l'ordre du comité, avec sa raison ; les écartées repliées ;
 *  - allumé + réserve vide, ou plafond du mois atteint : idées brutes ;
 *  - l'affichage ne lance JAMAIS le comité : aucun appel au fournisseur Claude (espions) ;
 *  - une idée écrite au studio sort de la réserve (pas montrée deux fois).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
// Espions sur tout ce qui peut faire travailler (et payer) le comité.
vi.mock("@/services/comite-editorial", async (original) => {
  const vrai = await original<typeof import("@/services/comite-editorial")>();
  return { ...vrai, travaillerComite: vi.fn(vrai.travaillerComite), jugerALaDemande: vi.fn(vrai.jugerALaDemande), prixJugementDirect: vi.fn(vrai.prixJugementDirect) };
});
vi.mock("@/fournisseurs/claude/lots", async (original) => {
  const vrai = await original<typeof import("@/fournisseurs/claude/lots")>();
  return { ...vrai, creerLot: vi.fn(vrai.creerLot), lireLot: vi.fn(vrai.lireLot), listerLots: vi.fn(vrai.listerLots), lireResultatsLot: vi.fn(vrai.lireResultatsLot) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const comite = await import("@/services/comite-editorial");
const lots = await import("@/fournisseurs/claude/lots");
const { ideesDuComitePourAffichage } = await import("@/services/comite-affichage");
const { ideesDuComiteAction } = await import("@/app/(studio)/ecrire/usine/actions");
const { ecrireSujetDeLUsine } = await import("@/services/usine-sujet");
const { VueIdeesUsine } = await import("@/components/ecrire/VueIdeesUsine");
import type { IdeeJugee } from "@/domaine/types";
import type { IdeesDuComite, IdeeUsine } from "@/domaine/usine";

const MDP = "essai-comite-affichage";
let fetchEspion: ReturnType<typeof vi.fn>;

function jugee(n: number, total: number, verdict: IdeeJugee["verdict"] = "garder", plus: Partial<IdeeJugee> = {}): IdeeJugee {
  return {
    id: `ij-${n}`,
    signature: `sig-${n}`,
    parts: { metier: `m${n}`, douleur: null },
    idee: `Idée ${n}`,
    textes: { metier: "Plombier", taille: "TPE", douleur: `Douleur ${n}`, casUsage: `Cas ${n}`, format: "Facecam" },
    notes: { douleur: 5, cible: 5, angleDifferent: 5, potentiel: 5 },
    total,
    verdict,
    raison: `Raison ${n}`,
    angle: `Angle ${n}`,
    date: "2026-10-17T08:00:00.000Z",
    source: "lot",
    creeLe: "2026-10-17T08:00:00.000Z",
    modifieLe: "2026-10-17T08:00:00.000Z",
    ...plus,
  } as IdeeJugee;
}

const BRUTE: IdeeUsine = { signature: "brute-1", parts: { metier: "x" }, metier: "Expert-comptable", taille: "PME", douleur: "Douleur brute de la porte", casUsage: "Cas brut" };
const PROPS = { filtres: { metiers: [], tailles: [], reseaux: [] }, onFiltres: () => {}, metiers: [], idees: [BRUTE], enCours: false, ecritureEn: null, erreur: null, onProposer: () => {}, onEcrire: () => {} };
const vue = (comite?: IdeesDuComite) => renderToStaticMarkup(createElement(VueIdeesUsine, { ...PROPS, ...(comite ? { comite } : {}) }));

function aucunAppelClaude() {
  expect(fetchEspion).not.toHaveBeenCalled();
  expect(comite.travaillerComite).not.toHaveBeenCalled();
  expect(comite.jugerALaDemande).not.toHaveBeenCalled();
  expect(comite.prixJugementDirect).not.toHaveBeenCalled();
  for (const f of [lots.creerLot, lots.lireLot, lots.listerLots, lots.lireResultatsLot]) expect(f).not.toHaveBeenCalled();
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.clearAllMocks();
  fetchEspion = vi.fn(() => {
    throw new Error("fetch interdit (aucun appel réel)");
  });
  vi.stubGlobal("fetch", fetchEspion);
  await auth.seConnecter(MDP, false);
  delete process.env.USINE_URL;
  delete process.env.USINE_PORTE_SECRET;
});

describe("comité branché sur « Idées de l'usine »", () => {
  it("éteint (par défaut) : rien du comité, même avec une réserve pleine ; vue identique à aujourd'hui", async () => {
    for (const [n, t] of [[1, 30], [2, 35]] as const) await depots().ideesJugees.enregistrer(jugee(n, t));
    expect(await ideesDuComitePourAffichage()).toEqual({ retenues: [], ecartees: [] });
    const r = await ideesDuComiteAction();
    expect(r.ok && r.donnees).toEqual({ retenues: [], ecartees: [] });
    expect(vue({ retenues: [], ecartees: [] })).toBe(vue());
    expect(vue()).toContain("Douleur brute de la porte");
    expect(vue()).not.toContain("comité");
    aucunAppelClaude();
  });

  it("allumé + réserve : retenues dans l'ordre du comité avec leur raison ; écartées et simulées non montrées en tête", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    await depots().ideesJugees.enregistrer(jugee(1, 28));
    await depots().ideesJugees.enregistrer(jugee(2, 36));
    await depots().ideesJugees.enregistrer(jugee(3, 12, "ecarter"));
    await depots().ideesJugees.enregistrer(jugee(4, 39, "garder", { simule: true }));
    await depots().ideesJugees.enregistrer(jugee(5, 40, "garder", { utiliseeLe: "2026-10-17T09:00:00.000Z" }));
    const c = await ideesDuComitePourAffichage();
    expect(c.retenues.map((i) => i.signature)).toEqual(["sig-2", "sig-1"]);
    expect(c.retenues[0]).toMatchObject({ douleur: "Douleur 2", casUsage: "Cas 2", metier: "Plombier", taille: "TPE", format: "Facecam", raison: "Raison 2", parts: { metier: "m2", douleur: null } });
    expect(c.ecartees.map((i) => i.signature)).toEqual(["sig-3"]);

    const html = vue(c);
    const [p2, p1, brute] = ["Douleur 2", "Douleur 1", "Douleur brute de la porte"].map((t) => html.indexOf(t));
    expect(p2).toBeGreaterThan(-1);
    expect(p2).toBeLessThan(p1);
    expect(p1).toBeLessThan(brute);
    expect(html).toContain("Raison 2");
    expect(html).toContain("voir les idées écartées");
    expect(html.indexOf("Douleur 3")).toBeGreaterThan(html.indexOf("voir les idées écartées"));
    // Une idée brute déjà retenue par le comité n'est pas montrée deux fois.
    const doublon = renderToStaticMarkup(createElement(VueIdeesUsine, { ...PROPS, idees: [{ ...BRUTE, signature: "sig-2", douleur: "Douleur 2" }], comite: c }));
    expect(doublon.split("Douleur 2").length - 1).toBe(1);
    aucunAppelClaude();
  });

  it("allumé + réserve vide (ou seulement simulée / écartée) : idées brutes", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    expect(await ideesDuComitePourAffichage()).toEqual({ retenues: [], ecartees: [] });
    await depots().ideesJugees.enregistrer(jugee(3, 12, "ecarter"));
    await depots().ideesJugees.enregistrer(jugee(4, 39, "garder", { simule: true }));
    expect(await ideesDuComitePourAffichage()).toEqual({ retenues: [], ecartees: [] });
    aucunAppelClaude();
  });

  it("allumé + plafond du mois atteint : idées brutes", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    await ecrireParametre(comite.PARAM_PLAFOND_IDEES, 0);
    await depots().ideesJugees.enregistrer(jugee(1, 30));
    expect(await ideesDuComitePourAffichage()).toEqual({ retenues: [], ecartees: [] });
    aucunAppelClaude();
  });

  it("une idée du comité écrite au studio sort de la réserve (pas montrée deux fois)", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    await depots().ideesJugees.enregistrer(jugee(1, 30));
    await depots().ideesJugees.enregistrer(jugee(2, 20));
    const [premiere] = (await ideesDuComitePourAffichage()).retenues;
    const r = await ecrireSujetDeLUsine(premiere!, { reseaux: [], typeContenu: "video" });
    expect(r.rappelUsine).toBe(true); // porte éteinte dans l'essai
    expect((await depots().ideesJugees.obtenir("ij-1"))?.utiliseeLe).toBeTruthy();
    expect((await ideesDuComitePourAffichage()).retenues.map((i) => i.signature)).toEqual(["sig-2"]);
    expect((await depots().scriptsMaitres.obtenir(r.id))?.origineUsine?.parts).toEqual({ metier: "m1", douleur: null });
    aucunAppelClaude();
  });
});
