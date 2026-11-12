/**
 * Porte v2, calendrier : schémas PropositionCalendrier, ReponseCalendrier et CadenceUsine (L6-01). PUR : ni réseau,
 * ni secret, ni horloge cachée (« maintenant » est passé en argument). Alignés sur le contrat d'échange de l'usine,
 * § 3 quater (appels 4 et 5). L'usine ne fait que proposer : ces schémas refusent tout champ d'état, toute valeur
 * « programmee », « publiee » ou « echec » et tout nom de diffuseur. Quantités seulement : aucun montant.
 */
import { z } from "zod";
import type { IdReseau } from "./types";
import { TYPES_CONTENU_USINE } from "./usine";

/** Les six réseaux du contrat ; YouTube est prêt mais éteint. */
export const RESEAUX_CALENDRIER: ReadonlyArray<{ id: IdReseau; allume: boolean }> = [
  { id: "linkedin", allume: true },
  { id: "instagram", allume: true },
  { id: "facebook", allume: true },
  { id: "tiktok", allume: true },
  { id: "youtube", allume: false },
  { id: "youtube-shorts", allume: false },
];

export type CodeErreurCalendrier = "champ_invalide" | "reseau_inconnu" | "reseau_eteint" | "type_inactif";
export type ErreurCalendrier = { ok: false; statut: 400 | 409 | 422; code: CodeErreurCalendrier; champ?: string };
export type ResultatLecture<T> = { ok: true; valeur: T } | ErreurCalendrier;

const STATUT: Record<CodeErreurCalendrier, 400 | 409 | 422> = { champ_invalide: 400, reseau_inconnu: 422, reseau_eteint: 409, type_inactif: 422 };

/** Valeurs d'état que l'usine n'écrit jamais, et noms de diffuseurs : refusés partout dans un corps. */
const VALEURS_INTERDITES = /^(programmee|publiee|echec)$/i;
const DIFFUSEURS = /zernio|buffer|hootsuite|later\.com/i; // CLÉS seulement
const VALEUR_DIFFUSEUR = /^(zernio|buffer|hootsuite|later(\.com)?)$/i; // valeurs : égalité exacte, pas de sous-chaîne
const CLES_ETAT = /^(etat|statut|status|state)$/i;
const CLES_MONTANT = /(eur|euro|cent|prix|montant|budget|cout|tarif)/i;

const DATE_ISO_AVEC_DECALAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Date locale (Europe/Paris) d'un instant ISO, AAAA-MM-JJ. */
export function jourParis(iso: string): string {
  return FORMAT_JOUR_PARIS.format(new Date(iso));
}

function champInterdit(corps: Record<string, unknown>): string | undefined {
  for (const [cle, valeur] of Object.entries(corps)) {
    if (CLES_ETAT.test(cle) || DIFFUSEURS.test(cle)) return cle;
    if (typeof valeur === "string" && (VALEURS_INTERDITES.test(valeur) || VALEUR_DIFFUSEUR.test(valeur))) return cle;
  }
  return undefined;
}

function dateValide(v: string): boolean {
  if (!DATE_ISO_AVEC_DECALAGE.test(v) || Number.isNaN(new Date(v).getTime())) return false;
  // Refuse le 31 février : le jour/mois/année écrits doivent redonner les mêmes à la relecture (en UTC, sans décalage).
  const [a, m, j] = v.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

function refuser(ctx: z.RefinementCtx, code: CodeErreurCalendrier, champ: string) {
  ctx.addIssue({ code: "custom", message: code, path: [champ], params: { code } });
}

function traduire(erreur: z.ZodError): ErreurCalendrier {
  const i = erreur.issues[0];
  const params = (i as { params?: { code?: CodeErreurCalendrier } }).params;
  if (params?.code) return { ok: false, statut: STATUT[params.code], code: params.code, champ: String(i.path[0] ?? "") || undefined };
  const champ = i.code === "unrecognized_keys" ? i.keys[0] : String(i.path[0] ?? "") || undefined;
  return { ok: false, statut: 400, code: "champ_invalide", champ };
}

function lire<T>(schema: z.ZodType<T>, corps: unknown): ResultatLecture<T> {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return { ok: false, statut: 400, code: "champ_invalide" };
  const interdit = champInterdit(corps as Record<string, unknown>);
  if (interdit) return { ok: false, statut: 400, code: "champ_invalide", champ: interdit };
  const r = schema.safeParse(corps);
  return r.success ? { ok: true, valeur: r.data } : traduire(r.error);
}

function verifierReseau(reseau: string, ctx: z.RefinementCtx, champ = "reseau"): IdReseau | undefined {
  const connu = RESEAUX_CALENDRIER.find((r) => r.id === reseau);
  if (!connu) return refuser(ctx, "reseau_inconnu", champ), undefined;
  return connu.id;
}

function verifierType(type: string, ctx: z.RefinementCtx, exigerActif: boolean) {
  const t = TYPES_CONTENU_USINE.find((x) => x.id === type);
  if (!t) return refuser(ctx, "champ_invalide", "type_contenu");
  if (exigerActif && !t.actif) refuser(ctx, "type_inactif", "type_contenu");
}

// ---------------------------------------------------------------------------------------------------------------
// PropositionCalendrier (appel 4)

export interface PropositionCalendrier {
  cle_proposition: string;
  reseau: IdReseau;
  compte: string;
  type_contenu: string;
  dueAt: string;
  jour_vise: string;
  origine: "usine";
}

function schemaProposition(maintenant: Date) {
  return z
    .strictObject({
      cle_proposition: z.string().regex(SHA256),
      reseau: z.string().min(1),
      compte: z.string().min(1),
      type_contenu: z.string().min(1),
      dueAt: z.string().refine(dateValide),
      jour_vise: z.string().regex(JOUR),
      origine: z.literal("usine"),
    })
    .superRefine((p, ctx) => {
      const reseau = verifierReseau(p.reseau, ctx);
      if (reseau && !RESEAUX_CALENDRIER.find((r) => r.id === reseau)?.allume) refuser(ctx, "reseau_eteint", "reseau");
      verifierType(p.type_contenu, ctx, true);
      if (!/^[a-z0-9-]+:[a-z0-9._-]+$/.test(p.compte) || p.compte.split(":")[0] !== p.reseau) refuser(ctx, "champ_invalide", "compte");
      if (new Date(p.dueAt).getTime() <= maintenant.getTime()) refuser(ctx, "champ_invalide", "dueAt");
      else if (p.jour_vise !== jourParis(p.dueAt)) refuser(ctx, "champ_invalide", "jour_vise");
    }) as unknown as z.ZodType<PropositionCalendrier>;
}

/** Lit une proposition : date passée, réseau inconnu ou éteint, type inactif, champ d'état ou de diffuseur → refus. */
export function lirePropositionCalendrier(corps: unknown, maintenant: Date): ResultatLecture<PropositionCalendrier> {
  return lire(schemaProposition(maintenant), corps);
}

// ---------------------------------------------------------------------------------------------------------------
// ReponseCalendrier (réponse de l'appel 4)

export interface EntreeCalendrier {
  cle_proposition: string;
  creneau_id: string;
  date_retenue: string;
  origine_date: "usine" | "fondateur";
  etat_validation: "propose" | "valide";
  avertissements: string[];
}
export interface ReponseCalendrier {
  commande_id: string;
  entrees: EntreeCalendrier[];
  deja: boolean;
}

const schemaEntree = z.strictObject({
  cle_proposition: z.string().regex(SHA256),
  creneau_id: z.string().min(1),
  date_retenue: z.string().refine(dateValide),
  origine_date: z.enum(["usine", "fondateur"]),
  etat_validation: z.enum(["propose", "valide"]),
  avertissements: z.array(z.string()),
});
const schemaReponse = z.strictObject({ commande_id: z.string().min(1), entrees: z.array(schemaEntree).max(10), deja: z.boolean() });

export function lireReponseCalendrier(corps: unknown): ResultatLecture<ReponseCalendrier> {
  return lire(schemaReponse, corps);
}

// ---------------------------------------------------------------------------------------------------------------
// CadenceUsine (appel 5) : des quantités, jamais d'argent

export interface QuotaUsine {
  reseau: IdReseau;
  type_contenu: string;
  periode: "jour" | "semaine";
  nombre: number;
}
export interface CadenceUsine {
  version: number;
  regle_le: string;
  quotas: QuotaUsine[];
}

const schemaQuota = z.strictObject({
  reseau: z.string().min(1),
  type_contenu: z.string().min(1),
  periode: z.enum(["jour", "semaine"]),
  nombre: z.number().int().min(0),
});
const schemaCadence = z
  .strictObject({ version: z.number().int().min(0), regle_le: z.string().refine(dateValide), quotas: z.array(schemaQuota).max(100) })
  .superRefine((c, ctx) => {
    for (const q of c.quotas) {
      verifierReseau(q.reseau, ctx, "quotas");
      verifierType(q.type_contenu, ctx, false);
    }
  }) as unknown as z.ZodType<CadenceUsine>;

/** Lit une cadence : tout champ inconnu (donc tout montant) est refusé en 400 champ_invalide. */
export function lireCadenceUsine(corps: unknown): ResultatLecture<CadenceUsine> {
  if (typeof corps === "object" && corps !== null && !Array.isArray(corps)) {
    const o = corps as Record<string, unknown>;
    const montant = (x: Record<string, unknown>) => Object.keys(x).find((k) => CLES_MONTANT.test(k) && !["periode", "regle_le"].includes(k));
    const quotas = Array.isArray(o.quotas) ? o.quotas : [];
    const trouve = montant(o) ?? quotas.map((q) => (typeof q === "object" && q !== null ? montant(q as Record<string, unknown>) : undefined)).find(Boolean);
    if (trouve) return { ok: false, statut: 400, code: "champ_invalide", champ: trouve };
  }
  return lire(schemaCadence, corps);
}
