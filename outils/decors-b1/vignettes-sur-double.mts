/**
 * VIGNETTES DES DÉCORS SUR LE DOUBLE (lot B1) — gratuites : le VRAI code de la brique `composition`
 * (`decorDepuisValeur`, `proprietesVignetteDecor`) et la VRAIE opération `image-fixe` de `studio-rendu` (Remotion, en
 * local, sans dépôt), composition commune `CompositionImage`. Le double est la silhouette simulée (aucun double réel de
 * Will n'existe encore) : la vignette montre le décor tel que la vidéo le pose (flou, liseré de lumière), double devant.
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/decors-b1/vignettes-sur-double.mts`
 * Sorties :
 *  - `public/demo/decors/sur-double/<fond>.jpg` (N1…N6, 540 × 960) : vignettes du catalogue ;
 *  - `public/demo/decors/propositions/sur-double/<photo>.jpg` : les 3 propositions de l'essai ;
 *  - `public/demo/decors/silhouette.png` : le double simulé seul, fond transparent (posé par l'écran sur une photo
 *    neuve tant que `studio-rendu` n'a pas calculé sa vignette) ;
 *  - `docs/captures/b1-decors/vignettes-sur-double.jpg` (planche) et `preuve-vignettes.json`.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { ValeurDecor } from "@/domaine/types";

const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const brique = await charger<typeof import("@/briques/composition")>("@/briques/composition");
const catalogue = await charger<typeof import("@/donnees/decors-catalogue")>("@/donnees/decors-catalogue");
const recette = await charger<typeof import("@/moteurs/montage-avocat/recette-composition")>("@/moteurs/montage-avocat/recette-composition");
const { imageFixe } = await import("../../studio-rendu/src/operations/image-fixe");
const { servirDossier } = await import("../../studio-rendu/src/composition/serveur-fichiers");

const RACINE = resolve(import.meta.dirname, "..", "..");
const TRAVAIL = join(tmpdir(), "studio-b1-vignettes");
const ENTREES = join(TRAVAIL, "entrees");
const CAPTURES = join(RACINE, "docs", "captures", "b1-decors");
mkdirSync(ENTREES, { recursive: true });
mkdirSync(CAPTURES, { recursive: true });
const REPLI = recette.RECETTE_COMPOSITION_AVOCAT.decorRepli;

interface Travail {
  nom: string;
  source: string;
  valeur: ValeurDecor;
  sortie: string;
}
const travaux: Travail[] = [];
for (const e of catalogue.decorsCatalogue(new Date().toISOString())) {
  if (e.valeur.type !== "decor" || e.valeur.methode !== "neutre-incruste" || !e.valeur.catalogue) continue;
  const fichier = e.fichierId!.replace(/^f-decors-/, "").replace(/-jpg$/, "");
  travaux.push({ nom: `${e.valeur.catalogue.code} ${e.nom}`, source: join(RACINE, "public", "demo", "decors", `${fichier}.jpg`), valeur: e.valeur, sortie: join(RACINE, "public", "demo", "decors", "sur-double", `${fichier}.jpg`) });
}
for (const [i, photo] of ["bureau-doree", "bureau-jour", "bureau-soir"].entries()) {
  const valeur: ValeurDecor = { type: "decor", mode: "image", methode: "photo-incrustee", profondeurFlou: 14, teinte: i === 1 ? "#E9E1D4" : "#1A120B", teinteLumiere: i === 1 ? "#F2D6A8" : "#D69650", directionLumiere: i === 1 ? "gauche" : "droite", positionSujet: 0.5, clair: i === 1 };
  travaux.push({ nom: `Proposition ${photo}`, source: join(RACINE, "public", "demo", "decors", "propositions", `${photo}.jpg`), valeur, sortie: join(RACINE, "public", "demo", "decors", "propositions", "sur-double", `${photo}.jpg`) });
}

for (const t of travaux) if (!existsSync(t.source)) throw new Error(`Image absente : ${t.source}`);
const serveur = await servirDossier(ENTREES);
const preuve: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const [i, t] of travaux.entries()) {
  const nomEntree = `decor-${i}.jpg`;
  copyFileSync(t.source, join(ENTREES, nomEntree));
  const proprietes = brique.proprietesVignetteDecor({ decor: brique.decorDepuisValeur(t.valeur, true, REPLI), double: brique.doubleVignette(false) });
  const dossier = join(TRAVAIL, `v-${i}`);
  mkdirSync(dossier, { recursive: true });
  await imageFixe(
    { idRendu: `vignette-${i}`, operation: "image-fixe", file: "courte", entrees: { decor: `${serveur.base}/${nomEntree}` }, sortie: { urlDepot: "", cle: "v.png" }, parametres: brique.parametresVignetteDecor(proprietes) },
    { dossier, signal: new AbortController().signal, progression: () => {} },
  );
  mkdirSync(resolve(t.sortie, ".."), { recursive: true });
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(dossier, "image.png"), "-vf", "scale=540:960:flags=lanczos", "-q:v", "3", t.sortie]);
  if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`);
  preuve.push({ decor: t.nom, sortie: t.sortie.replace(RACINE, "").replace(/\\/g, "/"), flouPx: proprietes.decor.flouPx, liseré: proprietes.contour ?? null });
  console.log(`vignette : ${t.nom}`);
}

// Le double simulé seul, sur fond transparent (l'écran le pose sur une photo neuve en attendant sa vignette).
{
  const proprietes = brique.proprietesVignetteDecor({ decor: { teinte: "transparent", directionLumiere: "face", flouPx: 0, clair: false }, double: brique.doubleVignette(false) });
  const dossier = join(TRAVAIL, "silhouette");
  mkdirSync(dossier, { recursive: true });
  await imageFixe({ idRendu: "silhouette", operation: "image-fixe", file: "courte", entrees: {}, sortie: { urlDepot: "", cle: "s.png" }, parametres: brique.parametresVignetteDecor(proprietes) }, { dossier, signal: new AbortController().signal, progression: () => {} });
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(dossier, "image.png"), "-vf", "scale=540:960:flags=lanczos", join(RACINE, "public", "demo", "decors", "silhouette.png")]);
}
await serveur.fermer();

// Planche pour le rapport : les 9 vignettes côte à côte.
const entreesPlanche = travaux.flatMap((t) => ["-i", t.sortie]);
const filtre = travaux.map((_, i) => `[${i}]scale=180:320[v${i}]`).join(";") + ";" + travaux.map((_, i) => `[v${i}]`).join("") + `hstack=${travaux.length}`;
spawnSync("ffmpeg", ["-v", "error", "-y", ...entreesPlanche, "-filter_complex", filtre, "-q:v", "3", join(CAPTURES, "vignettes-sur-double.jpg")]);
writeFileSync(join(CAPTURES, "preuve-vignettes.json"), JSON.stringify({ date: new Date().toISOString(), coutUsd: 0, operation: "image-fixe (studio-rendu, local)", composition: "CompositionImage", double: "silhouette simulée", dureeSec: Math.round((Date.now() - t0) / 1000), vignettes: preuve }, null, 2));
console.log(`${travaux.length} vignettes en ${Math.round((Date.now() - t0) / 1000)} s.`);
