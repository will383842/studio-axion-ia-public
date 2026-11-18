"use server";

/**
 * CAL-23 (écrite EN AVANCE, attend RC-08a) : déplacer ou modifier le texte d'une publication DÉJÀ PROGRAMMÉE.
 * Chaque action commence par exigerSession(). Rien ne part d'ici : aucun fournisseur n'est importé ; le service fait « annuler puis recréer »
 * (retrait confirmé, nouvelle clé d'envoi) ou, tant que le retrait n'est pas branché, un déplacement local marqué « à vérifier ».
 * Un changement de texte exige un nouveau clic Valider : l'entrée repasse « À valider ».
 */
import { revalidatePath } from "next/cache";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { essayer, ErreurStudio, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { CODES_RETRAIT, retirerProgrammationServeur } from "@/services/retirer-programmation";
import { CODES_DEPLACEMENT, deplacerProgrammationServeur, modifierTexteProgrammeServeur, type ResultatDeplacement } from "@/services/deplacer-programmation";

const NON_DEPLACABLE = "Seule une publication programmée d'un créneau se déplace d'ici.";
const CLE_FORMULAIRE = /^[A-Za-z0-9_-]{1,64}$/;

/** Ce que l'écran reçoit : la phrase à afficher et si la page doit se rafraîchir. */
export interface DonneesDeplacement {
  creneauId: string;
  message: string;
}

function conclure(r: ResultatDeplacement): DonneesDeplacement {
  if (!r.ok) {
    if (r.ecritures) revalidatePath("/calendrier"); // retrait partiel ou retour dans « À placer » : l'écran doit refléter ce qui a bougé
    throw new ErreurStudio(CODES_DEPLACEMENT[r.etat], r.message);
  }
  revalidatePath("/calendrier");
  return { creneauId: r.creneauId, message: r.message };
}

/** Déplace une publication programmée au jour choisi (l'heure de Paris de chaque réseau est gardée). */
export async function deplacerProgrammationAction(cle: string, nouveauJour: string, cleFormulaire: string): Promise<Resultat<DonneesDeplacement>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      const k = lireCleFiche(cle);
      if (k?.origine !== "creneau") throw new ErreurStudio("DEPLACEMENT_REFUSE", NON_DEPLACABLE);
      if (typeof cleFormulaire !== "string" || !CLE_FORMULAIRE.test(cleFormulaire)) throw new ErreurStudio("DEPLACEMENT_REFUSE", "Rechargez la page, puis réessayez.");
      return conclure(await deplacerProgrammationServeur({ creneauId: k.id, nouveauJour, cle: cleFormulaire }));
    }),
  );
}

export interface SaisieTexteProgramme {
  texte: string;
  premierCommentaire?: string;
  cleFormulaire: string;
}

/**
 * Change le texte (ou le premier commentaire) d'une publication programmée. La session est celle du fondateur : l'auteur est « will », donc
 * l'entrée repasse « À valider » et attend son clic Valider (qui réécrit la date de validation).
 */
export async function modifierTexteProgrammeAction(cle: string, saisie: SaisieTexteProgramme): Promise<Resultat<DonneesDeplacement>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      const k = lireCleFiche(cle);
      if (k?.origine !== "creneau") throw new ErreurStudio("DEPLACEMENT_REFUSE", NON_DEPLACABLE);
      if (typeof saisie?.cleFormulaire !== "string" || !CLE_FORMULAIRE.test(saisie.cleFormulaire)) throw new ErreurStudio("DEPLACEMENT_REFUSE", "Rechargez la page, puis réessayez.");
      return conclure(await modifierTexteProgrammeServeur({ creneauId: k.id, reseau: k.reseau, texte: saisie.texte, premierCommentaire: saisie.premierCommentaire, auteur: "will", cle: saisie.cleFormulaire }));
    }),
  );
}

/**
 * Adaptateur pour le formulaire de la fiche (`texteProgrammeModifiable`) : lit `cle`, `texte`, `premierCommentaire`. La clé de rejeu vient du
 * contenu envoyé : le même envoi rejoué ne refait rien, un autre contenu est une nouvelle demande. L'hôte affiche le refus (`erreur`).
 * Aucun hôte ne passe encore `texteProgrammeModifiable` : l'écran est livré ÉTEINT, il sera branché par une fiche dédiée après CAL-22.
 */
export async function modifierTexteProgrammeDepuisFormulaire(formulaire: FormData): Promise<Resultat<DonneesDeplacement>> {
  await exigerSession();
  const lire = (nom: string): string | undefined => {
    const v = formulaire.get(nom);
    return typeof v === "string" ? v : undefined;
  };
  const cle = lire("cle") ?? "";
  const texte = lire("texte") ?? "";
  const premierCommentaire = lire("premierCommentaire");
  let h = 5381;
  for (const c of `${cle}|${texte}|${premierCommentaire ?? ""}`) h = ((h * 33) ^ c.codePointAt(0)!) >>> 0;
  return modifierTexteProgrammeAction(cle, { texte, ...(premierCommentaire !== undefined ? { premierCommentaire } : {}), cleFormulaire: `f${h.toString(36)}` });
}

/**
 * « Retirer » une publication programmée depuis l'aperçu (CAL-23). Même service et mêmes codes que `retirerProgrammationAction` (CAL-22) ;
 * seule différence : au SUCCÈS elle ne rafraîchit pas la page. Sinon le créneau archivé sortirait du calendrier, l'aperçu se fermerait et
 * emporterait le message et le bouton « Annuler » (10 secondes) : l'écran rafraîchit lui-même, à la fin du délai ou à la fermeture.
 * Un retrait partiel (écritures déjà faites) rafraîchit tout de suite, comme CAL-22.
 */
export async function retirerProgrammationDepuisApercuAction(cle: string, confirmation: string): Promise<Resultat<{ creneauId: string; annulableJusquA: string; message: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      if (confirmation !== "retirer") throw new ErreurStudio("RETRAIT_A_CONFIRMER", "Confirmez d'abord le retrait.");
      const k = lireCleFiche(cle);
      if (k?.origine !== "creneau") throw new ErreurStudio("RETRAIT_REFUSE", "Seule une publication programmée d'un créneau se retire d'ici.");
      const r = await retirerProgrammationServeur(k.id);
      if (!r.ok) {
        if (r.ecritures) revalidatePath("/calendrier");
        throw new ErreurStudio(CODES_RETRAIT[r.etat], r.message);
      }
      return { creneauId: r.creneauId, annulableJusquA: r.annulableJusquA, message: r.message };
    }),
  );
}
