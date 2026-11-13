/**
 * Validation des textes PAR MOT et PAR RÉSEAU (garde d'envoi). SANS EFFET : aucun code de production ne l'appelle encore.
 *
 * L'opérateur voit les textes d'un mot pour un réseau, avec la cible actuelle du site ; sa validation retient une empreinte
 * (mot + réseau + cible + titre + textes actifs). Si la cible, son titre ou un texte du dictionnaire change, l'empreinte change :
 * la validation est « périmée » et rien ne part. GUIDE garde sa validation actuelle (mots-service).
 * Échec FERMÉ partout : un doute (site injoignable, copie, lecture impossible) refuse. Le journal ne contient jamais un texte.
 *
 * `verifierMotPourCompte` n'appelle JAMAIS `sousVerrou` (verrou global non réentrant : il est appelé hors verrou, comme `motValidePour`).
 */
import "server-only";
import {
  empreinteMot,
  MOT_GUIDE,
  RESEAUX_AUTO,
  resoudreCibleMot,
  type ReseauAuto,
  type TexteDuMot,
} from "@/domaine/guide-reseau/empreinte-mot";
import {
  reseauSite,
  type TypeElement,
} from "@/domaine/guide-reseau/cibles-contrat";
import { normaliserMot } from "@/domaine/guide-reseau/mot-normalise";
import { titreGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import {
  ecrireParametre,
  journaliser,
  lireParametre,
  maintenant,
  sousVerrou,
} from "./_commun";
import { lireCiblesSite } from "./cibles-site";
import { comptesZernioEnregistres } from "./zernio";

export const PARAM_VALIDATIONS_PAR_MOT = "mots.validations.par-mot";

type Env = Record<string, string | undefined>;
interface ValidationMot {
  empreinte: string;
  codeCible: string;
  valideLe: string;
}
type Registre = Record<string, ValidationMot>;

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const cleDe = (mot: string, reseau: string): string => `${mot}|${reseau}`;
const estAuto = (r: unknown): r is ReseauAuto =>
  (RESEAUX_AUTO as readonly unknown[]).includes(r);

/** Lit le réglage ; une valeur mal formée donne un registre vide (rien n'est validé). Lève si la lecture échoue. */
async function lireRegistre(): Promise<Registre> {
  const brut = await lireParametre<unknown>(PARAM_VALIDATIONS_PAR_MOT, {});
  if (!estObjet(brut)) return {};
  const r: Registre = {};
  for (const [k, v] of Object.entries(brut)) {
    if (
      estObjet(v) &&
      typeof v.empreinte === "string" &&
      typeof v.codeCible === "string" &&
      typeof v.valideLe === "string"
    )
      r[k] = {
        empreinte: v.empreinte,
        codeCible: v.codeCible,
        valideLe: v.valideLe,
      };
  }
  return r;
}

export type CibleActuelle =
  | { ok: true; code: string; titre: string; type: TypeElement; test: boolean }
  | {
      ok: false;
      raison: "site_injoignable" | "sans_cible" | "cible_introuvable";
    };

/** Cible actuelle d'un mot pour un réseau, lue au site. Site injoignable ou copie : aucune décision. */
export async function cibleActuelleDuMot(o: {
  mot: string;
  reseau: ReseauAuto;
  env?: Env;
  maintenantMs?: number;
}): Promise<CibleActuelle> {
  const env = o.env ?? process.env;
  const site = await lireCiblesSite({
    env,
    ...(o.maintenantMs !== undefined ? { maintenantMs: o.maintenantMs } : {}),
  });
  if (site === null || site.depuisCopie)
    return { ok: false, raison: "site_injoignable" };
  const c = resoudreCibleMot({
    mot: o.mot,
    reseau: o.reseau,
    liaisons: site.liaisons,
    catalogue: site.catalogue,
    titreServeur: titreGuideParcours(env),
  });
  if (c.genre === "sans_cible") return { ok: false, raison: "sans_cible" };
  if (c.genre === "introuvable")
    return { ok: false, raison: "cible_introuvable" };
  return { ok: true, code: c.code, titre: c.titre, type: c.type, test: c.test };
}

type RaisonPreparation =
  | "mot_invalide"
  | "mot_guide_a_part"
  | "site_injoignable"
  | "sans_cible"
  | "cible_introuvable"
  | "cible_test"
  | "adresse_pas_encore"
  | "titre_cible_absent"
  | "texte_dictionnaire_incomplet";
type Preparation =
  | {
      ok: true;
      cible: { code: string; titre: string; type: TypeElement; test: boolean };
      textes: TexteDuMot[];
      empreinte: string;
    }
  | { ok: false; raison: RaisonPreparation };

async function preparer(o: {
  mot: string;
  reseau: ReseauAuto;
  env?: Env;
  maintenantMs?: number;
}): Promise<Preparation> {
  const mot = normaliserMot(o.mot);
  if (mot === null || mot !== o.mot)
    return { ok: false, raison: "mot_invalide" };
  if (mot === MOT_GUIDE) return { ok: false, raison: "mot_guide_a_part" };
  const c = await cibleActuelleDuMot(o);
  if (!c.ok) return c;
  // Une cible d'essai ou une page (adresse) n'est JAMAIS validable : « TEST ⇒ rien », et une page n'a pas encore de parcours.
  if (c.test) return { ok: false, raison: "cible_test" };
  if (c.type === "adresse") return { ok: false, raison: "adresse_pas_encore" };
  const e = empreinteMot({
    mot,
    reseau: o.reseau,
    codeCible: c.code,
    titre: c.titre,
  });
  if (!e.ok) return e;
  return {
    ok: true,
    cible: { code: c.code, titre: c.titre, type: c.type, test: c.test },
    textes: e.textes,
    empreinte: e.empreinte,
  };
}

export type EtatValidationMot = "valide" | "perimee" | "absente";

/** « valide » : l'empreinte retenue est celle d'aujourd'hui ; « perimee » : elle existe mais ne correspond plus ; « absente » : rien, ou lecture impossible. */
export async function etatValidationMot(o: {
  mot: string;
  reseau: ReseauAuto;
  codeCible: string;
  titre: string;
}): Promise<EtatValidationMot> {
  try {
    if (!estAuto(o.reseau)) return "absente";
    const v = (await lireRegistre())[cleDe(o.mot, o.reseau)];
    if (!v) return "absente";
    const e = empreinteMot(o);
    return e.ok && e.empreinte === v.empreinte && v.codeCible === o.codeCible
      ? "valide"
      : "perimee";
  } catch {
    return "absente";
  }
}

/** Vrai seulement si l'empreinte retenue est celle d'aujourd'hui ET si la cible actuelle n'est ni d'essai ni une adresse (seconde garde, après `preparer`). Ne lève jamais ; FERMÉ en cas de doute (lecture impossible, site injoignable, réseau inconnu, texte incomplet). */
export async function motValidePour(o: {
  mot: string;
  reseau: ReseauAuto;
  codeCible: string;
  titre: string;
  env?: Env;
  maintenantMs?: number;
}): Promise<boolean> {
  try {
    if (!estAuto(o.reseau)) return false;
    const c = await cibleActuelleDuMot({
      mot: o.mot,
      reseau: o.reseau,
      env: o.env,
      maintenantMs: o.maintenantMs,
    });
    if (!c.ok || c.test || c.type === "adresse") return false;
    const v = (await lireRegistre())[cleDe(o.mot, o.reseau)];
    if (!v) return false;
    const e = empreinteMot(o);
    return e.ok && e.empreinte === v.empreinte && v.codeCible === o.codeCible;
  } catch {
    return false;
  }
}

export type ApercuReseau =
  | {
      reseau: ReseauAuto;
      ok: true;
      cible: { code: string; titre: string; type: TypeElement; test: boolean };
      textes: TexteDuMot[];
      empreinte: string;
      etat: EtatValidationMot;
    }
  | { reseau: ReseauAuto; ok: false; raison: RaisonPreparation };

/** Ce que l'opérateur voit avant de valider : un élément par réseau automatique. */
export async function apercuTextesMot(o: {
  mot: string;
  env?: Env;
  maintenantMs?: number;
}): Promise<ApercuReseau[]> {
  const sortie: ApercuReseau[] = [];
  for (const reseau of RESEAUX_AUTO) {
    const p = await preparer({
      mot: o.mot,
      reseau,
      env: o.env,
      maintenantMs: o.maintenantMs,
    });
    if (!p.ok) {
      sortie.push({ reseau, ok: false, raison: p.raison });
      continue;
    }
    const etat = await etatValidationMot({
      mot: o.mot,
      reseau,
      codeCible: p.cible.code,
      titre: p.cible.titre,
    });
    sortie.push({
      reseau,
      ok: true,
      cible: p.cible,
      textes: p.textes,
      empreinte: p.empreinte,
      etat,
    });
  }
  return sortie;
}

export type RaisonValidation =
  | "validation_operateur_absente"
  | "mot_invalide"
  | "mot_guide_a_part"
  | "reseau_a_la_main"
  | "site_injoignable"
  | "sans_cible"
  | "cible_introuvable"
  | "cible_test"
  | "adresse_pas_encore"
  | "titre_cible_absent"
  | "texte_dictionnaire_incomplet"
  | "validation_perimee"
  | "valide";

/** Valide les textes d'un mot pour un réseau. L'empreinte vue par l'opérateur doit être celle recalculée à l'instant. Idempotent. */
export async function validerTextesMot(o: {
  mot: string;
  reseau: string;
  empreinteVue: string;
  confirmeParOperateur: boolean;
  env?: Env;
  maintenantMs?: number;
}): Promise<{ ok: boolean; raison: RaisonValidation }> {
  if (o.confirmeParOperateur !== true)
    return { ok: false, raison: "validation_operateur_absente" };
  const mot = normaliserMot(o.mot);
  if (mot === null || mot !== o.mot)
    return { ok: false, raison: "mot_invalide" };
  if (mot === MOT_GUIDE) return { ok: false, raison: "mot_guide_a_part" };
  if (!estAuto(o.reseau)) return { ok: false, raison: "reseau_a_la_main" };
  const reseau = o.reseau;
  const p = await preparer({
    mot,
    reseau,
    env: o.env,
    maintenantMs: o.maintenantMs,
  });
  if (!p.ok) return { ok: false, raison: p.raison };
  if (typeof o.empreinteVue !== "string" || o.empreinteVue !== p.empreinte)
    return { ok: false, raison: "validation_perimee" };
  const cle = cleDe(mot, reseau);
  await sousVerrou(async () => {
    const registre = await lireRegistre();
    const deja = registre[cle];
    if (
      deja &&
      deja.empreinte === p.empreinte &&
      deja.codeCible === p.cible.code
    )
      return;
    registre[cle] = {
      empreinte: p.empreinte,
      codeCible: p.cible.code,
      valideLe: maintenant(),
    };
    await ecrireParametre(PARAM_VALIDATIONS_PAR_MOT, registre);
    await journaliser(
      "mots",
      `Textes du mot ${mot} validés pour ${reseau} par l'opérateur.`,
    );
  });
  return { ok: true, raison: "valide" };
}

/** Réseau du site (facebook, instagram, linkedin, tiktok) d'un compte Zernio enregistré ; `null` si le compte est inconnu ou son réseau non reconnu. */
export async function reseauDuCompte(
  compte: string,
): Promise<ReturnType<typeof reseauSite>> {
  const lus = await comptesZernioEnregistres();
  const c = lus?.comptes.find((x) => x.id === compte);
  return c ? reseauSite(c.reseau) : null;
}

export type CodeRefusMotCompte =
  | "reseau_du_compte_inconnu"
  | "reseau_a_la_main"
  | "site_injoignable"
  | "sans_cible"
  | "cible_introuvable"
  | "cible_test"
  | "adresse_pas_encore"
  | "textes_non_valides_reseau"
  | "validation_perimee"
  | "lecture_impossible";

/**
 * Garde d'envoi pour un compte : `null` = le mot peut partir, sinon le code du refus. Fermé en cas de doute.
 * N'appelle JAMAIS `sousVerrou` : elle ne fait aucune écriture de validation (`lireCiblesSite` peut toutefois rafraîchir le miroir du site).
 */
export async function verifierMotPourCompte(o: {
  mot: string;
  compte: string;
  env?: Env;
  maintenantMs?: number;
}): Promise<CodeRefusMotCompte | null> {
  try {
    const reseau = await reseauDuCompte(o.compte);
    if (reseau === null) return "reseau_du_compte_inconnu";
    if (!estAuto(reseau)) return "reseau_a_la_main";
    const mot = normaliserMot(o.mot);
    // GUIDE a sa propre validation : cette garde ne le laisse jamais passer.
    if (mot === null || mot !== o.mot || mot === MOT_GUIDE)
      return "textes_non_valides_reseau";
    const c = await cibleActuelleDuMot({
      mot,
      reseau,
      env: o.env,
      maintenantMs: o.maintenantMs,
    });
    if (!c.ok)
      return c.raison === "cible_introuvable" ? "cible_introuvable" : c.raison;
    if (c.test) return "cible_test";
    if (c.type === "adresse") return "adresse_pas_encore";
    const v = (await lireRegistre())[cleDe(mot, reseau)];
    if (!v) return "textes_non_valides_reseau";
    const e = empreinteMot({ mot, reseau, codeCible: c.code, titre: c.titre });
    if (!e.ok) return "textes_non_valides_reseau";
    if (e.empreinte !== v.empreinte || v.codeCible !== c.code)
      return "validation_perimee";
    return null;
  } catch {
    return "lecture_impossible";
  }
}
