import { describe, expect, it } from "vitest";
import { lundiDeLaSemaine, plageMois, plageSemaine } from "@/lib/calendrier-plages";

describe("plages du calendrier (D6-02)", () => {
  it("lundi ordinaire", () => {
    expect(lundiDeLaSemaine("2026-10-14")).toBe("2026-10-12");
    expect(lundiDeLaSemaine("2026-10-12")).toBe("2026-10-12");
    expect(lundiDeLaSemaine("2026-10-18")).toBe("2026-10-12"); // dimanche
  });

  it("lundi correct autour du passage à l'heure d'hiver (dimanche 25/10/2026)", () => {
    expect(lundiDeLaSemaine("2026-10-25")).toBe("2026-10-19");
    expect(lundiDeLaSemaine("2026-10-26")).toBe("2026-10-26");
    const s = plageSemaine("2026-10-25");
    expect(s.jours).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    // Début = minuit Paris (heure d'été), fin = dernière milliseconde du dimanche (heure d'hiver).
    expect(s.debutIso).toBe("2026-10-18T22:00:00.000Z");
    expect(s.finIso).toBe("2026-10-25T22:59:59.999Z");
  });

  it("semaine du passage à l'heure d'été (28/03/2027)", () => {
    const s = plageSemaine("2027-03-28");
    expect(s.jours[0]).toBe("2027-03-22");
    expect(s.jours[6]).toBe("2027-03-28");
    expect(s.debutIso).toBe("2027-03-21T23:00:00.000Z");
    expect(s.finIso).toBe("2027-03-28T21:59:59.999Z");
  });

  it("dimanche 23:30 UTC (= lundi 00:30 Paris) : la borne de la semaine du 2/11 est à 23:00Z, pas plus tôt", () => {
    // Le rangement instant -> jour de Paris est exercé dans calendrier-lecture.test.ts (listerCalendrier).
    expect(lundiDeLaSemaine("2026-11-02")).toBe("2026-11-02");
    expect(plageSemaine("2026-11-02").debutIso).toBe("2026-11-01T23:00:00.000Z");
    expect(plageSemaine("2026-11-01").finIso).toBe("2026-11-01T22:59:59.999Z");
  });

  it("un mois = 6 × 7 jours, commence un lundi", () => {
    for (const j of ["2026-02-10", "2026-10-25", "2026-11-15", "2027-03-28", "2024-02-29"]) {
      const m = plageMois(j);
      expect(m.jours).toHaveLength(42);
      expect(m.semaines).toHaveLength(6);
      m.semaines.forEach((s) => expect(s).toHaveLength(7));
      expect(lundiDeLaSemaine(m.jours[0])).toBe(m.jours[0]);
      expect(m.jours.includes(j.slice(0, 8) + "01")).toBe(true);
      expect(new Set(m.jours).size).toBe(42);
    }
  });

  it("mois d'octobre 2026 : grille et bornes", () => {
    const m = plageMois("2026-10-25");
    expect(m.mois).toBe("2026-10");
    expect(m.jours[0]).toBe("2026-09-28");
    expect(m.jours[41]).toBe("2026-11-08");
    expect(m.debutIso).toBe("2026-09-27T22:00:00.000Z");
    expect(m.finIso).toBe("2026-11-08T22:59:59.999Z");
  });
});
