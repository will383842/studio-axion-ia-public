/**
 * Le TÉMOIN RÉEL du premier essai du gabarit clair (`temoins/gabarit-essai-reel-2026-10-14.json`, vidéo
 * `v-4fb0bdccdab6`, style « reference/2 ») : sa fiche, préparée pour ses deux sorties verticales comme en production
 * (vertical des Reels, avec l'appel ; vertical de TikTok et Shorts, avec la demande de la banque), puis calée sur LEURS
 * VRAIES VOIX (minutage du témoin). Partagé par les tests et les images (`images.mts`). Aucun appel payant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calerFicheTableau, type ElementCale } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import type { OptionsMiseEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { finDeLaSortie, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";

export interface MotVoix {
  mot: string;
  debutSec: number;
  finSec: number;
}

export interface TemoinGabarit {
  fiche: FicheTableau;
  ficheCalee: FicheTableau;
  voix: { mots: MotVoix[]; dureeSec: number };
  voixTikTok: { mots: MotVoix[]; dureeSec: number };
}

export const temoinGabarit = (): TemoinGabarit => JSON.parse(readFileSync(join(__dirname, "..", "temoins", "gabarit-essai-reel-2026-10-14.json"), "utf8")) as TemoinGabarit;

/** Contexte des règles de la production : le texte de la fiche, sa démonstration validée. */
export function contexteTemoin(f: FicheTableau): ContexteTableau {
  const ids = [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  return {
    aujourdhui: "2026-10-14",
    sourcesChiffres: [],
    preuves: [],
    matieres: ids.map((id) => ({ id, type: "demonstration", statut: "validee", perimeLe: "2027-01-09" })),
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
  };
}

export interface SortieTemoin {
  id: IdSortie;
  /** Fiche calée sur la vraie voix de la sortie. */
  fiche: FicheTableau;
  elements: ElementCale[];
  mots: MotVoix[];
  options: OptionsMiseEnPage;
}

/** Les deux sorties verticales du témoin, calées sur leurs vraies voix (Reels : `voix` ; TikTok et Shorts : `voixTikTok`). */
export function sortiesTemoin(t: TemoinGabarit = temoinGabarit()): SortieTemoin[] {
  const sorties = sortiesDesReseaux(["verticaux"]);
  const choisirFin = choisirFinTableau({}, { sorties, mot: "REPONSES" });
  return sortiesRelues(t.fiche, sorties, (id) => finDeLaSortie(id, choisirFin(t.fiche.appelId ?? null, id), t.fiche)).map((p) => {
    const voix = p.id === "vertical" ? t.voix : t.voixTikTok;
    const r = calerFicheTableau(p.fiche, voix.mots, { contexte: contexteTemoin(p.fiche), dureeSec: voix.dureeSec });
    if (!r.ok) throw new Error(`${p.id} : calage refusé : ${r.problemes.join(" | ")}`);
    return { id: p.id, fiche: r.fiche, elements: r.elements, mots: voix.mots, options: p.options };
  });
}
