/**
 * VOCABULAIRE DES TROIS VERBES de la fabrication : « Reprendre » (continuer ce qui s'est arrêté), « Refaire » (refaire
 * un effet ou une partie), « Recommencer » (repartir de zéro). « Réessayer » et « Relancer » ne s'affichent plus sur les
 * écrans de fabrication (« Réessayer » reste pour les erreurs techniques, hors de ces fichiers).
 *
 * On lit les textes (chaînes et texte JSX) des fichiers listés, jamais les commentaires.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");

/** Fichiers de fabrication dont les textes sont passés aux trois verbes (ajouter ici à chaque lot). */
export const FICHIERS_VERBES = [
  "src/components/formats/tableau-anime/EtapesTableau.tsx",
  "src/components/formats/tableau-anime/SuiviTableau.tsx",
  "src/components/formats/tableau-anime/SuiviTacheTableau.tsx",
  "src/components/formats/tableau-anime/EcrireScriptTableau.tsx",
  "src/services/tableau-creation.ts",
  // Lot 5b : fabrication arrêtée → « Reprendre » ; effet à refaire → « Refaire l'effet ».
  "src/components/facecam/AttenteFacecam.tsx",
  "src/components/facecam/EncartFormatFacecam.tsx",
  "src/components/facecam/VotreVideoFacecam.tsx",
  "src/components/ui/ProgressionEtapes.tsx",
  "src/components/videos/SuiviTravail.tsx",
  "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx",
  "src/app/(studio)/_accueil/EnCours.tsx",
  "src/moteurs/montage-facecam/effets-chaine.ts",
  "src/moteurs/montage-cas-concret/index.ts",
  // Lot F2 : suivis déjà conformes aux trois verbes.
  "src/components/formats/image-video/Fabrication.tsx",
  "src/assistant/etapes/Fabrication.tsx",
  "src/components/videos/SuiviTravail.tsx",
  "src/components/formats/image-video/SuiviLot.tsx",
];

/**
 * Fichiers qui gardent légitimement un « Réessayer » technique ailleurs (micro refusé, détail de journal, effet
 * réaliste…) : on n'y contrôle que le texte précis passé aux trois verbes.
 */
export const TEXTES_VERBES = [
  { fichier: "src/moteurs/montage-avocat/double.ts", interdit: /[Tt]ouchez « Réessayer »/, exige: "Touchez « Reprendre »" },
  { fichier: "src/moteurs/montage-facecam/chaine.ts", interdit: /« Réessayer » sur Votre vidéo/, exige: "« Refaire l'effet » sur Votre vidéo" },
  { fichier: "src/components/personnages/Enregistreur.tsx", interdit: /^\s*Recommencer\s*$/, exige: "Refaire" },
  { fichier: "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx", interdit: /Reprendre le cas/, exige: "Recommencer ce cas" },
  { fichier: "src/components/generateur/CeQuiMarche.tsx", interdit: /Refaire cette structure/, exige: "Recommencer cette structure sur un autre sujet" },
  { fichier: "src/components/formats/facecam-animee/DepotPrise.tsx", interdit: /Reprendre un script validé/, exige: "Utiliser un script validé" },
  { fichier: "src/components/formats/facecam-animee/FeuilleScriptsValides.tsx", interdit: /Reprendre un script validé/, exige: "Utiliser un script validé" },
];

/** Tous les textes affichables d'un fichier : chaînes, gabarits, texte JSX. Les commentaires n'en font pas partie. */
function textes(chemin: string): string[] {
  const source = readFileSync(join(RACINE, chemin), "utf8");
  const fichier = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true, chemin.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visite = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) out.push(n.text);
    ts.forEachChild(n, visite);
  };
  visite(fichier);
  return out;
}

describe("vocabulaire des trois verbes : plus de « Réessayer » ni de « Relancer » à l'écran de fabrication", () => {
  for (const f of FICHIERS_VERBES) {
    it(`${f} : aucun texte affiché ne dit Réessayer ou Relancer`, () => {
      const fautes = textes(f).filter((t) => /Réessayer|Relancer/.test(t));
      expect(fautes).toEqual([]);
    });
  }

  it("le tableau animé dit « Reprendre » / « Reprendre la fabrication » / « Garder la meilleure version »", () => {
    const tout = (f: string) => textes(f).join("\n");
    expect(tout("src/components/formats/tableau-anime/EtapesTableau.tsx")).toContain("Reprendre");
    expect(tout("src/components/formats/tableau-anime/EtapesTableau.tsx")).toContain("Reprendre la fabrication");
    expect(tout("src/components/formats/tableau-anime/SuiviTableau.tsx")).toContain("Reprendre la fabrication");
    expect(tout("src/components/formats/tableau-anime/EcrireScriptTableau.tsx")).toContain("Garder la meilleure version");
    expect(tout("src/components/formats/tableau-anime/EcrireScriptTableau.tsx")).not.toContain("Reprendre la meilleure version");
  });

  for (const c of TEXTES_VERBES) {
    it(`${c.fichier} : « ${c.exige} », jamais ${c.interdit}`, () => {
      const t = textes(c.fichier);
      expect(t.filter((x) => c.interdit.test(x) || c.interdit.test(x.trim()))).toEqual([]);
      expect(t.some((x) => x.includes(c.exige))).toBe(true);
    });
  }

  it("un script validé ne se « reprend » plus : le bouton dit « Utiliser » (le script arrive dans « Ce que vous dites »)", () => {
    expect(textes("src/components/formats/facecam-animee/DepotPrise.tsx").join("\n")).toContain("Utiliser un script validé");
  });

  it("Votre vidéo : l'effet raté se « Refait » (bouton « Refaire l'effet »)", () => {
    expect(textes("src/components/facecam/VotreVideoFacecam.tsx").join("\n").replace(/&apos;/g, "'")).toContain("Refaire l'effet");
  });

  it("l'état d'un lecteur d'écran « à reprendre » reste (les specs e2e l'attendent)", () => {
    expect(textes("src/components/ui/ProgressionEtapes.tsx")).toContain("à reprendre");
  });
});
