/**
 * L8-11b : création d'une nouvelle version d'un contenu déjà publié, déposée au calendrier comme PROPOSITION « à valider ».
 * Rien n'est envoyé ni programmé ici : le créneau naît sans validation, seul le geste du fondateur peut la donner plus tard.
 * Aucun import d'envoi, de fournisseur ni de réglage ; aucun appel à un modèle ; aucune action serveur (L8-12b appellera ce service).
 * Contrôle, création et passage à « à valider » se font sous UN seul verrou. Les contrôles purs viennent de L8-11a (importés, jamais recopiés).
 */
import "server-only";
import { compteCibleValide } from "@/app/(studio)/calendrier/compte-cible";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import {
  PREFIXE_REPUBLICATION,
  idNouvelleVersion,
  rangSuivant,
  verifierPlacement,
  verifierTexte,
  type ExistantPlacement,
} from "@/domaine/republication/nouvelle-version";
import { sourceSure, type Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { resoudreHeureParis } from "@/lib/horloge-paris";
import { depots, maintenant as maintenantParDefaut, sousVerrou } from "./_commun";
import { changerStatut, creerCreneau, type CreneauPlan, type DepotsPlan } from "./plan-editorial";

export interface DepsRepublication {
  plan: DepotsPlan;
  publications: {
    obtenir(id: string): Promise<Publication | null>;
    lister(filtre?: (p: Publication) => boolean): Promise<Publication[]>;
  };
  /** Verrou d'exécution ; par défaut le verrou global du Studio. */
  verrou?: <T>(f: () => Promise<T>) => Promise<T>;
  /** Instant courant (ISO), fourni par l'appelant. */
  maintenant: () => string;
}

export interface DemandeNouvelleVersion {
  publicationId: string;
  /** AAAA-MM-JJ, jour de Paris. */
  jour: string;
  /** HH:MM, heure de Paris. */
  heure: string;
  /** Texte écrit par le fondateur. */
  texte: string;
  /** Compte de publication, fourni par l'écran, jamais deviné. */
  compteCible: string;
}

export type ResultatNouvelleVersion = { ok: true; creneau: CreneauPlan; deja: boolean } | { ok: false; motifs: string[] };

export function depsParDefaut(): DepsRepublication {
  const d = depots();
  return {
    plan: { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] },
    publications: d.publications,
    verrou: sousVerrou,
    maintenant: maintenantParDefaut,
  };
}

const refus = (...motifs: string[]): ResultatNouvelleVersion => ({ ok: false, motifs });

/** Vrai si l'identifiant est celui d'une nouvelle version de cette publication (rang numérique après le préfixe). */
function estDeCePublication(id: string, publicationId: string): boolean {
  const prefixe = `${PREFIXE_REPUBLICATION}${publicationId}-`;
  return id.startsWith(prefixe) && /^\d+$/.test(id.slice(prefixe.length));
}

/** Jour et heure de Paris d'un instant ; un instant illisible donne un jour vide (le contrôle le refuse). */
function enParis(instant: string): { jour: string; heure: string } {
  try {
    return { jour: cleJour(instant), heure: heureAffichageParis(instant) };
  } catch {
    return { jour: "", heure: "" };
  }
}

export async function creerNouvelleVersion(deps: DepsRepublication = depsParDefaut(), demande: DemandeNouvelleVersion): Promise<ResultatNouvelleVersion> {
  const verrou = deps.verrou ?? (<T,>(f: () => Promise<T>) => f());
  return verrou(() => creerSousVerrou(deps, demande));
}

async function creerSousVerrou(deps: DepsRepublication, demande: DemandeNouvelleVersion): Promise<ResultatNouvelleVersion> {
  if (!compteCibleValide(demande.compteCible)) return refus("Compte de publication inconnu : ajoutez cette entrée à la main depuis le calendrier.");

  const original = await deps.publications.obtenir(demande.publicationId);
  if (!original) return refus("Le contenu d'origine est introuvable.");
  if (original.statut !== "publiee") return refus("Le contenu d'origine n'est pas publié : seule une publication déjà publiée peut avoir une nouvelle version.");
  if (original.via === "simulation") return refus("Le contenu d'origine est une simulation : seule une publication réelle peut avoir une nouvelle version.");
  const source = sourceSure(original);
  if (!source) return refus("Le média du contenu d'origine n'est pas lisible : la nouvelle version ne peut pas être créée.");
  const reseau = original.reseau;
  const media = source.famille === "video" ? source.videoId : source.visuelId;

  const creneaux = await deps.plan.creneaux.lister();
  const rang = rangSuivant(demande.publicationId, creneaux.map((c) => c.id));

  // Idempotence : une nouvelle version non archivée de cette publication existe déjà : rendue telle quelle.
  const ouverte = creneaux.find((c) => estDeCePublication(c.id, demande.publicationId) && c.statut !== "archive");
  if (ouverte) {
    // Reprise d'une création interrompue entre l'ajout et le passage à « à valider » : on termine, sans seconde entrée.
    if (ouverte.statut === "propose") return { ok: true, creneau: await changerStatut(deps.plan, ouverte.id, "a_valider", "studio", deps.maintenant()), deja: true };
    return { ok: true, creneau: ouverte, deja: true };
  }

  const maintenant = Date.parse(deps.maintenant());
  const motifs: string[] = [];
  const texte = verifierTexte({ reseau, texte: demande.texte, texteOrigine: original.texte });
  if (!texte.ok) motifs.push(...texte.motifs);

  // Ce qui occupe déjà la place sur ce réseau : créneaux du plan et publications, en heure de Paris.
  const existants: ExistantPlacement[] = [];
  for (const c of creneaux) {
    const instant = c.heuresParReseau[reseau];
    if (instant) existants.push({ id: c.id, reseau, ...enParis(instant), statut: c.statut });
  }
  for (const p of await deps.publications.lister((x) => x.reseau === reseau && x.statut !== "brouillon")) {
    existants.push({ id: p.id, reseau, ...enParis(p.date), statut: p.statut, simulee: p.via === "simulation" });
  }
  const placement = verifierPlacement({
    reseau,
    jour: demande.jour,
    heure: demande.heure,
    maintenant,
    publicationId: demande.publicationId,
    mediaOrigine: media,
    mediaNouveau: media,
    datePublicationOrigine: Date.parse(original.date),
    rang,
    existants,
  });
  if (!placement.ok) motifs.push(...placement.motifs);
  // Une heure qui n'existe pas à Paris (changement d'heure) est refusée, jamais décalée en silence.
  else if (resoudreHeureParis(demande.jour, demande.heure).avertissement) motifs.push("Cette heure n'existe pas à Paris le jour du changement d'heure : choisissez une autre heure.");
  if (motifs.length > 0) return refus(...new Set(motifs));

  const id = idNouvelleVersion(demande.publicationId, rang);
  try {
    await creerCreneau(deps.plan, {
      id,
      jourVise: demande.jour,
      heuresParReseau: { [reseau]: resoudreHeureParis(demande.jour, demande.heure).instant },
      compteCible: demande.compteCible,
      ...(source.famille === "video" ? { videoId: media } : { visuelId: media }),
      textes: { [reseau]: { texte: demande.texte, premierCommentaire: "" } },
      origine: "vous",
    }, deps.maintenant());
    const creneau = await changerStatut(deps.plan, id, "a_valider", "studio", deps.maintenant());
    return { ok: true, creneau, deja: false };
  } catch {
    return refus("La nouvelle version n'a pas pu être ajoutée au calendrier : réessayez dans un instant.");
  }
}
