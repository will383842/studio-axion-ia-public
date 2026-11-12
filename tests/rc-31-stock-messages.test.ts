/** RC-31 : stock de messages à faire passer. Pur, données fictives, aucun appel réel. */
import { describe, expect, it } from "vitest";
import { archiverMessage, creerEntreeStock, estActif, filtrerStock, planifierEntree } from "@/domaine/stock-messages";

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
});
