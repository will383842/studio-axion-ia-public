/**
 * Note d'intérêt des extraits (X4-10a) : pose d'un tri déjà calculé dans une fiche « source-extraits ».
 * Fonctions PURES : aucun `depots`, aucun réglage lu, aucun appel à un fournisseur, aucune date du jour.
 * Rien n'appelle ce fichier (X4-10b ajoutera `appliquerNote` et la ligne dans `inscrireVideo`).
 * Les gestes de Williams (écartée, validée, sujet corrigé) l'emportent toujours sur le tri. Les entrées ne sont jamais modifiées.
 */
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { Video, VersionVideo } from "@/domaine/types";
import { VERSION_NOTE_EXTRAITS, lireNoteInteret, momentsDepuisScenes, momentsEcranDemo, usagesDe } from "@/briques/note-extraits";
import type { LireReglageNoteInteret, Moment, NoteMoment, ResultatTri, SeuilsNoteInteret } from "@/briques/note-extraits";
import { momentsParles, contexteDeNote } from "@/briques/archive-extraits/moments-parles";
import { trierVideo } from "@/briques/archive-extraits/tri-video";
import { lireEntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";
import { reporterGestes, SEUIL_RECOUVREMENT } from "@/briques/archive-extraits/inscription";
import { EPS } from "@/lib/tolerance";

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

/** Réglage lu une fois par l'appelant (injecté) : l'empreinte n'existe que si la note est allumée. */
export async function etatNote(lire: LireReglageNoteInteret): Promise<{ actif: boolean; seuils: SeuilsNoteInteret; empreinte?: string }> {
  const { actif, seuils } = await lireNoteInteret(lire);
  return actif ? { actif, seuils, empreinte: empreinteNote(seuils) } : { actif, seuils };
}

export interface EntreeNote {
  video: Pick<Video, "titre" | "typeAutomatisation" | "couvertureVignette">;
  version: Pick<VersionVideo, "commande" | "projetMontage">;
  ancienne: FicheSourceExtraits | null;
}

function momentsEcran(version: EntreeNote["version"]): Moment[] {
  const plan = version.projetMontage?.plan;
  if (version.commande?.entrees?.demoFacecam) {
    const r = momentsEcranDemo(lireEntreesDemo(version.commande), plan);
    // Calage non prouvé : aucun moment écran (prudent).
    return r.decisionMax === "garde" ? r.moments : [];
  }
  return momentsDepuisScenes(plan, { avecVisage: true });
}

/** Pose la note sur la fiche du chantier 3. Jamais d'exception : en cas d'erreur, la fiche est rendue inchangée. */
export async function appliquerNote(
  fiche: FicheSourceExtraits,
  entree: EntreeNote,
  seuils: SeuilsNoteInteret,
  ports: { journal: (message: string) => Promise<void> },
): Promise<FicheSourceExtraits> {
  try {
    const moments = [...momentsParles(fiche), ...momentsEcran(entree.version)];
    const chiffresReels = (entree.ancienne ?? fiche).chiffresReels === true;
    const tri = trierVideo(moments, contexteDeNote({ video: entree.video }), seuils, {
      etiqueter: (m) => usagesDe(m, { chiffresReels }),
    });
    const notee = ficheAvecTri({ ...fiche, plages: entree.ancienne?.plages ?? fiche.plages }, tri, seuils);
    return entree.ancienne?.chiffresReels === true ? { ...notee, chiffresReels: true } : notee;
  } catch (e) {
    const nom = e instanceof Error ? e.name : "erreur";
    try {
      await ports.journal(`Extraits : note non calculée (${nom})`);
    } catch {
      /* le journal ne doit jamais faire remonter d'exception */
    }
    return fiche;
  }
}
