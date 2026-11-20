/**
 * TÉMOIN EN IMAGES DES PETITS OBJETS DU CAS CONCRET (C9-41-b-v20h). Outil local, lancé à la main, jamais en CI : 0 €,
 * aucun appel à Claude (plans par règles fixes : `adapterPlan` sans `appeler`), rien n'est allumé.
 * Rend 3 textes de cas concret SANS puis AVEC la liste des petits objets, une image fixe à mi-parcours de chaque scène.
 * Usage (depuis `studio-rendu/`) : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome npx tsx scripts/temoin-objets-cas-concret.ts <dossier-de-sortie>`
 * La partie pure (instants, paires sans/avec, objets montrés) est exportée ; le rendu (Remotion) n'est chargé que dans `lancer`.
 */
import { resolve } from "node:path";
import { adapterPlan } from "../../src/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases } from "../../src/briques/plan-scenes-generateurs/video";
import type { MotMinute, PlanValide } from "../../src/briques/plan-scenes/schema";
import { FORMAT_PLAN_CAS_CONCRET } from "../../src/moteurs/montage-cas-concret/plan-scenes";

export const FPS = 25;

/**
 * Les 3 textes du témoin, choisis (essai du 20/11) pour que les 4 petits objets apparaissent : gros chiffre (texte 1),
 * étape et coche (texte 2), cartes à coche et coche (texte 3). Les objets ne se posent que dans les trous du plan.
 */
export const TEXTES_TEMOIN: readonly string[] = [
  "Ce mois-ci, nous avons envoyé 38 devis. Résultat : 12 clients de plus qu'en septembre.",
  "Bonjour à tous. Je voudrais vous parler de notre façon de travailler avec les artisans de la région. Première étape. Nous écoutons chaque client avec attention avant de proposer quoi que ce soit. Le chantier est terminé, c'est fait.",
  "Bonjour à tous. Voilà ce que nous faisons pour vous : d'abord écouter, puis ensuite proposer, enfin livrer. Le chantier est terminé, c'est fait. Merci.",
];

/** Les 4 petits objets permis (réglage du cas concret). */
export const OBJETS_TEMOIN = ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"] as const;

const MS_PAR_MOT = 400;

/** Les mots du texte, 400 ms chacun, calés bout à bout (aucune horloge, aucune voix). */
export function motsDuTexte(texte: string): MotMinute[] {
  return enMillisecondes(
    texte
      .split(/\s+/)
      .filter(Boolean)
      .map((t, i) => ({ texte: t, debutSec: (i * MS_PAR_MOT) / 1000, finSec: ((i + 1) * MS_PAR_MOT) / 1000 })),
  );
}

/** Plan du cas concret pour un texte, par les règles fixes seulement (jamais d'`appeler`) ; `objets` vide = sans réglage. */
export async function planTemoin(texte: string, objets: readonly string[]): Promise<PlanValide | null> {
  const mots = motsDuTexte(texte);
  const r = await adapterPlan({
    generateur: "cas-concret",
    script: texte,
    segments: segmenterEnPhrases(mots),
    format: FORMAT_PLAN_CAS_CONCRET,
    facecam: false,
    ...(objets.length ? { objetsPermis: objets } : {}),
  });
  return r.plan;
}

export interface ImageATemoin {
  /** Nom de fichier PNG, sans dossier. */
  fichier: string;
  variante: "sans" | "avec";
  texte: number;
  scene: number;
  piece: string;
  /** Image (numéro) à mi-parcours de la scène. */
  image: number;
}

export interface PaireTemoin {
  texte: string;
  /** `null` : sans les objets, le plan n'a aucune scène (rien à rendre ; la vidéo garde son existant). */
  sans: PlanValide | null;
  avec: PlanValide | null;
}

/** Image à mi-parcours d'une scène : milieu de [debutMs, finMs[ en images, arrondi, jamais au-delà de la dernière image de la scène. */
export function imageMiParcours(debutMs: number, finMs: number): number {
  const debut = Math.round((debutMs / 1000) * FPS);
  const fin = Math.max(debut, Math.round((finMs / 1000) * FPS) - 1);
  return Math.min(fin, Math.round(((debutMs + finMs) / 2 / 1000) * FPS));
}

/** Les paires sans/avec des 3 textes, par les règles fixes (0 €, aucun appel). */
export async function lesPaires(): Promise<PaireTemoin[]> {
  const sortie: PaireTemoin[] = [];
  for (const texte of TEXTES_TEMOIN) sortie.push({ texte, sans: await planTemoin(texte, []), avec: await planTemoin(texte, OBJETS_TEMOIN) });
  return sortie;
}

/** Les images d'une paire (texte numéro `t`, à partir de 1) : une par scène et par variante ; noms stables (`t1-avec-s2-objet-etape.png`). */
export function imagesDePaire(p: PaireTemoin, t: number): ImageATemoin[] {
  return (["sans", "avec"] as const).flatMap((variante) =>
    (p[variante]?.scenes ?? []).map((s, i) => ({
      fichier: `t${t}-${variante}-s${i + 1}-${s.piece}.png`,
      variante,
      texte: t,
      scene: i + 1,
      piece: s.piece,
      image: imageMiParcours(s.debutMs, s.finMs),
    })),
  );
}

export const imagesDe = (paires: readonly PaireTemoin[]): ImageATemoin[] => paires.flatMap((p, i) => imagesDePaire(p, i + 1));

/** Les petits objets (pièces `objet-*`) montrés par les images « avec », sans doublon, dans l'ordre d'apparition. */
export function objetsMontres(images: readonly ImageATemoin[]): string[] {
  return [...new Set(images.filter((i) => i.variante === "avec" && i.piece.startsWith("objet-")).map((i) => i.piece))];
}

/** Lancement réel (Remotion et navigateur requis) : écrit les PNG dans `dossier`. */
export async function lancer(dossier: string): Promise<string[]> {
  const { mkdirSync } = await import("node:fs");
  const { bundle } = await import("@remotion/bundler");
  const { ensureBrowser, renderStill, selectComposition } = await import("@remotion/renderer");
  mkdirSync(dossier, { recursive: true });
  const racine = resolve(import.meta.dirname, "..");
  const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
  if (!navigateur) await ensureBrowser();
  const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
  const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
  const toutes = await lesPaires();
  const ecrits: string[] = [];
  for (const [t, p] of toutes.entries()) {
    for (const variante of ["sans", "avec"] as const) {
      if (!p[variante]) continue;
      const inputProps = { plan: p[variante] } as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "PlanDeScenes", inputProps, ...reglages });
      for (const im of imagesDePaire(p, t + 1).filter((i) => i.variante === variante)) {
        const sortie = resolve(dossier, im.fichier);
        await renderStill({ composition, serveUrl, frame: im.image, output: sortie, inputProps, ...reglages });
        ecrits.push(sortie);
      }
    }
  }
  console.log("objets montrés :", objetsMontres(imagesDe(toutes)).join(", "));
  return ecrits;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "§")) {
  const dossier = process.argv[2];
  if (!dossier) throw new Error("Usage : temoin-objets-cas-concret.ts <dossier-de-sortie>");
  console.log((await lancer(resolve(dossier))).join("\n"));
}
