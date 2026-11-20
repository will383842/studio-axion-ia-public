/** FIX-MILLIERS-FA-v20h : « 1 000 » est lu 1000 (et non 1 et 0) par le réalisateur. */
import { describe, expect, it } from "vitest";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { nombresDansTexte } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { controlerSuiteV4, type ElementResoluV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

describe("nombresDansTexte · milliers groupés", () => {
  it("a) espace, espace fine insécable et insécable groupent les milliers", () => {
    expect(nombresDansTexte("1 000 €")).toEqual([1000]);
    expect(nombresDansTexte("2 500,5")).toEqual([2500.5]);
    expect(nombresDansTexte("1 000")).toEqual([1000]);
    expect(nombresDansTexte("1 000")).toEqual([1000]);
  });
  it("b) comportements inchangés", () => {
    expect(nombresDansTexte("45 min, 2,5 h")).toEqual([45, 2.5]);
    expect(nombresDansTexte("12 34")).toEqual([12, 34]);
    expect(nombresDansTexte("2026")).toEqual([2026]);
  });
  it("c) D15d : « 1 000 € » avec « mille euros » dit ne produit plus d'erreur D15d", () => {
    const voix: MotTranscrit[] = [{ w: "mille", a: 1.0, f: 1.3 }, { w: "euros", a: 1.3, f: 1.7 }];
    const fi = CATALOGUE_V4.find((f) => f.id === "EtiquetteTete")!;
    const e: ElementResoluV4 = { fiche: fi, debut: 0, fin: 1.5, mots: ["1 000 €"], lignes: [], instants: [], recherches: [], illustre: "mille euros", rang: 1 };
    const codes = controlerSuiteV4([e], { duree: 60, finDebut: 60 }, voix).erreurs.map((x) => x.split(" — ")[0]);
    expect(codes).not.toContain("D15d");
  });
});
