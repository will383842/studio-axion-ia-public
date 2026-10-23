/**
 * REGISTRE DU BANC DE FIN DE LOT G4 (plan v5 B.7.7 ; ordres de Will du 03/10). Tout ce qui est ici est marqué TEST.
 *
 * Trois sujets, dans le domaine d'Axion-IA (§2 quater), enchaînés dans UNE série (diversité, §2 sexies) :
 *  1. « 35 h » TRANSPOSÉ (banc 06) : le client des 35 heures est une IDÉE, pas un vrai client (correction de Will du
 *     03/10) → matières « observation » hypothétiques, AUCUNE preuve « cas client » : 35 h → 0 h, « moins d'un mois »,
 *     « remboursé en quelques semaines », « 100 % » ne peuvent PAS être affirmés comme des résultats obtenus.
 *  2. « sujet-excel-de-will » : le sujet de Will (« tous les nombreux fichiers Excel qu'une entreprise doit gérer, et qui
 *     peuvent presque tous être remplacés par l'IA »), ses mots tirés de `script-35h-excel.html` (même scénario : une
 *     idée, pas un client) et sa phrase « remplacé à 99 % par une IA » : AUCUNE preuve de ce 99 % → le générateur doit
 *     le refuser comme chiffre et écrire une formulation prouvable.
 *  3. Format « type avocat » sur un cas client FICTIF (registre fictif des fixtures, accord écrit) : seul sujet où le
 *     récit « venu nous voir → nous avons → résultat » (§2 ter) est permis.
 */
import type { ContexteAxion, Matiere, Preuve, ReseauDeclinaison } from "@/domaine/types";
import { PREUVES_FICTIVES } from "../preuves-fictives";

export const MAINTENANT_BANC = "2026-10-03T08:00:00.000Z";
const LE = "2026-10-01T08:00:00.000Z";
const base = { saisiePar: "will" as const, statut: "validee" as const, creeLe: LE, modifieLe: LE, source: { origine: "dictee" as const, detail: "TEST · banc G4", date: LE } };

function m(id: string, type: Matiere["type"], texte: string, pilier: string, motsCles: string[], extra: Partial<Matiere> = {}): Matiere {
  return { ...base, id, type, texte, pilier, motsCles, ...extra };
}

export interface SujetBanc {
  code: string;
  titre: string;
  idee: string;
  phraseWill?: string;
  pilier: { id: string; nom: string };
  reseaux: ReseauDeclinaison[];
  matieres: Matiere[];
  preuves: Preuve[];
  /** Ce que le banc doit montrer sur ce sujet. */
  attendus: string[];
}

export const SUJETS_BANC: SujetBanc[] = [
  {
    code: "35h-transpose",
    titre: "« 35 h dans des tableurs » transposé (banc 06), scénario hypothétique",
    idee: "Une personne qui passe ses semaines à recopier des données dans des tableurs, et ce que ça coûte vraiment",
    pilier: { id: "automatiser-donnees-pilotage", nom: "Automatiser : données et pilotage" },
    reseaux: ["tiktok", "instagram", "linkedin"],
    matieres: [
      m("test-35h-obs", "observation", "Scénario type, pas un client réel : dans une PME, une personne passe l'équivalent d'un temps plein, 35 heures par semaine, à exporter, copier, coller et vérifier des données dans des dizaines de tableurs.", "automatiser-donnees-pilotage", ["tableur", "excel", "données", "recopier"]),
      m("test-35h-obs2", "observation", "Une seule erreur de formule dans un tableur, et tous les chiffres qui en dépendent sont faux.", "automatiser-donnees-pilotage", ["formule", "tableur", "excel", "erreur"]),
      m("test-35h-idee", "idee-recue", "Excel, ça paraît gratuit.", "automatiser-donnees-pilotage", ["excel", "gratuit", "tableur"], { croyanceAttribuee: true }),
      m("test-35h-limite", "limite", "Si vos tableaux changent de forme chaque mois, gardez le tableur.", "automatiser-donnees-pilotage", ["tableur", "excel"]),
      m("test-35h-cause", "observation", "Un tableur ne vérifie rien tout seul, donc chaque copier-coller est une occasion d'erreur que personne ne voit.", "automatiser-donnees-pilotage", ["tableur", "excel", "erreur", "copier"]),
      m("test-35h-question", "question-recue", "Est-ce qu'on peut se passer de nos Excel sans tout casser ?", "automatiser-donnees-pilotage", ["excel", "tableur"]),
    ],
    preuves: [],
    attendus: ["aucun « venu nous voir » ni résultat obtenu (pas de preuve cas client) : C83", "35 h jamais dit comme un fait chiffré (chiffre non prouvé) : C1", "cadrage hypothétique honnête"],
  },
  {
    code: "sujet-excel-de-will",
    titre: "Le sujet de Will : les fichiers Excel presque tous remplaçables",
    idee: "Tous les nombreux fichiers Excel qu'une entreprise doit gérer, et qui peuvent presque tous être remplacés par l'IA",
    phraseWill: "Presque tous ces fichiers Excel peuvent être remplacés à 99 % par une IA.",
    pilier: { id: "automatiser-donnees-pilotage", nom: "Automatiser : données et pilotage" },
    reseaux: ["linkedin", "tiktok"],
    matieres: [
      m("will-excel-routine", "observation", "Des dizaines de fichiers Excel. Chaque jour, la même routine : exporter, copier, coller, vérifier… et recommencer.", "automatiser-donnees-pilotage", ["excel", "fichiers", "routine"]),
      m("will-excel-formule", "observation", "Une seule erreur de formule, et tous les chiffres sont faux.", "automatiser-donnees-pilotage", ["excel", "formule", "chiffres"]),
      m("will-excel-partie", "observation", "Malgré tout ce travail, le dirigeant ne voit qu'une petite partie de ses données.", "automatiser-donnees-pilotage", ["données", "tableau de bord", "excel"]),
      m("will-excel-cause", "observation", "Personne n'a le temps de tout relire, donc une erreur de formule passe et fausse les chiffres du mois.", "automatiser-donnees-pilotage", ["excel", "formule", "erreur"], { source: { origine: "dictee", detail: "TEST · banc G4 (reformulation de travail, à confirmer par Will)", date: LE } }),
      m("will-excel-avis", "avis-will", "Presque tous ces fichiers Excel peuvent être remplacés à 99 % par une IA.", "automatiser-donnees-pilotage", ["excel", "ia", "fichiers"]),
      m("will-excel-solution", "avis-will", "À la place des fichiers : un tableau de bord, des données qui arrivent toutes seules, vérifiées toutes seules, et une alerte au moindre problème.", "automatiser-donnees-pilotage", ["tableau de bord", "excel", "alerte"]),
    ],
    preuves: [],
    attendus: ["« 99 % » refusé comme chiffre (aucune preuve) : formulation prouvable « presque tous »", "aucun faux client (C83)", "problème douloureux : la routine, coût avant 5 s, issue donnée"],
  },
  {
    code: "avocat-cas-fictif-factures",
    titre: "Type avocat, cas client FICTIF (factures ressaisies), récit permis",
    idee: "La saisie des factures à la main, et ce qu'elle coûte à une PME",
    pilier: { id: "automatiser-administratif", nom: "Automatiser : administratif et back-office" },
    reseaux: ["instagram", "facebook"],
    matieres: [
      m("mat-fictive-3", "cas-client", "Ils ont arrêté de ressaisir leurs factures.", "automatiser-administratif", ["factures", "saisie", "ressaisie"], { preuveId: "prv-fictive-1", accord: { requis: true, obtenu: true, forme: "ecrit" }, nomsSensibles: ["Société Fictive Alpha"] }),
      m("test-factures-limite", "limite", "Si vos factures arrivent encore sur papier, il faut d'abord les numériser.", "automatiser-administratif", ["factures", "papier", "saisie"]),
      m("test-factures-cause", "observation", "Une facture ressaisie à la main, c'est une faute de frappe possible à chaque ligne, donc des relances et des litiges.", "automatiser-administratif", ["factures", "saisie", "erreur"]),
      m("test-factures-question", "question-recue", "On saisit encore toutes nos factures fournisseurs à la main, c'est normal ?", "automatiser-administratif", ["factures", "saisie"], { source: { origine: "rendez-vous", detail: "TEST · banc G4", date: LE } }),
    ],
    preuves: PREUVES_FICTIVES.filter((p) => p.id === "prv-fictive-1").map((p) => ({ ...p, pilier: "automatiser-administratif", motsCles: ["factures", "saisie", "ressaisie"] })),
    attendus: ["récit « venu nous voir → nous avons → résultat » (C81)", "client situé : une PME de négoce (C82)", "lieu et nom jamais écrits (C59)"],
  },
];

/** Contexte de marque du banc : les interdits réels de Will (migration G1a), rien de validé en plus. */
export const CONTEXTE_BANC: Pick<ContexteAxion, "positionIds" | "piliers" | "interdits" | "promessesInterdites" | "jargonInterdit" | "rolesDestinataires" | "carnetVoix" | "termesVagues"> = {
  positionIds: [],
  piliers: [],
  interdits: [
    { id: "interdit-reservation-directe", texte: "Jamais de réservation ni d'achat direct en ligne : toute demande passe par un appel ou un message.", regex: "\\b(r[ée]servez|achetez|payez)\\b.{0,30}\\b(en ligne|directement)\\b", origine: "Ordre de Will du 26/08/2026" },
    { id: "interdit-telephone-public", texte: "Aucun numéro de téléphone public.", regex: "(\\+33\\s?|\\b0)[1-9]([ .-]?\\d{2}){4}\\b", origine: "Ordre de Will du 23/09/2026" },
    { id: "interdit-demarre", texte: "Ne jamais dire qu'Axion-IA démarre ni parler de son âge.", regex: "\\bje d[ée]marre\\b|\\bjeune (entreprise|bo[iî]te|soci[ée]t[ée])\\b|\\bdepuis des ann[ée]es\\b|\\bnos centaines de clients\\b", origine: "Ordre de Will du 21/09/2026" },
    { id: "interdit-certifexemple", texte: "La certification Certifexemple n'est pas revendiquée.", regex: "\\bcertifexemple\\b", origine: "Ordre de Will (30/09/2026)" },
    { id: "interdit-trop-s-engager", texte: "Ne pas trop s'engager : pas de fréquence promise ni de conditions détaillées.", regex: "\\bje r[ée]ponds [àa] chacun\\b|\\bpoint chaque semaine\\b", origine: "Ordre de Will du 01/10/2026" },
  ],
  promessesInterdites: ["garanti", "à coup sûr", "100 %"],
  jargonInterdit: [],
  rolesDestinataires: ["dirigeant", "DAF", "associé", "DRH", "responsable commercial", "responsable informatique", "expert-comptable"],
  carnetVoix: [],
  termesVagues: ["outil adapté", "les bonnes pratiques", "un bon process"],
};
