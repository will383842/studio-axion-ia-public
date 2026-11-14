/**
 * MOTS (PV-3) · gestes de l'opérateur : chaque geste exige la session, puis appelle le service. Une action serveur de l'écran
 * « Mots » n'a qu'à les appeler. `confirmeParOperateur` n'est vrai QUE parce que la session a été exigée ici.
 * Textes : saisie validée de l'opérateur ou fichier `mots/<MOT>.md` ; jamais de texte écrit en dur.
 */
import "server-only";
import { exigerSession } from "./auth";
import { lierMot, lireCiblesSite } from "./cibles-site";
import { activerMotLocal, activerMotParcours, injecterVerificationMotParcours, PARAM_REGISTRE_MOTS, type LigneMot, chargerTextesFichier, mettreEnPauseLocal, lireVueMots, mettreEnPause, validerGuideParcours, validerAdresseRefusee, validerFormulation, poserMot, poserMotDepuisFichier, validerMot, poserStopCompte, reactiverMot, refermerDisjoncteur, reglerPlafonds, type Resultat, type VueMots } from "./mots-service";
import type { SaisieMot } from "./mots-textes";
import { normaliserMot } from "@/domaine/guide-reseau/mot-normalise";
import { MOT_GUIDE } from "@/domaine/guide-reseau/empreinte-mot";
import { lireParametre } from "./_commun";
import { apercuTextesMot, validerTextesMot, verifierMotPourCompte, type ApercuReseau } from "./mots-validation-par-mot";
import { comptesParcours, titreGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { guideFichierPresent } from "./mots-guide-source";
import type { EtatReglagesParcours, ReglageParcours, ResultatReglage } from "./parcours-reglages";

// R5 : un mot autre que GUIDE ne s'active que si la garde d'envoi par compte (textes validés, cible, réseau) le permet.
// Sans cette injection, l'activation d'un tel mot est refusée (`mot_non_valide`).
injecterVerificationMotParcours(verifierMotPourCompte);

export async function gesteLireMots(): Promise<VueMots> {
  await exigerSession();
  return lireVueMots();
}
/** Pose d'une SAISIE (sans état ni empreinte) : refusée tant que le geste de validation n'a pas enregistré son empreinte. */
export async function gestePoserMot(compte: string, saisie: SaisieMot): Promise<Resultat> {
  await exigerSession();
  return poserMot({ compte, saisie: { mot: saisie.mot, reponsePublique: saisie.reponsePublique, messagePrive: saisie.messagePrive, relance: saisie.relance, fin: saisie.fin }, confirmeParOperateur: true });
}
/** Validation « par l'opérateur » : seule voie qui enregistre l'empreinte (session exigée). */
export async function gesteValiderMot(saisie: SaisieMot): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  const r = await validerMot({ saisie: { mot: saisie.mot, reponsePublique: saisie.reponsePublique, messagePrive: saisie.messagePrive, relance: saisie.relance, fin: saisie.fin }, confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** Pose depuis `mots/<MOT>.md` : fichier absent, illisible ou non validé = refus, rien n'est appelé. */
export async function gestePoserDepuisFichier(compte: string, mot: string): Promise<Resultat> {
  await exigerSession();
  const lu = await chargerTextesFichier(mot);
  if (!lu || !lu.ok) return { issue: "refuse", raison: lu ? lu.raison : "fichier_absent" };
  return poserMotDepuisFichier({ compte, textes: lu.textes, confirmeParOperateur: true });
}
export async function gestePoserStop(compte: string): Promise<Resultat> {
  await exigerSession();
  return poserStopCompte({ compte, confirmeParOperateur: true });
}
export async function gesteMettreEnPause(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return mettreEnPause({ mot, compte, confirmeParOperateur: true });
}
export async function gesteReactiver(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return reactiverMot({ mot, compte, confirmeParOperateur: true });
}
export async function gesteRefermerDisjoncteur(): Promise<{ ok: boolean }> {
  await exigerSession();
  return refermerDisjoncteur({ confirmeParOperateur: true });
}
export async function gesteReglerPlafonds(p: { heureCompte?: number; jourMot?: number }) {
  await exigerSession();
  return reglerPlafonds(p);
}
/** Activation LOCALE du mot GUIDE (session exigée) : aucun appel vers Zernio, refus fermé si une garde manque. */
export async function gesteActiverMotLocal(compte: string): Promise<Resultat> {
  await exigerSession();
  if (!comptesParcours().includes(compte)) return { issue: "refuse", raison: "compte_hors_liste" };
  return activerMotLocal({ mot: "GUIDE", compte, confirmeParOperateur: true });
}
export async function gesteMettreEnPauseLocal(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return mettreEnPauseLocal({ mot, compte, confirmeParOperateur: true });
}
/**
 * Validation des textes du mot GUIDE du parcours : le client ne transmet rien. Refusée si `mots/GUIDE.md` existe (le parcours
 * n'envoie pas ce fichier : la validation ne le couvrirait pas). Le titre est celui du serveur, comme pour le parcours.
 */
export async function gesteValiderMotGuide(): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  if (await guideFichierPresent()) return { ok: false, raison: "guide_fichier_present" };
  const r = await validerGuideParcours({ titre: titreGuideParcours(process.env), confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** OBSOLÈTE : valide l'ancien texte « adresse refusée » (retiré), refusé par le service (`texte_retire`) ; plus branché sur l'écran. Remplacé par `gesteValiderFormulation`. */
export async function gesteValiderAdresseRefusee(): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  const r = await validerAdresseRefusee({ confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** Validation d'UNE formulation : le client n'envoie qu'un nom de version, contrôlé côté serveur contre le dictionnaire (jamais de texte). */
export async function gesteValiderFormulation(version: string): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  if (typeof version !== "string") return { ok: false, raison: "formulation_inconnue" };
  return validerFormulation({ version, confirmeParOperateur: true });
}
/** Comptes du parcours de conversation (identifiants seulement) pour les boutons d'activation. */
export async function gesteComptesGuide(): Promise<string[]> {
  await exigerSession();
  return comptesParcours();
}

/** Lecture des deux interrupteurs du parcours (session exigée) : deux booléens. */
export async function gesteLireReglagesParcours(): Promise<EtatReglagesParcours> {
  await exigerSession();
  // Import différé (comme branchements-zernio) : aucun autre fichier de src n'importe statiquement le parcours.
  return (await import("./parcours-conversation")).lireReglagesParcours();
}
/** Bascule d'un interrupteur du parcours (session exigée avant tout) : le client n'envoie qu'un nom et un booléen. */
export async function gesteReglerParcours(reglage: ReglageParcours, allume: boolean): Promise<ResultatReglage> {
  await exigerSession();
  return (await import("./parcours-conversation")).reglerParcours(reglage, allume);
}

/* ------------------------------------------------------------------ */
/* R5 · mots et cibles (créer un mot, choisir sa cible, activer par compte) */
/* ------------------------------------------------------------------ */

/** Résultat d'un geste « mot et cible » : un code stable ; `phrase` seulement si elle vient du site ou du geste lui-même. L'action serveur met la phrase. */
export interface ResultatMotCible {
  ok: boolean;
  raison: string;
  phrase?: string;
}
const non = (raison: string, phrase?: string): ResultatMotCible => ({ ok: false, raison, ...(phrase ? { phrase } : {}) });

/** Crée un mot : liaison « tous les réseaux » vers une cible ACTIVE du catalogue. Aucun texte validé, aucun compte activé : le mot reste brouillon. */
export async function gesteCreerMot(mot: string, codeCible: string): Promise<ResultatMotCible> {
  await exigerSession();
  const m = normaliserMot(mot);
  if (m === null) return non("mot_invalide");
  if (m === MOT_GUIDE) return non("mot_reserve");
  const site = await lireCiblesSite();
  // Site injoignable, ou simple copie : on n'écrit pas (aucune nouvelle liaison depuis une copie).
  if (site === null || site.depuisCopie) return non("site_injoignable");
  if (site.liaisons.some((l) => l.actif && l.mot === m)) return non("mot_existe");
  const cible = typeof codeCible === "string" ? site.catalogue.find((e) => e.code === codeCible) : undefined;
  if (!cible) return non("cible_inconnue");
  if (!cible.actif) return non("cible_inactive");
  const r = await lierMot({ mot: m, reseau: "tous", codeCible: cible.code });
  return r.ok ? { ok: true, raison: "mot_cree" } : non("site_refuse", r.phrase);
}

/** Pause de chaque ligne LOCALE active d'un mot (jamais d'effacement). Renvoie le nombre de comptes mis en pause. */
async function pauserLignesLocalesDuMot(mot: string): Promise<number> {
  const registre = await lireParametre<Record<string, LigneMot>>(PARAM_REGISTRE_MOTS, {});
  let n = 0;
  for (const l of Object.values(registre)) {
    if (l.mot !== mot || l.etat !== "actif" || l.idWorkflow) continue;
    const r = await mettreEnPauseLocal({ mot, compte: l.compte, confirmeParOperateur: true });
    if (r.issue === "execute") n++;
  }
  return n;
}

/**
 * Change la cible d'un mot : « tous les réseaux », puis chaque ligne propre à un réseau. Arrêt au premier échec (phrase des changements faits).
 * Dès qu'un changement est passé, les comptes actifs du mot sont mis EN PAUSE (rien n'est supprimé) : les textes sont à valider de nouveau.
 */
export async function gesteChangerCible(mot: string, codeCible: string): Promise<ResultatMotCible> {
  await exigerSession();
  const m = normaliserMot(mot);
  if (m === null) return non("mot_invalide");
  if (m === MOT_GUIDE) return non("cible_guide_figee");
  const site = await lireCiblesSite();
  if (site === null || site.depuisCopie) return non("site_injoignable");
  const propres = site.liaisons.filter((l) => l.actif && l.mot === m && l.reseau !== "tous");
  if (!site.liaisons.some((l) => l.actif && l.mot === m)) return non("mot_inconnu");
  const cible = typeof codeCible === "string" ? site.catalogue.find((e) => e.code === codeCible) : undefined;
  if (!cible) return non("cible_inconnue");
  if (!cible.actif) return non("cible_inactive");
  const etapes: Array<"tous" | (typeof propres)[number]["reseau"]> = ["tous", ...propres.map((l) => l.reseau)];
  let faites = 0;
  let echec: string | null = null;
  for (const reseau of etapes) {
    const r = await lierMot({ mot: m, reseau, codeCible: cible.code });
    if (!r.ok) {
      echec = r.phrase;
      break;
    }
    faites++;
  }
  // Un changement est parti : les textes validés ne correspondent plus à la cible, on met le mot en pause avant tout.
  const enPause = faites > 0 ? await pauserLignesLocalesDuMot(m) : 0;
  const pause = enPause > 0 ? ` Le mot a été mis en pause sur ${enPause} compte(s) : validez ses textes puis réactivez-le.` : "";
  if (echec !== null)
    return non("site_refuse", `La cible n'a changé que sur ${faites} réseau(x) sur ${etapes.length} : ${echec}${pause}`);
  return { ok: true, raison: "cible_changee", ...(pause ? { phrase: `Cible changée.${pause}` } : {}) };
}

/** Les textes d'un mot, réseau par réseau (lecture seule). */
export async function gesteApercuTextesMot(mot: string): Promise<ApercuReseau[]> {
  await exigerSession();
  return apercuTextesMot({ mot });
}

/** Valide les textes d'un mot pour un réseau : l'empreinte vue doit être celle recalculée à l'instant. Rien n'est envoyé. */
export async function gesteValiderTextesMot(mot: string, reseau: string, empreinteVue: string): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  return validerTextesMot({ mot, reseau, empreinteVue, confirmeParOperateur: true });
}

/** Active un mot sur un compte, en local : GUIDE par son geste dédié, tout autre mot par le parcours (garde d'envoi injectée, « plusieurs mots » fermé). */
export async function gesteActiverMot(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  if (mot === MOT_GUIDE) return gesteActiverMotLocal(compte);
  return activerMotParcours({ mot, compte, confirmeParOperateur: true });
}

/** Pause d'un mot sur un compte : ligne posée chez Zernio = pause habituelle, sinon pause locale. Rien n'est supprimé. */
export async function gestePauseMot(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  const ligne = (await lireParametre<Record<string, LigneMot>>(PARAM_REGISTRE_MOTS, {}))[`${mot}|${compte}`];
  return ligne?.idWorkflow ? mettreEnPause({ mot, compte, confirmeParOperateur: true }) : mettreEnPauseLocal({ mot, compte, confirmeParOperateur: true });
}
