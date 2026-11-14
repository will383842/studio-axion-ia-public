"use server";

/**
 * Actions serveur de l'écran « Connexions Zernio » (lot Z3-C). Chacune commence par exigerSession().
 * Seul « tester » parle à Zernio (lecture seule) ; l'arrêt d'urgence n'agit que sur un interrupteur LOCAL du Studio
 * (`zernio.envoi_autorise`) : il ne supprime rien et n'appelle jamais Zernio. Aucune clé ne sort d'ici.
 * Les montants du budget sont de l'information : rien ici ne les compare à un envoi.
 */
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { OUTILS, type OutilPublication } from "@/domaine/outil-publication";
import type { IdReseau, ModeEnvoiPublication } from "@/domaine/types";
import { serviceBuffer } from "@/domaine/buffer";
import { cleZernioPresente, comptesZernioEnregistres, editorialeActive, PARAM_ARRET_ZERNIO, PARAM_EDITORIALE_ACTIVE, PHRASE_EDITORIALE, PARAM_ENVOI_CALENDRIER, testerZernio } from "@/services/zernio";
import { canauxEnregistres } from "@/services/buffer";
import { fournisseurParId } from "@/fournisseurs";
import { enregistrerCanauxZernio } from "@/services/comptes-envoi-zernio";
import { definirRoutage, lireRoutage } from "@/services/routage-publication";
import { ecrireParametre, ErreurStudio, essayer, journaliser, lireParametre, maintenant, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { outilPour } from "@/domaine/outil-publication";

const PARAM_MODES = "zernio.mode_envoi";
const PARAM_BASCULES = "zernio.bascules";
const PARAM_TESTS = "zernio.tests";
const PARAM_BUDGET = "zernio.budget_info";
const RESEAUX_CONNUS: readonly IdReseau[] = ["instagram", "facebook", "linkedin", "tiktok"];

export interface CompteVue {
  /** Identifiant d'affichage (jamais l'identifiant du fournisseur). */
  code: string;
  /** Clé neutre du compte pour le routage et le mode : « réseau:empreinte ». Stable, sans identifiant du fournisseur. */
  cle: string;
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
  /** L7-08 : réglage séparé de l'envoi du calendrier (lecture seule ici). Absent = éteint. */
  envoiCalendrierOuvert?: boolean;
  /** L7-08 : réglage `publication.editoriale_active` (lecture seule ici). Absent = éteint. */
  editorialeActive?: boolean;
  comptes: CompteVue[];
  budget: BudgetInfo;
}

/** Ce que l'écran appelle. Tests : un faux service ; production : les actions ci-dessous. */
export interface ServicesZernio {
  lire(): Promise<Resultat<EtatConnexionsZernio>>;
  tester(): Promise<Resultat<{ message: string }>>;
  /** `cle` : la clé neutre d'un compte (`CompteVue.cle`). Un geste ne touche que ce compte. */
  changerRoutage(cle: string, outil: OutilPublication): Promise<Resultat>;
  changerMode(cle: string, mode: ModeEnvoiPublication): Promise<Resultat>;
  arreter(): Promise<Resultat>;
  reprendre(): Promise<Resultat>;
}

const ORDRE = (r: string): number => {
  const i = RESEAUX_CONNUS.indexOf(r as IdReseau);
  return i < 0 ? 99 : i;
};

/** Empreinte courte et stable de l'identifiant du fournisseur : ne change ni quand un compte s'ajoute, ni quand il part. */
function empreinteCompte(idFournisseur: string): string {
  return createHash("sha256").update(`compte-studio:${idFournisseur}`).digest("hex").slice(0, 12);
}

/** Clé « réseau:compte » valide, ou une erreur claire. Le réseau doit être connu. */
function lireCle(cle: string): { reseau: IdReseau; cle: string } {
  const [reseau, compte, ...reste] = String(cle).split(":");
  if (reste.length || !RESEAUX_CONNUS.includes(reseau as IdReseau) || (compte !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(compte))) {
    throw new ErreurStudio("RESEAU_INCONNU", "Réseau ou compte inconnu.");
  }
  return { reseau: reseau as IdReseau, cle: compte ? `${reseau}:${compte}` : reseau };
}

function rafraichir() {
  revalidatePath("/reglages");
  // Le bandeau d'arrêt (layout du Studio) doit suivre l'interrupteur sur tous les écrans.
  revalidatePath("/", "layout");
}

function nombreOuNul(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Lecture en base seulement : afficher l'écran n'appelle jamais Zernio. */
export async function lireConnexionsZernioAction(): Promise<Resultat<EtatConnexionsZernio>> {
  await exigerSession();
  return essayer(async () => {
    const [enregistres, routage, canaux, modes, bascules, tests, budgetBrut, autorise, calendrier, editoriale] = await Promise.all([
      comptesZernioEnregistres(),
      lireRoutage(),
      canauxEnregistres(),
      lireParametre<Record<string, string>>(PARAM_MODES, {}),
      lireParametre<Record<string, string>>(PARAM_BASCULES, {}),
      lireParametre<Record<string, { testeLe: string; actif: boolean }>>(PARAM_TESTS, {}),
      lireParametre<Partial<BudgetInfo> | null>(PARAM_BUDGET, null),
      lireParametre<boolean>(PARAM_ARRET_ZERNIO, true),
      lireParametre<boolean>(PARAM_ENVOI_CALENDRIER, false),
      editorialeActive(),
    ]);
    const comptes: CompteVue[] = (enregistres?.comptes ?? [])
      .filter((c) => RESEAUX_CONNUS.includes(c.reseau as IdReseau))
      .map((c) => {
        const reseau = c.reseau as IdReseau;
        const test = tests[c.id];
        const neutre = empreinteCompte(c.id);
        const cle = `${reseau}:${neutre}`;
        return {
          code: `${reseau}-${neutre}`,
          cle,
          reseau,
          nom: c.nom,
          relie: test ? test.actif : true,
          outil: outilPour(routage, reseau, neutre),
          mode: (modes[cle] ?? modes[reseau]) === "programmer" ? "programmer" : "brouillon",
          existeChezBuffer: !!canaux?.canaux.some((x) => x.service === serviceBuffer(reseau)),
          basculeLe: bascules[cle] ?? bascules[reseau] ?? null,
          dernierTest: test?.testeLe ?? null,
        } satisfies CompteVue;
      })
      .sort((a, b) => ORDRE(a.reseau) - ORDRE(b.reseau) || a.nom.localeCompare(b.nom, "fr"));
    const budget: BudgetInfo = { zernio: nombreOuNul(budgetBrut?.zernio), buffer: nombreOuNul(budgetBrut?.buffer), finBuffer: typeof budgetBrut?.finBuffer === "string" ? budgetBrut.finBuffer : "20/11" };
    return { cleAbsente: !cleZernioPresente(), arretActif: autorise === false, envoiCalendrierOuvert: calendrier === true, editorialeActive: editoriale, comptes, budget };
  });
}

/** « Tester les 6 comptes » : lecture seule chez Zernio. Sans clé : message simple, aucune exception. */
export async function testerComptesZernioAction(): Promise<Resultat<{ message: string }>> {
  await exigerSession();
  if (!cleZernioPresente()) return { ok: true, donnees: { message: "Le nouvel outil n'est pas encore relié : l'écran fonctionne en essai." } };
  return essayer(async () => {
    const r = await testerZernio(); // une seule lecture chez Zernio : les états des comptes en viennent
    const testeLe = maintenant();
    const tests: Record<string, { testeLe: string; actif: boolean }> = {};
    for (const [id, actif] of Object.entries(r.etats)) tests[id] = { testeLe, actif };
    await ecrireParametre(PARAM_TESTS, tests);
    // Les cibles (pages Facebook, organisations) servent à l'écran « À publier » : lues ici, jamais depuis l'écran. Un échec n'ôte rien au test.
    try {
      await enregistrerCanauxZernio(fournisseurParId("publication", "zernio"));
    } catch {
      /* la liste précédente reste en base */
    }
    rafraichir();
    return { message: r.message };
  });
}

export async function changerRoutageZernioAction(cleCompte: string, outil: OutilPublication): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (!(OUTILS as readonly string[]).includes(outil)) throw new ErreurStudio("OUTIL_INCONNU", "Outil inconnu.");
    const { cle } = lireCle(cleCompte);
    await definirRoutage(cle, outil);
    const bascules = await lireParametre<Record<string, string>>(PARAM_BASCULES, {});
    await ecrireParametre(PARAM_BASCULES, { ...bascules, [cle]: maintenant() });
    rafraichir();
    return undefined;
  });
}

export async function changerModeZernioAction(cleCompte: string, mode: ModeEnvoiPublication): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (mode !== "brouillon" && mode !== "programmer") throw new ErreurStudio("MODE_INCONNU", "Choix inconnu.");
    const { cle } = lireCle(cleCompte);
    const modes = await lireParametre<Record<string, string>>(PARAM_MODES, {});
    await ecrireParametre(PARAM_MODES, { ...modes, [cle]: mode });
    await journaliser("reglages", `Zernio : ${cle} part en ${mode === "brouillon" ? "brouillon d'abord" : "programmation"}`);
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

/** Geste explicite : allume la publication éditoriale (écrit le booléen seul ; ne touche ni `zernio.envoi_autorise` ni l'envoi du calendrier). */
export async function allumerEditorialeAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
    await journaliser("reglages", PHRASE_EDITORIALE.allumee);
    rafraichir();
    return undefined;
  });
}

/** Éteint la publication éditoriale (état par défaut). */
export async function eteindreEditorialeAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    await journaliser("reglages", PHRASE_EDITORIALE.eteinte);
    rafraichir();
    return undefined;
  });
}
