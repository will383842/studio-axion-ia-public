// T-EXT-V2-11 : relevé d'un essai réel parti d'une phrase. Lit un export JSON des lignes de dépense d'UNE vidéo et le compare
// au plafond. Outil interne du pilote : aucun réseau, aucun appel payant, rien d'écrit ; le montant n'est montré que dans le terminal.
import { PROPOSITIONS_PIECE_MAX } from "../../../src/moteurs/montage-tutoriel-outil/maquette-creee";

// en attendant T-EXT-37 : forme minimale d'un export de dépense (à remplacer par l'import de `releve.ts` une fois 37 fusionnée).
export interface LigneDepenseExport {
  role: string;
  coutUsd: number;
}
export interface ExportDepenseVideo {
  plafondUsd: number;
  lignes: LigneDepenseExport[];
}

export const ROLE_MAQUETTISTE = "maquettiste";

export interface RelevePhrase {
  appelsMaquettiste: number;
  appelsParRole: Record<string, number>;
  depenseUsd: number;
  plafondUsd: number;
  sousLePlafond: boolean;
  ecart: number;
}

export type ResultatRelevePhrase = { ok: true; releve: RelevePhrase } | { ok: false; raison: string };

export function lireExportDepense(texte: string): ExportDepenseVideo | null {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return null;
  }
  if (typeof brut !== "object" || brut === null) return null;
  const { plafondUsd, lignes } = brut as Record<string, unknown>;
  if (typeof plafondUsd !== "number" || !Number.isFinite(plafondUsd) || plafondUsd < 0 || !Array.isArray(lignes)) return null;
  const propres: LigneDepenseExport[] = [];
  for (const l of lignes) {
    if (typeof l !== "object" || l === null) return null;
    const { role, coutUsd } = l as Record<string, unknown>;
    if (typeof role !== "string" || role.length === 0 || typeof coutUsd !== "number" || !Number.isFinite(coutUsd) || coutUsd < 0) return null;
    propres.push({ role, coutUsd });
  }
  return { plafondUsd, lignes: propres };
}

export function relevePhrase(texteExport: string): ResultatRelevePhrase {
  const exp = lireExportDepense(texteExport);
  if (!exp) return { ok: false, raison: "export illisible : vérifier le fichier" };
  const appelsParRole: Record<string, number> = {};
  let depenseUsd = 0;
  for (const l of exp.lignes) {
    appelsParRole[l.role] = (appelsParRole[l.role] ?? 0) + 1;
    depenseUsd += l.coutUsd;
  }
  const appelsMaquettiste = appelsParRole[ROLE_MAQUETTISTE] ?? 0;
  const arrondi = Math.round(depenseUsd * 1e6) / 1e6;
  // Même sans appel du maquettiste, la dépense relevée et le plafond sont montrés (terminal seulement) : un rôle mal nommé ne cache rien.
  if (appelsMaquettiste === 0) {
    const dessus = arrondi > exp.plafondUsd ? " : AU-DESSUS DU PLAFOND, arrêt" : "";
    return { ok: false, raison: `aucune création relevée : vérifier le réglage (dépense relevée ${arrondi} $ pour un plafond de ${exp.plafondUsd} $${dessus})` };
  }
  if (appelsMaquettiste > PROPOSITIONS_PIECE_MAX) {
    return { ok: false, raison: `dépassement : à signaler (${appelsMaquettiste} appels du maquettiste, ${PROPOSITIONS_PIECE_MAX} au plus)` };
  }
  return {
    ok: true,
    releve: {
      appelsMaquettiste,
      appelsParRole,
      depenseUsd: arrondi,
      plafondUsd: exp.plafondUsd,
      sousLePlafond: arrondi <= exp.plafondUsd,
      ecart: Math.round((exp.plafondUsd - arrondi) * 1e6) / 1e6,
    },
  };
}
