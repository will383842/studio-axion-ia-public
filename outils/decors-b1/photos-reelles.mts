/**
 * PREUVE DU LOT B1 — « un décor en une phrase » : TROIS vraies photos de décor SANS personne, fabriquées par fal.ai
 * (Nano Banana, une par ambiance), avec le VRAI code (`requetesPropositions`, `creerFabricationFal`). Plafond strict :
 * 0,40 $ (contrat B1) ; Nano Banana coûte 0,039 $ l'image, soit 0,117 $ pour les trois.
 *
 * Clé : `FAL_KEY` lue dans `~/.claude/secrets/studio.env` (hors dépôt), jamais affichée ni écrite.
 * Usage (racine du dépôt) : `pnpm exec tsx outils/decors-b1/photos-reelles.mts ["une phrase"]`
 * Sorties : `docs/captures/b1-decors/` (photos + `preuve-photos.json`) et une copie sous `public/demo/decors/propositions/`
 * (photos de l'essai sans clé).
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chargerCles } from "../demo-m5/cles.ts";

const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const decors = await charger<typeof import("@/domaine/decors")>("@/domaine/decors");
const fal = await charger<typeof import("@/fournisseurs/illustration/fal")>("@/fournisseurs/illustration/fal");

const RACINE = resolve(import.meta.dirname, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "b1-decors");
const DEMO = join(RACINE, "public", "demo", "decors", "propositions");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(DEMO, { recursive: true });

const presentes = chargerCles(["FAL_KEY"]);
if (!presentes.FAL_KEY) throw new Error("FAL_KEY absente du fichier de clés.");
const phrase = process.argv[2] ?? "un bureau en bois avec une bibliothèque";
const requetes = decors.requetesPropositions(phrase);
if (requetes.length !== 3) throw new Error("La phrase ne donne pas trois requêtes.");

const NOMS = ["bureau-doree", "bureau-jour", "bureau-soir"];
const f = fal.creerFabricationFal({
  cle: process.env.FAL_KEY!,
  plafondUsdCentimes: 40,
  // Dépôt dans le dossier temporaire du système ; les photos sont ensuite nommées par ambiance.
  deposer: async (contenu, _cle, mime) => {
    const tmp = join(tmpdir(), `b1-decor-${Date.now()}-${Math.random().toString(36).slice(2)}.${mime.includes("png") ? "png" : "jpg"}`);
    writeFileSync(tmp, contenu);
    return tmp;
  },
});

const debut = Date.now();
const resultats = await Promise.all(
  requetes.map(async ({ ambiance, requete }, i) => {
    const { idDemande } = await f.soumettre({ genre: "image", requete, ratio: "9:16", cleIdempotence: `b1-decor-${NOMS[i]}` });
    const r = await fal.attendreFabrication(f, idDemande, 180_000, 2000);
    const fichier = join(SORTIE, `${NOMS[i]}.jpg`);
    copyFileSync(r.fichierCle, fichier);
    copyFileSync(r.fichierCle, join(DEMO, `${NOMS[i]}.jpg`));
    return { ambiance: ambiance.libelle, requete, modele: r.modele, coutUsdCentimes: r.coutUsdCentimes, fichier: `docs/captures/b1-decors/${NOMS[i]}.jpg` };
  }),
);
const total = resultats.reduce((s, r) => s + r.coutUsdCentimes, 0);
writeFileSync(
  join(SORTIE, "preuve-photos.json"),
  JSON.stringify({ date: new Date().toISOString(), phrase, pointAcces: "https://queue.fal.run/fal-ai/nano-banana", dureeSec: Math.round((Date.now() - debut) / 1000), totalUsd: +(total / 100).toFixed(3), photos: resultats }, null, 2),
);
console.log(`3 photos fabriquées, ${(total / 100).toFixed(3)} $ (tarif publié fal), en ${Math.round((Date.now() - debut) / 1000)} s.`);
