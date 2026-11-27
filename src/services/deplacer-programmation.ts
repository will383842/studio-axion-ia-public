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
 *  - `client.retirer` est sur master (CAL-22) et branché par défaut dans le câblage serveur. Sans port de retrait (`diffuseur: null`) et avec un post possible chez le diffuseur :
 *    AUCUN appel et AUCUNE écriture, l'ancienne date et l'ancien texte restent (jamais un créneau décalé avec un post resté à l'ancienne date, L5-02d).
 *    Sans post chez le diffuseur (avant la promotion), le déplacement se fait en local, sans appel.
 *  - la garde L5-02d (`niveauDiffuseurDuCreneau`) est relue avant tout geste : « à vérifier », « en cours » et « parti » refusent ;
 *  - chaque déplacement écrit sa ligne du journal des décalages (ancien et nouveau jour), comme L4-06.
 * Tout est injecté : aucun service serveur, aucun appel réel, aucun fournisseur importé ici.
 */
import { nomDuReseau } from "@/reseaux/hors-video";
import { verifierSaisie } from "@/components/calendrier/FicheEntree";
import { occupeBuffer } from "@/domaine/buffer";
import type { LotEcritures } from "@/domaine/depots";
import { type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { resoudreCleEnvoi } from "@/services/envois-planifies";
import type { IdReseau, Publication } from "@/domaine/types";
import { estReseauDeclinaison } from "@/reseaux/codes";
import { heureAffichageParis, transitionner } from "@/domaine/plan-editorial/statuts";
import { instantParis } from "@/lib/horloge-paris";
import { controlerProgrammation } from "@/services/controle-programmation";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import type { CreneauPlan } from "@/services/plan-editorial";

export type IssueRetraitDiffuseur = "retire" | "refuse" | "sans-reponse" | "a-verifier";

/** Port du retrait chez le diffuseur. Lève ou rend « a-verifier » quand la réponse est incertaine. */
export interface PortRetraitDiffuseur {
  retirer(envoi: EnvoiPlanifie): Promise<IssueRetraitDiffuseur>;
}

export interface DepsDeplacement {
  /** `null` = fonction du client manquante sur master : rien ne change si un post existe chez le diffuseur. */
  diffuseur: PortRetraitDiffuseur | null;
  /** Les trois réglages d'envoi sont-ils ouverts ? Erreur ou valeur autre que `true` = fermé. */
  reglagesOuverts(creneauId?: string): Promise<boolean>;
  creneau(id: string): Promise<CreneauPlan | null>;
  envois(creneauId: string): Promise<EnvoiPlanifie[]>;
  /** Une entrée d'envoi par sa clé (pour résoudre la clé propre au créneau) ; absent = clé ancienne. */
  envoiParCle?(cle: string): Promise<EnvoiPlanifie | null | undefined>;
  visuel(id: string): Promise<{ id: string; statut: string } | null>;
  appliquer(lot: LotEcritures): Promise<void>;
  /** La garde L5-02d (`niveauDiffuseurDuCreneau`), lue dans la même section que l'écriture. */
  niveau(creneauId: string): Promise<{ niveau: "libre" | "brouillon" | "en-cours" | "a-verifier" | "programme" | "parti" }>;
  /** Les publications locales dont la clé d'envoi est l'une de ces clés du diffuseur. */
  publicationsDeCles(cles: string[]): Promise<Publication[]>;
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

export type EtatDeplacement = "deplace" | "modifie" | "deja-fait" | "inchange";
export type EtatEchecDeplacement = "refuse" | "reste" | "a-verifier" | "a-reprogrammer" | "a-retirer-a-la-main";
export type ResultatDeplacement =
  | { ok: true; etat: EtatDeplacement; message: string; creneauId: string; /** Clés d'envoi que le tour d'envoi créera (version suivante). */ nouvellesCles?: string[] }
  | { ok: false; etat: EtatEchecDeplacement; message: string; /** Vrai si des écritures ont eu lieu : l'écran doit se rafraîchir. */ ecritures?: true };

/** Un code d'erreur par cas, pour l'écran. */
export const CODES_DEPLACEMENT = { refuse: "DEPLACEMENT_REFUSE", reste: "DEPLACEMENT_RESTE_PROGRAMME", "a-verifier": "DEPLACEMENT_A_VERIFIER", "a-reprogrammer": "DEPLACEMENT_A_REPROGRAMMER", "a-retirer-a-la-main": "DEPLACEMENT_A_LA_MAIN" } as const;

const MARGE_MS = 30 * 60 * 1000;

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
  dateInchangee: "La publication est déjà à cette date : rien n'a été changé.",
  sansRetrait: "Le Studio ne peut pas encore changer la date ou le texte chez le diffuseur. Rien n'a été changé : la publication reste à son ancienne date, avec son texte. Pour la modifier, passez par le diffuseur.",
  dejaAVerifier: "Le Studio ne sait pas si cette publication est déjà programmée chez le diffuseur : rien n'a été changé. Relisez-la chez le diffuseur.",
  dejaFait: "Cette demande est déjà faite : rien n'a été changé de plus.",
  aPlacer: "Le retrait a eu lieu, mais la nouvelle date n'a pas pu être enregistrée. La publication est de retour dans « À placer », avec son texte : replacez-la à la date voulue.",
  rienChange: "Le Studio n'a pas pu enregistrer le changement. Rien n'a été retiré chez le diffuseur : réessayez dans un instant.",
  aVerifierFin: "Le retrait a eu lieu chez le diffuseur, mais le Studio n'a pas pu enregistrer la suite. La publication est marquée « à vérifier » : relisez-la dans le calendrier.",
  notification: "Une publication déplacée est de retour dans « À placer » : choisissez sa nouvelle date.",
  texteVide: "Le texte ne peut pas être vide.",
  texteBloque: "Le contrôle du texte le refuse : corrigez-le avant de l'enregistrer.",
  reseauInconnu: "Ce réseau n'est pas prévu pour cette publication.",
  texteInchange: "Le texte est déjà celui-ci : rien n'a été changé.",
  texteModifie: "Texte modifié. Il doit être validé de nouveau : cliquez sur Valider quand il vous convient. Rien ne part avant.",
  texteModifiePropose: "Texte modifié. L'entrée repasse à « Proposée » : elle doit être relue puis validée par vous.",
} as const;

const ETATS_FIN_ENVOI = new Set(["envoye", "a-envoyer"]);
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const nomReseau = (r: string): string => nomDuReseau(r);
const instants = (c: CreneauPlan): number[] => Object.values(c.heuresParReseau ?? {}).filter((h): h is string => typeof h === "string").map((h) => Date.parse(h));
const jourExiste = (j: string): boolean => {
  if (!JOUR.test(j)) return false;
  const [a, m, d] = j.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10) === j;
};
const jourLisible = (j: string): string => `${j.slice(8, 10)}/${j.slice(5, 7)}`;
const refus = (message: string): ResultatDeplacement => ({ ok: false, etat: "refuse", message });

async function ouverts(d: DepsDeplacement, creneauId?: string): Promise<boolean> {
  try {
    return (await d.reglagesOuverts(creneauId)) === true;
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
  | { ok: true; c: CreneauPlan; vivants: EnvoiPlanifie[]; avecPost: EnvoiPlanifie[]; versionSuivante: number; niveau: string };

/** Gardes communes : créneau lisible, programmé ou validé, non partie, non passé, garde L5-02d, aucun envoi en cours. Aucune écriture, aucun appel. */
async function preparer(d: DepsDeplacement, creneauId: string): Promise<Preparation> {
  const c = typeof creneauId === "string" && creneauId ? await d.creneau(creneauId) : null;
  if (!c) return { ok: false, res: refus(PHRASES_DEPLACEMENT.introuvable) };
  if (c.statut === "publie" || c.statut === "echec") return { ok: false, res: refus(PHRASES_DEPLACEMENT.partie) };
  if (c.statut !== "programme" && c.statut !== "valide") return { ok: false, res: refus(PHRASES_DEPLACEMENT.nonProgrammee) };
  const t = d.maintenant().getTime();
  if (instants(c).some((h) => Number.isNaN(h) || h <= t)) return { ok: false, res: refus(PHRASES_DEPLACEMENT.passee) };
  const niveau = (await d.niveau(c.id)).niveau;
  if (niveau === "parti") return { ok: false, res: refus(PHRASES_DEPLACEMENT.partie) };
  if (niveau === "en-cours") return { ok: false, res: refus(PHRASES_DEPLACEMENT.enCours) };
  if (niveau === "a-verifier") return { ok: false, res: { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.dejaAVerifier } };
  const tous = await d.envois(c.id);
  if (tous.some((e) => ETATS_FIN_ENVOI.has(e.statut))) return { ok: false, res: refus(PHRASES_DEPLACEMENT.partie) };
  const vivants = tous.filter((e) => e.statut !== "annule");
  for (const e of vivants) {
    if ((await d.etats.lire(`promotion:${e.cle}`)) === "en-cours" || (await d.etats.lire(`creation:${e.cle}`)) === "en-cours") return { ok: false, res: refus(PHRASES_DEPLACEMENT.enCours) };
  }
  const avecPost: EnvoiPlanifie[] = [];
  for (const e of vivants) if (await aUnPostPossible(e, d.etats)) avecPost.push(e);
  const sansPostVivant = avecPost.length === 0;
  // Un envoi déjà « annule » dont la marque dit encore « programmé » ou « à vérifier » a peut-être un post chez le diffuseur : il passe aussi par le retrait.
  for (const e of tous) {
    if (e.statut !== "annule") continue;
    const m = await d.etats.lire(`promotion:${e.cle}`);
    if (m === "programme" || m === "a-verifier") avecPost.push(e);
  }
  // Version suivante : jamais égale ni inférieure à une clé déjà utilisée (une clé retirée ne se réutilise pas).
  const versionSuivante = Math.max(c.decalages, ...tous.map((e) => e.versionCreneau)) + 1;
  // La garde voit un post chez le diffuseur (programmé ou brouillon) que les envois vivants ne montrent pas : impossible de savoir lequel retirer, rien n'est changé.
  if (sansPostVivant && (niveau === "programme" || niveau === "brouillon")) return { ok: false, res: { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.dejaAVerifier } };
  return { ok: true, c, vivants, avecPost, versionSuivante, niveau };
}

/** Après un retrait confirmé et l'écriture : l'envoi annulé n'est plus « programmé » aux yeux de la garde L5-02d (sinon l'ancienne date reste annoncée). */
async function sortirDeLaGarde(d: DepsDeplacement, retires: EnvoiPlanifie[]): Promise<void> {
  for (const e of retires) {
    try {
      await d.etats.noter(`promotion:${e.cle}`, "libre");
    } catch {
      /* la marque est une aide : l'écriture principale a eu lieu */
    }
  }
}

/**
 * Retire chez le diffuseur, envoi par envoi. Rend `null` si TOUT est retiré (ou s'il n'y avait rien à retirer),
 * sinon la fin : l'ancienne date reste ; les envois déjà retirés passent « annule » tout de suite (ils n'existent plus).
 * Les réglages sont relus JUSTE AVANT chaque retrait.
 */
async function retirerTout(d: DepsDeplacement, p: Extract<Preparation, { ok: true }>, port: PortRetraitDiffuseur): Promise<ResultatDeplacement | null> {
  const retires: EnvoiPlanifie[] = [];
  const le = d.maintenant().toISOString();
  const fin = async (r: Extract<ResultatDeplacement, { ok: false }>): Promise<ResultatDeplacement> => {
    if (retires.length === 0) return r;
    try {
      await d.appliquer({ supprimer: [], enregistrer: [...annules(retires, le), ...(await liberer(d, retires, le))] });
      await sortirDeLaGarde(d, retires);
    } catch {
      // Des retraits sont confirmés mais l'écriture a échoué : jamais un faux « programmé ». Marque « à vérifier » pour chaque envoi retiré.
      for (const e of retires) {
        try {
          await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
        } catch {
          /* la marque est une aide */
        }
      }
      return { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin, ecritures: true };
    }
    const restent = p.avecPost.filter((x) => !retires.includes(x));
    return { ...r, message: `${PHRASES_DEPLACEMENT.partielle(retires.map((x) => nomReseau(x.reseau)).join(", "), restent.map((x) => nomReseau(x.reseau)).join(", "))} ${r.message}`, ecritures: true };
  };
  for (const e of p.avecPost) {
    if (!(await ouverts(d, p.c.id))) return fin({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.eteint });
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
    // Une marque ratée ne doit jamais empêcher d'écrire « annule » pour les envois déjà retirés (sinon faux « Programmé »).
    try {
      if (issue === "a-verifier") await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
      if (issue === "refuse") await d.etats.noter(`retrait:${e.cle}`, "a-retirer-a-la-main");
    } catch {
      /* la marque est une aide : la phrase dit déjà « à vérifier » ou « à retirer à la main » */
    }
    if (issue === "a-verifier") return fin({ ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifier });
    if (issue === "refuse") return fin({ ok: false, etat: "a-retirer-a-la-main", message: PHRASES_DEPLACEMENT.aLaMain });
    return fin({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansReponse });
  }
  return null;
}

/** Les publications locales de posts retirés ne « occupent » plus le réseau (sinon le tour exclut la nouvelle version) : état « absent », rien de supprimé. */
async function liberer(d: DepsDeplacement, retires: EnvoiPlanifie[], le: string): Promise<LotEcritures["enregistrer"]> {
  const cles = retires.map((e) => e.cleDiffuseur).filter((k): k is string => typeof k === "string");
  if (cles.length === 0) return [];
  const pubs = await d.publicationsDeCles(cles);
  return pubs.filter((x) => occupeBuffer(x)).map((x) => ({ collection: "publications" as const, entite: { ...x, etatEnvoi: "absent" as const, modifieLe: le } }));
}

/**
 * Repli quand l'écriture locale échoue APRÈS un retrait réussi : retour dans « À placer » (créneau archivé avec `retireLe`, texte gardé,
 * y compris le texte modifié, visuel « valide »), marque « a-reprogrammer », notification. Si même cela échoue : « à vérifier ». Jamais « Programmé ».
 */
async function reposerDansAPlacer(d: DepsDeplacement, p: Extract<Preparation, { ok: true }>, creneau: CreneauPlan = p.c): Promise<ResultatDeplacement> {
  const le = d.maintenant().toISOString();
  try {
    const r1 = creneau.statut === "programme" ? transitionner(creneau, "valide", "studio") : { ok: true as const, creneau };
    if (!r1.ok) throw new Error(r1.raison);
    const r2 = transitionner(r1.creneau, "archive", "studio");
    if (!r2.ok) throw new Error(r2.raison);
    const archive = sansAvant({ ...r2.creneau, retireLe: le } as CreneauPlan);
    const lot: LotEcritures = { supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: archive }, ...annules(p.vivants, le), ...(await liberer(d, p.avecPost, le))] };
    if (p.c.visuelId) {
      const v = await d.visuel(p.c.visuelId);
      if (v && v.statut === "programme") lot.enregistrer.push({ collection: "visuels", entite: { ...v, statut: "valide", modifieLe: le } as never });
    }
    await d.appliquer(lot);
    await sortirDeLaGarde(d, p.avecPost);
  } catch {
    for (const e of p.avecPost) {
      try {
        await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
      } catch {
        /* les autres envois sont quand même marqués */
      }
    }
    return { ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin };
  }
  for (const e of p.avecPost) {
    try {
      await d.etats.noter(`deplacement:${e.cle}`, "a-reprogrammer");
    } catch {
      /* l'état est déjà écrit : la phrase « À placer » reste dite et la cloche part */
    }
  }
  try {
    await d.notifier({ cle: p.c.id, motif: "a-reprogrammer", raison: PHRASES_DEPLACEMENT.notification });
  } catch {
    /* la cloche est secondaire : l'état est déjà écrit */
  }
  return { ok: false, etat: "a-reprogrammer", message: PHRASES_DEPLACEMENT.aPlacer, ecritures: true };
}

/** Rejeu : la marque porte la version du créneau écrite par la demande ; elle ne vaut que tant que le créneau est à cette version (A, puis B, puis A : trois demandes). */
async function dejaFait(d: DepsDeplacement, creneauId: string, cle: string, cleFait: string): Promise<boolean> {
  if (typeof cle !== "string" || !cle) return false;
  const marque = await d.etats.lire(cleFait);
  if (marque === undefined) return false;
  const c = typeof creneauId === "string" && creneauId ? await d.creneau(creneauId) : null;
  return c !== null && String(c.decalages) === marque;
}

async function noterFait(d: DepsDeplacement, cleFait: string, version: number): Promise<void> {
  try {
    await d.etats.noter(cleFait, String(version));
  } catch {
    /* le rejeu est une aide : l'écriture principale a eu lieu */
  }
}

function sansAvant(c: CreneauPlan): CreneauPlan {
  const copie = { ...c };
  delete copie.aRenvoyer;
  return copie;
}

/** Sans port de retrait et avec un post possible chez le diffuseur : aucun appel, aucune écriture. */
const bloque = (d: DepsDeplacement, p: Extract<Preparation, { ok: true }>): boolean => d.diffuseur === null && (p.avecPost.length > 0 || p.niveau === "programme" || p.niveau === "brouillon");

export async function deplacerProgrammation(d: DepsDeplacement, demande: DemandeDeplacement): Promise<ResultatDeplacement> {
  const cleFait = `deplace-fait:${demande?.creneauId}:${demande?.cle}`;
  if (await dejaFait(d, demande?.creneauId, demande?.cle, cleFait)) return { ok: true, etat: "deja-fait", message: PHRASES_DEPLACEMENT.dejaFait, creneauId: demande.creneauId };
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
  // Même jour, mêmes heures : rien à faire, aucun retrait pour rien.
  if (jour === p.c.jourVise && heuresActuelles.every(([r, h]) => nouvelles[r] === h)) return { ok: true, etat: "inchange", message: PHRASES_DEPLACEMENT.dateInchangee, creneauId: p.c.id };
  if (bloque(d, p)) return { ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansRetrait };

  if (d.diffuseur && p.avecPost.length > 0) {
    const fin = await retirerTout(d, p, d.diffuseur);
    if (fin) return fin;
  }

  // Retiré chez le diffuseur : les envois passent « annule », le créneau prend la date et la version suivante (nouvelle clé), la ligne du journal est écrite.
  const le = d.maintenant().toISOString();
  try {
    const r1 = p.c.statut === "programme" ? transitionner(p.c, "valide", "studio") : { ok: true as const, creneau: p.c };
    if (!r1.ok) throw new Error(r1.raison);
    const creneau: CreneauPlan = sansAvant({ ...r1.creneau, jourVise: jour, heuresParReseau: { ...r1.creneau.heuresParReseau, ...nouvelles }, decalages: p.versionSuivante });
    // La ligne du journal des décalages (ajout seul, comme L4-06) est dans le MÊME lot : une écriture qui échoue n'en laisse aucune.
    const ligne = { id: `decalage:${p.c.id}:${demande.cle}#${p.versionSuivante}`, creneauId: p.c.id, ancienJour: p.c.jourVise, nouveauJour: jour, raison: "Publication programmée déplacée", creeLe: le };
    await d.appliquer({ supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: creneau }, { collection: "journalDecalages", entite: ligne }, ...annules(p.vivants, le), ...(await liberer(d, p.avecPost, le))] });
    await sortirDeLaGarde(d, p.avecPost);
  } catch {
    return p.avecPost.length > 0 ? reposerDansAPlacer(d, p) : { ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.rienChange };
  }
  await noterFait(d, cleFait, p.versionSuivante);
  return { ok: true, etat: "deplace", message: PHRASES_DEPLACEMENT.deplace(jourLisible(jour)), creneauId: p.c.id, nouvellesCles: await Promise.all(p.vivants.map((e) => resoudreCleEnvoi({ obtenir: async (id) => (await d.envoiParCle?.(id)) ?? null }, { videoId: e.videoId, reseau: e.reseau, versionCreneau: p.versionSuivante, creneauId: p.c.id }))) };
}

export async function modifierTexteProgramme(d: DepsDeplacement, demande: DemandeTexte): Promise<ResultatDeplacement> {
  const cleFait = `texte-fait:${demande?.creneauId}:${demande?.cle}`;
  if (await dejaFait(d, demande?.creneauId, demande?.cle, cleFait)) return { ok: true, etat: "deja-fait", message: PHRASES_DEPLACEMENT.dejaFait, creneauId: demande.creneauId };
  // Une seule garde de saisie : celle de la fiche (retours à la ligne, longueurs, pas de premier commentaire sur TikTok).
  const brut = demande?.reseau as IdReseau;
  if (typeof brut !== "string" || !estReseauDeclinaison(brut)) return refus(PHRASES_DEPLACEMENT.reseauInconnu);
  const reseau = brut;
  const v = verifierSaisie({ texte: demande.texte, ...(demande.premierCommentaire !== undefined ? { premierCommentaire: demande.premierCommentaire } : {}) }, reseau);
  if (!v.ok) return refus(v.message);
  if (!v.saisie.texte.trim()) return refus(PHRASES_DEPLACEMENT.texteVide);
  const p = await preparer(d, demande.creneauId);
  if (!p.ok) return p.res;
  if (!Object.hasOwn(p.c.heuresParReseau ?? {}, reseau)) return refus(PHRASES_DEPLACEMENT.reseauInconnu);
  const avant = p.c.textes?.[reseau] ?? { texte: "", premierCommentaire: "" };
  const apres = { texte: v.saisie.texte, premierCommentaire: v.saisie.premierCommentaire ?? avant.premierCommentaire };
  if (apres.texte === avant.texte && apres.premierCommentaire === avant.premierCommentaire) return { ok: true, etat: "inchange", message: PHRASES_DEPLACEMENT.texteInchange, creneauId: p.c.id };

  // Le contrôleur de texte (L7-12, L3-09) est relu avant tout appel : un texte bloqué ne part jamais chez le diffuseur.
  const controle = controlerProgrammation({ reseau, texte: apres.texte, commentaire: apres.premierCommentaire, auteur: demande.auteur === "will" ? "will" : "machine" });
  if (controle.bloque) return refus(controle.avertissements[0] ?? PHRASES_DEPLACEMENT.texteBloque);

  if (bloque(d, p)) return { ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansRetrait };
  if (d.diffuseur && p.avecPost.length > 0) {
    const fin = await retirerTout(d, p, d.diffuseur);
    if (fin) return fin;
  }
  const modifie: CreneauPlan = { ...p.c, textes: { ...(p.c.textes ?? {}), [reseau]: apres } };
  try {
    // Dévalidation : plus de `valideeLe` (le clic Valider le réécrira) ; un autre que le fondateur : « Proposée ».
    const r1 = modifie.statut === "programme" ? transitionner(modifie, "valide", "studio") : { ok: true as const, creneau: modifie };
    if (!r1.ok) throw new Error(r1.raison);
    const r2 = transitionner(r1.creneau, "a_valider", "studio");
    if (!r2.ok) throw new Error(r2.raison);
    const r3 = demande.auteur === "will" ? r2 : transitionner(r2.creneau, "propose", "studio");
    if (!r3.ok) throw new Error(r3.raison);
    const creneau: CreneauPlan = sansAvant({ ...r3.creneau, decalages: p.versionSuivante });
    const le = d.maintenant().toISOString();
    await d.appliquer({ supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: creneau }, ...annules(p.vivants, le), ...(await liberer(d, p.avecPost, le))] });
    await sortirDeLaGarde(d, p.avecPost);
  } catch {
    return p.avecPost.length > 0 ? reposerDansAPlacer(d, p, modifie) : { ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.rienChange };
  }
  await noterFait(d, cleFait, p.versionSuivante);
  return { ok: true, etat: "modifie", message: demande.auteur === "will" ? PHRASES_DEPLACEMENT.texteModifie : PHRASES_DEPLACEMENT.texteModifiePropose, creneauId: p.c.id };
}

/* --- Adaptateur vers le client du diffuseur de CAL-22 (contrat structurel, aucun import du fournisseur) ---------------------------------- */

/** Contrat du client de CAL-22 (relecture avant, DELETE, relecture après : jamais en aveugle). Import de TYPE seulement. */
export type ClientRetraitCal22 = Pick<ClientZernio, "listerPosts" | "retirer">;
type PostListe = Awaited<ReturnType<ClientRetraitCal22["listerPosts"]>>[number];

/** Tous les posts d'un statut (pages de 100, 50 pages au plus), comme le retrait de CAL-22 : un post au-delà de la première page se retrouve aussi. */
async function listerTous(c: ClientRetraitCal22, status: string): Promise<PostListe[]> {
  const tous: PostListe[] = [];
  const vus = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const lus = await c.listerPosts({ status, page, limit: 100 });
    const neufs = lus.filter((p) => !vus.has(p._id));
    neufs.forEach((p) => vus.add(p._id));
    tous.push(...neufs);
    if (lus.length < 100 || neufs.length === 0) break;
  }
  return tous;
}

/**
 * Le port de retrait sur le client du diffuseur (`retirer` est sur master depuis CAL-22). Brouillon et programmé sont relus ;
 * sans post sous la clé, ou réponse incertaine : « à vérifier » (jamais en aveugle). Le retrait est confirmé AVANT toute écriture locale :
 * l'envoi n'est marqué « annulé » qu'après, donc jamais de brouillon orphelin chez le diffuseur.
 */
export function portRetraitDepuisClient(client: () => ClientRetraitCal22): PortRetraitDiffuseur {
  return {
    async retirer(e) {
      const cle = e.cleDiffuseur ?? e.cle;
      let c: ClientRetraitCal22;
      let posts: PostListe[];
      try {
        // Client ou liste impossibles (clé absente, diffuseur muet) : rien n'a été retiré, aucune marque.
        c = client();
        posts = [...(await listerTous(c, "draft")), ...(await listerTous(c, "scheduled"))];
      } catch {
        return "sans-reponse";
      }
      const post = posts.find((x) => x.metadata?.studioCle === cle);
      if (!post) return "a-verifier";
      try {
        const r = await c.retirer({ postId: post._id, cleJournal: cle });
        return r.etat === "retire" ? "retire" : r.etat === "a-verifier" ? "a-verifier" : "refuse";
      } catch (err) {
        // Même classement que CAL-22 : réponse incertaine ou erreur inconnue = « à vérifier » ; refus = refus ; coupure avant envoi = sans réponse.
        const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
        if (code === "refuse") return "refuse";
        if (code === "envoi-coupe" || code === "indisponible" || code === "debit" || code === "acces") return "sans-reponse";
        return "a-verifier";
      }
    },
  };
}

/**
 * Câblage serveur : dépendances réelles, chargées à l'appel. Sans port donné, le retrait passe par le client du diffuseur (construit seulement
 * si un retrait est nécessaire, donc jamais réglages fermés ou sans post). `null` explicite : aucun retrait possible, rien ne change.
 */
export async function depsDeplacementServeur(diffuseur?: PortRetraitDiffuseur | null): Promise<DepsDeplacement> {
  const { depots, maintenant } = await import("@/services/_commun");
  const { appliquerLot } = await import("@/donnees/memoire");
  const { PREFIXE_ETATS_ENVOI_CALENDRIER: prefixe } = await import("@/services/branchement-envoi-calendrier");
  const z = await import("@/services/zernio");
  const d = depots();
  return {
    diffuseur: diffuseur === undefined ? portRetraitDepuisClient(() => z.clientZernio()) : diffuseur,
    niveau: async (id) => (await import("@/services/garde-creneau-diffuseur")).niveauDiffuseurDuCreneau(id),
    publicationsDeCles: (cles) => d.publications.lister((x) => typeof x.cleEnvoi === "string" && cles.includes(x.cleEnvoi)),
    // Les trois réglages ouverts, OU l'essai borné de CE créneau pour le déplacement (jamais un réglage simulé).
    reglagesOuverts: async (creneauId) =>
      ((await z.envoiZernioAutorise()) === true && (await z.envoiCalendrierAutorise()) === true && (await z.editorialeActive()) === true) ||
      (await (await import("@/services/essai-zernio")).essaiCouvre(creneauId, "deplacement")),
    creneau: async (id) => ((await d.creneauxEditoriaux.obtenir(id)) as CreneauPlan | null) ?? null,
    envois: (creneauId) => d.envoisPlanifies.lister((e) => e.creneauId === creneauId),
    envoiParCle: (cle) => d.envoisPlanifies.obtenir(cle),
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

export const deplacerProgrammationServeur = async (demande: DemandeDeplacement): Promise<ResultatDeplacement> => deplacerProgrammation(await depsDeplacementServeur(), demande);
export const modifierTexteProgrammeServeur = async (demande: DemandeTexte): Promise<ResultatDeplacement> => modifierTexteProgramme(await depsDeplacementServeur(), demande);
