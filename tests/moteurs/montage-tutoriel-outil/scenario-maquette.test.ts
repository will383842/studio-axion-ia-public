/** T-EXT-01 : schéma `scenario-maquette.v1` et lecteur strict (pur, aucun navigateur, aucun appel). */
import { describe, expect, it } from "vitest";
import { ETAPES_MAX, LIBELLE_MAX } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { VERSION_SCENARIO_MAQUETTE, lireScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";

type Obj = Record<string, unknown>;

function valide(): Obj {
  const roles = ["accroche", "probleme", "parcours", "bonne-pratique", "appel"];
  return {
    version: VERSION_SCENARIO_MAQUETTE,
    maquette: "05-stocks",
    largeur: 1080,
    hauteur: 1350,
    etapes: roles.map((role, i) => ({
      id: `e${i + 1}`,
      role,
      aller: `page-${i + 1}`,
      ancre: i === 0 ? { surMot: "stock" } : { apresEtape: `e${i}`, delaiMs: 500 },
    })),
  };
}

function erreurs(brut: unknown): string[] {
  const r = lireScenarioMaquette(brut);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.erreurs;
}
const contient = (liste: string[], morceau: string) => expect(liste.some((e) => e.includes(morceau))).toBe(true);
const etapes = (o: Obj) => o.etapes as Obj[];

describe("lireScenarioMaquette", () => {
  it("accepte un scénario minimal de 5 étapes (accroche → appel) et garde l'ordre", () => {
    const r = lireScenarioMaquette(valide());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scenario.etapes.map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
      expect(r.scenario.etapes[0]!.role).toBe("accroche");
      expect(r.scenario.etapes[4]!.role).toBe("appel");
    }
  });

  it("accepte les champs facultatifs valides", () => {
    const o = valide();
    Object.assign(etapes(o)[1]!, {
      cible: "#carte",
      zone: { x: 0, y: 0, largeur: 100, hauteur: 50 },
      annotation: "Court",
      masques: [{ x: 10, y: 10, largeur: 20, hauteur: 20 }],
      textesEcran: ["Exemple"],
      ancre: { surMot: "alerte", occurrence: 2 },
    });
    expect(lireScenarioMaquette(o).ok).toBe(true);
  });

  it("refuse null, tableau, chaîne, nombre sans lever d'exception", () => {
    for (const brut of [null, [], "x", 3, undefined]) contient(erreurs(brut), "objet");
  });

  it("refuse une version inconnue", () => {
    contient(erreurs({ ...valide(), version: "scenario-maquette.v0" }), "Version inconnue");
  });

  it("refuse un champ inconnu (racine, étape, ancre)", () => {
    contient(erreurs({ ...valide(), bonus: 1 }), "bonus");
    const o = valide();
    etapes(o)[2]!.surprise = true;
    contient(erreurs(o), "surprise");
    const p = valide();
    etapes(p)[0]!.ancre = { surMot: "a", extra: 1 };
    contient(erreurs(p), "extra");
  });

  it("refuse 0 étape et plus de ETAPES_MAX", () => {
    contient(erreurs({ ...valide(), etapes: [] }), "étape");
    const o = valide();
    const base = etapes(o);
    o.etapes = Array.from({ length: ETAPES_MAX + 1 }, (_, i) => ({
      ...base[Math.min(i, 3)]!,
      id: `x${i}`,
      role: i === ETAPES_MAX ? "appel" : "parcours",
      ancre: i === 0 ? { surMot: "a" } : { apresEtape: "x0", delaiMs: 0 },
    }));
    contient(erreurs(o), String(ETAPES_MAX));
  });

  it("refuse un id en double", () => {
    const o = valide();
    etapes(o)[2]!.id = "e1";
    contient(erreurs(o), "double");
  });

  it("refuse apresEtape vers une étape absente ou postérieure", () => {
    const o = valide();
    etapes(o)[1]!.ancre = { apresEtape: "inconnue", delaiMs: 0 };
    contient(erreurs(o), "absente");
    const p = valide();
    etapes(p)[1]!.ancre = { apresEtape: "e3", delaiMs: 0 };
    contient(erreurs(p), "postérieure");
    const q = valide();
    etapes(q)[1]!.ancre = { apresEtape: "e2", delaiMs: 0 };
    contient(erreurs(q), "postérieure");
  });

  it("refuse une zone ou un masque hors 0-100", () => {
    const o = valide();
    etapes(o)[1]!.zone = { x: 50, y: 0, largeur: 60, hauteur: 10 };
    contient(erreurs(o), "zone");
    const p = valide();
    etapes(p)[1]!.masques = [{ x: -1, y: 0, largeur: 10, hauteur: 10 }];
    contient(erreurs(p), "masque");
  });

  it("refuse une annotation trop longue", () => {
    const o = valide();
    etapes(o)[1]!.annotation = "a".repeat(LIBELLE_MAX + 1);
    contient(erreurs(o), "annotation");
    const p = valide();
    etapes(p)[1]!.annotation = "a".repeat(LIBELLE_MAX);
    expect(lireScenarioMaquette(p).ok).toBe(true);
  });

  it("refuse une cible vide", () => {
    const o = valide();
    etapes(o)[1]!.cible = "  ";
    contient(erreurs(o), "cible");
  });

  it("refuse largeur/hauteur hors 320-4096", () => {
    contient(erreurs({ ...valide(), largeur: 319 }), "largeur");
    contient(erreurs({ ...valide(), hauteur: 4097 }), "hauteur");
  });

  it("refuse une première étape sans ancre surMot", () => {
    const o = valide();
    etapes(o)[0]!.ancre = { apresEtape: "e2", delaiMs: 0 };
    contient(erreurs(o), "première étape");
  });

  it("refuse une dernière étape qui n'est pas un appel", () => {
    const o = valide();
    etapes(o)[4]!.role = "parcours";
    contient(erreurs(o), "dernière étape");
  });

  it("refuse un rôle inconnu", () => {
    const o = valide();
    etapes(o)[2]!.role = "magie";
    contient(erreurs(o), "rôle");
  });
});
