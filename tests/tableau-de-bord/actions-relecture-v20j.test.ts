import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENTREE_DONNEES, lireEntreesDonnees } from "@/moteurs/montage-donnees/entrees";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { Video } from "@/domaine/types";

const racine = join(__dirname, "..", "..");
const fichierAction = join(racine, "src/app/(studio)/videos/actions-tableau-de-bord.ts");

const session = vi.hoisted(() => ({ presente: true }));
const ouvrir = vi.hoisted(() => vi.fn());
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    if (!session.presente) throw new Error("pas de session");
    return { id: "s1" };
  },
}));
vi.mock("@/services/tableau-de-bord-relecture", async (importer) => ({ ...(await importer<typeof import("@/services/tableau-de-bord-relecture")>()), ouvrirRelectureTableau: ouvrir }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { ouvrirRelectureTableauAction, validerRelectureTableauAction } = await import("../../src/app/(studio)/videos/actions-tableau-de-bord");

const image = { base64: "AAAA", type: "image/png" as const, largeur: 10, hauteur: 10 };
const brouillon = {
  version: "tableau-de-bord.v1",
  titre: "Mon mois",
  periode: { debut: "2026-10-01", fin: "2026-10-31", libelle: "Octobre" },
  source: "Capture",
  indicateurs: [{ id: "visites", libelle: "Visites", valeur: 120, unite: "visites", precision: 0, sens: "hausse-bonne" }],
  series: [{ id: "jour", libelle: "Par jour", unite: "visites", points: [{ x: "1", valeur: 10 }, { x: "2", valeur: 12 }] }],
  comparaisons: [],
  alertes: [],
  calculs: [],
} as unknown as TableauDeBord;
const cles = ["indicateur:visites", "point:jour:0", "point:jour:1"];
const tout = Object.fromEntries(cles.map((c) => [c, { type: "valide" as const }]));

async function poserVideo(formatId: string, entrees: Record<string, unknown> = {}) {
  await depots().videos.enregistrer({ id: "v1", formatId, entrees } as unknown as Video);
}

beforeEach(() => {
  reinitialiserDepots();
  session.presente = true;
  ouvrir.mockReset();
  ouvrir.mockResolvedValue({ etape: "relecture", brouillon, aRelire: [] });
});

describe("G4-08-b2 · ouvrirRelectureTableauAction", () => {
  it("b) vidéo d'un autre format : refus, la lecture n'est jamais appelée", async () => {
    await poserVideo("cas-concret");
    const r = await ouvrirRelectureTableauAction("v1", image);
    expect(r.ok).toBe(false);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it("b) vidéo inconnue : refus sans appel", async () => {
    const r = await ouvrirRelectureTableauAction("absente", image);
    expect(r.ok).toBe(false);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it("b) format tableau-de-bord : lecture appelée UNE fois, origine « studio »", async () => {
    await poserVideo("tableau-de-bord");
    const r = await ouvrirRelectureTableauAction("v1", image);
    expect(r.ok).toBe(true);
    expect(ouvrir).toHaveBeenCalledTimes(1);
    expect(ouvrir.mock.calls[0]?.slice(0, 3)).toEqual(["v1", image, "studio"]);
  });

  it("b) session absente : erreur, rien n'est appelé", async () => {
    await poserVideo("tableau-de-bord");
    session.presente = false;
    const r = await ouvrirRelectureTableauAction("v1", image);
    expect(r.ok).toBe(false);
    expect(ouvrir).not.toHaveBeenCalled();
  });
});

describe("G4-08-b2 · validerRelectureTableauAction", () => {
  it("c) décisions complètes : le tableau corrigé est rangé, et le vrai lecteur du moteur l'accepte", async () => {
    await poserVideo("tableau-de-bord", { autre: 1 });
    const r = await validerRelectureTableauAction("v1", brouillon, { ...tout, "indicateur:visites": { type: "corrige", valeur: 130 } });
    expect(r).toEqual({ ok: true, donnees: { ok: true } });
    const video = await depots().videos.obtenir("v1");
    expect(video?.entrees.autre).toBe(1);
    const lu = lireEntreesDonnees(video?.entrees);
    expect(lu.ok).toBe(true);
    if (lu.ok) expect(lu.entrees.donnee.indicateurs[0]?.valeur).toBe(130);
  });

  it("c) décisions incomplètes : rien n'est écrit, la raison est rendue", async () => {
    await poserVideo("tableau-de-bord");
    const r = await validerRelectureTableauAction("v1", brouillon, { "indicateur:visites": { type: "valide" } });
    expect(r.ok && r.donnees.ok).toBe(false);
    if (r.ok && !r.donnees.ok) expect(r.donnees.raisons.length).toBeGreaterThan(0);
    expect((await depots().videos.obtenir("v1"))?.entrees).toEqual({});
  });

  it("c) tout refusé : plus rien à montrer, rien n'est écrit", async () => {
    await poserVideo("tableau-de-bord");
    const refus = Object.fromEntries(cles.map((c) => [c, { type: "refuse" as const }]));
    const r = await validerRelectureTableauAction("v1", brouillon, refus);
    expect(r.ok && r.donnees.ok).toBe(false);
    expect((await depots().videos.obtenir("v1"))?.entrees).toEqual({});
  });

  it("c) un autre format est refusé, rien n'est écrit", async () => {
    await poserVideo("cas-concret");
    const r = await validerRelectureTableauAction("v1", brouillon, tout);
    expect(r.ok).toBe(false);
    expect((await depots().videos.obtenir("v1"))?.entrees).toEqual({});
  });

  it("c) la clé littérale de l'action est celle du moteur", () => {
    expect(readFileSync(fichierAction, "utf8")).toContain(`const CLE_ENTREE = "${ENTREE_DONNEES}";`);
  });
});

describe("G4-08-b2 · gardes", () => {
  const source = readFileSync(fichierAction, "utf8");
  it("d) ni lecture-capture, ni relecture-chiffres, ni montant en dur ; aucun import de fabrication, credits ou fournisseurs", () => {
    expect(source).not.toMatch(/lecture-capture/);
    expect(source).not.toMatch(/relecture-chiffres/);
    expect(source).not.toMatch(/\d+\s*(€|eur|usd|\$)/i);
    const imports = [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) expect(i).not.toMatch(/fabrication|credits|@\/fournisseurs\/|montage-donnees|depense-claude|generation-claude/);
  });

  it("d) montés par la seule page du tableau de bord (G4-08-b3-b) : seuls actions.ts et FormulaireTableauDeBord.tsx importent EcranRelectureTableau ou actions-tableau-de-bord", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(n) && !p.endsWith("EcranRelectureTableau.tsx") && p !== fichierAction && /EcranRelectureTableau|actions-tableau-de-bord/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    parcourir(join(racine, "src"));
    expect(trouves.sort()).toEqual([join(racine, "src/app/(studio)/tableau-de-bord/actions.ts"), join(racine, "src/components/formats/vitrines/FormulaireTableauDeBord.tsx")].sort());
  });

  it("e) audit argent léger : un dépôt = au plus un appel de lecture, aucune ligne de prix", async () => {
    await poserVideo("tableau-de-bord");
    await ouvrirRelectureTableauAction("v1", image);
    expect(ouvrir.mock.calls.length).toBeLessThanOrEqual(1);
    expect(source).not.toMatch(/prix|tarif|centime|plafond|reserver/i);
  });
});
