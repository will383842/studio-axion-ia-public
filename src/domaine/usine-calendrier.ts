/**
 * Porte du Studio, contrat calendrier (v1.1) : schémas zod PropositionCalendrier, ReponseCalendrier et CadenceUsine. PUR :
 * ni réseau, ni secret, ni horloge cachée (l'instant « maintenant » est toujours passé en argument).
 * L'usine PROPOSE ; seul le Studio programme, publie ou constate un échec. Aucun montant : des quantités seulement.
 * Les listes (réseaux, types actifs, statuts) sont LUES chez leur source, jamais recopiées.
 */
import { z } from "zod";
import { RESEAUX_TAXONOMIE } from "./taxonomie-contenu";
import { STATUTS_PLAN } from "./plan-editorial/statuts";
import { TYPES_CONTENU_USINE } from "./usine";
import type { IdReseau } from "./types";

/** Niveau du contrat : l'usine vers le Studio (proposition) = 2 ; le Studio vers l'usine (réponse, cadence) = 1.1. */
export const CONTRAT_CALENDRIER_PROPOSITION = 2;
export const CONTRAT_CALENDRIER_REPONSE = 1.1;

export const RESEAUX_CALENDRIER: readonly IdReseau[] = RESEAUX_TAXONOMIE;
/** Seuls les types ACTIFS de l'usine se proposent (carrousel, image, texte, story : refusés tant qu'ils sont inactifs). */
export const TYPES_PROPOSABLES: readonly string[] = TYPES_CONTENU_USINE.filter((t) => t.actif).map((t) => t.id);

export const MAX_PROPOSITIONS = 100;
export const MAX_MOTIF = 300;

const reseau = z.enum(RESEAUX_CALENDRIER as [IdReseau, ...IdReseau[]]);
const typeProposable = z.enum(TYPES_PROPOSABLES as [string, ...string[]]);
const cle = z.string().min(1).max(120);
const repere = z.string().regex(/^usine:[A-Za-z0-9._-]{1,40}$/);
const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Le jour existe-t-il au calendrier (30 février refusé, 29 février des années bissextiles permis) ? */
function jourExiste(a: number, m: number, j: number): boolean {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

const jour = z.string().refine((s) => {
  const m = JOUR.exec(s);
  return !!m && jourExiste(+m[1], +m[2], +m[3]);
}, "jour_vise : AAAA-MM-JJ existant");

/** Instant ISO 8601 AVEC décalage (« Z » ou ±HH:MM), existant. */
const instant = z.string().refine((s) => {
  const m = INSTANT.exec(s);
  if (!m || !jourExiste(+m[1], +m[2], +m[3]) || +m[4] > 23 || +m[5] > 59 || +(m[6] ?? 0) > 59) return false;
  return !Number.isNaN(Date.parse(s));
}, "instant ISO avec décalage");

const compteDe = (r: string) => `${r}:`;

/** Jour (AAAA-MM-JJ) d'un instant, à Paris. */
export function jourDeParis(instantMs: number): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instantMs));
}

const ligneProposition = z
  .object({
    cle,
    jour_vise: jour,
    type_contenu: typeProposable,
    reseau,
    compte: z.string().min(3).max(120),
    due_at: instant,
    format_id: z.string().min(1).max(60).optional(),
    signature: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((l) => l.compte.startsWith(compteDe(l.reseau)) && l.compte.length > compteDe(l.reseau).length, { message: "compte : <reseau>:<identifiant>", path: ["compte"] })
  .refine((l) => !Number.isNaN(Date.parse(l.due_at)) && jourDeParis(Date.parse(l.due_at)) === l.jour_vise, { message: "jour_vise doit être le jour de Paris de due_at", path: ["jour_vise"] });

const corpsProposition = z
  .object({
    contrat: z.literal(CONTRAT_CALENDRIER_PROPOSITION),
    repere,
    propositions: z.array(ligneProposition).min(1).max(MAX_PROPOSITIONS),
  })
  .strict()
  .refine((c) => new Set(c.propositions.map((p) => p.cle)).size === c.propositions.length, { message: "clés en double", path: ["propositions"] });

export type PropositionCalendrier = z.infer<typeof corpsProposition>;
export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string };

function lire<T>(schema: z.ZodType<T>, corps: unknown): Resultat<T> {
  const r = schema.safeParse(corps);
  if (r.success) return { ok: true, valeur: r.data };
  const i = r.error.issues[0];
  return { ok: false, erreur: `${i.path.join(".") || "corps"} : ${i.message}` };
}

/** Lit une proposition de l'usine. Une date ne passe que STRICTEMENT dans le futur de `maintenant` (limite exacte refusée). */
export function lirePropositionCalendrier(corps: unknown, maintenant: Date): Resultat<PropositionCalendrier> {
  const t = maintenant.getTime();
  if (Number.isNaN(t)) return { ok: false, erreur: "horloge illisible" };
  const schema = corpsProposition.superRefine((c, ctx) => {
    c.propositions.forEach((p, i) => {
      if (Date.parse(p.due_at) <= t) ctx.addIssue({ code: "custom", message: "due_at dans le passé", path: ["propositions", i, "due_at"] });
    });
  });
  return lire(schema, corps);
}

const STATUTS = STATUTS_PLAN as readonly [string, ...string[]];
const ligneReponse = z
  .object({
    cle,
    decision: z.enum(["accepte", "refuse", "decale"]),
    statut: z.enum(STATUTS as [string, ...string[]]),
    due_at: instant.optional(),
    motif: z.string().max(MAX_MOTIF).optional(),
  })
  .strict()
  .refine((l) => l.decision !== "decale" || !!l.due_at, { message: "due_at requis pour un décalage", path: ["due_at"] });

const corpsReponse = z
  .object({
    contrat: z.literal(CONTRAT_CALENDRIER_REPONSE),
    repere,
    reponses: z.array(ligneReponse).min(1).max(MAX_PROPOSITIONS),
  })
  .strict();
export type ReponseCalendrier = z.infer<typeof corpsReponse>;

/** Lit la réponse du Studio : le statut est un des sept statuts du plan (le Studio seul écrit programme, publie, echec). */
export function lireReponseCalendrier(corps: unknown): Resultat<ReponseCalendrier> {
  return lire(corpsReponse, corps);
}

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const cadenceReseau = z
  .object({
    heures: z.array(heure).max(24).refine((h) => new Set(h).size === h.length, "heures en double"),
    quota_par_jour: z.number().int().min(0).max(20),
    ecart_min_minutes: z.number().int().min(0).max(1440),
  })
  .strict();
const objectif = z.object({ quantite: z.number().int().min(0).max(100), periode: z.enum(["jour", "semaine"]) }).strict();

const corpsCadence = z
  .object({
    contrat: z.literal(CONTRAT_CALENDRIER_REPONSE),
    reseaux: z.partialRecord(reseau, cadenceReseau),
    objectifs: z.object({ video: objectif.optional(), carrousel: objectif.optional(), image: objectif.optional() }).strict(),
  })
  .strict();
export type CadenceUsine = z.infer<typeof corpsCadence>;

/** Lit la cadence de l'usine : des quantités et des heures, jamais un montant. */
export function lireCadenceUsine(corps: unknown): Resultat<CadenceUsine> {
  return lire(corpsCadence, corps);
}
