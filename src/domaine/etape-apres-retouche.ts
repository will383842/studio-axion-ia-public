/**
 * Étape d'une vidéo après retouche, règle CAL-25 (« fichier changé = on revalide »). (G6-06)
 *
 * Constat :
 * - Règle validée CAL-25 : `src/services/medias-deposes.ts:89-93` : « un nouveau fichier n'a jamais été validé : une
 *   entrée déjà validée ou programmée repasse « à valider ».
 * - Comportement actuel : `src/services/travaux.ts:260-264` : une retouche (ou un recalque des sous-titres) d'une vidéo
 *   publiée la laisse `publiee` ; sinon l'étape repasse `a_relire`. Le créneau et l'envoi planifié ne sont pas touchés.
 *
 * Non câblée. Le câblage (travaux.ts, créneau, avertissement de publication, choisirVersion) est la décision W3 de
 * Williams, menée par la session qui tient ces zones.
 *
 * Fonction PURE : aucune lecture de dépôt, aucune écriture, aucun changement de statut, aucune horloge.
 */
import type { EntreeEngagement, EtapeEngagement } from "./engagement-video";
import { engagementVideo } from "./engagement-video";

export type EntreeEtapeApresRetouche = EntreeEngagement & {
  typeTravail: "retouche" | "recalque-sous-titres" | "choix-version" | "chat";
};

export interface DecisionApresRetouche {
  etape: EtapeEngagement;
  /** Ids des créneaux validés ou programmés, à repasser « a_valider ». */
  creneauxARevalider: string[];
  /** Ids des envois programmés ou confirmés, à revalider. */
  envoisARevalider: string[];
  /** Publications programmées sur une ancienne sortie. */
  avertissements: { publicationId: string; texte: string }[];
  raisons: string[];
}

const norme = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function etapeApresRetouche(e: EntreeEtapeApresRetouche): DecisionApresRetouche {
  const eng = engagementVideo(e);
  if (!eng.engagee) {
    return { etape: "a_relire", creneauxARevalider: [], envoisARevalider: [], avertissements: [], raisons: [] };
  }
  const creneauxARevalider = (e.creneaux ?? []).filter((c) => /^(valid|programm)/.test(norme(c.statut))).map((c) => c.id);
  const envoisARevalider = (e.envois ?? []).filter((v) => /^(programm|confirm)/.test(norme(v.statut))).map((v) => v.id);
  const avertissements = eng.liensPerimes
    .filter((l) => l.type === "publication")
    .map((l) => ({
      publicationId: l.id,
      texte: `La publication ${l.id} est programmée avec l'ancien fichier : à revoir avant son départ.`,
    }));
  // Seule exception : une vidéo déjà publiée reste publiée (rien n'est dépublié, travaux.ts:261).
  const etape: EtapeEngagement = e.video.etapeEditoriale === "publiee" ? "publiee" : "a_relire";
  return {
    etape,
    creneauxARevalider,
    envoisARevalider,
    avertissements,
    raisons: [...eng.raisons, "CAL-25 : fichier changé = on revalide."],
  };
}
