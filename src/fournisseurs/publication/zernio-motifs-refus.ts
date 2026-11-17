/**
 * Motif FERMÉ d'un refus du service d'envoi (routes de la boîte de messages). Module pur : ne lève jamais, ne rend JAMAIS de texte.
 * Ordre : (1) codes Meta numériques, (2) table des sous-codes puis des codes, (3) code Zernio de la liste blanche,
 * (4) phrases connues cherchées sur une copie locale jamais rendue, (5) statut >= 500 -> erreur-serveur, sinon raison-inconnue.
 */
import { CODES_ZERNIO_CONNUS, type CodeMotifRefus, type CodeZernioConnu, type RaisonRefus } from "@/domaine/guide-reseau/raison-refus";

export type MotifInbox = Pick<RaisonRefus, "motif" | "meta" | "codeZernio">;

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const COPIE_MAX = 2000;

function entierMeta(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 1 && v <= 999_999_999 ? v : null;
  if (typeof v === "string" && /^\d{1,9}$/.test(v)) {
    const n = Number(v);
    return n >= 1 ? n : null;
  }
  return null;
}

function lireMeta(corps: unknown): { code: number; sousCode: number | null } | null {
  if (!estObjet(corps)) return null;
  const details = estObjet(corps.details) ? corps.details : {};
  const sources = [corps.platformError, details.platformError, corps.error].filter(estObjet);
  for (const s of sources) {
    const code = entierMeta(s.code);
    if (code !== null) return { code, sousCode: entierMeta(s.error_subcode ?? s.errorSubcode) };
  }
  return null;
}

const SOUS_CODES: Readonly<Record<number, CodeMotifRefus>> = {
  2534041: "messagerie-instagram-desactivee",
  2534024: "fenetre-7-jours-depassee", 2534022: "fenetre-7-jours-depassee", 2018278: "fenetre-7-jours-depassee",
  2534023: "reponse-privee-deja-envoyee",
  2534025: "commentaire-non-eligible",
  2534014: "auteur-introuvable",
  1545041: "personne-injoignable", 2018108: "personne-injoignable",
  2534066: "reponse-privee-declinee",
  2018028: "droits-manquants", 1404170: "droits-manquants",
  1893063: "envoi-restreint-temporairement",
  2018300: "autre-application-aux-commandes",
};
const CODES_META: Readonly<Record<number, CodeMotifRefus>> = {
  10900: "reponse-privee-deja-envoyee",
  10903: "auteur-page-ou-confidentialite",
  551: "personne-injoignable",
  200: "droits-manquants", 230: "droits-manquants",
  190: "jeton-expire-ou-invalide",
  613: "limite-meta",
};

function motifParNombres(m: { code: number; sousCode: number | null }): CodeMotifRefus | null {
  if (m.sousCode !== null && SOUS_CODES[m.sousCode]) return SOUS_CODES[m.sousCode];
  if (m.code === 2 && m.sousCode === 1545133) return "elements-refuses-non-abonne";
  if (m.code === 100 && m.sousCode === 33) return "commentaire-introuvable";
  return CODES_META[m.code] ?? null;
}

function codeZernioDe(corps: unknown): CodeZernioConnu | null {
  if (!estObjet(corps)) return null;
  const d = estObjet(corps.details) ? corps.details : {};
  const e = estObjet(corps.error) ? corps.error : {};
  for (const v of [corps.code, corps.error, d.code, e.type, e.code]) {
    if (typeof v === "string" && (CODES_ZERNIO_CONNUS as readonly string[]).includes(v)) return v as CodeZernioConnu;
  }
  return null;
}

// Expressions simples, sans quantificateur imbriqué ; bornes `{0,40}` pour le motif « permission ».
const PHRASES: ReadonlyArray<[RegExp, CodeMotifRefus]> = [
  [/messages? disabled in (the )?settings|has messages disabled/, "messagerie-desactivee-sur-la-page"],
  [/disabled access to instagram direct messages/, "messagerie-instagram-desactivee"],
  [/outside (of )?(the )?allowed window|older than 7 days/, "fenetre-7-jours-depassee"],
  [/already replied/, "reponse-privee-deja-envoyee"],
  [/invalid for a private reply|not eligible/, "commentaire-non-eligible"],
  [/no matching user/, "auteur-introuvable"],
  [/isn'?t (receiving messages from you|available) right now|can'?t receive your messages/, "personne-injoignable"],
  [/declined/, "reponse-privee-declinee"],
  [/does not have permission|requires .{0,40}permission|permissions error/, "droits-manquants"],
  [/access token|session has expired/, "jeton-expire-ou-invalide"],
  [/does not exist|has been deleted/, "commentaire-introuvable"],
  [/temporarily restricted/, "envoi-restreint-temporairement"],
  [/account not found/, "compte-zernio-introuvable"],
];

/** Copie locale, JAMAIS rendue : `error`, `message`, `platformError.message`, ou le corps s'il est une chaîne. */
function copieLocale(corps: unknown): string {
  const morceaux: string[] = [];
  const ajouter = (v: unknown) => {
    if (typeof v === "string") morceaux.push(v.slice(0, COPIE_MAX));
  };
  if (typeof corps === "string") ajouter(corps);
  else if (estObjet(corps)) {
    ajouter(corps.error);
    if (estObjet(corps.error)) ajouter(corps.error.message);
    ajouter(corps.message);
    if (estObjet(corps.details)) ajouter(corps.details.message);
    if (estObjet(corps.platformError)) ajouter(corps.platformError.message);
    if (estObjet(corps.details) && estObjet(corps.details.platformError)) ajouter(corps.details.platformError.message);
  }
  return morceaux.join(" ").slice(0, COPIE_MAX).toLowerCase().replace(/\s+/g, " ");
}

export function motifRefusInbox(statut: number, corps: unknown): MotifInbox {
  try {
    const meta = lireMeta(corps);
    const codeZernio = codeZernioDe(corps);
    const fin = (motif: CodeMotifRefus): MotifInbox => ({ motif, meta, codeZernio });
    if (meta) {
      const m = motifParNombres(meta);
      if (m) return fin(m);
    }
    if (codeZernio === "INBOX_REQUIRED") return fin("inbox-zernio-requise");
    if (codeZernio === "message_allowance_exceeded") return fin("quota-messages-zernio");
    const copie = copieLocale(corps);
    for (const [re, motif] of PHRASES) if (re.test(copie)) return fin(motif);
    if (statut === 404) return fin("compte-zernio-introuvable");
    return fin(statut >= 500 ? "erreur-serveur" : "raison-inconnue");
  } catch {
    return { motif: "raison-inconnue", meta: null, codeZernio: null };
  }
}

export function motifReseau(nomErreur: string): MotifInbox {
  return { motif: nomErreur === "TimeoutError" || nomErreur === "AbortError" ? "delai-depasse" : "coupure-reseau", meta: null, codeZernio: null };
}
