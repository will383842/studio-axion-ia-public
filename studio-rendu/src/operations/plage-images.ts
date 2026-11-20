/**
 * Opération `composition`, mode `plage` (G10-01) : rend UNE plage d'images d'une composition Remotion, sans opération neuve.
 * Preuve G10-06 : plage = rendu entier, pixels identiques (le SON n'est pas prouvé : compositions mesurées muettes).
 * Paramètres : `composition` (id), `proprietes` (les mêmes, complètes, que le rendu d'origine), `debut` et `fin` (images, bornes
 * comprises, entiers ≥ 0), `crf` facultatif (0-51). Même codec (h264) que `compositionEssai`. TOUJOURS en local : aucun
 * import du module AWS, la plage ne part jamais sur AWS même si Lambda est configuré.
 * Sans `mode: "plage"` ce fichier n'est jamais appelé (`composition.ts`).
 */
import { join } from "node:path";
import { ErreurRendu, type ContexteOperation, type DemandeRendu } from "../contrat.js";
import { deposer, erreurSelectionComposition } from "../outils.js";
import { paquetCompositions, REGLAGES_RENDU } from "../remotion.js";

/** Part de `@remotion/renderer` utilisée ici (typée à la main, voir l'import dynamique plus bas). */
interface RendererLocal {
  makeCancelSignal: () => { cancelSignal: unknown; cancel: () => void };
  renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
  selectComposition: (options: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<{ fps: number; durationInFrames: number; id: string }>;
}

export interface OptionsPlage {
  compositionId: string;
  proprietes: Record<string, unknown>;
  frameRange: [number, number];
  codec: "h264";
  crf: number | undefined;
}

export type ResultatOptionsPlage = { ok: true; options: OptionsPlage } | { ok: false; message: string };

/**
 * Lit et contrôle les paramètres (pure). `choisie` : `undefined` = durée pas encore connue (seules les bornes sont
 * contrôlées) ; `null` = composition inconnue du paquet ; sinon sa durée en images.
 */
export function optionsPlage(parametres: Record<string, unknown>, choisie?: { durationInFrames: number } | null): ResultatOptionsPlage {
  const refus = (message: string): ResultatOptionsPlage => ({ ok: false, message: `Plage d'images refusée : ${message}` });
  const id = parametres.composition;
  if (typeof id !== "string" || id.trim() === "") return refus("composition absente.");
  if (choisie === null) return refus(`composition « ${id} » inconnue (introuvable dans le paquet).`);
  const { debut, fin } = parametres;
  if (!Number.isInteger(debut) || !Number.isInteger(fin) || (debut as number) < 0 || (fin as number) < 0) return refus("début et fin doivent être des entiers ≥ 0.");
  const d = debut as number;
  const f = fin as number;
  if (f < d) return refus(`plage vide ou inversée (début ${d} > fin ${f}).`);
  if (choisie && f > choisie.durationInFrames - 1) return refus(`fin ${f} hors durée (la composition a ${choisie.durationInFrames} images, dernière image ${choisie.durationInFrames - 1}).`);
  const proprietes = parametres.proprietes && typeof parametres.proprietes === "object" ? (parametres.proprietes as Record<string, unknown>) : {};
  const crf = typeof parametres.crf === "number" && Number.isFinite(parametres.crf) ? Math.max(0, Math.min(51, Math.round(parametres.crf))) : undefined;
  return { ok: true, options: { compositionId: id, proprietes, frameRange: [d, f], codec: "h264", crf } };
}

/**
 * Réglages x264 passés EN PLUS à `renderMedia` (pure). Éteint : exactement ce que master passait (`crf` + BT.709 si `crf`, sinon rien).
 * `parametres.recollable === true` (seul `true` allume, T-EXT-52c-e) : BT.709 même sans `crf`, et, à l'assemblage, GOP fermé de 2 s,
 * profil High 4.1 (mêmes valeurs que `reglagesVideo`, `composition/ffmpeg.ts`), pour qu'un morceau se recolle à un tronçon de l'export.
 */
export function optionsRenduPlage(parametres: Record<string, unknown>, choisie: { fps: number; durationInFrames: number }): Record<string, unknown> {
  const o = optionsPlage(parametres, choisie);
  const crf = o.ok && o.options.crf !== undefined ? { crf: o.options.crf, colorSpace: "bt709" as const } : {};
  if (parametres.recollable !== true) return crf;
  const gop = String(Math.round(choisie.fps) * 2);
  const ajout = ["-g", gop, "-keyint_min", gop, "-sc_threshold", "0", "-flags", "+cgop", "-profile:v", "high", "-level:v", "4.1"];
  return {
    ...crf,
    colorSpace: "bt709" as const,
    ffmpegOverride: ({ type, args }: { type: string; args: readonly string[] }): string[] =>
      type === "stitcher" ? [...args.slice(0, -1), ...ajout, ...args.slice(-1)] : [...args],
  };
}

function refuser(message: string): never {
  throw new ErreurRendu({ code: "refuse", reessayable: false, message });
}

/** Rend la plage en local (`renderMedia` + `frameRange`) et dépose le morceau comme `compositionEssai`. */
export async function compositionPlage(demande: DemandeRendu, contexte: ContexteOperation) {
  const pre = optionsPlage(demande.parametres);
  if (!pre.ok) refuser(pre.message);
  const proprietes = { ...pre.options.proprietes, ...demande.entrees };
  // Nom passé par variable : le paquet n'est pas installé pour le contrôle de types racine (pas de TS2307 neuf).
  const nomRenderer: string = "@remotion/renderer";
  const { makeCancelSignal, renderMedia, selectComposition } = (await import(nomRenderer)) as RendererLocal;
  const serveUrl = await paquetCompositions();
  const choisie = await selectComposition({ serveUrl, id: pre.options.compositionId, inputProps: proprietes }).catch((e: Error) => {
    throw erreurSelectionComposition(pre.options.compositionId, e);
  });
  const controle = optionsPlage(demande.parametres, choisie);
  if (!controle.ok) refuser(controle.message);
  const { cancelSignal, cancel } = makeCancelSignal();
  contexte.signal.addEventListener("abort", () => cancel());
  const sortie = join(contexte.dossier, "video.mp4");
  const crf = optionsRenduPlage(demande.parametres, choisie);
  await renderMedia({ ...REGLAGES_RENDU, composition: choisie, serveUrl, codec: controle.options.codec, ...crf, frameRange: controle.options.frameRange, outputLocation: sortie, inputProps: proprietes, cancelSignal, onProgress: ({ progress }: { progress: number }) => contexte.progression(progress * 95) });
  await deposer(demande.sortie.urlDepot, sortie, "video/mp4", contexte.signal);
  const [debut, fin] = controle.options.frameRange;
  return { mesures: { images: fin - debut + 1, fps: choisie.fps, debut, fin } };
}
