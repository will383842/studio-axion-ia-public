/**
 * Porte du Studio, contrat calendrier (contrat 2) : schémas zod PropositionCalendrier, ReponseCalendrier et CadenceUsine,
 * alignés sur le document de contrat (CONTRATS-ECHANGE, § 3 quater, appels 4 et 5). PUR : ni réseau, ni secret, ni
 * horloge cachée (l'instant « maintenant » est toujours passé en argument).
 * L'usine PROPOSE ; seul le Studio programme, publie ou constate un échec. Aucun montant : des quantités seulement.
 * Les heures, plages et écarts de publication restent des réglages du Studio : ils n'entrent pas dans la cadence.
 * Les listes (réseaux, types actifs) sont LUES chez leur source, jamais recopiées.
 */
import { z } from "zod";
import { RESEAUX_TAXONOMIE } from "./taxonomie-contenu";
import { TYPES_CONTENU_USINE } from "./usine";
import type { IdReseau } from "./types";

/** Niveau du contrat des appels 4 et 5 (et de leurs réponses). Toute autre valeur : 426 contrat_inconnu. */
export const CONTRAT_CALENDRIER = 2;

/** Codes de refus de la liste « Erreurs stables » du contrat qui touchent ces trois schémas, et leur statut HTTP. */
export const CODES_REFUS_CALENDRIER = {
  champ_invalide: 400,
  reseau_inconnu: 422,
  type_inactif: 422,
  contrat_inconnu: 426,
  version_perimee: 409,
} as const;
export type CodeRefusCalendrier = keyof typeof CODES_REFUS_CALENDRIER;

export const RESEAUX_CALENDRIER: readonly IdReseau[] = RESEAUX_TAXONOMIE;
/** Seuls les types ACTIFS de l'usine se proposent (carrousel, image, texte, story : refusés tant qu'ils sont inactifs). */
export const TYPES_PROPOSABLES: readonly string[] = TYPES_CONTENU_USINE.filter((t) => t.actif).map((t) => t.id);
const TYPES_CONNUS: readonly string[] = TYPES_CONTENU_USINE.map((t) => t.id);

/** Le document : « PropositionCalendrier[] (1 à 10) ». */
export const MAX_PROPOSITIONS = 10;

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const EMPREINTE = /^[0-9a-f]{64}$/;

/** Le jour existe-t-il au calendrier (30 février refusé, 29 février des années bissextiles permis) ? */
function jourExiste(a: number, m: number, j: number): boolean {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

const jour = z.string().refine((s) => {
  const m = JOUR.exec(s);
  return !!m && jourExiste(+m[1], +m[2], +m[3]);
}, "AAAA-MM-JJ existant");

/** Instant ISO 8601 AVEC décalage (« Z » ou ±HH:MM), existant. */
const instant = z.string().refine((s) => {
  const m = INSTANT.exec(s);
  if (!m || !jourExiste(+m[1], +m[2], +m[3]) || +m[4] > 23 || +m[5] > 59 || +(m[6] ?? 0) > 59) return false;
  return !Number.isNaN(Date.parse(s));
}, "instant ISO avec décalage");

/** Liste fermée dont la sortie de liste porte un code de refus propre (422), pas le 400 général. */
const listeFermee = (valeurs: readonly string[], code: CodeRefusCalendrier, nom: string) =>
  z.string().superRefine((v, ctx) => {
    if (!valeurs.includes(v)) ctx.addIssue({ code: "custom", message: `${nom} : « ${v} » refusé`, params: { code } });
  });
const reseau = listeFermee(RESEAUX_CALENDRIER, "reseau_inconnu", "reseau");
const identifiant = z.string().min(1).max(120);

/** Jour (AAAA-MM-JJ) d'un instant, à Paris. */
export function jourDeParis(instantMs: number): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instantMs));
}

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string; code: CodeRefusCalendrier; http: number };

/** `absentPermis` : les corps reçus (appels 4 et 5) portent `contrat: 2` ; absent ou autre : 426. Une réponse émise n'en porte pas (absent permis, présent et autre : 426). */
function lire<T>(schema: z.ZodType<T>, corps: unknown, absentPermis = false): Resultat<T> {
  // Contrat inconnu ou absent : 426 avant tout autre contrôle (document de contrat, § 1). Un corps qui n'est pas un objet reste invalide (400).
  if (corps && typeof corps === "object" && !Array.isArray(corps) && (absentPermis ? "contrat" in corps : true) && (corps as { contrat?: unknown }).contrat !== CONTRAT_CALENDRIER) {
    return { ok: false, erreur: "contrat : absent ou valeur inconnue", code: "contrat_inconnu", http: CODES_REFUS_CALENDRIER.contrat_inconnu };
  }
  const r = schema.safeParse(corps);
  if (r.success) return { ok: true, valeur: r.data };
  const i = r.error.issues[0];
  const code = ((i as { params?: { code?: CodeRefusCalendrier } }).params?.code ?? "champ_invalide") as CodeRefusCalendrier;
  return { ok: false, erreur: `${i.path.join(".") || "corps"} : ${i.message}`, code, http: CODES_REFUS_CALENDRIER[code] };
}

/* ------------------------------ Appel 4 : proposition ------------------------------ */

const ligneProposition = z
  .object({
    cle_proposition: z.string().regex(EMPREINTE, "sha256 en 64 signes hexadécimaux"),
    reseau,
    compte: identifiant,
    type_contenu: listeFermee(TYPES_PROPOSABLES, "type_inactif", "type_contenu"),
    dueAt: instant,
    jour_vise: jour,
    origine: z.literal("usine"),
  })
  .strict()
  .refine((l) => !Number.isNaN(Date.parse(l.dueAt)) && jourDeParis(Date.parse(l.dueAt)) === l.jour_vise, { message: "jour_vise doit être la date locale (Paris) de dueAt", path: ["jour_vise"] });

const corpsProposition = z
  .object({
    contrat: z.literal(CONTRAT_CALENDRIER),
    propositions: z.array(ligneProposition).min(1).max(MAX_PROPOSITIONS),
  })
  .strict()
  .refine((c) => new Set(c.propositions.map((p) => p.cle_proposition)).size === c.propositions.length, { message: "cle_proposition en double", path: ["propositions"] });

export type PropositionCalendrier = z.infer<typeof corpsProposition>;

/** Lit une proposition de l'usine. Une date ne passe que STRICTEMENT dans le futur de `maintenant` (limite exacte refusée). */
export function lirePropositionCalendrier(corps: unknown, maintenant: Date): Resultat<PropositionCalendrier> {
  const t = maintenant.getTime();
  if (Number.isNaN(t)) return { ok: false, erreur: "horloge illisible", code: "champ_invalide", http: 400 };
  const schema = corpsProposition.superRefine((c, ctx) => {
    c.propositions.forEach((p, i) => {
      if (Date.parse(p.dueAt) <= t) ctx.addIssue({ code: "custom", message: "dueAt dans le passé", path: ["propositions", i, "dueAt"] });
    });
  });
  return lire(schema, corps);
}

/* ------------------------- Réponse de l'appel 4 : ReponseCalendrier ------------------------- */

const entreeReponse = z
  .object({
    cle_proposition: z.string().regex(EMPREINTE, "sha256 en 64 signes hexadécimaux"),
    creneau_id: identifiant,
    date_retenue: instant,
    // « usine », ou l'identifiant que le contrat donne au fondateur (non écrit ici : dépôt public) : texte non vide.
    origine_date: z.string().min(1).max(40),
    etat_validation: z.string().min(1).max(60),
    avertissements: z.array(z.string().min(1)),
  })
  .strict();

const corpsReponse = z
  .object({
    commande_id: identifiant,
    entrees: z.array(entreeReponse).min(1).max(MAX_PROPOSITIONS),
    deja: z.boolean(),
  })
  .strict();
export type ReponseCalendrier = z.infer<typeof corpsReponse>;

/** Lit la réponse du Studio : un créneau par cle_proposition, d'origine usine ou choisie par le fondateur. */
export function lireReponseCalendrier(corps: unknown): Resultat<ReponseCalendrier> {
  return lire(corpsReponse, corps, true);
}

/* ------------------------------- Appel 5 : cadence ------------------------------- */

const quota = z
  .object({
    reseau,
    type_contenu: listeFermee(TYPES_CONNUS, "champ_invalide", "type_contenu"),
    periode: z.enum(["jour", "semaine"]),
    nombre: z.number().int().min(0),
  })
  .strict();

const corpsCadence = z
  .object({
    contrat: z.literal(CONTRAT_CALENDRIER),
    cadence: z.object({ version: z.number().int().min(0), regle_le: instant, quotas: z.array(quota) }).strict(),
  })
  .strict();
export type CadenceUsine = z.infer<typeof corpsCadence>;

/** Lit la cadence de l'usine : des quantités seulement, jamais un montant ni une heure. */
export function lireCadenceUsine(corps: unknown): Resultat<CadenceUsine> {
  return lire(corpsCadence, corps);
}

/** Version reçue face à la dernière gardée : « nouvelle », « deja » (200 deja: true) ou « perimee » (409 version_perimee). */
export function comparerVersionCadence(derniere: number | null, recue: number): "nouvelle" | "deja" | "perimee" {
  if (derniere === null || recue > derniere) return "nouvelle";
  return recue === derniere ? "deja" : "perimee";
}
