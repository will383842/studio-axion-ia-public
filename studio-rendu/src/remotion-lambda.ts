/**
 * REMOTION LAMBDA (lot M4b, conditionnel ; plan B.7) — PRÊT, DÉSACTIVÉ. Aucun appel tant que Will n'a pas de compte
 * AWS et que `REMOTION_LAMBDA_ACTIVE=true` n'est pas posé avec ses variables.
 *
 * Ce qu'il ferait : rendre sur AWS Lambda (des dizaines de navigateurs en parallèle) la partie Remotion d'un montage —
 * les calques TEXTE (et, pour le double simulé, les calques image) — puis rendre la main à FFmpeg dans `studio-rendu`
 * comme d'habitude (LUT, son, export, mesures). Depuis le montage FFmpeg du lot M4b, le rendu local tient le seuil
 * de 4 min pour 45 s avec 6 cœurs : Lambda n'est plus nécessaire, il reste une réserve (pics de charge, serveur
 * plus petit).
 *
 * Mise en route (une fois, par Will ou l'administrateur, hors du studio) :
 *   1. compte AWS, utilisateur IAM avec la politique de Remotion (`npx remotion lambda policies user`) ;
 *   2. `npx remotion lambda functions deploy` (région eu-central-1, 2048 Mo, 120 s) → nom de la fonction ;
 *   3. `npx remotion lambda sites create studio-rendu/compositions/index.ts --site-name=studio-axion` → adresse du site ;
 *   4. dans `.env` du serveur : REMOTION_LAMBDA_ACTIVE=true, REMOTION_LAMBDA_REGION, REMOTION_LAMBDA_FONCTION,
 *      REMOTION_LAMBDA_SITE, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY ; `npm i @remotion/lambda@<même version>` dans
 *      `studio-rendu` (le paquet n'est PAS installé aujourd'hui : aucune dépendance de plus tant que c'est éteint).
 * Coût : payé à l'usage (Lambda + S3), lu dans `getRenderProgress().costs` et reporté dans les mesures (`coutLambdaUsd`).
 */
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as FluxWeb } from "node:stream/web";
import { ErreurRendu } from "./contrat.js";

export interface ConfigLambda {
  region: string;
  fonction: string;
  /** Adresse du site Remotion déployé (`sites create`). */
  site: string;
  /** Images par fonction (plus petit = plus de fonctions en parallèle). */
  imagesParFonction: number;
}

const VARIABLES = ["REMOTION_LAMBDA_REGION", "REMOTION_LAMBDA_FONCTION", "REMOTION_LAMBDA_SITE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const;

/** Configuration de Lambda, ou null (éteint) : il faut `REMOTION_LAMBDA_ACTIVE=true` ET toutes les variables. */
export function configLambda(env: Record<string, string | undefined> = process.env): ConfigLambda | null {
  if (env.REMOTION_LAMBDA_ACTIVE?.trim() !== "true") return null;
  if (VARIABLES.some((v) => !env[v]?.trim())) return null;
  return { region: env.REMOTION_LAMBDA_REGION!.trim(), fonction: env.REMOTION_LAMBDA_FONCTION!.trim(), site: env.REMOTION_LAMBDA_SITE!.trim(), imagesParFonction: Math.max(20, Number(env.REMOTION_LAMBDA_IMAGES_PAR_FONCTION) || 60) };
}

/** Variables manquantes (affichées par Réglages > Connexions côté studio). */
export function variablesLambdaManquantes(env: Record<string, string | undefined> = process.env): string[] {
  return [...(env.REMOTION_LAMBDA_ACTIVE?.trim() === "true" ? [] : ["REMOTION_LAMBDA_ACTIVE"]), ...VARIABLES.filter((v) => !env[v]?.trim())];
}

/** Ce que le studio utilise du client `@remotion/lambda/client` (sous-ensemble typé ici : le paquet n'est pas installé). */
export interface ClientLambda {
  renderMediaOnLambda(o: {
    region: string;
    functionName: string;
    serveUrl: string;
    composition: string;
    inputProps: Record<string, unknown>;
    codec: "h264" | "prores";
    proResProfile?: "4444";
    imageFormat: "png" | "jpeg";
    pixelFormat?: string;
    framesPerLambda?: number;
    privacy: "private" | "public" | "no-acl";
    downloadBehavior?: { type: "download"; fileName: string | null };
  }): Promise<{ renderId: string; bucketName: string }>;
  getRenderProgress(o: { renderId: string; bucketName: string; functionName: string; region: string }): Promise<{
    overallProgress: number;
    done: boolean;
    outputFile: string | null;
    /** Clé de la sortie dans le compartiment (quand le client la donne). */
    outKey?: string | null;
    fatalErrorEncountered: boolean;
    errors: { message: string }[];
    costs: { accruedSoFar: number; currency: string };
  }>;
  /** Adresse de lecture signée de la sortie (S3 privé). */
  presignUrl(o: { region: string; bucketName: string; objectKey: string; expiresInSeconds: number }): Promise<string | null>;
}

/** Charge le vrai client, seulement si Lambda est allumé (import par nom calculé : aucune dépendance au build). */
export async function chargerClientLambda(): Promise<ClientLambda> {
  const nom = ["@remotion", "lambda", "client"].join("/");
  try {
    return (await import(nom)) as unknown as ClientLambda;
  } catch {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Remotion Lambda est allumé mais le paquet @remotion/lambda n'est pas installé dans studio-rendu." });
  }
}

export interface ResultatLambda {
  fichier: string;
  coutUsd: number;
  secondes: number;
}

/**
 * Rend une composition sur Lambda, attend la fin (interrogation toutes les `intervalleMs`), télécharge la sortie
 * dans `sortie`. Calques texte : ProRes 4444 avec transparence (FFmpeg le pose ensuite comme les PNG).
 * Les propriétés doivent contenir des adresses PUBLIQUES ou signées (jamais le serveur local de `studio-rendu`).
 */
export async function rendreSurLambda(
  config: ConfigLambda,
  client: ClientLambda,
  demande: { composition: string; inputProps: Record<string, unknown>; transparent: boolean },
  sortie: string,
  options: { signal?: AbortSignal; progression?: (p: number) => void; intervalleMs?: number; attendre?: (ms: number) => Promise<void>; telecharger?: (url: string, chemin: string) => Promise<void> } = {},
): Promise<ResultatLambda> {
  const debut = Date.now();
  const attendre = options.attendre ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const { renderId, bucketName } = await client.renderMediaOnLambda({
    region: config.region,
    functionName: config.fonction,
    serveUrl: config.site,
    composition: demande.composition,
    inputProps: demande.inputProps,
    codec: demande.transparent ? "prores" : "h264",
    proResProfile: demande.transparent ? "4444" : undefined,
    imageFormat: demande.transparent ? "png" : "jpeg",
    pixelFormat: demande.transparent ? "yuva444p10le" : undefined,
    framesPerLambda: config.imagesParFonction,
    privacy: "private",
  });
  for (;;) {
    if (options.signal?.aborted) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Rendu arrêté." });
    const e = await client.getRenderProgress({ renderId, bucketName, functionName: config.fonction, region: config.region });
    options.progression?.(e.overallProgress);
    if (e.fatalErrorEncountered) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `Remotion Lambda : ${e.errors[0]?.message ?? "échec du rendu"}` });
    if (e.done && e.outputFile) {
      // Clé de l'objet : donnée par Remotion, sinon lue dans l'adresse (style « chemin » : /<compartiment>/<clé>).
      const cle = e.outKey ?? decodeURIComponent(new URL(e.outputFile).pathname.replace(/^\//, "")).replace(new RegExp(`^${bucketName}/`), "");
      const url = (await client.presignUrl({ region: config.region, bucketName, objectKey: cle, expiresInSeconds: 3600 })) ?? e.outputFile;
      await (options.telecharger ?? telechargerVers)(url, sortie);
      return { fichier: sortie, coutUsd: e.costs.accruedSoFar, secondes: +((Date.now() - debut) / 1000).toFixed(1) };
    }
    await attendre(options.intervalleMs ?? 2000);
  }
}

async function telechargerVers(url: string, chemin: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `Sortie de Remotion Lambda illisible (${r.status}).` });
  await pipeline(Readable.fromWeb(r.body as unknown as FluxWeb<Uint8Array>), createWriteStream(chemin));
}
