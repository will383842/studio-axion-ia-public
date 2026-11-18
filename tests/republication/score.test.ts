/** L8-09 : score des contenus candidats à la republication. Calcul pur : aucun réseau, aucune lecture. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DELAI_MESURE_MIN_JOURS,
  GROUPE_MIN,
  POIDS_SCORE,
  scorerCandidats,
  type CandidatRepublication,
} from "@/domaine/republication/score";

const MAINTENANT = new Date("2026-12-01T12:00:00Z");
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const cand = (id: string, resultats: CandidatRepublication["resultats"], extra: Partial<CandidatRepublication> = {}): CandidatRepublication => ({
  id,
  reseau: "instagram",
  datePublication: ilYa(40),
  premiereMesure: ilYa(20),
  resultats,
  ...extra,
});
const parId = (r: ReturnType<typeof scorerCandidats>, id: string) => r.find((x) => x.id === id)!;

describe("constantes proposées", () => {
  it("7 jours et groupe de 3 viennent de la fiche ; les poids sont des hypothèses qui font 1", () => {
    expect(DELAI_MESURE_MIN_JOURS.valeur).toBe(7);
    expect(GROUPE_MIN.valeur).toBe(3);
    const somme = Object.values(POIDS_SCORE).reduce((s, p) => s + p.valeur, 0);
    expect(somme).toBeCloseTo(1, 10);
    for (const p of Object.values(POIDS_SCORE)) expect(p.statut).toBe("hypothese");
  });
});

describe("score", () => {
  it("classe trois contenus mesurés : le meilleur 1, le pire 0", () => {
    const r = scorerCandidats([cand("a", { vues: 100 }), cand("b", { vues: 300 }), cand("c", { vues: 200 })], MAINTENANT);
    expect(parId(r, "b").score).toBe(1);
    expect(parId(r, "c").score).toBe(0.5);
    expect(parId(r, "a").score).toBe(0);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("une donnée absente n'est jamais un zéro : elle ne compte ni pour ni contre", () => {
    const r = scorerCandidats(
      [
        cand("a", { vues: 100, visites: 10 }),
        cand("b", { vues: 200, visites: 20 }),
        cand("c", { vues: 300, visites: 30 }),
        cand("sans", { vues: 300 }), // visites jamais lues
      ],
      MAINTENANT,
    );
    const sans = parId(r, "sans");
    expect(sans.composantes.visites).toBeNull();
    expect(sans.composantes.rang).not.toBeNull();
    // Il est noté sur ce qu'on sait : ses vues sont les meilleures ex aequo → score élevé, pas tiré vers 0.
    expect(sans.score).toBeGreaterThan(0.8);
  });

  it("un zéro réellement lu compte, lui, comme une vraie valeur basse", () => {
    const r = scorerCandidats([cand("a", { visites: 0 }), cand("b", { visites: 5 }), cand("c", { visites: 9 })], MAINTENANT);
    expect(parId(r, "a").composantes.visites).toBe(0);
    expect(parId(r, "a").score).toBe(0);
  });

  it("une valeur illisible (NaN, infinie) est une donnée absente, pas un zéro", () => {
    const r = scorerCandidats(
      [cand("a", { vues: Number.NaN, visites: 1 }), cand("b", { vues: 10, visites: 2 }), cand("c", { vues: 20, visites: 3 }), cand("d", { vues: 30 }), cand("e", { vues: Infinity })],
      MAINTENANT,
    );
    // Les vues finies sont 10, 20, 30 : positions 0, 0,5, 1 ; NaN et Infinity ne comptent pas.
    expect(parId(r, "a").composantes.rang).toBeNull();
    expect(parId(r, "e").composantes.rang).toBeNull();
    expect(parId(r, "b").composantes.rang).toBe(0);
    expect(parId(r, "c").composantes.rang).toBe(0.5);
    expect(parId(r, "d").composantes.rang).toBe(1);
    // a n'est noté que sur ses visites (la plus basse du groupe), pas sur « vues = 0 ».
    expect(parId(r, "a").composantes.visites).toBe(0);
    expect(parId(r, "a").score).toBe(0);
    expect(parId(r, "e")).toMatchObject({ etat: "exclu", motif: "aucune-donnee" });
  });

  it("deux entrées de même identifiant ne s'écrasent pas : un résultat par entrée", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("a", { vues: 2 }, { reseau: "linkedin" }), cand("b", { vues: 3 }), cand("c", { vues: 2 })], MAINTENANT);
    expect(r).toHaveLength(4);
  });

  it("le score est calculé sur les positions exactes, arrondi seulement à la fin", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 }), cand("d", { vues: 4 }), cand("e", { vues: 5 }), cand("f", { vues: 6 }), cand("g", { vues: 7 })], MAINTENANT);
    expect(parId(r, "b").composantes.rang).toBe(0.167);
    expect(parId(r, "b").score).toBe(0.167);
  });

  it("un indicateur lu sur moins de 3 contenus du groupe n'est pas utilisé du tout", () => {
    const r = scorerCandidats([cand("a", { vues: 1, rendezVous: 1 }), cand("b", { vues: 2, rendezVous: 5 }), cand("c", { vues: 3 })], MAINTENANT);
    for (const x of r) expect(x.composantes.rendezVous).toBeNull();
  });

  it("un contenu sans aucune valeur lue est exclu, pas noté 0", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 }), cand("vide", {})], MAINTENANT);
    expect(parId(r, "vide")).toMatchObject({ etat: "exclu", motif: "aucune-donnee", score: null });
  });

  it("le taux d'abandon à 3 s se lit à l'envers : plus bas = mieux", () => {
    const r = scorerCandidats([cand("a", { tauxAbandon3s: 70 }), cand("b", { tauxAbandon3s: 40 }), cand("c", { tauxAbandon3s: 10 })], MAINTENANT);
    expect(parId(r, "c").score).toBe(1);
    expect(parId(r, "a").score).toBe(0);
  });

  it("TikTok ne rend pas la portée : ses partages ne sont ni rangés ni lus comme 0", () => {
    const t = (id: string, partagesParPortee: number, vues: number) => cand(id, { partagesParPortee, vues }, { reseau: "tiktok" });
    const r = scorerCandidats([t("a", 9, 1), t("b", 1, 2), t("c", 5, 3)], MAINTENANT);
    for (const x of r) expect(x.composantes.partages).toBeNull();
    expect(parId(r, "c").score).toBe(1); // seules les vues comptent
  });

  it("les partages comptent sur Instagram", () => {
    const r = scorerCandidats([cand("a", { partagesParPortee: 1 }), cand("b", { partagesParPortee: 2 }), cand("c", { partagesParPortee: 3 })], MAINTENANT);
    expect(parId(r, "c").composantes.partages).toBe(1);
  });

  it("les poids ne servent qu'aux composantes présentes (renormalisés)", () => {
    const r = scorerCandidats(
      [cand("a", { vues: 1, visites: 3 }), cand("b", { vues: 2, visites: 2 }), cand("c", { vues: 3, visites: 1 })],
      MAINTENANT,
    );
    const a = parId(r, "a");
    // a : rang 0, visites 1 → (w.rang*0 + w.visites*1) / (w.rang + w.visites)
    const attendu = POIDS_SCORE.visites.valeur / (POIDS_SCORE.rang.valeur + POIDS_SCORE.visites.valeur);
    expect(a.score).toBeCloseTo(attendu, 3);
  });
});

describe("mesure assez ancienne, groupe assez grand", () => {
  it("un contenu mesuré depuis moins de 7 jours est exclu", () => {
    const r = scorerCandidats(
      [cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 }), cand("recent", { vues: 99 }, { premiereMesure: ilYa(6.9) })],
      MAINTENANT,
    );
    expect(parId(r, "recent")).toMatchObject({ etat: "exclu", motif: "mesure-trop-recente", score: null });
  });

  it("exactement 7 jours : retenu", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }, { premiereMesure: ilYa(7) }), cand("b", { vues: 2 }), cand("c", { vues: 3 })], MAINTENANT);
    expect(parId(r, "a").etat).toBe("note");
  });

  it("un contenu trop récent ne compte pas dans le groupe : 2 anciens + 1 récent = groupe trop petit", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("recent", { vues: 3 }, { premiereMesure: ilYa(2) })], MAINTENANT);
    expect(parId(r, "a")).toMatchObject({ etat: "exclu", motif: "groupe-trop-petit", score: null });
    expect(parId(r, "b")).toMatchObject({ etat: "exclu", motif: "groupe-trop-petit", score: null });
  });

  it("jamais mesuré : exclu « pas-mesure », jamais noté 0", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 }), cand("n", {}, { premiereMesure: null })], MAINTENANT);
    expect(parId(r, "n")).toMatchObject({ etat: "exclu", motif: "pas-mesure", score: null });
  });

  it("le groupe est celui du réseau : 2 + 2 sur deux réseaux ne font pas un groupe de 4", () => {
    const r = scorerCandidats(
      [cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 1 }, { reseau: "linkedin" }), cand("d", { vues: 2 }, { reseau: "linkedin" })],
      MAINTENANT,
    );
    for (const x of r) expect(x.motif).toBe("groupe-trop-petit");
  });

  it("un groupe de 3 est lu", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 })], MAINTENANT);
    expect(r.every((x) => x.etat === "note")).toBe(true);
  });
});

describe("données invalides", () => {
  it("réseau inconnu ou non classé : exclu, sans erreur", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }, { reseau: "myspace" }), cand("b", { vues: 1 }, { reseau: "youtube" })], MAINTENANT);
    expect(r.map((x) => x.motif)).toEqual(["reseau-non-classe", "reseau-non-classe"]);
  });

  it("date illisible ou instant courant illisible : exclu « date-invalide »", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }, { premiereMesure: "pas une date" })], MAINTENANT);
    expect(r[0]).toMatchObject({ etat: "exclu", motif: "date-invalide" });
    const r2 = scorerCandidats([cand("a", { vues: 1 })], new Date("n'importe quoi"));
    expect(r2[0]).toMatchObject({ etat: "exclu", motif: "date-invalide" });
  });

  it("une première mesure dans le futur est trop récente, pas valide", () => {
    const r = scorerCandidats([cand("a", { vues: 1 }, { premiereMesure: ilYa(-3) })], MAINTENANT);
    expect(r[0].motif).toBe("mesure-trop-recente");
  });

  it("liste vide : liste vide ; les entrées ne sont pas modifiées", () => {
    expect(scorerCandidats([], MAINTENANT)).toEqual([]);
    const entree = [cand("a", { vues: 1 }), cand("b", { vues: 2 }), cand("c", { vues: 3 })];
    const copie = JSON.parse(JSON.stringify(entree));
    scorerCandidats(entree, MAINTENANT);
    expect(entree).toEqual(copie);
  });

  it("l'ordre est stable : notés d'abord (meilleur en tête, égalité par id), exclus ensuite par id", () => {
    const r = scorerCandidats([cand("z", { vues: 5 }), cand("y", { vues: 5 }), cand("x", { vues: 9 }), cand("e2", {}, { premiereMesure: null }), cand("e1", {}, { premiereMesure: null })], MAINTENANT);
    expect(r.map((x) => x.id)).toEqual(["x", "y", "z", "e1", "e2"]);
  });
});

describe("calcul pur", () => {
  it("le fichier n'appelle aucun réseau, aucune base, aucun fichier", () => {
    const src = readFileSync("src/domaine/republication/score.ts", "utf8");
    expect(src).not.toMatch(/fetch\(|node:fs|from "@\/lib\/db|process\.env|XMLHttpRequest/);
  });
});
