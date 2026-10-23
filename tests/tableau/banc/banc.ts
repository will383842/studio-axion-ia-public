/**
 * Le BANC : une fiche × un style, passée par la VRAIE fabrication (`fabriquerTableau`, doubles sans appel payant), pour
 * toutes les sorties (vertical, vertical de TikTok et Shorts, 4:5, carré, 16:9). Rend, par sortie, « OK » ou le refus :
 * l'étape et ses raisons (relecture de la fiche et contrôles d'avant la voix, calage, mise en page, propriétés, contrôles
 * de l'étape « scènes », contrôles finaux bloquants).
 */
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { ErreurFabrication, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { IDS_SORTIES, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { doubles } from "../fabriquer/doubles";
import { contexteBanc, type FicheBanc } from "./fiches-banc";

export interface LigneBanc {
  fiche: string;
  style: StyleTableau;
  sortie: IdSortie;
  /** `null` : OK. Sinon l'étape qui refuse et ses raisons. */
  refus: { etape: string; raisons: string[] } | null;
}

export async function passerAuBanc(fb: FicheBanc, style: StyleTableau): Promise<LigneBanc[]> {
  const fiche = { ...fb.fiche, styleTableau: style };
  const d = doubles(fiche);
  const ligne = (sortie: IdSortie, refus: LigneBanc["refus"]): LigneBanc => ({ fiche: fb.nom, style, sortie, refus });
  try {
    const r = await fabriquerTableau({ ...d.outils, contexte: contexteBanc(fiche, fb.motsDouleur, fb.sources), sorties: [...IDS_SORTIES], dejaVu: { coche: true, le: "2026-10-17" } });
    return IDS_SORTIES.map((id) => {
      const manque = r.manquantes?.find((m) => m.format === id);
      if (manque) return ligne(id, { etape: manque.etape, raisons: manque.raisons });
      const faite = r.sorties.find((s) => s.format === id);
      if (!faite) return ligne(id, { etape: "?", raisons: ["sortie absente du compte rendu"] });
      const bloquants = faite.controles.bloquants.map((b) => `${b.libelle} : ${b.raison}`);
      return ligne(id, bloquants.length ? { etape: "controles", raisons: bloquants } : null);
    });
  } catch (err) {
    const refus = err instanceof ErreurFabrication ? { etape: err.etape, raisons: [...err.raisons] } : { etape: "panne", raisons: [err instanceof Error ? (err.stack ?? err.message) : String(err)] };
    return IDS_SORTIES.map((id) => ligne(id, refus));
  }
}
