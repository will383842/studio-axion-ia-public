"use server";
/** Réglages › Base de connaissances : interrupteurs « Le comité lit les idées de l'usine », « Lire la base du site » et « Gardien des chiffres », recherche et proposition de preuve. Session exigée. N'écrit jamais vers l'usine ni vers le site. */
import { revalidatePath } from "next/cache";
import { ecrireParametre, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";
import { controlerChiffresCles, REGLAGE_GARDIEN_CHIFFRES, type ResultatControle } from "@/services/gardien-chiffres";
import { chercherFaitsSite, REGLAGE_LECTURE_SITE, type ResultatLectureSite } from "@/services/kb-site";
import { proposerPreuveDepuisSite } from "@/services/preuves";

export async function definirSourceUsineAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (typeof valeur !== "boolean") throw new Error("valeur inconnue");
    await ecrireParametre(REGLAGE_SOURCE_USINE, valeur);
    revalidatePath("/reglages/base-connaissances");
    return undefined;
  });
}

/** Version formulaire de la page (boutons Allumer / Éteindre). */
export async function basculerSourceUsineFormulaire(donnees: FormData): Promise<void> {
  await definirSourceUsineAction(donnees.get("valeur") === "oui");
}

/** Interrupteur « Lire la base du site » (éteint par défaut). */
export async function definirLectureSiteAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (typeof valeur !== "boolean") throw new Error("valeur inconnue");
    await ecrireParametre(REGLAGE_LECTURE_SITE, valeur);
    revalidatePath("/reglages/base-connaissances");
    return undefined;
  });
}

export async function basculerLectureSiteFormulaire(donnees: FormData): Promise<void> {
  await definirLectureSiteAction(donnees.get("valeur") === "oui");
}

/** Recherche dans la base du site : un seul appel GET, jamais d'exception. */
export async function chercherFaitsSiteAction(q: unknown): Promise<Resultat<ResultatLectureSite>> {
  await exigerSession();
  return essayer(() => chercherFaitsSite(typeof q === "string" ? q : ""));
}

/** « Proposer comme preuve » : crée une preuve « a-valider » (jamais utilisée sans votre validation). */
export async function proposerPreuveSiteAction(fait: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await proposerPreuveDepuisSite(fait);
    revalidatePath("/reglages/base-connaissances");
    return undefined;
  });
}

/** Interrupteur « Gardien des chiffres » (éteint par défaut). */
export async function definirGardienChiffresAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (typeof valeur !== "boolean") throw new Error("valeur inconnue");
    await ecrireParametre(REGLAGE_GARDIEN_CHIFFRES, valeur);
    revalidatePath("/reglages/base-connaissances");
    return undefined;
  });
}

export async function basculerGardienChiffresFormulaire(donnees: FormData): Promise<void> {
  await definirGardienChiffresAction(donnees.get("valeur") === "oui");
}

/** « Vérifier maintenant » : compare les chiffres clés ; alerte par la cloche, ne bloque rien, ne montre aucune valeur. */
export async function verifierChiffresAction(): Promise<Resultat<ResultatControle>> {
  await exigerSession();
  return essayer(async () => {
    const r = await controlerChiffresCles();
    revalidatePath("/reglages/base-connaissances");
    return r;
  });
}

export async function verifierChiffresFormulaire(): Promise<void> {
  await verifierChiffresAction();
}
