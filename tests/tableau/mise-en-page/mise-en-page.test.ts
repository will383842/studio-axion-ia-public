/**
 * Mise en page du tableau animé (TB-03) : sur 20 fiches (4 exemples + 16 variantes), aucune ligne hors zone sûre ni
 * dans la bande des sous-titres, aucun chevauchement, texte ≥ 3 % de la hauteur, ordre d'écriture, déterminisme.
 */
import { describe, expect, it } from "vitest";
import {
  BANDE_SOUS_TITRES_HAUTEUR,
  CONTRASTE_TEXTE_MIN,
  COULEURS_VIDEO,
  MARGES_VIDEO,
  TAILLE_PLANCHER_VIDEO,
  tailleVideoPx,
} from "../../../src/briques/habillage/charte-video";
import { rapportContraste } from "../../../src/briques/habillage/contraste";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import {
  DIMENSIONS_TABLEAU,
  ErreurMiseEnPage,
  REFERENCE_CONTROLE,
  boitesDeControle,
  cadres,
  mettreEnPage,
  zoneSureTableau,
  type ElementPlace,
  type RectPx,
} from "../../../src/moteurs/montage-tableau/mise-en-page";
import { listerReseaux, zoneProtegeeCombinee } from "../../../src/reseaux";
import { contexteExemple, copie, ficheAvantApres, ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";
import { VARIANTES, VINGT_FICHES } from "./variantes";

const { largeur: W, hauteur: H } = DIMENSIONS_TABLEAU;
const dedans = (a: RectPx, b: RectPx) => a.x >= b.x && a.y >= b.y && a.x + a.largeur <= b.x + b.largeur && a.y + a.hauteur <= b.y + b.hauteur;
const recouvre = (a: RectPx, b: RectPx) => Math.min(a.x + a.largeur, b.x + b.largeur) > Math.max(a.x, b.x) && Math.min(a.y + a.hauteur, b.y + b.hauteur) > Math.max(a.y, b.y);
const aTexte = (e: ElementPlace) => e.lignes.length > 0;

describe("les 20 fiches de test", () => {
  it("4 exemples et 16 variantes, toutes valides, règle 4 comprise (mots et mise en page réelle)", () => {
    expect(VINGT_FICHES).toHaveLength(20);
    expect(VARIANTES).toHaveLength(16);
    expect(new Set(VINGT_FICHES.map((v) => v.fiche.videoId)).size).toBe(20);
    for (const { nom, fiche } of VINGT_FICHES) {
      const r = validerFicheTableau(fiche, contexteExemple(fiche));
      expect(r.ok ? [] : r.problemes.map((p) => `${nom} : ${p.message}`)).toEqual([]);
    }
  });

  describe.each(VINGT_FICHES.map((v) => [v.nom, v.fiche] as const))("%s", (_nom, fiche) => {
    const mp = mettreEnPage(fiche);
    const bande = mp.bandeSousTitres.px;
    const zone = mp.zoneSure.px;

    it("une page par numéro, chaque élément placé une fois (gestes à part)", () => {
      expect(mp.pages.map((p) => p.page)).toEqual([...new Set(fiche.scenes.map((s) => s.page))].sort((a, b) => a - b));
      const places = mp.pages.flatMap((p) => [...p.elements.map((e) => e.elementId), ...p.gestes.map((g) => g.elementId)]);
      expect(places.sort()).toEqual(fiche.scenes.flatMap((s) => s.elements.map((e) => e.id)).sort());
    });

    it("aucune ligne hors zone sûre ni dans la bande des sous-titres", () => {
      for (const p of mp.pages)
        for (const e of p.elements) {
          expect(dedans(e.px, zone)).toBe(true);
          expect(dedans(e.px, mp.cadre.px)).toBe(true);
          expect(e.px.y + e.px.hauteur).toBeLessThanOrEqual(bande.y);
          for (const l of e.lignes) {
            expect(dedans(l.px, e.px)).toBe(true);
            expect(recouvre(l.px, bande)).toBe(false);
          }
        }
    });

    it("aucun chevauchement entre éléments, ni entre lignes", () => {
      for (const p of mp.pages) {
        const els = p.elements;
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) expect(recouvre(els[i].px, els[j].px), `${els[i].elementId} / ${els[j].elementId}`).toBe(false);
        const lignes = els.flatMap((e) => e.lignes);
        for (let i = 0; i < lignes.length; i++) for (let j = i + 1; j < lignes.length; j++) expect(recouvre(lignes[i].px, lignes[j].px)).toBe(false);
      }
    });

    it("texte à 3 % de la hauteur au moins", () => {
      for (const p of mp.pages) for (const e of p.elements.filter(aTexte)) expect(e.taillePx!).toBeGreaterThanOrEqual(TAILLE_PLANCHER_VIDEO * H);
    });

    it("de haut en bas dans l'ordre d'écriture, sans effacer", () => {
      for (const p of mp.pages) {
        expect(p.elements.map((e) => e.ordre)).toEqual([...p.elements.map((e) => e.ordre)].sort((a, b) => a - b));
        const textes = p.elements.filter(aTexte);
        for (let i = 1; i < textes.length; i++) expect(textes[i].px.y).toBeGreaterThan(textes[i - 1].px.y);
        // Un dessin se pose à la hauteur du texte écrit avant lui, ou plus bas.
        p.elements.forEach((e, i) => {
          const avant = p.elements.slice(0, i).filter(aTexte).at(-1);
          if (e.type === "dessin" && avant) expect(e.px.y).toBeGreaterThanOrEqual(avant.px.y);
        });
      }
    });

    it("fractions = pixels rapportés à 1080 × 1920", () => {
      for (const p of mp.pages)
        for (const e of p.elements) {
          expect(e.fraction.x).toBeCloseTo(e.px.x / W, 5);
          expect(e.fraction.y).toBeCloseTo(e.px.y / H, 5);
          expect(e.fraction.largeur).toBeCloseTo(e.px.largeur / W, 5);
          expect(e.fraction.hauteur).toBeCloseTo(e.px.hauteur / H, 5);
          for (const v of Object.values(e.px)) expect(Number.isInteger(v)).toBe(true);
        }
    });

    it("même fiche = même mise en page, au pixel près ; calée ou non ; la fiche n'est pas modifiée", () => {
      const avant = JSON.stringify(fiche);
      expect(JSON.stringify(mettreEnPage(copie(fiche)))).toBe(JSON.stringify(mp));
      const calee = copie(fiche);
      calee.scenes.forEach((s, i) => Object.assign(s, { debutMs: i * 3000, finMs: (i + 1) * 3000 }));
      expect(mettreEnPage(calee)).toEqual(mp);
      expect(JSON.stringify(fiche)).toBe(avant);
    });

    it("chaque geste vise le rectangle de sa cible", () => {
      for (const p of mp.pages)
        for (const g of p.gestes) {
          const cible = p.elements.find((e) => e.elementId === g.cibleId)!;
          expect(g.cible.px).toEqual(cible.px);
        }
    });
  });
});

describe("zones, marges et bande lues ailleurs (rien en dur)", () => {
  it("zone sûre = union des réseaux qui publient du 9:16 (registre des réseaux)", () => {
    const ids = listerReseaux().filter((r) => r.zonesProtegees["9:16"]).map((r) => r.id);
    expect(zoneSureTableau()).toEqual(zoneProtegeeCombinee("9:16", ids));
    const z = zoneSureTableau();
    const { zoneSure } = cadres();
    expect(zoneSure).toEqual({ x: Math.round((z.gauche / 100) * W), y: Math.round((z.haut / 100) * H), largeur: zoneSure.largeur, hauteur: zoneSure.hauteur });
    expect(zoneSure.x + zoneSure.largeur).toBe(W - Math.round((z.droite / 100) * W));
    expect(zoneSure.y + zoneSure.hauteur).toBe(H - Math.round((z.bas / 100) * H));
  });

  it("bande des sous-titres en bas de la zone sûre, page au-dessus, marges de l'habillage", () => {
    const { cadre, bande, zoneSure } = cadres();
    expect(bande.hauteur).toBe(Math.round(BANDE_SOUS_TITRES_HAUTEUR * H));
    expect(bande.y + bande.hauteur).toBe(zoneSure.y + zoneSure.hauteur);
    expect(cadre.y + cadre.hauteur).toBe(bande.y);
    // La zone sûre est déjà une marge : un demi-écart dedans, et la marge de page depuis le bord de l'image.
    const marge = Math.round(MARGES_VIDEO.page * W);
    const garde = Math.round((MARGES_VIDEO.entreLignes * W) / 2);
    expect(cadre.x).toBe(Math.max(marge, zoneSure.x + garde));
    expect(cadre.y).toBe(Math.max(marge, zoneSure.y + garde));
    expect(cadre.x + cadre.largeur).toBe(Math.min(W - marge, zoneSure.x + zoneSure.largeur - garde));
  });

  it("zone d'un seul réseau : plus de place, toujours dans la zone de ce réseau", () => {
    const large = mettreEnPage(ficheErreurCorrigee, { reseaux: ["linkedin"] });
    expect(large.cadre.px.largeur).toBeGreaterThan(mettreEnPage(ficheErreurCorrigee).cadre.px.largeur);
    for (const p of large.pages) for (const e of p.elements) expect(dedans(e.px, large.zoneSure.px)).toBe(true);
  });
});

describe("dispositions", () => {
  it("avant / après : la bulle de preuve à 2 lignes s'écrit en deux colonnes côte à côte", () => {
    const mp = mettreEnPage(ficheAvantApres);
    const bulle = mp.pages.flatMap((p) => p.elements).find((e) => e.elementId === "e09")!;
    expect(bulle.deuxColonnes).toBe(true);
    const avant = bulle.lignes.filter((l) => l.colonne === "avant");
    const apres = bulle.lignes.filter((l) => l.colonne === "apres");
    // L'étiquette « Avant : » / « Après : » devient le titre de sa colonne.
    expect(avant.map((l) => l.texte).join(" ")).toBe("une heure");
    expect(apres.map((l) => l.texte).join(" ")).toBe("deux minutes");
    expect(bulle.bulle!.etiquettes.map((l) => [l.texte, l.colonne])).toEqual([
      ["Avant", "avant"],
      ["Après", "apres"],
    ]);
    expect(Math.min(...apres.map((l) => l.px.x))).toBeGreaterThan(Math.max(...avant.map((l) => l.px.x + l.px.largeur)));
    expect(apres[0].px.y).toBe(avant[0].px.y);
  });

  it("autres structures : la bulle empile ses lignes", () => {
    const bulle = mettreEnPage(ficheErreurCorrigee).pages.flatMap((p) => p.elements).find((e) => e.type === "preuve")!;
    expect(bulle.deuxColonnes).toBe(false);
    expect(bulle.lignes.every((l) => l.colonne === undefined)).toBe(true);
  });

  it("dessins : à gauche contre la marge gauche, à droite contre la marge droite, au centre centré", () => {
    for (const v of VINGT_FICHES) {
      const mp = mettreEnPage(v.fiche);
      const c = mp.cadre.px;
      for (const e of mp.pages.flatMap((p) => p.elements).filter((x) => x.type === "dessin")) {
        if (e.cote === "gauche") expect(e.px.x).toBe(c.x);
        if (e.cote === "droite") expect(e.px.x + e.px.largeur).toBe(c.x + c.largeur);
        if (e.cote === "centre") expect(Math.abs(e.px.x + e.px.largeur / 2 - (c.x + c.largeur / 2))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("chiffre (taille du titre), mention (taille de légende) et ponctuation jamais seule en début de ligne", () => {
    const mp = mettreEnPage(ficheQuestionAbonne);
    const tous = mp.pages.flatMap((p) => p.elements);
    const chiffre = tous.find((e) => e.type === "chiffre")!;
    const mention = tous.find((e) => e.type === "mention")!;
    expect(chiffre.niveau).toBe("titre");
    expect(chiffre.lignes.map((l) => l.texte).join(" ")).toBe("2 jours");
    expect(mention.niveau).toBe("legende");
    expect(mention.lignes.map((l) => l.texte).join(" ")).toBe("Exemple illustratif");
    for (const l of tous.flatMap((e) => e.lignes)) expect(l.texte).toMatch(/^[\p{L}\p{N}]/u);
  });

  it("page trop pleine : réduite d'un seul facteur, sinon refusée en nommant la page", () => {
    const f: FicheTableau = copie(ficheErreurCorrigee);
    f.scenes.forEach((s) => (s.page = 1));
    for (const s of f.scenes) s.elements.push({ id: `${s.id}x`, type: "ligne", texte: "Une ligne de plus pour remplir la page", niveau: "titre", role: "regle", ancre: 0 });
    expect(() => mettreEnPage(f)).toThrow(ErreurMiseEnPage);
    expect(() => mettreEnPage(f)).toThrow(/^Page 1 · le contenu ne tient pas/);
    const reduite = VINGT_FICHES.flatMap((v) => mettreEnPage(v.fiche).pages).find((p) => p.echelle < 1)!;
    expect(reduite.echelle).toBeGreaterThan(0.5);
  });
});

describe("valeurs de référence pour les règles 4 et 5", () => {
  it("découlent de la mise en page et de l'habillage", () => {
    expect(REFERENCE_CONTROLE).toEqual({ hauteurImagePx: H, largeurUtilePx: cadres().cadre.largeur, taillePx: { titre: tailleVideoPx("titre", H), texte: tailleVideoPx("corps", H) } });
    expect(REFERENCE_CONTROLE.taillePx.texte).toBeGreaterThanOrEqual(TAILLE_PLANCHER_VIDEO * H);
  });
});

describe("boîtes pour un contrôle d'image", () => {
  it("une boîte par ligne écrite : texte, taille, couleurs (contraste ≥ 7:1), rôle, position", () => {
    for (const v of VINGT_FICHES) {
      const mp = mettreEnPage(v.fiche);
      const boites = boitesDeControle(mp);
      // Une boîte par ligne écrite, et pour une bulle : phrase testée, étiquettes, date (quand elles sont connues).
      const bulles = mp.pages.flatMap((p) => p.elements).flatMap((e) => (e.bulle ? [...e.bulle.phrase, ...e.bulle.etiquettes, ...(e.bulle.date.texte ? [e.bulle.date] : [])] : []));
      expect(boites).toHaveLength(mp.pages.flatMap((p) => p.elements).flatMap((e) => e.lignes).length + bulles.length);
      for (const b of boites) {
        expect(b.texte.length).toBeGreaterThan(0);
        expect(b.couleurTexte).toBe(COULEURS_VIDEO.ecriture);
        expect(b.couleurFond).toBe(COULEURS_VIDEO.page);
        expect(rapportContraste(b.couleurTexte, b.couleurFond)).toBeGreaterThanOrEqual(CONTRASTE_TEXTE_MIN);
        expect(["titre", "corps", "legende"]).toContain(b.role);
        expect(b.taillePx).toBeGreaterThanOrEqual(TAILLE_PLANCHER_VIDEO * H);
        expect(b.y + b.hauteur).toBeLessThanOrEqual(mp.bandeSousTitres.px.y);
      }
    }
  });

  it("autonome : ne lit que la mise en page (fonctionne sur une copie JSON)", () => {
    const mp = mettreEnPage(ficheAvantApres);
    expect(boitesDeControle(JSON.parse(JSON.stringify(mp)))).toEqual(boitesDeControle(mp));
  });
});
