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
import { depots, ecrireParametre, ErreurStudio, essayer, journaliser, lireParametre, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { DUREE_MAX_ESSAI_MS, lireEssai, PARAM_ESSAI_BROUILLON, raisonNonEligible } from "@/services/essai-zernio";
import { exigerSession } from "@/services/auth";
import { aUnPostPossible } from "@/services/retirer-programmation";
import { etatEnvoiDuCreneau, PREFIXE_ETATS_ENVOI_CALENDRIER } from "@/services/branchement-envoi-calendrier";
import { RAISON_A_COMPLETER } from "@/services/envoi-depuis-creneau";
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
    const budget: BudgetInfo = { zernio: nombreOuNul(budgetBrut?.zernio) };
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

/* ------------------------------------------------------------------ */
/* Essai borné d'UN brouillon (un créneau, un compte, 24 h au plus)    */
/* ------------------------------------------------------------------ */

const H_MS = 60 * 60 * 1000;
const NOMS_RESEAU_ESSAI: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };

export interface EssaiVue {
  creneauId: string;
  reseau: string;
  jour: string | null;
  expireLe: string;
  /** Vrai quand l'heure d'expiration est passée : seul le retrait reste possible (fenêtre de nettoyage). */
  expire: boolean;
  /** Dernière raison de refus gardée pour la version courante du créneau (lecture seule). */
  dernierRefus?: { raison: string; le: string };
  /** Phrase « légende à écrire » quand le créneau de l'essai n'a pas de texte sur ce réseau. */
  aCompleter?: string;
}
export interface EligibleEssai {
  id: string;
  reseau: string;
  jour: string;
  titre: string;
  aCompleter?: string;
}
export interface EtatEssaiZernio {
  essai: EssaiVue | null;
  eligibles: EligibleEssai[];
}

/** Lecture en base seulement : jamais d'appel au diffuseur. */
export async function lireEssaiZernioAction(): Promise<Resultat<EtatEssaiZernio>> {
  await exigerSession();
  return essayer(async () => {
    const maintenantMs = Date.parse(maintenant());
    const [lu, plan] = await Promise.all([lireEssai(maintenantMs), depots().creneauxEditoriaux.lister()]);
    const eligibles: EligibleEssai[] = plan
      .filter((c) => raisonNonEligible(c, maintenantMs) === null)
      .map((c) => {
        const reseau = Object.keys(c.heuresParReseau)[0] ?? "";
        const texte = c.textes?.[reseau as IdReseau]?.texte;
        return { id: c.id, reseau, jour: c.jourVise, titre: texte?.slice(0, 80) ?? c.id, ...(texte?.trim() ? {} : { aCompleter: RAISON_A_COMPLETER }) };
      })
      .sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id));
    const creneau = lu ? plan.find((c) => c.id === lu.creneauId) : undefined;
    // Raison du refus : lecture seule, une erreur ne donne aucun message et ne bloque jamais l'écran.
    const envoi = lu && creneau ? await etatEnvoiDuCreneau(creneau, lu.reseau as never).catch(() => ({})) : {};
    return { essai: lu ? { creneauId: lu.creneauId, reseau: lu.reseau, jour: creneau?.jourVise ?? null, expireLe: lu.expireLe, expire: maintenantMs >= Date.parse(lu.expireLe), ...envoi } : null, eligibles };
  });
}

const PHRASE_RETIRER_BROUILLON_ESSAI = "Retirez d'abord le brouillon d'essai chez le diffuseur depuis le calendrier.";

/** Le créneau de l'essai en cours a-t-il encore un envoi avec un post possible chez le diffuseur ? (lecture en base seulement) */
async function essaiAEncoreUnPost(): Promise<boolean> {
  const actuel = await lireParametre<{ creneauId?: unknown } | null>(PARAM_ESSAI_BROUILLON, null);
  const id = actuel && typeof actuel === "object" && typeof actuel.creneauId === "string" ? actuel.creneauId : "";
  if (!id) return false;
  const etats = {
    async lire(cle: string) {
      const v = await lireParametre<unknown>(PREFIXE_ETATS_ENVOI_CALENDRIER + cle, undefined);
      return typeof v === "string" ? v : undefined;
    },
    async noter() {},
  };
  for (const e of await depots().envoisPlanifies.lister((x) => x.creneauId === id && x.statut !== "annule")) {
    if (await aUnPostPossible(e, etats)) return true;
  }
  return false;
}

/** Pose l'essai : compte et réseau sont LUS du créneau, jamais saisis. Un seul essai actif à la fois. */
export async function poserEssaiZernioAction(demande: { creneauId: string; dureeHeures: number }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const creneauId = typeof demande?.creneauId === "string" ? demande.creneauId : "";
    const heures = demande?.dureeHeures;
    if (!Number.isInteger(heures) || heures < 1 || heures * H_MS > DUREE_MAX_ESSAI_MS) {
      throw new ErreurStudio("ESSAI_DUREE", "La durée de l'essai va de 1 à 24 heures, en heures entières.");
    }
    await sousVerrou(async () => {
      const maintenantMs = Date.parse(maintenant());
      if (await essaiAEncoreUnPost()) throw new ErreurStudio("ESSAI_BROUILLON_RESTE", PHRASE_RETIRER_BROUILLON_ESSAI);
      if ((await lireParametre<boolean>(PARAM_ARRET_ZERNIO, true)) === false) {
        throw new ErreurStudio("ESSAI_ARRET", "« Tout arrêter » est actif : reprenez les envois avant de poser un essai.");
      }
      const actuel = await lireParametre<{ expireLe?: unknown } | null>(PARAM_ESSAI_BROUILLON, null);
      const expire = actuel && typeof actuel === "object" ? Date.parse(String(actuel.expireLe)) : NaN;
      if (Number.isFinite(expire) && maintenantMs < expire) {
        throw new ErreurStudio("ESSAI_DEJA", "Un essai est déjà actif : retirez-le avant d'en poser un autre.");
      }
      const c = creneauId ? await depots().creneauxEditoriaux.obtenir(creneauId) : null;
      const raison = raisonNonEligible(c, maintenantMs);
      if (raison || !c) throw new ErreurStudio("ESSAI_NON_ELIGIBLE", raison ?? "Ce créneau est introuvable.");
      const reseau = Object.keys(c.heuresParReseau)[0];
      const poseLe = new Date(maintenantMs).toISOString();
      const valeur = { version: 1, creneauId: c.id, compte: c.compteCible, reseau, poseLe, expireLe: new Date(maintenantMs + heures * H_MS).toISOString() };
      await ecrireParametre(PARAM_ESSAI_BROUILLON, valeur);
      // Relu comme le lira le tour : un essai qui ne se relit pas n'est pas gardé (fermé).
      if (!(await lireEssai(maintenantMs))) {
        await ecrireParametre(PARAM_ESSAI_BROUILLON, null);
        throw new ErreurStudio("ESSAI_ILLISIBLE", "L'essai n'a pas pu être posé (compte ou clé du diffuseur manquant) : rien n'est ouvert.");
      }
      await journaliser("reglages", `Essai d'un brouillon posé : un créneau ${NOMS_RESEAU_ESSAI[reseau] ?? reseau}, ${heures} h au plus`);
    });
    rafraichir();
    return undefined;
  });
}

/** Retire l'essai (écrit `null`) : le tour suivant est « porte fermée ». */
export async function retirerEssaiZernioAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await sousVerrou(async () => {
      if (await essaiAEncoreUnPost()) throw new ErreurStudio("ESSAI_BROUILLON_RESTE", PHRASE_RETIRER_BROUILLON_ESSAI);
      await ecrireParametre(PARAM_ESSAI_BROUILLON, null);
      await journaliser("reglages", "Essai d'un brouillon retiré");
    });
    rafraichir();
    return undefined;
  });
}
