"use server";

/**
 * CAL-24 (écrite EN AVANCE, attend CAL-22, CAL-23 et RC-08a) : dupliquer une publication vers un autre réseau ou une autre date.
 * Chaque action commence par exigerSession(). Rien ne part d'ici : aucun fournisseur n'est importé, aucun envoi n'est créé.
 * La copie est une NOUVELLE entrée « propose » créée par le chemin normal du calendrier (creerCreneau), sans date de validation : elle attend
 * le clic Valider du fondateur. Son texte est marqué « À adapter ». L'original n'est jamais modifié ni supprimé ; le lien vers lui est gardé.
 * Une date dans le passé avertit et se confirme d'un clic (comme un ajout manuel).
 */
import { revalidatePath } from "next/cache";
import { lireCleFiche, type EntreeFiche } from "@/components/calendrier/FicheEntree";
import { cleLienCopie, idCopie, marquerAAdapter } from "@/domaine/calendrier/lien-reseau";
import type { IdReseau } from "@/domaine/types";
import { resoudreHeureParis } from "@/lib/horloge-paris";
import { exigerSession } from "@/services/auth";
import { depots, ecrireParametre, ErreurStudio, lireParametre, maintenant, sousVerrou } from "@/services/_commun";
import { chargerFiche, ecrireStockageFiche } from "@/services/calendrier-fiche";
import { creerCreneau, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { reseauConnu } from "@/components/calendrier/CarteEntreeCalendrier";
import { compteCibleValide } from "../compte-cible";

export interface SaisieDuplication {
  /** Clé de la carte d'origine : « creneau:<id>|<réseau> » ou « publication:<id>|<réseau> ». */
  cle: string;
  /** Réseau de la copie. */
  reseau: IdReseau;
  /** AAAA-MM-JJ (jour de Paris). */
  jour: string;
  /** HH:MM à Paris ; par défaut l'heure de l'original, sinon 09:00. */
  heure?: string;
  /** Clé stable du formulaire ouvert (idempotence : un double clic ne crée qu'une copie). */
  cleFormulaire: string;
  /** Vrai après le clic de confirmation d'une date passée. */
  confirmerPasse?: boolean;
}

export interface DonneesDuplication {
  creneauId: string;
  /** Clé de carte de la copie. */
  cle: string;
  message: string;
  /** Phrase en plus, par exemple quand l'heure choisie n'existe pas ce jour-là (changement d'heure). */
  avertissement?: string;
}

export type ResultatDuplication =
  | { ok: true; donnees: DonneesDuplication }
  | { ok: false; message: string; aConfirmer?: "passe"; avertissement?: string };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLE_FORMULAIRE = /^[A-Za-z0-9_-]{1,64}$/;
const COMPTE_PAR_DEFAUT = "compte-studio";

export const PHRASES_DUPLICATION = {
  jour: "Jour invalide : choisissez un jour qui existe.",
  heure: "Heure invalide : écrivez par exemple 09:00.",
  reseau: "Choisissez le réseau de la copie.",
  formulaire: "Rechargez la page, puis réessayez.",
  original: "Cette publication est introuvable dans le calendrier. Rechargez la page.",
  identique: "Cette copie serait identique à la publication : choisissez un autre réseau ou un autre jour.",
  autreDemande: "Ce formulaire a déjà créé une copie différente : rouvrez-le pour en faire une autre.",
  passe: "Cette date est passée : confirmez pour créer la copie quand même.",
  creee: "La copie est créée. Son texte est marqué « À adapter » : relisez-le, puis validez-la. Elle ne part pas toute seule.",
  impossible: "La copie n'a pas pu être créée. Réessayez.",
} as const;

function jourExiste(j: string): boolean {
  const [a, m, d] = j.split("-").map(Number);
  const t = new Date(Date.UTC(a!, m! - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d;
}

function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

/** Compte du réseau de la copie : celui de l'original s'il est sur le même réseau, sinon le compte relié de ce réseau (lecture seule). */
async function compteDeLaCopie(reseau: IdReseau, original: CreneauPlan | null, reseauOriginal: IdReseau): Promise<string> {
  if (original && reseau === reseauOriginal && compteCibleValide(original.compteCible)) return original.compteCible;
  try {
    const { comptesCibles } = await import("../charger-comptes");
    const trouve = (await comptesCibles([reseau]))[reseau];
    return compteCibleValide(trouve) ? trouve : COMPTE_PAR_DEFAUT;
  } catch {
    return COMPTE_PAR_DEFAUT;
  }
}

function texteOriginal(entree: EntreeFiche, original: CreneauPlan | null, reseau: IdReseau): { texte: string; premierCommentaire: string } {
  const garde = original?.textes?.[reseau];
  return { texte: entree.texte || garde?.texte || "", premierCommentaire: entree.premierCommentaire || garde?.premierCommentaire || "" };
}

/**
 * Crée la copie. Rien n'est écrit tant qu'une règle refuse. Seul l'identifiant de la copie est écrit par la clé du formulaire :
 * le même formulaire rend la même copie, un autre contenu est refusé.
 */
export async function dupliquerEntree(saisie: SaisieDuplication): Promise<ResultatDuplication> {
  await exigerSession();
  const refus = (message: string): ResultatDuplication => ({ ok: false, message });
  if (typeof saisie?.jour !== "string" || !JOUR.test(saisie.jour) || !jourExiste(saisie.jour)) return refus(PHRASES_DUPLICATION.jour);
  if (saisie.heure !== undefined && (typeof saisie.heure !== "string" || !HEURE.test(saisie.heure))) return refus(PHRASES_DUPLICATION.heure);
  if (typeof saisie.reseau !== "string" || !reseauConnu(saisie.reseau)) return refus(PHRASES_DUPLICATION.reseau);
  if (typeof saisie.cleFormulaire !== "string" || !CLE_FORMULAIRE.test(saisie.cleFormulaire)) return refus(PHRASES_DUPLICATION.formulaire);
  const k = lireCleFiche(saisie.cle);
  if (!k) return refus(PHRASES_DUPLICATION.original);
  try {
    return await sousVerrou(async () => {
      const fiche = await chargerFiche(saisie.cle);
      const original = fiche.source.origine === "creneau" ? (fiche.source.creneau as CreneauPlan) : null;
      const publication = fiche.source.origine === "publication" ? fiche.source.publication : null;
      const videoId = original?.videoId ?? publication?.videoId;
      const visuelId = original?.visuelId ?? publication?.visuelId;
      const heure = saisie.heure ?? fiche.entree.heure ?? "09:00";
      const { instant, avertissement } = resoudreHeureParis(saisie.jour, heure);
      const id = idCopie(saisie.cleFormulaire);
      const existant = await depots().creneauxEditoriaux.obtenir(id);
      const cleCopie = { cle: `creneau:${id}|${saisie.reseau}`, origine: "creneau" as const, id, reseau: saisie.reseau };
      const retour = (): ResultatDuplication => ({ ok: true, donnees: { creneauId: id, cle: cleCopie.cle, message: PHRASES_DUPLICATION.creee, ...(avertissement ? { avertissement } : {}) } });
      if (existant) {
        const lien = await lireParametre<string | null>(cleLienCopie(id), null);
        const memeDemande = (lien === null || lien === saisie.cle) && existant.jourVise === saisie.jour && Object.keys(existant.heuresParReseau).join() === saisie.reseau;
        if (!memeDemande) return refus(PHRASES_DUPLICATION.autreDemande);
        // Rejeu après une écriture interrompue : on termine ce qui manque (fiche et lien), sans rien recréer.
        const texte = existant.textes?.[saisie.reseau];
        if (texte) await ecrireStockageFiche(cleCopie, texte);
        if (lien === null) await ecrireParametre(cleLienCopie(id), saisie.cle);
        return retour();
      }
      if (saisie.reseau === fiche.entree.reseau && saisie.jour === fiche.entree.jour) return refus(PHRASES_DUPLICATION.identique);
      if (Date.parse(instant) < Date.now() && !saisie.confirmerPasse) {
        return { ok: false as const, message: "Date dans le passé : à confirmer.", aConfirmer: "passe" as const, avertissement: PHRASES_DUPLICATION.passe };
      }
      const textes = texteOriginal(fiche.entree, original, fiche.entree.reseau);
      const copieTexte = { texte: marquerAAdapter(textes.texte), premierCommentaire: textes.premierCommentaire };
      // Le lien est écrit AVANT la copie : une copie n'existe jamais sans lien, et un rejeu reprend là où l'écriture s'est arrêtée.
      await ecrireParametre(cleLienCopie(id), saisie.cle);
      await creerCreneau(
        depotsPlan(),
        {
          id,
          jourVise: saisie.jour,
          heuresParReseau: { [saisie.reseau]: instant },
          compteCible: await compteDeLaCopie(saisie.reseau, original, fiche.entree.reseau),
          ...(videoId ? { videoId } : {}),
          ...(visuelId && !videoId ? { visuelId } : {}),
          origine: "vous" as const,
          textes: { [saisie.reseau]: copieTexte },
        },
        maintenant(),
      );
      // Le texte est aussi rangé là où la fiche le lit. Rien d'autre n'est écrit : ni l'original, ni un envoi.
      await ecrireStockageFiche(cleCopie, copieTexte);
      try { revalidatePath("/calendrier"); } catch { /* le rafraîchissement est secondaire : l'écriture a eu lieu */ }
      return retour();
    });
  } catch (e) {
    if (e instanceof ErreurStudio) return refus(e.message);
    return refus(PHRASES_DUPLICATION.impossible);
  }
}
