"use server";

/** Actions serveur de Réglages (groupe C). Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { IdReseau, MentionIA } from "@/domaine/types";
import type { TypeFournisseur } from "@/fournisseurs";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { changerMotDePasse, exigerSession, revoquerSession } from "@/services/auth";
import { definirFournisseur } from "@/services/C-videos-publication-complements";
import { definirBudget, definirTauxUsdEur } from "@/services/couts";
import { declarerRecharge, testerConnexionCredit } from "@/services/credits";
import type { TestConnexion } from "@/fournisseurs/types";
import { definirAfficherExemples, definirJeLisReel, definirMontageReel, definirMentionIA, definirNotifications, definirReseauxParDefaut, type PreferencesNotifications } from "@/services/reglages";
import { definirRenduDouble } from "@/services/rendu-double";
import { ajouterPageSuivie, relireMaintenant, reglerSite, retirerPageSuivie } from "@/services/source-axion";
import { envoyerEssai, type ResultatEssai } from "@/services/notifications";
import { definirFamille } from "@/services/hashtags";

function rafraichir() {
  revalidatePath("/reglages");
}

export async function changerMotDePasseAction(ancien: string, nouveau: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await changerMotDePasse(ancien, nouveau);
    rafraichir();
    return undefined;
  });
}

export async function revoquerSessionAction(id: string): Promise<Resultat> {
  const courante = await exigerSession();
  return essayer(async () => {
    if (id === courante.id) throw new ErreurStudio("SESSION_COURANTE", "C'est l'appareil que vous utilisez.");
    await revoquerSession(id);
    rafraichir();
    return undefined;
  });
}

export async function definirFournisseurAction(type: TypeFournisseur, valeur: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirFournisseur(type, valeur);
    rafraichir();
    return undefined;
  });
}

/** Lot R6 : vidéos « je lis » d'un format montées pour de vrai (carte Montage). */
export async function definirJeLisReelAction(formatId: string, allume: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirJeLisReel(formatId, allume);
    rafraichir();
    return undefined;
  });
}

/** Lot R8 : « Montage réel des vidéos avocat » allumé (prix vu) ou retour en essai (carte Montage). */
export async function definirMontageReelAction(formatId: string, allume: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirMontageReel(formatId, allume);
    rafraichir();
    return undefined;
  });
}

export async function definirBudgetAction(mensuelEuros: number, seuilEuros: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (!Number.isFinite(mensuelEuros) || mensuelEuros < 0 || mensuelEuros > 100000) throw new ErreurStudio("BUDGET_INVALIDE", "Indiquez un budget entre 0 et 100 000 €.");
    if (!Number.isFinite(seuilEuros) || seuilEuros < 0) throw new ErreurStudio("SEUIL_INVALIDE", "Indiquez un seuil valable.");
    await definirBudget(Math.round(mensuelEuros * 100), Math.round(seuilEuros * 100));
    rafraichir();
    revalidatePath("/");
    return undefined;
  });
}

/** Taux dollar → euro des tarifs des outils (figé dans chaque commande au lancement). */
export async function definirTauxAction(taux: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirTauxUsdEur(taux);
    rafraichir();
    return undefined;
  });
}

export async function definirMentionIAAction(mention: MentionIA): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const texte = mention.texte.trim();
    if (!texte) throw new ErreurStudio("MENTION_VIDE", "La mention ne peut pas être vide.");
    // La mention suit le réglage de Will, sans forçage (décision du 01/10 : facultative, coupée par défaut).
    await definirMentionIA({ ...mention, texte: texte.slice(0, 60) });
    rafraichir();
    return undefined;
  });
}

export async function definirReseauxParDefautAction(reseaux: IdReseau[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirReseauxParDefaut(reseaux);
    rafraichir();
    return undefined;
  });
}

export async function definirNotificationsAction(p: PreferencesNotifications): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirNotifications(p);
    rafraichir();
    return undefined;
  });
}

export async function definirAfficherExemplesAction(valeur: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirAfficherExemples(valeur);
    revalidatePath("/", "layout");
    return undefined;
  });
}

/** « Tester la connexion » d'une clé de service payant (lecture gratuite) : statut et 4 derniers caractères. */
export async function testerConnexionAction(fournisseur: string): Promise<Resultat<TestConnexion>> {
  await exigerSession();
  return essayer(async () => {
    const r = await testerConnexionCredit(String(fournisseur));
    rafraichir();
    return r;
  });
}

/** « J'ai rechargé » : montant en dollars ; les vidéos en attente de ce crédit repartent. */
export async function declarerRechargeAction(fournisseur: string, dollars: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 10000) throw new ErreurStudio("MONTANT_INVALIDE", "Indiquez un montant entre 0,01 et 10 000.");
    await declarerRecharge(String(fournisseur), Math.round(dollars * 100));
    rafraichir();
    revalidatePath("/");
    return undefined;
  });
}

/* --- Votre site (Source axion-ia.com, 03/10) ------------------------- */

export async function reglerSiteAction(actif: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await reglerSite(actif);
    rafraichir();
    return undefined;
  });
}

export async function ajouterPageSuivieAction(adresse: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ajouterPageSuivie(adresse);
    rafraichir();
    return undefined;
  });
}

export async function retirerPageSuivieAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await retirerPageSuivie(id);
    rafraichir();
    return undefined;
  });
}

export async function relireSiteAction(): Promise<Resultat<{ lancee: boolean; message: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await relireMaintenant();
    rafraichir();
    return r;
  });
}

/** « Envoyer un essai » (lot R3) : UN message sur le téléphone ou par e-mail. Le service vérifie le canal. */
export async function envoyerEssaiNotificationAction(canal: "telephone" | "email"): Promise<Resultat<ResultatEssai>> {
  await exigerSession();
  return essayer(async () => {
    const r = await envoyerEssai(canal);
    rafraichir();
    return r;
  });
}

/** Lot R7e : « Votre avatar parle dans le studio » (éteint par défaut) et son fond. */
export async function definirRenduDoubleAction(reglage: { allume?: boolean; fond?: "sans-fond" | "uni" }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirRenduDouble({ allume: reglage.allume, fond: reglage.fond });
    rafraichir();
    return undefined;
  });
}

/** Correcteur réel 2 (F1) : « Créer vos décors avec HeyGen » (éteint par défaut). */
export async function definirLooksStudioAction(allume: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const { definirLooksStudio } = await import("@/services/rendu-double");
    await definirLooksStudio(allume === true);
    rafraichir();
    return undefined;
  });
}

/** Équipe 7 : « Vos hashtags » d'un réseau (Réglages › Mes réseaux). */
export async function definirFamilleAction(reseau: IdReseau, liste: string[]): Promise<Resultat<string[]>> {
  await exigerSession();
  return essayer(async () => {
    const r = await definirFamille(reseau, liste);
    rafraichir();
    return r;
  });
}
