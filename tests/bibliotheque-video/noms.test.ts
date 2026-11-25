import { describe, it, expect, expectTypeOf } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FamilleCapacite } from "@/briques/bibliotheque-video/types";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { CATALOGUE_EFFETS_COMMUN } from "@/briques/monteur/effets";
import {
  FAMILLES_CAPACITE,
  ID,
  PREFIXE_COULISSE_V4,
  PIECES_PLAN_SCENES,
  EFFETS_COMMUNS,
  NOMS_CATALOGUE,
  familleDe,
  estIdCapacite,
} from "@/briques/bibliotheque-video/noms";

const RACINE = join(__dirname, "..", "..");

/** Liste recopiée mot pour mot du plan : PLAN-FINAL § 3.3 + AM-16 + AM-08/AM-09. */
const IDENTIFIANTS_PLAN = [
  "texte.mot-dit-accent", "texte.sous-titres-v4", "texte.surlignage-marqueur", "texte.style-varie",
  "texte.pastille-axion", "texte.pave", "texte.nom-outil", "texte.nom-outil-autonome", "texte.bandeau-nom",
  "texte.repere-epaule", "ecran.clip-v4", "ecran.mosaique-extraits", "ecran.telephone-extrait",
  "calque.texte-derriere-double", "calque.texte-derriere-prise",
  "plan-scenes.cas-concret", "plan-scenes.facecam", "plan-scenes.facecam-animee",
  "plan-scenes.tutoriel-outil", // N-02
  "plan-scenes.demo-facecam", // G3-11
  "transition.coupe", "transition.cas-concret", "transition.image-video", "transition.commune",
  "transition.style-montage", "fond.vivant", "fond.lumiere",
  "etalonnage.lut-clair-obscur", "etalonnage.lut-naturel-selfie", "etalonnage.lut-doux", "etalonnage.lut-nuit",
  "etalonnage.lut-nouvelle", "son.banque-studio", "son.v4", "son.registre-commun", "son.familles-etendues",
  "son.sur-transition", "motion.cartes-communes", "motion.plaquettes-v4", "motion.icones-bibliotheque",
  "motion.icones-animees", "motion.lottie",
  // AM-16
  "texte.logo-outil", "cadrage.zoom-classique", "cadrage.zoom-avocat", "cadrage.zoom-demo",
  "cadrage.camera-cas-concret", "cadrage.zoom-v4", "motion.avis-client",
  // AM-08 / AM-09
  "texte.sortie-animee", "texte.escalier",
  // G2-02
  "texte.sous-titres", "plan-scenes.generique", "son.pose", "etalonnage.lut",
  // C9-03
  "objet.trait", "objet.marque", "objet.etiquette", "objet.appel", "objet.chiffre", "objet.etape", "objet.cartes", "objet.schema", "objet.ecran", "objet.reseau-schema", "objet.manuscrit", "objet.emoji",
  // X1-00
  "texte.poids-variable", "texte.minimal-dynamique", "ecran.fenetre-inclinee", "fond.verre-depoli", "transition.zoom-mot", "transition.raccord-forme", "accroche.apercu-fin", "accroche.mot-cle", "mention.ia", "rythme.boucle",
  // C10-15
  "accroche.script", "rythme.mesure", "etalonnage.noir-blanc", "texte.lueur", "texte.fond-clair",
  // C11
  "texte.marques-au-mot", "texte.selectif", "texte.mode-carte", "texte.effets", "texte.accents-role",
  // C11-C2-a-v20k
  "cadrage.camera-couverture", "ecran.carte-video-arrondie", "ecran.grilles-archive", "ecran.ecrans-composes"
];

const FAMILLES_ATTENDUES = [
  "texte", "ecran", "calque", "plan-scenes", "transition", "fond", "etalonnage",
  "son", "motion", "objet", "accroche", "rythme", "mention", "cadrage",
];

function camel(id: string): string {
  const [premier, ...autres] = id.split(/[.-]/);
  return premier + autres.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join("");
}

describe("N-16 · familles", () => {
  it("14 familles exactes, sans doublon, type exhaustif", () => {
    expect([...FAMILLES_CAPACITE]).toEqual(FAMILLES_ATTENDUES);
    expect(new Set(FAMILLES_CAPACITE).size).toBe(14);
    expectTypeOf<(typeof FAMILLES_CAPACITE)[number]>().toEqualTypeOf<FamilleCapacite>();
  });
});

describe("N-16 · ID", () => {
  const entrees = Object.entries(ID);
  it("valeurs uniques, valides, clé = camelCase de l'identifiant", () => {
    expect(new Set(entrees.map(([, v]) => v)).size).toBe(entrees.length);
    for (const [cle, valeur] of entrees) {
      expect(estIdCapacite(valeur), valeur).toBe(true);
      expect(cle, valeur).toBe(camel(valeur));
    }
  });
  it("contient chaque identifiant du plan (et rien d'autre)", () => {
    expect(new Set(Object.values(ID))).toEqual(new Set(IDENTIFIANTS_PLAN));
    expect(ID.texteStyleVarie).toBe("texte.style-varie");
    expect(ID.planScenesFacecam).toBe("plan-scenes.facecam");
  });
  it("ne contient aucune coulisse v4", () => {
    expect(PREFIXE_COULISSE_V4).toBe("motion.v4-coulisse.");
    for (const v of Object.values(ID)) expect(v.startsWith(PREFIXE_COULISSE_V4)).toBe(false);
  });
});

describe("N-16 · familleDe / estIdCapacite", () => {
  it("familleDe prend ce qui précède le premier point", () => {
    expect(familleDe("plan-scenes.facecam")).toBe("plan-scenes");
    expect(familleDe("texte.pave")).toBe("texte");
  });
  it("estIdCapacite refuse les chaînes mal formées", () => {
    for (const x of [undefined, null, 3, {}, "", "texte", "texte.", "inconnue.x", "texte.A", "texte.a b", ".x"]) {
      expect(estIdCapacite(x)).toBe(false);
    }
    expect(estIdCapacite("motion.v4-coulisse.abc")).toBe(true);
    expect(estIdCapacite("objet.x1.y")).toBe(true);
  });
});

describe("N-16 · trois catalogues", () => {
  it("lit les deux catalogues existants à l'exécution", () => {
    expect([...PIECES_PLAN_SCENES]).toEqual(Object.keys(CATALOGUE_BRIQUES));
    expect([...EFFETS_COMMUNS]).toEqual(CATALOGUE_EFFETS_COMMUN.map((e) => e.type));
  });
  it("chaque pièce et chaque effet figure dans NOMS_CATALOGUE, sans doublon", () => {
    const noms = new Set(NOMS_CATALOGUE);
    expect(noms.size).toBe(NOMS_CATALOGUE.length);
    for (const id of Object.keys(CATALOGUE_BRIQUES)) expect(noms.has(`piece:${id}`), id).toBe(true);
    for (const e of CATALOGUE_EFFETS_COMMUN) expect(noms.has(`effet:${e.type}`), e.type).toBe(true);
    for (const v of Object.values(ID)) expect(noms.has(v), v).toBe(true);
    expect(NOMS_CATALOGUE.length).toBe(
      Object.keys(ID).length + Object.keys(CATALOGUE_BRIQUES).length + CATALOGUE_EFFETS_COMMUN.length,
    );
  });
});

describe("N-16 · gardes statiques", () => {
  const FICHIER = join(RACINE, "src", "briques", "bibliotheque-video", "noms.ts");
  const INTERDITS = [
    "studio-rendu", "credits.ts", "budget-mensuel.ts", "mode-budget.ts", "autonomie-usine.ts", "couts.ts",
    "cle-depense-usine.ts", "depense-claude-", "generation-claude.ts", "src/services/image-video", "@/services/",
  ];
  it("noms.ts n'importe ni rendu, ni argent, ni services", () => {
    const imports = readFileSync(FICHIER, "utf8").split("\n").filter((l) => /^\s*(import|export)\b.*from\b|import\(/.test(l));
    for (const ligne of imports) for (const mot of INTERDITS) expect(ligne.includes(mot), `${mot} dans ${ligne}`).toBe(false);
  });
  it("aucun fichier de studio-rendu/ n'importe bibliotheque-video/noms", () => {
    const parcourir = (d: string): string[] =>
      !existsSync(d) ? [] : readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const c = join(d, n);
        return statSync(c).isDirectory() ? parcourir(c) : /\.(ts|tsx)$/.test(n) ? [c] : [];
      });
    for (const f of parcourir(join(RACINE, "studio-rendu"))) {
      expect(readFileSync(f, "utf8").includes("bibliotheque-video/noms"), f).toBe(false);
    }
  });
});
