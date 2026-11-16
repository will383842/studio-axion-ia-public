/**
 * La vidéo est-elle « engagée » (déjà validée, programmée ou publiée) ? Quels liens sont périmés ? (G6-05)
 *
 * Fonction PURE : tout est fourni par l'appelant (aucune lecture de dépôt, aucune écriture, aucun changement de statut).
 * Aucun import du calendrier, des publications, de Zernio, de Buffer ni de la cadence : les statuts des créneaux et des
 * envois sont des libellés fournis par l'appelant, comparés sans accents ni casse.
 * Le câblage dans la retouche n'est pas ici (G6-06).
 */

/** Valeurs de `StatutVideo` (types.ts) recopiées en littéral. */
export type StatutVideoEngagement =
  | "brouillon" | "maquette" | "en_file" | "en_fabrication" | "prete" | "echec" | "annulee" | "archivee";
/** Valeurs de `EtapeEditoriale` (types.ts) recopiées en littéral. */
export type EtapeEngagement = "a_relire" | "validee" | "programmee" | "publiee";

export interface EntreeEngagement {
  video: { id: string; statut: StatutVideoEngagement; etapeEditoriale?: EtapeEngagement };
  versionChoisieId?: string;
  sortieIdCourante?: string;
  publications: {
    id: string;
    /** `StatutPublication` : brouillon | programmee | publiee | echec. */
    statut: string;
    sortieId?: string;
    versionId?: string;
    /** `ViaPublication`. Une publication `simulation` n'est JAMAIS comptée comme programmée (AV2.4-4). */
    via?: string;
  }[];
  creneaux: { id: string; statut: string; versionId?: string }[];
  envois: { id: string; statut: string; versionId?: string }[];
}

export interface LienPerime {
  type: "publication" | "creneau" | "envoi";
  id: string;
  raison: string;
}

export interface EngagementVideo {
  engagee: boolean;
  raisons: string[];
  liensPerimes: LienPerime[];
}

const norme = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const estSimulation = (p: { statut: string; via?: string }): boolean =>
  norme(p.via ?? "") === "simulation" || norme(p.statut) === "simulation";

export function engagementVideo(e: EntreeEngagement): EngagementVideo {
  const raisons: string[] = [];
  const liensPerimes: LienPerime[] = [];
  const etape = e.video.etapeEditoriale;
  if (etape === "validee" || etape === "programmee" || etape === "publiee") {
    raisons.push(`étape éditoriale « ${etape} »`);
  }

  for (const p of e.publications ?? []) {
    if (estSimulation(p)) continue;
    const s = norme(p.statut);
    if (s !== "programmee" && s !== "publiee") continue;
    raisons.push(`publication ${p.id} ${s}`);
    if (s === "programmee" && e.sortieIdCourante && p.sortieId && p.sortieId !== e.sortieIdCourante) {
      liensPerimes.push({ type: "publication", id: p.id, raison: "programmée sur une ancienne sortie" });
    }
  }

  const autreVersion = (v?: string): boolean => !!e.versionChoisieId && !!v && v !== e.versionChoisieId;

  for (const c of e.creneaux ?? []) {
    const s = norme(c.statut);
    if (!/^(valid|programm)/.test(s)) continue;
    raisons.push(`créneau ${c.id} ${s}`);
    if (autreVersion(c.versionId)) {
      liensPerimes.push({ type: "creneau", id: c.id, raison: "attaché à une version qui n'est plus la version choisie" });
    }
  }

  for (const v of e.envois ?? []) {
    const s = norme(v.statut);
    if (!/^(programm|confirm)/.test(s)) continue;
    raisons.push(`envoi ${v.id} ${s}`);
    if (autreVersion(v.versionId)) {
      liensPerimes.push({ type: "envoi", id: v.id, raison: "attaché à une version qui n'est plus la version choisie" });
    }
  }

  return { engagee: raisons.length > 0, raisons, liensPerimes };
}
