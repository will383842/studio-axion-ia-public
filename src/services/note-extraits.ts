/**
 * Note d'intérêt des extraits (X4-10a) : pose d'un tri déjà calculé dans une fiche « source-extraits ».
 * Fonctions PURES : aucun `depots`, aucun réglage lu, aucun appel à un fournisseur, aucune date du jour.
 * Rien n'appelle ce fichier (X4-10b ajoutera `appliquerNote` et la ligne dans `inscrireVideo`).
 * Les gestes de Williams (écartée, validée, sujet corrigé) l'emportent toujours sur le tri. Les entrées ne sont jamais modifiées.
 */
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { VERSION_NOTE_EXTRAITS } from "@/briques/note-extraits";
import type { Moment, NoteMoment, ResultatTri, SeuilsNoteInteret } from "@/briques/note-extraits";
import { reporterGestes } from "@/briques/archive-extraits/inscription";

type MomentNote = Moment & NoteMoment;

export const RAISON_NOTE_MOYENNE = "note-moyenne";

function plageDepuisMoment(m: MomentNote, etat: PlageExtrait["etat"]): PlageExtrait {
  const p: PlageExtrait = {
    id: m.id,
    debutSec: m.debutSec,
    finSec: m.finSec,
    texte: m.texte ?? "",
    motsCles: [],
    avecVisage: m.avecVisage,
    texteIncruste: m.texteIncruste,
    etat,
    origine: m.origine,
    note: m.note,
    raisonsNote: m.raisons.map((r) => ({ ...r })),
    usages: [...m.usages],
  };
  if (etat === "a_verifier") p.raisonExclusion = RAISON_NOTE_MOYENNE;
  if (m.sujet !== null) p.sujet = m.sujet;
  return p;
}

/** Gardés → `utilisable` ; peut-être → `a_verifier` (raison `note-moyenne`). Les ignorés ne donnent aucune plage. */
export function plagesDepuisTri(tri: ResultatTri): PlageExtrait[] {
  return [
    ...tri.gardes.map((m) => plageDepuisMoment(m, "utilisable")),
    ...tri.peutEtre.map((m) => plageDepuisMoment(m, "a_verifier")),
  ];
}

// Même appariement que `reporterGestes` : même id, ou même texte et recouvrement d'au moins 80 %.
const SEUIL_RECOUVREMENT = 0.8;
const EPS = 1e-9;

function recouvre(a: PlageExtrait, b: PlageExtrait): boolean {
  const commun = Math.min(a.finSec, b.finSec) - Math.max(a.debutSec, b.debutSec);
  const longue = Math.max(a.finSec - a.debutSec, b.finSec - b.debutSec);
  return longue > 0 && commun / longue >= SEUIL_RECOUVREMENT - EPS;
}

function correspond(ancienne: PlageExtrait, nouvelle: PlageExtrait): boolean {
  return ancienne.id === nouvelle.id || (ancienne.texte.trim() === nouvelle.texte.trim() && recouvre(ancienne, nouvelle));
}

const trouverAncienne = (anciennes: PlageExtrait[], n: PlageExtrait): PlageExtrait | undefined =>
  anciennes.find((a) => a.id === n.id) ?? anciennes.find((a) => correspond(a, n));

/**
 * Fiche avec le tri posé. Les plages du tri passent par `reporterGestes` ; un sujet corrigé garde son sujet ;
 * une plage écartée ou validée par Williams que le tri ne retient plus est conservée telle quelle.
 * `_seuils` : réservé (les seuils agissent dans `trierVideo` et dans `empreinteNote`, pas ici).
 */
export function ficheAvecTri(fiche: FicheSourceExtraits, tri: ResultatTri, _seuils: SeuilsNoteInteret): FicheSourceExtraits {
  const reportees = reporterGestes(fiche.plages, plagesDepuisTri(tri)).map((r) => {
    const a = trouverAncienne(fiche.plages, r);
    if (a?.sujetCorrigeLe) {
      r.sujetCorrigeLe = a.sujetCorrigeLe;
      if (a.sujet === undefined) delete r.sujet;
      else r.sujet = a.sujet;
    }
    return r;
  });
  const conservees = fiche.plages
    .filter((a) => (a.ecarteeLe || a.valideeLe) && !reportees.some((r) => correspond(a, r)))
    .map((a) => ({ ...a, motsCles: [...a.motsCles] }));
  const plages = [...reportees, ...conservees];
  return {
    ...fiche,
    famille: [...fiche.famille],
    plages,
    ignores: { ...tri.ignores },
    rienARetenir: tri.rienARetenir && plages.length === 0,
    noteVersion: VERSION_NOTE_EXTRAITS,
  };
}

/** Version + seuils : la note n'est recalculée que si les règles changent. */
export function empreinteNote(seuils: SeuilsNoteInteret): string {
  return `${VERSION_NOTE_EXTRAITS}|garde=${seuils.garde}|peutEtre=${seuils.peutEtre}|gardesMax=${seuils.gardesMax}`;
}
