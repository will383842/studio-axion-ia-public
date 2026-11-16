/**
 * C9-04 — garde d'honnêteté des petits objets (côté Studio, jamais lue par le rendu).
 * Un nombre affiché est un nombre DIT dans la plage, ou saisi avec sa source ; un texte est une suite contiguë de mots dits.
 * Pure, sans exception. Rien ne l'appelle encore (C9-36).
 */
import { MOTS_MAX, type DefinitionObjet } from "../motion/petits-objets/contrat";
import { nombresDits } from "../plan-scenes/controles";
import type { MotMinute } from "../plan-scenes/schema";

export interface ContexteGarde {
  mots: readonly MotMinute[];
  premier: number;
  dernier: number;
  saisies?: { valeur: number; source: string }[];
}
export type VerdictGarde = "ok" | { refus: string };

const nu = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const jetons = (s: string): string[] => nu(s).split(" ").filter(Boolean);
const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function suiteContigue(texte: readonly string[], dits: readonly string[]): boolean {
  if (texte.length === 0) return false;
  for (let i = 0; i + texte.length <= dits.length; i++) if (texte.every((t, k) => dits[i + k] === t)) return true;
  return false;
}

/** Un nombre écrit : des groupes de chiffres séparés par une espace (« 49 505 », « 2 20 ») = un seul nombre, espaces ôtées ; dans le doute, on refuse. */
const NOMBRE_ECRIT = /\d+(?:[ \u00a0\u202f]\d+)*(?:[.,]\d+)?/g;
const COCHE = /[\u2713\u2714\u2705\u2611]/;

/** Toutes les chaînes d'une valeur (hors preuve, commande et marque illustration). */
function chainesDe(v: unknown, prof = 0): string[] {
  if (prof > 8) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap((x) => chainesDe(x, prof + 1));
  if (estObjet(v)) return Object.entries(v).filter(([k]) => k !== "preuve" && k !== "commande").flatMap(([, x]) => chainesDe(x, prof + 1));
  return [];
}

/** Tous les nombres d'une valeur : nombres bruts et chiffres écrits dans les textes. */
function nombresDe(v: unknown, prof = 0): number[] {
  if (prof > 8) return [];
  if (typeof v === "number") return [v];
  if (typeof v === "string") return [...v.matchAll(NOMBRE_ECRIT)].map((m) => Number(m[0].replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")));
  if (Array.isArray(v)) return v.flatMap((x) => nombresDe(x, prof + 1));
  if (estObjet(v)) return Object.entries(v).filter(([k]) => k !== "illustration").flatMap(([, x]) => nombresDe(x, prof + 1));
  return [];
}

export function garderObjet(def: DefinitionObjet<unknown>, parametres: unknown, contexte: ContexteGarde): VerdictGarde {
  try {
    const p = estObjet(parametres) ? parametres : {};
    const id = String(def?.id ?? "");
    const textes = chainesDe(p);
    const commande = typeof p.commande === "string" ? p.commande : "";
    const mots = Array.isArray(contexte?.mots) ? contexte.mots : [];
    const premier = Number.isFinite(contexte?.premier) ? contexte.premier : 0;
    const dernier = Number.isFinite(contexte?.dernier) ? contexte.dernier : mots.length - 1;
    const plage = mots.slice(premier, dernier + 1);
    const dits = () => jetons(plage.map((m) => String(m?.texte ?? "")).join(" "));

    // « VALIDÉ » / coche de réussite : une preuve non vide est obligatoire.
    const preuve = typeof p.preuve === "string" && p.preuve.trim() !== "";
    if ((p.valide === true || p.coche === true || p.ton === "valide" || textes.some((t) => COCHE.test(t) || /(^| )validee?s?( |$)/.test(nu(t)))) && !preuve) return { refus: "validation sans preuve" };

    // Profil et commentaires : aucun nombre, marque « illustration » obligatoire.
    if (/profil|commentaire/.test(id) || p.profil !== undefined || p.commentaires !== undefined) {
      if (p.illustration !== true) return { refus: "profil ou commentaires sans marque illustration" };
      if (nombresDe(p).length > 0) return { refus: "nombre inventé dans un profil ou des commentaires" };
      return "ok";
    }

    // Nombres : dits dans la plage, ou saisis avec une source non vide.
    if (def?.donnees === "nombres-dits" || def?.donnees === "source-saisie") {
      const permis = [
        ...(plage.length ? nombresDits(mots as MotMinute[], premier, dernier) : []),
        ...(Array.isArray(contexte?.saisies) ? contexte.saisies.filter((s) => typeof s?.source === "string" && s.source.trim() !== "").map((s) => s.valeur) : []),
      ];
      if (nombresDe(p).some((n) => !permis.some((v) => Math.abs(v - n) < 1e-9))) return { refus: "nombre non dit" };
    }

    // Mots : suite contiguë de mots dits (texte ; commande de terminal toujours).
    const motsDits = def?.donnees === "mots-dits";
    if (motsDits && !commande && !textes.some((t) => jetons(t).length > 0)) return { refus: "texte introuvable" };
    const aVerifier = [commande, ...(motsDits ? textes : [])].filter((t) => t !== "");
    for (const t of aVerifier) {
      const j = jetons(t);
      if (j.length > MOTS_MAX) return { refus: `texte de plus de ${MOTS_MAX} mots` };
      if (!suiteContigue(j, dits())) return { refus: "mots non dits" };
    }
    return "ok";
  } catch {
    return { refus: "entrée illisible" };
  }
}
