import { z } from "zod";
import { texteSansLien } from "../../../domaine/visuels/schema";
import { ToileSpec } from "../../../domaine/visuels/continu/schema-toile";
import { ErreurTexteCarrousel, phrase, TAILLE_PAQUET_MAX } from "../../texte/session";
import type { ReponseTexteToile, ToileEcrite } from "./simulation-toile";

export const VERSION_PAQUET_TOILE = "paquet-session-toile/1";

/** Paquet de session d'une toile, construit sur un schéma de toile (celui des registres, ou un schéma d'essai). */
export function construirePaquetToile(schemaToile: z.ZodType) {
  return z
    .object({
      version: z.literal(VERSION_PAQUET_TOILE, { error: `doit valoir « ${VERSION_PAQUET_TOILE} »` }),
      sujet: texteSansLien(1, 200),
      titre: texteSansLien(1, 120),
      pourquoi: z.array(texteSansLien(1, 200)).max(10),
      toile: schemaToile,
    })
    .strict()
    .superRefine((paquet, ctx) => {
      const pages = (paquet.toile as { pages?: unknown[] } | undefined)?.pages;
      if (Array.isArray(pages) && paquet.pourquoi.length !== pages.length) {
        ctx.addIssue({ code: "custom", path: ["pourquoi"], message: `une phrase par page (${pages.length} attendues, ${paquet.pourquoi.length} reçues)` });
      }
    });
}

export const Paquet = construirePaquetToile(ToileSpec);

function phraseToile(issue: z.core.$ZodIssue): string {
  // Les erreurs de la toile sont déjà en français et nomment la page, le raccord ou la toile.
  if (issue.path[0] === "toile" && issue.code === "custom") return `Toile : ${issue.message}.`;
  if (issue.code === "custom" || (issue.path.length === 1 && issue.path[0] === "version")) return `Champ « ${issue.path.map(String).join(".")} » : ${issue.message}.`;
  return phrase(issue);
}

/** Lit le contenu (JSON, 64 Ko au plus) d'un paquet de toile ; toute erreur est une phrase française qui nomme le champ. */
export function lirePaquetToile(contenu: string, paquet: z.ZodType = Paquet): ReponseTexteToile & { mode: "session" } {
  if (new TextEncoder().encode(contenu).length > TAILLE_PAQUET_MAX) {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", "Le paquet dépasse 64 Ko : il est refusé.");
  }
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", "Le paquet n'est pas un JSON lisible : vérifiez les accolades, les guillemets et les virgules.");
  }
  const lu = paquet.safeParse(brut);
  if (!lu.success) {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", `Le paquet est refusé. ${lu.error.issues.slice(0, 5).map(phraseToile).join(" ")}`);
  }
  const { titre, pourquoi, toile } = lu.data as { titre: string; pourquoi: string[]; toile: ToileEcrite };
  return { titre, pourquoi, toile, mode: "session" };
}
