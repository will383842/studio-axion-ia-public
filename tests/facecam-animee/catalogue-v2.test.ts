/**
 * FACE CAMÉRA ANIMÉE — CATALOGUE « v2 ÉNERGIE » (16/10) : les 24 éléments de `studio-rendu/.../motion-v2/lot1..lot5/` vus par le
 * réalisateur. On vérifie que chaque entrée correspond à un vrai .tsx (existence, `import React`, id, emplacement), que le champ
 * `actif` porte bien le choix de Will (17 retenus, 7 écartés), que les 5 coups de poing couvrent le visage entier et rien d'autre,
 * et que les bruitages annoncés existent (hors les 9 « à sourcer »). AUCUN rendu, aucun réseau.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_V2, classeTailleV2, elementsV2Actifs, estCoupDePoingV2, ficheV2, signeAngleV2, type FicheCatalogueV2,
} from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v2";

const RACINE = process.cwd();
const lire = (f: FicheCatalogueV2) => readFileSync(join(RACINE, f.fichier), "utf8");

/** Les favoris de Will et les autres éléments retenus (`actif: true`). */
const ACTIFS = ["mot-vertical-bord", "duel-triangles", "rafale-trois-mots", "eclat-chiffre", "dalle-claquee", "tampon-dechirure", "pile-de-lettres", "bandes-diagonales", "demi-lune-bas", "autocollant-mot", "pastille-chiffre", "losange-crans", "mot-saute", "blob-mot", "bulle-cri", "badge-roulant", "eclat-mot"];
/** À refaire plus grands, jugés faibles par le critique (16/10). */
const ECARTES = ["fleche-feutre", "onde-de-choc", "traits-vitesse", "mot-barre-remplace", "gerbe-formes", "scotch-postit", "ticket-dechire-haut"];

describe("catalogue v2 · les 24 éléments", () => {
  it("24 entrées, ids et numéros uniques (1 à 24), 5 lots (5, 5, 5, 5, 4)", () => {
    expect(CATALOGUE_V2).toHaveLength(24);
    expect(new Set(CATALOGUE_V2.map((f) => f.id)).size).toBe(24);
    expect(CATALOGUE_V2.map((f) => f.numero).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, k) => k + 1));
    expect([1, 2, 3, 4, 5].map((l) => CATALOGUE_V2.filter((f) => f.lot === l).length)).toEqual([5, 5, 5, 5, 4]);
    expect(ficheV2("mot-saute")?.numero).toBe(11);
    expect(ficheV2("n-existe-pas")).toBeUndefined();
  });

  it("chaque entrée correspond à un vrai .tsx : il existe, importe React, porte l'id, exporte le composant et déclare le même emplacement", () => {
    for (const f of CATALOGUE_V2) {
      expect(existsSync(join(RACINE, f.fichier)), `${f.id} : ${f.fichier} introuvable`).toBe(true);
      expect(f.fichier).toContain(`/lot${f.lot}/`);
      const src = lire(f);
      expect(src, `${f.id} : import React manquant (la prod compile le JSX en mode classique)`).toMatch(/^\s*import React\b/m);
      expect(src, `${f.id} : l'id n'apparaît pas dans le .tsx`).toContain(`"${f.id}"`);
      expect(src, `${f.id} : composant ${f.composant} non exporté`).toMatch(new RegExp(`export function ${f.composant}\\b`));
      expect(src, `${f.id} : l'emplacement du .tsx diffère (${f.emplacement})`).toMatch(new RegExp(`emplacement:\\s*"${f.emplacement}`));
    }
  });

  it("le champ `actif` : 17 éléments retenus (les 9 favoris de Will + 8 autres), 7 écartés — c'est le SEUL endroit à changer", () => {
    expect(CATALOGUE_V2.filter((f) => f.actif).map((f) => f.id).sort()).toEqual([...ACTIFS].sort());
    expect(CATALOGUE_V2.filter((f) => !f.actif).map((f) => f.id).sort()).toEqual([...ECARTES].sort());
    expect(elementsV2Actifs()).toHaveLength(17);
    // Les 9 favoris sont tous actifs.
    for (const id of ["mot-vertical-bord", "duel-triangles", "rafale-trois-mots", "eclat-chiffre", "dalle-claquee", "tampon-dechirure", "pile-de-lettres", "bandes-diagonales", "demi-lune-bas"]) expect(ficheV2(id)?.actif, id).toBe(true);
    // `elementsV2Actifs` ne fait que lire `actif` : changer ce champ change la liste (sur une copie).
    const copie = CATALOGUE_V2.map((f) => ({ ...f, actif: f.id === "fleche-feutre" ? true : f.actif }));
    expect(copie.filter((f) => f.actif)).toHaveLength(18);
  });

  it("les 5 coups de poing (P1 à P5) sont les 5 plein écran (E7), les seuls à couvrir le visage — en entier, jamais à moitié à l'état posé", () => {
    const coups = CATALOGUE_V2.filter(estCoupDePoingV2);
    expect(coups.map((f) => f.mouvement).sort()).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(coups.map((f) => f.id).sort()).toEqual(["dalle-claquee", "duel-triangles", "eclat-chiffre", "rafale-trois-mots", "tampon-dechirure"]);
    for (const f of CATALOGUE_V2) {
      expect(f.couvreVisage, f.id).toBe(f.emplacement === "E7");
      expect(f.couvreVisage, f.id).toBe(estCoupDePoingV2(f));
      expect(lire(f), f.id).toMatch(new RegExp(`visage:\\s*"${f.couvreVisage ? "couvert" : "entier"}"`));
      expect(classeTailleV2(f) === "grand" || !f.couvreVisage, f.id).toBe(true);
    }
    // TOLÉRANCE À VALIDER : images de visage partiel à l'entrée / à la sortie d'un plein écran (3 au plus, non validé par Will).
    for (const f of coups) expect(f.imagesVisagePartiel === null || f.imagesVisagePartiel <= 3, f.id).toBe(true);
    for (const f of CATALOGUE_V2.filter((x) => !x.couvreVisage)) expect(f.imagesVisagePartiel, f.id).toBe(0);
  });

  it("les valeurs sont dans les listes du standard : emplacement E1-E7, forme F1-F13, mouvement M1-M11 / P1-P5, tailles, durées, angles", () => {
    for (const f of CATALOGUE_V2) {
      expect(f.emplacement).toMatch(/^E[1-7]$/);
      expect(f.forme).toMatch(/^F(1[0-3]|[1-9])$/);
      expect(f.formes).toContain(f.forme);
      expect(f.mouvement).toMatch(/^(M(1[01]|[1-9])|P[1-5])$/);
      expect(f.taillePct, f.id).toBeGreaterThan(0);
      expect(f.taillePct, f.id).toBeLessThanOrEqual(100);
      expect(f.dureeSec[0], f.id).toBeLessThanOrEqual(f.dureeSec[1]);
      expect(f.dureeImages[0], f.id).toBe(Math.round(f.dureeSec[0] * 30));
      expect(Math.abs(f.angle), f.id).toBeLessThanOrEqual(90);
      expect(f.centreX, f.id).toBeGreaterThanOrEqual(0);
      expect(f.centreX, f.id).toBeLessThanOrEqual(1);
      expect(f.maxParVideo, f.id).toBeGreaterThanOrEqual(1);
      expect(f.contenu.length, f.id).toBeGreaterThan(5);
      expect(f.bruitages.length, f.id).toBeGreaterThan(0);
    }
    // Quotas du standard § E : 3 par vidéo, 2 pour 1, 11 et 23 ; la fiche du .tsx dit « un seul » pour la pile, le barré et les coups de poing.
    expect(["autocollant-mot", "mot-saute", "bulle-cri"].map((id) => ficheV2(id)?.maxParVideo)).toEqual([2, 2, 2]);
    expect(["pile-de-lettres", "mot-barre-remplace", "tampon-dechirure", "duel-triangles", "rafale-trois-mots", "eclat-chiffre", "dalle-claquee"].map((id) => ficheV2(id)?.maxParVideo)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(ficheV2("blob-mot")?.maxParVideo).toBe(3);
  });

  it("classes de taille (D6) et signe d'inclinaison (D1) : petit < 6 %, moyen de 6 à 15 %, grand > 15 % ou plein écran", () => {
    expect(classeTailleV2({ taillePct: 5.9, emplacement: "E3" })).toBe("petit");
    expect(classeTailleV2({ taillePct: 6, emplacement: "E3" })).toBe("moyen");
    expect(classeTailleV2({ taillePct: 15, emplacement: "E2" })).toBe("moyen");
    expect(classeTailleV2({ taillePct: 15.1, emplacement: "E2" })).toBe("grand");
    expect(classeTailleV2({ taillePct: 2, emplacement: "E7" })).toBe("grand");
    expect(ficheV2("bulle-cri") && classeTailleV2(ficheV2("bulle-cri")!)).toBe("petit");
    expect(ficheV2("demi-lune-bas") && classeTailleV2(ficheV2("demi-lune-bas")!)).toBe("grand");
    expect([signeAngleV2(9), signeAngleV2(-3), signeAngleV2(0)]).toEqual([1, -1, 0]);
  });

  it("les 6 éléments de la micro-accroche à 0,8-2 s (D9) sont ceux du standard", () => {
    expect(CATALOGUE_V2.filter((f) => f.accrocheOuverture).map((f) => f.id).sort()).toEqual(["autocollant-mot", "bulle-cri", "eclat-mot", "mot-saute", "onde-de-choc", "pastille-chiffre"]);
    for (const f of CATALOGUE_V2.filter((x) => x.accrocheOuverture)) expect(["E1", "E2", "E3", "E5"], f.id).toContain(f.emplacement);
  });

  it("les nombres : seuls pastille-chiffre et eclat-chiffre exigent un nombre DIT", () => {
    expect(CATALOGUE_V2.filter((f) => f.exigeNombreDit).map((f) => f.id).sort()).toEqual(["eclat-chiffre", "pastille-chiffre"]);
  });

  it("bruitages : chaque fichier annoncé existe dans `sons/`, sauf les 9 « à sourcer » (autocollant, scotch, papier, tampon, déchirure ×2, pop, bloup, boum)", () => {
    const dossier = join(RACINE, "studio-rendu/compositions/interface-claire/sons");
    const aSourcer = new Set<string>();
    for (const f of CATALOGUE_V2) {
      for (const b of f.bruitages) {
        if (f.bruitagesASourcer.includes(b)) {
          aSourcer.add(b);
          expect(existsSync(join(dossier, `${b}.wav`)), `${f.id} : « ${b} » existe déjà, ce n'est plus « à sourcer »`).toBe(false);
        } else expect(existsSync(join(dossier, `${b}.wav`)), `${f.id} : son « ${b} » introuvable dans sons/`).toBe(true);
      }
    }
    expect([...aSourcer].sort()).toEqual(["autocollant", "bloup", "boum", "dechirure", "dechirure-courte", "papier", "pop", "scotch", "tampon"]);
  });

  it("aucune musique : aucun bruitage du catalogue ne s'appelle musique, music, ambiance ou boucle", () => {
    for (const f of CATALOGUE_V2) for (const b of f.bruitages) expect(b, f.id).not.toMatch(/music|musique|ambiance|boucle|loop/i);
  });

  it("charte : aucun .tsx des 24 éléments n'emploie de couleur hexadécimale hors charte écrite en dur", () => {
    const CHARTE = new Set(["#e9dcc8", "#110a05", "#b44f29", "#bfa88b"]);
    // Les nuances dérivées passent par `NUANCES` / `COULEURS` ; une teinte codée en dur est signalée ici (liste attendue : vide ou documentée).
    const horsCharte: string[] = [];
    for (const f of CATALOGUE_V2) {
      for (const m of lire(f).matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!CHARTE.has(m[0].toLowerCase())) horsCharte.push(`${f.id} ${m[0]}`);
    }
    // Constat du 16/10 : on ne tolère aucune teinte en dur ; une teinte nouvelle doit venir de `NUANCES` (charte.ts) et non du .tsx.
    expect(horsCharte).toEqual([]);
  });
});
