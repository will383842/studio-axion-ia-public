/**
 * N-06 — Courbes et durées : toute pièce neuve lit la table commune `src/briques/motion/jetons.ts`
 * (`DUREES`, `COURBES`, `RESSORTS`). Garde statique par lecture du texte : aucun fichier lu n'est importé.
 * La liste des exceptions est figée (existant au 15/11/2026, non touché) : elle ne doit que rétrécir.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..");
const TABLE_COMMUNE = ["src/briques/motion/jetons.ts", "src/briques/motion/courbes.ts"];
const DOSSIERS = ["src", "studio-rendu/compositions", "studio-rendu/src"];

/** Chaque ligne : « existant au 15/11/2026, non touché (N-06) ». Triée, écrite en dur. */
const EXCEPTIONS_EXISTANTES = [
  "src/assistant/etapes/Fabrication.tsx",
  "src/briques/realisation/grammaire.ts",
  "src/components/coquille/OngletsBas.tsx",
  "src/components/publication/AvantDePublier.tsx",
  "src/components/ui/Apparition.tsx",
  "src/components/ui/Onglets.tsx",
  "src/components/ui/SelecteurPastilles.tsx",
  "studio-rendu/compositions/Essai.tsx",
  "studio-rendu/compositions/cas-concret/mises-en-page/kit.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot1/ScotchPostit.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot1/commun-lot1.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot2/outils.ts",
  "studio-rendu/compositions/interface-claire/motion-v2/lot3/outils3.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot4/outils4.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot5/DalleClaquee.tsx",
  "studio-rendu/compositions/interface-claire/motion-v2/lot5/commun.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotA/commun-v3.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotB/CercleEpaule.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotB/commun-lotB.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotC/commun-lotC.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotD/communD.tsx",
  "studio-rendu/compositions/interface-claire/motion-v3/lotE/commun-lotE.tsx",
  "studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4.tsx",
  "studio-rendu/compositions/interface-claire/motion-v4/lot1/commun-lot1.tsx",
  "studio-rendu/compositions/interface-claire/motion-v4/lot2/commun-lot2.tsx",
  "studio-rendu/compositions/interface-claire/motion-v4/lot3/commun-lot3.tsx",
  "studio-rendu/compositions/interface-claire/motion-v4/lot4/commun-lot4.tsx",
];

/** Retire les commentaires : lignes en double barre et blocs ouverts puis fermés. Seul le code compte. */
function sansCommentaires(texte: string): string {
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

/** Vrai si le texte déclare sa propre table de ressorts ou de courbes (littéraux chiffrés). */
export function declareUneTable(texte: string): boolean {
  const code = sansCommentaires(texte);
  return (
    /\b(damping|stiffness|mass)\s*:\s*[0-9.]+/.test(code) ||
    /Easing\.bezier\(\s*[-0-9.]/.test(code) ||
    /cubic-bezier\(\s*[-0-9.]/.test(code)
  );
}

function lister(dossier: string, sortie: string[]): void {
  if (!existsSync(dossier)) return;
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === "outils") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) lister(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom) && !/\.test\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
}

function fichiersQuiDeclarent(): string[] {
  const tous: string[] = [];
  for (const d of DOSSIERS) lister(join(RACINE, d), tous);
  return tous
    .map((f) => relative(RACINE, f).split(sep).join("/"))
    .filter((f) => !TABLE_COMMUNE.includes(f))
    .filter((f) => declareUneTable(readFileSync(join(RACINE, f), "utf8")))
    .sort();
}

describe("N-06 · table commune des courbes et durées", () => {
  it("détecte un texte factice qui déclare un ressort ou une courbe", () => {
    expect(declareUneTable("const r = { damping: 12, stiffness: 100 };")).toBe(true);
    expect(declareUneTable("const e = Easing.bezier(0.33, 0, 0.2, 1);")).toBe(true);
    expect(declareUneTable('const t = "cubic-bezier(0.22, 1, 0.36, 1)";')).toBe(true);
  });

  it("ne détecte pas un texte qui lit la table commune ou qui commente", () => {
    expect(declareUneTable('import { RESSORTS } from "@/briques/motion/jetons";\nspring({ config: RESSORTS.doux })')).toBe(false);
    expect(declareUneTable("// Équivalent de cubic-bezier(0.45, 0, 0.25, 1)\n/* damping: 12 */")).toBe(false);
  });

  it("la liste d'exceptions est triée", () => {
    expect([...EXCEPTIONS_EXISTANTES].sort()).toEqual(EXCEPTIONS_EXISTANTES);
  });

  it("les fichiers de la liste existent encore (la liste ne doit que rétrécir : retirer la ligne)", () => {
    const disparus = EXCEPTIONS_EXISTANTES.filter((f) => !existsSync(join(RACINE, f)));
    expect(disparus, `fichier disparu : retirer la ligne de la liste (N-06) → ${disparus.join(", ")}`).toEqual([]);
  });

  it("aucun fichier hors liste ne déclare sa propre table", () => {
    const neufs = fichiersQuiDeclarent().filter((f) => !EXCEPTIONS_EXISTANTES.includes(f));
    expect(
      neufs,
      `pièce neuve : lire DUREES, COURBES, RESSORTS de src/briques/motion/jetons.ts (N-06) → ${neufs.join(", ")}`,
    ).toEqual([]);
  });

  it("la liste d'exceptions est égale à l'existant (aucune ligne de trop)", () => {
    const sansDeclaration = EXCEPTIONS_EXISTANTES.filter((f) => !declareUneTable(readFileSync(join(RACINE, f), "utf8")));
    expect(sansDeclaration, `ligne de trop, à retirer (N-06) → ${sansDeclaration.join(", ")}`).toEqual([]);
  });
});
