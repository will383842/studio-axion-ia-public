/**
 * Charte Axion du style « reference/3 » (direction A « Page ivoire », choisie par Will le 15/10/2026, maquette de la
 * PR #241) : seulement les quatre couleurs de la charte et leurs teintes dérivées ; repères de partie « La douleur »,
 * « La solution » (jamais « Le problème » ni « La méthode ») ; sous-titres communs du studio dans une bande basse que
 * la page ne touche jamais, dans les quatre sorties et la sortie TikTok / Shorts.
 */
import { describe, expect, it } from "vitest";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { COULEURS_REPLI, fabriquerSousTitres } from "../../../src/briques/sous-titres";
import { sceneAuTemps } from "../../../src/briques/sous-titres/scene";
import { COULEURS_REFERENCE_3, CRAYON_REFERENCE_3, LIBELLES_PARTIES_3 } from "../../../src/briques/tableau-scene/reference/charte";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio, sousTitresAxion, STYLE_SOUS_TITRES_TABLEAU } from "../../../src/moteurs/montage-tableau/fabriquer";
import { bandeDe, sousTitresTableau, supplementsSousTitresTableau, zoneTexteTableau, bandeDuCalque } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { formatSortie, IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { caleeEcritureALHeure, ficheEcritureALHeure } from "./fiches";

const CHARTE = ["#110A05", "#B44F29", "#E9DCC8", "#BFA88B"];
// Teintes dérivées, assombries le 15/10 pour le contraste (mesuré par `contraste.test.ts`).
const DERIVEES = ["#F6F1E8", "#5E4F3E", "#993F1E", "#ECE1D0", "#8E7A62", "#E9D1C2", "#96816A", "#75644F", "#3A2C20"];
// Teintes des visuels dessinés et du peps (maquette validée le 15/10, PR #260) : mine du crayon, marqueur orange franc.
DERIVEES.push("#2B1F16", "#E2C0AF");

/** Teinte (degrés) et saturation d'une couleur « #RRGGBB ». */
function teinte(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  const h = d === 0 ? 0 : mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240;
  return { h, s: mx ? d / mx : 0 };
}

describe("couleurs", () => {
  it("le style ne dessine que la charte et ses teintes dérivées (maquette A), toutes de la famille brun-orange", () => {
    const toutes = [...Object.values(COULEURS_REFERENCE_3), ...CRAYON_REFERENCE_3.corps, CRAYON_REFERENCE_3.bois, CRAYON_REFERENCE_3.bague, CRAYON_REFERENCE_3.gomme, CRAYON_REFERENCE_3.stries];
    for (const c of Object.values(COULEURS_REFERENCE_3)) expect([...CHARTE, ...DERIVEES]).toContain(c);
    for (const c of toutes) {
      const { h, s } = teinte(c);
      if (s > 0.05) expect(h >= 5 && h <= 60, `${c} : teinte ${h.toFixed(0)}°`).toBe(true);
    }
  });

  it("la mise en page n'emploie que ces couleurs (texte, fonds, décors), dans les quatre sorties", () => {
    const f = ficheEcritureALHeure();
    for (const format of IDS_FORMATS_SORTIE) {
      const m = mettreEnPage(f, format === "vertical" ? {} : { format });
      const vues = new Set<string>();
      for (const p of m.pages)
        for (const e of p.elements) {
          for (const c of [e.couleurTexte, e.couleurFond, e.couleurMarque]) if (c) vues.add(c);
          const g = e.gabarit as Record<string, unknown> | undefined;
          for (const k of ["couleur", "fond", "couleurPoint"]) if (typeof g?.[k] === "string") vues.add(g[k] as string);
        }
      expect([...vues].filter((c) => ![...CHARTE, ...DERIVEES].includes(c.toUpperCase()))).toEqual([]);
    }
  });

  it("repères de partie : une douleur, puis une solution ; jamais « Le problème » ni « La méthode »", () => {
    expect(LIBELLES_PARTIES_3).toMatchObject({ accroche: "L'accroche", douleur: "La douleur", solution: "La solution", exemple: "Exemple illustratif", retenir: "À retenir", appel: "À vous" });
    const m = mettreEnPage(ficheEcritureALHeure());
    const textes = JSON.stringify(m.pages.map((p) => p.elements.find((e) => e.gabarit?.sorte === "partie")?.lignes[0].texte));
    expect(textes).not.toMatch(/probl[eè]me|méthode/i);
  });

  it("une seule ligne en orange par page (titre ou phrase clé, ou la fin de la phrase d'appel)", () => {
    const m = mettreEnPage(ficheEcritureALHeure());
    for (const p of m.pages) {
      const accents = p.elements.filter((e) => e.gabarit && "accent" in e.gabarit && e.gabarit.accent !== undefined);
      expect(accents.length, `page ${p.page}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("sous-titres (décision de Will : oui)", () => {
  const { fiche, mots } = caleeEcritureALHeure();
  const texte = fiche.scenes.map((s) => s.texteDit).join(" ");

  it("la commande du tableau « reference/3 » active les sous-titres communs : le style central « Avocat » (17/10)", () => {
    const c = commandeTableau({ videoId: "v", fiche, texteScript: texte, dureeSec: 80, centreSousTitresPct: 76, scenes: [{ id: "s01", debutSec: 0, finSec: 80, cle: "k" }] });
    expect(c.briques["sous-titres"]).toBe(true);
    expect(c.styles.sousTitres?.id).toBe("st-avocat-v1");
    expect(c.sousTitres?.base).toBe("karaoke");
    expect(c.styles.sousTitres?.valeur).toMatchObject({ gabarit: "karaoke", police: "Poppins ExtraBold", positionPct: 76 });
    expect(c.styles.sousTitres?.valeur?.pastille).toBeUndefined();
    expect(c.styles.sousTitres?.nom).toBe("Avocat");
    // Les anciens styles écrits au crayon restent sans sous-titres.
    for (const habillage of ["reference/1", "reference/2"]) expect(commandeTableau({ videoId: "v", fiche: { ...fiche, habillage }, texteScript: texte, dureeSec: 80, centreSousTitresPct: 76, scenes: [] }).briques["sous-titres"]).toBe(false);
  });

  for (const format of [...IDS_FORMATS_SORTIE, "vertical-liens" as const]) {
    it(`${format} : bande basse réservée, la page n'y descend jamais, chaque groupe y est dessiné au design central`, () => {
      const image = format === "vertical-liens" ? "vertical" : format;
      const mise = mettreEnPage(fiche, image === "vertical" ? {} : { format: image });
      const b = mise.bandeSousTitres.px;
      expect(b.hauteur).toBeGreaterThan(100);
      expect(b.y + b.hauteur).toBe(mise.zoneSure.px.y + mise.zoneSure.px.hauteur);
      for (const p of mise.pages) for (const e of p.elements) expect((e.encombrement ?? e).px.y + (e.encombrement ?? e).px.hauteur, `${e.elementId}`).toBeLessThanOrEqual(b.y);
      const f = formatSortie(image);
      const dureeSec = mots.at(-1)!.finSec + 0.5;
      const scenes = [{ id: "s01", debutSec: 0, finSec: dureeSec, cle: "k" }];
      const reseaux = image === "vertical" ? reseauxVerticaux() : reseauxDuRatio(f.ratio);
      const bande = bandeDe(mise, f.ratio, image === "vertical", reseaux);
      const c = commandeTableau({ videoId: "v", fiche, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: f.ratio, bandeSousTitres: bande });
      const st = sousTitresTableau({ fiche, positionPct: centreBandePct(mise), bande });
      const segments = sousTitresAxion(fabriquerSousTitres({ texte, dureeSec, mots, prononciations: [], style: STYLE_SOUS_TITRES_TABLEAU, base: "karaoke", ratio: f.ratio, reseaux }));
      expect(segments.every((s) => s.style === "base" && s.position === "auto")).toBe(true);
      const params = parametresComposition(c, { ratio: f.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: "k" }, ...supplementsSousTitresTableau({ st, mise, ratio: f.ratio, verticale: image === "vertical" }) }, RECETTE_COMPOSITION_TABLEAU);
      const calque = params.texte.sousTitres!;
      // Design central (17/10) : couleurs de la marque, aucune pastille ; bande sombre de fond sur la page ivoire.
      expect(calque.pastille).toBeUndefined();
      expect(calque.couleurs).toEqual(COULEURS_REPLI);
      expect(calque.bandeFond?.couleur).toBe(COULEURS_REPLI.contour);
      const zone = zoneTexteTableau(st, bandeDuCalque(mise, calque));
      const e = calque.echelleTexte ?? calque.largeur / 1080;
      for (const s of calque.segments) {
        const t = (s.mots[0].debutSec + s.mots[0].finSec) / 2;
        const el = sceneAuTemps(calque, Math.max(t, s.debutSec + 0.01))!;
        // La ligne entière (texte + contour) reste dans la partie pleine de la bande basse, jamais sur la page.
        const demi = (el.taillePx * 1.1) / 2 + (el.gabarit.contourPx * e) / 2;
        expect(el.yPx - demi, `« ${s.mots.map((m) => m.mot).join(" ")} »`).toBeGreaterThanOrEqual(zone.y - 1);
        expect(el.yPx + demi).toBeLessThanOrEqual(b.y + b.hauteur + 1);
        expect(el.police).toBe("Poppins ExtraBold");
        // Karaoké central : le mot dit à l'orange de la marque, les mots déjà dits en crème.
        expect(el.mots[0].couleur).toBe(COULEURS_REPLI.accent);
      }
    });
  }
});
