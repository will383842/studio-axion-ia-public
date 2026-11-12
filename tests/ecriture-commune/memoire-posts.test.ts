/** L3-13 · mémoire anti-copie des posts et commentaires : 6 mots d'affilée = alerte, ajout atomique, mémoire coupée = rien ne change. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { FORMATS_POSTS, formatPostApplicable, ajouterEntree, alertePost, TAILLE_ALERTE_POST } from "@/domaine/ecriture-commune/memoire-posts";
import { reprisesDAffilee } from "@/domaine/proximite-textes";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/memoire-centrale");
const mem = await import("@/services/memoire-ecriture");

const ANCIEN = "Chaque lundi matin votre équipe recopie les mêmes factures dans trois tableaux différents";
const REPRIS = "Franchement, chaque lundi matin votre équipe recopie les mêmes tableaux pour rien";
const NEUF = "Un robot lit la boîte de réception et range les pièces jointes toutes seules";

beforeEach(() => reinitialiserDepots());

describe("domaine", () => {
  it("formats post et commentaire", () => {
    expect(FORMATS_POSTS).toEqual(["post", "commentaire"]);
    expect(formatPostApplicable("post")).toBe(true);
    expect(formatPostApplicable("commentaire")).toBe(true);
    expect(formatPostApplicable("avocat")).toBe(false);
    expect(formatPostApplicable("post", "code")).toBe(true);
  });
  it("6 mots d'affilée repris = alerte", () => {
    expect(TAILLE_ALERTE_POST).toBe(6);
    expect(reprisesDAffilee(REPRIS, [ANCIEN]).length).toBeGreaterThan(0);
    expect(alertePost(REPRIS, [ANCIEN]).alerte).toBe(true);
  });
  it("5 mots ne suffisent pas, un texte neuf non plus", () => {
    expect(alertePost("Chaque lundi matin votre équipe change tout", [ANCIEN]).alerte).toBe(false);
    expect(alertePost(NEUF, [ANCIEN]).alerte).toBe(false);
    expect(alertePost(REPRIS, []).alerte).toBe(false);
  });
  it("ajouterEntree est pur et garde la fenêtre", () => {
    const l = [{ texte: "a b", formatId: "post", date: "d" }];
    const n = ajouterEntree(l, { texte: "c d", formatId: "post", date: "e" }, 1);
    expect(l).toHaveLength(1);
    expect(n.map((x) => x.texte)).toEqual(["c d"]);
  });
});

describe("service", () => {
  it("deux écritures simultanées gardent les deux entrées", async () => {
    await ecrireParametre(svc.REGLAGE_MEMOIRE_CENTRALE, true);
    await Promise.all([
      svc.enregistrerPost({ texte: "Premier post sur les factures du lundi", formatId: "post" }),
      svc.enregistrerPost({ texte: "Second commentaire sur les relances de devis", formatId: "commentaire" }),
    ]);
    expect((await mem.postsMemorises()).map((x) => x.formatId).sort()).toEqual(["commentaire", "post"]);
  });
  it("allumé : un post repris donne une alerte, le texte reste intact", async () => {
    await ecrireParametre(svc.REGLAGE_MEMOIRE_CENTRALE, true);
    await svc.enregistrerPost({ texte: ANCIEN, formatId: "post" });
    const r = await svc.controlerPost({ texte: REPRIS, formatId: "commentaire" });
    expect(r.alerte).toBe(true);
    expect(r.texte).toBe(REPRIS);
  });
  it("mémoire coupée : rien enregistré, aucune alerte, sortie inchangée", async () => {
    await svc.enregistrerPost({ texte: ANCIEN, formatId: "post" });
    expect(await mem.postsMemorises()).toEqual([]);
    await ecrireParametre(mem.CLE_POSTS_MEMOIRE, [{ texte: ANCIEN, formatId: "post", date: "d" }]);
    expect(await svc.controlerPost({ texte: REPRIS, formatId: "post" })).toEqual({ texte: REPRIS, alerte: false, reprises: [] });
  });
  it("avocat : jamais mémorisé", async () => {
    await ecrireParametre(svc.REGLAGE_MEMOIRE_CENTRALE, true);
    await svc.enregistrerPost({ texte: ANCIEN, formatId: "avocat" });
    expect(await mem.postsMemorises()).toEqual([]);
  });
});
