/**
 * CARTES PLEINES (revue passe 2 de l'architecte, 15/10) — rendu :
 * - premier contenu d'une carte visible 0,2 s au plus après son entrée, même pour un ancien plan (`contenuAvance`) ;
 * - plus aucun emplacement vide (pointillés « en attente ») : une ligne, une vignette, une tuile apparaît AVEC son contenu ;
 * - plus de bande ivoire SANS objet pendant que la prise est descendue (`sansBandeVide`, vidéo 3 : 71,25 s et 77,5 s).
 * Les seuils du contrôle du plan (trou 0,7 s, carte immobile 0,8 s, carte vide 0,2 s) sont testés dans realisateur.test.ts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ContenuCarte, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { contenuAvance, PREMIER_CONTENU_MAX_SEC, sansBandeVide } from "../../studio-rendu/compositions/interface-claire/Carte";
import { DESCENTE, hauteurBande, scene } from "../../studio-rendu/compositions/interface-claire/cadrage";

const DOSSIER_CARTES = fileURLToPath(new URL("../../studio-rendu/compositions/interface-claire/cartes/", import.meta.url));

describe("cartes pleines · premier contenu ≤ 0,2 s après l'entrée", () => {
  it("« Vos priorités » (vidéo 3, entrée 73,90 s, sur-titre à 74,24 s) : le sur-titre est avancé à 74,10 s, le reste ne bouge pas", () => {
    const liste: ContenuCarte = { type: "liste", entete: { texte: "Vos priorités", icone: "etoile", a: 74.24 }, lignes: [{ texte: "Claires", icone: "coche", a: 74.74 }, { texte: "Classées", icone: "etoile", a: 75.14 }], cocheA: 76.9 };
    const r = contenuAvance(liste, 73.9);
    expect(PREMIER_CONTENU_MAX_SEC).toBe(0.2);
    expect(r).toMatchObject({ entete: { a: 74.1 }, lignes: [{ a: 74.74 }, { a: 75.14 }], cocheA: 76.9 });
    // L'original n'est pas modifié (fonction pure).
    expect(liste.type === "liste" && liste.entete?.a).toBe(74.24);
  });

  it("un contenu déjà à l'heure est rendu tel quel (même objet)", () => {
    const grille: ContenuCarte = { type: "grille", vignettes: [{ a: 21.8, legende: "Dirigeants", contenu: { type: "fiche", lignes: 3, icone: "utilisateur", iconeA: 23.04 } }, { a: 23.92, legende: "Audit", contenu: { type: "fiche", icone: "loupe" } }] };
    expect(contenuAvance(grille, 21.7)).toBe(grille);
  });

  it("seul le PREMIER instant d'apparition avance : jamais une animation interne (coche, bascule, icône d'une fiche)", () => {
    const statuts: ContenuCarte = { type: "statuts", avant: { texte: "À faire" }, apres: { texte: "Fait", icone: "coche" }, lignes: [{ nom: "Relances", a: 10.6, bascule: 11.2 }, { nom: "Devis", a: 11.4 }] };
    expect(contenuAvance(statuts, 10)).toMatchObject({ lignes: [{ a: 10.2, bascule: 11.2 }, { a: 11.4 }] });
    const graphique: ContenuCarte = { type: "graphique", baseA: 5.5, barres: [{ hauteur: 0.5, a: 5.5 }, { hauteur: 0.8, a: 6 }] };
    expect(contenuAvance(graphique, 5)).toMatchObject({ baseA: 5.2, barres: [{ a: 5.2 }, { a: 6 }] });
  });
});

describe("cartes pleines · aucun emplacement vide dessiné", () => {
  it("aucune carte ne dessine plus de ligne, vignette, tuile, barre ou champ « en attente » en pointillés", () => {
    for (const f of readdirSync(DOSSIER_CARTES).filter((x) => x.endsWith(".tsx"))) {
      const src = readFileSync(DOSSIER_CARTES + f, "utf8");
      expect(src, f).not.toMatch(/EN ATTENTE|attente-/);
      // Seuls les filets de repère du graphique restent en pointillés (ce ne sont pas des emplacements).
      expect((src.match(/dashed/g) ?? []).length, f).toBe(f === "Graphique.tsx" ? 1 : 0);
      expect(src, f).toMatch(/import React/);
    }
  });
});

/* ---------------- Bande jamais vide ---------------- */

function planBande(): PlanFacecamAnimee {
  return {
    version: "plan-facecam-animee/1",
    charte: "interface-claire/1",
    duree: 30,
    fps: 25,
    largeur: 1080,
    hauteur: 1920,
    prise: { src: "prise.mp4", finSec: 29 },
    groupes: [],
    zooms: [],
    mouvements: [],
    cartes: [
      // Vidéo 3, 73,90 → 77,50 s puis fenêtre à 77,70 s : 0,2 s de bande ivoire vide.
      { debut: 3.9, fin: 7.5, titre: "Vos priorités", icone: "etoile", entree: "chute", contenu: { type: "liste", lignes: [{ texte: "Claires", icone: "coche", a: 4.0 }, { texte: "Classées", icone: "etoile", a: 4.5 }, { texte: "Comprises", icone: "loupe", a: 5.0 }] } },
      // Suivie d'un objet 1 s plus tard : la prise remonte normalement, rien ne change.
      { debut: 20, fin: 23, titre: "Relevé", icone: "graphique", entree: "glisse", contenu: { type: "liste", lignes: [{ texte: "Lundi", icone: "calendrier", a: 20.1 }, { texte: "Mardi", icone: "calendrier", a: 20.6 }, { texte: "Jeudi", icone: "calendrier", a: 21.1 }] } },
    ],
    fenetres: [
      { debut: 7.7, fin: 9.5, media: "videos/fenetre-13.mp4", recherche: "dirigeant qui classe ses priorités au bureau", video: true },
      // Vidéo 3, fenêtre « au-dessus » 69,30 → 71,20 s puis compteur à 71,36 s.
      { debut: 10, fin: 11.9, media: "videos/fenetre-12.mp4", recherche: "consultant en visio avec un dirigeant au bureau", video: true, cadrage: "au-dessus" },
    ],
    calques: [
      { type: "etiquette", debut: 12.06, fin: 13, texte: "45 minutes" },
      { type: "etiquette", debut: 24, fin: 25, texte: "Du temps" },
    ],
    fin: { debut: 28, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
    sons: [],
  };
}

describe("cartes pleines · bande jamais vide pendant que la prise est descendue", () => {
  it("un objet suivi d'un autre à 0,3 s ou moins reste jusqu'à son entrée ; au-delà, rien ne change", () => {
    const p = planBande();
    const r = sansBandeVide(p);
    expect(DESCENTE.enchainement).toBe(0.3);
    expect(r.cartes.map((c) => c.fin)).toEqual([7.7, 23]);
    expect(r.fenetres.map((f) => f.fin)).toEqual([9.5, 12.06]);
    expect(r.calques.map((c) => c.fin)).toEqual([13, 25]);
    // Aucune entrée ni aucun instant de contenu ne bouge.
    expect(r.cartes.map((c) => c.debut)).toEqual(p.cartes.map((c) => c.debut));
    expect(r.cartes[0].contenu).toEqual(p.cartes[0].contenu);
    // Plan d'origine intact.
    expect(p.cartes[0].fin).toBe(7.5);
  });

  it("à chaque image où la bande ivoire est visible, un objet est à l'écran (avant : 0,2 s et 0,16 s de bande vide)", () => {
    const vide = (plan: PlanFacecamAnimee) => {
      const sc = scene(plan);
      const objets = [...plan.cartes, ...plan.fenetres, ...plan.calques];
      let n = 0;
      for (let i = 0; i < plan.duree * plan.fps; i++) {
        const t = i / plan.fps;
        if (t >= plan.fin.debut) break;
        // Bande vide qui DURE : la prise est TENUE en bas (un objet arrive dans les 0,3 s) alors que rien n'est à l'écran.
        // La remontée animée après le dernier objet d'un enchaînement (5 images, comme la référence) n'en est pas une.
        const tenue = objets.some((o) => o.debut > t && o.debut <= t + DESCENTE.enchainement + 1e-6);
        if (hauteurBande(sc, t) > 0.02 && tenue && !objets.some((o) => t >= o.debut && t < o.fin)) n++;
      }
      return n;
    };
    expect(vide(planBande())).toBeGreaterThanOrEqual(5);
    expect(vide(sansBandeVide(planBande()))).toBe(0);
  });

  it("un plan sans enchaînement serré est rendu tel quel (même objet)", () => {
    const p = planBande();
    p.cartes[0].fin = 7.2;
    p.fenetres[1].fin = 11.5;
    expect(sansBandeVide(p)).toBe(p);
  });
});
