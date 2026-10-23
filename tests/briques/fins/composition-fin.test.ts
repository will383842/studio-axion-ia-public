/**
 * Composition de fin (TB-15) : 3 à 4 s, la phrase s'écrit puis le crayon coche, déterministe, rien dans la bande des
 * sous-titres, sans son ; garde-fous du code (aucune couleur ni police en dur) et de l'image de rendu.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABLE_FINS } from "../../../src/briques/fins";
import { largeurEcrite } from "../../../src/briques/stylo/mesure-ecriture";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { FIN_EXEMPLE } from "../../../studio-rendu/compositions/commune/fin/exemple";
import { controlerFin, DUREE_FIN_MAX_MS, DUREE_FIN_MIN_MS, imagesFin, planifierFin, pointeFin, type ProprietesFin } from "../../../studio-rendu/compositions/commune/fin/plan";

const avec = (phrase: string, dureeMs = 3500): ProprietesFin => ({ ...FIN_EXEMPLE, phrase, dureeMs });
const DOSSIER = join(process.cwd(), "studio-rendu/compositions/commune/fin");
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("plan de la fin", () => {
  it("les propriétés par défaut sont valides ; 3,5 s à 25 i/s = 88 images", () => {
    expect(controlerFin(FIN_EXEMPLE)).toEqual([]);
    expect(imagesFin(FIN_EXEMPLE)).toBe(88);
  });

  it("refuse une durée hors de 3–4 s, plus de 8 mots, une phrase vide, un cadre dans la bande", () => {
    expect(controlerFin(avec("a", 2900)).join()).toMatch(/hors de 3000–4000/);
    expect(controlerFin(avec("a", 4100)).join()).toMatch(/hors de/);
    expect(controlerFin(avec("un deux trois quatre cinq six sept huit neuf")).join()).toMatch(/9 mots/);
    expect(controlerFin(avec("  ")).join()).toMatch(/vide/);
    expect(controlerFin({ ...FIN_EXEMPLE, cadre: { ...FIN_EXEMPLE.cadre, hauteur: 900 } }).join()).toMatch(/bande des sous-titres/);
    expect(() => planifierFin(avec("un deux trois quatre cinq six sept huit neuf"))).toThrow(/9 mots/);
  });

  it("chaque fin de la table tient : lignes dans le cadre, coche au-dessus de la bande, 3 à 4 s", () => {
    for (const f of TABLE_FINS) {
      for (const dureeMs of [DUREE_FIN_MIN_MS, 3500, DUREE_FIN_MAX_MS]) {
        const phrase = f.ecran.replace("{MOT}", "MÉTHODE");
        const p = avec(phrase, dureeMs);
        const plan = planifierFin(p);
        expect(plan.images).toBe(Math.round((dureeMs / 1000) * 25));
        for (const l of plan.lignes) {
          expect(l.px.x + l.px.largeur, f.id).toBeLessThanOrEqual(p.cadre.x + p.cadre.largeur + 1);
          expect(l.px.y, f.id).toBeGreaterThanOrEqual(p.cadre.y);
          expect(l.px.y + l.px.hauteur, f.id).toBeLessThanOrEqual(p.bande.y);
          expect(l.px.largeur).toBe(Math.ceil(largeurEcrite(l.texte, "titre", plan.taille, -0.02)));
        }
        const c = plan.coche.cible;
        expect(c.y + c.hauteur, f.id).toBeLessThanOrEqual(p.bande.y);
        expect(plan.fin).toBeLessThanOrEqual(p.bande.y);
        // La phrase, le départ de la coche et sa fin tiennent dans la fin, avec une tenue finale.
        expect(plan.coche.debut + plan.coche.duree, f.id).toBeLessThanOrEqual(dureeMs / 1000 - 0.5);
      }
    }
  });

  it("la phrase s'écrit AVANT la coche, ligne après ligne, sans chevauchement", () => {
    const plan = planifierFin(avec("Enregistrez cette vidéo pour la retrouver vite"));
    expect(plan.lignes.length).toBeGreaterThan(1);
    for (let i = 1; i < plan.lignes.length; i++) expect(plan.lignes[i].debut).toBeGreaterThanOrEqual(plan.lignes[i - 1].debut + plan.lignes[i - 1].duree);
    const derniere = plan.lignes[plan.lignes.length - 1];
    expect(plan.coche.debut).toBeGreaterThan(derniere.debut + derniere.duree);
  });

  it("le crayon coche : sa pointe suit la coche, puis se lève ; absent avant le départ", () => {
    const plan = planifierFin(FIN_EXEMPLE);
    expect(pointeFin(plan, 0)).toBeNull();
    const milieu = pointeFin(plan, plan.coche.debut + plan.coche.duree / 2)!;
    const c = plan.coche.cible;
    expect(milieu.x).toBeGreaterThanOrEqual(c.x - 1);
    expect(milieu.x).toBeLessThanOrEqual(c.x + c.largeur + 1);
    expect(milieu.y).toBeGreaterThanOrEqual(c.y - 1);
    expect(milieu.y).toBeLessThanOrEqual(c.y + c.hauteur + 1);
    expect(pointeFin(plan, plan.coche.debut + plan.coche.duree + 0.05)).toBeNull();
    // Le crayon n'est jamais immobile ni perdu : entre deux actions il bouge sans saut.
    let prec = pointeFin(plan, plan.lignes[0].debut)!;
    for (let i = 1; i < plan.images; i++) {
      const q = pointeFin(plan, i / plan.fps);
      if (!q) continue;
      expect(Math.hypot(q.x - prec.x, q.y - prec.y)).toBeLessThan(300);
      prec = q;
    }
  });

  it("déterministe : deux plans identiques, deux évaluations identiques", () => {
    const a = JSON.stringify(planifierFin(FIN_EXEMPLE));
    expect(JSON.stringify(planifierFin(structuredClone(FIN_EXEMPLE)))).toBe(a);
    const plan = planifierFin(FIN_EXEMPLE);
    expect(pointeFin(plan, 1.234)).toEqual(pointeFin(plan, 1.234));
  });
});

describe("garde-fous du code de la fin", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => /\.tsx?$/.test(f));
  it("aucune couleur ni police en dur (tout vient de charte-video/1)", () => {
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const code = sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));
      expect(code, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|fontFamily:\s*(?:["']|`(?!"\$\{))/);
    }
    expect(COULEURS_VIDEO.page).toBe("#E9DCC8");
  });

  it("ni son, ni sous-titres, ni hasard, ni horloge, ni alias « @/ »", () => {
    for (const f of fichiers) {
      const code = sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));
      expect(code, f).not.toMatch(/<Audio|<Video|Math\.random|Date\.now|new Date|from "@\/|sous-titres\/(?!.*bande)/);
    }
  });

  it("l'image de rendu n'a besoin d'aucun dossier de src/ nouveau (habillage, stylo, motion déjà copiés)", () => {
    const dockerfile = readFileSync(join(process.cwd(), "deploiement/studio-rendu/Dockerfile"), "utf8");
    for (const f of fichiers) {
      const code = readFileSync(join(DOSSIER, f), "utf8");
      for (const m of code.matchAll(/from "((?:\.\.\/){4}src\/[^"]+)"/g)) {
        const dossier = m[1].replace(/^(\.\.\/)+/, "").split("/").slice(0, 3).join("/");
        expect(dockerfile, `${f} : ${m[1]}`).toContain(`COPY --chown=rendu:rendu ${dossier} `);
      }
    }
  });
});
