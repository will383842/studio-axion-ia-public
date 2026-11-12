import { describe, expect, it } from "vitest";
import { ajouterJoursParis, instantParis, resoudreHeureParis } from "@/lib/horloge-paris";
import { instantParis as instantParisMesures } from "@/domaine/mesures";

describe("horloge Paris (D6-01)", () => {
  it("heure d'été et d'hiver ordinaires", () => {
    expect(instantParis("2026-10-06", "09:00")).toBe("2026-10-06T07:00:00.000Z");
    expect(instantParis("2026-11-02", "09:00")).toBe("2026-11-02T08:00:00.000Z");
  });

  it("heure répétée (25/10/2026 02:30) : première occurrence, sans avertissement", () => {
    const r = resoudreHeureParis("2026-10-25", "02:30");
    expect(r.instant).toBe("2026-10-25T00:30:00.000Z");
    expect(r.avertissement).toBeUndefined();
  });

  it("heure inexistante (28/03/2027 02:30) : heure suivante, avec avertissement", () => {
    const r = resoudreHeureParis("2027-03-28", "02:30");
    expect(r.instant).toBe("2027-03-28T01:30:00.000Z"); // 03:30 à Paris
    expect(r.avertissement).toMatch(/02:30/);
  });

  it("veille et lendemain de bascule corrects", () => {
    expect(instantParis("2026-10-25", "01:30")).toBe("2026-10-24T23:30:00.000Z");
    expect(instantParis("2026-10-25", "03:30")).toBe("2026-10-25T02:30:00.000Z");
    expect(instantParis("2027-03-28", "01:30")).toBe("2027-03-28T00:30:00.000Z");
    expect(instantParis("2027-03-28", "03:30")).toBe("2027-03-28T01:30:00.000Z");
  });

  it("ajouterJoursParis ajoute des jours calendaires", () => {
    expect(ajouterJoursParis("2026-10-24", 1)).toBe("2026-10-25");
    expect(ajouterJoursParis("2026-12-30", 3)).toBe("2027-01-02");
    expect(ajouterJoursParis("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("mesures.instantParis délègue à l'horloge", () => {
    expect(instantParisMesures("2027-03-28", "02:30")).toBe("2027-03-28T01:30:00.000Z");
    expect(instantParisMesures("2026-10-06", "09:00")).toBe("2026-10-06T07:00:00.000Z");
  });
});
