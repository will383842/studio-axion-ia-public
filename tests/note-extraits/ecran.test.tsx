/** X4-12d : « Extraits gardés » posé dans l'écran des extraits (onglets, filtres, raisons en clair, gestes branchés). Rendu serveur, actions doublées. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

const garderQuandMemeAction = vi.fn(async (...a: unknown[]) => (void a, { ok: true }));
const changerSujetAction = vi.fn(async (...a: unknown[]) => (void a, { ok: true }));
const marquerChiffresReelsAction = vi.fn(async (...a: unknown[]) => (void a, { ok: true }));
const ecarterPlageAction = vi.fn(async (...a: unknown[]) => (void a, { ok: true }));
vi.mock("@/app/(studio)/bibliotheque/source-extraits/actions", () => ({
  ecarterPlageAction: (v: string, p: string) => ecarterPlageAction(v, p),
  retablirPlageAction: async () => ({ ok: true }),
  validerPlageAction: async () => ({ ok: true }),
  rangerSourceAction: async () => ({ ok: true }),
  cocherVideoAction: async () => ({ ok: true }),
}));
vi.mock("@/app/(studio)/bibliotheque/source-extraits/actions-note", () => ({
  garderQuandMemeAction: (v: string, p: string) => garderQuandMemeAction(v, p),
  changerSujetAction: (v: string, p: string, s: string) => changerSujetAction(v, p, s),
  marquerChiffresReelsAction: (v: string, o: boolean) => marquerChiffresReelsAction(v, o),
}));

// Pas de jsdom : le clic est rejoué en appelant les rappels reçus, et l'état est doublé.
let proprietes: Record<string, unknown> = {};
let espion = false;
vi.mock("@/components/bibliotheque/EcranSourcesExtraits", async (importer) => {
  const vrai = await importer<typeof import("@/components/bibliotheque/EcranSourcesExtraits")>();
  return {
    EcranSourcesExtraits: (p: Record<string, unknown>) => {
      if (espion) {
        proprietes = p;
        return null;
      }
      return createElement(vrai.EcranSourcesExtraits, p as never);
    },
  };
});
vi.mock("react", async (importer) => {
  const vrai = await importer<typeof import("react")>();
  return { ...vrai, useTransition: () => [false, (f: () => unknown) => void f()] };
});

const { EcranSourcesExtraits } = await import("@/components/bibliotheque/EcranSourcesExtraits");
const { EcranSourcesExtraitsBranche } = await import("@/components/bibliotheque/EcranSourcesExtraitsBranche");

const plage = (id: string, extra: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 12, texte: `Texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...extra,
});
const fiche = (videoId: string, plages: PlageExtrait[], extra: Partial<FicheSourceExtraits> = {}): FicheSourceExtraits => ({
  videoId, versionId: "ver", sortieId: "s", ratio: "9:16", licence: {} as FicheSourceExtraits["licence"],
  famille: [], plages, rangee: false, sourcePreferee: false, ...extra,
});
const nonNotee = fiche("v1", [plage("a"), plage("b")]);
const notee = fiche("v1", [plage("a", { note: 85 }), plage("b", { note: 50 })], { noteVersion: "1" });
const rendre = (p: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(EcranSourcesExtraits as never, { fiches: [nonNotee], titres: { v1: "Ma vidéo" }, inscriptionActive: true, politique: "publiees", ...p }));

describe("EcranSourcesExtraits + ExtraitsGardes", () => {
  it("sans fiche notée : rendu identique avec et sans `note`, aucun onglet", () => {
    const sans = rendre({});
    expect(rendre({ note: { generateurs: { v1: "Capture" } } })).toBe(sans);
    expect(sans).not.toContain("tablist");
    expect(rendre({ note: {}, fiches: [] })).toBe(rendre({ fiches: [] }));
  });
  it("sans `note`, même avec une fiche notée : aucun onglet", () => {
    expect(rendre({ fiches: [notee] })).not.toContain("tablist");
  });
  it("une fiche notée : 3 onglets au-dessus de la liste", () => {
    const h = rendre({ fiches: [notee], note: {} });
    for (const o of ["Gardés (1)", "Peut-être (1)", "Ignorés (pourquoi) (0)"]) expect(h).toContain(o);
    expect(h.indexOf("tablist")).toBeLessThan(h.indexOf('aria-label="Sources d&#x27;extraits"'));
  });
  it("Ignorés : phrase en clair, jamais le code", () => {
    const f = fiche("v1", [plage("a", { note: 70 })], { noteVersion: "1", ignores: { nombre: 3, raisonPrincipale: "phrase-creuse" } });
    const h = rendre({ fiches: [f], note: {} });
    expect(h).not.toContain("phrase-creuse");
    // L'onglet « Ignorés » est monté par ExtraitsGardes ; on le rend ici directement, onglet forcé.
    return import("react").then(async (R) => {
      const { ExtraitsGardes } = await import("@/components/bibliotheque/ExtraitsGardes");
      const etat = vi.spyOn(R, "useState");
      etat.mockImplementationOnce(() => ["ignores", () => {}] as never);
      const ign = renderToStaticMarkup(createElement(ExtraitsGardes, { fiches: [f], titres: { v1: "Ma vidéo" }, noteActive: true }));
      etat.mockRestore();
      expect(ign).toContain("3 passages ignorés, surtout : phrase d&#x27;ouverture ou de fin");
      expect(ign).not.toContain("phrase-creuse");
    });
  });
  it("filtre Générateur : libellé du format quand `generateurs` est fourni ; sinon titre de la vidéo", () => {
    const deux = [notee, fiche("v2", [plage("c", { note: 90 })], { noteVersion: "1" })];
    const titres = { v1: "Vidéo un", v2: "Vidéo deux" };
    const avec = rendre({ fiches: deux, titres, note: { generateurs: { v1: "Capture d'écran", v2: "Capture d'écran" } } });
    expect(avec.match(/<option value="Capture d&#x27;écran">/g)).toHaveLength(1);
    expect(avec).not.toContain('<option value="v1">');
    const sans = rendre({ fiches: deux, titres, note: {} });
    expect(sans).toContain('<option value="v1">Vidéo un</option>');
  });
  it("filtre Réseau : absent sans `reseaux`, présent avec", () => {
    expect(rendre({ fiches: [notee], note: {} })).not.toContain("Réseau");
    const h = rendre({ fiches: [notee], note: { reseaux: { v1: "LinkedIn" } } });
    expect(h).toContain("Réseau");
    expect(h).toContain('<option value="LinkedIn">LinkedIn</option>');
  });
});

describe("branche client", () => {
  const monter = () => {
    espion = true;
    proprietes = {};
    renderToStaticMarkup(
      createElement(EcranSourcesExtraitsBranche, { fiches: [notee], titres: { v1: "Ma vidéo" }, inscriptionActive: true, politique: "publiees", cochees: [], note: { seuils: undefined } }),
    );
    espion = false;
    return proprietes.note as Record<string, (...a: unknown[]) => void>;
  };
  it("les 3 gestes appellent les actions de la note", async () => {
    const n = monter();
    n.surGarderQuandMeme("v1", "b");
    n.surChiffresReels("v1", true);
    n.surChangerSujet("v1", "a", "interface");
    await new Promise((r) => setTimeout(r, 0));
    expect(garderQuandMemeAction).toHaveBeenCalledExactlyOnceWith("v1", "b");
    expect(marquerChiffresReelsAction).toHaveBeenCalledExactlyOnceWith("v1", true);
    expect(changerSujetAction).toHaveBeenCalledExactlyOnceWith("v1", "a", "interface");
  });
  it("« Ne plus proposer » = surEcarter → ecarterPlageAction", async () => {
    monter();
    (proprietes.surEcarter as (v: string, p: string) => void)("v1", "a");
    await new Promise((r) => setTimeout(r, 0));
    expect(ecarterPlageAction).toHaveBeenCalledExactlyOnceWith("v1", "a");
  });
});
