/** RC-31 : stock de messages à faire passer. Pur, données fictives, aucun appel réel. */
import { describe, expect, it } from "vitest";
import { archiverMessage, creerEntreeStock, estActif, filtrerStock, planifierEntree, verifierSaisieStock } from "@/domaine/stock-messages";

const e = (id: string, o: Partial<Parameters<typeof creerEntreeStock>[0]> = {}) =>
  creerEntreeStock({ id, texte: `Message ${id}`, reseaux: ["linkedin"], priorite: "normale", ...o }, "2026-11-20T08:00:00Z");

describe("RC-31 stock de messages", () => {
  it("une entrée créée réapparaît dans la liste filtrée par réseau, priorité et échéance", () => {
    const a = e("a", { reseaux: ["tiktok"], priorite: "haute", echeance: "2026-12-01" });
    const b = e("b", { reseaux: ["linkedin"], priorite: "basse", echeance: "2026-12-20" });
    const liste = [b, a];
    expect(filtrerStock(liste, { reseau: "tiktok", echeanceAvant: "2026-12-05" })).toEqual([a]);
    expect(filtrerStock(liste, { etat: "en-stock" }).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("passer à « planifié » retire l'entrée du stock actif, sans la supprimer", () => {
    const a = e("a");
    const p = planifierEntree(a, "creneau-1");
    expect(a.etat).toBe("en-stock");
    expect(p.creneauId).toBe("creneau-1");
    expect([a, p].filter(estActif)).toEqual([a]);
    expect(filtrerStock([p], { etat: "planifie" })).toEqual([p]);
    expect(filtrerStock([p], { etat: "en-stock" })).toEqual([]);
  });

  it("une entrée archivée n'apparaît plus mais reste conservée", () => {
    const arch = archiverMessage(e("a"), "2026-11-21T00:00:00Z");
    expect(filtrerStock([arch])).toEqual([]);
    expect(arch.texte).toBe("Message a");
  });

  it("filtre par priorité", () => {
    const h = e("h", { priorite: "haute" });
    const b = e("b", { priorite: "basse" });
    expect(filtrerStock([b, h], { priorite: "haute" })).toEqual([h]);
    expect(filtrerStock([b, h], { priorite: "basse" })).toEqual([b]);
  });

  it("planifier : refuse une entrée publiée, archivée ou un créneau vide ; le rejeu du même créneau est sans effet", () => {
    const a = e("a");
    expect(() => planifierEntree({ ...a, etat: "publie" }, "c1")).toThrow();
    expect(() => planifierEntree(archiverMessage(a, "2026-11-21T00:00:00Z"), "c1")).toThrow();
    expect(() => planifierEntree(a, "")).toThrow();
    expect(() => planifierEntree(a, "   ")).toThrow();
    const p = planifierEntree(a, "c1");
    expect(planifierEntree(p, "c1")).toEqual(p);
    expect(() => planifierEntree(p, "c2")).toThrow();
    expect(p.creneauId).toBe("c1");
  });

  it("saisie : texte vide, réseaux vides ou inconnus, priorité hors liste, échéance illisible ou impossible sont refusés", () => {
    const ok = { texte: "Bonjour", reseaux: ["linkedin"], priorite: "haute", echeance: "2026-12-01" };
    expect(verifierSaisieStock(ok)).toBeNull();
    expect(verifierSaisieStock({ ...ok, echeance: undefined })).toBeNull();
    expect(verifierSaisieStock({ ...ok, texte: "  " })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, reseaux: [] })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, reseaux: ["myspace"] })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, priorite: "urgente" })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, echeance: "1/12/2026" })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, echeance: "2026-02-30" })).not.toBeNull();
    expect(verifierSaisieStock({ ...ok, echeance: "" })).not.toBeNull();
  });

  it("la priorité inconnue d'une donnée ancienne ne casse pas le tri", () => {
    const x = { ...e("x"), priorite: "?" as never };
    const y = e("y", { priorite: "haute" });
    expect(filtrerStock([x, y]).map((m) => m.id)).toEqual(["y", "x"]);
  });
});
