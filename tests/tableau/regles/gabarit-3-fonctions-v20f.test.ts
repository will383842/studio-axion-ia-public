/**
 * Gabarit « reference/3 » : appels DIRECTS des fonctions pures de `gabarit-3.ts` jusque-là jamais testées
 * (textesPeps, groupeDuBloc, blocsVisibles, cotesTransformation, libellePartie). Aucun nombre à virgule.
 */
import { describe, expect, it } from "vitest";
// Charger la fiche d'abord (cycle fiche ↔ gabarit).
import "@/moteurs/montage-tableau/fiche";
import { blocsVisibles, cotesTransformation, groupeDuBloc, libellePartie, textesPeps } from "@/moteurs/montage-tableau/gabarit-3";
import { BLOCS_GABARIT, NOMS_BLOCS, ROLES_PAGE_3 } from "@/moteurs/montage-tableau/gabarit";
import type { GabaritScene } from "@/moteurs/montage-tableau/fiche";

type Visuel = NonNullable<GabaritScene["visuel"]>;
const visuel = (v: Partial<Visuel>): Visuel => ({ id: "chiffre-entoure", ...v }) as Visuel;

describe("groupeDuBloc", () => {
  it("regroupe avant/après et les listes ; les autres blocs n'ont pas de groupe", () => {
    expect(groupeDuBloc("avant")).toBe("comparaison");
    expect(groupeDuBloc("apres")).toBe("comparaison");
    expect(groupeDuBloc("code")).toBe("code");
    expect(groupeDuBloc("coche")).toBe("coche");
    expect(groupeDuBloc("transformation")).toBe("transformation");
    expect(groupeDuBloc("liste")).toBe("liste");
    for (const b of ["titre", "phrase-cle", "detail", "appel", "idee-recue"] as const) expect(groupeDuBloc(b)).toBe("");
  });
  it("couvre tous les blocs de NOMS_BLOCS", () => {
    const noms = Object.keys(NOMS_BLOCS).sort();
    expect(noms).toEqual([...BLOCS_GABARIT].sort());
    expect(noms.filter((b) => groupeDuBloc(b as (typeof BLOCS_GABARIT)[number]) !== "")).toHaveLength(6);
  });
});

describe("blocsVisibles", () => {
  it("0 pour aucune ligne ou des lignes sans bloc", () => {
    expect(blocsVisibles([])).toBe(0);
    expect(blocsVisibles([{ id: "a" }, { id: "b" }])).toBe(0);
  });
  it("chaque bloc simple compte pour un", () => {
    expect(blocsVisibles([{ id: "a", bloc: "titre" }, { id: "b", bloc: "phrase-cle" }, { id: "c", bloc: "detail" }])).toBe(3);
  });
  it("une liste, ou un avant/après, compte pour un seul bloc", () => {
    expect(blocsVisibles([{ id: "a", bloc: "code" }, { id: "b", bloc: "code" }, { id: "c", bloc: "code" }])).toBe(1);
    expect(blocsVisibles([{ id: "a", bloc: "avant" }, { id: "b", bloc: "apres" }])).toBe(1);
    expect(blocsVisibles([{ id: "a", bloc: "titre" }, { id: "b", bloc: "coche" }, { id: "c", bloc: "coche" }, { id: "d", bloc: "transformation" }])).toBe(3);
  });
});

describe("cotesTransformation", () => {
  it("sépare « X → Y » et « X -> Y » en rognant les espaces", () => {
    expect(cotesTransformation("M. Dupont → Client A")).toEqual({ de: "M. Dupont", vers: "Client A" });
    expect(cotesTransformation("  devis ->  facture  ")).toEqual({ de: "devis", vers: "facture" });
    expect(cotesTransformation("a→b")).toEqual({ de: "a", vers: "b" });
  });
  it("null sans flèche, avec deux flèches ou avec un côté vide", () => {
    expect(cotesTransformation("une phrase sans transformation")).toBeNull();
    expect(cotesTransformation("de 3 à 5")).toBeNull();
    expect(cotesTransformation("a → b → c")).toBeNull();
    expect(cotesTransformation("→ b")).toBeNull();
    expect(cotesTransformation("a →")).toBeNull();
    expect(cotesTransformation("")).toBeNull();
  });
});

describe("libellePartie", () => {
  it("donne l'étiquette de chaque rôle de la vidéo, dans l'ordre", () => {
    expect(ROLES_PAGE_3.map((r) => libellePartie(r))).toEqual(["ACCROCHE", "LA DOULEUR", "LA SOLUTION", "EXEMPLE", "À RETENIR", "À VOUS"]);
  });
  it("vide pour un rôle absent ou propre à l'autre style", () => {
    expect(libellePartie(undefined)).toBe("");
    expect(libellePartie("probleme")).toBe("");
    expect(libellePartie("etape")).toBe("");
  });
});

describe("textesPeps", () => {
  it("aucun gabarit, ou gabarit sans visuel ni bloc : liste vide", () => {
    expect(textesPeps({})).toEqual([]);
    expect(textesPeps({ gabarit: { role: "solution" } })).toEqual([]);
  });
  it("visuel : chiffre, libellé, gauche, droite dans l'ordre, en écartant les vides et « personne »", () => {
    expect(textesPeps({ gabarit: { role: "solution", visuel: visuel({ chiffre: "12", libelle: "clients", gauche: "avant", droite: "après" }) } })).toEqual(["12", "clients", "avant", "après"]);
    expect(textesPeps({ gabarit: { role: "solution", visuel: visuel({ chiffre: "7", gauche: "personne", droite: "équipe" }) } })).toEqual(["7", "équipe"]);
  });
  it("bloc orange : texte seul, ou compteur final devant le texte", () => {
    expect(textesPeps({ gabarit: { role: "solution", bloc: { texte: "gagné" } } })).toEqual(["gagné"]);
    expect(textesPeps({ gabarit: { role: "solution", bloc: { texte: "heures", compteur: { de: 0, a: 40 } } } })).toEqual(["40 heures"]);
  });
  it("visuel puis bloc", () => {
    expect(textesPeps({ gabarit: { role: "solution", visuel: visuel({ libelle: "dossiers" }), bloc: { texte: "traités", compteur: { de: 1, a: 9 } } } })).toEqual(["dossiers", "9 traités"]);
  });
});
