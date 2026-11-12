/** RC-31 : stock de messages à faire passer. Pur, données fictives, aucun appel réel. */
import { describe, expect, it, vi } from "vitest";
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

  it("une priorité héritée de l'objet (« toString ») est refusée à la saisie", () => {
    const ok = { texte: "Un message", reseaux: ["linkedin"], priorite: "normale" };
    for (const p of ["toString", "constructor", "__proto__", "hasOwnProperty"]) expect(verifierSaisieStock({ ...ok, priorite: p })).not.toBeNull();
  });

  it("une priorité héritée dans une donnée ancienne donne un tri stable, quel que soit l'ordre d'entrée", () => {
    const x = { ...e("x"), priorite: "toString" as never };
    const h = e("h", { priorite: "haute" });
    const b = e("b", { priorite: "basse" });
    const a = filtrerStock([b, x, h]).map((m) => m.id);
    const c = filtrerStock([x, b, h]).map((m) => m.id);
    expect(a).toEqual(["h", "b", "x"]);
    expect(c).toEqual(a);
  });
});

// ---- Actions serveur : rejeu par clé, saisie refusée sans écriture, échéance vide. ----
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));

describe("RC-31 actions serveur", () => {
  const base = { texte: "Message d'essai", reseaux: ["linkedin" as const], priorite: "normale" as const };

  it("deux appels avec la même clé ne créent qu'une entrée", async () => {
    const { creerEntreeStockAction } = await import("@/app/(studio)/ecrire/stock/actions");
    const { depots } = await import("@/services/_commun");
    const avant = (await depots().stockMessages.lister()).length;
    const r1 = await creerEntreeStockAction({ ...base, cle: "rejeu-1" });
    const r2 = await creerEntreeStockAction({ ...base, cle: "rejeu-1" });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.donnees.id).toBe(r1.donnees.id);
    expect((await depots().stockMessages.lister()).length).toBe(avant + 1);
  });

  it("la même clé avec un autre contenu est refusée, sans écriture", async () => {
    const { creerEntreeStockAction } = await import("@/app/(studio)/ecrire/stock/actions");
    const { depots } = await import("@/services/_commun");
    await creerEntreeStockAction({ ...base, cle: "rejeu-2" });
    const avant = (await depots().stockMessages.lister()).length;
    const r = await creerEntreeStockAction({ ...base, texte: "Autre texte", cle: "rejeu-2" });
    expect(r.ok).toBe(false);
    expect((await depots().stockMessages.lister()).length).toBe(avant);
  });

  it("une saisie invalide (priorité « toString », réseau vide) est refusée sans écriture", async () => {
    const { creerEntreeStockAction } = await import("@/app/(studio)/ecrire/stock/actions");
    const { depots } = await import("@/services/_commun");
    const avant = (await depots().stockMessages.lister()).length;
    expect((await creerEntreeStockAction({ ...base, priorite: "toString" as never, cle: "inv-1" })).ok).toBe(false);
    expect((await creerEntreeStockAction({ ...base, reseaux: [], cle: "inv-2" })).ok).toBe(false);
    expect((await depots().stockMessages.lister()).length).toBe(avant);
  });

  it("une échéance vide veut dire « pas d'échéance »", async () => {
    const { creerEntreeStockAction } = await import("@/app/(studio)/ecrire/stock/actions");
    const r = await creerEntreeStockAction({ ...base, echeance: "", cle: "vide-1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnees.echeance).toBeUndefined();
  });
});
