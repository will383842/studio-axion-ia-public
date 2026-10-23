/**
 * Lot L1 des carrousels : typographie et hiérarchie. Tests de CONTRAT sur les sources de la composition (le rendu réel est
 * contrôlé par les essais sur le Chrome Headless Shell de Remotion) : police de corps Inter, titres en capitales mesurés
 * en capitales, rubrique posée par le code sur les pages intérieures, rang chiffré isolé derrière une constante.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEXTES_FIXES, RUBRIQUES } from "@/briques/visuels/textes-fixes";
import { TYPES_PAGE, TYPES_COUVERTURE } from "@/briques/visuels/registre-pages";
import { CHARTE_CARROUSEL } from "@/briques/visuels/charte-carrousel";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { BORD_DROIT_TEXTE, BORDURE_CARTE, COULEURS, FOND_CARTE_CLAIR, MARGE, OMBRE_CARTE, REMPLISSAGE_CARTE, POLICE_CORPS, TAILLE_TEXTE_MIN, TAILLES } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { enCapitales, mettreEnLignesCapitales } from "../../studio-rendu/compositions/visuels/commun/capitales";
import { styleCarte } from "../../studio-rendu/compositions/visuels/commun/style-carte";
import { BORD_DROIT_TEXTE_BAS, boiteEnZoneReservee, boiteSignature, largeurTexteMax, ZONES_RESERVEES } from "../../studio-rendu/compositions/visuels/commun/zones";
import { ECHELLE_PEU_DE_TEXTE, echelleCartes, gaucheCarte, largeursTexteCarte } from "../../studio-rendu/compositions/visuels/commun/mise-en-page";

const RACINE = new URL("../../studio-rendu/compositions/visuels/", import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, RACINE), "utf8");
function sources(dossier = ""): string[] {
  return readdirSync(new URL(dossier, RACINE), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(`${dossier}${e.name}/`) : /\.tsx?$/.test(e.name) ? [`${dossier}${e.name}`] : [],
  );
}

describe("L1 : police du texte courant", () => {
  it("POLICE_CORPS est Inter, et plus aucune source des visuels ne cite JetBrains Mono", () => {
    expect(POLICE_CORPS).toContain("Axion Inter");
    expect(POLICE_CORPS).not.toMatch(/mono/i);
    for (const f of sources()) expect(lire(f), f).not.toMatch(/JetBrains/i);
  });
  it("texte courant ≥ 30 px, jamais sous le plancher de 26 px", () => {
    expect(TAILLE_TEXTE_MIN).toBe(26);
    expect(TAILLES.corps).toBeGreaterThanOrEqual(30);
    for (const [nom, t] of Object.entries(TAILLES)) expect(t, nom).toBeGreaterThanOrEqual(TAILLE_TEXTE_MIN);
  });
  it("la mesure et le contrôle de débordement attendent Inter", () => {
    expect(lire("commun/controle-debordement.tsx")).toContain("policeInterPrete");
    expect(lire("commun/controle-debordement.tsx")).not.toContain("JetBrains");
  });
});

describe("L1 : titres en capitales", () => {
  it("enCapitales suit les règles fr-FR (accents conservés, ligature)", () => {
    expect(enCapitales("échange")).toBe("ÉCHANGE");
    expect(enCapitales("à l'œuvre, déjà")).toBe("À L'ŒUVRE, DÉJÀ");
  });
  it("le titre est passé en capitales AVANT la mesure : la mesure ne voit jamais de minuscule", () => {
    const vues: string[] = [];
    // Une capitale est plus large qu'une minuscule : une mesure faite sur les minuscules sous-estimerait la ligne.
    const mesurer = (lignes: string[], taille: number) => {
      vues.push(...lignes);
      return Math.max(...lignes.map((l) => [...l].reduce((w, c) => w + (c === c.toLocaleUpperCase("fr-FR") ? 0.7 : 0.5) * taille, 0)));
    };
    const mise = mettreEnLignesCapitales("échange sans détour", mesurer, { maxLignes: 2, hauteurMax: 400, cible: 900 });
    expect(vues.length).toBeGreaterThan(0);
    for (const l of vues) expect(l).toBe(l.toLocaleUpperCase("fr-FR"));
    expect(mise.lignes.join(" ")).toBe("ÉCHANGE SANS DÉTOUR");
  });
  it("Titre.tsx dessine ce que la mise en lignes en capitales a retenu", () => {
    const src = lire("commun/Titre.tsx");
    expect(src).toContain("mettreEnLignesCapitales(");
    expect(src).not.toContain("choisirMiseEnLignes(");
  });
});

describe("L1 : rubrique des pages intérieures", () => {
  it("une rubrique par type de page de contenu, jamais sur une couverture ni sur la page sombre", () => {
    const avecRubrique = Object.keys(RUBRIQUES).sort();
    expect(avecRubrique).toEqual(["T02", "T06", "T08", "T10", "T20", "T22", "T23", "T24", "T26", "T27", "T28"]);
    for (const c of TYPES_COUVERTURE) expect(RUBRIQUES, c).not.toHaveProperty(c);
    expect(RUBRIQUES).not.toHaveProperty("T21");
    expect(TYPES_PAGE).toContain("T21");
  });
  it("sans chiffre, sans lien, sans appel, en capitales, et passe le filtre de tout texte de carrousel", () => {
    for (const t of [...Object.values(RUBRIQUES), TEXTES_FIXES.signature]) {
      expect(t).not.toMatch(/\d|https?:|www\.|@|\/\/|commentez/i);
      expect(CarrouselSpec.safeParse({ version: "carrousel/1", alt: t, pages: [{ type: "T01", titre: "Un titre" }, { type: "T21" }] }).success, t).toBe(true);
    }
    for (const t of Object.values(RUBRIQUES)) expect(t).toBe(t.toLocaleUpperCase("fr-FR"));
  });
  it("PageBase pose la rubrique et la signature ; la couverture n’en porte pas", () => {
    expect(lire("commun/PageBase.tsx")).toContain("RUBRIQUES");
    for (const f of ["pages/T01.tsx", "pages/T01B.tsx", "pages/T01C.tsx", "pages/T21.tsx"]) expect(lire(f), f).not.toMatch(/RUBRIQUES|signature/i);
  });
});

describe("L1 : cartes alternées et rang chiffré", () => {
  it("le rang chiffré est isolé derrière UNE constante, facile à retirer", () => {
    const src = lire("mini/W01.tsx");
    expect(src).toMatch(/export const RANG_CHIFFRE = true/);
    expect(src.match(/RANG_CHIFFRE/g)!.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("POLICE_TITRE");
  });
  it("ombre décalée 8 px sur une carte sur deux, fond blanc #FFFCF7 en alternance", () => {
    const c = lire("commun/constantes.ts");
    expect(CHARTE_CARROUSEL.couleurs.blanc).toBe("#FFFCF7");
    expect(c).toContain("FOND_CARTE_CLAIR = COULEURS.blanc");
    expect(c).toMatch(/OMBRE_CARTE.*8px 8px 0/);
    expect(lire("commun/Carte.tsx")).toContain("styleCarte");
  });
});

describe("L1 : style d'une carte selon son rang", () => {
  it("rang 1 et 3 : fond blanc #FFFCF7 et ombre décalée", () => {
    for (const rang of [1, 3, 5]) {
      expect(styleCarte(rang)).toEqual({ background: "#FFFCF7", boxShadow: OMBRE_CARTE });
    }
    expect(FOND_CARTE_CLAIR).toBe("#FFFCF7");
    expect(OMBRE_CARTE).toBe(`8px 8px 0 ${COULEURS.encre}`);
  });
  it("rang 2 (et pairs) : fond pâle, sans ombre", () => {
    for (const rang of [2, 4, 6]) {
      const s = styleCarte(rang);
      expect(s.background).toBe(COULEURS.pale);
      expect(s.boxShadow).toBeUndefined();
    }
  });
});

describe("L1 : zones réservées (flèche LinkedIn, compteur Meta)", () => {
  it("le bord droit du texte est une constante unique, hors des zones", () => {
    expect(BORD_DROIT_TEXTE).toBe(912);
    expect(ZONES_RESERVEES.every((z) => z.gauche >= BORD_DROIT_TEXTE || z.gauche >= 860)).toBe(true);
    expect(largeurTexteMax(78)).toBe(912 - 78);
    expect(largeurTexteMax(2000)).toBe(0);
  });
  it("détecte un texte qui entre dans la zone (cas relevés en relecture) et laisse passer celui qui s'arrête à 912", () => {
    expect(boiteEnZoneReservee({ gauche: 78, haut: 600, droite: 955, bas: 640 })).toBe(true); // T06 : « …dès l'ouverture ? »
    expect(boiteEnZoneReservee({ gauche: 78, haut: 600, droite: 968, bas: 640 })).toBe(true); // T02 : « …avant, et »
    expect(boiteEnZoneReservee({ gauche: 78, haut: 600, droite: 912, bas: 640 })).toBe(false);
    expect(boiteEnZoneReservee({ gauche: 78, haut: 300, droite: 1032, bas: 400 })).toBe(false); // titre : au-dessus des zones
    expect(boiteEnZoneReservee({ gauche: 700, haut: 1100, droite: 870, bas: 1140 })).toBe(true); // bas de page, x ≥ 860
    expect(boiteEnZoneReservee({ gauche: 700, haut: 1100, droite: 860, bas: 1140 })).toBe(false);
  });
  it("la colonne de texte de chaque carte s'arrête à 912, pour 1 à 6 cartes et chaque rang", () => {
    for (let n = 2; n <= 6; n++) {
      const colonnes = n <= 3 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        for (const mini of [true, false]) {
          const gauche = gaucheCarte(i, colonnes);
          const l = largeursTexteCarte({ gauche, miniTaille: colonnes === 1 ? 132 : 64, enLigne: colonnes === 1, avecMini: mini });
          const debutCorps = colonnes === 1 && mini ? gauche + BORDURE_CARTE + REMPLISSAGE_CARTE + 132 + 28 : gauche + BORDURE_CARTE + REMPLISSAGE_CARTE;
          expect(debutCorps + l.corps, `${n} cartes, rang ${i + 1}, mini ${mini}`).toBeLessThanOrEqual(BORD_DROIT_TEXTE);
          expect(l.titre).toBeGreaterThan(0);
        }
      }
    }
  });
  it("la dernière rangée de cartes s'arrête à x = 860 (le compteur de Meta couvre x ≥ 860, y ≥ 1080), les autres à 912", () => {
    const haut = largeursTexteCarte({ gauche: 48, miniTaille: 64, enLigne: false, avecMini: false });
    const bas = largeursTexteCarte({ gauche: 48, miniTaille: 64, enLigne: false, avecMini: false, derniereRangee: true });
    expect(48 + BORDURE_CARTE + REMPLISSAGE_CARTE + haut.corps).toBe(BORD_DROIT_TEXTE);
    expect(48 + BORDURE_CARTE + REMPLISSAGE_CARTE + bas.corps).toBe(BORD_DROIT_TEXTE_BAS);
    expect(BORD_DROIT_TEXTE_BAS).toBe(860);
    expect(largeurTexteMax(100, BORD_DROIT_TEXTE_BAS)).toBe(760);
  });
  it("2 cartes courtes agrandissent leurs caractères ; 3 cartes ou un texte plus long gardent la taille normale", () => {
    const court = { titre: "Un titre court", corps: "Un texte bref." };
    expect(echelleCartes([court, court])).toBe(ECHELLE_PEU_DE_TEXTE);
    expect(echelleCartes([court, court, court])).toBe(1);
    expect(echelleCartes([court, { ...court, corps: "x".repeat(81) }])).toBe(1);
    expect(echelleCartes([{ ...court, titre: "x".repeat(25) }, court])).toBe(1);
  });
  it("la signature est en bas à gauche, hors des deux zones, même au plus large", () => {
    const b = boiteSignature(300);
    expect(b.gauche).toBe(MARGE);
    expect(b.haut).toBeGreaterThan(1200);
    expect(boiteEnZoneReservee(b)).toBe(false);
  });
});
