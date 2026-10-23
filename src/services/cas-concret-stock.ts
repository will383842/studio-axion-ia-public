/**
 * STOCK DES CAS (lecture seule) : pour chaque cas du catalogue, où il en est (script validé ou à valider), combien de
 * vidéos sont faites et dans quel état, les faits de la fiche qui ont (ou non) une preuve. PUR : les scripts et les
 * vidéos sont fournis par l'appelant (`cas-concret-stock-lecture.ts`). N'écrit rien, ne dépense rien.
 */
import type { Video } from "@/domaine/types";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { videoCompte } from "@/domaine/sujets-traites";
import { CATALOGUE, estCasStock } from "@/formats/cas-concret/catalogue";
import { RANGEMENT } from "@/formats/cas-concret/stock-metiers";
import type { Rangement } from "@/formats/cas-concret/stock-metiers/schema";
import { ENTREE_CAS_CONCRET } from "@/moteurs/montage-cas-concret/etapes";
import { scriptValideDuCatalogue, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";

export type EtatVideoCas = "brouillon" | "en-fabrication" | "a-relire" | "validee" | "a-reprendre";

export interface FaitASignaler {
  id: string;
  source: string;
  raison: "source-non-code" | "sans-preuve";
}

export interface LigneStock {
  casId: string;
  titre: string;
  offre: CasConcret["offre"];
  nature?: CasConcret["nature"];
  posture: CasConcret["posture"];
  theme?: string;
  script: { valide: true; version: number; date: string } | { valide: false };
  videos: {
    /** Toutes celles du cas, sauf archivées et arrêtées. */
    total: number;
    /** Terminées : à relire ou validées. */
    faites: number;
    /**
     * Vidéos qui COMPTENT comme sujet traité, par la règle de l'anti-doublon (`videoCompte`) : une vidéo à la corbeille
     * compte encore, une démonstration, un brouillon ou une vraie panne non. Sert à l'état « restant » / « traité ».
     */
    comptees: number;
    parEtat: Partial<Record<EtatVideoCas, number>>;
    /** Date (ISO) de la dernière modifiée. */
    derniere?: string;
  };
  /** Rangement (secteur, taille, métier…) : seulement pour un cas du stock par métier. */
  rangement?: Rangement;
  /** Prix estimé « au plus » (centimes), seulement s'il est fourni. */
  prixAuPlusCentimes?: number;
  faits: { total: number; avecPreuve: number; aSignaler: FaitASignaler[] };
}

export interface EntreeStock {
  /** Script validé du studio par cas ; `null` ou absent : aucun (le script du code est alors essayé). */
  scripts: Record<string, ScriptValide | null | undefined>;
  videos: readonly Video[];
  montants?: Record<string, number>;
  catalogue?: readonly CasConcret[];
  catalogueScripts?: (casId: string) => ScriptValide | undefined;
  /** Rangement par id de cas ; absent : celui du stock par métier chargé du fichier. */
  rangement?: Readonly<Record<string, Rangement>>;
}

const casDeLaVideo = (v: Video): string | undefined => {
  const e = (v.entrees as Record<string, unknown> | undefined)?.[ENTREE_CAS_CONCRET];
  const id = e && typeof e === "object" ? (e as Record<string, unknown>).casId : undefined;
  return typeof id === "string" ? id : undefined;
};

/** L'état d'une vidéo en clair ; `null` : ne compte pas (archivée, arrêtée). */
function etatDe(v: Video): EtatVideoCas | null {
  switch (v.statut) {
    case "brouillon":
    case "maquette":
      return "brouillon";
    case "en_file":
    case "en_fabrication":
      return "en-fabrication";
    case "echec":
      return "a-reprendre";
    case "prete":
      return !v.etapeEditoriale || v.etapeEditoriale === "a_relire" ? "a-relire" : "validee";
    default:
      return null;
  }
}

function faitsDe(cas: CasConcret): LigneStock["faits"] {
  const aSignaler: FaitASignaler[] = [];
  let avecPreuve = 0;
  for (const f of cas.faits) {
    const preuve = f.preuve.trim() !== "";
    if (preuve) avecPreuve++;
    if (!preuve) aSignaler.push({ id: f.id, source: f.source, raison: "sans-preuve" });
    else if (f.source !== "code") aSignaler.push({ id: f.id, source: f.source, raison: "source-non-code" });
  }
  return { total: cas.faits.length, avecPreuve, aSignaler };
}

export function construireStockCas(entree: EntreeStock): LigneStock[] {
  const duCode = entree.catalogueScripts ?? scriptValideDuCatalogue;
  const rangements = entree.rangement ?? RANGEMENT;
  // Sans catalogue fourni : les cas d'avant le stock SEULEMENT. Les cas du stock par métier n'entrent que si l'appelant les
  // fournit (il a lu `casConcret.stockMetiers` ; voir `lireStockCas`).
  return (entree.catalogue ?? CATALOGUE.filter((c) => !estCasStock(c.id))).map((cas) => {
    const trouve = entree.scripts[cas.id] ?? duCode(cas.id);
    // Un script d'une autre version du cas n'est pas valide : même règle que la fabrication.
    const s = trouve && trouve.versionCas === cas.version ? trouve : undefined;
    const parEtat: LigneStock["videos"]["parEtat"] = {};
    let total = 0;
    let comptees = 0;
    let derniere: string | undefined;
    for (const v of entree.videos) {
      if (v.formatId !== "cas-concret" || casDeLaVideo(v) !== cas.id) continue;
      const etat = etatDe(v);
      if (videoCompte(v)) comptees++;
      if (!etat) continue;
      total++;
      parEtat[etat] = (parEtat[etat] ?? 0) + 1;
      if (!derniere || v.modifieLe > derniere) derniere = v.modifieLe;
    }
    const prix = entree.montants?.[cas.id];
    return {
      casId: cas.id,
      titre: cas.titre,
      offre: cas.offre,
      ...(cas.nature ? { nature: cas.nature } : {}),
      posture: cas.posture,
      ...(cas.theme ? { theme: cas.theme } : {}),
      script: s ? { valide: true, version: s.numero ?? 1, date: s.valideLe } : { valide: false },
      videos: { total, faites: (parEtat["a-relire"] ?? 0) + (parEtat.validee ?? 0), comptees, parEtat, derniere },
      ...(rangements[cas.id] ? { rangement: rangements[cas.id] } : {}),
      ...(typeof prix === "number" ? { prixAuPlusCentimes: prix } : {}),
      faits: faitsDe(cas),
    } satisfies LigneStock;
  });
}

export interface SyntheseStock {
  cas: number;
  prets: number;
  aValider: number;
  videosFaites: number;
}

export function synthese(lignes: readonly LigneStock[]): SyntheseStock {
  const prets = lignes.filter((l) => l.script.valide).length;
  return { cas: lignes.length, prets, aValider: lignes.length - prets, videosFaites: lignes.reduce((n, l) => n + l.videos.faites, 0) };
}

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

/** « 8 cas · 1 script prêt · 7 à valider · 0 vidéo faite » */
export function phraseSynthese(s: SyntheseStock): string {
  return [pluriel(s.cas, "cas", "cas"), pluriel(s.prets, "script prêt", "scripts prêts"), `${s.aValider} à valider`, pluriel(s.videosFaites, "vidéo faite", "vidéos faites")].join(" · ");
}
