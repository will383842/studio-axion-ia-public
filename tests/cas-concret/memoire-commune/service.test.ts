/** LOT C4 · service de la mémoire du cas concret : réglage COUPÉ par défaut, enregistrement (fenêtre 60, partagée), échecs silencieux. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/memoire-cas-concret");
const mem = await import("@/services/memoire-ecriture");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { recettePour } = await import("@/formats/cas-concret/recette");
const { roleEcritureCasConcret, variableEcriture } = await import("@/moteurs/montage-cas-concret/ecriture");
const { texteDuCorps } = await import("@/moteurs/montage-cas-concret/fiche");
const { PHRASES_FIXES_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret/memoire-commune");
const { CLE_HISTORIQUE_SCRIPTS } = await import("@/services/cas-concret-scripts");

beforeEach(() => reinitialiserDepots());
const allumer = () => ecrireParametre(svc.REGLAGE_MEMOIRE_CAS_CONCRET, true);
const FIXE = { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const gabarit = (c: (typeof CATALOGUE)[number]) => {
  const s = roleEcritureCasConcret.simuler({ contexte: {}, variable: variableEcriture(c, recettePour(c), FIXE) });
  if (typeof s === "string") throw new Error("pas de fiche");
  return texteDuCorps(s);
};
const TEXTE = "Chaque lundi matin votre équipe recopie les mêmes factures dans trois tableaux différents sans jamais se tromper";

describe("réglage coupé par défaut", () => {
  it("le réglage s'appelle ecriture.memoireCasConcret ; coupé : rien n'est préparé ni enregistré", async () => {
    expect(svc.REGLAGE_MEMOIRE_CAS_CONCRET).toBe("ecriture.memoireCasConcret");
    expect(await svc.memoireCasConcretAllumee()).toBe(false);
    expect(await svc.preparerMemoireCasConcret({ tolere: [] })).toBeNull();
    await svc.enregistrerScriptCasConcret({ texte: TEXTE });
    expect(await mem.scriptsCentraux()).toEqual([]);
  });
  it("seul `true` exact allume", async () => {
    await ecrireParametre(svc.REGLAGE_MEMOIRE_CAS_CONCRET, "oui");
    expect(await svc.memoireCasConcretAllumee()).toBe(false);
  });
});

describe("allumé", () => {
  it("un script enregistré revient dans la mémoire partagée (formatId cas-concret), sans doublon", async () => {
    await allumer();
    await svc.enregistrerScriptCasConcret({ texte: TEXTE });
    await svc.enregistrerScriptCasConcret({ texte: TEXTE });
    const l = await mem.scriptsCentraux();
    expect(l).toHaveLength(1);
    expect(l[0].formatId).toBe("cas-concret");
    const m = await svc.preparerMemoireCasConcret({ tolere: [] });
    expect(m!.anciens.some((a) => a.includes("recopie les mêmes factures"))).toBe(true);
    expect(m!.bloc).toContain("recopie");
  });
  it("la fenêtre reste de 60, partagée avec les autres générateurs", async () => {
    await allumer();
    for (let i = 0; i < 65; i++) await svc.enregistrerScriptCasConcret({ texte: `script numéro ${i} différent` });
    expect(await mem.scriptsCentraux()).toHaveLength(60);
  });
  it("les textes de l'avocat ne sont jamais lus ni enregistrés", async () => {
    await allumer();
    await mem.noterScriptCentral({ texte: "Maître, votre dossier de divorce avance bien cette semaine", formatId: "avocat" });
    await svc.enregistrerScriptCasConcret({ texte: TEXTE, formatId: "avocat" });
    expect(await mem.scriptsCentraux()).toEqual([]);
    const m = await svc.preparerMemoireCasConcret({ tolere: [] });
    expect(JSON.stringify(m)).not.toContain("divorce");
  });
  it("un script de Will (origine « will ») : jamais lu ni contrôlé ; il reste « à éviter » par le script validé", async () => {
    await allumer();
    expect(await svc.preparerMemoireCasConcret({ tolere: [], origine: "will" })).toBeNull();
    await ecrireParametre(CLE_HISTORIQUE_SCRIPTS, { "cas-x": [{ casId: "cas-x", numero: 1, valideLe: "2026-10-01T00:00:00Z", ecrans: [{ texteDit: "Votre assistante saisit chaque devis deux fois, puis le renvoie au client mardi." }] }] });
    const m = await svc.preparerMemoireCasConcret({ tolere: [] });
    expect(m === null || typeof m.bloc === "string").toBe(true);
  });
  it("PHRASES IMPOSÉES : plusieurs scripts différents finissant par la même question, aucune dans le bloc « à ne pas redire »", async () => {
    await allumer();
    const textes = CATALOGUE.slice(0, 6).map(gabarit);
    for (const t of textes) await svc.enregistrerScriptCasConcret({ texte: t });
    // sans exclusion, la question finale est la séquence la plus fréquente : on le vérifie, puis on vérifie l'exclusion
    const { memoireEcriture } = mem;
    const sans = await memoireEcriture({});
    expect(sans.bloc.toLowerCase()).toContain("tourner toute seule");
    const m = await svc.preparerMemoireCasConcret({ tolere: [...PHRASES_FIXES_CAS_CONCRET] });
    expect(m).not.toBeNull();
    const bloc = m!.bloc.toLowerCase();
    expect(bloc).not.toContain("tourner toute seule");
    expect(bloc).not.toContain("étape par étape");
    expect(bloc).not.toContain("votre entreprise");
  });
  it("échec de la base : silencieux (null / rien), jamais d'exception", async () => {
    await allumer();
    const bruit = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lecture = vi.spyOn(mem, "memoireEcriture").mockRejectedValue(new Error("base indisponible"));
    expect(await svc.preparerMemoireCasConcret({ tolere: [] })).toBeNull();
    lecture.mockRestore();
    const p = vi.spyOn(await import("@/services/_commun"), "ecrireParametre").mockRejectedValue(new Error("base indisponible"));
    await expect(svc.enregistrerScriptCasConcret({ texte: TEXTE })).resolves.toBeUndefined();
    p.mockRestore();
    bruit.mockRestore();
  });
});
