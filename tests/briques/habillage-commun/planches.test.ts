import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Planches de l'habillage (C6-H7a) : lecture de texte, aucun rendu. */
const COMPOSITIONS = join(__dirname, "../../../studio-rendu/compositions");
const HABILLAGE = join(COMPOSITIONS, "commune/habillage");

function fichiers(d: string): string[] {
  try {
    return readdirSync(d).flatMap((n) => {
      const c = join(d, n);
      return statSync(c).isDirectory() ? fichiers(c) : /\.(ts|tsx)$/.test(n) ? [c] : [];
    });
  } catch {
    return [];
  }
}
const identifiants = (fs: string[]) => fs.flatMap((f) => readFileSync(f, "utf8").match(/\bid="[^"]*"/g) ?? []);
const dansHabillage = fichiers(HABILLAGE);
const hors = fichiers(COMPOSITIONS).filter((f) => !f.startsWith(HABILLAGE));

/** Liste lue au premier commit : les identifiants déjà présents hors `commune/habillage/`. */
const EXISTANTS = [
  "id=\"ApercuLot3\"",
  "id=\"ApercuSousTitres\"",
  "id=\"AvocatAccessoire\"",
  "id=\"AvocatImage\"",
  "id=\"AvocatTexte\"",
  "id=\"CarteFinAxion\"",
  "id=\"CasConcretMaquette\"",
  "id=\"CompositionAccessoire\"",
  "id=\"CompositionImage\"",
  "id=\"CompositionTexte\"",
  "id=\"DemoFacecam\"",
  "id=\"DoubleEssai\"",
  "id=\"Enchainement\"",
  "id=\"EnchainementE\"",
  "id=\"EnchainementLot2\"",
  "id=\"EnchainementLot3\"",
  "id=\"EnchainementLot4\"",
  "id=\"EnchainementLot5\"",
  "id=\"EnchainementLotA\"",
  "id=\"EnchainementLotB\"",
  "id=\"EnchainementLotC\"",
  "id=\"Essai\"",
  "id=\"ExtraitE\"",
  "id=\"ExtraitLot2\"",
  "id=\"ExtraitLot3\"",
  "id=\"ExtraitLot4\"",
  "id=\"ExtraitLot5\"",
  "id=\"ExtraitLotA\"",
  "id=\"ExtraitLotB\"",
  "id=\"I09\"",
  "id=\"I10\"",
  "id=\"L7Objet\"",
  "id=\"Miniature\"",
  "id=\"MontageDonnees\"",
  "id=\"PlanDeScenes\"",
  "id=\"PlancheLot2\"",
  "id=\"PlancheLot6\"",
  "id=\"PlancheLotA\"",
  "id=\"PlancheLotB\"",
  "id=\"PlancheRepliLot6\"",
  "id=\"SousTitres\"",
  "id=\"TutorielOutil\"",
  "id=\"VignetteAxion\"",
  "id=\"anneauChiffre\"",
  "id=\"aplat-rafale\"",
  "id=\"badge-metal\"",
  "id=\"badge-photo\"",
  "id=\"badge-tissu\"",
  "id=\"balayage-barre\"",
  "id=\"bande-pastille\"",
  "id=\"blob-mot-grain\"",
  "id=\"cadran\"",
  "id=\"carte-avis\"",
  "id=\"carte-france-forme\"",
  "id=\"carte-france-trame\"",
  "id=\"carte-jauge\"",
  "id=\"carte-titre\"",
  "id=\"ce-disque\"",
  "id=\"cj4-grain\"",
  "id=\"cj4-ivoire\"",
  "id=\"cj4-orange\"",
  "id=\"coupe-derriere\"",
  "id=\"crayon-bague\"",
  "id=\"crayon-bois\"",
  "id=\"curseur-web\"",
  "id=\"dalle-claquee-clip\"",
  "id=\"dalle-claquee-grain\"",
  "id=\"deuteranopie\"",
  "id=\"ec-grain\"",
  "id=\"ec-iris\"",
  "id=\"encre-mot-barre\"",
  "id=\"encre-mot-vertical\"",
  "id=\"etiquette\"",
  "id=\"etiquette-1\"",
  "id=\"etiquette-2\"",
  "id=\"f\"",
  "id=\"fenetre-carrousel\"",
  "id=\"fenetre-web\"",
  "id=\"flou-v\"",
  "id=\"flou14\"",
  "id=\"flou40\"",
  "id=\"gr-ticket\"",
  "id=\"grain-capteur\"",
  "id=\"grain-duel\"",
  "id=\"grain-mot\"",
  "id=\"grain-rafale\"",
  "id=\"halo-eclat\"",
  "id=\"libelle-avis\"",
  "id=\"libelle-chrono\"",
  "id=\"lotD-enchainement\"",
  "id=\"masque-bande-vertical\"",
  "id=\"masque-creux-vertical\"",
  "id=\"masque-rempli-vertical\"",
  "id=\"micro-corps\"",
  "id=\"micro-grain\"",
  "id=\"micro-mousse\"",
  "id=\"micro-pied\"",
  "id=\"mur\"",
  "id=\"mv4-avatar\"",
  "id=\"mv4-grain\"",
  "id=\"ob4-grain\"",
  "id=\"ombre-mot\"",
  "id=\"ombre-mur\"",
  "id=\"onde-haut\"",
  "id=\"orange-derriere\"",
  "id=\"orange-mot\"",
  "id=\"ouv-d\"",
  "id=\"peau\"",
  "id=\"peauMain\"",
  "id=\"pile-notifications\"",
  "id=\"pointe-avant-apres\"",
  "id=\"precision\"",
  "id=\"question-sondage\"",
  "id=\"reflet-der\"",
  "id=\"reflet-mot\"",
  "id=\"sablier-cout\"",
  "id=\"t27-jauge\"",
  "id=\"temps\"",
  "id=\"unite\"",
  "id=\"va4-grain\"",
  "id=\"va4-grain-avant\"",
  "id=\"va4-volet\"",
  "id=\"venn-commun\"",
  "id=\"venn-gauche\"",
  "id=\"venn-spec\"",
  "id=\"venn-spec-commun\"",
  "id=\"verre-clip\"",
  "id=\"verre-fond\"",
  "id=\"verre-ombre\"",
  "id=\"verre-orange\"",
  "id=\"verre-reflet\"",
  "id=\"veste\"",
];

describe("planches de l'habillage (C6-H7a)", () => {
  it("les fichiers neufs existent", () => {
    for (const n of ["Compositions.tsx", "PlancheTransitions.tsx"]) expect(dansHabillage.some((f) => f.endsWith(n))).toBe(true);
  });

  it("identifiants uniques, sans collision avec les autres compositions", () => {
    const miens = identifiants(dansHabillage);
    expect(miens).toContain('id="HabillageTransitions"');
    expect(miens).toContain('id="HabillageMesure"');
    expect(new Set(miens).size).toBe(miens.length);
    const autres = new Set(identifiants(hors));
    for (const i of miens) expect(autres.has(i), i).toBe(false);
  });

  it("la liste des identifiants hors habillage est inchangée", () => {
    expect([...new Set(identifiants(hors))].sort()).toEqual([...EXISTANTS].sort());
  });

  it("Racine.tsx contient <CompositionsHabillage /> une seule fois, après l'infographie", () => {
    const racine = readFileSync(join(COMPOSITIONS, "Racine.tsx"), "utf8");
    expect(racine.match(/<CompositionsHabillage \/>/g)).toHaveLength(1);
    expect(racine).toContain('import { CompositionsHabillage } from "./commune/habillage/Compositions";');
    expect(racine).toMatch(/<CompositionsInfographie \/>\s*<CompositionsHabillage \/>/);
  });

  it("aucun import « @/ » ; rien de sons, droits ou bibliothèque-vidéo depuis studio-rendu", () => {
    for (const f of dansHabillage) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["']@\//);
    const tous = fichiers(join(COMPOSITIONS, "..")).filter((f) => !f.includes("node_modules"));
    for (const f of tous) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'][^"']*briques\/(sons|droits|bibliotheque-video)/);
  });

  it("aucun hexadécimal ni Montserrat dans l'habillage", () => {
    for (const f of dansHabillage) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s, f).not.toMatch(/Montserrat/);
    }
  });

  it("aucun calcul de temps dans la composition de mesure ; aucun littéral de courbe (garde N-06)", () => {
    for (const f of dansHabillage) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/performance\.now|Date\.now/);
      expect(s, f).not.toMatch(/cubic-bezier\(|Easing\.bezier\(|(damping|stiffness|mass)\s*:\s*\d/);
    }
  });
});
