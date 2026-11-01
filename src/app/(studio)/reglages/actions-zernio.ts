"use server";

/**
 * Actions serveur de l'écran « Connexions Zernio » (lot Z3-C). Chacune commence par exigerSession().
 * Seul « tester » parle à Zernio (lecture seule) ; l'arrêt d'urgence n'agit que sur un interrupteur LOCAL du Studio
 * (`zernio.envoi_autorise`) : il ne supprime rien et n'appelle jamais Zernio. Aucune clé ne sort d'ici.
 * Les montants du budget sont de l'information : rien ici ne les compare à un envoi.
 */
import { revalidatePath } from "next/cache";
import { OUTILS, type OutilPublication } from "@/domaine/outil-publication";
import type { IdReseau, ModeEnvoiPublication } from "@/domaine/types";
import { serviceBuffer } from "@/domaine/buffer";
import { clientZernio, cleZernioPresente, comptesZernioEnregistres, testerZernio } from "@/services/zernio";
import { canauxEnregistres } from "@/services/buffer";
import { definirRoutage, lireRoutage } from "@/services/routage-publication";
import { ecrireParametre, ErreurStudio, essayer, journaliser, lireParametre, maintenant, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { outilPour } from "@/domaine/outil-publication";

export const PARAM_ARRET_ZERNIO = "zernio.envoi_autorise";
const PARAM_MODES = "zernio.mode_envoi";
const PARAM_BASCULES = "zernio.bascules";
const PARAM_TESTS = "zernio.tests";
const PARAM_BUDGET = "zernio.budget_info";
const RESEAUX_CONNUS: readonly IdReseau[] = ["instagram", "facebook", "linkedin", "tiktok"];

export interface CompteVue {
  /** Identifiant d'affichage (jamais l'identifiant du fournisseur). */
  code: string;
  reseau: IdReseau;
  nom: string;
  relie: boolean;
  outil: OutilPublication;
  mode: ModeEnvoiPublication;
  existeChezBuffer: boolean;
  basculeLe: string | null;
  dernierTest: string | null;
}

export interface BudgetInfo {
  /** Montants de configuration, pour information seulement : jamais comparés à un envoi. */
  zernio: number | null;
  buffer: number | null;
  finBuffer: string;
}

export interface EtatConnexionsZernio {
  cleAbsente: boolean;
  arretActif: boolean;
  comptes: CompteVue[];
  budget: BudgetInfo;
}

/** Ce que l'écran appelle. Tests : un faux service ; production : les actions ci-dessous. */
export interface ServicesZernio {
  lire(): Promise<Resultat<EtatConnexionsZernio>>;
  tester(): Promise<Resultat<{ message: string }>>;
  changerRoutage(reseau: IdReseau, outil: OutilPublication): Promise<Resultat>;
  changerMode(reseau: IdReseau, mode: ModeEnvoiPublication): Promise<Resultat>;
  arreter(): Promise<Resultat>;
  reprendre(): Promise<Resultat>;
}

const ORDRE = (r: string): number => {
  const i = RESEAUX_CONNUS.indexOf(r as IdReseau);
  return i < 0 ? 99 : i;
};

function rafraichir() {
  revalidatePath("/reglages");
}

function nombreOuNul(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Lecture en base seulement : afficher l'écran n'appelle jamais Zernio. */
export async function lireConnexionsZernioAction(): Promise<Resultat<EtatConnexionsZernio>> {
  await exigerSession();
  return essayer(async () => {
    const [enregistres, routage, canaux, modes, bascules, tests, budgetBrut, autorise] = await Promise.all([
      comptesZernioEnregistres(),
      lireRoutage(),
      canauxEnregistres(),
      lireParametre<Record<string, string>>(PARAM_MODES, {}),
      lireParametre<Record<string, string>>(PARAM_BASCULES, {}),
      lireParametre<Record<string, { testeLe: string; actif: boolean }>>(PARAM_TESTS, {}),
      lireParametre<Partial<BudgetInfo> | null>(PARAM_BUDGET, null),
      lireParametre<boolean>(PARAM_ARRET_ZERNIO, true),
    ]);
    const comptes: CompteVue[] = (enregistres?.comptes ?? [])
      .filter((c) => RESEAUX_CONNUS.includes(c.reseau as IdReseau))
      .map((c, i) => {
        const reseau = c.reseau as IdReseau;
        const test = tests[c.id];
        return {
          code: `${reseau}-${i + 1}`,
          reseau,
          nom: c.nom,
          relie: test ? test.actif : true,
          outil: outilPour(routage, reseau),
          mode: modes[reseau] === "programmer" ? "programmer" : "brouillon",
          existeChezBuffer: !!canaux?.canaux.some((x) => x.service === serviceBuffer(reseau)),
          basculeLe: bascules[reseau] ?? null,
          dernierTest: test?.testeLe ?? null,
        } satisfies CompteVue;
      })
      .sort((a, b) => ORDRE(a.reseau) - ORDRE(b.reseau) || a.nom.localeCompare(b.nom, "fr"));
    const budget: BudgetInfo = { zernio: nombreOuNul(budgetBrut?.zernio), buffer: nombreOuNul(budgetBrut?.buffer), finBuffer: typeof budgetBrut?.finBuffer === "string" ? budgetBrut.finBuffer : "20/11" };
    return { cleAbsente: !cleZernioPresente(), arretActif: autorise === false, comptes, budget };
  });
}

/** « Tester les 6 comptes » : lecture seule chez Zernio. Sans clé : message simple, aucune exception. */
export async function testerComptesZernioAction(): Promise<Resultat<{ message: string }>> {
  await exigerSession();
  if (!cleZernioPresente()) return { ok: true, donnees: { message: "Zernio n'est pas encore relié : l'écran fonctionne en essai." } };
  return essayer(async () => {
    const r = await testerZernio();
    const liste = await clientZernio().listerComptes();
    const testeLe = maintenant();
    const tests: Record<string, { testeLe: string; actif: boolean }> = {};
    for (const c of liste) tests[c._id] = { testeLe, actif: c.isActive !== false };
    await ecrireParametre(PARAM_TESTS, tests);
    rafraichir();
    return { message: r.message };
  });
}

export async function changerRoutageZernioAction(reseau: IdReseau, outil: OutilPublication): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (!(OUTILS as readonly string[]).includes(outil)) throw new ErreurStudio("OUTIL_INCONNU", "Outil inconnu.");
    await definirRoutage(reseau, outil);
    const bascules = await lireParametre<Record<string, string>>(PARAM_BASCULES, {});
    await ecrireParametre(PARAM_BASCULES, { ...bascules, [reseau]: maintenant() });
    rafraichir();
    return undefined;
  });
}

export async function changerModeZernioAction(reseau: IdReseau, mode: ModeEnvoiPublication): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (mode !== "brouillon" && mode !== "programmer") throw new ErreurStudio("MODE_INCONNU", "Choix inconnu.");
    if (!RESEAUX_CONNUS.includes(reseau)) throw new ErreurStudio("RESEAU_INCONNU", "Réseau inconnu.");
    const modes = await lireParametre<Record<string, string>>(PARAM_MODES, {});
    await ecrireParametre(PARAM_MODES, { ...modes, [reseau]: mode });
    await journaliser("reglages", `Zernio : ${reseau} part en ${mode === "brouillon" ? "brouillon d'abord" : "programmation"}`);
    rafraichir();
    return undefined;
  });
}

/** Interrupteur local : coupe les envois sans rien supprimer, ne contacte jamais Zernio. */
export async function arreterToutAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ecrireParametre(PARAM_ARRET_ZERNIO, false);
    await journaliser("reglages", "Arrêt d'urgence : les envois sont coupés");
    rafraichir();
    return undefined;
  });
}

export async function reprendreToutAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    await journaliser("reglages", "Reprise : les envois sont rétablis");
    rafraichir();
    return undefined;
  });
}
