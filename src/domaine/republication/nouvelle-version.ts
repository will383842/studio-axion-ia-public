/**
 * L8-11a : nouvelle version d'un contenu déjà publié. Contrôles PURS de placement et de texte.
 * Aucune base, aucun réseau, aucune horloge système (`maintenant` est passé en paramètre), aucun réglage lu, aucun modèle,
 * aucun envoi ni programmation. Branché nulle part : L8-11b l'appellera.
 * Les règles existantes sont IMPORTÉES (cadence L3-15, délais L8-08, non-copie L8-10, charte L3-05), jamais recopiées.
 * Toute valeur de réglage ci-dessous est une PROPOSITION (statut « hypothese »).
 */
import { evaluerRepublication, regleRepublication } from "./regles";
import { controlerNonCopie } from "./non-copie";
import { controlerCharte } from "@/domaine/ecriture-post/controle-charte";
import { reglesDuReseau, verifierEspacement, type PostPlanifie } from "@/domaine/cadence/verifier";
import { cleJour } from "@/lib/dates";
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";
import type { IdReseau } from "@/domaine/types";

/** PROPOSITION : nombre maximal de nouvelles versions d'un même contenu. */
export const REPUBLICATIONS_MAX_PAR_CONTENU = { statut: "hypothese", valeur: 2 } as const;
/** Préfixe de l'identifiant d'une nouvelle version : le lien avec l'original est porté par l'identifiant. */
export const PREFIXE_REPUBLICATION = "republication-";

const CLE_REPUBLICATION = "republication:";

export function idNouvelleVersion(publicationId: string, rang: number): string {
  return `${PREFIXE_REPUBLICATION}${publicationId}-${rang}`;
}

/** Vrai si l'identifiant est celui d'une nouvelle version de cette publication (rang numérique après le préfixe). */
function estDeCeContenu(id: string, publicationId: string): boolean {
  const prefixe = `${PREFIXE_REPUBLICATION}${publicationId}-`;
  return id.startsWith(prefixe) && /^\d+$/.test(id.slice(prefixe.length));
}

/** Rang de la prochaine nouvelle version : celles déjà créées (archivées comprises) + 1. */
export function rangSuivant(publicationId: string, idsExistants: readonly string[]): number {
  return idsExistants.filter((id) => estDeCeContenu(id, publicationId)).length + 1;
}

export interface ExistantPlacement {
  id: string;
  reseau: string;
  /** AAAA-MM-JJ, heure de Paris. */
  jour: string;
  /** HH:MM, heure de Paris. */
  heure: string;
  statut: string;
  simulee?: boolean;
}

export interface EntreePlacement {
  reseau: IdReseau;
  jour: string;
  heure: string;
  /** Instant courant (ms), fourni par l'appelant. */
  maintenant: number;
  publicationId: string;
  mediaOrigine: string;
  mediaNouveau: string;
  /** Date de la publication d'origine (ms). */
  datePublicationOrigine: number;
  /** Rang de la nouvelle version (1 = première). */
  rang: number;
  existants: readonly ExistantPlacement[];
}

export type ResultatControle = { ok: true } | { ok: false; motifs: string[] };

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

function jourValide(jour: string): boolean {
  return FORMAT_JOUR.test(jour) && ajouterJoursParis(jour, 0) === jour;
}

const MOTIF_JOUR_OCCUPE = "Ce jour est déjà occupé sur ce réseau : choisissez un autre jour.";

const MOTIFS_DELAI: Record<string, string> = {
  "contenu-identique": "Ce réseau refuse le même média que l'original : choisissez un média différent.",
  filigrane: "Le contenu proposé porte un filigrane : il ne peut pas être republié sur ce réseau.",
  "delai-trop-court": "Le délai depuis la publication d'origine est trop court pour une nouvelle version sur ce réseau.",
  "reseau-inconnu": "Ce réseau n'est pas géré pour les nouvelles versions.",
  "date-invalide": "Une date nécessaire au contrôle n'est pas lisible : la nouvelle version ne peut pas être placée.",
};

export function verifierPlacement(e: EntreePlacement): ResultatControle {
  const motifs: string[] = [];
  let reseauConnu = true;
  try {
    regleRepublication(e.reseau);
  } catch {
    reseauConnu = false;
  }
  if (!reseauConnu) return { ok: false, motifs: [MOTIFS_DELAI["reseau-inconnu"]] };

  // Rang
  if (!Number.isInteger(e.rang) || e.rang < 1) motifs.push("Le rang de cette nouvelle version n'est pas valide.");
  else if (e.rang > REPUBLICATIONS_MAX_PAR_CONTENU.valeur) {
    motifs.push(`Ce contenu a déjà atteint le maximum de ${REPUBLICATIONS_MAX_PAR_CONTENU.valeur} nouvelles versions.`);
  }

  // Délai, contenu identique (TikTok : même média = identique)
  const verdict = evaluerRepublication({
    reseau: e.reseau,
    datePublication: e.datePublicationOrigine,
    maintenant: e.maintenant,
    identique: e.reseau === "tiktok" && e.mediaNouveau === e.mediaOrigine,
    filigrane: false,
  });
  for (const m of verdict.motifs) {
    motifs.push(MOTIFS_DELAI[m] ?? "La republication est refusée par les règles du réseau.");
  }

  // Jour et heure
  if (!Number.isFinite(e.maintenant)) return { ok: false, motifs: [MOTIFS_DELAI["date-invalide"]] };
  if (!jourValide(e.jour) || !FORMAT_HEURE.test(e.heure)) {
    motifs.push("Le jour ou l'heure n'est pas lisible : indiquez un jour AAAA-MM-JJ et une heure HH:MM.");
    return { ok: false, motifs };
  }
  if (e.jour < cleJour(new Date(e.maintenant))) motifs.push("Ce jour est déjà passé : choisissez un jour à venir.");
  else if (Date.parse(instantParis(e.jour, e.heure)) <= e.maintenant) motifs.push("Cette heure est déjà passée : choisissez une heure à venir.");

  // Existants qui comptent : même réseau, ni archivés ni en échec, publications simulées exclues.
  const actifs = e.existants.filter((x) => x.reseau === e.reseau && x.statut !== "archive" && x.statut !== "echec" && x.simulee !== true);
  const regles = reglesDuReseau(e.reseau);
  const debut = ajouterJoursParis(e.jour, -regles.repetitionJours);
  const fin = ajouterJoursParis(e.jour, regles.repetitionJours);
  // Un jour illisible refuse toujours ; une heure illisible refuse seulement dans la fenêtre d'espacement.
  if (actifs.some((x) => !jourValide(x.jour) || (x.jour >= debut && x.jour <= fin && !FORMAT_HEURE.test(x.heure)))) {
    motifs.push("Une entrée de ce réseau a un jour ou une heure illisible : corrigez-la avant de placer cette nouvelle version.");
    return { ok: false, motifs };
  }
  if (actifs.some((x) => x.jour === e.jour)) motifs.push(MOTIF_JOUR_OCCUPE);
  if (e.existants.some((x) => x.id === idNouvelleVersion(e.publicationId, e.rang))) motifs.push("Cette nouvelle version existe déjà : le rang doit être recalculé.");

  // Règles d'espacement L3-15, lues telles quelles.
  const cle = `${CLE_REPUBLICATION}${e.publicationId}`;
  const idNouveau = idNouvelleVersion(e.publicationId, e.rang);
  const nouvelle: PostPlanifie = { id: idNouveau, reseau: e.reseau, jour: e.jour, heure: e.heure, pilier: cle, cible: cle };
  const voisins: PostPlanifie[] = actifs
    .filter((x) => x.jour >= debut && x.jour <= fin)
    .map((x) => {
      const pilier = estDeCeContenu(x.id, e.publicationId) ? cle : x.id;
      return { id: x.id, reseau: x.reseau, jour: x.jour, heure: x.heure, pilier, cible: pilier };
    });
  const constats = verifierEspacement([nouvelle, ...voisins], regles).filter((c) => c.posts.includes(idNouveau));
  const dejaDit = new Set(motifs);
  for (const c of constats) {
    const phrase = {
      ecart: `L'écart avec une autre publication de ce réseau est inférieur à ${regles.ecartMinH} h : choisissez une autre heure.`,
      repetition: `Une autre version du même contenu est prévue à moins de ${regles.repetitionJours} jours : espacez-les davantage.`,
      quota: MOTIF_JOUR_OCCUPE,
      weekend: "Ce réseau ne publie pas le week-end : choisissez un jour de semaine.",
    }[c.code];
    if (!dejaDit.has(phrase)) {
      dejaDit.add(phrase);
      motifs.push(phrase);
    }
  }

  return motifs.length === 0 ? { ok: true } : { ok: false, motifs };
}

export interface EntreeTexte {
  reseau: IdReseau;
  texte: string;
  texteOrigine: string;
}

/** Verdict du texte : `motifs` est vide quand `ok` est vrai. */
export interface ResultatTexte {
  ok: boolean;
  motifs: string[];
}

export function verifierTexte(e: EntreeTexte): ResultatTexte {
  try {
    regleRepublication(e.reseau);
  } catch {
    return { ok: false, motifs: [MOTIFS_DELAI["reseau-inconnu"]] };
  }
  if (e.texte.trim() === "") return { ok: false, motifs: ["Votre texte est vide : écrivez la nouvelle version."] };

  const motifs: string[] = [];
  const copie = controlerNonCopie(e.texte, [e.texteOrigine]);
  if (!copie.ok) {
    if (copie.motif === "identique") motifs.push("Votre texte est identique à l'original : écrivez une version neuve.");
    else if (copie.motif === "reprise") motifs.push("Votre texte reprend plusieurs mots d'affilée de l'original : reformulez-le, ou mettez ce passage entre guillemets.");
    else motifs.push("Votre texte est trop proche de l'original : reformulez-le davantage.");
  }
  const charte = controlerCharte(e.texte, "genere");
  if (charte.verdict === "rejete") {
    for (const m of charte.motifs) {
      motifs.push(m.startsWith("Interdit : ") ? `Votre texte contient un terme interdit par la charte : ${m.slice("Interdit : ".length)}` : m.replace(/^Le texte /, "Votre texte "));
    }
  }
  return motifs.length === 0 ? { ok: true, motifs } : { ok: false, motifs };
}
