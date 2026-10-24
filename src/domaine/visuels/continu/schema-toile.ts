import { z } from "zod";
import { GABARITS, type DefinitionGabarit } from "../../../briques/visuels/continu/registre-gabarits";
import { PARCOURS, type DefinitionParcours } from "../../../briques/visuels/continu/registre-parcours";
import { RACCORDS, type DefinitionRaccord } from "../../../briques/visuels/continu/registre-raccords";
import { FORMATS_TOILE, HAUTEURS, PAGES_MAX, PAGES_MIN } from "./geometrie";

const MESSAGE_CLE_INCONNUE = (cles: string[]) => `clé inconnue : ${cles.join(", ")}`;

export type PageToile = { type: string; alt: string; rubrique?: string } & Record<string, unknown>;
export interface RaccordToile {
  type: string;
  /** Numéro de la couture interne (1 = entre la page 1 et la page 2). */
  couture: number;
  /** Position verticale du centre, en px depuis le haut. */
  y: number;
}
export interface ToileSpecType {
  format: "4:5" | "3:4";
  pages: PageToile[];
  raccords: RaccordToile[];
}

/** Toile entière validée par un seul `superRefine` ; chaque message est en français et nomme la page ou le raccord. */
export function construireSchemaToile(gabarits: DefinitionGabarit[], parcours: DefinitionParcours[], raccords: DefinitionRaccord[]) {
  const parType = new Map(gabarits.map((g) => [g.type, g]));
  const parcoursDe = new Map<string, DefinitionParcours>();
  for (const p of parcours) for (const t of p.pagesTypes) parcoursDe.set(t, p);
  const typesRaccord = new Set<string>(raccords.map((r) => r.type));

  const unRaccord = z
    .strictObject(
      { type: z.string(), couture: z.number().int(), y: z.number().min(0).max(Math.max(...Object.values(HAUTEURS))) },
      { error: (i) => (i.code === "unrecognized_keys" ? MESSAGE_CLE_INCONNUE(i.keys) : undefined) },
    );

  return z
    .strictObject(
      {
        format: z.enum(FORMATS_TOILE as [string, ...string[]], { error: "le format doit être « 4:5 » ou « 3:4 »" }),
        pages: z
          .array(z.record(z.string(), z.unknown()), { error: "les pages doivent former une liste" })
          .min(PAGES_MIN, `la toile compte au moins ${PAGES_MIN} pages`)
          .max(PAGES_MAX, `la toile compte au plus ${PAGES_MAX} pages`),
        raccords: z.array(unRaccord),
      },
      { error: (i) => (i.code === "unrecognized_keys" ? MESSAGE_CLE_INCONNUE(i.keys) : undefined) },
    )
    .superRefine((toile, ctx) => {
      const erreur = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
      const n = toile.pages.length;

      // 1. Chaque page passe le schéma de son gabarit.
      const vues = new Map<string, number>();
      const gabaritsPages: (DefinitionGabarit | undefined)[] = toile.pages.map((brut, i) => {
        const num = i + 1;
        const type = brut.type;
        const g = typeof type === "string" ? parType.get(type) : undefined;
        if (!g) {
          erreur(`la page ${num} : le type « ${String(type)} » est inconnu`, ["pages", i]);
          return undefined;
        }
        const r = g.schema.safeParse(brut);
        if (!r.success) {
          for (const issue of r.error.issues) {
            const champ = issue.path.join(".");
            const detail = issue.code === "unrecognized_keys" ? MESSAGE_CLE_INCONNUE((issue as { keys: string[] }).keys) : issue.message;
            erreur(`la page ${num} : ${champ ? `${champ} : ` : ""}${detail}`, ["pages", i]);
          }
        }
        const avant = vues.get(g.type);
        if (avant) erreur(`la page ${num} : la plaquette ${g.type} est déjà utilisée à la page ${avant}`, ["pages", i]);
        else vues.set(g.type, num);
        return g;
      });

      // 2. Deux pages sombres ne se suivent pas.
      for (let i = 1; i < n; i++) {
        if (gabaritsPages[i]?.sombre && gabaritsPages[i - 1]?.sombre) erreur(`la page ${i + 1} : deux pages sombres ne peuvent pas se suivre`, ["pages", i]);
      }

      // 3. Un seul parcours, complet, dans l'ordre, d'un seul tenant.
      const idsParcours = new Set<string>();
      let debut = -1;
      toile.pages.forEach((p, i) => {
        const pa = parcoursDe.get(String(p.type));
        if (!pa) return;
        if (idsParcours.size > 0 && !idsParcours.has(pa.id)) erreur(`la page ${i + 1} : une toile contient un seul parcours (déjà ${[...idsParcours][0]})`, ["pages", i]);
        idsParcours.add(pa.id);
        if (debut < 0) debut = i;
      });
      const parcoursPresent = idsParcours.size === 1 ? parcours.find((p) => p.id === [...idsParcours][0]) : undefined;
      if (parcoursPresent) {
        parcoursPresent.pagesTypes.forEach((t, j) => {
          const i = Math.min(debut + j, n - 1);
          if (debut + j >= n || toile.pages[debut + j].type !== t) erreur(`la page ${i + 1} : le parcours ${parcoursPresent.id} attend la page ${t} à cet endroit`, ["pages", i]);
        });
      }

      // 4. La page 1 est une couverture, sauf si un parcours qui commence l'ouvre.
      const premier = gabaritsPages[0];
      const parcoursPremier = parcoursDe.get(String(toile.pages[0]?.type));
      if (premier && premier.role !== "couverture" && !(parcoursPremier && parcoursPremier.commence)) {
        erreur("la page 1 : la première page doit être une couverture (ou ouvrir un parcours qui commence)", ["pages", 0]);
      }

      // 5. Raccords : seulement sur une couture interne, hors couture interne à un parcours.
      const couturesParcours = new Set<number>();
      if (parcoursPresent) for (let j = 1; j < parcoursPresent.pagesTypes.length; j++) couturesParcours.add(debut + j);
      const occupees = new Set<number>();
      toile.raccords.forEach((r, k) => {
        const nom = `le raccord ${k + 1}`;
        if (!typesRaccord.has(r.type)) erreur(`${nom} : le type « ${r.type} » est inconnu`, ["raccords", k]);
        if (r.couture < 1 || r.couture > n - 1) erreur(`${nom} : la couture ${r.couture} n'existe pas (les coutures vont de 1 à ${n - 1})`, ["raccords", k]);
        else if (couturesParcours.has(r.couture)) erreur(`${nom} : la couture ${r.couture} est interne au parcours`, ["raccords", k]);
        if (occupees.has(r.couture)) erreur(`${nom} : la couture ${r.couture} porte déjà un raccord`, ["raccords", k]);
        occupees.add(r.couture);
      });
    });
}

export const ToileSpec = construireSchemaToile(GABARITS, PARCOURS, RACCORDS);
