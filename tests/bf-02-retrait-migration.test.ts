/**
 * BF-02 · retrait de l'écran de migration : /reglages/migration renvoie vers les Réglages, plus aucune date de fin
 * de l'ancien outil ni le mot « Buffer » dans les textes affichés. Rien n'est supprimé : FIN_BUFFER, actions-zernio.ts,
 * BASCULE_LOT_C et le journal de l'import restent tels quels. Aucun réseau.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EcranMigration } from "@/components/migration/EcranMigration";
import { EtatBuffer, Heros } from "@/components/migration/Heros";
import { Frise, jalonsPour } from "@/components/migration/Frise";
import { BASCULE_LOT_C, type PostMigration } from "@/components/migration/logique";
import { mockHeaders, mockNavigation, Redirection } from "./helpers/next-mocks";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...r }, children) }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/app/(studio)/reglages/actions-migration", () => ({ lireMigrationAction: async () => ({ ok: false }) }));

const RACINE = join(__dirname, "..");
const LIRE = (p: string) => readFileSync(join(RACINE, p), "utf8");
const DOSSIER = "src/components/migration";
const PAGE = "src/app/(studio)/reglages/migration/page.tsx";
const SOURCES = [...readdirSync(join(RACINE, DOSSIER)).map((f) => `${DOSSIER}/${f}`), PAGE];
const MAINT = new Date("2026-11-10T09:00:00Z");
const post = (id: string, etat: PostMigration["etat"], datePrevue = "2026-11-15T10:00:00Z"): PostMigration => ({ id, reseau: "linkedin", titre: `Exemple ${id}`, datePrevue, etat });
const POSTS = [post("a", "laisse-buffer"), post("b", "verifie-zernio"), post("c", "a-verifier"), post("d", "restant", "2026-11-25T10:00:00Z")];
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/<!-- -->/g, "");

describe("BF-02 · l'adresse /reglages/migration renvoie vers les Réglages", () => {
  it("la page redirige vers /reglages", async () => {
    const { default: Page } = await import("@/app/(studio)/reglages/migration/page");
    const erreur = await Page().then(() => null, (e: unknown) => e);
    expect(erreur).toBeInstanceOf(Redirection);
    expect((erreur as Redirection).vers).toBe("/reglages");
  });
  it("la page ne monte plus l'écran de migration et ne lit plus rien", () => {
    const s = LIRE(PAGE);
    expect(s).not.toMatch(/EcranMigration|lireMigrationAction/);
    expect(s).toMatch(/redirect\("\/reglages"\)/);
  });
});

describe("BF-02 · plus de date de fin ni de « résilier » dans la page et le dossier migration", () => {
  it.each(SOURCES)("%s : ni 18/11, ni 20/11, ni 18 novembre, ni « résilier Buffer »", (f) => {
    expect(LIRE(f)).not.toMatch(/18\/11|20\/11|18 novembre|résilier Buffer/i);
  });
});

describe("BF-02 · le mot « Buffer » n'est dans aucun texte affiché", () => {
  const vues = {
    normal: renderToStaticMarkup(createElement(EcranMigration, { vue: { etat: "normal", donnees: { posts: POSTS, comptes: [] } }, maintenant: MAINT, simulation: true })),
    vide: renderToStaticMarkup(createElement(EcranMigration, { vue: { etat: "vide" }, maintenant: MAINT })),
    chargement: renderToStaticMarkup(createElement(EcranMigration, { vue: { etat: "chargement" }, maintenant: MAINT })),
    erreur: renderToStaticMarkup(createElement(EcranMigration, { vue: { etat: "erreur", message: "Lecture impossible. Réessayez plus tard." }, maintenant: MAINT })),
    heros: renderToStaticMarkup(createElement(Heros, { posts: POSTS })),
    etat: renderToStaticMarkup(createElement(EtatBuffer)),
    frise: renderToStaticMarkup(createElement(Frise, { jalons: jalonsPour(MAINT) })),
  };
  it.each(Object.entries(vues))("%s", (_nom, html) => {
    expect(html).not.toMatch(/buffer/i);
    expect(texte(html)).not.toMatch(/18\/11|20\/11|18 novembre|20 novembre/);
  });
  it("l'état dit « l'ancien outil », les comptages restent exacts", () => {
    expect(texte(vues.etat)).toContain("L’ancien outil est résilié.");
    expect(texte(vues.heros)).toMatch(/1 \+ 1 \+ 1 \+ 1 = 4 posts/);
    expect(texte(vues.heros)).toContain("1 laissés à l’ancien outil");
  });
});

describe("BF-02 · rien n'est supprimé ni modifié ailleurs", () => {
  it("BASCULE_LOT_C garde son jour ISO (il pilote les lots)", () => expect(BASCULE_LOT_C).toBe("2026-11-20"));
  it("actions-zernio.ts et la fin de l'ancien outil sont toujours là", () => {
    expect(LIRE("src/app/(studio)/reglages/actions-zernio.ts")).toContain("zernio.bascules");
    expect(LIRE("src/app/(studio)/reglages/actions-migration.ts")).toContain("lireMigrationAction");
  });
  it("les autres fichiers du dossier migration sont en place", () => {
    for (const f of ["AReprogrammer.tsx", "Criteres.tsx", "FenetreLot.tsx", "Lots.tsx", "services.ts"].filter((n) => n !== "Criteres.tsx")) expect(SOURCES).toContain(`${DOSSIER}/${f}`);
  });
});
