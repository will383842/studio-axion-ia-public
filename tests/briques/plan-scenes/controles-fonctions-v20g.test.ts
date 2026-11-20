/**
 * T-CONTROLES-PLAN-SCENES-v20g — tests directs des contrôles de qualité du plan de scènes
 * (`src/briques/plan-scenes/controles.ts`) : affichageDeLaScene, plageDeLaScene, controlerLitteralite,
 * controlerTempsDeLecture, dessinDeLaPiece, reductionNecessaire, appliquerControles. Aucun double de module, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import {
  affichageDeLaScene,
  appliquerControles,
  controlerLitteralite,
  controlerTempsDeLecture,
  dessinDeLaPiece,
  plageDeLaScene,
  reductionNecessaire,
  SEUILS_CONTROLES,
  type ContexteControles,
} from "../../../src/briques/plan-scenes/controles";
import type { MotMinute, ScenePlan } from "../../../src/briques/plan-scenes/schema";

const FORMAT = { largeur: 1080, hauteur: 1920 };
const TRANSITION = { entree: "fondu", sortie: "fondu", dureeMs: 400 };

/** Un mot toutes les 350 ms à partir de 0. */
const mots = (texte: string, pasMs = 350): MotMinute[] => texte.split(/\s+/).map((t, i) => ({ texte: t, debutMs: i * pasMs, finMs: (i + 1) * pasMs }));

function scene(id: string, piece: string, parametres: unknown, premier: number, dernier: number, debutMs = 0, finMs = 3000, position = "centre"): ScenePlan {
  return { id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position, transition: TRANSITION, piece, parametres } as unknown as ScenePlan;
}
const contexte = (m: MotMinute[], extra: Partial<ContexteControles> = {}): ContexteControles => ({
  mots: m,
  format: FORMAT,
  facecam: false,
  dureeMs: m.length ? m.at(-1)!.finMs : 0,
  ...extra,
});

describe("affichageDeLaScene", () => {
  it("une légende « titre » : texte à 84 px, sous-texte à la moitié, nombres vides", () => {
    const r = affichageDeLaScene({ piece: "legende", parametres: { texte: "  Bonjour 40 ", sousTexte: "détail", style: "titre" } } as never);
    expect(r.nombres).toEqual([]);
    expect(r.blocs).toEqual([
      { texte: "Bonjour 40", taille: 84, graisse: 800, largeur: 880, dit: "chiffres" },
      { texte: "détail", taille: 42, graisse: 500, largeur: 880, dit: "non" },
    ]);
  });
  it("une légende « bandeau » à 58 px, un style inconnu à 40 px ; texte vide ignoré", () => {
    expect(affichageDeLaScene({ piece: "legende", parametres: { texte: "a", style: "bandeau" } } as never).blocs.map((b) => b.taille)).toEqual([58]);
    expect(affichageDeLaScene({ piece: "legende", parametres: { texte: "a", style: "autre" } } as never).blocs.map((b) => b.taille)).toEqual([40]);
    expect(affichageDeLaScene({ piece: "legende", parametres: { texte: "   ", sousTexte: 12 } } as never)).toEqual({ blocs: [], nombres: [] });
  });
  it("avant-apres : titre en blocs, deux valeurs en nombres ; une valeur non finie est ignorée", () => {
    const r = affichageDeLaScene({ piece: "avant-apres", parametres: { titre: "T", avant: { valeur: 10 }, apres: { valeur: 20.5 } } } as never);
    expect(r.nombres).toEqual([10, 20.5]);
    expect(r.blocs).toHaveLength(1);
    expect(affichageDeLaScene({ piece: "avant-apres", parametres: { avant: { valeur: Number.NaN }, apres: "x" } } as never)).toEqual({ blocs: [], nombres: [] });
  });
  it("étapes : un bloc par élément objet, dans l'ordre ; les éléments non objets sont ignorés", () => {
    const r = affichageDeLaScene({ piece: "etapes", parametres: { elements: [{ texte: "un" }, 5, null, { texte: "deux" }] } } as never);
    expect(r.blocs.map((b) => [b.texte, b.taille, b.largeur, b.dit])).toEqual([
      ["un", 46, 780, "mots"],
      ["deux", 46, 780, "mots"],
    ]);
  });
  it("carte-kpi : libellé seulement, nombre exempté ; pièce inconnue ou paramètres invalides : rien", () => {
    expect(affichageDeLaScene({ piece: "carte-kpi", parametres: { libelle: "CA", valeur: 9 } } as never)).toEqual({ blocs: [{ texte: "CA", taille: 34, graisse: 600, largeur: 680, dit: "non" }], nombres: [] });
    expect(affichageDeLaScene({ piece: "inconnue", parametres: { texte: "x" } } as never)).toEqual({ blocs: [], nombres: [] });
    expect(affichageDeLaScene({ piece: "citation", parametres: "texte" } as never)).toEqual({ blocs: [], nombres: [] });
    expect(affichageDeLaScene({ piece: "citation", parametres: [1] } as never)).toEqual({ blocs: [], nombres: [] });
  });
  it("ne modifie pas la scène reçue", () => {
    const s = { piece: "etapes", parametres: { elements: [{ texte: "un" }] } };
    const copie = structuredClone(s);
    affichageDeLaScene(s as never);
    expect(s).toEqual(copie);
  });
});

describe("plageDeLaScene", () => {
  const m = mots("un deux trois quatre cinq six sept huit");
  it("sans mots : la plage déclarée, telle quelle", () => {
    const s = scene("a", "repere", {}, 2, 4);
    expect(plageDeLaScene(s, contexte([]))).toBe(s.mots);
  });
  it("plage cohérente : celle de la scène", () => {
    expect(plageDeLaScene(scene("a", "repere", {}, 1, 3, 400, 1400), contexte(m))).toEqual({ premier: 1, dernier: 3 });
  });
  it("scène sans plage donnée : les mots dits pendant qu'elle est à l'écran", () => {
    // à l'écran de 400 à 1100 ms : mot 1 (350-700) jusqu'au mot 3 (1050-1400, commence avant 1100)
    const s = scene("a", "repere", {}, 0, 0, 400, 1100);
    expect(plageDeLaScene(s, contexte(m, { sansPlage: new Set(["a"]) }))).toEqual({ premier: 1, dernier: 3 });
  });
  it("plage incohérente (commence plus de 1,2 s après son dernier mot) : recalculée sur l'horaire", () => {
    const s = scene("a", "repere", {}, 0, 0, 2100, 2500);
    // mot 0 finit à 350 ; 350 + 1200 <= 2100 : incohérente ; mots à l'écran : finMs > 2100 -> mot 6 (2100-2450) ; début < 2500 -> mot 7 (2450-2800)
    expect(plageDeLaScene(s, contexte(m))).toEqual({ premier: 6, dernier: 7 });
  });
  it("aucun mot à l'écran : retombe sur la plage déclarée ; l'entrée n'est pas modifiée", () => {
    const s = scene("a", "repere", {}, 0, 0, 9000, 9500);
    const copie = structuredClone(s);
    expect(plageDeLaScene(s, contexte(m))).toEqual({ premier: 0, dernier: 0 });
    expect(s).toEqual(copie);
  });
});

describe("controlerLitteralite", () => {
  const m = mots("Nous avons gagné 40 % de clients en plus ce mois-ci");
  it("sans mots : la scène passe sans remarque", () => {
    const s = scene("a", "citation", { texte: "n'importe quoi" }, 0, 0);
    expect(controlerLitteralite(s, contexte([]))).toEqual({ scene: s });
  });
  it("citation faite de mots dits : gardée telle quelle", () => {
    const s = scene("a", "citation", { texte: "gagné 40 de clients" }, 0, 6);
    const r = controlerLitteralite(s, contexte(m));
    expect(r.scene).toBe(s);
    expect(r.remarque).toBeUndefined();
  });
  it("citation non dite, sans stock : retirée avec la remarque LITTERALITE", () => {
    const r = controlerLitteralite(scene("a", "citation", { texte: "promesse jamais prononcée" }, 0, 6), contexte(m));
    expect(r.scene).toBeNull();
    expect(r.remarque).toEqual({ code: "LITTERALITE", message: "Ce que la scène affichait n'était pas dit dans le script : scène retirée." });
  });
  it("compteur à 75 alors que 40 est dit : retiré ; compteur à 40 : gardé", () => {
    expect(controlerLitteralite(scene("a", "compteur", { valeur: 75 }, 0, 6), contexte(m)).scene).toBeNull();
    const bon = scene("b", "compteur", { valeur: 40 }, 0, 6);
    expect(controlerLitteralite(bon, contexte(m)).scene).toBe(bon);
  });
  it("non dit avec une scène du stock sur la même plage : remplacée, id et version de la scène gardés ; le stock n'est pas modifié", () => {
    const stock = scene("stock-1", "repere", { texte: "gagné" }, 2, 2);
    const stockCopie = structuredClone(stock);
    const s = { ...scene("a", "citation", { texte: "promesse jamais prononcée" }, 0, 6), version: 7 } as ScenePlan;
    const r = controlerLitteralite(s, contexte(m, { stock: [stock] }));
    expect(r.remarque?.code).toBe("LITTERALITE");
    expect(r.remarque?.message).toBe("Ce que la scène affichait n'était pas dit dans le script : remplacée par la scène du stock.");
    expect(r.scene).toEqual({ ...stockCopie, id: "a", version: 7 });
    expect(r.scene).not.toBe(stock);
    expect(stock).toEqual(stockCopie);
  });
  it("une scène du stock hors de la plage ne remplace pas : retirée", () => {
    const stock = scene("stock-1", "repere", { texte: "x" }, 9, 10);
    expect(controlerLitteralite(scene("a", "citation", { texte: "faux" }, 0, 3), contexte(m, { stock: [stock] })).scene).toBeNull();
  });
});

describe("controlerTempsDeLecture", () => {
  const m = mots("un deux trois quatre cinq six sept huit"); // fin du dernier mot : 2800
  it("sans mots : la scène passe", () => {
    const s = scene("a", "repere", { texte: "un" }, 0, 0);
    expect(controlerTempsDeLecture(s, contexte([]))).toEqual({ scene: s });
  });
  it("durée suffisante : même objet rendu", () => {
    // 1 mot affiché : minimum = 250 + 400 = 650 ms ; la scène dure 1000 ms et finit avant la queue permise
    const s = scene("a", "repere", { texte: "un" }, 0, 0, 0, 1000);
    const r = controlerTempsDeLecture(s, contexte(m));
    expect(r.scene).toBe(s);
    expect(r.remarque).toBeUndefined();
  });
  it("durée trop courte mais place disponible : prolongée au minimum, sans toucher à l'original", () => {
    const s = scene("a", "repere", { texte: "un deux trois" }, 0, 7, 0, 500); // minimum = 3*250+400 = 1150
    const copie = structuredClone(s);
    const r = controlerTempsDeLecture(s, contexte(m));
    expect(r.scene?.finMs).toBe(1150);
    expect(r.scene?.id).toBe("a");
    expect(s).toEqual(copie);
  });
  it("durée allongée au plus jusqu'à la queue permise après le dernier mot (+1,2 s)", () => {
    const s = scene("a", "repere", { texte: "un" }, 0, 0, 0, 9000); // fin du mot 0 = 350 ; plafond = 1550
    expect(controlerTempsDeLecture(s, contexte(m)).scene?.finMs).toBe(350 + SEUILS_CONTROLES.QUEUE_MAX_MS);
  });
  it("pas assez de temps avant la scène suivante : retirée, TROP_COURT", () => {
    const s = scene("a", "repere", { texte: "un deux trois" }, 0, 7, 0, 500);
    const r = controlerTempsDeLecture(s, contexte(m, { debutSuivantMs: 800 }));
    expect(r.scene).toBeNull();
    expect(r.remarque).toEqual({ code: "TROP_COURT", message: "Pas assez de temps pour lire la scène : retirée." });
  });
});

describe("dessinDeLaPiece", () => {
  it("légende au centre d'une image 1080×1920 : la largeur de la zone limite, échelle 0,972", () => {
    const r = dessinDeLaPiece("legende", "centre", FORMAT);
    expect(r.echelle).toBeCloseTo(0.972, 10);
    expect(r.rect.x).toBeCloseTo(5, 10);
    expect(r.rect.largeur).toBeCloseTo(90, 10);
    expect(r.rect.hauteur).toBeCloseTo(15.1875, 10);
    expect(r.rect.y).toBeCloseTo(42.40625, 10);
  });
  it("zone haute et étroite (haut, 11 % de hauteur) : la hauteur limite, la pièce est centrée dans la zone", () => {
    const r = dessinDeLaPiece("legende", "haut", FORMAT);
    // boîte 972 × 211,2 ; échelle = min(0,972 ; 0,704) = 0,704
    expect(r.echelle).toBeCloseTo(0.704, 10);
    expect(r.rect.hauteur).toBeCloseTo(11, 10);
    expect(r.rect.y).toBeCloseTo(3, 10);
    expect(r.rect.largeur).toBeCloseTo(((1000 * 0.704) / 1080) * 100, 10);
    expect(r.rect.x + r.rect.largeur / 2).toBeCloseTo(50, 10);
  });
});

describe("reductionNecessaire", () => {
  it("pièce sans texte : 1", () => {
    expect(reductionNecessaire(scene("a", "barres", { barres: [{ valeur: 3 }], surMot: 0 }, 0, 0))).toBe(1);
    expect(reductionNecessaire(scene("a", "inconnue", {}, 0, 0))).toBe(1);
  });
  it("texte court : aucune réduction", () => {
    expect(reductionNecessaire(scene("a", "repere", { texte: "Bonjour" }, 0, 0))).toBe(1);
  });
  it("texte très long : réduit, entre 0,1 et 1, sans être strictement identique à la taille normale", () => {
    const texte = Array.from({ length: 80 }, (_, i) => `mot${"x".repeat(i % 7)}`).join(" ");
    const f = reductionNecessaire(scene("a", "citation", { texte }, 0, 79));
    expect(f).toBe(0.49);
  });
  it("hauteur seule : mots courts (la largeur tient), beaucoup de lignes : réduction exacte par la hauteur", () => {
    const texte = (n: number) => Array.from({ length: n }, () => "ab").join(" ");
    expect(reductionNecessaire(scene("a", "repere", { texte: texte(20) }, 0, 0))).toBe(0.89);
    expect(reductionNecessaire(scene("a", "repere", { texte: texte(40) }, 0, 0))).toBe(0.6);
    // Ce même texte, plus court, tient à sa taille normale : la réduction ne vient donc que de la hauteur.
    expect(reductionNecessaire(scene("a", "repere", { texte: texte(5) }, 0, 0))).toBe(1);
  });
  it("un mot trop large pour sa ligne réduit la taille", () => {
    const f = reductionNecessaire(scene("a", "repere", { texte: "x".repeat(60) }, 0, 0));
    expect(f).toBe(0.390625);
  });
});

describe("appliquerControles", () => {
  const m = mots("un deux trois quatre cinq six sept huit neuf dix onze douze");
  it("plan vide : rien, aucune remarque", () => {
    expect(appliquerControles([], contexte(m))).toEqual({ scenes: [], remarques: [] });
  });
  it("sans mots : les scènes valides passent inchangées dans leur ordre", () => {
    const a = scene("a", "legende", { texte: "Bonjour", style: "bandeau" }, 0, 0, 0, 2000, "haut");
    const b = scene("b", "legende", { texte: "Salut", style: "bandeau" }, 0, 0, 3000, 5000, "haut");
    const r = appliquerControles([a, b], contexte([], { dureeMs: 6000 }));
    expect(r.scenes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.remarques).toEqual([]);
  });
  it("une scène non littérale est retirée, avec une remarque portant son id ; les autres restent", () => {
    const bonne = scene("bonne", "repere", { texte: "un deux" }, 0, 1, 0, 1500, "haut");
    const fausse = scene("fausse", "citation", { texte: "jamais dit ici" }, 4, 6, 1600, 3000, "haut");
    const entree = [bonne, fausse];
    const copie = structuredClone(entree);
    const r = appliquerControles(entree, contexte(m));
    expect(r.scenes.map((s) => s.id)).toEqual(["bonne"]);
    expect(r.remarques).toEqual([{ code: "LITTERALITE", sceneId: "fausse", message: "Ce que la scène affichait n'était pas dit dans le script : scène retirée." }]);
    expect(entree).toEqual(copie);
  });
  it("une 2e scène de même pièce et même texte, juste après la 1re, est retirée par REPETITION (remarque exacte)", () => {
    const mm = mots("un deux trois un deux");
    const a = scene("a", "repere", { texte: "un deux" }, 0, 1, 0, 1000, "haut");
    const b = scene("b", "repere", { texte: "un deux" }, 3, 4, 1050, 3000, "haut");
    const r = appliquerControles([a, b], contexte(mm, { dureeMs: 5000 }));
    expect(r.scenes.map((s) => [s.id, s.debutMs, s.finMs])).toEqual([["a", 0, 1000]]);
    expect(r.remarques).toEqual([{ code: "REPETITION", sceneId: "b", message: "Même pièce deux fois de suite : la seconde est retirée." }]);
  });
  it("une scène figée n'est jamais modifiée ni retirée, même fausse", () => {
    const fausse = scene("figee", "citation", { texte: "jamais dit ici" }, 0, 1, 0, 100, "haut");
    const r = appliquerControles([fausse], contexte(m, { figees: new Set(["figee"]) }));
    expect(r.scenes).toEqual([fausse]);
    expect(r.remarques).toEqual([]);
  });
  it("le temps de lecture prolonge une scène trop courte ; une scène longue est ramenée à la queue permise (fin du mot + 1,2 s)", () => {
    const a = scene("a", "repere", { texte: "un deux" }, 0, 1, 0, 200, "haut"); // minimum 2*250+400 = 900
    const b = scene("b", "citation", { texte: "cinq six" }, 4, 5, 2000, 4000, "haut"); // autre pièce : pas de répétition
    const r = appliquerControles([a, b], contexte(m));
    expect(r.scenes.map((s) => [s.id, s.finMs])).toEqual([
      ["a", 900],
      ["b", 3300],
    ]);
    expect(r.remarques).toEqual([]);
  });
});
