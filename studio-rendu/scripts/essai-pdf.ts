/**
 * ESSAI RÉEL du rendu et du PDF (M2-02, M2-04) : rend les 9 pages inventées de `CONTENU_ESSAI_PDF` en ×1 ou ×2 avec le vrai
 * Remotion par l'opération `visuel-page` (mesures, nonce), assemble le PDF avec l'écrivain maison et MESURE la durée et le
 * pic de mémoire (somme des RSS du processus et de ses enfants, échantillonnée toutes les 200 ms).
 * Sans réseau extérieur, sans appel payant. Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/headless_shell npx tsx --tsconfig ../tsconfig.json scripts/essai-pdf.ts [échelle=2] [qualité=88]
 * Sortie : `essais-visuels/carrousel-essai.pdf` (échelle 2 seulement) et `essais-visuels/mesures-rendu.json`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { ecrirePdf } from "../src/pdf/ecrire-pdf.js";
import { CONTENU_ESSAI_PDF } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const echelle = Number(process.argv[2] ?? 2);
const qualite = Number(process.argv[3] ?? 88);
const sortie = resolve("essais-visuels");
const travail = mkdtempSync(join(tmpdir(), "essai-pdf-"));
mkdirSync(sortie, { recursive: true });

/** Somme des RSS (Ko) du processus et de tous ses descendants. */
function rssArbreKo(): number {
  try {
    const lignes = execFileSync("ps", ["-eo", "pid=,ppid=,rss="], { encoding: "utf8" }).trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number));
    const enfants = new Map<number, number[]>();
    for (const [pid, ppid] of lignes) enfants.set(ppid, [...(enfants.get(ppid) ?? []), pid]);
    const rss = new Map(lignes.map(([pid, , r]) => [pid, r]));
    let total = 0;
    const pile = [process.pid];
    while (pile.length) {
      const pid = pile.pop()!;
      total += rss.get(pid) ?? 0;
      pile.push(...(enfants.get(pid) ?? []));
    }
    return total;
  } catch {
    return 0;
  }
}

let pic = 0;
const minuteur = setInterval(() => (pic = Math.max(pic, rssArbreKo())), 200);

const op = creerVisuelPage({
  rendre: rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR }),
  deposer: async (cible, chemin) => void copyFileSync(chemin, cible),
});

const debut = Date.now();
const pages: Buffer[] = [];
const lignes: Record<string, number>[] = [];
for (const [index] of CONTENU_ESSAI_PDF.pages.entries()) {
  const fichier = join(travail, `page-${index + 1}.jpg`);
  const t0 = Date.now();
  const r = await op(
    { idRendu: `essai-${index}`, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: fichier, cle: "essai" }, parametres: { proprietes: { spec: CONTENU_ESSAI_PDF, index }, scale: echelle, jpegQuality: qualite } },
    { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
  );
  pages.push(readFileSync(fichier));
  lignes.push({ page: index + 1, secondes: Math.round((Date.now() - t0) / 100) / 10, ...(r.mesures ?? {}) });
  console.log(`page ${index + 1}/9 : ${lignes.at(-1)!.secondes} s, ${Math.round(pages[index].length / 1024)} Ko, débordements ${r.mesures?.debordements}`);
}
const dureeRendu = (Date.now() - debut) / 1000;
const pdf = ecrirePdf({ titre: "Une journée de bureau, sans fard — essai", pages });
clearInterval(minuteur);
pic = Math.max(pic, rssArbreKo());
if (echelle === 2) writeFileSync(join(sortie, "carrousel-essai.pdf"), pdf);
const bilan = { echelle, qualite, pages: 9, dureeRenduSec: Math.round(dureeRendu * 10) / 10, picMemoireMo: Math.round(pic / 1024), pdfMo: Math.round((pdf.length / 1024 / 1024) * 100) / 100, jpegMoTotal: Math.round((pages.reduce((a, b) => a + b.length, 0) / 1024 / 1024) * 100) / 100, debordementsTotal: lignes.reduce((a, l) => a + (l.debordements ?? 0), 0), parPage: lignes };
writeFileSync(join(sortie, `mesures-rendu-x${String(echelle).replace(".", "-")}.json`), JSON.stringify(bilan, null, 2));
console.log(JSON.stringify({ ...bilan, parPage: undefined }));
process.exit(0);
