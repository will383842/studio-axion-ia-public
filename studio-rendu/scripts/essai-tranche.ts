/**
 * ESSAI RÉEL de la tranche (V3-F) : prend la fixture de la simulation pour un sujet inventé, vérifie la porte qualité,
 * rend chaque page en ×1 (JPEG) puis en ×2 avec le vrai Remotion (`visuel-page`), assemble le PDF et écrit les mesures.
 * Sans réseau extérieur, sans appel payant. Échoue si une page déborde ou si un texte passe sous 26 px. Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/headless_shell npx tsx --tsconfig ../tsconfig.json scripts/essai-tranche.ts [idFixture [dossierSortie]]
 * Sortie : `essais-visuels/tranche/` (carrousel-tranche.pdf, page-N.jpg ×1, mesures.json). Avec `idFixture`, la fixture
 * nommée est rendue telle quelle (contrôle de chaque fixture) et la sortie va dans un dossier temporaire, rien n'est commité.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import { FIXTURES } from "../../src/visuels/texte/fixtures.js";
import { creerFournisseurSimulation } from "../../src/visuels/texte/simulation.js";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { ecrirePdf } from "../src/pdf/ecrire-pdf.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const SUJET = "Ranger un atelier sans y passer la journée";
const POLICE_MIN = 26;
const idFixture = process.argv[2];
const travail = mkdtempSync(join(tmpdir(), "essai-tranche-"));
// 2e argument facultatif : dossier de sortie (pour garder les JPEG et mesures d'une fixture, ex. les essais avant / après du lot L1).
const sortie = process.argv[3] ? resolve(process.argv[3]) : idFixture ? join(travail, "sortie") : resolve("essais-visuels/tranche");
mkdirSync(sortie, { recursive: true });

const fixture = idFixture ? FIXTURES.find((f) => f.id === idFixture) : undefined;
if (idFixture && !fixture) throw new Error(`Fixture inconnue : ${idFixture}`);
const reponse = fixture
  ? { titre: SUJET, spec: fixture.spec, pourquoi: fixture.pourquoi }
  : await creerFournisseurSimulation().ecrire({ type: "sujet", sujet: SUJET });
const spec = reponse.spec as { pages: { type: string }[] };
const { rapport } = controlerCarrousel(spec, { faitsDisponibles: false, interditsDans: () => [] });
if (rapport.verdict === "rouge") throw new Error(`La porte qualité est rouge : ${rapport.controles.map((c) => c.phrase).join(" | ")}`);

const op = creerVisuelPage({
  rendre: rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR }),
  deposer: async (cible, chemin) => void copyFileSync(chemin, cible),
});
const rendrePage = async (index: number, scale: number, fichier: string) =>
  op(
    { idRendu: `tranche-${scale}-${index}`, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: fichier, cle: "tranche" }, parametres: { proprietes: { spec: reponse.spec, index }, scale, jpegQuality: 88 } },
    { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
  );

const debut = Date.now();
const pagesX2: Buffer[] = [];
const parPage: { page: number; type: string; debordements?: number; taillePoliceMin?: number; textesEnZone?: number; erreur?: string }[] = [];
for (const [index, page] of spec.pages.entries()) {
  const x1 = join(sortie, `page-${index + 1}.jpg`);
  const x2 = join(travail, `page-${index + 1}-x2.jpg`);
  try {
    const r1 = await rendrePage(index, 1, x1);
    await rendrePage(index, 2, x2);
    pagesX2.push(readFileSync(x2));
    parPage.push({ page: index + 1, type: page.type, debordements: r1.mesures?.debordements, taillePoliceMin: r1.mesures?.taillePoliceMin, textesEnZone: r1.mesures?.textesEnZone });
    console.log(`page ${index + 1}/${spec.pages.length} (${page.type}) : débordements ${r1.mesures?.debordements}, police min ${r1.mesures?.taillePoliceMin}, lignes en zone réservée ${r1.mesures?.textesEnZone}`);
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    parPage.push({ page: index + 1, type: page.type, erreur });
    console.error(`page ${index + 1}/${spec.pages.length} (${page.type}) : REFUSÉE — ${erreur}`);
  }
}
const dureeSec = Math.round((Date.now() - debut) / 100) / 10;
const fautives = parPage.filter((p) => p.erreur !== undefined || (p.debordements ?? 1) > 0 || (p.textesEnZone ?? 1) > 0 || (p.taillePoliceMin ?? 0) < POLICE_MIN);
writeFileSync(join(sortie, "mesures.json"), JSON.stringify({ sujet: SUJET, verdictPorte: rapport.verdict, dureeSec, complet: fautives.length === 0, parPage }, null, 2));
console.log(JSON.stringify({ fixture: idFixture ?? "(sujet)", dureeSec, pages: parPage.length, enDefaut: fautives.length }));
if (fautives.length > 0) {
  console.error(`ÉCHEC : pages en défaut ${fautives.map((p) => p.page).join(", ")} (refus, débordement, texte dans une zone réservée ou police sous ${POLICE_MIN} px) ; aucun PDF n'est écrit.`);
  process.exit(1);
}
const pdf = ecrirePdf({ titre: reponse.titre, pages: pagesX2 });
writeFileSync(join(sortie, "carrousel-tranche.pdf"), pdf);
process.exit(0);
