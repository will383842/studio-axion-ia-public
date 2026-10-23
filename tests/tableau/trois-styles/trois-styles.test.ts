/**
 * LES TROIS STYLES DU TABLEAU (maquettes validées, PR #280, 16/10/2026) : choix du style (un style par série, le champ
 * `styleTableau` de la fiche prend le dessus), mise en page manuscrite, et les CONTRÔLES AUTOMATIQUES de chaque style
 * sur le témoin v-667edcd8e3a8 et la fiche des maquettes, en 9:16 et en 4:5 (et dans les autres sorties) :
 * contraste ≥ 4,5:1 (texte) et ≥ 3:1 (traits), aucune couleur hors charte, bande des sous-titres libre (outil compris),
 * texte jamais coupé, pas d'écran vide entre deux pages, contenu sur 85 à 95 % de la hauteur utile, aucun doublon.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { STYLES_TABLEAU, STYLE_PAR_SERIE, CHARTES_TABLEAU, contrasteTableau, horsCharteTableau, styleTableauDe, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerAnimationTableau, controlerMiseEnPageTableau, EFFACEMENT_TABLEAU_SEC } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { problemesAnimation3 } from "../../../src/moteurs/montage-tableau/controles-v3";
import { avecStyleTableau, validerFicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { chiffreDuTexte, themeDessin } from "../../../src/moteurs/montage-tableau/mise-en-page-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { calee, contexteTableau, ficheMaquettes, ficheTemoinV667, ficheTemoinV667Corrige } from "./fiches";

const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;
const mise = (f: ReturnType<typeof ficheMaquettes>, format: (typeof FORMATS)[number]) => mettreEnPage(f, format === "vertical" ? {} : { format });

describe("un style par série ; le style de la fiche prend le dessus", () => {
  it("Formation → ardoise, Automatisations → tableau blanc, Audit, Coaching et toute autre série → paperboard", () => {
    expect(STYLE_PAR_SERIE).toEqual({ formation: "ardoise", automatisations: "tableau-blanc", audit: "paperboard", coaching: "paperboard" });
    expect(styleTableauDe({ serie: { code: "formation" } })).toBe("ardoise");
    expect(styleTableauDe({ serie: { code: "automatisations" } })).toBe("tableau-blanc");
    expect(styleTableauDe({ serie: { code: "audit" } })).toBe("paperboard");
    expect(styleTableauDe({ serie: { code: "coaching" } })).toBe("paperboard");
    expect(styleTableauDe({ serie: { code: "inconnue" } })).toBe("paperboard");
    expect(styleTableauDe({ serie: { code: "formation" }, styleTableau: "tableau-blanc" })).toBe("tableau-blanc");
    expect(styleTableauDe({ serie: { code: "formation" }, styleTableau: "nimporte" })).toBe("ardoise");
  });

  it("la fabrication et le découpage posent le style de la série sur une fiche « reference/3 » qui n'en a pas", () => {
    expect(avecStyleTableau(ficheTemoinV667()).styleTableau).toBe("ardoise");
    expect(avecStyleTableau({ ...ficheTemoinV667(), styleTableau: "paperboard" }).styleTableau).toBe("paperboard");
    expect(avecStyleTableau({ ...ficheTemoinV667(), habillage: "reference/2" }).styleTableau).toBeUndefined();
    const m = mettreEnPage(avecStyleTableau(ficheTemoinV667()), {});
    expect(m.styleReference?.tableau?.style).toBe("ardoise");
    // Sans style (fiche d'avant, appel pur) : la page ivoire, inchangée.
    expect(mettreEnPage(ficheTemoinV667(), {}).styleReference?.tableau).toBeUndefined();
  });

  it("la fiche refuse un style inconnu ; elle accepte les trois styles", () => {
    const f = ficheTemoinV667Corrige();
    for (const s of STYLES_TABLEAU) expect(validerFicheTableau({ ...f, styleTableau: s }, contexteTableau(f)).ok).toBe(true);
    const v = validerFicheTableau({ ...f, styleTableau: "tableau-vert" }, contexteTableau(f));
    expect(v.ok).toBe(false);
    expect(v.ok ? "" : v.problemes.map((p) => p.message).join(" ")).toMatch(/style du tableau « tableau-vert » n'existe pas/);
  });
});

describe("chartes des trois styles", () => {
  for (const s of STYLES_TABLEAU)
    it(`${s} : aucune couleur verte, bleue ou violette ; encre, accent écrit, texte secondaire, bouton ≥ 4,5:1`, () => {
      const S = CHARTES_TABLEAU[s];
      for (const c of [S.fond, S.encre, S.accent, S.accentTexte, S.doux, S.clair, S.moyen, S.ombre, S.fondPostit, S.fondCarte, S.fondBouton, S.encreBouton, ...(S.surligneur ? [S.surligneur] : [])]) expect(horsCharteTableau(c), c).toBe(false);
      expect(contrasteTableau(S.encre, S.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteTableau(S.accentTexte, S.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteTableau(S.doux, S.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteTableau(S.encreBouton, S.fondBouton)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteTableau(S.accent, S.fond)).toBeGreaterThanOrEqual(3);
    });
});

for (const style of STYLES_TABLEAU) {
  describe(`style ${style} : contrôles automatiques`, () => {
    for (const [nom, fiche] of [["maquettes", () => ficheMaquettes(style)], ["témoin v-667edcd8e3a8", () => ficheTemoinV667Corrige(style)]] as const) {
      for (const format of FORMATS)
        it(`${nom}, ${format} : contraste, charte, bande libre, texte non coupé, remplissage 85-95 %, aucun doublon`, () => {
          const m = mise(fiche(), format);
          expect(m.styleReference?.tableau?.style).toBe(style);
          expect(controlerMiseEnPageTableau(m)).toEqual([]);
        });

      it(`${nom} : entre deux pages (effacement ${EFFACEMENT_TABLEAU_SEC} s, jamais d'écran vide), outil hors de la bande — 9:16 et 4:5`, () => {
        const c = calee(fiche());
        expect(c.refus).toEqual([]);
        for (const format of ["vertical", "portrait"] as const) {
          const m = mise(c.fiche, format);
          const props = proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots, temps3: tempsReference3(c.fiche, c.mots) });
          expect(controlerAnimationTableau(props)).toEqual([]);
          // Les contrôles d'animation de la fabrication (accroche pleine à 0 s, blocs à l'heure, page jamais vide,
          // titre jamais seul, appel lisible et animé) valent aussi pour les trois styles.
          expect(problemesAnimation3(props as never)).toEqual([]);
        }
      });
    }
  });
}

describe("les contrôles sont vrais (ils attrapent le défaut)", () => {
  const base = () => mise(ficheMaquettes("tableau-blanc"), "vertical");
  const modifier = (m: MiseEnPageTableau, f: (m: MiseEnPageTableau) => void) => {
    const c = structuredClone(m);
    f(c);
    return controlerMiseEnPageTableau(c).map((p) => p.controle);
  };
  it("un texte gris clair sur le tableau blanc → contraste", () => {
    expect(modifier(base(), (m) => (m.pages[0].elements.find((e) => e.tableau?.lignes.length)!.tableau!.lignes[0].couleur = "#C9C3BB"))).toContain("contraste");
  });
  it("un trait vert → charte", () => {
    expect(modifier(base(), (m) => (m.pages[0].elements.find((e) => e.tableau?.apres?.length)!.tableau!.apres![0].c = "#2E8B57"))).toContain("charte");
  });
  it("une ligne descendue dans la bande → bande", () => {
    expect(modifier(base(), (m) => { const e = m.pages[0].elements.find((x) => x.lignes.length)!; e.lignes[0].px.y = m.bandeSousTitres.px.y + 10; })).toContain("bande");
  });
  it("une ligne plus longue que sa place → coupe", () => {
    expect(modifier(base(), (m) => { const e = m.pages[1].elements.find((x) => x.lignes.length && x.tableau)!; e.lignes[0].texte += " et encore des mots"; })).toContain("coupe");
  });
  it("une page remplie à 60 % → remplissage", () => {
    expect(modifier(base(), (m) => (m.pages[0].occupation = 0.6))).toContain("remplissage");
  });
  it("une phrase qui reprend le titre → doublon", () => {
    expect(modifier(base(), (m) => { const p = m.pages[1]; const ph = p.elements.find((e) => e.gabarit?.sorte === "phrase")!; ph.lignes[0].texte = `${p.elements.find((e) => e.gabarit?.sorte === "titre")!.lignes.map((l) => l.texte).join(" ")} ${ph.lignes[0].texte}`; })).toContain("doublon");
  });
});

describe("mise en page manuscrite", () => {
  it("le chiffre d'un exemple est lu pour être écrit en très grand (« 10 minutes » → « 10 », « min »)", () => {
    expect(chiffreDuTexte("10 minutes par mail.")).toEqual({ avant: "", nombre: "10", unite: "min", apres: "par mail" });
    expect(chiffreDuTexte("Chaque mail lui prenait 10 minutes.")).toMatchObject({ avant: "Chaque mail lui prenait", nombre: "10", unite: "min" });
    expect(chiffreDuTexte("Elle relit un brouillon.")).toBeNull();
  });
  it("le dessin de la page suit ses mots (mails et temps → sablier et enveloppes ; rédiger → feuilles et loupe)", () => {
    expect(themeDessin("Vos équipes ont l'IA, et leurs mails prennent le même temps.")).toBe("temps-mails");
    expect(themeDessin("Faites rédiger les réponses")).toBe("flux");
    expect(themeDessin("Relisez avant d'envoyer")).toBe("relire");
  });
  it("le témoin v-667edcd8e3a8 : chaque page dans chaque style, la phrase de l'étape sans son titre, l'exemple avec « 10 min »", () => {
    for (const s of STYLES_TABLEAU as readonly StyleTableau[]) {
      const m = mettreEnPage(ficheTemoinV667Corrige(s), {});
      const textes = m.pages.map((p) => p.elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" "));
      const phrase = m.pages[3].elements.find((e) => e.gabarit?.sorte === "phrase")!.lignes.map((l) => l.texte).join(" ");
      expect(phrase).toMatch(/^les réponses aux/);
      expect(textes[6]).toMatch(/\b10\b/);
      expect(textes[6]).toMatch(/Exemple illustratif/);
    }
  });
  it("le rendu n'écrit jamais un texte en transparence (contraste à chaque image, fondus compris)", () => {
    const src = readFileSync(new URL("../../../studio-rendu/compositions/tableau/trois-styles/PageTableau.tsx", import.meta.url), "utf8");
    const fonction = src.slice(src.indexOf("function dessinerLigne("), src.indexOf("function pointeLigne("));
    expect(fonction).toMatch(/const alpha = 1;/);
    expect(src).not.toMatch(/opaciteLigne3\(/);
  });
});
