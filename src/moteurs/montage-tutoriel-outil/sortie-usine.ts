/**
 * FICHE DE SORTIE du tutoriel de valeur (T-EXT-47) — PUR, branché nulle part.
 *
 * Contrat `tutoriel-sortie.v1` : ce que l'usine pourra LIRE d'une vidéo tutoriel (formats, durée mesurée, gabarits, cas,
 * fin choisie, scènes, verdict des contrôles). Aucun texte de la vidéo (ni script, ni phrase, ni titre de publication),
 * aucun montant, aucune date, aucun nom de personne, aucun mot-clé de commentaire (décision 2 du 18/11). Les seules
 * chaînes sont des identifiants fermés ou des clés « scene:… ». Une entrée incomplète donne `{ ok: false, manque }`,
 * jamais une exception. Ce fichier ne change aucune porte de l'usine : tout changement de porte est à will-51.
 */
import { z } from "zod";
import type { CasTutoriel, FinChoisie, IdGabarit, RatioTutoriel } from "./equipe/chef-de-projet";

export const CONTRAT_SORTIE_TUTORIEL = "tutoriel-sortie.v1" as const;

export interface FicheSortieTutoriel {
  contrat: typeof CONTRAT_SORTIE_TUTORIEL;
  videoId: string;
  versionId: string;
  ratios: RatioTutoriel[];
  /** Durée MESURÉE du rendu, pas la durée cible. */
  dureeSec: number;
  /** 1 gabarit, ou 2 pour le cas 5 (T-EXT-18). */
  gabarits: IdGabarit[];
  cas: CasTutoriel;
  fin: FinChoisie;
  /** Clés « scene:… » (T-EXT-15), jamais un texte. */
  scenes: string[];
  controles: { verdict: "ok" | "a-revoir"; defauts: number };
  /** Toujours « exemple » : les données montrées sont des données d'exemple. */
  donnees: "exemple";
  /** Vrai seulement si l'étape éditoriale est « validée ». */
  valideeParWilliams: boolean;
}

/** Ce que l'appelant fournit : tout est facultatif pour qu'une entrée incomplète soit nommée, jamais jetée. */
export interface EntreeFicheSortie {
  videoId?: string;
  versionId?: string;
  ratios?: readonly string[];
  dureeSec?: number;
  gabarits?: readonly string[];
  cas?: number;
  fin?: string;
  scenes?: readonly string[];
  controles?: { verdict?: string; defauts?: number };
  /** Étape éditoriale de la vidéo (« validee » = validée par Williams). */
  etapeEditoriale?: string;
}

export type ResultatFicheSortie = { ok: true; fiche: FicheSortieTutoriel } | { ok: false; manque: string[] };

const IDENTIFIANT = /^[A-Za-z0-9._:-]{1,100}$/;
const CLE_SCENE = /^scene:[A-Za-z0-9._:-]{1,90}$/;

const schemaFiche = z
  .object({
    contrat: z.literal(CONTRAT_SORTIE_TUTORIEL),
    videoId: z.string().regex(IDENTIFIANT),
    versionId: z.string().regex(IDENTIFIANT),
    ratios: z.array(z.enum(["4:5", "9:16", "1:1"])).min(1).max(3).refine((r) => new Set(r).size === r.length),
    dureeSec: z.number().finite().positive().max(3600),
    gabarits: z.array(z.enum(["G-Journee", "G-Decision", "G-Reponse", "G-Flux"])).min(1).max(2),
    cas: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    fin: z.enum(["aucune", "prendre-rendez-vous"]),
    scenes: z.array(z.string().regex(CLE_SCENE)).min(1).max(40),
    controles: z.object({ verdict: z.enum(["ok", "a-revoir"]), defauts: z.number().int().min(0).max(10_000) }).strict(),
    donnees: z.literal("exemple"),
    valideeParWilliams: z.boolean(),
  })
  .strict()
  .superRefine((f, ctx) => {
    // Le cas 5 porte deux gabarits (flux puis décision) ; les autres cas, un seul.
    const attendu = f.cas === 5 ? 2 : 1;
    if (f.gabarits.length !== attendu) ctx.addIssue({ code: "custom", path: ["gabarits"], message: "nombre de gabarits" });
  });

function nomChamp(chemin: readonly PropertyKey[]): string {
  return chemin.length === 0 ? "fiche" : chemin.map(String).join(".");
}

function manques(erreur: z.ZodError): string[] {
  const noms = erreur.issues.flatMap((i) => {
    if (i.code === "unrecognized_keys") return (i as { keys: string[] }).keys.map((k) => nomChamp([...i.path, k]));
    return [nomChamp(i.path)];
  });
  return [...new Set(noms)];
}

/** Lecteur STRICT (champ inconnu refusé) : pour l'usine et pour les tests. Ne lève jamais. */
export function lireFicheSortieTutoriel(brut: unknown): ResultatFicheSortie {
  const r = schemaFiche.safeParse(brut);
  if (r.success) return { ok: true, fiche: r.data as FicheSortieTutoriel };
  return { ok: false, manque: manques(r.error) };
}

/** Écrit la fiche de sortie. Aucun texte libre, aucun montant, aucune date n'y entre ; jamais d'exception. */
export function ficheSortieTutoriel(entree: EntreeFicheSortie): ResultatFicheSortie {
  const e = entree ?? {};
  const brut = {
    contrat: CONTRAT_SORTIE_TUTORIEL,
    videoId: e.videoId,
    versionId: e.versionId,
    ratios: e.ratios === undefined ? undefined : [...e.ratios],
    dureeSec: e.dureeSec,
    gabarits: e.gabarits === undefined ? undefined : [...e.gabarits],
    cas: e.cas,
    fin: e.fin,
    scenes: e.scenes === undefined ? undefined : [...e.scenes],
    controles: e.controles === undefined ? undefined : { verdict: e.controles.verdict, defauts: e.controles.defauts },
    donnees: "exemple",
    valideeParWilliams: e.etapeEditoriale === "validee",
  };
  try {
    return lireFicheSortieTutoriel(brut);
  } catch {
    return { ok: false, manque: ["fiche"] };
  }
}
