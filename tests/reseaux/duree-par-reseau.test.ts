import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";
import { alerteDuree, alertesDuree, dureeViseeFormat, limiteDureeReseau, RESEAUX_DUREE } from "@/domaine/duree-par-reseau";

interface Cellule { valeur: string; preuve: string; url: string | null; date: string | null }
const releve = JSON.parse(readFileSync("docs/reseaux/regles-officielles.json", "utf8")) as { reseaux: Record<string, { reseau?: Record<string, Cellule> }> };

describe("durée visée et limite d'un réseau (aucun appel réel)", () => {
  it("Facebook : la limite est celle de zernio-corps, avec sa source", () => {
    const l = limiteDureeReseau("facebook");
    expect(l.limiteSec).toBe(REEL_FACEBOOK_DUREE_SEC.max);
    expect(l.source?.cellule).toBe("reseaux.facebook.reseau.format_video");
    expect(l.source?.url).toMatch(/^https:\/\//);
    expect(l.source?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("61 s sur Facebook : alerte qui nomme le réseau, la limite et la source", () => {
    const a = alerteDuree("facebook", 61);
    expect(a.genre).toBe("depasse");
    expect(a.phrase).toContain("Facebook");
    expect(a.phrase).toContain(`${REEL_FACEBOOK_DUREE_SEC.max} s`);
    expect(a.phrase).toContain("zernio.com");
  });
  it("60 s sur Facebook : aucune alerte", () => {
    expect(alerteDuree("facebook", 60)).toEqual({ genre: "ok", phrase: null });
  });
  it("Instagram : « limite non vérifiée », jamais un chiffre", () => {
    const l = limiteDureeReseau("instagram");
    expect(l.limiteSec).toBeNull();
    const a = alerteDuree("instagram", 600);
    expect(a.genre).toBe("non-verifiee");
    expect(a.phrase).toContain("limite non vérifiée");
    expect(a.phrase).not.toMatch(/\d+ s\b/);
  });
  it("durée inconnue : rien", () => {
    expect(alerteDuree("facebook", undefined)).toEqual({ genre: "ok", phrase: null });
    expect(alertesDuree(["facebook", "instagram"], undefined)).toEqual([]);
  });
  it("plusieurs réseaux cochés : une phrase par réseau concerné", () => {
    const p = alertesDuree(["facebook", "instagram", "linkedin"], 75).map((a) => a.genre);
    expect(p).toEqual(["depasse", "non-verifiee", "non-verifiee"]);
  });
  it("durée visée d'un format : cible par défaut, sinon borne haute de la zone", () => {
    expect(dureeViseeFormat({ mode: "depuis-script", zoneSec: [45, 90], zoneOrangeSec: [90, 150], ciblesGenerationSec: [60], cibleParDefautSec: 75 })).toBe(75);
    expect(dureeViseeFormat({ mode: "depuis-script", zoneSec: [45, 90], zoneOrangeSec: [90, 150], ciblesGenerationSec: [60], cibleParDefautSec: 0 })).toBe(90);
    expect(dureeViseeFormat({ valeursSec: [30], parDefautSec: 30 })).toBeUndefined();
  });
  it("chaque limite chiffrée a une cellule de preuve dans le relevé (valeur renseignée, URL, date)", () => {
    for (const r of RESEAUX_DUREE) {
      const l = limiteDureeReseau(r);
      if (l.limiteSec === null) continue;
      const [, reseau, bloc, cle] = (l.source?.cellule ?? "").split(".");
      const c = releve.reseaux[reseau]?.[bloc as "reseau"]?.[cle];
      expect(c, `cellule de preuve de ${r}`).toBeTruthy();
      expect(c!.valeur).not.toBe("inconnu");
      expect(c!.url).toBeTruthy();
      expect(c!.date).toBeTruthy();
    }
  });
});
