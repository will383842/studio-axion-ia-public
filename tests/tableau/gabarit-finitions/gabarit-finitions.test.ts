/**
 * FINITIONS DU GABARIT CLAIR (style « reference/2 »), jugées sur le TÉMOIN RÉEL du premier essai
 * (`temoins/gabarit-essai-reel-2026-10-14.json`, vidéo `v-4fb0bdccdab6`), ses deux sorties verticales calées sur leurs
 * VRAIES VOIX. Regard de Will sur la vraie vidéo (14/10/2026, « je veux la perfection »), trois défauts :
 *  1. la fin de TikTok et Shorts (« Enregistrez pour la retrouver ») était une petite ligne verte : elle s'écrit EN
 *     GRAND, dans le même cadre vert plein que l'appel des Reels, au moment où la voix la dit, puis axion-ia.com ;
 *  2. les pages finies n'étaient remplies qu'aux trois quarts : le texte couvre 85 à 90 % de la zone sûre, plus grand
 *     (titre ~90, phrase clé ~72, détails ~54), sans déborder ni chevaucher ;
 *  3. au changement de page, la page restait blanche (le crayon seul, puis les points et le dessin avant le titre) :
 *     le titre (et la pastille d'une étape) s'écrit dès la coupe, jamais plus de 0,3 s de page vide ; les points et le
 *     dessin viennent après lui.
 */
import { describe, expect, it } from "vitest";
import { apparition, planPageReference, type PlanPageReference } from "../../../src/briques/tableau-scene/reference/animation";
import { TAILLES_GABARIT } from "../../../src/briques/tableau-scene/reference/charte";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { cleMot } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage, type ElementPlace, type MiseEnPageTableau, type PagePlacee } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { SITE_FIN } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { sortiesTemoin, temoinGabarit } from "./temoin";

const temoin = temoinGabarit();
const sorties = sortiesTemoin(temoin);
const reels = sorties.find((s) => s.id === "vertical")!;
const liens = sorties.find((s) => s.id === "vertical-liens")!;
const mises = new Map(sorties.map((s) => [s.id, mettreEnPage(s.fiche, s.options)] as const));
/** Propriétés des scènes, comme la fabrication les prépare (avec les mots de la vraie voix de la sortie). */
const props = new Map(sorties.map((s) => [s.id, proprietesScenes({ miseEnPage: mises.get(s.id)! as unknown as MiseBrique, scenes: s.fiche.scenes as SceneCalee[], heures: s.elements, stylo: s.fiche.stylo, mots: s.mots })] as const));
const texte = (e: ElementPlace) => e.lignes.map((l) => l.texte).join(" ");
const bas = (e: ElementPlace) => e.encombrement.px.y + e.encombrement.px.hauteur;

/** Part de la hauteur de la zone sûre couverte par la page finie, du haut de son premier élément écrit (dessins à part) au bas du dernier. */
function remplissage(m: MiseEnPageTableau, p: PagePlacee): number {
  const ecrits = p.elements.filter((e) => e.type !== "dessin");
  const haut = Math.min(...ecrits.map((e) => e.encombrement.px.y));
  return (Math.max(...p.elements.map(bas)) - haut) / m.zoneSure.px.hauteur;
}

describe("1 · la fin de TikTok et Shorts, en grand comme l'appel des Reels", () => {
  const m = mises.get("vertical-liens")!;
  const derniere = m.pages.at(-1)!;
  const phrase = derniere.elements.find((e) => e.elementId.endsWith("~phrase"))!;
  const site = derniere.elements.find((e) => e.elementId.endsWith("~site"))!;
  const appelReels = mises.get("vertical")!.pages.at(-1)!.elements.find((e) => e.gabarit?.sorte === "appel")!;

  it("la demande est écrite dans le cadre vert plein de l'appel, en grand (~70 px), puis axion-ia.com dessous", () => {
    expect(texte(phrase)).toBe("Enregistrez pour la retrouver");
    expect(phrase.gabarit?.sorte).toBe("appel");
    expect(phrase.taillePx).toBeGreaterThanOrEqual(66);
    expect(texte(site)).toBe(SITE_FIN);
    expect(site.px.y).toBeGreaterThanOrEqual(phrase.px.y + phrase.px.hauteur);
    expect(site.taillePx).toBeGreaterThanOrEqual(TAILLES_GABARIT.detailMin);
  });

  it("même poids visuel que l'appel des Reels : même cadre, même taille de texte", () => {
    expect(appelReels.gabarit?.sorte).toBe("appel");
    expect(phrase.taillePx).toBe(appelReels.taillePx);
    expect(phrase.couleurTexte).toBe(appelReels.couleurTexte);
    expect(phrase.couleurFond).toBe(appelReels.couleurFond);
    if (phrase.gabarit?.sorte !== "appel" || appelReels.gabarit?.sorte !== "appel") return;
    expect(phrase.gabarit.couleur).toBe(appelReels.gabarit.couleur);
    // Le site est dans le cadre, sous la demande.
    const c = phrase.gabarit.cadre;
    expect(site.px.y + site.px.hauteur).toBeLessThanOrEqual(c.y + c.hauteur);
  });

  it("le crayon écrit la demande au moment où la voix la dit (« Enregistrez… »), puis le site", () => {
    const p = props.get("vertical-liens")!.at(-1)!;
    const plan = planPageReference(p.page, p.styleReference!);
    const dit = liens.mots.findLast((x) => cleMot(x.mot) === "enregistrez")!;
    const debut = Math.min(...plan.actions.filter((a) => a.id === phrase.elementId).map((a) => a.debut));
    expect(debut).toBeGreaterThanOrEqual(dit.debutSec - 0.05);
    expect(debut).toBeLessThanOrEqual(dit.debutSec + 0.4);
    const siteDebut = Math.min(...plan.actions.filter((a) => a.id === site.elementId).map((a) => a.debut));
    expect(siteDebut).toBeGreaterThan(debut);
  });
});

describe("2 · pages finies remplies à 85-90 % de la zone sûre, texte plus grand, rien ne déborde", () => {
  for (const s of sorties)
    it(`${s.id} : chaque page finie couvre au moins 85 % de la zone sûre, sans déborder ni chevaucher`, () => {
      const m = mises.get(s.id)!;
      for (const p of m.pages) {
        const r = remplissage(m, p);
        expect(r, `page ${p.page}`).toBeGreaterThanOrEqual(0.85);
        expect(Math.max(...p.elements.map(bas)), `page ${p.page}`).toBeLessThanOrEqual(m.cadre.px.y + m.cadre.px.hauteur);
      }
      expect(controlerImageSortie(s.fiche, { id: s.id, libelle: s.id, fiche: s.fiche, options: s.options }).filter((c) => c.famille === "mise-en-page" && c.etat !== "reussi")).toEqual([]);
    });

  it("tailles : titre ~90, phrase clé ~72, détails ~54 sur une page qui a de la place", () => {
    expect(TAILLES_GABARIT.titre).toBe(90);
    expect(TAILLES_GABARIT.phrase).toBe(72);
    expect(TAILLES_GABARIT.detail).toBe(54);
    // Pages d'étape du témoin (titre, phrase clé, un ou deux détails) : les tailles pleines.
    for (const p of mises.get("vertical")!.pages.filter((x) => x.page >= 3 && x.page <= 6)) {
      const t = (sorte: string) => p.elements.find((e) => e.gabarit?.sorte === sorte)!.taillePx!;
      expect(t("titre"), `page ${p.page}`).toBeGreaterThanOrEqual(88);
      expect(t("phrase"), `page ${p.page}`).toBeGreaterThanOrEqual(70);
      expect(t("detail"), `page ${p.page}`).toBeGreaterThanOrEqual(52);
    }
  });
});

describe("3 · jamais de page vide au changement de page : le titre d'abord", () => {
  for (const s of sorties)
    it(`${s.id} : à chaque nouvelle page, le titre (ou la pastille) s'écrit dans les 0,3 s ; points et dessin après le titre`, () => {
      const ps = props.get(s.id)!;
      ps.forEach((p, i) => {
        if (i === 0 || ps[i - 1].scene.page === p.scene.page) return;
        const plan: PlanPageReference = planPageReference(p.page, p.styleReference!);
        const coupe = p.scene.debutMs / 1000;
        const titre = p.page.elements.find((e) => e.gabarit?.sorte === "titre")!;
        const pastille = p.page.elements.find((e) => e.gabarit?.sorte === "pastille");
        const debutDe = (id: string) => Math.min(...plan.actions.filter((a) => a.id === id).map((a) => a.debut));
        const finDe = (id: string) => Math.max(...plan.actions.filter((a) => a.id === id).map((a) => a.debut + a.duree));
        const premier = Math.min(debutDe(titre.elementId), pastille ? debutDe(pastille.elementId) : Infinity);
        expect(premier - coupe, `page ${p.scene.page}`).toBeLessThanOrEqual(0.3);
        // Le titre suit la pastille sans attendre son mot.
        if (pastille) expect(debutDe(titre.elementId) - finDe(pastille.elementId), `page ${p.scene.page}`).toBeLessThanOrEqual(0.35);
        else expect(debutDe(titre.elementId) - coupe, `page ${p.scene.page}`).toBeLessThanOrEqual(0.3);
        // Le dessin et les points de l'étape viennent après le titre.
        for (const d of p.page.elements.filter((e) => e.type === "dessin")) expect(debutDe(d.elementId), `page ${p.scene.page} · dessin`).toBeGreaterThanOrEqual(debutDe(titre.elementId));
        for (const r of p.page.elements.filter((e) => e.gabarit?.sorte === "repere")) {
          expect(apparition(plan, r.elementId, debutDe(titre.elementId) - 0.01), `page ${p.scene.page} · points`).toBe(0);
          expect(apparition(plan, r.elementId, finDe(titre.elementId) + 0.3), `page ${p.scene.page} · points`).toBe(1);
        }
      });
    });

  it("le numéro reste écrit au moment où la voix dit « Un », « Deux »… (vertical des Reels)", () => {
    const ps = props.get("vertical")!;
    for (const s of reels.fiche.scenes.filter((x) => x.gabarit?.numero)) {
      const p = ps.find((x) => x.scene.id === s.id)!;
      const plan = planPageReference(p.page, p.styleReference!);
      const pastille = p.page.elements.find((e) => e.gabarit?.sorte === "pastille")!;
      const mot = reels.elements.find((h) => h.elementId === pastille.elementId)!;
      const debut = Math.min(...plan.actions.filter((a) => a.id === pastille.elementId).map((a) => a.debut));
      expect(Math.abs(debut - Math.max(mot.debutMs, p.scene.debutMs) / 1000), s.id).toBeLessThanOrEqual(0.31);
    }
  });
});
