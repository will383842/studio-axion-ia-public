/**
 * EXEMPLES DU LOT R4 — rend EN LOCAL de vraies miniatures avec l'opération `miniature` de `studio-rendu` (FFmpeg +
 * Remotion, aucun service payant), à partir d'une vidéo SANS texte déjà fabriquée (par défaut : celle de la
 * démonstration M4, `%TEMP%/studio-m4-demo/m4b-rendu-9x16/master-sans-texte.mov`).
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/miniatures/rendre-exemples.mts [video] [dossier-de-sortie]`
 * Sorties : 3 miniatures (une par mise en page) + une planche « téléphone 390 px » (grille d'un profil, 3 cases).
 * Les fichiers de travail restent dans le dossier temporaire et sont supprimés à la fin.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { miniature } from "../../studio-rendu/src/operations/miniature";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const video = resolve(process.argv[2] ?? join(tmpdir(), "studio-m4-demo", "m4b-rendu-9x16", "master-sans-texte.mov"));
const sortie = resolve(process.argv[3] ?? join(tmpdir(), "studio-r4-miniatures"));
if (!existsSync(video)) throw new Error(`Vidéo introuvable : ${video}`);
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "studio-r4-travail-"));

// Phrases du script de la démonstration M4 (aucun faux cas client).
const exemples = [
  { nom: "1-bas", instantSec: 9, couverture: "Amende : l'erreur", motCle: "erreur", variante: 0 },
  { nom: "2-etiquettes", instantSec: 4.5, couverture: "Un PV de 135 € ?", motCle: "135 €", variante: 1 },
  { nom: "3-bandeau", instantSec: 12.5, couverture: "45 jours pour contester", motCle: "45 jours", variante: 2 },
];

const fichiers: string[] = [];
for (const e of exemples) {
  const dossier = join(travail, e.nom);
  mkdirSync(dossier);
  const debut = Date.now();
  const r = await miniature(
    { idRendu: `exemple-${e.nom}`, operation: "miniature", file: "courte", entrees: { video }, sortie: { urlDepot: "", cle: "" }, parametres: { instantSec: e.instantSec, ratio: "9:16", couverture: e.couverture, motCle: e.motCle, variante: e.variante } },
    { progression: () => undefined, dossier, signal: new AbortController().signal },
  );
  const cible = join(sortie, `miniature-${e.nom}.jpg`);
  copyFileSync(join(dossier, "miniature.jpg"), cible);
  fichiers.push(cible);
  console.log(`${e.nom} : ${((Date.now() - debut) / 1000).toFixed(1)} s`, r.mesures);
}

// Planche « téléphone 390 px » : grille d'un profil Instagram (cases 3:4 de 130 px, recadrage au centre), à l'échelle 2x.
const planche = join(sortie, "apercu-telephone-390px.jpg");
const filtres = fichiers.map((_, i) => `[${i}:v]crop=1080:1440:0:240,scale=260:347:flags=lanczos[c${i}]`).join(";");
spawnSync("ffmpeg", ["-v", "error", "-y", ...fichiers.flatMap((f) => ["-i", f]), "-filter_complex", `${filtres};[c0][c1][c2]hstack=3,pad=iw+8:ih+8:4:4:color=0x16120F`, "-q:v", "2", planche], { stdio: "inherit" });
console.log("Planche :", planche);
rmSync(travail, { recursive: true, force: true });
