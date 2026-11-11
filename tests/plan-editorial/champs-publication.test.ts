/** L1-03 · champs ajoutés à la publication (dateExterne, dateVoulue, repereUsine, signatureUsine) : tous facultatifs. */
import { describe, expect, it } from "vitest";
import { sourceDe, type Publication, type SortieVisuel } from "@/domaine/types";

const ancienne: Publication = {
  id: "p1", creeLe: "2026-01-01T00:00:00Z", modifieLe: "2026-01-01T00:00:00Z",
  videoId: "v1", reseau: "linkedin" as Publication["reseau"], statut: "brouillon" as Publication["statut"],
  via: "simulation" as Publication["via"], date: "2026-01-02T00:00:00Z", texte: "Texte fictif", idExterne: "ext-1",
};

describe("L1-03 · champs de publication", () => {
  it("une ancienne publication se lit sans les nouveaux champs", () => {
    expect(ancienne.dateExterne).toBeUndefined();
    expect(ancienne.dateVoulue).toBeUndefined();
    expect(ancienne.repereUsine).toBeUndefined();
    expect(ancienne.signatureUsine).toBeUndefined();
    expect(sourceDe(ancienne)).toEqual({ famille: "video", videoId: "v1" });
    expect(ancienne.idExterne).toBe("ext-1");
  });
  it("accepte les quatre champs ajoutés", () => {
    const p: Publication = { ...ancienne, dateExterne: "2026-02-01T10:00:00Z", dateVoulue: "2026-02-01T09:00:00Z", repereUsine: "rep-1", signatureUsine: "sig-1" };
    expect(p.repereUsine).toBe("rep-1");
    expect(p.signatureUsine).toBe("sig-1");
  });
  it("SortieVisuel est un type séparé, lié à un visuel", () => {
    const s: SortieVisuel = { id: "s1", creeLe: "2026-01-01T00:00:00Z", modifieLe: "2026-01-01T00:00:00Z", visuelId: "x1", ratio: "1:1", fichierId: "f1" };
    expect(s.visuelId).toBe("x1");
  });
});
