/** Aiguillage : une source → sa lecture. Une source par fichier (`npm.ts`, `github.ts`, `page.ts`, `fal.ts`, `anthropic.ts`). */
import type { SourceVeille } from "@/domaine/types";
import { lireAnthropic } from "./anthropic";
import { lireFal } from "./fal";
import { lireGithub } from "./github";
import { lireNpm } from "./npm";
import { lirePage } from "./page";
import type { ContexteLecture, Lecture } from "./types";

export async function lireSource(source: SourceVeille, c: ContexteLecture): Promise<Lecture> {
  switch (source.type) {
    case "npm":
      return lireNpm(source.paquet, c);
    case "github":
      return lireGithub(source.depot, source.fichiersSurveilles ?? [], c);
    case "page":
      return lirePage(source.url, c);
    case "fal":
      return lireFal(source.categorie, c);
    case "anthropic":
      return lireAnthropic(c);
  }
}

/** Adresse publique montrée sous la carte (« Voir la source »). */
export function adresseSource(source: SourceVeille): string {
  switch (source.type) {
    case "npm":
      return `https://www.npmjs.com/package/${source.paquet}`;
    case "github":
      return `https://github.com/${source.depot}/releases`;
    case "page":
      return source.url;
    case "fal":
      return "https://fal.ai/models";
    case "anthropic":
      return "https://docs.anthropic.com/en/docs/about-claude/models/overview";
  }
}
