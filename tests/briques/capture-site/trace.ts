/**
 * Trace des appels faits au navigateur (double) pour les trois modes d'avant C3 : sert au test « trace identique ».
 * Une ligne par appel : méthode, puis l'empreinte de ses arguments.
 */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { capturerPage, type PageCapture, type ParametresCapture } from "../../../studio-rendu/src/operations/capture-site";

const court = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** Double minimal : uniquement les méthodes d'aujourd'hui ; chaque appel est noté. */
export function doubleTrace() {
  const trace: string[] = [];
  const page: PageCapture = {
    async ouvrir(url, f) {
      trace.push(`ouvrir ${url} ${court(f)}`);
      return url;
    },
    async evaluer<T>(expression: string) {
      trace.push(`evaluer ${court(expression)}`);
      if (expression.includes("studio-fleche") && expression.includes("hauteurPage")) return { hauteurPage: 5000, titre: "Essai" } as T;
      if (expression.includes("voulu")) return { x: 200, y: 1400 } as T;
      return 0 as T;
    },
    async photographier(...args: unknown[]) {
      trace.push(`photographier ${court(args)}`);
      return Buffer.from([0xff, 0xd8, 0xff]);
    },
    async survoler(x, y) {
      trace.push(`survoler ${x} ${y}`);
    },
    async fermer() {
      trace.push("fermer");
    },
  };
  return { page, trace };
}

export const MODES_ANCIENS: { nom: string; url: string; p: ParametresCapture }[] = [
  { nom: "image", url: "https://axion-ia.com/fr", p: { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6 } },
  { nom: "defilement", url: "https://axion-ia.com/fr/formations", p: { type: "video", format: "16:9", mouvement: "defilement", dureeSec: 4 } },
  { nom: "survol", url: "https://www.axion-ia.com/fr/audit", p: { type: "video", format: "1:1", mouvement: "survol", dureeSec: 5, cible: "Audit" } },
];

/** Empreinte de la trace complète d'un mode. */
export async function empreinteTrace(mode: (typeof MODES_ANCIENS)[number], dossier: string): Promise<{ appels: number; empreinte: string }> {
  const { page, trace } = doubleTrace();
  await capturerPage(mode.url, mode.p, dossier, { ouvrir: async () => page, encoder: async (_d, c) => writeFile(c, "mp4") });
  return { appels: trace.length, empreinte: court(trace) };
}

