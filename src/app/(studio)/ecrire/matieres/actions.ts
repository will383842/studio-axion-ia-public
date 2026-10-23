"use server";

/** Actions de l'onglet « Matières » (générateur, lot G2). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { Id, Matiere, Preuve, TypeMatiere } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import {
  ajouterMatiere,
  basculerAccordMatiere,
  changerTypeMatiere,
  confirmerMatiere,
  definirNomsSensibles,
  ecarterMatiere,
  enregistrerEnVrac,
  listerVersionsTouchees,
  marquerFrequente,
  noterDeprogrammee,
  proposerDecoupe,
  rangerPourMoi,
  reglerRappelHebdo,
  retirerMatiere,
  type ImpactRetrait,
  type MatiereAjoutee,
  type MorceauPropose,
  type MotifRetrait,
  type SaisieMatiere,
} from "@/services/matieres";
import { ajouterPreuve, basculerAccordPreuve, retirerPreuve, validerANePasDire, type AccordPreuve, type PreuveAjoutee } from "@/services/preuves";
import { marquerPosition } from "@/services/contexte-axion";

const CHEMINS = ["/ecrire/matieres", "/ecrire", "/ecrire/voix"];
function rafraichir() {
  for (const c of CHEMINS) revalidatePath(c);
}

async function agir<T>(f: () => Promise<T>): Promise<Resultat<T>> {
  await exigerSession();
  const r = await essayer(f);
  if (r.ok) rafraichir();
  return r;
}

export async function ajouterMatiereAction(m: SaisieMatiere): Promise<Resultat<MatiereAjoutee>> {
  return agir(() => ajouterMatiere(m));
}

export async function proposerDecoupeAction(dictee: string): Promise<Resultat<MorceauPropose[]>> {
  await exigerSession();
  return essayer(() => proposerDecoupe(dictee));
}

export async function rangerPourMoiAction(dictee: string): Promise<Resultat<{ morceaux: MorceauPropose[]; rejetes: string[]; simule: true }>> {
  await exigerSession();
  return essayer(() => rangerPourMoi(dictee));
}

/** E2E-1 n° 13 : chaque morceau garde les noms masqués et l'accord choisis sur la feuille. */
export async function enregistrerEnVracAction(dictee: string, morceaux: { texte: string; type: TypeMatiere; nomsSensibles?: string[]; accord?: boolean }[], rangePar: "code" | "machine"): Promise<Resultat<number>> {
  return agir(async () => (await enregistrerEnVrac(dictee, morceaux, { rangePar })).length);
}

export async function changerTypeAction(id: Id, type: TypeMatiere): Promise<Resultat<Matiere>> {
  return agir(() => changerTypeMatiere(id, type));
}

export async function basculerAccordAction(id: Id, obtenu: boolean): Promise<Resultat<Matiere>> {
  return agir(() => basculerAccordMatiere(id, obtenu));
}

export async function confirmerMatiereAction(id: Id): Promise<Resultat<Matiere>> {
  return agir(() => confirmerMatiere(id));
}

/** « Écarter » une matière proposée depuis votre site : rangée, jamais effacée. */
export async function ecarterMatiereAction(id: Id): Promise<Resultat<Matiere>> {
  return agir(() => ecarterMatiere(id));
}

export async function nomsSensiblesAction(id: Id, noms: string[]): Promise<Resultat<Matiere>> {
  return agir(() => definirNomsSensibles(id, noms));
}

export async function frequenteAction(id: Id, oui: boolean): Promise<Resultat<Matiere>> {
  return agir(() => marquerFrequente(id, oui));
}

export async function positionAction(id: Id, oui: boolean): Promise<Resultat> {
  return agir(async () => {
    await marquerPosition(id, oui);
    return undefined;
  });
}

export async function retirerMatiereAction(id: Id, motif: MotifRetrait): Promise<Resultat<ImpactRetrait>> {
  return agir(() => retirerMatiere(id, motif));
}

export async function versionsToucheesAction(cible: { matiereIds: Id[]; preuveIds: Id[] }): Promise<Resultat<ImpactRetrait>> {
  await exigerSession();
  return essayer(() => listerVersionsTouchees(cible));
}

export async function deprogrammeeAction(publicationId: Id): Promise<Resultat> {
  return agir(async () => {
    await noterDeprogrammee(publicationId);
    return undefined;
  });
}

export async function rappelHebdoAction(actif: boolean): Promise<Resultat> {
  return agir(async () => {
    await reglerRappelHebdo(actif);
    return undefined;
  });
}

/* --- Preuves -------------------------------------------------------- */

export async function ajouterPreuveAction(enonce: string, peutDire: string[]): Promise<Resultat<PreuveAjoutee>> {
  return agir(() => ajouterPreuve({ enonce, peutDire }));
}

export async function aNePasDireAction(id: Id, texte: string): Promise<Resultat<Preuve>> {
  return agir(() => validerANePasDire(id, texte));
}

export async function accordPreuveAction(id: Id, accord: AccordPreuve, valeur: boolean): Promise<Resultat<Preuve>> {
  return agir(() => basculerAccordPreuve(id, accord, valeur));
}

export async function retirerPreuveAction(id: Id, motif: MotifRetrait): Promise<Resultat<ImpactRetrait>> {
  return agir(() => retirerPreuve(id, motif));
}
