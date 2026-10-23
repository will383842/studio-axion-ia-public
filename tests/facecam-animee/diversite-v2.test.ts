/**
 * FACE CAMÉRA ANIMÉE — RÈGLES DE DIVERSITÉ « v2 ÉNERGIE » D0 à D15 (standard DA du 16/10, § E) : emplacement, forme, mouvement,
 * inclinaison, taille, orange, secousse, ouverture, coups de poing, cadence, bruitages, d'une vidéo à l'autre.
 * UN TEST PAR RÈGLE : un cas qui ÉCHOUE (le code de la règle est dans les erreurs) et un cas qui PASSE (il n'y est pas).
 * On teste le CODE de la règle (« D1a », « D10g »…), pas tout le plan : chaque cas isole une règle. Puis le branchement dans
 * `verifierPlan` (le plan qui viole D1 n'est pas rendable) et l'intégration à l'historique. AUCUN rendu, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import type { Apparition } from "@/moteurs/montage-facecam-animee/realisateur/familles";
import { ficheV2 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v2";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { controlerDiversite, estRendable, historiqueDuPlan, verifierPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import {
  controlerDiversiteV2, controlerSuiteV2, estRendableV2, resoudreElementsV2, SEUILS_V2, type ContexteControleV2, type ElementResolu,
} from "@/moteurs/montage-facecam-animee/realisateur/regles-v2";
import { schemaPlanFacecamAnimee, type ElementV2Plan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { MOTS, planValide } from "./plan-reference";

/** Un élément résolu à partir de l'id du catalogue (durée = le minimum de la fiche + 0,05 s ; inactif accepté : c'est D0 qui le juge). */
function el(id: string, debut: number, o: { fin?: number; angle?: number; mots?: string[] } = {}): ElementResolu {
  const fiche = ficheV2(id);
  if (!fiche) throw new Error(`id inconnu : ${id}`);
  return { fiche, debut, fin: o.fin ?? debut + fiche.dureeSec[0] + 0.05, angle: o.angle ?? fiche.angle, mots: o.mots ?? [], rang: 0 };
}
const ctx = (o: Partial<ContexteControleV2> = {}): ContexteControleV2 => ({ duree: 90, finDebut: 88, ...o });
const erreurs = (els: ElementResolu[], c: Partial<ContexteControleV2> = {}, mots?: readonly MotTranscrit[]) => controlerSuiteV2(els, ctx(c), mots).erreurs;
const avec = (liste: string[], code: string) => liste.filter((e) => e.startsWith(`${code} — `));
const echoue = (liste: string[], code: string) => expect(avec(liste, code).length, `attendu « ${code} » dans :\n${liste.join("\n")}`).toBeGreaterThan(0);
const passe = (liste: string[], code: string) => expect(avec(liste, code), liste.join("\n")).toEqual([]);

/** Les ids qui servent aux suites : (emplacement, forme, mouvement, sortie, sens) lus dans le catalogue. */
const fiche = (id: string) => ficheV2(id)!;

/** Suite d'ids placés toutes les `pas` secondes à partir de `depart`. */
const suite = (ids: string[], depart = 10, pas = 3) => ids.map((id, k) => el(id, depart + k * pas));

/** Apparition d'une carte / d'une fenêtre / d'une étiquette de l'ancien catalogue. */
const ancienne = (famille: "carte" | "fenetre" | "etiquette", debut: number, fin = debut + 2): Apparition => ({
  famille, debut, fin, nom: `${famille} à ${debut}`, type: famille === "carte" ? "liste" : "photo", couvre: false, pousse: true, plein: false, place: "haut", entree: "chute",
});

describe("D0 · l'élément existe, il est actif, sa durée est celle de la fiche", () => {
  const plan = (elementsV2: ElementV2Plan[]) => resoudreElementsV2(elementsV2, 20).erreurs;
  it("échoue : id inconnu, élément écarté (actif: false), durée hors fiche, fin avant le début, après la fin de la vidéo", () => {
    expect(plan([{ id: "licorne", debut: 1, fin: 2 }]).join("\n")).toMatch(/D0 — .*licorne.*n'existe pas/);
    expect(plan([{ id: "fleche-feutre", debut: 1, fin: 2.5 }]).join("\n")).toMatch(/D0 — .*ÉCARTÉ/);
    expect(plan([{ id: "mot-saute", debut: 1, fin: 4.5 }]).join("\n")).toMatch(/D0 — .*3,50 s à l'écran, la fiche prévoit de 1,00 s à 2,00 s/);
    expect(plan([{ id: "mot-saute", debut: 2, fin: 1.9 }]).join("\n")).toMatch(/D0 — .*avant d'avoir commencé/);
    expect(plan([{ id: "mot-saute", debut: 19, fin: 20.5 }]).join("\n")).toMatch(/D0 — .*après la fin de la vidéo/);
  });
  it("passe : un élément actif, de la bonne durée, dans la vidéo", () => {
    expect(plan([{ id: "mot-saute", debut: 1, fin: 2.2 }, { id: "demi-lune-bas", debut: 5, fin: 6.5 }])).toEqual([]);
  });
  it("D0 bloque le rendu, comme D1, D3, D4, D9 et D10 ; D2, D5 à D8, D11 à D15 sont des erreurs ordinaires", () => {
    for (const c of ["D0", "D1a", "D1f", "D3a", "D3c", "D4b", "D9a", "D9d", "D10a", "D10g", "D10h"]) expect(estRendableV2([`${c} — x`]), c).toBe(false);
    for (const c of ["D2a", "D5c", "D6a", "D7b", "D8a", "D11b", "D12a", "D13a", "D14", "D15e"]) expect(estRendableV2([`${c} — x`]), c).toBe(true);
    // Les anciens codes bloquants restent bloquants, les autres non ; D1 n'est pas confondu avec D10, D11, D12, D13.
    expect(estRendable(["R1c — x"])).toBe(false);
    expect(estRendable(["R2a — x"])).toBe(true);
    expect(estRendable(["D10a — x"])).toBe(false);
    expect(estRendable(["D11a — x", "D12a — y", "D13a — z"])).toBe(true);
  });
});

describe("D1 · jamais deux fois de suite le même emplacement, la même forme, le même mouvement, le même élément, le même sens, la même sortie", () => {
  it("D1a échoue : deux éléments à gauche de suite ; passe : gauche puis droite", () => {
    echoue(erreurs(suite(["mot-vertical-bord", "pastille-chiffre"])), "D1a");
    passe(erreurs(suite(["mot-vertical-bord", "pile-de-lettres"])), "D1a");
  });
  it("D1b échoue : deux disques F1 de suite (pastille, badge) ; passe : disque puis autocollant F3", () => {
    expect([fiche("pastille-chiffre").forme, fiche("badge-roulant").forme]).toEqual(["F1", "F1"]);
    echoue(erreurs(suite(["pastille-chiffre", "badge-roulant"])), "D1b");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot"])), "D1b");
  });
  it("D1c échoue : deux claquements M4 de suite (autocollant, mot-saute) ; passe : M4 puis M3", () => {
    expect([fiche("autocollant-mot").mouvement, fiche("mot-saute").mouvement]).toEqual(["M4", "M4"]);
    echoue(erreurs(suite(["autocollant-mot", "mot-saute"])), "D1c");
    passe(erreurs(suite(["autocollant-mot", "pastille-chiffre"])), "D1c");
  });
  it("D1d échoue : le même élément deux fois de suite ; passe : le même élément séparé par un autre", () => {
    echoue(erreurs(suite(["demi-lune-bas", "demi-lune-bas"])), "D1d");
    passe(erreurs(suite(["demi-lune-bas", "pastille-chiffre", "demi-lune-bas"])), "D1d");
  });
  it("D1e échoue : deux inclinaisons du même sens (+9° puis +7°) ; passe : on alterne + et −, ou on passe par 0", () => {
    echoue(erreurs([el("autocollant-mot", 10), el("pile-de-lettres", 13, { angle: 7 })]), "D1e");
    passe(erreurs([el("autocollant-mot", 10), el("pastille-chiffre", 13)]), "D1e");
    passe(erreurs([el("pastille-chiffre", 10), el("badge-roulant", 13)]), "D1e");
    // Le plan peut remplacer l'angle de la fiche : un −8° redressé à +8° devient du même sens que le suivant.
    echoue(erreurs([el("pastille-chiffre", 10, { angle: 8 }), el("autocollant-mot", 13)]), "D1e");
  });
  it("D1f échoue : deux envols de suite (éclat-mot, bandes) ; passe : envol puis aspiration", () => {
    expect([fiche("eclat-mot").sortie, fiche("bandes-diagonales").sortie]).toEqual(["envol", "envol"]);
    echoue(erreurs(suite(["eclat-mot", "bandes-diagonales"])), "D1f");
    passe(erreurs(suite(["eclat-mot", "pastille-chiffre"])), "D1f");
  });
});

describe("D2 · fenêtre de 5 apparitions : 4 emplacements, 4 formes, 4 mouvements différents, un latéral", () => {
  it("D2a échoue : 5 éléments sur 2 emplacements ; passe : 5 emplacements différents", () => {
    echoue(erreurs(suite(["pastille-chiffre", "mot-vertical-bord", "autocollant-mot", "pile-de-lettres", "bulle-cri"])), "D2a");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot", "eclat-mot", "badge-roulant", "blob-mot"])), "D2a");
  });
  it("D2b échoue : 3 formes seulement sur 5 ; passe : 4 formes", () => {
    echoue(erreurs(suite(["pastille-chiffre", "mot-vertical-bord", "autocollant-mot", "pile-de-lettres", "bulle-cri"])), "D2b");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot", "eclat-mot", "badge-roulant", "blob-mot"])), "D2b");
  });
  it("D2c échoue : 2 mouvements seulement sur 5 (M4, M1) ; passe : 4 mouvements", () => {
    echoue(erreurs(suite(["mot-saute", "autocollant-mot", "bulle-cri", "eclat-mot", "demi-lune-bas"])), "D2c");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot", "eclat-mot", "badge-roulant", "blob-mot"])), "D2c");
  });
  it("D2d échoue : aucun élément latéral (E2 ou E3) sur 5 ; passe : un latéral", () => {
    echoue(erreurs(suite(["eclat-mot", "mot-saute", "bandes-diagonales", "demi-lune-bas", "losange-crans"])), "D2d");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot", "eclat-mot", "badge-roulant", "blob-mot"])), "D2d");
  });
  it("la fenêtre glisse : une suite de 6 dont seule la 2ᵉ fenêtre est pauvre en formes échoue ; moins de 5 éléments n'est pas jugé", () => {
    const r = erreurs(suite(["pastille-chiffre", "autocollant-mot", "mot-vertical-bord", "eclat-mot", "bulle-cri", "pile-de-lettres"]));
    expect(avec(r, "D2b")).toHaveLength(1);
    expect(avec(r, "D2b")[0]).toContain("de 13,00 s à 25,00 s");
    passe(erreurs(suite(["pastille-chiffre", "mot-vertical-bord", "autocollant-mot", "pile-de-lettres"])), "D2b");
  });
});

describe("D3 · fenêtre glissante de 60 s : les 6 emplacements E1 à E6, E2 et E3 ensemble 3 fois, E4 ≤ 30 %", () => {
  const SIX = ["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "mot-saute", "bandes-diagonales"]; // E1 E2 E3 E4 E5 E6
  const rotation = (n: number, ids = SIX) => Array.from({ length: n }, (_, k) => ids[k % ids.length]);
  it("D3a échoue : il manque E5 (halo) sur 60 s ; passe : les 6 emplacements reviennent", () => {
    echoue(erreurs(suite(rotation(18, SIX.filter((i) => i !== "mot-saute")), 10, 4)), "D3a");
    passe(erreurs(suite(rotation(18), 10, 4)), "D3a");
  });
  it("D3a ne juge pas une vidéo de moins de 60 s ; D3b échoue : 2 latéraux sur 60 s, passe : 4", () => {
    passe(erreurs(suite(["eclat-mot", "mot-saute", "bandes-diagonales"], 5, 4), { duree: 30, finDebut: 28 }), "D3a");
    const pauvre = ["eclat-mot", "mot-saute", "pastille-chiffre", "demi-lune-bas", "bandes-diagonales", "autocollant-mot"];
    echoue(erreurs(suite(pauvre, 5, 12), { duree: 90, finDebut: 88 }), "D3b");
    passe(erreurs(suite(rotation(18), 10, 4)), "D3b");
  });
  it("D3c échoue : 4 éléments en bas sur 10 (40 %) ; passe : 3 sur 10 (30 %)", () => {
    const quatre = ["demi-lune-bas", "eclat-mot", "blob-mot", "pastille-chiffre", "demi-lune-bas", "mot-saute", "blob-mot", "autocollant-mot", "bandes-diagonales", "mot-vertical-bord"];
    echoue(erreurs(suite(quatre, 6, 3), { duree: 40, finDebut: 38 }), "D3c");
    const trois = ["demi-lune-bas", "eclat-mot", "blob-mot", "pastille-chiffre", "mot-saute", "autocollant-mot", "bandes-diagonales", "mot-vertical-bord", "demi-lune-bas", "badge-roulant"];
    passe(erreurs(suite(trois, 6, 3), { duree: 40, finDebut: 38 }), "D3c");
  });
});

describe("D4 · rectangles (cartes, fenêtres, étiquettes) : ≤ 35 %, jamais 2 de suite, une carte par fenêtre de 12 s, formes préférées ≥ 50 %", () => {
  // 7 éléments v2 : avec 3 rectangles anciens, 10 apparitions ; avec 4, 11.
  const dix = suite(["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "mot-saute", "blob-mot", "badge-roulant"], 10, 3);
  it("D4a échoue : 4 rectangles sur 11 apparitions (36 %) ; passe : 3 sur 10 (30 %)", () => {
    const quatre = [ancienne("carte", 6), ancienne("fenetre", 9), ancienne("etiquette", 12), ancienne("carte", 30)];
    echoue(erreurs(dix, { anciennes: quatre, duree: 60, finDebut: 58 }), "D4a");
    const trois = [ancienne("carte", 6), ancienne("fenetre", 9), ancienne("etiquette", 30)];
    passe(erreurs(dix, { anciennes: trois, duree: 60, finDebut: 58 }), "D4a");
  });
  it("D4b échoue : deux rectangles de suite ; passe : un élément v2 entre les deux", () => {
    echoue(erreurs(dix, { anciennes: [ancienne("carte", 40), ancienne("fenetre", 42)], duree: 60, finDebut: 58 }), "D4b");
    passe(erreurs(dix, { anciennes: [ancienne("carte", 6), ancienne("fenetre", 19)], duree: 60, finDebut: 58 }), "D4b");
  });
  it("D4c échoue : deux cartes à 8 s d'écart ; passe : 12 s", () => {
    echoue(erreurs(dix, { debutsCartes: [20, 28], duree: 60, finDebut: 58 }), "D4c");
    passe(erreurs(dix, { debutsCartes: [20, 32], duree: 60, finDebut: 58 }), "D4c");
  });
  it("D4d échoue : 4 formes préférées sur 10 (40 %) ; passe : 10 sur 10", () => {
    const peu = suite(["bandes-diagonales", "eclat-mot", "losange-crans", "tampon-dechirure", "pastille-chiffre", "duel-triangles", "autocollant-mot", "rafale-trois-mots", "badge-roulant", "eclat-chiffre"], 5, 4);
    echoue(erreurs(peu, { duree: 60, finDebut: 58 }), "D4d");
    const beaucoup = suite(["eclat-mot", "pastille-chiffre", "autocollant-mot", "mot-saute", "blob-mot", "badge-roulant", "mot-vertical-bord", "bulle-cri", "demi-lune-bas", "pile-de-lettres"], 5, 4);
    passe(erreurs(beaucoup, { duree: 60, finDebut: 58 }), "D4d");
  });
});

describe("D5 · asymétrie : ≥ 60 % inclinés de 3 à 14°, ≤ 30 % centrés, les latéraux alternent gauche / droite", () => {
  const dixId = ["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "mot-saute", "blob-mot", "badge-roulant", "mot-vertical-bord", "bulle-cri", "pile-de-lettres"];
  it("D5a échoue : tout est droit (0°) ; passe : tous inclinés de 8°", () => {
    echoue(erreurs(suite(dixId, 5, 4).map((e) => ({ ...e, angle: 0 })), { duree: 60, finDebut: 58 }), "D5a");
    passe(erreurs(suite(dixId, 5, 4).map((e, k) => ({ ...e, angle: k % 2 ? -8 : 8 })), { duree: 60, finDebut: 58 }), "D5a");
  });
  it("D5b échoue : 8 éléments sur 10 centrés sur l'axe ; passe : aucun", () => {
    const centres = ["bandes-diagonales", "demi-lune-bas", "tampon-dechirure", "pastille-chiffre", "duel-triangles", "autocollant-mot", "rafale-trois-mots", "eclat-mot", "eclat-chiffre", "badge-roulant"];
    echoue(erreurs(suite(centres, 5, 4), { duree: 60, finDebut: 58 }), "D5b");
    passe(erreurs(suite(dixId.filter((i) => i !== "demi-lune-bas").concat("eclat-mot"), 5, 4), { duree: 60, finDebut: 58 }), "D5b");
  });
  it("D5c échoue : deux latéraux à gauche, même séparés par un élément du bas ; passe : gauche puis droite", () => {
    echoue(erreurs(suite(["pastille-chiffre", "demi-lune-bas", "mot-vertical-bord"])), "D5c");
    passe(erreurs(suite(["pastille-chiffre", "demi-lune-bas", "pile-de-lettres"])), "D5c");
  });
  it("les règles à pourcentage (D3c, D4, D5a, D5b, D7a) ne se jugent qu'à partir de 10 éléments : quotas de vidéo, pas d'extrait", () => {
    expect(SEUILS_V2.statistiqueMin).toBe(10);
    passe(erreurs(suite(dixId.slice(0, 8), 5, 4).map((e) => ({ ...e, angle: 0 })), { duree: 60, finDebut: 58 }), "D5a");
  });
});

describe("D6 · contraste de taille : jamais 3 de suite dans la même classe, un « grand » au moins toutes les 10 s", () => {
  it("D6a échoue : trois éléments moyens de suite ; passe : moyen, moyen, grand", () => {
    echoue(erreurs(suite(["pastille-chiffre", "autocollant-mot", "eclat-mot"])), "D6a");
    passe(erreurs(suite(["pastille-chiffre", "autocollant-mot", "demi-lune-bas"])), "D6a");
  });
  it("D6b échoue : 25 s sans élément grand ; passe : un grand toutes les 8 s", () => {
    echoue(erreurs(suite(["pastille-chiffre", "bulle-cri", "mot-saute", "autocollant-mot", "eclat-mot", "badge-roulant", "blob-mot", "pile-de-lettres"], 2, 3), { duree: 25, finDebut: 25 }), "D6b");
    const bonne = [el("pastille-chiffre", 1.2), el("demi-lune-bas", 4), el("eclat-mot", 9), el("bandes-diagonales", 13), el("pile-de-lettres", 17), el("tampon-dechirure", 21)];
    passe(erreurs(bonne, { duree: 25, finDebut: 25 }), "D6b");
  });
});

describe("D7 · orange : un élément sur trois avec ≥ 3 % d'orange plein, un par fenêtre de 8 s", () => {
  it("D7a échoue : 1 élément orange sur 10 ; passe : tous", () => {
    const pale = suite(["scotch-postit", "fleche-feutre", "traits-vitesse", "onde-de-choc", "mot-barre-remplace", "mot-saute", "bulle-cri", "scotch-postit", "fleche-feutre", "badge-roulant"], 5, 4);
    echoue(erreurs(pale, { duree: 60, finDebut: 58 }), "D7a");
    const vif = suite(["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "blob-mot", "badge-roulant", "mot-vertical-bord", "pile-de-lettres", "losange-crans", "bandes-diagonales"], 5, 4);
    passe(erreurs(vif, { duree: 60, finDebut: 58 }), "D7a");
  });
  it("D7b échoue : 10 s sans élément orange à l'écran ; passe : un orange chevauche chaque fenêtre de 8 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("mot-saute", 3), el("bulle-cri", 14)], { duree: 24, finDebut: 24 }), "D7b");
    passe(erreurs([el("eclat-mot", 1.2), el("pastille-chiffre", 4), el("blob-mot", 8), el("badge-roulant", 12), el("demi-lune-bas", 16)], { duree: 20, finDebut: 20 }), "D7b");
  });
});

describe("D8 · secousse : une seule par tranche de 4 s, de l'élément seul ; la prise ne bouge jamais", () => {
  it("D8a échoue : deux secousses à 1,5 s d'écart (autocollant puis bulle) ; passe : 4 s et plus", () => {
    echoue(erreurs([el("autocollant-mot", 10), el("bulle-cri", 11.5)]), "D8a");
    passe(erreurs([el("autocollant-mot", 10), el("bulle-cri", 14.5)]), "D8a");
    passe(erreurs([el("autocollant-mot", 10), el("pastille-chiffre", 11.5), el("pile-de-lettres", 13)]), "D8a");
  });
  it("D8b échoue : la prise porte un zoom ou un mouvement de cadrage ; passe : prise immobile", () => {
    echoue(erreurs([el("eclat-mot", 1.2)], { prisBougee: true }), "D8b");
    passe(erreurs([el("eclat-mot", 1.2)], { prisBougee: false }), "D8b");
  });
});

describe("D9 · ouverture : premier élément entre 0,8 et 2,0 s, vif et entier ; rien ne couvre le visage avant 5 s ; aucun plein écran avant 10 s", () => {
  it("D9a échoue : 0,3 s (trop tôt), 3 s (trop tard) ; passe : 1,2 s", () => {
    echoue(erreurs([el("eclat-mot", 0.3)]), "D9a");
    echoue(erreurs([el("eclat-mot", 3)]), "D9a");
    passe(erreurs([el("eclat-mot", 1.2)]), "D9a");
  });
  it("D9a échoue aussi quand le premier objet est une carte de l'ancien catalogue ; passe quand l'élément v2 vient d'abord", () => {
    echoue(erreurs([el("eclat-mot", 5)], { anciennes: [ancienne("etiquette", 1.2)] }), "D9a");
    passe(erreurs([el("eclat-mot", 1.2)], { anciennes: [ancienne("etiquette", 6)] }), "D9a");
  });
  it("D9b échoue : l'ouverture est une demi-lune (E4) ; passe : une accroche (mot-saute en E5)", () => {
    echoue(erreurs([el("demi-lune-bas", 1.2)]), "D9b");
    passe(erreurs([el("mot-saute", 1.2)]), "D9b");
    // Les 6 accroches du standard.
    for (const id of ["mot-saute", "eclat-mot", "autocollant-mot", "pastille-chiffre", "bulle-cri", "onde-de-choc"]) passe(erreurs([el(id, 1.2)]), "D9b");
  });
  it("D9c échoue : un coup de poing couvre le visage à 4 s ; passe : à 12 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("dalle-claquee", 4)]), "D9c");
    passe(erreurs([el("eclat-mot", 1.2), el("dalle-claquee", 12)]), "D9c");
  });
  it("D9d échoue : un plein écran à 8 s ; passe : à 10,5 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("dalle-claquee", 8)]), "D9d");
    passe(erreurs([el("eclat-mot", 1.2), el("dalle-claquee", 10.5)]), "D9d");
  });
});

describe("D10 · coups de poing (P1 à P5)", () => {
  it("D10a échoue : le premier à 8 s ou à 20 s ; passe : à 12 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 8)]), "D10a");
    echoue(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 20)]), "D10a");
    passe(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 12)]), "D10a");
  });
  it("D10b échoue : 10 s entre deux coups de poing ; passe : 25 s", () => {
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 22)]), "D10b");
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 50)]), "D10b");
    passe(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 37)]), "D10b");
  });
  it("D10c échoue : un seul coup de poing sur 90 s (3 au moins), 5 sur 90 s (4 au plus) ; passe : 3 ou 4", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 12)]), "D10c");
    echoue(erreurs(["tampon-dechirure", "dalle-claquee", "duel-triangles", "rafale-trois-mots", "eclat-chiffre"].map((id, k) => el(id, 12 + 19 * k))), "D10c");
    passe(erreurs(["tampon-dechirure", "dalle-claquee", "duel-triangles"].map((id, k) => el(id, 12 + 22 * k))), "D10c");
    // Une vidéo courte (15 s) n'en demande pas, mais un seul au plus.
    passe(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 10.7)], { duree: 15, finDebut: 15 }), "D10c");
    echoue(erreurs([el("tampon-dechirure", 10.1), el("dalle-claquee", 13.5)], { duree: 16, finDebut: 16 }), "D10c");
  });
  it("D10d échoue : le même coup de poing deux fois ; passe : deux types différents", () => {
    echoue(erreurs([el("tampon-dechirure", 12), el("tampon-dechirure", 37)]), "D10d");
    passe(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 37)]), "D10d");
  });
  it("D10e échoue : 3 plein écran en 60 s ; passe : 2 (un ancien volet compte avec les coups de poing)", () => {
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 34), el("duel-triangles", 56)]), "D10e");
    passe(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 34)]), "D10e");
    const volet: Apparition = { ...ancienne("carte", 50, 52), famille: "volet", plein: true, couvre: true };
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 34)], { anciennes: [volet] }), "D10e");
  });
  it("D10f échoue : le dernier coup de poing tombe 5 s avant la carte de fin ; passe : 20 s avant", () => {
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 35), el("duel-triangles", 58), el("eclat-chiffre", 80)], { finDebut: 85 }), "D10f");
    passe(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 35), el("duel-triangles", 58)], { finDebut: 85 }), "D10f");
  });
  it("D10g échoue : un élément 0,5 s après le coup de poing ; un grand ou un rectangle juste après ; passe : 1 s de Will seul puis un moyen", () => {
    echoue(erreurs([el("dalle-claquee", 12, { fin: 12.9 }), el("pastille-chiffre", 13.4)]), "D10g");
    echoue(erreurs([el("dalle-claquee", 12, { fin: 12.9 }), el("demi-lune-bas", 14.5)]), "D10g");
    echoue(erreurs([el("dalle-claquee", 12, { fin: 12.9 })], { anciennes: [ancienne("carte", 14.5)] }), "D10g");
    passe(erreurs([el("dalle-claquee", 12, { fin: 12.9 }), el("pastille-chiffre", 14)]), "D10g");
    passe(erreurs([el("dalle-claquee", 12, { fin: 12.9 }), el("bulle-cri", 14)]), "D10g");
  });
  it("D10h échoue : deux plein écran consécutifs ; passe : un élément entre les deux", () => {
    echoue(erreurs([el("tampon-dechirure", 12), el("dalle-claquee", 40)]).concat(erreurs([el("tampon-dechirure", 12, { fin: 13 }), el("dalle-claquee", 13.2)])), "D10h");
    passe(erreurs([el("tampon-dechirure", 12), el("pastille-chiffre", 15), el("dalle-claquee", 37)]), "D10h");
  });
});

describe("D11 · cadence : un événement toutes les 1 à 2,5 s, jamais plus de 3 s sans objet, 0,4 s au moins entre deux débuts", () => {
  it("D11a échoue : 10 apparitions pour 90 s (9 s l'une) ; passe : 10 apparitions pour 20 s", () => {
    echoue(erreurs(suite(["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "mot-saute", "blob-mot", "badge-roulant", "mot-vertical-bord", "bulle-cri", "pile-de-lettres"], 2, 9)), "D11a");
    passe(erreurs(suite(["eclat-mot", "pastille-chiffre", "autocollant-mot", "demi-lune-bas", "mot-saute", "blob-mot", "badge-roulant", "mot-vertical-bord", "bulle-cri", "pile-de-lettres"], 1.5, 1.9), { duree: 20, finDebut: 20 }), "D11a");
  });
  it("D11b échoue : 5 s sans rien ; passe : jamais plus de 3 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("pastille-chiffre", 6.2)], { duree: 8, finDebut: 8 }), "D11b");
    passe(erreurs([el("eclat-mot", 1.2), el("pastille-chiffre", 3.5), el("blob-mot", 6)], { duree: 8, finDebut: 8 }), "D11b");
  });
  it("D11c échoue : deux débuts à 0,2 s ; passe : 1,5 s", () => {
    echoue(erreurs([el("eclat-mot", 1.2), el("pastille-chiffre", 1.4)], { duree: 8, finDebut: 8 }), "D11c");
    passe(erreurs([el("eclat-mot", 1.2), el("pastille-chiffre", 2.7)], { duree: 8, finDebut: 8 }), "D11c");
  });
});

describe("D12 · bruitages : jamais le même fichier deux fois de suite, un même bruitage ≤ 30 %", () => {
  it("D12a échoue : bandes (…drop_001) puis pile (drop_001…) ; passe : un autre son entre", () => {
    expect(fiche("bandes-diagonales").bruitages.at(-1)).toBe("drop_001");
    expect(fiche("pile-de-lettres").bruitages[0]).toBe("drop_001");
    echoue(erreurs(suite(["bandes-diagonales", "pile-de-lettres"])), "D12a");
    passe(erreurs(suite(["bandes-diagonales", "pastille-chiffre", "pile-de-lettres"])), "D12a");
  });
  it("D12b échoue : « drop » fait plus de 30 % des sons ; passe : des sons variés", () => {
    const drops = ["bandes-diagonales", "pile-de-lettres", "autocollant-mot", "duel-triangles", "dalle-claquee", "blob-mot", "tampon-dechirure"];
    // 7 éléments : « drop » (chacun une fois par élément) + autres ; au moins 7 sons comptés.
    echoue(erreurs(suite(drops, 5, 4), { duree: 60, finDebut: 58 }), "D12b");
    passe(erreurs(suite(["pastille-chiffre", "mot-vertical-bord", "losange-crans", "demi-lune-bas", "bulle-cri", "badge-roulant", "eclat-mot"], 5, 4), { duree: 60, finDebut: 58 }), "D12b");
  });
});

describe("D13 · d'une vidéo à l'autre : emplacement et forme du 1er élément, type du 1er coup de poing, présence des 5 lots", () => {
  const prec = (o: object) => ({ types: [], entrees: [], ...o });
  it("D13a échoue : même emplacement de 1er élément que l'une des 3 vidéos précédentes ; passe : un autre", () => {
    const h = [prec({ premierV2: { emplacement: "E1", forme: "F9" } })];
    echoue(erreurs([el("eclat-mot", 1.2)], { historique: h }), "D13a");
    passe(erreurs([el("pastille-chiffre", 1.2)], { historique: h }), "D13a");
    // La 4ᵉ vidéo en arrière n'est plus regardée.
    passe(erreurs([el("eclat-mot", 1.2)], { historique: [prec({}), prec({}), prec({}), prec({ premierV2: { emplacement: "E1", forme: "F9" } })] }), "D13a");
  });
  it("D13b échoue : même forme de 1er élément (F5) ; passe : une autre", () => {
    const h = [prec({ premierV2: { emplacement: "E4", forme: "F5" } })];
    echoue(erreurs([el("eclat-mot", 1.2)], { historique: h }), "D13b");
    passe(erreurs([el("pastille-chiffre", 1.2)], { historique: h }), "D13b");
  });
  it("D13c échoue : même premier coup de poing que la vidéo précédente ; passe : un autre", () => {
    const h = [prec({ premierCoupV2: "P1" })];
    echoue(erreurs([el("eclat-mot", 1.2), el("dalle-claquee", 12)], { historique: h }), "D13c");
    passe(erreurs([el("eclat-mot", 1.2), el("tampon-dechirure", 12)], { historique: h }), "D13c");
  });
  it("D13d échoue : une vidéo de 90 s sans le lot 4 ; passe : les 5 lots", () => {
    echoue(erreurs(suite(["autocollant-mot", "pastille-chiffre", "mot-saute", "blob-mot"], 5, 20)), "D13d");
    passe(erreurs(suite(["autocollant-mot", "pastille-chiffre", "mot-saute", "eclat-mot", "blob-mot"], 5, 15)), "D13d");
    passe(erreurs(suite(["autocollant-mot", "pastille-chiffre"], 5, 8), { duree: 40, finDebut: 38 }), "D13d");
  });
});

describe("D14 · chaque élément au plus 3 fois par vidéo (2 pour 1, 11, 23 ; 1 pour la pile, les coups de poing…)", () => {
  it("échoue : l'autocollant 3 fois (2 au plus), la pile 2 fois (1 au plus) ; passe : dans les quotas", () => {
    const e1 = ["autocollant-mot", "pastille-chiffre", "autocollant-mot", "mot-vertical-bord", "autocollant-mot"];
    echoue(erreurs(suite(e1, 5, 10)), "D14");
    echoue(erreurs(suite(["pile-de-lettres", "pastille-chiffre", "pile-de-lettres"], 5, 10)), "D14");
    passe(erreurs(suite(["autocollant-mot", "pastille-chiffre", "autocollant-mot"], 5, 10)), "D14");
    passe(erreurs(suite(["blob-mot", "pastille-chiffre", "blob-mot", "mot-vertical-bord", "blob-mot"], 5, 10)), "D14");
  });
});

describe("D15 · littéralité : les mots et les chiffres affichés sont ceux que Will dit, jamais « Villeexemple »", () => {
  const mots: MotTranscrit[] = [
    { w: "Vos", a: 1, f: 1.2 }, { w: "devis", a: 1.3, f: 1.7 }, { w: "trois", a: 5, f: 5.3 }, { w: "heures", a: 5.4, f: 5.8 },
    { w: "Réglé.", a: 8, f: 8.4 }, { w: "l'agenda", a: 9, f: 9.5 },
  ];
  it("D15a échoue : un mot-clé sans texte, ou trop de textes ; passe : le bon nombre", () => {
    echoue(erreurs([el("autocollant-mot", 1.2)]), "D15a");
    echoue(erreurs([el("autocollant-mot", 1.2, { mots: ["DEVIS", "AUTRE"] })]), "D15a");
    passe(erreurs([el("autocollant-mot", 1.2, { mots: ["DEVIS"] })]), "D15a");
  });
  it("D15b échoue : « Villeexemple » affiché ; passe : un autre lieu dit", () => {
    echoue(erreurs([el("autocollant-mot", 1.2, { mots: ["VILLEEXEMPLE"] })]), "D15b");
    passe(erreurs([el("autocollant-mot", 1.2, { mots: ["DEVIS"] })]), "D15b");
  });
  it("D15c échoue : la pastille-chiffre sans nombre ; passe : avec un nombre", () => {
    echoue(erreurs([el("pastille-chiffre", 5, { mots: ["TROIS"] })]), "D15c");
    passe(erreurs([el("pastille-chiffre", 5, { mots: ["3"] })]), "D15c");
  });
  it("D15d échoue : le chiffre 7 n'est pas dit ; passe : 3 est dit (« trois ») juste avant", () => {
    echoue(erreurs([el("pastille-chiffre", 5, { mots: ["7"] })], {}, mots), "D15d");
    passe(erreurs([el("pastille-chiffre", 5, { mots: ["3"] })], {}, mots), "D15d");
  });
  it("D15e échoue : le mot « factures » n'est pas dit ; passe : « devis » l'est (casse, accents, élision ignorés)", () => {
    echoue(erreurs([el("autocollant-mot", 1.2, { mots: ["FACTURES"] })], {}, mots), "D15e");
    passe(erreurs([el("autocollant-mot", 1.2, { mots: ["DEVIS"] })], {}, mots), "D15e");
    passe(erreurs([el("tampon-dechirure", 8, { mots: ["RÉGLÉ"] })], {}, mots), "D15e");
    passe(erreurs([el("pile-de-lettres", 9, { mots: ["AGENDA"] })], {}, mots), "D15e");
    // Hors de la fenêtre [début − 2 s, fin + 1 s] le mot ne compte pas.
    echoue(erreurs([el("autocollant-mot", 20, { mots: ["DEVIS"] })], {}, mots), "D15e");
  });
});

describe("branchement : `verifierPlan` applique D0 à D15 aux plans qui portent `elementsV2`, et rien aux autres", () => {
  const plan = (elementsV2?: ElementV2Plan[]): PlanFacecamAnimee => ({ ...planValide(), ...(elementsV2 ? { elementsV2 } : {}) });
  const BON: ElementV2Plan[] = [
    { id: "eclat-mot", debut: 1.2, fin: 2.5, mots: ["DEVIS"] },
    { id: "pastille-chiffre", debut: 3.5, fin: 4.8, mots: ["45"] },
  ];

  it("un plan sans éléments v2 n'est pas concerné (aucune erreur D, mesures nulles)", () => {
    const r = controlerDiversiteV2(plan());
    expect(r).toEqual({ erreurs: [], avertissements: [], mesures: null });
    expect(verifierPlan(plan(), MOTS).erreurs.filter((e) => /^D\d/.test(e))).toEqual([]);
  });

  it("deux éléments à gauche de suite : l'erreur D1a remonte dans `verifierPlan` et le plan n'est pas rendable", () => {
    const mauvais: ElementV2Plan[] = [
      { id: "pastille-chiffre", debut: 1.2, fin: 2.5, mots: ["45"] },
      { id: "mot-vertical-bord", debut: 3, fin: 4.6, mots: ["DEVIS"] },
    ];
    const r = verifierPlan(plan(mauvais), MOTS);
    echoue(r.erreurs, "D1a");
    expect(r.rendable).toBe(false);
  });

  it("D9a : un plan dont le premier élément arrive à 0,3 s n'est pas rendable", () => {
    const r = verifierPlan(plan([{ id: "eclat-mot", debut: 0.3, fin: 1.5, mots: ["DEVIS"] }]), MOTS);
    echoue(r.erreurs, "D9a");
    expect(r.rendable).toBe(false);
  });

  it("D0 : un élément écarté remonte comme erreur bloquante", () => {
    const r = verifierPlan(plan([{ id: "fleche-feutre", debut: 1.2, fin: 2.5, mots: ["DEVIS"] }]), MOTS);
    echoue(r.erreurs, "D0");
    expect(r.rendable).toBe(false);
  });

  it("une erreur ordinaire (D5c) ne bloque pas le rendu", () => {
    const e = [{ id: "pastille-chiffre", debut: 1.2, fin: 2.5, mots: ["45"] }, { id: "demi-lune-bas", debut: 3.5, fin: 5, mots: ["DEVIS"] }, { id: "mot-vertical-bord", debut: 5.5, fin: 7.1, mots: ["DEVIS"] }];
    const r = controlerDiversiteV2(plan(e), { mots: MOTS });
    echoue(r.erreurs, "D5c");
    expect(estRendable(r.erreurs.filter((x) => x.startsWith("D5c")))).toBe(true);
  });

  it("l'ancien contrôle ne réclame plus la variété des 15 familles (R5) ni la cadence (R5d) à un plan v2 : D2, D3 et D11 la jugent", () => {
    const sansV2 = controlerDiversite({ ...plan(), cartes: [], fenetres: [], calques: [], motions: [] }).erreurs;
    expect(sansV2.some((e) => e.startsWith("R5d — aucun objet"))).toBe(true);
    const avecV2 = controlerDiversite({ ...plan(BON), cartes: [], fenetres: [], calques: [], motions: [] }).erreurs;
    expect(avecV2.filter((e) => /^R5/.test(e))).toEqual([]);
  });

  it("l'historique garde le premier élément v2 et le premier coup de poing (D13), et reste inchangé sans éléments v2", () => {
    const h = historiqueDuPlan(plan([...BON, { id: "dalle-claquee", debut: 12, fin: 13, mots: ["STOP"] }]));
    expect(h.premierV2).toEqual({ emplacement: "E1", forme: "F5" });
    expect(h.premierCoupV2).toBe("P1");
    expect(h.lotsV2).toEqual([2, 4, 5]);
    const sans = historiqueDuPlan(plan());
    expect("premierV2" in sans).toBe(false);
    expect("premierCoupV2" in sans).toBe(false);
  });

  it("le schéma du plan accepte `elementsV2` (facultatif) et refuse un élément sans id", () => {
    expect(schemaPlanFacecamAnimee.safeParse(plan(BON)).success).toBe(true);
    expect(schemaPlanFacecamAnimee.safeParse(plan()).success).toBe(true);
    expect(schemaPlanFacecamAnimee.safeParse(plan([{ id: "", debut: 1, fin: 2 }])).success).toBe(false);
  });
});
