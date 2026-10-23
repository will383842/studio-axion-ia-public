/**
 * DOCUMENT PROMIS (tâche P2-03, plan cas concret § 4-d) : ce que le public reçoit en message privé quand il écrit le mot.
 * PUR : `documentDuCas(cas)` ne lit que le cas. Chaque phrase vient d'un champ du cas (titre, étapes, reste humain, faits,
 * « avant »), d'une phrase fixe sans chiffre, ou du besoin générique d'un objet de la banque fermée. Aucun nombre ne
 * s'écrit sans fait. Ni prix ni nom d'outil : le document montre la structure, le diagnostic sert à la mettre en place.
 */
import { PAGE_DIAGNOSTIC } from "./index";
import type { CasConcret, ObjetCas } from "./cas";

/** Ce qu'il faut pour mettre en place une étape, selon l'objet qui la montre (phrases sans chiffre ni nom d'outil). */
const BESOIN_PAR_OBJET: Readonly<Record<ObjetCas, string>> = {
  "telephone-capture": "Une annonce et une page de présentation",
  "telephone-notification": "Des messages envoyés automatiquement, par e-mail ou par téléphone",
  "pile-notifications": "Des e-mails types et un outil d'envoi",
  chrono: "Un déclencheur lié à un délai",
  "contrat-signature": "Un modèle de document et un outil de signature électronique",
  "dossier-classe": "Un classement automatique des dossiers",
  "bouclier-coche": "Un contrôle automatique avant l'étape suivante",
  "champ-commentaire": "Un point d'entrée relié à votre fichier",
  "bulle-lien": "Un lien suivi",
  "liste-taches": "La liste des tâches à confier à l'automatisation",
  "barres-avant-apres": "Une mesure avant et après",
  calendrier: "Un agenda en ligne relié à votre calendrier",
  programme: "Un programme écrit à l'avance",
  rapport: "Un rapport rédigé automatiquement",
  "carte-taches": "Un tableau des tâches à suivre",
  "outils-relies": "Vos outils reliés entre eux",
  "e-mail": "Un e-mail type et un outil d'envoi",
};

export interface EtapeDocument {
  numero: number;
  titre: string;
  ligne: string;
  detail: string;
  /** Vrai : étape qui reste humaine. */
  humaine: boolean;
  /** Ce qu'il vous faut pour cette étape. */
  besoin: string;
}

export interface DocumentCasConcret {
  /** Code stable du document : `structure-<code du cas>`. */
  code: string;
  /** Nom du document promis (`documentPromis.nom`). */
  titre: string;
  sousTitre: string;
  introduction: string;
  principe: { avant: string[]; total?: string; apres: string };
  etapes: EtapeDocument[];
  /** Ce qu'il faut pour le mettre en place, sans doublon. */
  miseEnPlace: string[];
  resteHumain: string;
  /** Faits du cas qui peuvent se dire à un client (source code, site ou Will), tels qu'énoncés. */
  reperes: string[];
  limites: string[];
  appel: { titre: string; bouton: string; lien: string };
  signature: string;
}

export const TITRE_APPEL = "Faites votre diagnostic gratuit en quelques minutes";
export const BOUTON_APPEL = "Faire mon diagnostic";

/** États du document : le studio écrit le brouillon, Will le corrige puis le valide. Rien n'est jamais envoyé. */
export const ETATS_DOCUMENT = ["brouillon", "valide"] as const;
export type EtatDocument = (typeof ETATS_DOCUMENT)[number];

/** Code stable du document d'un cas. */
export const codeDocument = (cas: Pick<CasConcret, "id">): string => `structure-${cas.id}`;

/** `valide` seulement quand Will a posé une date de validation. */
export const etatDocument = (valideLe: string | undefined): EtatDocument => (valideLe ? "valide" : "brouillon");
export const SIGNATURE_DOCUMENT = "Axion-IA · axion-ia.com · partout en France";

export interface OptionsDocument {
  /** Identifiant de suivi de la vidéo ; sans effet sur le lien du document (voir `lienDuDocument`). */
  codeSuivi?: string;
}

/**
 * Lien du bouton : la page de diagnostic, SANS suivi. Portage phase 2 : #167 y posait `utm_source=document&utm_campaign=<code>`,
 * un lien écrit à la main avec l'ancien code « cc-<cas>-<id> » ; master n'a qu'un constructeur de liens suivis
 * (`construireLienSuivi`, un code de version par réseau, L2-07) et sa garde (T4) refuse tout autre. Un lien suivi propre au
 * document demande une décision de Will (nouvelle source de suivi) : en attendant, le lien est simple.
 */
export function lienDuDocument(): string {
  return PAGE_DIAGNOSTIC;
}

/** L'introduction suit l'offre : « automatisation » ne se dit que d'une intégration (nature automatisation). */
function introductionDe(cas: CasConcret): string {
  const debut = "Vous avez vu la vidéo.";
  if (cas.offre === "integration") {
    return cas.nature === "outils-relies"
      ? `${debut} Voici comment les outils sont reliés, étape par étape, et ce qu'il faut pour faire la même chose chez vous.`
      : `${debut} Voici comment l'automatisation est construite, étape par étape, et ce qu'il faut pour mettre la même chez vous.`;
  }
  if (cas.offre === "formation") return `${debut} Voici le déroulé, étape par étape, et ce qu'il faut pour le mettre en place chez vous.`;
  if (cas.offre === "audit") return `${debut} Voici comment l'audit se déroule, étape par étape, et ce qu'il faut pour le préparer chez vous.`;
  return `${debut} Voici comment l'accompagnement se déroule, étape par étape, et ce qu'il faut pour le mettre en place chez vous.`;
}

const SOURCES_DITES = new Set(["code", "site", "will"]);

export function documentDuCas(cas: CasConcret, _options: OptionsDocument = {}): DocumentCasConcret {
  void _options;
  const etapes: EtapeDocument[] = cas.etapes.map((e, i) => {
    const objet = e.visuel.sorte === "objet" ? e.visuel.objet : e.visuel.repli;
    return {
      numero: i + 1,
      titre: e.titre,
      ligne: e.ligne,
      detail: e.detail,
      humaine: e.humaine === true,
      // Un coaching n'installe pas d'automatisation : ses besoins ne viennent pas de la banque des objets.
      besoin: e.humaine ? "Vous. C'est une étape humaine" : objet && cas.offre !== "coaching" ? BESOIN_PAR_OBJET[objet] : "À définir ensemble",
    };
  });
  const limites = [
    "Ce document montre la structure, pas les réglages ni les outils : ils dépendent de votre entreprise.",
    "Chaque cas particulier (une personne qui ne répond pas, un refus, une erreur) se prévoit à part.",
    ...(cas.conformite?.rgpd ? ["Les données personnelles se traitent dès le départ : accord demandé, information de chaque personne, durée de conservation fixée à l'avance."] : []),
  ];
  return {
    code: codeDocument(cas),
    titre: cas.documentPromis.nom,
    sousTitre: cas.titre,
    introduction: introductionDe(cas),
    principe: { avant: [...cas.avant.taches], ...(cas.avant.total ? { total: cas.avant.total } : {}), apres: cas.resultat },
    etapes,
    miseEnPlace: [...new Set(etapes.filter((e) => !e.humaine).map((e) => e.besoin))],
    resteHumain: cas.resteHumain,
    reperes: cas.faits.filter((f) => SOURCES_DITES.has(f.source)).map((f) => f.enonce),
    limites,
    appel: { titre: TITRE_APPEL, bouton: BOUTON_APPEL, lien: lienDuDocument() },
    signature: SIGNATURE_DOCUMENT,
  };
}

/** La mention de la fiche vidéo : « à valider » tant que Will n'a pas validé le document, puis plus rien (PUR). */
export function mentionDocument(valideLe: string | undefined, documentAPreparer: boolean): string | null {
  if (!documentAPreparer || valideLe) return null;
  return "Document promis : à valider avant de publier.";
}

/** Le texte source du document, structuré (titres `#` et `##`, puis lignes) : ce que Will relit et corrige. PUR. */
export function texteSource(d: DocumentCasConcret): string {
  const sections: string[] = [`# ${d.titre}`, d.sousTitre, "", d.introduction, ""];
  const section = (titre: string, lignes: string[]) => {
    if (lignes.length === 0) return;
    sections.push(`## ${titre}`, ...lignes, "");
  };
  section("Le principe", [`Avant : ${d.principe.avant.join(", ")}.${d.principe.total ? ` ${d.principe.total}.` : ""}`, `Aujourd'hui : ${d.principe.apres}`]);
  section("Les étapes", d.etapes.flatMap((e) => [`${e.numero}. ${e.titre} · ${e.ligne}`, e.detail, `Ce qu'il vous faut : ${e.besoin}.`]));
  section("Ce qu'il faut pour le mettre en place", d.miseEnPlace.map((b) => `- ${b}`));
  section("Ce qui reste humain", [d.resteHumain]);
  section("Des repères", d.reperes.map((r) => `- ${r}`));
  section("Les limites", d.limites.map((l) => `- ${l}`));
  sections.push(`## ${d.appel.titre}`, d.appel.lien, "", d.signature);
  return sections.join("\n");
}
