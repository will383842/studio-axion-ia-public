/**
 * VALIDATION de la fiche de scènes : elle REFUSE, elle ne corrige jamais. Chaque refus nomme la règle et, s'il y a
 * lieu, la scène ; messages en français, sans sigle.
 *
 * Ordre : version connue → schéma exact → règles communes → règles fournies par le format (seulement si tout le reste
 * passe, pour qu'elles lisent une fiche bien formée). Une fiche d'une version plus ancienne passe d'abord par `migrer.ts`.
 */
import type { z } from "zod";
import { schemaFicheScenes, type ExtensionFormat } from "./schema";
import { BORNES_FICHE, VERSION_FICHE_SCENES, type BornesFiche, type FicheScenes, type ProblemeFiche, type ResultatFiche } from "./types";

/** Noms en clair des règles communes (cités dans les messages). */
export const REGLES_COMMUNES = {
  versionConnue: "version connue",
  schemaExact: "schéma exact",
  formatAttendu: "format attendu",
  nombreScenes: "nombre de scènes",
  identifiantsScenes: "identifiants de scène uniques et ordonnés",
  nombreElements: "nombre d'éléments",
  pagesCroissantes: "pages croissantes",
  horaires: "horaires de scène",
} as const;

/** Identifiant attendu de la scène de rang `i` (0 → « s01 »). */
export function idSceneAttendu(i: number): string {
  return `s${String(i + 1).padStart(2, "0")}`;
}

function probleme(regle: string, detail: string, sceneId?: string): ProblemeFiche {
  const ou = sceneId ? `Scène ${sceneId}` : "Fiche";
  return { regle, ...(sceneId ? { sceneId } : {}), message: `${ou} · règle « ${regle} » : ${detail}` };
}

/* ------------------------------------------------------------------ */
/* Traduction des refus du schéma                                        */
/* ------------------------------------------------------------------ */

const NOMS_TYPES: Record<string, string> = {
  string: "un texte",
  number: "un nombre",
  int: "un nombre entier",
  boolean: "vrai ou faux",
  array: "une liste",
  object: "un objet",
  null: "l'absence de valeur",
  undefined: "rien",
};

const nomType = (t: unknown) => NOMS_TYPES[String(t)] ?? String(t);

function nomRecu(entree: unknown): string {
  if (entree === null) return "l'absence de valeur";
  if (entree === undefined) return "rien";
  if (Array.isArray(entree)) return "une liste";
  return nomType(typeof entree);
}

function detailZod(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? "champ obligatoire absent" : `${nomType(issue.expected)} attendu, ${nomRecu(issue.input)} reçu`;
    case "unrecognized_keys":
      return `champ${issue.keys.length > 1 ? "s" : ""} inconnu${issue.keys.length > 1 ? "s" : ""} : ${issue.keys.map((k) => `« ${k} »`).join(", ")}`;
    case "invalid_value":
      return `valeur refusée ; valeurs permises : ${issue.values.map((v) => `« ${String(v)} »`).join(", ")}`;
    case "too_small":
      return issue.origin === "number" ? `doit valoir au moins ${String(issue.minimum)}` : `trop court (au moins ${String(issue.minimum)})`;
    case "too_big":
      return issue.origin === "number" ? `doit valoir au plus ${String(issue.maximum)}` : `trop long (au plus ${String(issue.maximum)})`;
    case "invalid_format":
      return issue.message && !/^Invalid/.test(issue.message) ? issue.message : "forme refusée";
    case "invalid_union":
      return "ne correspond à aucune forme permise";
    case "custom":
      return issue.message;
    default:
      return "valeur refusée";
  }
}

/** Lieu lisible d'un chemin (sans la scène, citée à part). */
function lieu(chemin: readonly PropertyKey[]): string {
  const morceaux: string[] = [];
  for (let i = 0; i < chemin.length; i++) {
    const p = chemin[i];
    if (p === "elements" && typeof chemin[i + 1] === "number") {
      morceaux.push(`élément ${(chemin[i + 1] as number) + 1}`);
      i++;
    } else if (typeof p === "number") morceaux.push(`n° ${p + 1}`);
    else morceaux.push(`champ « ${String(p)} »`);
  }
  return morceaux.join(", ");
}

function sceneDuChemin(brute: unknown, chemin: readonly PropertyKey[]): string | undefined {
  if (chemin[0] !== "scenes" || typeof chemin[1] !== "number") return undefined;
  const scenes = (brute as { scenes?: unknown }).scenes;
  const id = Array.isArray(scenes) ? (scenes[chemin[1]] as { id?: unknown } | undefined)?.id : undefined;
  return typeof id === "string" && id.trim() ? id : `n° ${chemin[1] + 1}`;
}

/* ------------------------------------------------------------------ */
/* Règles communes                                                       */
/* ------------------------------------------------------------------ */

/** Règles communes sur une fiche conforme au schéma. Liste vide si tout est respecté. */
export function reglesCommunes<E>(fiche: FicheScenes<E>, formatId: string, bornes: BornesFiche = BORNES_FICHE): ProblemeFiche[] {
  const res: ProblemeFiche[] = [];
  const R = REGLES_COMMUNES;
  const B = bornes;

  if (fiche.formatId !== formatId) {
    res.push(probleme(R.formatAttendu, `la fiche est du format « ${fiche.formatId} », le format « ${formatId} » était attendu.`));
  }

  const n = fiche.scenes.length;
  if (n < B.scenesMin || n > B.scenesMax) {
    res.push(probleme(R.nombreScenes, `${n} scène${n > 1 ? "s" : ""} ; il en faut de ${B.scenesMin} à ${B.scenesMax}.`));
  }

  const vus = new Set<string>();
  fiche.scenes.forEach((s, i) => {
    const attendu = idSceneAttendu(i);
    if (vus.has(s.id)) res.push(probleme(R.identifiantsScenes, `l'identifiant « ${s.id} » est déjà pris par une scène précédente.`, s.id));
    else if (s.id !== attendu) res.push(probleme(R.identifiantsScenes, `en position ${i + 1}, l'identifiant attendu est « ${attendu} ».`, s.id));
    vus.add(s.id);

    const e = s.elements.length;
    if (e < B.elementsMin || e > B.elementsMax) {
      res.push(probleme(R.nombreElements, `${e} élément${e > 1 ? "s" : ""} ; il en faut de ${B.elementsMin} à ${B.elementsMax}.`, s.id));
    }

    if (s.page < B.pageMin || s.page > B.pageMax) {
      res.push(probleme(R.pagesCroissantes, `page ${s.page} ; les pages vont de ${B.pageMin} à ${B.pageMax}.`, s.id));
    } else if (i === 0 && s.page !== B.pageMin) {
      res.push(probleme(R.pagesCroissantes, `la première scène doit être sur la page ${B.pageMin}, pas sur la page ${s.page}.`, s.id));
    } else if (i > 0) {
      const avant = fiche.scenes[i - 1].page;
      if (s.page < avant) res.push(probleme(R.pagesCroissantes, `la page ${s.page} vient après la page ${avant} ; une page ne revient jamais en arrière.`, s.id));
      else if (s.page > avant + 1) res.push(probleme(R.pagesCroissantes, `la page ${s.page} suit la page ${avant} ; une page ne peut pas être sautée.`, s.id));
    }

    const aDebut = s.debutMs !== undefined;
    const aFin = s.finMs !== undefined;
    if (aDebut !== aFin) {
      res.push(probleme(R.horaires, "le début et la fin sont posés ensemble par le calage, ou pas du tout.", s.id));
    } else if (aDebut && aFin) {
      if (s.finMs! <= s.debutMs!) res.push(probleme(R.horaires, `la fin (${s.finMs} ms) doit venir après le début (${s.debutMs} ms).`, s.id));
      const prec = i > 0 ? fiche.scenes[i - 1] : undefined;
      if (prec?.finMs !== undefined && s.debutMs! < prec.finMs) {
        res.push(probleme(R.horaires, `le début (${s.debutMs} ms) chevauche la scène ${prec.id}, qui finit à ${prec.finMs} ms.`, s.id));
      }
    }
  });

  return res;
}

/* ------------------------------------------------------------------ */
/* Validation complète                                                   */
/* ------------------------------------------------------------------ */

/**
 * Valide une fiche brute (JSON lu) pour un format. Refuse si une seule règle échoue ; ne modifie jamais la fiche.
 * La version doit être la version courante : une version plus ancienne passe d'abord par `migrerFiche`.
 */
export function validerFiche<E, C = unknown, G = unknown>(brute: unknown, format: ExtensionFormat<E, C, G>): ResultatFiche<FicheScenes<E, C, G>> {
  if (typeof brute !== "object" || brute === null || Array.isArray(brute)) {
    return { ok: false, problemes: [probleme(REGLES_COMMUNES.schemaExact, "la fiche doit être un objet.")] };
  }
  const version = (brute as { version?: unknown }).version;
  if (version !== VERSION_FICHE_SCENES) {
    const detail =
      typeof version === "string"
        ? `la version « ${version} » n'est pas la version « ${VERSION_FICHE_SCENES} » ; passer d'abord par la migration, qui refuse une version inconnue.`
        : `la version est absente ; « ${VERSION_FICHE_SCENES} » est attendue.`;
    return { ok: false, problemes: [probleme(REGLES_COMMUNES.versionConnue, detail)] };
  }

  const lu = schemaFicheScenes(format.schemaElement, format.schemaEcran, format.schemaGabarit).safeParse(brute);
  if (!lu.success) {
    return {
      ok: false,
      problemes: lu.error.issues.map((issue) => {
        const sceneId = sceneDuChemin(brute, issue.path);
        const ou = lieu(sceneId ? issue.path.slice(2) : issue.path);
        return probleme(REGLES_COMMUNES.schemaExact, `${ou ? `${ou} : ` : ""}${detailZod(issue)}.`, sceneId);
      }),
    };
  }

  const fiche = lu.data;
  const communs = reglesCommunes(fiche as FicheScenes<E>, format.formatId, { ...BORNES_FICHE, ...format.bornes?.(fiche) });
  if (communs.length) return { ok: false, problemes: communs };

  const propres = format.regles.flatMap((r) => r.verifier(fiche as FicheScenes<E>).map((m) => probleme(r.nom, m.detail, m.sceneId)));
  if (propres.length) return { ok: false, problemes: propres };

  return { ok: true, fiche };
}
