import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerLecteurCommentaires, type PageEvenementsCommentaires, type SourceCommentairesRecus } from "@/fournisseurs/zernio-inbox";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { RETRY_AFTER_MAX_MS } from "@/fournisseurs/publication/zernio-client";
import { horlogeFictive } from "./aides/faux-zernio";

const espionFetch = vi.spyOn(globalThis, "fetch");
beforeEach(() => {
  espionFetch.mockClear();
});
afterEach(() => {
  expect(espionFetch).not.toHaveBeenCalled();
});

type Issue = { page: PageEvenementsCommentaires } | { erreur: unknown } | { brut: unknown };
function sourceFactice(script: Issue[]) {
  const appels: { curseur?: string; idCompte: string; reseau: string; limite: number }[] = [];
  const file = [...script];
  const source: SourceCommentairesRecus = async (p) => {
    appels.push({ ...p });
    const i = file.shift() ?? { erreur: new Error("script épuisé") };
    if ("erreur" in i) throw i.erreur;
    if ("brut" in i) return i.brut as PageEvenementsCommentaires;
    return i.page;
  };
  return { source, appels };
}
const ev = (id: string, compte = "exemple-li-page-1", recuLe = "2026-11-10T10:00:00Z", reseau = "linkedin_page") => ({
  type: "zernio.commentaire_manuel",
  recuLe,
  charge: { idCommentaire: id, idCompte: compte, reseau, repere: "exemple-repere" },
});
const page = (evenements: unknown[], curseurSuivant: string | null) => ({ page: { evenements, curseurSuivant } as PageEvenementsCommentaires });
const e429 = (extra: { attenteMs?: number; reessayerApresSec?: number } = { attenteMs: 7000, reessayerApresSec: 7 }) =>
  ({ erreur: new ErreurZernio("debit", "limite", { statut: 429, reessayable: true, ...extra }) });
const mk = (script: Issue[], o: { pagesMax?: number; comptes?: string[] } = {}) => {
  const s = sourceFactice(script);
  const horloge = horlogeFictive();
  const lecteur = creerLecteurCommentaires({ source: s.source, comptesLecture: o.comptes ?? ["exemple-li-page-1", "exemple-li-page-2"], attendre: horloge.attendre, pagesMax: o.pagesMax });
  return { ...s, horloge, lecteur };
};
const lire = (l: ReturnType<typeof mk>["lecteur"], idCompte = "exemple-li-page-1", reseau: never | string = "linkedin_page") =>
  l.lireCommentaires({ idCompte, reseau: reseau as "linkedin_page" });

describe("L5-11 lecteur de commentaires", () => {
  it("T-L1 deux pages", async () => {
    const m = mk([page([ev("a"), ev("b")], "c2"), page([ev("c")], null)]);
    const r = await lire(m.lecteur);
    expect(r).toMatchObject({ statut: "ok", pagesLues: 2 });
    if (r.statut !== "ok") throw new Error();
    expect(r.commentaires).toHaveLength(3);
    expect(r.commentaires.every((c) => c.traitement === "manuel")).toBe(true);
    expect(m.appels).toHaveLength(2);
    expect(m.appels[0].curseur).toBeUndefined();
    expect(m.appels[1].curseur).toBe("c2");
  });
  it("T-L2 deux comptes séparés", async () => {
    const mel = [ev("a", "exemple-li-page-1"), ev("b", "exemple-li-page-2")];
    const m = mk([page(mel, null), page(mel, null)]);
    const r1 = await lire(m.lecteur, "exemple-li-page-1");
    const r2 = await lire(m.lecteur, "exemple-li-page-2");
    if (r1.statut !== "ok" || r2.statut !== "ok") throw new Error();
    expect(r1.commentaires.map((c) => c.idCommentaire)).toEqual(["a"]);
    expect(r2.commentaires.map((c) => c.idCommentaire)).toEqual(["b"]);
  });
  it("T-L3 429 puis reprise", async () => {
    const m = mk([page([ev("a")], "c2"), e429(), page([ev("b")], null)]);
    const r = await lire(m.lecteur);
    expect(r).toMatchObject({ statut: "ok", pagesLues: 2 });
    expect(m.horloge.attentes).toEqual([7000]);
    expect(m.appels).toHaveLength(3);
    expect(m.appels[0].curseur).toBeUndefined();
    expect(m.appels[1].curseur).toBe("c2");
    expect(m.appels[2].curseur).toBe("c2");
  });
  it("T-L4 429 sans attente fournie", async () => {
    const m = mk([e429({}), page([], null)]);
    await lire(m.lecteur);
    expect(m.horloge.attentes).toEqual([60_000]);
  });
  it("T-L5 429 persistant", async () => {
    const m = mk([e429(), e429(), e429(), e429()]);
    const r = await lire(m.lecteur);
    expect(r).toMatchObject({ statut: "panne", code: "debit-persistant", reessayerApresSec: 7 });
    expect(m.horloge.attentes).toHaveLength(3);
    expect("commentaires" in r).toBe(false);
  });
  it("T-L6 attente trop longue", async () => {
    const m = mk([e429({ attenteMs: RETRY_AFTER_MAX_MS + 1 })]);
    const r = await lire(m.lecteur);
    expect(r).toMatchObject({ statut: "panne", code: "debit-persistant" });
    expect(m.horloge.attentes).toEqual([]);
  });
  it("T-L7 panne après une page", async () => {
    const m = mk([page([ev("a")], "c2"), { erreur: new ErreurZernio("indisponible", "x", { statut: 503 }) }]);
    const r = await lire(m.lecteur);
    expect(r).toMatchObject({ statut: "panne", code: "indisponible", pagesLues: 1 });
    expect("commentaires" in r).toBe(false);
  });
  it("T-L8 erreur quelconque", async () => {
    const r = await lire(mk([{ erreur: new Error("exemple-detail-secret") }]).lecteur);
    expect(r).toMatchObject({ statut: "panne", code: "erreur-inconnue" });
    expect(JSON.stringify(r)).not.toContain("exemple-detail-secret");
  });
  it("T-L9 page mal formée", async () => {
    expect(await lire(mk([{ brut: { evenements: "x", curseurSuivant: null } }]).lecteur)).toMatchObject({ statut: "panne", code: "source-illisible" });
    expect(await lire(mk([{ brut: null }]).lecteur)).toMatchObject({ statut: "panne", code: "source-illisible" });
  });
  it("T-L10 curseur en boucle", async () => {
    const r = await lire(mk([page([], "c2"), page([], "c2")]).lecteur);
    expect(r).toMatchObject({ statut: "panne", code: "liste-incomplete", pagesLues: 2 });
  });
  it("T-L11 curseur refusé", async () => {
    expect(await lire(mk([page([], "a b")]).lecteur)).toMatchObject({ statut: "panne", code: "liste-incomplete" });
  });
  it("T-L12 plafond", async () => {
    const m = mk([page([], "c1"), page([], "c2"), page([], "c3"), page([], "c4")], { pagesMax: 3 });
    expect(await lire(m.lecteur)).toMatchObject({ statut: "panne", code: "liste-incomplete" });
    expect(m.appels).toHaveLength(3);
  });
  it("T-L13 youtube différé", async () => {
    const m = mk([]);
    expect(await lire(m.lecteur, "exemple-li-page-1", "youtube")).toEqual({ statut: "differe", reseau: "youtube", libelle: "mise à jour différée" });
    expect(await lire(m.lecteur, "exemple-hors-liste", "youtube")).toMatchObject({ statut: "differe" });
    expect(m.appels).toHaveLength(0);
  });
  it("T-L14 compte hors liste", async () => {
    const m = mk([]);
    expect(await lire(m.lecteur, "exemple-inconnu")).toMatchObject({ statut: "panne", code: "compte-non-permis", pagesLues: 0 });
    expect(m.appels).toHaveLength(0);
  });
  it("T-L15 réseau inconnu", async () => {
    const m = mk([]);
    expect(await lire(m.lecteur, "exemple-li-page-1", "x")).toMatchObject({ statut: "panne", code: "reseau-inconnu", pagesLues: 0 });
    expect(m.appels).toHaveLength(0);
  });
  it("T-L16 liste vide légitime", async () => {
    expect(await lire(mk([page([], null)]).lecteur)).toMatchObject({ statut: "ok", commentaires: [], pagesLues: 1 });
  });
  it("T-L17 illisibles, doublons, tri", async () => {
    const r = await lire(mk([page([ev("a", undefined, "2026-11-01T00:00:00Z"), { type: "zernio.commentaire_manuel", recuLe: "x", charge: null }, ev("a"), ev("b", undefined, "2026-11-05T00:00:00Z")], null)]).lecteur);
    if (r.statut !== "ok") throw new Error();
    expect(r.illisibles).toBe(1);
    expect(r.commentaires.map((c) => c.idCommentaire)).toEqual(["b", "a"]);
  });
  it("T-L19 commentaire proprio ignoré sans compter dans illisibles", async () => {
    const proprio = { type: "zernio.commentaire_manuel", recuLe: "2026-11-10T10:00:00Z", charge: { idCommentaire: "p", idCompte: "exemple-li-page-1", reseau: "linkedin_page", repere: "exemple-repere", proprio: true } };
    const r = await lire(mk([page([proprio, ev("a")], null)]).lecteur);
    if (r.statut !== "ok") throw new Error();
    expect(r.illisibles).toBe(0);
    expect(r.commentaires.map((c) => c.idCommentaire)).toEqual(["a"]);
  });
  it("T-L20 options bornées : NaN, Infinity, hors plage => défauts ou plafonds", async () => {
    const appelsDe = async (o: { pagesMax?: number; limite?: number; essais429Max?: number }, script: Issue[]) => {
      const s = sourceFactice(script);
      const l = creerLecteurCommentaires({ source: s.source, comptesLecture: ["exemple-li-page-1"], attendre: horlogeFictive().attendre, ...o });
      const r = await l.lireCommentaires({ idCompte: "exemple-li-page-1", reseau: "linkedin_page" });
      return { r, appels: s.appels };
    };
    const infinie = Array.from({ length: 50 }, (_, i) => page([], "c" + i));
    for (const pagesMax of [Infinity, NaN, 1000]) {
      const { r, appels } = await appelsDe({ pagesMax }, infinie);
      expect(r).toMatchObject({ statut: "panne", code: "liste-incomplete" });
      expect(appels).toHaveLength(10);
    }
    for (const limite of [NaN, Infinity, 0.5]) {
      expect((await appelsDe({ limite }, [page([], null)])).appels[0].limite).toBe(100);
    }
    expect((await appelsDe({ limite: 1000 }, [page([], null)])).appels[0].limite).toBe(100);
    expect((await appelsDe({ limite: -5 }, [page([], null)])).appels[0].limite).toBe(1);
    for (const essais429Max of [Infinity, NaN, 99]) {
      const h = horlogeFictive();
      const s = sourceFactice(Array.from({ length: 20 }, () => e429()));
      const l = creerLecteurCommentaires({ source: s.source, comptesLecture: ["exemple-li-page-1"], attendre: h.attendre, essais429Max });
      expect(await l.lireCommentaires({ idCompte: "exemple-li-page-1", reseau: "linkedin_page" })).toMatchObject({ statut: "panne", code: "debit-persistant" });
      expect(h.attentes).toHaveLength(3);
    }
  });
  it("T-L21 le catch extérieur rend les vraies pages lues", async () => {
    const s = sourceFactice([page([ev("a")], "c2"), e429(), page([], null)]);
    const l = creerLecteurCommentaires({
      source: s.source,
      comptesLecture: ["exemple-li-page-1"],
      attendre: async () => {
        throw new Error("exemple-attente-en-panne");
      },
    });
    const r = await l.lireCommentaires({ idCompte: "exemple-li-page-1", reseau: "linkedin_page" });
    expect(r).toMatchObject({ statut: "panne", code: "erreur-inconnue", pagesLues: 1 });
    expect("commentaires" in r).toBe(false);
  });
  it("T-L18 ne lève jamais", async () => {
    const l = mk([{ erreur: "x" }]).lecteur;
    await expect(lire(l)).resolves.toMatchObject({ statut: "panne", code: "erreur-inconnue" });
  });
});
