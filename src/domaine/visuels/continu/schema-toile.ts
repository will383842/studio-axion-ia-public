import { z } from "zod";
import { GABARITS, type DefinitionGabarit } from "../../../briques/visuels/continu/registre-gabarits";
import { PARCOURS, type DefinitionParcours } from "../../../briques/visuels/continu/registre-parcours";
import { RACCORDS, type DefinitionRaccord } from "../../../briques/visuels/continu/registre-raccords";
import { FORMATS_TOILE, HAUTEURS, PAGES_MAX, PAGES_MIN } from "./geometrie";

export const VERSION_MODELE_TOILE = "toile/1";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const NOMS_TYPES: Record<string, string> = { string: "une chaîne de caractères", number: "un nombre", int: "un entier", boolean: "un booléen", object: "un objet", array: "une liste" };

/** Traduit une erreur zod en français (le préfixe « la page N : » est posé ensuite, d'après le chemin). */
function detail(i: { code: string; input?: unknown; [cle: string]: unknown }): string {
  switch (i.code) {
    case "invalid_type":
      return i.input === undefined ? "est obligatoire" : `doit être ${NOMS_TYPES[String(i.expected)] ?? "d'un autre type"}`;
    case "too_big": {
      const max = Number(i.maximum);
      if (i.origin === "string") return `ne doit pas dépasser ${pluriel(max, "caractère")}`;
      if (i.origin === "array") return `doit compter au plus ${pluriel(max, "élément")}`;
      return `doit être au plus ${max}`;
    }
    case "too_small": {
      const min = Number(i.minimum);
      if (i.origin === "string") return `doit compter au moins ${pluriel(min, "caractère")}`;
      if (i.origin === "array") return `doit compter au moins ${pluriel(min, "élément")}`;
      return `doit être au moins ${min}`;
    }
    case "unrecognized_keys":
      return `clé inconnue : ${(i.keys as string[]).join(", ")}`;
    case "invalid_union": {
      const valeur = i.input && typeof i.input === "object" ? (i.input as { type?: unknown }).type : i.input;
      return i.discriminator ? `le type « ${String(valeur)} » est inconnu` : "ne correspond à aucune forme permise";
    }
    case "invalid_value":
      return "valeur non permise";
    case "invalid_format":
      return "format invalide";
    case "not_multiple_of":
      return "n'est pas un multiple permis";
    default:
      return "valeur invalide";
  }
}

/** Entité nommée par un chemin d'erreur : la page, le raccord ou la toile, puis le champ. */
function prefixe(path: PropertyKey[]): string {
  const [racine, indice, ...reste] = path;
  const champ = (cles: PropertyKey[]) => (cles.length ? `${cles.map(String).join(".")} : ` : "");
  if (racine === "pages" && typeof indice === "number") return `la page ${indice + 1} : ${champ(reste.filter((c) => c !== "type" || reste.length > 1))}`;
  if (racine === "raccords" && typeof indice === "number") return `le raccord ${indice + 1} : ${champ(reste)}`;
  return `la toile : ${champ(path)}`;
}

export type PageToile = { type: string; alt: string; rubrique?: string } & Record<string, unknown>;

export interface RaccordToile {
  type: string;
  /** Numéro de la couture interne (1 = entre la page 1 et la page 2). */
  couture: number;
  /** Position verticale du centre, en px depuis le haut, au plus la hauteur de la toile. */
  y: number;
}

/** Page sentinelle d'un registre vide : aucune page n'est permise. */
const PAGE_VIDE = z.strictObject({ type: z.never() });

/**
 * Toile entière : un schéma zod strict dont les pages sont une union discriminée sur `type` (les données renvoyées
 * sont donc celles de chaque gabarit : rognées, transformées, valeurs par défaut), un seul `superRefine` pour les
 * règles entre pages, et chaque message en français qui nomme la page, le raccord ou la toile.
 */
export function construireSchemaToile(gabarits: DefinitionGabarit[], parcours: DefinitionParcours[], raccords: DefinitionRaccord[]) {
  const parType = new Map(gabarits.map((g) => [g.type, g]));
  const parcoursDe = new Map<string, DefinitionParcours>();
  for (const p of parcours) for (const t of p.pagesTypes) parcoursDe.set(t, p);
  const typesRaccord = new Set<string>(raccords.map((r) => r.type));

  const schemas = gabarits.map((g) => g.schema);
  const unePage =
    (schemas.length >= 2 ? z.discriminatedUnion("type", schemas as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]]) : (schemas[0] ?? PAGE_VIDE)) as unknown as z.ZodType<PageToile>;

  const unRaccord = z.strictObject({ type: z.string(), couture: z.number().int(), y: z.number().min(0).max(Math.max(...Object.values(HAUTEURS))) });

  const interne = z
    .strictObject({
      version: z.literal(VERSION_MODELE_TOILE, { error: `doit valoir « ${VERSION_MODELE_TOILE} »` }),
      format: z.enum(FORMATS_TOILE as [string, ...string[]], { error: "doit être « 4:5 » ou « 3:4 »" }) as z.ZodType<"4:5" | "3:4">,
      pages: z
        .array(unePage, { error: (i) => (i.code === "invalid_type" ? "doit être une liste" : undefined) })
        .min(PAGES_MIN, `il en faut au moins ${PAGES_MIN}`)
        .max(PAGES_MAX, `il en faut au plus ${PAGES_MAX}`),
      raccords: z.array(unRaccord),
    })
    .superRefine((toile, ctx) => {
      const erreur = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
      const n = toile.pages.length;
      const pageType = (i: number) => String((toile.pages[i] as { type?: unknown } | undefined)?.type);

      // 1. Une même plaquette n'est utilisée qu'une fois (le schéma de chaque page est vérifié par l'union).
      const vues = new Map<string, number>();
      const gabaritsPages = toile.pages.map((_, i) => {
        const g = parType.get(pageType(i));
        if (!g) return undefined;
        const avant = vues.get(g.type);
        if (avant) erreur(`la plaquette ${g.type} est déjà utilisée à la page ${avant}`, ["pages", i]);
        else vues.set(g.type, i + 1);
        return g;
      });

      // 2. Une seule page sombre dans la toile.
      let premiereSombre = 0;
      gabaritsPages.forEach((g, i) => {
        if (!g?.sombre) return;
        if (premiereSombre) erreur(`une toile n'a qu'une seule page sombre (déjà la page ${premiereSombre})`, ["pages", i]);
        else premiereSombre = i + 1;
      });

      // 3. Un seul parcours, complet, dans l'ordre, d'un seul tenant.
      const idsParcours = new Set<string>();
      let debut = -1;
      toile.pages.forEach((_, i) => {
        const pa = parcoursDe.get(pageType(i));
        if (!pa) return;
        if (idsParcours.size > 0 && !idsParcours.has(pa.id)) erreur(`une toile contient un seul parcours (déjà ${[...idsParcours][0]})`, ["pages", i]);
        idsParcours.add(pa.id);
        if (debut < 0) debut = i;
      });
      const parcoursPresent = idsParcours.size === 1 ? parcours.find((p) => p.id === [...idsParcours][0]) : undefined;
      if (parcoursPresent) {
        parcoursPresent.pagesTypes.forEach((t, j) => {
          const i = Math.min(debut + j, n - 1);
          if (debut + j >= n || pageType(debut + j) !== t) erreur(`le parcours ${parcoursPresent.id} attend la page ${t} à cet endroit`, ["pages", i]);
        });
      }

      // 4. La page 1 est une couverture, sauf si un parcours qui commence l'ouvre.
      const premier = gabaritsPages[0];
      const parcoursPremier = parcoursDe.get(pageType(0));
      if (premier && premier.role !== "couverture" && !(parcoursPremier && parcoursPremier.commence)) {
        erreur("la première page doit être une couverture (ou ouvrir un parcours qui commence)", ["pages", 0]);
      }

      // 5. La dernière page est un appel, ou la dernière page d'un parcours qui termine.
      const dernier = gabaritsPages[n - 1];
      const parcoursDernier = parcoursDe.get(pageType(n - 1));
      const finParcours = !!parcoursDernier && parcoursDernier.termine && parcoursDernier.pagesTypes[parcoursDernier.pagesTypes.length - 1] === pageType(n - 1);
      if (dernier && dernier.role !== "appel" && !finParcours) {
        erreur("la dernière page doit être un appel (ou la fin d'un parcours qui termine)", ["pages", n - 1]);
      }

      // 6. Raccords : seulement sur une couture interne, hors couture interne à un parcours, pas plus bas que la toile.
      const couturesParcours = new Set<number>();
      if (parcoursPresent) for (let j = 1; j < parcoursPresent.pagesTypes.length; j++) couturesParcours.add(debut + j);
      const occupees = new Set<number>();
      toile.raccords.forEach((r, k) => {
        if (!typesRaccord.has(r.type)) erreur(`le type « ${r.type} » est inconnu`, ["raccords", k]);
        if (r.couture < 1 || r.couture > n - 1) erreur(`la couture ${r.couture} n'existe pas (les coutures vont de 1 à ${n - 1})`, ["raccords", k]);
        else if (couturesParcours.has(r.couture)) erreur(`la couture ${r.couture} est interne au parcours`, ["raccords", k]);
        if (occupees.has(r.couture)) erreur(`la couture ${r.couture} porte déjà un raccord`, ["raccords", k]);
        occupees.add(r.couture);
        const hauteur = HAUTEURS[toile.format];
        if (r.y > hauteur) erreur(`ne peut pas dépasser la hauteur de la toile (${hauteur} px en ${toile.format})`, ["raccords", k, "y"]);
      });
    });

  return z.unknown().transform((brut, ctx) => {
    const r = interne.safeParse(brut, { error: (i) => detail(i as never) });
    if (r.success) return r.data;
    for (const issue of r.error.issues) ctx.addIssue({ code: "custom", message: `${prefixe(issue.path)}${issue.message}`, path: issue.path });
    return z.NEVER;
  });
}

export const ToileSpec = construireSchemaToile(GABARITS, PARCOURS, RACCORDS);
export type ToileSpecType = z.infer<typeof ToileSpec>;
