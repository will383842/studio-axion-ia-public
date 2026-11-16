/**
 * INF-01 : écrans de l'infographie (créer, voir l'aperçu, valider). Aucun appel réel : tout est simulé.
 * Les critères : trois écrans sans prix, brouillon tant que « Valider » n'est pas cliqué, bandeau vouvoyé si le générateur est éteint.
 */
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
const appels: string[] = [];
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => { appels.push("session"); }) }));
vi.mock("@/services/_commun", () => ({
  lireParametre: vi.fn(async (id: string, defaut: unknown) => (magasin.has(id) ? magasin.get(id) : defaut)),
  ecrireParametre: vi.fn(async (id: string, v: unknown) => { magasin.set(id, v); }),
  journaliser: vi.fn(async () => {}),
  sousVerrou: vi.fn(async (f: () => Promise<unknown>) => f()),
  maintenant: vi.fn(() => "2026-12-05T10:00:00.000Z"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((chemin: string) => { throw Object.assign(new Error("REDIRECTION"), { chemin }); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

const DOSSIER = "src/app/(studio)/infographies";
const SOURCES = [`${DOSSIER}/page.tsx`, `${DOSSIER}/nouvelle/page.tsx`, `${DOSSIER}/[id]/page.tsx`, `${DOSSIER}/actions.ts`, "src/components/visuels/FicheInfographie.tsx"];

function formulaire(champs: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
async function redirige(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as { chemin?: string }).chemin ?? "";
  }
  return "";
}
const BON = { titre: "Trois e-mails sur quatre se trient sans vous", points: "Un tri chaque matin\nLes messages utiles remontent\nLes relances partent à temps", style: "liste", reseau: ["linkedin", "instagram"] };

beforeEach(() => {
  magasin.clear();
  appels.length = 0;
});

describe("INF-01 : fichiers et garde", () => {
  it("les six fichiers autorisés existent", () => {
    for (const f of SOURCES) expect(existsSync(f), f).toBe(true);
    expect(existsSync("tests/visuels/inf-01-ecran-infographie.test.tsx")).toBe(true);
  });
  it("aucun prix, aucun envoi, aucun rendu payant dans les écrans", () => {
    for (const f of SOURCES.filter(existsSync)) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/produireInfographie|executerRendu|zernio|buffer|programmerEnUnClic|publications|reserver\(/i);
      expect(s, f).not.toMatch(/€|\bprix\b|\bcoût\b|\bcout\b|crédit|tarif/i);
    }
  });
  it("chaque action serveur commence par exigerSession", () => {
    const s = readFileSync(`${DOSSIER}/actions.ts`, "utf8");
    expect(s.trimStart().startsWith('"use server"')).toBe(true);
    const corps = s.split(/export\s+async\s+function/).slice(1);
    expect(corps.length).toBeGreaterThanOrEqual(2);
    for (const c of corps) expect(c.slice(c.indexOf("{")).trimStart().slice(1).trimStart().startsWith("await exigerSession()"), c.slice(0, 40)).toBe(true);
  });
});

describe("INF-01 : composants", () => {
  it("le formulaire demande un titre, des points clés, un style, des réseaux", async () => {
    const { FormulaireInfographie } = await import("@/components/visuels/FicheInfographie");
    const html = renderToStaticMarkup(createElement(FormulaireInfographie, { creer: async () => ({}), allume: true }));
    expect(html).toContain("Titre");
    expect(html).toContain("Points clés");
    expect(html).toContain("Liste numérotée");
    expect(html).toContain("LinkedIn");
    expect(html).toContain("Créer l&#x27;infographie");
    expect(html).not.toContain("éteint");
  });
  it("générateur éteint : un bandeau vouvoyé l'explique", async () => {
    const { BandeauInfographieEteint } = await import("@/components/visuels/FicheInfographie");
    const html = renderToStaticMarkup(createElement(BandeauInfographieEteint));
    expect(html).toContain("éteint");
    expect(html).toMatch(/Vous|votre|vos/);
    expect(html).not.toMatch(/\btu\b|\bton\b|\bta\b/i);
    expect(html).toContain("/reglages/carrousels");
  });
  it("la fiche en brouillon montre l'aperçu et « Valider » ; validée, plus de bouton", async () => {
    const { FicheInfographieValidation } = await import("@/components/visuels/FicheInfographie");
    const fiche = { id: "inf_1", titre: "Mon titre", points: ["a", "b", "c"], style: "liste" as const, reseaux: ["linkedin" as const], statut: "brouillon" as const, creeLe: "x", modifieLe: "x" };
    const brouillon = renderToStaticMarkup(createElement(FicheInfographieValidation, { fiche, valider: async () => {} }));
    expect(brouillon).toContain("Mon titre");
    expect(brouillon).toContain("Brouillon");
    expect(brouillon).toContain("Valider");
    expect(brouillon).toMatch(/ni programmée ni envoyée|rien n.est programmé/i);
    const validee = renderToStaticMarkup(createElement(FicheInfographieValidation, { fiche: { ...fiche, statut: "valide", valideLe: "y" }, valider: async () => {} }));
    expect(validee).toContain("Validée");
    expect(validee).not.toContain(">Valider<");
  });
});

describe("INF-01 : actions", () => {
  it("créer : un brouillon est gardé, l'écran d'aperçu s'ouvre, aucun rendu ni envoi", async () => {
    const { creerInfographieAction } = await import("@/app/(studio)/infographies/actions");
    const chemin = await redirige(creerInfographieAction({}, formulaire(BON)));
    expect(chemin).toMatch(/^\/infographies\/inf_/);
    const id = decodeURIComponent(chemin.split("/").pop()!);
    const fiche = magasin.get(`infographies.fiche.${id}`) as { statut: string; points: string[]; reseaux: string[]; valideLe?: string };
    expect(fiche.statut).toBe("brouillon");
    expect(fiche.valideLe).toBeUndefined();
    expect(fiche.points).toHaveLength(3);
    expect(fiche.reseaux).toEqual(["linkedin", "instagram"]);
    expect(appels).toContain("session");
  });
  it("créer avec moins de trois points : phrase d'erreur, rien n'est gardé", async () => {
    const { creerInfographieAction } = await import("@/app/(studio)/infographies/actions");
    const etat = await creerInfographieAction({}, formulaire({ ...BON, points: "Un seul point" }));
    expect(etat.erreur).toMatch(/trois/);
    expect([...magasin.keys()].filter((k) => k.startsWith("infographies."))).toHaveLength(0);
  });
  it("créer avec un lien : refusé", async () => {
    const { creerInfographieAction } = await import("@/app/(studio)/infographies/actions");
    const etat = await creerInfographieAction({}, formulaire({ ...BON, points: "a\nb\nvoir https://exemple.fr" }));
    expect(etat.erreur).toBeTruthy();
    expect(magasin.size).toBe(0);
  });
  it("valider : le brouillon devient validé, sans rien programmer ni envoyer", async () => {
    const { creerInfographieAction, validerInfographieAction } = await import("@/app/(studio)/infographies/actions");
    const chemin = await redirige(creerInfographieAction({}, formulaire(BON)));
    const id = decodeURIComponent(chemin.split("/").pop()!);
    expect((magasin.get(`infographies.fiche.${id}`) as { statut: string }).statut).toBe("brouillon");
    await redirige(validerInfographieAction(formulaire({ id })));
    const apres = magasin.get(`infographies.fiche.${id}`) as { statut: string; valideLe?: string };
    expect(apres.statut).toBe("valide");
    expect(apres.valideLe).toBe("2026-12-05T10:00:00.000Z");
    expect([...magasin.keys()].some((k) => /programm|publi|envoi/i.test(k))).toBe(false);
  });
  it("valider un identifiant inconnu ou mal formé : rien n'est écrit", async () => {
    const { validerInfographieAction } = await import("@/app/(studio)/infographies/actions");
    await redirige(validerInfographieAction(formulaire({ id: "../x" })));
    await redirige(validerInfographieAction(formulaire({ id: "inf_inconnu" })));
    expect(magasin.size).toBe(0);
  });
});
