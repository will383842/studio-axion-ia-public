/**
 * À TRAITER (ATR-C) · « Copier » : rend un texte que l'opérateur colle À LA MAIN dans LinkedIn. JAMAIS d'envoi (aucun appel au port ni à Zernio) : on fabrique un texte, rien d'autre.
 * Un stop gagne partout : au moindre doute, rien n'est proposé.
 * Fenêtre restante, volontairement petite : une opposition inscrite au registre APRÈS le dernier recontrôle (juste avant l'écriture de la date) mais avant le rendu du texte n'est pas vue ; le texte rendu n'est jamais envoyé, seul l'opérateur le colle à la main.
 * Journaux sans texte, adresse, pseudo, identifiant de personne, jeton ni secret.
 */
import "server-only";
import { lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { decisionCopie } from "@/domaine/guide-reseau/carte-manuelle";
import { choisirFormulation } from "@/domaine/guide-reseau/formulations";
import { construireLienGuide, creerJetonLien, lireSecretLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";
import { GROUPES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { siteAccepteVersionM1 } from "@/domaine/guide-reseau/versions-acceptees-site";
import { formeLienPageGuide, texteDuDictionnaire } from "@/fournisseurs/publication/zernio-inbox-corps";
import { ecrireParametre, journaliser, lireParametre, sousVerrou } from "./_commun";
import { aTraiterActif, noterCopieCarte, type DepotATraiter } from "./a-traiter";
import { extraitLisible, type CarteATraiter } from "./a-traiter-types";
import { personneOpposeePartout } from "./oppositions-mots";
import { formulationsValidees } from "./mots-service";

type Env = Record<string, string | undefined>;
export type ResultatCopie = { ok: true; texte: string } | { ok: false; phrase: string };
export interface OptionsCopie {
  env?: Env;
  maintenantMs?: number;
  /**
   * Dépôt des cartes. `a-traiter.ts` n'expose pas son dépôt courant : sans dépôt fourni, la copie est REFUSÉE (fermé), jamais
   * contournée. (Branchement de production : voir la description de la PR.)
   */
  depot?: DepotATraiter;
}

/** Cumul des dates de copie, par empreinte de personne (jamais d'identifiant brut). Rien n'est jamais supprimé. */
export const PARAM_COPIES_A_TRAITER = "a_traiter.copies";
const GROUPE_M1_LIEN = "m1-lien" as const;
const LONGUEUR_MAX = 1000;
const RE_NOM_COURT = /^[a-z0-9_]{2,40}$/;
const RE_OPAQUE = /^[A-Za-z0-9_-]{1,64}$/;

const refus = (phrase: string): ResultatCopie => ({ ok: false, phrase });
const P_ETEINT = "Cet écran est éteint pour le moment : rien n’est copié.";
const P_INCONNUE = "Cette carte n’existe plus ou n’est plus à traiter : rien n’est copié.";
const P_STOP = "Cette personne a demandé l’arrêt : rien n’est proposé.";
const P_VERIF = "Vérification impossible, rien n’est proposé.";
const P_PLAFOND = "Trois messages ont déjà été copiés pour cette personne en 24 heures : rien n’est copié.";
const P_FORMULATION = "Aucune formulation validée n’est disponible : rien n’est copié.";
const P_SITE = "Le site ne connaît pas encore cette formulation : rien n’est copié.";
const P_LIEN = "Le lien ne peut pas être fabriqué pour le moment : rien n’est copié.";
const P_INDISPO = "La copie n’est pas disponible pour le moment : rien n’est copié.";

/** `LIEN_GUIDE_COMPTES` = « idCompte=nom_court,… » : même lecture que le parcours de conversation. */
function nomCourtCompte(env: Env, idCompte: string): string | null {
  for (const paire of (env.LIEN_GUIDE_COMPTES ?? "").split(",")) {
    const i = paire.indexOf("=");
    if (i < 1 || paire.slice(0, i).trim() !== idCompte) continue;
    const nom = paire.slice(i + 1).trim();
    return RE_NOM_COURT.test(nom) ? nom : null;
  }
  return null;
}

/** Carte à traiter + stop revérifié par ses empreintes. Au moindre doute : refus. */
async function carteSure(id: string, o: OptionsCopie): Promise<{ carte: CarteATraiter } | { phrase: string }> {
  const env = o.env ?? process.env;
  if (!aTraiterActif(env)) return { phrase: P_ETEINT };
  if (!o.depot) return { phrase: P_INDISPO };
  let carte: CarteATraiter | undefined;
  try {
    carte = (await o.depot.lire()).find((c) => c.idEvenement === id);
  } catch {
    return { phrase: P_VERIF };
  }
  if (!carte || carte.statut !== "a_traiter") return { phrase: P_INCONNUE };
  if (carte.opposee) return { phrase: P_STOP };
  if (!carte.empreintes?.length) return { phrase: P_VERIF };
  const cles = lireClesEmpreinte(env);
  // Clé changée depuis la création de la carte : une opposition écrite sous la nouvelle clé ne serait plus retrouvée => fermé.
  if (!cles.ok || !carte.kid || cles.courante.kid !== carte.kid) return { phrase: P_VERIF };
  try {
    const v = await personneOpposeePartout({ empreintes: carte.empreintes }, { env, douteBloque: true });
    if (v.opposee) return { phrase: P_STOP };
  } catch {
    return { phrase: P_VERIF };
  }
  return { carte };
}

/** Réponse publique déjà contrôlée (`carte.kit`) : aucun plafond, c'est un texte public posé à la main. */
export async function copierReponseCarte(id: string, o: OptionsCopie = {}): Promise<ResultatCopie> {
  const r = await carteSure(id, o);
  if ("phrase" in r) return refus(r.phrase);
  return r.carte.kit ? { ok: true, texte: r.carte.kit } : refus("Aucune réponse n’est proposée pour cette carte : écrivez-la vous-même.");
}

/** Message privé LinkedIn (premier message avec lien). Écrit la date de copie AVANT de fabriquer le texte rendu. */
export async function copierMessageCarte(id: string, o: OptionsCopie = {}): Promise<ResultatCopie> {
  const env = o.env ?? process.env;
  const r = await carteSure(id, o);
  if ("phrase" in r) return refus(r.phrase);
  const { carte } = r;
  const depot = o.depot as DepotATraiter;
  if (carte.reseau !== "linkedin") return refus("Ce réseau ne propose pas de message privé à copier.");
  if (carte.message !== "a_fabriquer" || !carte.mot || !carte.idCompte || !carte.cible || !carte.titreCible) return refus("Aucun message n’est proposé pour cette carte.");
  const empreintes = carte.empreintes as string[];
  const maintenantMs = o.maintenantMs ?? Date.now();
  const mot = carte.mot;
  const titre = extraitLisible(carte.titreCible);

  try {
    // 2) plafond de 24 h sur les copies de cette personne
    const dejaFaites = async () => {
      const t = await lireParametre<Record<string, unknown>>(PARAM_COPIES_A_TRAITER, {});
      return [...new Set(empreintes.flatMap((e) => (Array.isArray(t[e]) ? (t[e] as unknown[]).filter((d): d is string => typeof d === "string") : [])))];
    };
    if (!decisionCopie(await dejaFaites(), maintenantMs).ok) return refus(P_PLAFOND);

    // 3) formulation VALIDÉE du groupe « m1-lien », connue du site
    const choix = choisirFormulation({
      groupe: GROUPE_M1_LIEN,
      cleConversation: carte.idEvenement,
      validees: await formulationsValidees(),
      rendre: (v) => rendreTexteMp(v, { mot, titre, lien: "https://exemple.test/essai" }),
    });
    if (choix === null) return refus(P_FORMULATION);
    if (!siteAccepteVersionM1(choix.version)) return refus(P_SITE);

    // 4) lien (jeton signé), sans rien rendre encore
    const secret = lireSecretLien(env);
    const cles = lireClesEmpreinte(env);
    const compte = nomCourtCompte(env, carte.idCompte);
    if (secret === null || !cles.ok || compte === null) return refus(P_LIEN);
    const conv = refConversationLien(cles.courante.secret.toString("utf8"), carte.idEvenement);
    let lien: string | null;
    try {
      lien = construireLienGuide(creerJetonLien({ conv, mot, reseau: "linkedin", guide: carte.cible, compte, ...(RE_OPAQUE.test(carte.post) ? { post_ref: carte.post } : {}), version_m1: choix.version }, secret, maintenantMs));
    } catch {
      return refus(P_LIEN); // jamais e.message
    }
    if (lien === null || !formeLienPageGuide(lien) || !GROUPES_MP[GROUPE_M1_LIEN].includes(choix.version)) return refus(P_LIEN);

    // 5) AUCUN appel au dépôt dans `sousVerrou` (verrou global, non réentrant : le dépôt persistant le reprend => interblocage).
    // Ordre : stop revérifié ; cumul des dates sous `sousVerrou` (paramètre seul) ; date sur la carte (verrou local d'a-traiter.ts) ;
    // puis seulement le rendu. Si la carte refuse (stop posé entre-temps), aucun texte n'est rendu.
    const date = new Date(maintenantMs).toISOString();
    const recontrole = await carteSure(id, o);
    if ("phrase" in recontrole) return refus(recontrole.phrase);
    const cumule = await sousVerrou(async () => {
      if (!decisionCopie(await dejaFaites(), maintenantMs).ok) return false;
      const table = await lireParametre<Record<string, unknown>>(PARAM_COPIES_A_TRAITER, {});
      const suite: Record<string, unknown> = { ...table };
      for (const e of empreintes) suite[e] = [...(Array.isArray(table[e]) ? (table[e] as unknown[]) : []), date];
      await ecrireParametre(PARAM_COPIES_A_TRAITER, suite);
      return true;
    });
    if (!cumule) return refus(P_PLAFOND);
    if (!(await noterCopieCarte(id, date, { depot }))) return refus(P_STOP);

    // Rendu du texte (après l'écriture de la date)
    const texte = rendreTexteMp(choix.version, { mot, titre, lien });
    if (texte === null || texte.length > LONGUEUR_MAX || !texteDuDictionnaire(texte, false)) return refus(P_LIEN);
    await journaliser("a_traiter_copie", "message_copie"); // jamais le texte, le lien ni une personne
    return { ok: true, texte };
  } catch {
    return refus(P_VERIF); // jamais e.message
  }
}
