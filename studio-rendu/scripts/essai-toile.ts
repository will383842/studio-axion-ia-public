/**
 * ESSAI RÉEL du moteur de la toile continue (P2) : l'opération `toile-continue` rend de vraies toiles (gabarits d'essai X00 à X06, parcours PX,
 * raccords R01 à R03) par le vrai Remotion, les mesure, les découpe et « dépose » les pages dans `essais-visuels/continu/p2/<toile>/`.
 * Puis le TEST PIXEL, sur le PNG gardé dans le dossier de travail : chaque tranche PNG (découpe sans perte) vaut, octet pour octet, les
 * colonnes [i·1080, (i+1)·1080) de la toile ; les tranches mises bout à bout redonnent la toile (0 trou, 0 remplacement serveur) ; les
 * colonnes de bord des tranches voisines sont celles de la toile. Toute faute (mesure, pixel, écart JPEG) : code de sortie 1.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-toile.ts
 * Navigateur : le Chrome Headless Shell de Remotion (`ensureBrowser`), ou `STUDIO_RENDU_NAVIGATEUR` s'il désigne ce même binaire.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours.js";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords.js";
import { HAUTEURS, LARGEUR_PAGE, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version.js";
import { executer, FFMPEG } from "../src/outils.js";
import { creerToileContinue, rendreToileAvecRemotion } from "../src/operations/toile-continue.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (navigateur?.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");
if (!navigateur) {
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
}

/**
 * Écart JPEG / PNG admis sur une colonne de bord (0-255, par canal) : bruit propre au JPEG -q:v 2 en 4:4:4 sur le grain. Mesuré le 25/10 :
 * 5 à 7 sur les colonnes 0 et 1079, 10 à 12 au milieu des mêmes pages ; la couture elle-même est prouvée par le TEST PIXEL (PNG).
 */
const ECART_MAX = 24;
const OCTETS_JPEG_MAX = 400 * 1024;
const RUBRIQUES: Record<string, string> = { X00: "IA pour les entreprises", X01: "Méthode", X03: "Méthode", X04: "Mise en place", X05: "Sécurité", X06: "Et après", X02: "Pour y revenir", PX1: "Étape par étape" };

interface Essai {
  nom: string;
  format: FormatToile;
  types: string[];
  raccords: { type: "R01" | "R02" | "R03"; couture: number; y: number }[];
}

// Ordre : la toile de 10 pages d'abord, rendue À FROID (paquet Remotion construit par cet appel).
const ESSAIS: Essai[] = [
  { nom: "toile-10p-4x5", format: "4:5", types: ["X00", "X01", "X03", "PX1", "PX2", "PX3", "X04", "X05", "X06", "X02"], raccords: [{ type: "R01", couture: 1, y: 980 }, { type: "R02", couture: 3, y: 1000 }, { type: "R03", couture: 6, y: 1000 }, { type: "R02", couture: 8, y: 1000 }] },
  { nom: "toile-4p-4x5", format: "4:5", types: ["X00", "X01", "X03", "X02"], raccords: [{ type: "R01", couture: 1, y: 980 }, { type: "R02", couture: 2, y: 1000 }, { type: "R03", couture: 3, y: 1000 }] },
  { nom: "toile-6p-4x5", format: "4:5", types: ["X00", "X01", "PX1", "PX2", "PX3", "X02"], raccords: [{ type: "R01", couture: 1, y: 980 }, { type: "R02", couture: 2, y: 1000 }, { type: "R03", couture: 5, y: 1000 }] },
  { nom: "toile-4p-3x4", format: "3:4", types: ["X00", "X01", "X03", "X02"], raccords: [{ type: "R01", couture: 1, y: 1070 }, { type: "R03", couture: 3, y: 1090 }] },
  // En plus des quatre toiles de la consigne : le parcours en 3:4 (calque décalé de 45 px), impossible en 4 pages (PX ne ferme pas la toile).
  { nom: "toile-5p-3x4-parcours", format: "3:4", types: ["X00", "PX1", "PX2", "PX3", "X02"], raccords: [{ type: "R01", couture: 1, y: 1025 }, { type: "R03", couture: 4, y: 1045 }] },
];

function proprietes(e: Essai) {
  const pages = e.types.map((t) => ({ ...GABARITS.find((g) => g.type === t)!.exemple, ...(RUBRIQUES[t] ? { rubrique: RUBRIQUES[t] } : {}) }));
  const types = new Set(e.types);
  return {
    toile: { version: "toile/1", format: e.format, pages, raccords: e.raccords },
    versions: {
      socle: VERSION_TOILE_SOCLE,
      gabarits: Object.fromEntries(GABARITS.filter((g) => types.has(g.type)).map((g) => [g.type, g.version])),
      parcours: Object.fromEntries(PARCOURS.filter((p) => p.pagesTypes.some((t) => types.has(t))).map((p) => [p.id, p.version])),
      raccords: Object.fromEntries(RACCORDS.filter((r) => e.raccords.some((x) => x.type === r.type)).map((r) => [r.type, r.version])),
    },
  };
}

const sortieRacine = resolve("essais-visuels", "continu", "p2");
mkdirSync(sortieRacine, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-toile-"));
// Dépôt d'essai : l'adresse (permise en mode essai) désigne un fichier de `essais-visuels/continu/p2/`.
const ADRESSE = "http://127.0.0.1/p2/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const cible = join(sortieRacine, decodeURIComponent(new URL(url).pathname.slice("/p2/".length)));
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(chemin, cible);
  },
});

const brut = async (entree: string, sortie: string) => {
  await executer(FFMPEG, ["-y", "-v", "error", "-i", entree, "-f", "rawvideo", "-pix_fmt", "rgba", sortie]);
  return readFileSync(sortie);
};

/** TEST PIXEL : renvoie la liste des fautes (vide = 0 trou, 0 remplacement, colonnes de bord identiques). */
async function testPixel(dossier: string, n: number, hauteur: number): Promise<{ fautes: string[]; octetsComparés: number }> {
  const png = join(dossier, "toile.png");
  const largeur = n * LARGEUR_PAGE;
  const toile = await brut(png, join(dossier, "pixel-toile.rgba"));
  const fautes: string[] = [];
  if (toile.length !== largeur * hauteur * 4) fautes.push(`toile de ${toile.length} octets au lieu de ${largeur * hauteur * 4}`);
  const ligneT = largeur * 4;
  const ligneP = LARGEUR_PAGE * 4;
  const recompose = Buffer.alloc(toile.length);
  const tranches: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const fichier = join(dossier, `tranche-${i + 1}.png`);
    await executer(FFMPEG, ["-y", "-v", "error", "-i", png, "-vf", `crop=${LARGEUR_PAGE}:${hauteur}:${i * LARGEUR_PAGE}:0`, "-frames:v", "1", fichier]);
    const t = await brut(fichier, join(dossier, `tranche-${i + 1}.rgba`));
    tranches.push(t);
    if (t.length !== ligneP * hauteur) fautes.push(`tranche ${i + 1} : ${t.length} octets au lieu de ${ligneP * hauteur}`);
    let differentes = 0;
    for (let y = 0; y < hauteur; y++) {
      const source = toile.subarray(y * ligneT + i * ligneP, y * ligneT + (i + 1) * ligneP);
      const tranche = t.subarray(y * ligneP, (y + 1) * ligneP);
      if (!source.equals(tranche)) differentes++;
      tranche.copy(recompose, y * ligneT + i * ligneP);
    }
    if (differentes) fautes.push(`tranche ${i + 1} : ${differentes} ligne(s) différentes des colonnes [${i * LARGEUR_PAGE}, ${(i + 1) * LARGEUR_PAGE})`);
  }
  if (!recompose.equals(toile)) fautes.push("les tranches mises bout à bout ne redonnent pas la toile (trou ou remplacement)");
  const pixel = (b: Buffer, ligne: number, x: number, y: number) => b.subarray(y * ligne + x * 4, y * ligne + x * 4 + 4);
  for (let i = 0; i + 1 < n; i++) {
    for (let y = 0; y < hauteur; y++) {
      const ok = pixel(tranches[i], ligneP, LARGEUR_PAGE - 1, y).equals(pixel(toile, ligneT, (i + 1) * LARGEUR_PAGE - 1, y)) && pixel(tranches[i + 1], ligneP, 0, y).equals(pixel(toile, ligneT, (i + 1) * LARGEUR_PAGE, y));
      if (!ok) {
        fautes.push(`couture ${i + 1} : colonnes de bord différentes (y = ${y})`);
        break;
      }
    }
  }
  return { fautes, octetsComparés: toile.length };
}

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const e of ESSAIS) {
  const n = e.types.length;
  const hauteur = HAUTEURS[e.format];
  const dossier = mkdtempSync(join(travail, `${e.nom}-`));
  const depotsPages = e.types.map((_, i) => ({ cle: `${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg`, urlDepot: `${ADRESSE}${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg` }));
  try {
    const r = await op(
      { idRendu: e.nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}${e.nom}/bande.jpg`, cle: `${e.nom}/bande.jpg` }, parametres: { proprietes: proprietes(e), depotsPages } },
      { progression: () => {}, dossier, signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const pixel = await testPixel(dossier, n, hauteur);
    const octets = depotsPages.map((d) => statSync(join(sortieRacine, d.cle)).size);
    const fautes = [
      m.largeur !== n * LARGEUR_PAGE && `largeur ${m.largeur}`,
      m.hauteur !== hauteur && `hauteur ${m.hauteur}`,
      m.debordements !== 0 && `${m.debordements} débordement(s)`,
      !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
      m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
      m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
      m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
      m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta en page 1`,
      m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
      m.traitsFinsSurCouture !== 0 && `${m.traitsFinsSurCouture} trait(s) fin(s) sur une couture`,
      e.raccords.some((x) => x.couture === 1) && !(m.debordCouture1 >= 1) && "aucun objet à cheval sur la couture 1",
      !(m.ecartCoutureMax <= ECART_MAX) && `écart JPEG / PNG ${m.ecartCoutureMax} (> ${ECART_MAX})`,
      ...octets.map((o, i) => o > OCTETS_JPEG_MAX && `page ${i + 1} : ${Math.round(o / 1024)} Ko (> 400 Ko)`),
      ...pixel.fautes,
    ].filter(Boolean) as string[];
    resultats[e.nom] = { format: e.format, pages: n, mesures: m, octetsParPage: octets, testPixel: { fautes: pixel.fautes, octetsComparés: pixel.octetsComparés } };
    console.log(
      `${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [${n} pages ${e.format}, ${m.largeur} × ${m.hauteur}, rendu ${(m.dureeRenduMs / 1000).toFixed(1)} s, total ${(m.dureeMs / 1000).toFixed(1)} s, police min ${m.taillePoliceMin}, couture ${m.textesSurCouture}, marge ${m.textesHorsMarge}, coin ${m.textesCoinReserve}, Meta p1 ${m.intrusionsMetaP1}, chevauchements ${m.chevauchements}, à cheval c1 ${m.debordCouture1}, écart JPEG ${m.ecartCoutureMax}, JPEG ${octets.map((o) => Math.round(o / 1024)).join("/")} Ko]`,
    );
    console.log(`  TEST PIXEL : ${pixel.fautes.length ? `ÉCHEC ${pixel.fautes.join(" ; ")}` : `0 trou, 0 remplacement serveur, colonnes de bord identiques (${n} tranches, ${pixel.octetsComparés} octets comparés)`}`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 400);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
writeFileSync(join(sortieRacine, "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} toile(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nTEST PIXEL : ${ESSAIS.length} toiles, 0 trou, 0 remplacement serveur, colonnes de bord identiques. Mesures : essais-visuels/continu/p2/mesures.json`);
process.exit(0);
