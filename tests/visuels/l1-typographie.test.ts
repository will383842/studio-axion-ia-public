/**
 * Lot L1 des carrousels : typographie et hiérarchie. Tests de CONTRAT sur les sources de la composition (le rendu réel est
 * contrôlé par les essais sur le Chrome Headless Shell de Remotion) : police de corps Inter, titres en capitales mesurés
 * en capitales, rubrique posée par le code sur les pages intérieures, rang chiffré isolé derrière une constante.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TEXTES_FIXES, RUBRIQUES } from "@/briques/visuels/textes-fixes";
import { TYPES_PAGE, TYPES_COUVERTURE } from "@/briques/visuels/registre-pages";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { BORD_DROIT_TEXTE, FILET, MARGE, OMBRE_DOUCE, POLICE_CORPS, POLICE_TITRE, TAILLE_TEXTE_MIN, TAILLES } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { enCapitales, mettreEnLignesCapitales } from "../../studio-rendu/compositions/visuels/commun/capitales";
import { rangEcrit } from "../../studio-rendu/compositions/visuels/commun/editorial";
import { BORD_DROIT_TEXTE_BAS, boiteEnZoneReservee, boiteSignature, largeurTexteMax, ZONES_RESERVEES } from "../../studio-rendu/compositions/visuels/commun/zones";
import { ICONE_DU_MINI, systemeReperes } from "../../studio-rendu/compositions/visuels/pages/T02";

// Sans les dépendances de studio-rendu (CI ciblée des visuels), « remotion » est simulé : les composants se chargent quand même.
// Installé, le vrai module est chargé (son chemin résolu n'est pas « remotion »), le test reste le même.
vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

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
  it("PageBase pose la rubrique ; la couverture et la page sombre n’en portent pas, mais TOUTES les pages portent la marque (ART-1)", () => {
    expect(lire("commun/PageBase.tsx")).toContain("rubriqueAffichee(");
    for (const f of ["pages/T01.tsx", "pages/T01B.tsx", "pages/T01C.tsx", "pages/T21.tsx"]) expect(lire(f), f).not.toMatch(/RUBRIQUES|rubriqueAffichee/);
    expect(lire("pages/T21.tsx")).toContain("signature={TEXTES_FIXES.signature}");
    expect(lire("commun/Couverture.tsx")).toContain("signature={TEXTES_FIXES.signature}");
    for (const f of ["pages/T01.tsx", "pages/T01B.tsx", "pages/T01C.tsx"]) expect(lire(f), f).toContain("<PiedCouverture");
  });
});

describe("ART-1 : style éditorial (A) et typographique (C)", () => {
  it("titres en Inter Display Black, rang écrit sur deux chiffres par le code", () => {
    expect(POLICE_TITRE).toContain("Axion Inter Display");
    expect(rangEcrit(1)).toBe("01");
    expect(rangEcrit(6)).toBe("06");
  });
  it("plus aucun contour de 3-4 px ni ombre décalée « néo-brutaliste » dans les gabarits : filets de 2 px, ombre floue légère seulement", () => {
    expect(FILET).toBe(2);
    expect(OMBRE_DOUCE).toMatch(/^0 \d+px \d+px /);
    for (const f of sources().filter((f) => f.startsWith("pages/") || f.startsWith("commun/"))) {
      const src = lire(f);
      expect(src, f).not.toMatch(/border(?:Top|Bottom|Left|Right)?: `?[34]px solid/);
      expect(src, f).not.toMatch(/\b\d+px \d+px 0 \$\{/);
      expect(src, f).not.toMatch(/OMBRE_CARTE|OMBRE_ORANGE|styleCarte|COMPOSANTS_DECOR/);
    }
  });
  it("T02 : un seul système de repères par page (toutes numérotées OU toutes avec une icône qui a un sens)", () => {
    const carte = (mini?: "W01" | "W02" | "W03" | "W06" | "W07" | "W25") => ({ titre: "Un titre", corps: "Un texte", ...(mini ? { mini } : {}) });
    expect(systemeReperes([carte("W02"), carte("W03"), carte("W06")])).toBe("icones");
    expect(systemeReperes([carte("W01"), carte("W03"), carte("W06")])).toBe("numeros");
    expect(systemeReperes([carte("W02"), carte()])).toBe("numeros");
    expect(Object.keys(ICONE_DU_MINI).sort()).toEqual(["W02", "W03", "W06", "W07", "W25"]);
  });
  it("T02 : sur deux colonnes, chaque carte est une sous-grille (titres alignés par rangée)", () => {
    expect(lire("pages/T02.tsx")).toContain('gridTemplateRows: "subgrid"');
  });
  it("T23 : l'icône à droite seulement si chaque question en a une ; T24 : texte aligné en haut de rangée", () => {
    expect(lire("pages/T23.tsx")).toContain("iconesDesQuestions(questions)");
    expect(lire("pages/T24.tsx")).toMatch(/alignItems: "flex-start"/);
  });
  it("T28 : les liaisons ont une hauteur plafonnée et ne comptent pas dans le vide", () => {
    const src = lire("pages/T28.tsx");
    expect(src).toContain("ATTRIBUT_LIAISON");
    expect(src).not.toMatch(/flex: 1, minHeight: 36/);
    expect(lire("mesure/MesureVisuelPage.tsx")).toContain("dessinsDe(racine.current, { pourVide: true })");
  });
  it("T10 : plus de cible ni de cercle décoratif ; le bandeau disparaît sans légende", () => {
    const src = lire("pages/T10.tsx");
    expect(src).not.toMatch(/Deco|E13|<circle/);
    expect(src).toContain("legende ? HAUTEUR_LEGENDE : 0");
  });
  it("T01B, T08 : plus de cercle vide ni de formes décoratives (cercle + carré + triangle)", () => {
    for (const f of ["pages/T01.tsx", "pages/T01B.tsx", "pages/T01C.tsx", "pages/T08.tsx"]) expect(lire(f), f).not.toMatch(/<circle|<rect|COMPOSANTS_DECOR|Pictogramme/);
    expect(lire("pages/T01B.tsx")).toContain("illustrationCouverture(");
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
  it("le bas de page s'arrête à x = 860 (le compteur de Meta couvre x ≥ 860, y ≥ 1080), le reste à 912", () => {
    expect(BORD_DROIT_TEXTE_BAS).toBe(860);
    expect(largeurTexteMax(100, BORD_DROIT_TEXTE_BAS)).toBe(760);
    // Les bords droits de CHAQUE gabarit (bandeau et colonnes de T26, T24, T28, T23, cartes de T02 de 1 à 6) : `bords-droits.test.ts`.
  });
  it("la signature est en bas à gauche, hors des deux zones, même au plus large", () => {
    const b = boiteSignature(300);
    expect(b.gauche).toBe(MARGE);
    expect(b.haut).toBeGreaterThan(1200);
    expect(boiteEnZoneReservee(b)).toBe(false);
  });
});
