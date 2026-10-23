/**
 * FACE CAMÉRA ANIMÉE — CATALOGUE « v3 » (16/10) : les 23 éléments de `studio-rendu/.../motion-v3/lotA..lotE/` vus par le réalisateur.
 * On vérifie que chaque entrée correspond à un vrai .tsx (existence, `import React`, id, composant exporté) ET à un composant du
 * registre de rendu (`registre-v3.tsx`), que le champ `actif` porte le CHOIX DE WILL du 16/10 (14 retenus, 9 non montrés), que le
 * visage est toujours entier ou entièrement couvert (jamais à moitié), que les bruitages existent (aucune musique) et que la consigne
 * du réalisateur et le registre disent la même chose que le catalogue. AUCUN rendu, aucun réseau.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_V3, classeTailleV3, elementsV3Actifs, estCoupDePoingV3, etatVisagePose, ficheV3, LOT_DE_FAMILLE_V3, ZONE_VISAGE_V3, type FicheCatalogueV3,
} from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v3";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { SONS_V3 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v3";

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "studio-rendu/compositions/interface-claire");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const lireFiche = (f: FicheCatalogueV3) => lire(f.fichier);
const REGISTRE = readFileSync(join(DOSSIER, "motion-v3/registre-v3.tsx"), "utf8");

/** Le CHOIX DE WILL du 16/10 : les 14 éléments qu'il garde, et les 9 qu'il n'a pas vus. */
const ACTIFS = ["mosaique-videos", "mot-derriere", "fenetre-plein-cadre", "carte-verre", "bande-video", "dalle-claquee", "fenetre-telephone", "notifications-verre", "cercle-epaule", "duel-video", "rafale-trois-mots", "fenetre-double", "eclat-chiffre", "mot-saute"];
const INACTIFS = ["fenetre-pivot", "pilule-cote", "arche-bas", "carte-preuve", "widget-chiffre", "carte-retournee", "mot-vertical-bord", "citation-verre", "mot-fenetre"];

describe("catalogue v3 · les 23 éléments", () => {
  it("23 entrées, ids et numéros uniques (1 à 24 sans le 9, abandonné), 5 lots (4, 4, 5, 5, 5)", () => {
    expect(CATALOGUE_V3).toHaveLength(23);
    expect(new Set(CATALOGUE_V3.map((f) => f.id)).size).toBe(23);
    expect(new Set(CATALOGUE_V3.map((f) => f.numero)).size).toBe(23);
    expect(CATALOGUE_V3.map((f) => f.numero).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, k) => k + 1).filter((n) => n !== 9));
    expect((["A", "B", "C", "D", "E"] as const).map((l) => CATALOGUE_V3.filter((f) => f.lot === l).length)).toEqual([4, 4, 5, 5, 5]);
    expect(ficheV3("mot-saute")?.numero).toBe(16);
    expect(ficheV3("n-existe-pas")).toBeUndefined();
  });

  it("chaque entrée a une fiche complète : famille du lot, emplacement, forme, mouvement, durées, quand l'utiliser, coup de poing", () => {
    for (const f of CATALOGUE_V3) {
      expect(f.famille, f.id).toBeTruthy();
      expect(LOT_DE_FAMILLE_V3[f.famille], f.id).toBe(f.lot);
      expect(f.forme.length, f.id).toBeGreaterThan(2);
      expect(f.mouvement.length, f.id).toBeGreaterThan(2);
      expect(f.sortie.length, f.id).toBeGreaterThan(2);
      expect(f.quand.length, f.id).toBeGreaterThan(20);
      expect(f.contenu.length, f.id).toBeGreaterThan(10);
      expect(f.dureeSec[0], f.id).toBeGreaterThan(0);
      expect(f.dureeSec[0], f.id).toBeLessThanOrEqual(f.dureeSec[1]);
      expect(f.dureeImages, f.id).toEqual([Math.round(f.dureeSec[0] * 30), Math.round(f.dureeSec[1] * 30)]);
      expect(f.taillePct, f.id).toBeGreaterThan(0);
      expect(f.taillePct, f.id).toBeLessThanOrEqual(100);
      expect(f.maxParVideo, f.id).toBeGreaterThanOrEqual(1);
      expect(Object.isFrozen(f), f.id).toBe(true);
    }
  });

  it("14 éléments ACTIFS (le choix de Will) et 9 inactifs : `actif` est le seul champ à changer pour retenir ou écarter", () => {
    expect(CATALOGUE_V3.filter((f) => f.actif).map((f) => f.id).sort()).toEqual([...ACTIFS].sort());
    expect(CATALOGUE_V3.filter((f) => !f.actif).map((f) => f.id).sort()).toEqual([...INACTIFS].sort());
    expect(elementsV3Actifs()).toHaveLength(14);
    // `elementsV3Actifs` ne fait que lire `actif` : changer ce champ change la liste (sur une copie).
    const copie = CATALOGUE_V3.map((f) => ({ ...f, actif: f.id === "fenetre-pivot" ? true : f.actif }));
    expect(copie.filter((f) => f.actif)).toHaveLength(15);
  });

  it("chaque id a son .tsx (il existe, importe React, porte l'id, exporte le composant) ET son composant dans le registre de rendu", () => {
    for (const f of CATALOGUE_V3) {
      expect(existsSync(join(RACINE, f.fichier)), `${f.id} : ${f.fichier} introuvable`).toBe(true);
      expect(f.fichier).toContain(`/lot${f.lot}/`);
      const src = lireFiche(f);
      expect(src, `${f.id} : import React manquant (la prod compile le JSX en mode classique)`).toMatch(/^\s*import React\b/m);
      expect(src, `${f.id} : composant ${f.composant} non exporté`).toMatch(new RegExp(`export function ${f.composant}\\b`));
      expect(REGISTRE, `${f.id} : absent du registre de rendu`).toContain(`"${f.id}":`);
      expect(REGISTRE, `${f.id} : le registre n'importe pas ${f.composant}`).toMatch(new RegExp(`import \\{[^}]*\\b${f.composant}\\b[^}]*\\} from "\\./lot${f.lot}/`));
      expect(REGISTRE, `${f.id} : le registre ne rend pas <${f.composant}`).toContain(`<${f.composant}`);
    }
  });

  it("le registre ne rend QUE des ids du catalogue (23 clés), et chaque .tsx du registre ou de la démo importe React", () => {
    const cles = [...REGISTRE.matchAll(/^\s{2}"([a-z0-9-]+)": \(e, c\)/gm)].map((m) => m[1]);
    expect(cles.sort()).toEqual(CATALOGUE_V3.map((f) => f.id).sort());
    for (const f of ["motion-v3/registre-v3.tsx", "demo-v3/DemoV3.tsx", "VideoAnimee.tsx", "Compositions.tsx", "SousTitres.tsx"]) expect(readFileSync(join(DOSSIER, f), "utf8"), f).toMatch(/^\s*import React\b/m);
    // Tous les .tsx des 5 lots (hors bancs d'essai) importent React.
    for (const lot of ["A", "B", "C", "D", "E"]) {
      for (const nom of readdirSync(join(DOSSIER, `motion-v3/lot${lot}`)).filter((n) => n.endsWith(".tsx"))) {
        expect(readFileSync(join(DOSSIER, `motion-v3/lot${lot}/${nom}`), "utf8"), `lot${lot}/${nom}`).toMatch(/^\s*import React\b/m);
      }
    }
  });

  it("VideoAnimee rend les éléments v3 par le registre, place les sous-titres et la descente de la prise selon l'élément", () => {
    const src = readFileSync(join(DOSSIER, "VideoAnimee.tsx"), "utf8");
    expect(src).toContain("rendreElementV3");
    expect(src).toContain("plan.elementsV3");
    expect(src).toContain("sousTitresYV3");
    expect(src).toContain("descentePriseV3");
  });

  it("le registre recopie fidèlement la position des sous-titres et la descente de la prise de la fiche", () => {
    const table = REGISTRE.slice(REGISTRE.indexOf("SOUS_TITRES_Y_V3"), REGISTRE.indexOf("export function sousTitresYV3"));
    for (const f of CATALOGUE_V3) {
      const m = table.match(new RegExp(`"${f.id}": (null|[0-9.]+)`));
      expect(m, `${f.id} absent de SOUS_TITRES_Y_V3`).not.toBeNull();
      expect(m![1] === "null" ? null : Number(m![1]), f.id).toBe(f.sousTitresY);
    }
    expect(CATALOGUE_V3.filter((f) => f.descentePrise).map((f) => f.id)).toEqual(["carte-verre"]);
    expect(REGISTRE).toContain('e.id !== "carte-verre"');
  });

  it("coup de poing = plein écran qui couvre le visage : 6 actifs (plein-cadre, rafale, duel, dalle, éclat, mosaïque), 7 en tout", () => {
    const coups = CATALOGUE_V3.filter(estCoupDePoingV3);
    expect(coups.map((f) => f.id).sort()).toEqual(["dalle-claquee", "duel-video", "eclat-chiffre", "fenetre-plein-cadre", "mosaique-videos", "mot-fenetre", "rafale-trois-mots"]);
    expect(coups.filter((f) => f.actif)).toHaveLength(6);
    for (const f of CATALOGUE_V3) {
      expect(f.coupDePoing, f.id).toBe(f.emplacement === "plein-ecran");
      if (f.coupDePoing) {
        expect(f.couvreVisage, f.id).toBe(true);
        expect(classeTailleV3(f), f.id).toBe("grand");
      }
    }
  });

  it("VISAGE : à l'état posé chaque élément laisse le visage ENTIER ou le COUVRE en entier, jamais à moitié ; la fiche le dit juste", () => {
    for (const f of CATALOGUE_V3) {
      const etat = etatVisagePose(f);
      expect(etat, `${f.id} cache la moitié du visage`).not.toBe("partiel");
      expect(etat, f.id).toBe(f.couvreVisage ? "couvert" : "entier");
    }
    // Les .tsx déclarent le même état (« couvert » / « entier » dans leur fiche ou leur en-tête).
    for (const f of CATALOGUE_V3.filter((x) => x.lot === "D" || x.lot === "E")) {
      expect(lireFiche(f), f.id).toMatch(new RegExp(`visage:\\s*"${f.couvreVisage ? "couvert" : "entier"}"`));
    }
    // Le test détecte bien une moitié de visage (contre-exemple) et la descente de la prise sous la carte du haut.
    expect(etatVisagePose({ rect: { x0: 0.3, y0: 0.3, x1: 0.9, y1: 0.9 }, derriereVisage: false, descentePrise: false })).toBe("partiel");
    expect(etatVisagePose({ rect: ficheV3("carte-verre")!.rect, derriereVisage: false, descentePrise: false })).toBe("partiel");
    expect(etatVisagePose(ficheV3("carte-verre")!)).toBe("entier");
    expect(ZONE_VISAGE_V3).toEqual({ x0: 0.25, y0: 0.12, x1: 0.75, y1: 0.58 });
  });

  it("tolérance de Will : 3 images de visage partiel au plus, et seulement pour un élément qui couvre le visage", () => {
    for (const f of CATALOGUE_V3) {
      expect(f.imagesVisagePartiel, f.id).toBeLessThanOrEqual(3);
      if (!f.couvreVisage) expect(f.imagesVisagePartiel, f.id).toBe(0);
    }
  });

  it("bruitages : tous dans sons/ (les 28 fichiers existent), AUCUNE musique", () => {
    const dossier = join(DOSSIER, "sons");
    for (const s of SONS_V3) expect(existsSync(join(dossier, `${s}.wav`)), s).toBe(true);
    expect(readdirSync(dossier).filter((n) => n.endsWith(".wav")).sort()).toEqual([...SONS_V3].map((s) => `${s}.wav`).sort());
    for (const f of CATALOGUE_V3) {
      expect(f.bruitages.length, f.id).toBeGreaterThan(0);
      for (const b of f.bruitages) {
        expect(SONS_V3, `${f.id} : ${b.son}`).toContain(b.son);
        expect(b.son, f.id).not.toMatch(/musi|music|song|chanson|melod/i);
        expect(b.volume, f.id).toBeGreaterThan(0);
        expect(b.volume, f.id).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it("emplacements et textes : l'emprise est dans l'image ; un élément qui prend des vidéos le dit ; un nombre exigé est un élément à chiffre", () => {
    for (const f of CATALOGUE_V3) {
      expect(f.rect.x0, f.id).toBeGreaterThanOrEqual(0);
      expect(f.rect.y0, f.id).toBeGreaterThanOrEqual(0);
      expect(f.rect.x1, f.id).toBeLessThanOrEqual(1);
      expect(f.rect.y1, f.id).toBeLessThanOrEqual(1);
      expect(f.rect.x0 < f.rect.x1 && f.rect.y0 < f.rect.y1, f.id).toBe(true);
    }
    expect(CATALOGUE_V3.filter((f) => f.exigeNombreDit).map((f) => f.id).sort()).toEqual(["eclat-chiffre", "widget-chiffre"]);
    expect(CATALOGUE_V3.filter((f) => f.videos[1] > 0).length).toBeGreaterThanOrEqual(12);
  });

  it("depuis le 17/10 la consigne du réalisateur ne propose plus le catalogue v3 (les 26 plaquettes v4 le remplacent) ; le catalogue v3 reste dans le code", () => {
    const c = consigneRealisateur();
    expect(c).not.toContain("# 0. LES ÉLÉMENTS V3");
    expect(c).toContain("# 0. LES PLAQUETTES V4");
    for (const id of ACTIFS.filter((x) => !["dalle-claquee", "duel-video", "rafale-trois-mots"].includes(x))) expect(c, id).not.toContain(`- ${id} — `);
    expect(c).not.toContain("« elementsV3 » : les éléments v3 du § 0");
    expect(existsSync(join(RACINE, "src/moteurs/montage-facecam-animee/realisateur/catalogue-v3.ts"))).toBe(true);
  });
});

describe("catalogue v2 : reste dans le code mais le réalisateur ne le propose plus", () => {
  it("la consigne ne cite aucun élément du catalogue v2 (papier, autocollant…)", () => {
    const c = consigneRealisateur();
    for (const id of ["tampon-dechirure", "autocollant-mot", "scotch-postit", "fleche-feutre", "pile-de-lettres", "badge-roulant"]) expect(c, id).not.toContain(id);
    expect(existsSync(join(RACINE, "src/moteurs/montage-facecam-animee/realisateur/catalogue-v2.ts"))).toBe(true);
  });
});
