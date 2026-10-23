/** LOT C3 · service de la mémoire centrale : réglage COUPÉ par défaut, enregistrement (fenêtre 60), échecs silencieux. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/memoire-centrale");
const mem = await import("@/services/memoire-ecriture");
await import("@/services/cas-concret-scripts");

beforeEach(() => reinitialiserDepots());
const allumer = () => ecrireParametre(svc.REGLAGE_MEMOIRE_CENTRALE, true);
const TEXTE = "Chaque lundi matin votre équipe recopie les mêmes factures dans trois tableaux différents sans jamais se tromper";

describe("réglage coupé par défaut", () => {
  it("coupé : rien n'est préparé ni enregistré", async () => {
    expect(await svc.memoireCentraleAllumee()).toBe(false);
    expect(await svc.preparerMemoireCentrale({ formatId: "tableau-anime" })).toBeNull();
    await svc.enregistrerScriptCentral({ texte: TEXTE, formatId: "tableau-anime" });
    expect(await mem.scriptsCentraux()).toEqual([]);
  });
  it("seul `true` exact allume", async () => {
    await ecrireParametre(svc.REGLAGE_MEMOIRE_CENTRALE, "oui");
    expect(await svc.memoireCentraleAllumee()).toBe(false);
  });
});

describe("allumé", () => {
  it("un script enregistré revient dans la mémoire (bloc, anciens, appels récents)", async () => {
    await allumer();
    await svc.enregistrerScriptCentral({ texte: TEXTE, formatId: "tableau-anime", appels: ["FIN-1"] });
    const m = await svc.preparerMemoireCentrale({ formatId: "tableau-anime" });
    expect(m).not.toBeNull();
    expect(m!.anciens.some((a) => a.includes("recopie les mêmes factures"))).toBe(true);
    expect(m!.bloc).toContain("recopie");
    expect(m!.appelsRecents).toEqual(["FIN-1"]);
  });
  it("garde 60 versions au plus, les plus récentes", async () => {
    await allumer();
    for (let i = 0; i < 65; i++) await svc.enregistrerScriptCentral({ texte: `script numéro ${i} différent`, formatId: "tableau-anime" });
    const l = await mem.scriptsCentraux();
    expect(l).toHaveLength(60);
    expect(l.at(-1)!.texte).toBe("script numéro 64 différent");
  });
  it("l'avocat n'est jamais enregistré ni lu ; un script de Will non plus", async () => {
    await allumer();
    await svc.enregistrerScriptCentral({ texte: TEXTE, formatId: "avocat" });
    await svc.enregistrerScriptCentral({ texte: TEXTE, formatId: "tableau-anime", origine: "will" });
    expect(await mem.scriptsCentraux()).toEqual([]);
    expect(await svc.preparerMemoireCentrale({ formatId: "avocat" })).toBeNull();
    expect(await svc.preparerMemoireCentrale({ formatId: "tableau-anime", origine: "will" })).toBeNull();
  });
  it("la phrase de fin de la banque, présente sur plusieurs scripts gardés, n'entre pas dans le bloc « à ne pas redire »", async () => {
    await allumer();
    const { BANQUE_APPELS } = await import("@/briques/fins/banque");
    const fin = BANQUE_APPELS.find((a) => a.etat === "valide" && !a.dit.includes("{") && a.dit.split(/\s+/).length >= 6)!.dit;
    const sujets = ["les devis du lundi", "les relances de factures", "le planning des chantiers", "les mails des fournisseurs"];
    for (const [i, x] of sujets.entries()) await svc.enregistrerScriptCentral({ texte: `Histoire numéro ${i} : ${x} prennent trois heures chaque semaine à une petite équipe fatiguée. ${fin}`, formatId: "tableau-anime" });
    const m = await svc.preparerMemoireCentrale({ formatId: "tableau-anime" });
    expect(m).not.toBeNull();
    expect(m!.bloc).not.toContain(fin.split(/\s+/).slice(0, 5).join(" "));
  });
  it("échec de la base : silencieux (null / rien), jamais d'exception", async () => {
    await allumer();
    const { depots } = await import("@/donnees/memoire");
    const espion = vi.spyOn(depots().variantes, "lister").mockRejectedValue(new Error("base indisponible"));
    const bruit = vi.spyOn(console, "error").mockImplementation(() => undefined);
    espion.mockRestore();
    // la panne doit toucher la lecture elle-même (hors du rattrapage de `entreesMemoire`) : on rend « pas de mémoire »
    const lecture = vi.spyOn(mem, "memoireEcriture").mockRejectedValue(new Error("base indisponible"));
    expect(await svc.preparerMemoireCentrale({ formatId: "tableau-anime" })).toBeNull();
    lecture.mockRestore();
    const p = vi.spyOn(await import("@/services/_commun"), "ecrireParametre").mockRejectedValue(new Error("base indisponible"));
    await expect(svc.enregistrerScriptCentral({ texte: TEXTE, formatId: "tableau-anime" })).resolves.toBeUndefined();
    p.mockRestore();
    bruit.mockRestore();
  });
});
