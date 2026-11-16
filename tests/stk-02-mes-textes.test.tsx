/**
 * STK-02 : onglet « Mes textes » dans /ecrire et geste « Mettre en stock » (idée, script).
 * Dépôt mémoire, services doublés, aucun réseau, aucune clé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const revalider = vi.fn();
const exigerSession = vi.fn(async () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalider(p) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/ecrire", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/services/auth", () => ({ exigerSession: () => exigerSession() }));
vi.mock("@/services/series", () => ({ listerSeries: async () => [] }));
vi.mock("@/services/generation-claude", () => ({ claudeBranche: async () => false }));
vi.mock("@/services/contexte-axion", () => ({ lireContexte: async () => ({}), lireInterdits: async () => [], proposerExpressions: async () => [] }));
vi.mock("@/services/matieres", () => ({ lireJauge: async () => ({}), lireRappelHebdo: async () => ({ actif: false }), listerMatieres: async () => [] }));
vi.mock("@/services/preuves", () => ({ listerPreuves: async () => [] }));
vi.mock("@/services/voix", () => ({ fileAValider: async () => [], lireFicheStyle: async () => ({}), listerReglesDatees: async () => [], listerTextesWill: async () => [], listerTournures: async () => [] }));
vi.mock("@/services/generateur", () => ({ listerSujets: async () => [], valeursFiltresGenerateur: async () => ({ piliers: [], series: [] }) }));
vi.mock("@/services/idees", () => ({ listerIdees: async () => [{ id: "i1", texte: "Idée du jour", etat: "nouvelle", creeLe: "2026-11-10T08:00:00Z" }] }));
vi.mock("@/services/scripts", () => ({ listerScripts: async () => [] }));
vi.mock("@/services/usine-porte", () => ({ usineActive: () => false }));
vi.mock("@/services/serie-ecriture", () => ({ suiviSerie: async () => null }));

const { depots } = await import("@/services/_commun");
const { creerEntreeStock, estActif, archiverMessage } = await import("@/domaine/stock-messages");
const { default: Page } = await import("../src/app/(studio)/ecrire/page");
const actions = await import("../src/app/(studio)/ecrire/stock/actions");
const { mettreEnStock, elementMettreEnStock } = await import("../src/components/ecrire/BoutonMettreEnStock");

const rendre = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
const lire = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

async function viderStock() {
  for (const m of await depots().stockMessages.lister()) await depots().stockMessages.supprimer?.(m.id);
}
const entree = (id: string, texte: string) => creerEntreeStock({ id, texte, reseaux: ["linkedin"], priorite: "normale" }, "2026-11-12T08:00:00Z");

beforeEach(async () => {
  revalider.mockClear();
  exigerSession.mockClear();
  await viderStock();
});

describe("STK-02 : onglet « Mes textes »", () => {
  it("?onglet=mes-textes montre l'onglet en 5e position et les entrées actives seulement", async () => {
    await depots().stockMessages.enregistrer(entree("a", "Texte actif A"));
    await depots().stockMessages.enregistrer(archiverMessage(entree("b", "Texte archivé B"), "2026-11-13T00:00:00Z"));
    expect([entree("a", "x"), archiverMessage(entree("b", "y"), "z")].filter(estActif)).toHaveLength(1);
    const h = await rendre({ onglet: "mes-textes" });
    expect(h).toContain("Texte actif A");
    expect(h).not.toContain("Texte archivé B");
    const libelles = [...h.matchAll(/role="tab"[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]*>/g, ""));
    expect(libelles.map((l) => l.replace(/\d+$/, ""))).toEqual(["Scripts", "Idées", "Matières", "Ma voix", "Mes textes"]);
  });

  it("aucun texte visible ni aria-label de l'onglet ne contient « stock » ; « En stock » devient « À placer »", async () => {
    await depots().stockMessages.enregistrer(entree("a", "Texte actif A"));
    const h = await rendre({ onglet: "mes-textes" });
    const panneau = h.slice(h.indexOf('role="tabpanel"'));
    const visible = panneau.replace(/<[^>]*>/g, " ");
    expect(visible).not.toMatch(/stock/i);
    expect([...h.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join("|")).not.toMatch(/stock/i);
    expect(visible).toContain("À placer");
    expect(visible).toContain("Planifié");
    expect(visible).toContain("Publié");
  });

  it("n'utilise jamais la valeur d'URL « textes » pour l'onglet", async () => {
    const h = await rendre({ onglet: "mes-textes" });
    expect(h).not.toMatch(/value="textes"/);
    expect(lire("src/app/(studio)/ecrire/page.tsx")).toContain('"mes-textes"');
  });
});

describe("STK-02 : geste « Mettre en stock »", () => {
  it("crée une entrée avec le texte donné ; le rejeu de la même clé n'en crée pas une deuxième", async () => {
    const r1 = await mettreEnStock("Une idée à garder", "cle-1");
    const r2 = await mettreEnStock("Une idée à garder", "cle-1");
    expect(r1.ok && r2.ok).toBe(true);
    const liste = await depots().stockMessages.lister();
    expect(liste).toHaveLength(1);
    expect(liste[0].texte).toBe("Une idée à garder");
  });

  it("est branché dans le menu des idées et sur la fiche d'un script", () => {
    expect(lire("src/components/ecrire/OngletIdees.tsx")).toMatch(/elementMettreEnStock\(i\.texte, `idee-\$\{i\.id\}`\)/);
    expect(lire("src/components/ecrire/FicheScript.tsx")).toMatch(/elementMettreEnStock\(texteScript\(script\.blocs\), `script-\$\{script\.id\}`\)/);
    expect(elementMettreEnStock("Un texte", "idee-1")).toMatchObject({ libelle: "Mettre en stock" });
  });

  it("ne déplace ni n'archive : l'idée reste dans « Idées », l'entrée n'apparaît pas dans « Idées »", async () => {
    await mettreEnStock("Idée du jour", "cle-2");
    const idees = await rendre({ onglet: "idees" });
    expect(idees).toContain("Idée du jour");
    const stock = await depots().stockMessages.lister();
    expect(stock.every((m) => !m.archiveLe)).toBe(true);
    expect(stock).toHaveLength(1);
    expect(idees).not.toContain(stock[0].id);
  });
});

describe("STK-02 : texte modifié, archivé ou planifié", () => {
  it("un texte modifié remis en stock depuis la même source crée une nouvelle entrée", async () => {
    const r1 = await mettreEnStock("Premier jet", "script-s1");
    const r2 = await mettreEnStock("Premier jet corrigé", "script-s1");
    expect(r1.ok && r2.ok).toBe(true);
    expect(await depots().stockMessages.lister()).toHaveLength(2);
  });

  it("un texte déjà archivé ou planifié ne renvoie pas de faux succès", async () => {
    const r = await mettreEnStock("Texte placé", "idee-i9");
    const id = r.ok ? r.donnees.id : "";
    await actions.archiverEntreeStockAction(id);
    const r2 = await mettreEnStock("Texte placé", "idee-i9");
    expect(r2).toEqual(expect.objectContaining({ ok: false, message: "Ce texte est déjà placé ou archivé." }));
    const p = await mettreEnStock("Texte planifié", "idee-i10");
    await actions.planifierEntreeStockAction(p.ok ? p.donnees.id : "", "creneau-1");
    const p2 = await mettreEnStock("Texte planifié", "idee-i10");
    expect(p2.ok).toBe(false);
  });

  it("les filtres « Planifié » et « Publié » montrent les entrées planifiées ; les archivées restent cachées", async () => {
    const a = await mettreEnStock("Texte à planifier", "idee-i11");
    await actions.planifierEntreeStockAction(a.ok ? a.donnees.id : "", "creneau-1");
    const b = await mettreEnStock("Texte à archiver", "idee-i12");
    await actions.archiverEntreeStockAction(b.ok ? b.donnees.id : "");
    const h = await rendre({ onglet: "mes-textes" });
    expect(h).not.toContain("Texte archivé");
    expect(h).not.toContain("Texte à archiver");
  });
});

describe("STK-02 : actions du stock", () => {
  it("chaque action commence par exigerSession() et invalide /ecrire", async () => {
    const c = await actions.creerEntreeStockAction({ texte: "Un texte", reseaux: ["linkedin"], priorite: "normale", cle: "k1" });
    expect(c.ok).toBe(true);
    const id = c.ok ? c.donnees.id : "";
    await actions.planifierEntreeStockAction(id, "creneau-1");
    await actions.archiverEntreeStockAction(id);
    expect(exigerSession).toHaveBeenCalledTimes(3);
    expect(revalider.mock.calls.filter(([p]) => p === "/ecrire")).toHaveLength(3);
    const src = lire("src/app/(studio)/ecrire/stock/actions.ts");
    expect(src.match(/export async function/g)).toHaveLength(3);
    expect(src.match(/\{\n  await exigerSession\(\);/g)).toHaveLength(3);
  });
});
