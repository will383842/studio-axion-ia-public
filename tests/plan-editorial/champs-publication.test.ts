/** L1-03 · champs ajoutés à la publication (dateExterne, dateVoulue, repereUsine, signatureUsine) : tous facultatifs. */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { fileURLToPath } from "node:url";
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

/** Les types ne s'exécutent pas : on interroge le compilateur sur le vrai type `Publication` (échoue sans les champs). */
describe("L1-03 · types de Publication (compilateur)", () => {
  const fichier = fileURLToPath(new URL("../../src/domaine/types.ts", import.meta.url));
  const programme = ts.createProgram([fichier], { noEmit: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
  const verif = programme.getTypeChecker();
  const source = programme.getSourceFile(fichier)!;
  function proprietes(nom: string): Map<string, ts.Symbol> {
    const symbole = verif.getExportsOfModule(verif.getSymbolAtLocation(source)!).find((s) => s.name === nom);
    if (!symbole) throw new Error(`type ${nom} introuvable`);
    return new Map(verif.getPropertiesOfType(verif.getDeclaredTypeOfSymbol(symbole)).map((p) => [p.name, p]));
  }
  it("Publication déclare les quatre champs ajoutés, tous facultatifs", () => {
    const props = proprietes("Publication");
    for (const nom of ["dateExterne", "dateVoulue", "repereUsine", "signatureUsine"]) {
      expect(props.has(nom), nom).toBe(true);
      expect((props.get(nom)!.flags & ts.SymbolFlags.Optional) !== 0, `${nom} facultatif`).toBe(true);
    }
  });
  it("idExterne est réutilisé, aucun doublon (idExterne2, identifiantExterne…)", () => {
    const noms = [...proprietes("Publication").keys()].filter((n) => /externe/i.test(n));
    expect(noms.sort()).toEqual(["dateExterne", "idExterne"]);
  });
  it("SortieVisuel est un type séparé de Sortie, lié à un visuel", () => {
    const props = proprietes("SortieVisuel");
    expect(props.has("visuelId")).toBe(true);
    expect(props.has("videoId")).toBe(false);
  });
});
