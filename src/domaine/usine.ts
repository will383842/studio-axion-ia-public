/** Idées de l'usine : types et filtres partagés (serveur et écran). PUR : ni secret, ni réseau. */
import { z } from "zod";

export const TYPES_CONTENU_USINE = [
  { id: "video", libelle: "Vidéo", actif: true },
  { id: "carrousel", libelle: "Carrousel", actif: false },
  { id: "image", libelle: "Infographie", actif: false },
  { id: "texte", libelle: "Texte", actif: false },
] as const;
export type TypeContenuUsine = "video" | "carrousel" | "image" | "texte" | "story";

export const TAILLES_USINE = [
  { id: "TPE", libelle: "TPE" },
  { id: "PME", libelle: "PME" },
  { id: "ETI", libelle: "ETI" },
  { id: "GE", libelle: "Grande entreprise" },
] as const;

/** Nombre d'idées par demande. */
export const NB_IDEES_USINE = 5;

export interface FiltresUsine {
  type: TypeContenuUsine;
  reseaux: string[];
  metiers: string[];
  tailles: string[];
}

export interface MetierUsine {
  code: string;
  libelle: string;
  secteur?: string;
  allume: boolean;
  nbCas: number;
}

/** Une ligne rendue par l'usine : les codes (à garder) et les textes lisibles (à montrer). */
export interface IdeeUsine {
  signature: string;
  parts: Record<string, string | null>;
  metier: string;
  taille: string;
  service?: string;
  douleur: string;
  casUsage: string;
  sujet?: string;
  format?: string;
  famille?: string;
  fin?: string;
}

/** Une idée retenue (ou écartée) par le comité éditorial, prête à montrer : la raison du comité en plus. */
export interface IdeeDuComite extends IdeeUsine {
  raison: string;
}

/** Ce que le comité montre dans « Idées de l'usine ». Vide : affichage inchangé (idées brutes de la porte). */
export interface IdeesDuComite {
  retenues: IdeeDuComite[];
  ecartees: IdeeDuComite[];
}

/** Une idée jugée (textes de la combinaison de l'usine) remise sous la forme d'une carte « Idées de l'usine ». */
export function ideeDuComite(j: { signature: string; parts?: Record<string, string | null>; idee: string; textes: Record<string, string>; raison: string }): IdeeDuComite {
  const t = j.textes;
  return {
    signature: j.signature,
    parts: j.parts ?? {},
    metier: t.metier ?? "",
    taille: t.taille ?? "",
    service: t.service,
    // Sans douleur : le cas d'usage, sinon le sujet, en tête (comme à la lecture de la porte).
    douleur: t.douleur || t.casUsage || t.sujet || j.idee,
    casUsage: t.douleur ? (t.casUsage ?? "") : "",
    sujet: t.sujet,
    format: t.format,
    famille: t.familleAccroche,
    fin: t.fin,
    raison: j.raison,
  };
}

/**
 * Le bouton « Écrire » d'une idée jugée est-il offert ? Non si elle n'a pas de `parts` (rien à renvoyer à l'Usine), ou si
 * l'Usine ne l'offre plus : signature absente de la dernière réponse de la porte ET combinaison couverte par cette réponse
 * (`couverte`, voir `perimetreCouvre`). Hors du périmètre de la réponse (filtrée), ou tant que la porte n'a pas répondu
 * (`offertes` absent), on ne sait rien : seule l'absence de `parts` retire le bouton. PUR.
 */
export function boutonEcrireOffert(idee: Pick<IdeeUsine, "signature" | "parts">, offertes?: ReadonlySet<string>, couverte = true): boolean {
  if (!idee.parts || Object.keys(idee.parts).length === 0) return false;
  return !offertes || !couverte || offertes.has(idee.signature);
}

/**
 * La réponse de la porte (filtrée par métiers et tailles) couvrait-elle la combinaison de ces `parts` ? Oui si, pour chaque
 * filtre non vide, `parts.metier` / `parts.taille` y figure ; une part absente ou nulle sous un filtre actif : on ne sait pas. PUR.
 */
export function perimetreCouvre(parts: Record<string, string | null> | undefined, filtres: { metiers: readonly string[]; tailles: readonly string[] }): boolean {
  const dans = (cle: "metier" | "taille", choix: readonly string[]) => {
    if (choix.length === 0) return true;
    const v = parts?.[cle];
    return typeof v === "string" && choix.includes(v);
  };
  return dans("metier", filtres.metiers) && dans("taille", filtres.tailles);
}

/** Ce que le sujet garde de l'usine (champ `origineUsine`). */
export interface OrigineUsine {
  signature: string;
  parts: Record<string, string | null>;
  typeContenu: TypeContenuUsine;
}

const texte = z.string().trim();
const txt = z.string().nullish().transform((v) => v?.trim() || undefined);
const objet = <T extends z.ZodRawShape>(forme: T) => z.object(forme).nullish().transform((v) => v ?? undefined);

/** Les parts sont gardées TELLES QUELLES (null compris) : `retenir` doit les renvoyer à l'identique. */
const parts = z.record(z.string(), z.string().nullable());

/** Forme réelle d'une ligne de `POST /api/porte/sujets` (docs/CONTRAT-PORTE.md de l'usine). Les textes sont facultatifs. */
const ligne = z.object({
  signature: texte.min(1),
  parts,
  metier: objet({ code: z.string(), libelle: txt }),
  taille: objet({ code: z.string(), libelle: txt }),
  service: objet({ code: z.string(), libelle: txt }),
  douleur: objet({ code: z.string(), dite: txt }),
  cas_usage: objet({ code: z.string(), titre: txt, ce_que_ca_change: txt }),
  sujet: objet({ code: z.string(), titre: txt }),
  actualite: objet({ code: z.string(), titre: txt, ce_qui_change: txt }),
  format: objet({ code: z.string(), libelle: txt }),
  accroche: objet({ code: z.string(), famille: txt }),
  fins: z.record(z.string(), z.object({ dit: txt }).nullish()).nullish(),
});

/** Lit la réponse de /sujets. Seule une ligne sans douleur, sans cas d'usage ET sans nouveauté n'est pas montrée. */
export function lireIdeesUsine(corps: unknown): IdeeUsine[] {
  const brut = corps && typeof corps === "object" && Array.isArray((corps as { lignes?: unknown }).lignes) ? (corps as { lignes: unknown[] }).lignes : [];
  const sortie: IdeeUsine[] = [];
  for (const b of brut) {
    const l = ligne.safeParse(b);
    if (!l.success) continue;
    const d = l.data;
    if (!d.douleur && !d.cas_usage && !d.actualite) continue;
    // Nouveauté : douleur et cas valent null, le texte vient de l'actualité.
    // Cas d'usage sans douleur reliée (Usine #23) : le texte de tête est le titre du cas, sinon le sujet.
    const sansDouleur = !d.douleur?.dite && !d.actualite?.titre;
    const douleur = d.douleur?.dite ?? d.actualite?.titre ?? d.cas_usage?.titre ?? d.sujet?.titre;
    const casUsage = (sansDouleur ? d.cas_usage?.ce_que_ca_change : [d.cas_usage?.titre, d.cas_usage?.ce_que_ca_change].filter(Boolean).join(" · ")) || d.actualite?.ce_qui_change || "";
    if (!douleur) continue;
    const fins = Object.values(d.fins ?? {}).map((f) => f?.dit).filter((x): x is string => !!x);
    sortie.push({
      signature: d.signature,
      parts: d.parts,
      metier: d.metier?.libelle ?? d.metier?.code ?? "",
      taille: d.taille?.libelle ?? d.taille?.code ?? "",
      service: d.service?.libelle,
      douleur,
      casUsage,
      sujet: d.sujet?.titre,
      format: d.format?.libelle ?? d.format?.code,
      famille: d.accroche?.famille,
      fin: fins.length ? [...new Set(fins)].join(" · ") : undefined,
    });
  }
  return sortie;
}

const ligneMetier = z.object({
  code: texte.min(1),
  libelle: txt,
  secteur: z.object({ code: txt, libelle: txt }).nullish(),
  allume: z.boolean().default(false),
  cas_sources: z.number().default(0),
});

export function lireMetiersUsine(corps: unknown): MetierUsine[] {
  const brut = corps && typeof corps === "object" && Array.isArray((corps as { metiers?: unknown }).metiers) ? (corps as { metiers: unknown[] }).metiers : [];
  const sortie: MetierUsine[] = [];
  for (const b of brut) {
    const m = ligneMetier.safeParse(b);
    if (m.success) sortie.push({ code: m.data.code, libelle: m.data.libelle ?? m.data.code, secteur: m.data.secteur?.libelle ?? m.data.secteur?.code, allume: m.data.allume, nbCas: m.data.cas_sources });
  }
  return sortie;
}
