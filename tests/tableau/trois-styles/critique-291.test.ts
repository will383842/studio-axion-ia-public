/**
 * CORRECTIONS APRÈS LA CRITIQUE INDÉPENDANTE DE #289 (PR #291, `docs/formats/apercus-trois-styles/CRITIQUE.md`), sur la
 * fiche des maquettes et le témoin v-667edcd8e3a8, dans les trois styles, en 9:16 et en 4:5 :
 *  - B1 : l'outil ne flotte jamais au-dessus du contenu sans écrire : au-delà de 0,6 s sans tracer, il sort de l'image ;
 *    la phrase de l'étape s'écrit pendant que la voix la dit (le trou est comblé) ;
 *  - I1 : chaque page reste FINIE, sans outil sur le contenu, 0,6 à 0,8 s avant le changement de page ;
 *  - I2 : seuls le repère et le numéro arrivent avec la page ; le titre s'écrit vite (0,4 à 0,6 s) dès la fin de
 *    l'effacement ; chaque ligne naît sous la pointe (jamais l'outil en écriture sur une ligne déjà là) ;
 *  - D5 : l'outil ne change de couleur (craie ivoire ↔ terracotta) que hors de l'image.
 */
import { describe, expect, it } from "vitest";
import { planPage3, type Plan3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { boiteOutil, OUTIL_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/outil";
import { actionsOutil, etatOutil } from "../../../src/briques/tableau-scene/trois-styles/pose-outil";
import { CHARTES_TABLEAU, chapitreDePartie, contrasteTableau, STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerAnimationTableau } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { commandeTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { donneesCalque } from "../../../src/briques/sous-titres";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { calee, ficheMaquettes, ficheTemoinV667Corrige } from "./fiches";

const FICHES = [["maquettes", ficheMaquettes], ["témoin v667", ficheTemoinV667Corrige]] as const;

/** Les pages d'une fiche calée dans un style et un format : la première scène de chaque page et son plan. */
function pages(fiche: (s: StyleTableau) => ReturnType<typeof ficheMaquettes>, style: StyleTableau, format: "vertical" | "portrait") {
  const c = calee(fiche(style));
  expect(c.refus).toEqual([]);
  const m = mettreEnPage(c.fiche, format === "vertical" ? {} : { format });
  const props = proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots, temps3: tempsReference3(c.fiche, c.mots) });
  const vues = new Set<number>();
  const res: { p: ProprietesTableauScene; plan: Plan3 }[] = [];
  for (const p of props) {
    if (vues.has(p.page.page)) continue;
    vues.add(p.page.page);
    res.push({ p, plan: planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur }) });
  }
  return { props, res, mots: c.mots, fiche: c.fiche };
}

for (const style of STYLES_TABLEAU)
  for (const [nom, fiche] of FICHES)
    for (const format of ["vertical", "portrait"] as const)
      describe(`${style} · ${nom} · ${format}`, () => {
        const { props, res } = pages(fiche, style, format);

        it("B1 : jamais plus de 0,6 s dans l'image sans tracer (au-delà, l'outil sort) ; la fabrication le contrôle", () => {
          for (const { p, plan } of res) {
            let debut: number | null = null;
            for (let t = plan.finTransition; t <= plan.finPage; t += 1 / 60) {
              const e = etatOutil(plan, t);
              const libre = !!e && e.mode !== "trace";
              if (libre && debut === null) debut = t;
              if (!libre && debut !== null) {
                expect(t - debut, `page ${p.page.page} : outil sans tracer de ${debut.toFixed(2)} à ${t.toFixed(2)} s`).toBeLessThanOrEqual(OUTIL_TABLEAU.libreMaxSec + 0.04);
                debut = null;
              }
            }
          }
          expect(controlerAnimationTableau(props).filter((x) => x.controle === "outil")).toEqual([]);
        });

        it("B1 : la phrase de l'étape s'écrit pendant que la voix la dit (jamais posée avec la page)", () => {
          const { p, plan } = res.find((x) => x.p.page.elements.some((e) => e.gabarit?.sorte === "pastille"))!;
          const phrase = p.page.elements.find((e) => e.gabarit?.sorte === "phrase")!;
          expect(plan.poses.has(phrase.elementId)).toBe(false);
          const acts = plan.actions.filter((a) => a.id === phrase.elementId && a.trace === "ecrire");
          expect(acts.length).toBe(phrase.lignes.length);
          const fin = p.styleReference!.temps3![`${phrase.elementId}~fin`] / 1000;
          const titre = plan.actions.filter((a) => a.id === p.page.elements.find((e) => e.gabarit?.sorte === "titre")!.elementId);
          // Elle part juste après le titre et s'écrit au rythme de la voix : finie au plus tôt 0,8 s avant sa fin dite.
          expect(acts[0].debut - Math.max(...titre.map((a) => a.debut + a.duree))).toBeLessThanOrEqual(0.6);
          expect(Math.max(...acts.map((a) => a.debut + a.duree))).toBeGreaterThanOrEqual(Math.min(fin, plan.finPage - OUTIL_TABLEAU.calmeFinSec - OUTIL_TABLEAU.sortieSec) - 0.8);
        });

        it("I1 : chaque page reste finie, sans outil sur le contenu, avant le changement de page", () => {
          for (const { p, plan } of res) {
            const outil = actionsOutil(plan);
            const toutes = plan.actions.filter((a) => a.duree > 0);
            if (toutes.length) expect(Math.max(...toutes.map((a) => a.debut + a.duree)), `page ${p.page.page}`).toBeLessThanOrEqual(plan.finPage - OUTIL_TABLEAU.calmeFinSec + 1e-6);
            if (outil.length) expect(Math.max(...outil.map((a) => a.debut + a.duree)) + OUTIL_TABLEAU.sortieSec, `page ${p.page.page}`).toBeLessThanOrEqual(plan.finPage - OUTIL_TABLEAU.calmeMinSec + 1e-6);
            const t = plan.finPage - 0.3;
            const e = etatOutil(plan, t);
            if (e && e.mode === "trace") {
              const q = e.a.points[e.a.points.length - 1];
              const b = boiteOutil(style, q.x, q.y, 0, p.bandeSousTitres.px.y, p.styleReference!.k);
              for (const l of p.page.elements.flatMap((x) => x.lignes)) expect(b.x1 < l.px.x || b.x0 > l.px.x + l.px.largeur || b.y1 < l.px.y || b.y0 > l.px.y + l.px.hauteur, `page ${p.page.page} : l'outil couvre « ${l.texte} »`).toBe(true);
            }
            expect(e, `page ${p.page.page} : outil dans l'image à fin − 0,3 s`).toBeNull();
          }
        });

        it("I2 : seuls le repère et le numéro arrivent avec la page ; le titre s'écrit en 0,4 à 0,6 s dès l'effacement fini ; chaque ligne naît sous la pointe", () => {
          for (const { p, plan } of res) {
            for (const id of plan.poses) {
              const e = p.page.elements.find((x) => x.elementId === id.replace(/#attente$/, ""));
              const permis = e?.gabarit?.sorte === "partie" || e?.gabarit?.sorte === "pastille" || (p.page.page === 1 && e?.gabarit?.sorte === "accroche");
              expect(permis, `page ${p.page.page} : « ${id} » (${e?.gabarit?.sorte ?? e?.type}) posé avec la page`).toBe(true);
            }
            const titre = p.page.elements.find((e) => e.gabarit?.sorte === "titre");
            if (titre) {
              const acts = plan.actions.filter((a) => a.id === titre.elementId && a.trace === "ecrire");
              expect(acts.length).toBe(titre.lignes.length);
              const total = Math.max(...acts.map((a) => a.debut + a.duree)) - acts[0].debut;
              expect(acts[0].debut - plan.finTransition, `page ${p.page.page}`).toBeLessThanOrEqual(0.05);
              expect(total).toBeGreaterThanOrEqual(0.4 - 1e-6);
              expect(total).toBeLessThanOrEqual(0.6 + 1e-6);
            }
            for (const e of p.page.elements) {
              if (plan.poses.has(e.elementId) || !e.lignes.length || e.gabarit?.sorte === "pastille") continue;
              e.lignes.forEach((_, i) => {
                const a = plan.actions.find((x) => x.id === e.elementId && x.partie === `ligne:${i}`);
                expect(a, `page ${p.page.page} : « ${e.lignes[i].texte} » sans écriture`).toBeDefined();
                expect(a!.fondu, `page ${p.page.page} : « ${e.lignes[i].texte} » posé en fondu`).toBeFalsy();
              });
            }
          }
        });

        it("D5 : l'outil ne change de couleur que hors de l'image", () => {
          for (const { p, plan } of res) {
            let avant: boolean | null = null;
            for (let t = plan.debutPage; t <= plan.finPage; t += 1 / 60) {
              const e = etatOutil(plan, t);
              if (e && avant !== null) expect(e.accent, `page ${p.page.page} : couleur changée à ${t.toFixed(2)} s dans l'image`).toBe(avant);
              avant = e ? e.accent : null;
            }
          }
        });
      });

describe("les contrôles de la fabrication attrapent le défaut", () => {
  it("B1 : un outil qui reste levé au-dessus du contenu plus de 0,6 s est refusé", () => {
    const { props } = pages(ficheMaquettes, "ardoise", "vertical");
    const p = props.find((x) => x.page.elements.some((e) => e.gabarit?.sorte === "pastille"))!;
    // Un trou de 2 s entre deux tracés, sans sortie : ce que faisait le rendu de #289.
    const r = structuredClone(p.styleReference!);
    const fautes = controlerAnimationTableau([{ ...p, styleReference: r }], { etat: (plan, t) => ({ mode: "vol", de: plan.actions[0], vers: plan.actions[1], u: t % 1, accent: false }) });
    expect(fautes.map((f) => f.controle)).toContain("outil");
  });
});

describe("I3 : l'accroche en 3 lignes (4 au pire), coupe équilibrée, l'illustration reprend la place", () => {
  for (const style of STYLES_TABLEAU)
    for (const [nom, fiche] of FICHES)
      it(`${style} · ${nom}`, () => {
        const m = mettreEnPage(fiche(style), {});
        const p = m.pages[0];
        const a = p.elements.find((e) => e.gabarit?.sorte === "accroche")!;
        const corps = a.lignes.filter((_, i) => a.tableau!.lignes[i].taille >= Math.max(...a.tableau!.lignes.map((l) => l.taille)) - 1);
        expect(corps.length, corps.map((l) => l.texte).join(" / ")).toBeLessThanOrEqual(3);
        expect(corps.map((l) => l.texte.toLowerCase()).at(-1)).toMatch(/^le même temps/);
        // La plus grande taille possible (maquettes : ~110 à 150 px) : la ligne la plus large remplit la largeur de la zone
        // sûre (821 px en 9:16, la droite étant réservée aux boutons de TikTok) ; jamais sous 84 px.
        expect(Math.min(...a.tableau!.lignes.map((l) => l.taille))).toBeGreaterThanOrEqual(80);
        expect(Math.max(...a.tableau!.lignes.map((l) => l.taille))).toBeGreaterThanOrEqual(84);
        expect(Math.max(...corps.map((l) => l.px.largeur)) / m.zoneSure.px.largeur).toBeGreaterThanOrEqual(0.85);
        // L'illustration prend au moins un tiers de la hauteur du tableau.
        const dessin = p.elements.find((e) => !e.lignes.length && e.tableau?.apres?.length)!;
        const t = m.styleReference!.tableau!.contenu;
        expect(dessin.encombrement.px.hauteur / t.hauteur).toBeGreaterThanOrEqual(0.3);
      });
});

describe("D2 : items d'une ligne quand il y a la place ; case vide tracée, puis cochée", () => {
  for (const style of STYLES_TABLEAU)
    it(style, () => {
      const { res } = pages(ficheMaquettes, style, "vertical");
      const listes = res.filter(({ p }) => p.page.elements.some((e) => e.gabarit?.sorte === "case"));
      expect(listes.length).toBe(2);
      for (const { p, plan } of listes)
        for (const e of p.page.elements.filter((x) => x.gabarit?.sorte === "case")) {
          const texte = e.lignes.map((l) => l.texte).join(" ");
          expect(e.lignes.length, `« ${e.lignes.map((l) => l.texte).join(" / ")} »`).toBe(texte.length <= 17 ? 1 : e.lignes.length);
          expect(e.lignes.length).toBeLessThanOrEqual(2);
          // La case vide est le premier trait d'avant le texte, tracé par l'outil ; la coche vient après le texte.
          const g = e.gabarit!.sorte === "case" ? (e.gabarit!.boite as unknown as { x: number; largeur: number; px?: { x: number; largeur: number } }) : null;
          const b = g ? { px: g.px ?? g } : null;
          const t0 = e.tableau!.avant![0].p;
          expect(t0[0] >= b!.px.x - 1 && t0[0] <= b!.px.x + b!.px.largeur + 1).toBe(true);
          const acts = plan.actions.filter((a) => a.id === e.elementId);
          const caseVide = acts.find((a) => a.partie === "croquis:avant:0")!;
          const coche = acts.find((a) => a.trace === "coche")!;
          const ecrit = acts.find((a) => a.trace === "ecrire")!;
          expect(caseVide.debut).toBeLessThan(ecrit.debut);
          expect(coche.debut).toBeGreaterThan(ecrit.debut);
        }
    });
});

describe("I5 : le bouton d'appel est plein, terracotta #B44F29, dans les trois styles ; marge intérieure ≥ 40 px ; contraste ≥ 4,5:1", () => {
  for (const style of STYLES_TABLEAU)
    for (const [nom, fiche] of FICHES)
      for (const format of ["vertical", "portrait", "carre", "horizontal"] as const)
        it(`${style} · ${nom} · ${format}`, () => {
          const m = mettreEnPage(fiche(style), format === "vertical" ? {} : { format });
          const k = m.styleReference!.k;
          const b = m.pages.at(-1)!.elements.find((e) => e.lignes.some((l) => /r[ée]servez/i.test(l.texte)))!;
          const plaque = b.tableau?.objets?.find((o) => o.sorte === "plaque" || o.sorte === "carte");
          expect(plaque?.c).toBe("#B44F29");
          for (const [i, l] of b.lignes.entries()) {
            expect(contrasteTableau(b.tableau!.lignes[i].couleur, "#B44F29")).toBeGreaterThanOrEqual(4.5);
            expect(l.px.x - plaque!.x).toBeGreaterThanOrEqual(40 * k - 1);
            expect(plaque!.x + plaque!.l - (l.px.x + l.px.largeur)).toBeGreaterThanOrEqual(40 * k - 1);
          }
          // La taille de la maquette : toute la largeur de la colonne.
          expect(plaque!.l / m.zoneSure.px.largeur).toBeGreaterThanOrEqual(format === "vertical" ? 0.9 : 0.4);
        });
});

describe("D1 (revu le 17/10, design central) : les sous-titres se lisent sur chaque fond, sans pastille", () => {
  for (const style of STYLES_TABLEAU)
    it(style, () => {
      const f = ficheMaquettes(style);
      const cmd = commandeTableau({ videoId: "v", fiche: f, texteScript: "Un essai.", dureeSec: 3, centreSousTitresPct: 80, scenes: [] });
      const d = donneesCalque({ segments: [], base: "karaoke", ratio: "9:16", style: cmd.styles.sousTitres?.valeur });
      // Le design central (retour de Will sur #330) : plus de pastille ; ce qui est derrière le texte est le décor posé
      // dans la commande (la bande sombre de fond sur les fonds clairs, le support sur l'ardoise).
      expect(d.pastille).toBeUndefined();
      const derriere = cmd.styles.decor!.valeur!.teinte!;
      if (style === "ardoise") expect(derriere).toBe(CHARTES_TABLEAU.ardoise.fond);
      expect(contrasteTableau(d.couleurs.texte, derriere)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteTableau(d.couleurs.accent, derriere)).toBeGreaterThanOrEqual(4.5);
    });
});

describe("lisible sur téléphone : les chiffres de l'exemple (« 10 », « 3 ») font au moins 100 px dans toutes les sorties", () => {
  for (const style of STYLES_TABLEAU)
    for (const [nom, fiche] of FICHES)
      it(`${style} · ${nom}`, () => {
        for (const format of ["vertical", "portrait", "carre", "horizontal"] as const) {
          const m = mettreEnPage(fiche(style), format === "vertical" ? {} : { format });
          const p = m.pages.find((x) => x.elements.some((e) => e.elementId.endsWith("~etiquette")))!;
          const chiffres = p.elements.filter((e) => /^\d/.test(e.lignes[0]?.texte ?? ""));
          expect(chiffres.length, format).toBe(2);
          for (const e of chiffres) expect(e.tableau!.lignes[0].taille, `${format} « ${e.lignes[0].texte} »`).toBeGreaterThanOrEqual(84 * m.styleReference!.k);
          expect(Math.max(...chiffres.map((e) => e.tableau!.lignes[0].taille)), format).toBeGreaterThanOrEqual(100 * m.styleReference!.k);
        }
      });
});

describe("pendant l'attente de la page suivante, la barre garde le chapitre de la page d'avant", () => {
  it("la page d'appel connaît la partie de la page « À retenir » (chapitre Exemple, pas « À vous »)", () => {
    for (const style of STYLES_TABLEAU) {
      const { props } = pages(ficheTemoinV667Corrige, style, "vertical");
      const appel = props.at(-1)!.styleReference!.tableau!;
      expect(appel.partie).toBe("appel");
      expect(appel.partieAvant).toBe("retenir");
      expect(chapitreDePartie(appel.partieAvant!)).toBe(2);
    }
  });
});
