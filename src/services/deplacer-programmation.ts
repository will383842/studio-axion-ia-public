/**
 * CAL-23 (écrite EN AVANCE, avant RC-08a) · DÉPLACER OU MODIFIER UNE PUBLICATION DÉJÀ PROGRAMMÉE.
 *
 * « Annuler puis recréer » : la publication est d'abord RETIRÉE chez le diffuseur (retrait confirmé), puis le créneau reçoit la nouvelle date
 * et la VERSION SUIVANTE (`decalages` + 1). La clé d'envoi = créneau + version : le tour d'envoi du créneau (CAL-21 / L5-02) recrée donc
 * le brouillon sous une NOUVELLE clé, jamais sous l'ancienne ; un rejeu de la même demande ne retire ni ne recrée rien de plus.
 * Règles :
 *  - rien ne change en local tant que le retrait n'est pas confirmé ; retrait raté = l'ancienne date reste et la phrase le dit ;
 *  - recréation (écriture locale) ratée après un retrait réussi : retour dans « À placer » (créneau archivé avec `retireLe`, texte et fichier
 *    gardés, visuel « valide »), marque `deplacement:<clé>` = « a-reprogrammer » et notification : jamais « Programmé » ;
 *  - une publication partie, publiée ou passée ne se déplace pas ; rien n'est supprimé (les envois passent à « annule »).
 *  - texte ou premier commentaire changé : même retrait, puis le créneau repasse « À valider » (plus de `valideeLe`) : il exige le clic Valider ;
 *    un changement fait par un autre remet l'entrée à « Proposée ». Le contrôleur de texte (L7-12, L3-09) est relu avant tout appel ;
 *  - BLOQUÉ : « fonction client manquante » : `retirer(demande: DemandeRetraitZernio): Promise<ResultatRetraitZernio>` n'existe pas sur master
 *    (elle est dans la PR CAL-22, zone de la session Zernio). Sans port de retrait (`diffuseur: null`), AUCUN appel : déplacement LOCAL (journal du
 *    Studio), l'envoi est marqué « à vérifier » et aucun nouvel envoi n'est demandé (donc aucun doublon possible).
 * Tout est injecté : aucun service serveur, aucun appel réel, aucun fournisseur importé ici.
 */
import type { LotEcritures } from "@/domaine/depots";
import { cleEnvoi, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { heureAffichageParis, transitionner } from "@/domaine/plan-editorial/statuts";
import { instantParis } from "@/lib/horloge-paris";
import { controlerProgrammation } from "@/services/controle-programmation";
import type { CreneauPlan } from "@/services/plan-editorial";

export type IssueRetraitDiffuseur = "retire" | "refuse" | "sans-reponse" | "a-verifier";

/** Port du retrait chez le diffuseur. Lève ou rend « a-verifier » quand la réponse est incertaine. */
export interface PortRetraitDiffuseur {
  retirer(envoi: EnvoiPlanifie): Promise<IssueRetraitDiffuseur>;
}

export interface DepsDeplacement {
  /** `null` = fonction du client manquante sur master : déplacement local « à vérifier », aucun appel. */
  diffuseur: PortRetraitDiffuseur | null;
  /** Les trois réglages d'envoi sont-ils ouverts ? Erreur ou valeur autre que `true` = fermé. */
  reglagesOuverts(): Promise<boolean>;
  creneau(id: string): Promise<CreneauPlan | null>;
  envois(creneauId: string): Promise<EnvoiPlanifie[]>;
  visuel(id: string): Promise<{ id: string; statut: string } | null>;
  appliquer(lot: LotEcritures): Promise<void>;
  etats: { lire(cle: string): Promise<string | undefined>; noter(cle: string, valeur: string): Promise<void> };
  /** Cloche seulement. */
  notifier(n: { cle: string; motif: "a-reprogrammer"; raison: string }): Promise<void>;
  maintenant(): Date;
}

export interface DemandeDeplacement {
  creneauId: string;
  /** AAAA-MM-JJ (jour de Paris) ; l'heure de Paris de chaque réseau est conservée. */
  nouveauJour: string;
  /** Clé stable du formulaire ouvert : un rejeu de la même clé ne refait rien. */
  cle: string;
}

export interface DemandeTexte {
  creneauId: string;
  reseau: string;
  texte: string;
  premierCommentaire?: string;
  /** « will » : le fondateur (la validation reste à faire d'un clic) ; « autre » : l'entrée repasse à « Proposée ». */
  auteur: "will" | "autre";
  cle: string;
}

export type EtatDeplacement = "deplace" | "deplace-a-verifier" | "modifie" | "modifie-a-verifier" | "deja-fait" | "inchange";
export type EtatEchecDeplacement = "refuse" | "reste" | "a-verifier" | "a-reprogrammer" | "a-retirer-a-la-main";
export type ResultatDeplacement =
  | { ok: true; etat: EtatDeplacement; message: string; creneauId: string; /** Clés d'envoi que le tour d'envoi créera (version suivante). */ nouvellesCles?: string[] }
  | { ok: false; etat: EtatEchecDeplacement; message: string; /** Vrai si des écritures ont eu lieu : l'écran doit se rafraîchir. */ ecritures?: true };

/** Un code d'erreur par cas, pour l'écran. */
export const CODES_DEPLACEMENT = { refuse: "DEPLACEMENT_REFUSE", reste: "DEPLACEMENT_RESTE_PROGRAMME", "a-verifier": "DEPLACEMENT_A_VERIFIER", "a-reprogrammer": "DEPLACEMENT_A_REPROGRAMMER", "a-retirer-a-la-main": "DEPLACEMENT_A_LA_MAIN" } as const;

const MARGE_MS = 30 * 60 * 1000;
export const LONGUEUR_MAX_TEXTE_PROGRAMME = 5000;
export const LONGUEUR_MAX_COMMENTAIRE_PROGRAMME = 2000;

export const PHRASES_DEPLACEMENT = {
  introuvable: "Cette publication est introuvable. Rechargez la page.",
  jourInvalide: "Ce jour est illisible : choisissez une date à venir.",
  jourPasse: "Ce jour est passé ou trop proche : choisissez une date à venir, au moins 30 minutes après maintenant.",
  partie: "Cette publication est déjà partie ou publiée : elle ne se déplace plus.",
  passee: "L'heure est passée : cette publication ne se déplace plus.",
  nonProgrammee: "Seule une publication programmée ou validée se déplace d'ici.",
  enCours: "Un envoi est en cours pour cette publication. Rien n'a été changé : réessayez dans une minute.",
  eteint: "L'envoi est éteint : le déplacement chez le diffuseur n'est pas possible pour le moment. La publication reste à son ancienne date, rien n'a été changé.",
  sansReponse: "Le diffuseur ne répond pas pour le moment. L'ancienne date reste, rien n'a été changé : réessayez plus tard.",
  aVerifier: "Le Studio ne sait pas si le retrait a eu lieu chez le diffuseur. L'ancienne date reste, la publication est marquée « à vérifier » : relisez-la chez le diffuseur.",
  aLaMain: "Le diffuseur n'a pas pu retirer cette publication. L'ancienne date reste, elle est marquée « à retirer à la main » : retirez-la chez le diffuseur.",
  partielle: (retires: string, restent: string): string => `Retrait partiel. Retiré chez le diffuseur : ${retires}. Reste à l'ancienne date : ${restent}. Le texte et le fichier sont gardés.`,
  deplace: (jour: string): string => `Déplacée au ${jour}. Elle repart une seule fois, à cette date.`,
  deplaceAVerifier: (jour: string): string => `La nouvelle date (${jour}) est notée dans le Studio, mais le Studio ne peut pas encore la changer chez le diffuseur : elle est marquée « à vérifier ». Vérifiez-la chez le diffuseur.`,
  dejaFait: "Cette demande est déjà faite : rien n'a été changé de plus.",
  aPlacer: "Le retrait a eu lieu, mais la nouvelle date n'a pas pu être enregistrée. La publication est de retour dans « À placer », avec son texte : replacez-la à la date voulue.",
  aVerifierFin: "Le retrait a eu lieu chez le diffuseur, mais le Studio n'a pas pu enregistrer la suite. La publication est marquée « à vérifier » : relisez-la dans le calendrier.",
  notification: "Une publication déplacée est de retour dans « À placer » : choisissez sa nouvelle date.",
  texteVide: "Le texte ne peut pas être vide.",
  texteLong: "Ce texte est trop long.",
  commentaireLong: "Le premier commentaire est trop long.",
  reseauInconnu: "Ce réseau n'est pas prévu pour cette publication.",
  texteInchange: "Le texte est déjà celui-ci : rien n'a été changé.",
  texteModifie: "Texte modifié. Il doit être validé de nouveau : cliquez sur Valider quand il vous convient. Rien ne part avant.",
  texteModifiePropose: "Texte modifié. L'entrée repasse à « Proposée » : elle doit être relue puis validée par vous.",
  texteAVerifier: "Texte modifié dans le Studio, mais le Studio ne peut pas encore le changer chez le diffuseur : la publication est marquée « à vérifier ». Vérifiez-la chez le diffuseur.",
} as const;

const ETATS_FIN_ENVOI = new Set(["envoye", "a-envoyer"]);
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const NOMS_RESEAUX: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube" };
const nomReseau = (r: string): string => NOMS_RESEAUX[r] ?? r;
const instants = (c: CreneauPlan): number[] => Object.values(c.heuresParReseau ?? {}).filter((h): h is string => typeof h === "string").map((h) => Date.parse(h));
const jourExiste = (j: string): boolean => {
  if (!JOUR.test(j)) return false;
  const [a, m, d] = j.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10) === j;
};
const jourLisible = (j: string): string => `${j.slice(8, 10)}/${j.slice(5, 7)}`;
const refus = (message: string): ResultatDeplacement => ({ ok: false, etat: "refuse", message });

async function ouverts(d: DepsDeplacement): Promise<boolean> {
  try {
    return (await d.reglagesOuverts()) === true;
  } catch {
    return false;
  }
}

/** Un post existe-t-il (ou a-t-il pu exister) chez le diffuseur pour cet envoi ? Sinon : rien à retirer, aucun appel. */
async function aUnPostPossible(e: EnvoiPlanifie, etats: DepsDeplacement["etats"]): Promise<boolean> {
  if (typeof e.cleDiffuseur === "string") return true;
  const [creation, promotion] = await Promise.all([etats.lire(`creation:${e.cle}`), etats.lire(`promotion:${e.cle}`)]);
  return creation === "cree" || creation === "en-cours" || promotion === "programme" || promotion === "en-cours" || promotion === "a-verifier";
}

const annules = (liste: EnvoiPlanifie[], le: string): LotEcritures["enregistrer"] =>
  liste.map((e) => ({ collection: "envoisPlanifies" as const, entite: { ...e, statut: "annule" as const, modifieLe: le } }));

type Preparation =
  | { ok: false; res: ResultatDeplacement }
  | { ok: true; c: CreneauPlan; vivants: EnvoiPlanifie[]; avecPost: EnvoiPlanifie[]; versionSuivante: number };

/** Gardes communes : créneau lisible, programmé ou validé, non partie, non passé, aucun envoi en cours. Aucune écriture, aucun appel. */
async function preparer(d: DepsDeplacement, creneauId: string): Promise<Preparation> {
  const c = typeof creneauId === "string" && creneauId ? await d.creneau(creneauId) : null;
  if (!c) return { ok: false, res: refus(PHRASES_DEPLACEMENT.introuvable) };
  if (c.statut === "publie" || c.statut === "echec") return { ok: false, res: refus(PHRASES_DEPLACEMENT.partie) };
  if (c.statut !== "programme" && c.statut !== "valide") return { ok: false, res: refus(PHRASES_DEPLACEMENT.nonProgrammee) };
  const t = d.maintenant().getTime();
  if (instants(c).some((h) => Number.isNaN(h) || h <= t)) return { ok: false, res: refus(PHRASES_DEPLACEMENT.passee) };
  const tous = await d.envois(c.id);
  if (tous.some((e) => ETATS_FIN_ENVOI.has(e.statut))) return { ok: false, res: refus(PHRASES_DEPLACEMENT.partie) };
  const vivants = tous.filter((e) => e.statut !== "annule");
  for (const e of vivants) if ((await d.etats.lire(`promotion:${e.cle}`)) === "en-cours") return { ok: false, res: refus(PHRASES_DEPLACEMENT.enCours) };
  const avecPost: EnvoiPlanifie[] = [];
  for (const e of vivants) if (await aUnPostPossible(e, d.etats)) avecPost.push(e);
  // Version suivante : jamais égale ni inférieure à une clé déjà utilisée (une clé retirée ne se réutilise pas).
  const versionSuivante = Math.max(c.decalages, ...tous.map((e) => e.versionCreneau)) + 1;
  return { ok: true, c, vivants, avecPost, versionSuivante };
}

/**
 * Retire chez le diffuseur, envoi par envoi. Rend `null` si TOUT est retiré (ou s'il n'y avait rien à retirer),
 * sinon la fin : l'ancienne date reste ; les envois déjà retirés passent « annule » tout de suite (ils n'existent plus).
 */
async function retirerTout(d: DepsDeplacement, p: Extract<Preparation, { ok: true }>, port: PortRetraitDiffuseur): Promise<ResultatDeplacement | null> {
  if (p.avecPost.length === 0) return null;
  if (!(await ouverts(d))) return { ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.eteint };
  const retires: EnvoiPlanifie[] = [];
  const le = d.maintenant().toISOString();
  for (const e of p.avecPost) {
    let issue: IssueRetraitDiffuseur;
    try {
      issue = await port.retirer(e);
    } catch {
      issue = "a-verifier";
    }
    if (issue === "retire") {
      retires.push(e);
      continue;
    }
    if (issue === "a-verifier") await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
    if (issue === "refuse") await d.etats.noter(`retrait:${e.cle}`, "a-retirer-a-la-main");
    if (retires.length > 0) await d.appliquer({ supprimer: [], enregistrer: annules(retires, le) });
    const base = issue === "a-verifier" ? PHRASES_DEPLACEMENT.aVerifier : issue === "refuse" ? PHRASES_DEPLACEMENT.aLaMain : PHRASES_DEPLACEMENT.sansReponse;
    const restent = p.avecPost.filter((x) => !retires.includes(x));
    const message = retires.length > 0 ? `${PHRASES_DEPLACEMENT.partielle(retires.map((x) => nomReseau(x.reseau)).join(", "), restent.map((x) => nomReseau(x.reseau)).join(", "))} ${base}` : base;
    const etat: EtatEchecDeplacement = issue === "a-verifier" ? "a-verifier" : issue === "refuse" ? "a-retirer-a-la-main" : "reste";
    return { ok: false, etat, message, ...(retires.length > 0 ? { ecritures: true as const } : {}) };
  }
  return null;
}

/** Marque « à vérifier » chaque envoi dont le post est (peut-être) resté chez le diffuseur : la garde L5-02d la lit et bloque tout nouveau geste. */
async function marquerAVerifier(d: DepsDeplacement, avecPost: EnvoiPlanifie[]): Promise<void> {
  for (const e of avecPost) await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
}

/**
 * Repli quand l'écriture locale échoue APRÈS un retrait réussi : retour dans « À placer » (créneau archivé avec `retireLe`, texte gardé,
 * visuel « valide »), marque « a-reprogrammer », notification. Si même cela échoue : « à vérifier ». Jamais « Programmé ».
 */
async function reposerDansAPlacer(d: DepsDeplacement, p: Extract<Preparation, { ok: true }>): Promise<ResultatDeplacement> {
  const le = d.maintenant().toISOString();
  try {
    const r1 = p.c.statut === "programme" ? transitionner(p.c, "valide", "studio") : { ok: true as const, creneau: p.c };
    if (!r1.ok) throw new Error(r1.raison);
    const r2 = transitionner(r1.creneau, "archive", "studio");
    if (!r2.ok) throw new Error(r2.raison);
    const lot: LotEcritures = { supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: { ...r2.creneau, retireLe: le } as CreneauPlan }, ...annules(p.vivants, le)] };
    if (p.c.visuelId) {
      const v = await d.visuel(p.c.visuelId);
      if (v && v.statut === "programme") lot.enregistrer.push({ collection: "visuels", entite: { ...v, statut: "valide", modifieLe: le } as never });
    }
    await d.appliquer(lot);
  } catch {
    await marquerAVerifier(d, p.avecPost);
    return { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin };
  }
  for (const e of p.avecPost) await d.etats.noter(`deplacement:${e.cle}`, "a-reprogrammer");
  try {
    await d.notifier({ cle: p.c.id, motif: "a-reprogrammer", raison: PHRASES_DEPLACEMENT.notification });
  } catch {
    /* la cloche est secondaire : l'état est déjà écrit */
  }
  return { ok: false, etat: "a-reprogrammer", message: PHRASES_DEPLACEMENT.aPlacer, ecritures: true };
}

async function noterFait(d: DepsDeplacement, cleFait: string, valeur: string): Promise<void> {
  try {
    await d.etats.noter(cleFait, valeur);
  } catch {
    /* le rejeu est une aide : l'écriture principale a eu lieu */
  }
}

export async function deplacerProgrammation(d: DepsDeplacement, demande: DemandeDeplacement): Promise<ResultatDeplacement> {
  const cleFait = `deplace-fait:${demande?.creneauId}:${demande?.cle}`;
  if (typeof demande?.cle === "string" && demande.cle && (await d.etats.lire(cleFait)) !== undefined) {
    return { ok: true, etat: "deja-fait", message: PHRASES_DEPLACEMENT.dejaFait, creneauId: demande.creneauId };
  }
  const p = await preparer(d, demande?.creneauId);
  if (!p.ok) return p.res;
  const jour = demande.nouveauJour;
  if (typeof jour !== "string" || !jourExiste(jour)) return refus(PHRASES_DEPLACEMENT.jourInvalide);
  const heuresActuelles = Object.entries(p.c.heuresParReseau ?? {}).filter((x): x is [string, string] => typeof x[1] === "string");
  const nouvelles: Record<string, string> = Object.fromEntries(heuresActuelles.map(([r, h]) => [r, instantParis(jour, heureAffichageParis(h))]));
  const t = d.maintenant().getTime();
  // Une date ne recule jamais dans le passé : refusée, ancienne date gardée.
  if (Object.values(nouvelles).some((h) => Number.isNaN(Date.parse(h)) || Date.parse(h) < t + MARGE_MS) || (heuresActuelles.length === 0 && jour < d.maintenant().toISOString().slice(0, 10))) {
    return refus(PHRASES_DEPLACEMENT.jourPasse);
  }

  const local = d.diffuseur === null && p.avecPost.length > 0;
  if (!local && d.diffuseur) {
    const fin = await retirerTout(d, p, d.diffuseur);
    if (fin) return fin;
  }

  // Écriture locale. Retiré chez le diffuseur : les envois passent « annule », le créneau prend la date et la version suivante (nouvelle clé).
  // Déplacement local (port absent) : seule la date du créneau change ; l'envoi garde sa clé et est marqué « à vérifier » (aucun doublon).
  try {
    if (local) await marquerAVerifier(d, p.avecPost);
    const r1 = !local && p.c.statut === "programme" ? transitionner(p.c, "valide", "studio") : { ok: true as const, creneau: p.c };
    if (!r1.ok) throw new Error(r1.raison);
    const creneau: CreneauPlan = { ...r1.creneau, jourVise: jour, heuresParReseau: { ...r1.creneau.heuresParReseau, ...nouvelles }, decalages: local ? p.c.decalages : p.versionSuivante };
    const le = d.maintenant().toISOString();
    await d.appliquer({ supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: creneau }, ...(local ? [] : annules(p.vivants, le))] });
  } catch {
    return local ? { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin } : reposerDansAPlacer(d, p);
  }
  await noterFait(d, cleFait, "fait");
  const nouvellesCles = local ? undefined : p.vivants.map((e) => cleEnvoi(e.videoId, e.reseau, p.versionSuivante));
  return local
    ? { ok: true, etat: "deplace-a-verifier", message: PHRASES_DEPLACEMENT.deplaceAVerifier(jourLisible(jour)), creneauId: p.c.id }
    : { ok: true, etat: "deplace", message: PHRASES_DEPLACEMENT.deplace(jourLisible(jour)), creneauId: p.c.id, ...(nouvellesCles ? { nouvellesCles } : {}) };
}

export async function modifierTexteProgramme(d: DepsDeplacement, demande: DemandeTexte): Promise<ResultatDeplacement> {
  const cleFait = `texte-fait:${demande?.creneauId}:${demande?.cle}`;
  if (typeof demande?.cle === "string" && demande.cle && (await d.etats.lire(cleFait)) !== undefined) {
    return { ok: true, etat: "deja-fait", message: PHRASES_DEPLACEMENT.dejaFait, creneauId: demande.creneauId };
  }
  const texte = typeof demande?.texte === "string" ? demande.texte.trim() : "";
  if (!texte) return refus(PHRASES_DEPLACEMENT.texteVide);
  if (texte.length > LONGUEUR_MAX_TEXTE_PROGRAMME) return refus(PHRASES_DEPLACEMENT.texteLong);
  const commentaire = typeof demande.premierCommentaire === "string" ? demande.premierCommentaire.trim() : undefined;
  if (commentaire !== undefined && commentaire.length > LONGUEUR_MAX_COMMENTAIRE_PROGRAMME) return refus(PHRASES_DEPLACEMENT.commentaireLong);
  const p = await preparer(d, demande.creneauId);
  if (!p.ok) return p.res;
  const reseau = demande.reseau as keyof NonNullable<CreneauPlan["textes"]>;
  if (typeof demande.reseau !== "string" || !Object.hasOwn(p.c.heuresParReseau ?? {}, demande.reseau)) return refus(PHRASES_DEPLACEMENT.reseauInconnu);
  const avant = p.c.textes?.[reseau] ?? { texte: "", premierCommentaire: "" };
  const apres = { texte, premierCommentaire: commentaire ?? avant.premierCommentaire };
  if (apres.texte === avant.texte && apres.premierCommentaire === avant.premierCommentaire) return { ok: true, etat: "inchange", message: PHRASES_DEPLACEMENT.texteInchange, creneauId: p.c.id };

  // Le contrôleur de texte (L7-12, L3-09) est relu avant tout appel : un texte bloqué ne part jamais chez le diffuseur.
  const controle = controlerProgrammation({ reseau: demande.reseau as never, texte: apres.texte, commentaire: apres.premierCommentaire, auteur: demande.auteur === "will" ? "will" : "autre" } as never);
  if (controle.bloque) return refus(controle.avertissements[0] ?? PHRASES_DEPLACEMENT.texteVide);

  const local = d.diffuseur === null && p.avecPost.length > 0;
  if (!local && d.diffuseur) {
    const fin = await retirerTout(d, p, d.diffuseur);
    if (fin) return fin;
  }
  try {
    if (local) await marquerAVerifier(d, p.avecPost);
    // Dévalidation : plus de `valideeLe` (le clic Valider le réécrira) ; un autre que le fondateur : « Proposée ».
    const r1 = p.c.statut === "programme" ? transitionner(p.c, "valide", "studio") : { ok: true as const, creneau: p.c };
    if (!r1.ok) throw new Error(r1.raison);
    const r2 = transitionner(r1.creneau, "a_valider", "studio");
    if (!r2.ok) throw new Error(r2.raison);
    const r3 = demande.auteur === "will" ? r2 : transitionner(r2.creneau, "propose", "studio");
    if (!r3.ok) throw new Error(r3.raison);
    const creneau: CreneauPlan = { ...r3.creneau, textes: { ...(p.c.textes ?? {}), [reseau]: apres }, decalages: p.versionSuivante };
    const le = d.maintenant().toISOString();
    await d.appliquer({ supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: creneau }, ...annules(p.vivants, le)] });
  } catch {
    return local ? { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin } : reposerDansAPlacer(d, p);
  }
  await noterFait(d, cleFait, "fait");
  return {
    ok: true,
    etat: local ? "modifie-a-verifier" : "modifie",
    message: local ? PHRASES_DEPLACEMENT.texteAVerifier : demande.auteur === "will" ? PHRASES_DEPLACEMENT.texteModifie : PHRASES_DEPLACEMENT.texteModifiePropose,
    creneauId: p.c.id,
  };
}

/**
 * Câblage serveur : dépendances réelles, chargées à l'appel. `diffuseur: null` : AUCUN appel au diffuseur tant que la fonction de retrait
 * n'est pas sur master (bloqué : fonction client manquante `retirer(demande: DemandeRetraitZernio): Promise<ResultatRetraitZernio>`).
 */
async function depsServeur(): Promise<DepsDeplacement> {
  const { depots, maintenant } = await import("@/services/_commun");
  const { appliquerLot } = await import("@/donnees/memoire");
  const { PREFIXE_ETATS_ENVOI_CALENDRIER: prefixe } = await import("@/services/branchement-envoi-calendrier");
  const z = await import("@/services/zernio");
  const d = depots();
  return {
    diffuseur: null,
    reglagesOuverts: async () => (await z.envoiZernioAutorise()) === true && (await z.envoiCalendrierAutorise()) === true && (await z.editorialeActive()) === true,
    creneau: async (id) => ((await d.creneauxEditoriaux.obtenir(id)) as CreneauPlan | null) ?? null,
    envois: (creneauId) => d.envoisPlanifies.lister((e) => e.creneauId === creneauId),
    visuel: async (id) => (await d.visuels.obtenir(id)) ?? null,
    appliquer: appliquerLot,
    etats: {
      async lire(cle) {
        const v = (await d.parametres.obtenir(prefixe + cle))?.valeur;
        return typeof v === "string" ? v : undefined;
      },
      async noter(cle, valeur) {
        const id = prefixe + cle;
        const existant = await d.parametres.obtenir(id);
        const m = maintenant();
        await d.parametres.enregistrer({ id, valeur, creeLe: existant?.creeLe ?? m, modifieLe: m });
      },
    },
    notifier: async (n) => {
      const { creerNotification } = await import("@/services/notifications");
      await creerNotification({ type: "echec", titre: "Calendrier : publication à replacer", message: n.raison, lien: "/calendrier" }, { cloche: true });
    },
    maintenant: () => new Date(maintenant()),
  };
}

export const deplacerProgrammationServeur = async (demande: DemandeDeplacement): Promise<ResultatDeplacement> => deplacerProgrammation(await depsServeur(), demande);
export const modifierTexteProgrammeServeur = async (demande: DemandeTexte): Promise<ResultatDeplacement> => modifierTexteProgramme(await depsServeur(), demande);
