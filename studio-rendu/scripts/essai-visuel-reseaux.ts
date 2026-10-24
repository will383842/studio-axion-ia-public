/**
 * ESSAI RÉEL de la composition par réseau (H2) : rend avec le vrai Remotion les trois couvertures (T01, T01B, T01C), titres et sous-titres
 * AU MAXIMUM du schéma (mots courants, puis mots longs ; et un titre T01 maximal en capitales accentuées É, À, Ç), et une page intérieure (T06), sans cadre puis dans les cadres `linkedin` et `meta`.
 * Vérifie sur la mesure du DOM réel : `debordements` = 0, `intrusions` = 0 (aucun texte dans une zone interdite du cadre,
 * `src/briques/visuels/reseaux.ts`), `taillePoliceMin` ≥ 26 px. Puis une page de TEST hors schéma (une page à titre en haut, y ≈ 60,
 * posée en première page du cadre `linkedin`) doit compter `intrusions` ≥ 1 : la mesure voit bien la pastille du titre.
 * Écrit l'empreinte SHA-256 de chaque JPEG « sans cadre » (preuve qu'un rendu sans cadre reste identique octet pour octet).
 * Sans réseau extérieur, sans appel payant. Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/headless_shell npx tsx --tsconfig ../tsconfig.json scripts/essai-visuel-reseaux.ts [--sans-cadre]
 * Sortie : `essais-visuels/reseaux/<type>-<forme>-<cadre>.jpg`.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PAGES } from "../../src/briques/visuels/registre-pages.js";
import { LIMITES } from "../../src/briques/visuels/limites.js";
import { TAILLE_TEXTE_MIN } from "../compositions/visuels/commun/constantes.js";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { texteInvente, texteMotsLongs } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const sortie = resolve("essais-visuels", "reseaux");
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-reseaux-"));
const sansCadreSeulement = process.argv.includes("--sans-cadre");
const CADRES = sansCadreSeulement ? [undefined] : [undefined, "linkedin", "meta"];

const op = creerVisuelPage({
  rendre: rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR }),
  deposer: async (cible, chemin) => void copyFileSync(chemin, cible),
});
const navigateur = rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR });

const FORMES = [
  { nom: "courants", texte: (n: number) => texteInvente(n) },
  { nom: "longs", texte: (n: number) => texteMotsLongs(n) },
] as const;

/** Titre T01 au MAXIMUM (52 signes), en capitales accentuées (É, À, Ç) : les accents montent au-dessus des capitales, vers la pastille du titre. */
const TITRE_T01_ACCENTS = "ÉCRITURE À FAÇON : ÇA ÉVITE DÉJÀ LES ÉCARTS DE L’ÉTÉ";
if ([...TITRE_T01_ACCENTS].length !== PAGES.T01.titreMax) throw new Error(`Titre accentué : ${[...TITRE_T01_ACCENTS].length} signes pour ${PAGES.T01.titreMax}`);

const interieure = { type: "T06", titre: texteInvente(24), points: [{ texte: texteInvente(60) }, { texte: texteInvente(60, 3) }, { texte: texteInvente(60, 6) }] };

function cas() {
  const liste: { fichier: string; spec: object; index: number }[] = [];
  for (const type of ["T01", "T01B", "T01C"] as const) {
    for (const forme of FORMES) {
      const couverture = { type, titre: forme.texte(PAGES[type].titreMax), sousTitre: texteInvente(LIMITES.sousTitreMax, 2) };
      liste.push({ fichier: `${type.toLowerCase()}-${forme.nom}`, spec: { version: "carrousel/1", alt: "Essai par réseau", pages: [couverture, interieure, { type: "T21" }] }, index: 0 });
    }
  }
  const accents = { type: "T01", titre: TITRE_T01_ACCENTS, sousTitre: texteInvente(LIMITES.sousTitreMax, 2) };
  liste.push({ fichier: "t01-accents", spec: { version: "carrousel/1", alt: "Essai par réseau", pages: [accents, interieure, { type: "T21" }] }, index: 0 });
  liste.push({ fichier: "t06-interieure", spec: { version: "carrousel/1", alt: "Essai par réseau", pages: [{ type: "T01", titre: "Une couverture" }, interieure, { type: "T21" }] }, index: 1 });
  return liste;
}

const empreinte = (chemin: string) => createHash("sha256").update(readFileSync(chemin)).digest("hex");
const echecs: string[] = [];

for (const c of cas().filter((x) => !process.env.ESSAI_FILTRE || x.fichier.startsWith(process.env.ESSAI_FILTRE))) {
  for (const cadre of CADRES) {
    const fichier = `${c.fichier}-${cadre ?? "sans-cadre"}.jpg`;
    const cible = join(sortie, fichier);
    const proprietes = cadre ? { spec: c.spec, index: c.index, cadre } : { spec: c.spec, index: c.index };
    const r = await op(
      { idRendu: fichier, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: cible, cle: "essai" }, parametres: { proprietes, scale: 1, jpegQuality: 88 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const zones = Object.keys(m).filter((k) => k.startsWith("intrusion_"));
    const bilan = `débordements ${m.debordements}, intrusions ${m.intrusions}${zones.length ? ` (${zones.join(", ")})` : ""}, police min ${m.taillePoliceMin} px, chevauchements ${m.chevauchements}`;
    console.log(`${fichier} : ${bilan}${cadre ? "" : `, sha256 ${empreinte(cible)}`}`);
    if (m.debordements !== 0 || m.taillePoliceMin < TAILLE_TEXTE_MIN || m.chevauchements !== 0) echecs.push(`${fichier} : ${bilan}`);
    if (!sansCadreSeulement && m.intrusions !== 0) echecs.push(`${fichier} : ${bilan}`);
  }
}

if (!sansCadreSeulement) {
  // Page de TEST, hors schéma (une page intérieure en première page) : son titre commence en haut (y ≈ 60), dans la pastille du titre de LinkedIn.
  const spec = { version: "carrousel/1", alt: "Essai par réseau", pages: [interieure, { type: "T21" }] };
  const lignes: string[] = [];
  const nonce = "essai-intrusion";
  const fichier = "test-texte-en-haut-linkedin.jpg";
  await navigateur({ inputProps: { spec, index: 0, cadre: "linkedin", nonce }, scale: 1, jpegQuality: 88, sortie: join(sortie, fichier), surLog: (l) => lignes.push(l), signal: new AbortController().signal });
  const { extraireMesure } = await import("../compositions/visuels/mesure/protocole.js");
  const m = extraireMesure(lignes, nonce) ?? {};
  console.log(`${fichier} : intrusions ${m.intrusions} (${Object.keys(m).filter((k) => k.startsWith("intrusion_")).join(", ")})`);
  if (!(m.intrusions >= 1)) echecs.push(`${fichier} : aucune intrusion comptée pour un texte en haut de la première page LinkedIn`);
}

if (echecs.length) {
  console.error(`ÉCHEC :\n${echecs.join("\n")}`);
  process.exit(1);
}
console.log("Essai par réseau : tout est conforme.");
