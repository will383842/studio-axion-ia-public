/**
 * MOTS (PV-3) · textes d'un mot. PUR, aucun texte écrit en dur : les textes viennent d'un fichier `mots/<MOT>.md` ou d'une
 * saisie de l'opérateur. Un texte n'est utilisable que si l'état est « validé par l'opérateur » ET si l'empreinte validée
 * correspond au texte actuel (modifier un texte annule la validation). Aucune adresse e-mail, aucun nom de personne.
 */
import { createHash } from "node:crypto";

export const ETAT_VALIDE = "valide_par_operateur" as const;
export type EtatTextes = "brouillon" | typeof ETAT_VALIDE;
export const SECTIONS = ["reponse_publique", "message_prive", "relance", "fin"] as const;
export type Section = (typeof SECTIONS)[number];
/** Sections obligatoires : la relance est facultative (l'ADR-0005 prévoit « jamais de relance » par défaut). */
export const SECTIONS_OBLIGATOIRES: readonly Section[] = ["reponse_publique", "message_prive", "fin"];
export const RE_MOT = /^[A-Z0-9]{2,20}$/;

export interface TextesMot {
  mot: string;
  reponsePublique: string;
  messagePrive: string;
  relance: string | null;
  fin: string;
  etat: EtatTextes;
  /** Empreinte posée par l'opérateur au moment de la validation (absente = jamais validé). */
  empreinteValidee: string | null;
}

/** Saisie de l'opérateur : ni état ni empreinte (la validation est un geste serveur distinct, empreinte enregistrée en base). */
export interface SaisieMot {
  mot: string;
  reponsePublique: string;
  messagePrive: string;
  relance?: string | null;
  fin: string;
}

/** Empreinte des seuls textes (pas de l'état) : sert à détecter qu'un texte a changé depuis la validation. */
export function empreinteTextes(t: Pick<TextesMot, "mot" | "reponsePublique" | "messagePrive" | "relance" | "fin">): string {
  return createHash("sha256").update(JSON.stringify([t.mot, t.reponsePublique, t.messagePrive, t.relance, t.fin])).digest("hex");
}

/** Le texte est-il validé ET inchangé depuis la validation ? */
export function textesValides(t: TextesMot): boolean {
  return t.etat === ETAT_VALIDE && t.empreinteValidee !== null && t.empreinteValidee === empreinteTextes(t);
}

const normaliserEtat = (v: string): EtatTextes => {
  const n = v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "'").trim();
  return n === "valide par l'operateur" ? ETAT_VALIDE : "brouillon";
};

/**
 * Lit un fichier `mots/<MOT>.md` :
 *   etat: validé par l'opérateur        (tout autre état = brouillon)
 *   validation: <empreinte>              (posée par le geste de validation)
 *   ## reponse_publique / ## message_prive / ## relance / ## fin
 * Section absente ou vide = refus (sauf relance). Jamais d'exception : un résultat clair.
 */
export function lireTextesMarkdown(mot: string, markdown: string): { ok: true; textes: TextesMot } | { ok: false; raison: string } {
  const m = mot.trim().toUpperCase();
  if (!RE_MOT.test(m)) return { ok: false, raison: "mot_invalide" };
  const sections = new Map<string, string[]>();
  const meta = new Map<string, string>();
  let courante: string | null = null;
  for (const ligne of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const titre = /^##\s+([a-z_]+)\s*$/.exec(ligne);
    if (titre) {
      courante = titre[1];
      sections.set(courante, []);
      continue;
    }
    if (courante) sections.get(courante)!.push(ligne);
    else {
      const kv = /^(etat|validation)\s*:\s*(.*)$/i.exec(ligne);
      if (kv) meta.set(kv[1].toLowerCase(), kv[2].trim());
    }
  }
  const texte = (s: Section): string => (sections.get(s) ?? []).join("\n").trim();
  for (const s of SECTIONS_OBLIGATOIRES) if (!texte(s)) return { ok: false, raison: `section_absente:${s}` };
  return {
    ok: true,
    textes: {
      mot: m,
      reponsePublique: texte("reponse_publique"),
      messagePrive: texte("message_prive"),
      relance: texte("relance") || null,
      fin: texte("fin"),
      etat: normaliserEtat(meta.get("etat") ?? ""),
      empreinteValidee: meta.get("validation") || null,
    },
  };
}

/** Saisie de l'opérateur : brouillon tant qu'il n'a pas validé (la validation est un geste distinct). */
export function textesDepuisSaisie(saisie: { mot: string; reponsePublique: string; messagePrive: string; relance?: string | null; fin: string }): TextesMot {
  return {
    mot: saisie.mot.trim().toUpperCase(),
    reponsePublique: saisie.reponsePublique.trim(),
    messagePrive: saisie.messagePrive.trim(),
    relance: saisie.relance?.trim() || null,
    fin: saisie.fin.trim(),
    etat: "brouillon",
    empreinteValidee: null,
  };
}

/** Geste de validation de l'opérateur : fige l'empreinte des textes tels qu'il les a relus. PUR (l'appelant exige la session). */
export function validerTextes(t: TextesMot): TextesMot {
  return { ...t, etat: ETAT_VALIDE, empreinteValidee: empreinteTextes(t) };
}
