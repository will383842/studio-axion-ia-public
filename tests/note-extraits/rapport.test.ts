import { describe, expect, it, vi } from "vitest";
import { main, rapportExtraits, trierParDefaut, type TriExtraits, type VideoLue } from "../../scripts/note-extraits/rapport";
import type { Moment, ResultatTri } from "@/briques/note-extraits";

// Dépôts factices : lecture (`lister`) avec fixtures, écritures espionnées (test « zéro écriture » sur le lecteur réel).
const ecritures = vi.hoisted(() => ({ enregistrer: vi.fn(), modifier: vi.fn(), effacer: vi.fn() }));
const lecturesVideos = vi.hoisted(() => vi.fn());
const lecturesVersions = vi.hoisted(() => vi.fn());
vi.mock("../../src/donnees/memoire", () => ({
  depots: () => ({
    videos: { lister: lecturesVideos, ...ecritures },
    versions: { lister: lecturesVersions, ...ecritures },
  }),
}));

const PLAN = (fin: number) => ({ scenes: [{ piece: "tableau-de-bord", debutMs: 0, finMs: fin * 1000 }] });
const base = (id: string, o: Partial<VideoLue> = {}): VideoLue => ({
  id, titre: `Titre ${id}`, generateur: "facecam", creeLe: "2026-11-01T10:00:00Z",
  video: { estDemo: false, statut: "prete", etapeEditoriale: "publiee" },
  versionEnEssai: false, sortieDemo: false, aSousTitres: true, avecVisage: true, plan: PLAN(5), ...o,
});

const triSimule: TriExtraits = (moments: Moment[]): ResultatTri => {
  const m = moments.map((x) => ({ ...x, note: 70, raisons: [], sujet: "relances-impayes" as const, usages: ["ecran" as const], decision: "garde" as const }));
  return { gardes: m, peutEtre: [], ignores: { nombre: 0, raisonPrincipale: null }, rienARetenir: m.length === 0 };
};

describe("rapportExtraits (X4-16a)", () => {
  it("rend un tableau déterministe sur fixtures", async () => {
    const lister = vi.fn(async () => [base("v1"), base("v2", { plan: undefined, generateur: "demo" })]);
    const a = await rapportExtraits({ n: 5, trier: triSimule, lister });
    const b = await rapportExtraits({ n: 5, trier: triSimule, lister });
    expect(a).toBe(b);
    expect(a).toContain("| Vidéo | Générateur | Gardés | Peut-être | Ignorés | Sujets | Usages | Rien à retenir |");
    expect(a).toMatch(/\| Titre v1 \| facecam \| 1 \| 0 \| 0 \| relances-impayes \| ecran \| non \|/);
    expect(a).toMatch(/\| Titre v2 \| demo \| 0 \| 0 \| 0 \| — \| — \| oui \|/);
  });

  it("écarte essai, démonstration, corbeille, pas prête", async () => {
    const lister = async () => [
      base("ok"),
      base("demo", { video: { estDemo: true, statut: "prete", etapeEditoriale: "publiee" } }),
      base("corbeille", { video: { estDemo: false, statut: "prete", corbeilleLe: "2026-11-02", etapeEditoriale: "publiee" } }),
      base("essai", { versionEnEssai: true }),
      base("brouillon", { video: { estDemo: false, statut: "brouillon" as never, etapeEditoriale: "publiee" } }),
    ];
    const r = await rapportExtraits({ n: 10, trier: triSimule, lister });
    expect(r).toContain("Titre ok");
    for (const x of ["demo", "corbeille", "essai", "brouillon"]) expect(r).not.toContain(`Titre ${x} `);
  });

  it("ne garde que les n dernières, la plus récente d'abord", async () => {
    const lister = async () => [base("a", { creeLe: "2026-11-01" }), base("b", { creeLe: "2026-11-03" }), base("c", { creeLe: "2026-11-02" })];
    const r = await rapportExtraits({ n: 2, trier: triSimule, lister });
    expect(r.indexOf("Titre b")).toBeLessThan(r.indexOf("Titre c"));
    expect(r).not.toContain("Titre a ");
  });

  it("zéro écriture : le tri reçoit les moments, rien d'autre n'est appelé", async () => {
    const enregistrer = vi.fn();
    const effacer = vi.fn();
    const lister = Object.assign(async () => [base("v1")], { enregistrer, effacer });
    await rapportExtraits({ n: 3, trier: triSimule, lister });
    expect(enregistrer).not.toHaveBeenCalled();
    expect(effacer).not.toHaveBeenCalled();
  });
});

describe("main (X4-16a)", () => {
  it("sans tri : utilise trierVideo (tri par défaut), lister appelé une fois, sortie 0", async () => {
    const lister = vi.fn(async () => [base("v1", { avecVisage: false })]);
    const ecrire = vi.fn();
    const code = await main({ lister, ecrire });
    expect(lister).toHaveBeenCalledTimes(1);
    const texte = ecrire.mock.calls.join("");
    expect(texte).not.toContain("attend X4-06");
    expect(texte).toContain("Titre v1");
    expect(code).toBe(0);
  });

  it("avec tri : écrit le rapport", async () => {
    const ecrire = vi.fn();
    const code = await main({ trier: triSimule, lister: async () => [base("v1")], ecrire });
    expect(ecrire.mock.calls.join("")).toContain("Titre v1");
    expect(code).toBe(0);
  });

  it("lecteur réel (sans lister) : lit via depots().*.lister, n'écrit jamais (enregistrer, modifier, effacer)", async () => {
    lecturesVideos.mockReset().mockImplementation(async (filtre?: (v: unknown) => boolean) => {
      const toutes = [
        { id: "r1", titre: "Réelle 1", statut: "prete", creeLe: "2026-11-05T10:00:00Z", etapeEditoriale: "publiee" },
        { id: "r2", titre: "Démo", statut: "prete", estDemo: true, creeLe: "2026-11-04T10:00:00Z", etapeEditoriale: "publiee" },
      ];
      return filtre ? toutes.filter(filtre) : toutes;
    });
    lecturesVersions.mockReset().mockResolvedValue([
      { id: "x1", videoId: "r1", statut: "prete", creeLe: "2026-11-05T10:00:00Z", commande: { moteurId: "facecam" }, projetMontage: { plan: PLAN(5) } },
    ]);
    Object.values(ecritures).forEach((f) => f.mockClear());
    const ecrire = vi.fn();
    const code = await main({ trier: triSimule, ecrire });
    expect(code).toBe(0);
    expect(lecturesVideos).toHaveBeenCalled();
    expect(lecturesVersions).toHaveBeenCalled();
    expect(ecrire.mock.calls.join("")).toContain("Réelle 1");
    expect(ecrire.mock.calls.join("")).not.toContain("Démo");
    expect(ecritures.enregistrer).not.toHaveBeenCalled();
    expect(ecritures.modifier).not.toHaveBeenCalled();
    expect(ecritures.effacer).not.toHaveBeenCalled();
  });
});

describe("trierParDefaut (X4-16b)", () => {
  const lister = async () => [base("v1", { avecVisage: false, typeAutomatisation: "relances-impayes" })];

  it("est assignable à TriExtraits", () => {
    const t: TriExtraits = trierParDefaut;
    expect(typeof t).toBe("function");
  });

  it("colonne Usages : « ecran » sans visage, jamais « preuve-chiffree » ; deux appels, même texte", async () => {
    const a = await rapportExtraits({ n: 5, trier: trierParDefaut, lister });
    const b = await rapportExtraits({ n: 5, trier: trierParDefaut, lister });
    expect(a).toBe(b);
    const ligne = a.split("\n").find((l) => l.includes("Titre v1")) ?? "";
    expect(ligne.split("|")[7]).toContain("ecran");
    expect(a).not.toContain("preuve-chiffree");
  });

  it("main() sans tri ni lister : aucune écriture (enregistrer, modifier, effacer)", async () => {
    lecturesVideos.mockReset().mockResolvedValue([
      { id: "r1", titre: "Réelle 1", statut: "prete", creeLe: "2026-11-05T10:00:00Z", etapeEditoriale: "publiee" },
    ]);
    lecturesVersions.mockReset().mockResolvedValue([
      { id: "x1", videoId: "r1", statut: "prete", creeLe: "2026-11-05T10:00:00Z", commande: { moteurId: "facecam" }, projetMontage: { plan: PLAN(5) } },
    ]);
    Object.values(ecritures).forEach((f) => f.mockClear());
    const ecrire = vi.fn();
    expect(await main({ ecrire })).toBe(0);
    expect(lecturesVideos).toHaveBeenCalled();
    expect(ecrire.mock.calls.join("")).toContain("Réelle 1");
    expect(ecritures.enregistrer).not.toHaveBeenCalled();
    expect(ecritures.modifier).not.toHaveBeenCalled();
    expect(ecritures.effacer).not.toHaveBeenCalled();
  });
});
