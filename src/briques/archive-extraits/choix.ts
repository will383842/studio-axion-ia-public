/**
 * Archive des vidéos livrées (C3-UT-3.5) : les plages qu'une vidéo a le droit de montrer, et la recherche de l'écran.
 * Filtres de DROIT seulement : rien n'est noté, rien n'est classé (ordre reçu conservé). Pur : aucun service, aucune
 * date implicite (`maintenant` est fournie), aucun hasard. Défauts du droit : `EXTRAITS_PAR_DEFAUT`.
 * X4-11d : une fiche `attentePublication === true` ne donne que ses plages proposables avant publication (`attente-publication.ts`).
 */
import type { PlageExtrait } from "@/domaine/archive-extraits";
import { etatLicence } from "@/domaine/derivations";
import type { ElementBibliotheque, IdReseau, Ratio } from "@/domaine/types";
import { EXTRAITS_PAR_DEFAUT } from "../bibliotheque-video/profils/neutre";
import { cleUsageExtrait, type BlocExtraits, type IdCapacite } from "../bibliotheque-video/types";
import { plageProposableAvantPublication } from "./attente-publication";
import { motsClesDe } from "./mots-cles";

export interface DemandeExtraits {
  videoId: string;
  capacite: IdCapacite;
  reseaux: IdReseau[];
  /** Clés `extrait:<elementId>:<plageId>` déjà employées. */
  dejaUtilisees: string[];
  maintenant: Date;
  /** Absent = `EXTRAITS_PAR_DEFAUT`. */
  bloc?: BlocExtraits;
  dureeMinSec?: number;
}

export interface PlageDisponible {
  cle: string;
  elementId: string;
  videoId: string;
  ratio: Ratio;
  famille: string[];
  plage: PlageExtrait;
}

export function plagesDisponibles(elements: readonly ElementBibliotheque[], demande: DemandeExtraits): PlageDisponible[] {
  const bloc = demande.bloc ?? EXTRAITS_PAR_DEFAUT;
  const dureeMin = demande.dureeMinSec ?? bloc.dureeMinSec;
  const visageSurInstagram = !demande.reseaux.includes("instagram") || bloc.visageSurInstagram;
  const texteAccepte = bloc.texteIncrusteAccepte[demande.capacite] === true;
  const sortie: PlageDisponible[] = [];

  for (const e of elements) {
    if (e.valeur.type !== "source-extraits" || e.estDemo || e.archiveLe) continue;
    const fiche = e.valeur.fiche;
    if (fiche.rangee) continue;
    const l = fiche.licence;
    if (etatLicence(l, demande.maintenant) !== "ok" || !l.usageCommercial) continue;
    if (l.reseaux.length > 0 && !demande.reseaux.every((r) => l.reseaux.includes(r))) continue;
    if (demande.videoId === fiche.videoId || fiche.famille.includes(demande.videoId)) continue;
    if (bloc.uneSourceParVideo) {
      const prefixe = `extrait:${e.id}:`;
      if (demande.dejaUtilisees.some((c) => c.startsWith(prefixe))) continue;
    }
    for (const plage of fiche.plages) {
      if (plage.etat !== "utilisable") continue;
      if (fiche.attentePublication === true && !plageProposableAvantPublication(plage)) continue; // X4-11d
      if (plage.avecVisage && !visageSurInstagram) continue;
      if (plage.texteIncruste && !texteAccepte) continue;
      if (plage.finSec - plage.debutSec < dureeMin) continue;
      const cle = cleUsageExtrait(e.id, plage.id);
      if (demande.dejaUtilisees.includes(cle)) continue;
      sortie.push({ cle, elementId: e.id, videoId: fiche.videoId, ratio: fiche.ratio, famille: fiche.famille, plage });
    }
  }
  return sortie;
}

/** Recherche de l'écran : tous les états, fiches rangées comprises (l'écran filtre). Requête vide = `[]`. */
export function chercher(elements: readonly ElementBibliotheque[], requete: string): { elementId: string; plage: PlageExtrait }[] {
  const mots = motsClesDe(requete);
  if (mots.length === 0) return [];
  const sortie: { elementId: string; plage: PlageExtrait }[] = [];
  for (const e of elements) {
    if (e.valeur.type !== "source-extraits") continue;
    for (const plage of e.valeur.fiche.plages) {
      const connus = new Set([...plage.motsCles, ...motsClesDe(plage.texte)]);
      if (mots.every((m) => connus.has(m))) sortie.push({ elementId: e.id, plage });
    }
  }
  return sortie;
}
