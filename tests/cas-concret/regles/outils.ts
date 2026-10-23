/**
 * Outils des tests des règles de la fiche d'écrans (M1a, M1b) : une fiche de la vidéo 1 qui passe les règles, tirée du
 * texte de la vidéo de référence (`tests/cas-concret/temoin/reference/texte.txt`) et du cas du catalogue.
 * Ce n'est pas la fiche témoin (T1) : la liste « avant » y est déjà coupée pour tenir 5 s par écran (R05).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { VERSION_FICHE_ECRANS, idEcranAttendu, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { ContexteCasConcret, Manquement } from "@/moteurs/montage-cas-concret/regles";

/** Texte dit de la vidéo de référence, corps seul (jusqu'à la question). */
export const TEXTE_CORPS_VIDEO_1 = readFileSync(join(__dirname, "..", "temoin", "reference", "texte.txt"), "utf8").split("Écrivez")[0].trim();

type SansCommun<T> = T extends unknown ? Omit<T, "id" | "fond" | "marque" | "avanceMs" | "evenements"> & Partial<Pick<EcranCorps, "avanceMs" | "evenements">> : never;

const corps: SansCommun<EcranCorps>[] = [
  { type: "accroche", texteDit: "On recrute nos collaborateurs en quinze minutes.", etiquette: "cas réel", lignes: ["On recrute", "en 15 minutes"], motOrange: "15", evenements: [{ cible: "titre-2", surMot: 4, avanceMs: 0 }] },
  { type: "chiffre", texteDit: "Oui, quinze minutes.", avanceMs: 400, valeur: 15, unite: "minutes", faitId: "visio-quinze-minutes", pastilles: [], variante: "simple" },
  {
    type: "liste-avant",
    texteDit: "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer,",
    avanceMs: 200,
    taches: ["Trier les candidatures", "Répondre à chacun", "Relancer"],
    evenements: [
      { cible: "tache-1", surMot: 3, avanceMs: 0 },
      { cible: "tache-2", surMot: 6, avanceMs: 0 },
      { cible: "tache-3", surMot: 9, avanceMs: 0 },
    ],
  },
  {
    type: "liste-avant",
    texteDit: "caler un rendez-vous, envoyer le contrat, courir après la signature.",
    taches: ["Caler un rendez-vous", "Envoyer le contrat", "Courir après la signature"],
    evenements: [
      { cible: "tache-2", surMot: 3, avanceMs: 0 },
      { cible: "tache-3", surMot: 6, avanceMs: 0 },
    ],
  },
  { type: "chiffre", texteDit: "Plus d'une heure, pour chaque personne.", valeur: 1, unite: "heure", faitId: "plus-d-une-heure", pastilles: ["Par personne"], variante: "simple" },
  { type: "titre", texteDit: "Alors on a tout automatisé.", lignes: ["Tout automatisé"], orange: ["automatisé"] },
  { type: "etape", texteDit: "La personne voit notre annonce.", numero: 1, total: 6, titre: "L'annonce", ligne: "La personne voit notre annonce.", visuel: { sorte: "objet", objet: "telephone-capture" }, puces: [] },
  {
    type: "etape",
    texteDit: "Elle s'inscrit toute seule, en vingt secondes.",
    numero: 2,
    total: 6,
    titre: "L'inscription",
    ligne: "Elle s'inscrit toute seule.",
    visuel: { sorte: "ecran", etapeCas: 2, repli: "telephone-notification" },
    puces: ["20 secondes"],
    evenements: [{ cible: "puce-1", surMot: 4, avanceMs: 0 }],
  },
  { type: "etape", texteDit: "Elle reçoit ses e-mails toute seule.", numero: 3, total: 6, titre: "Les e-mails", ligne: "Elle reçoit ses e-mails.", visuel: { sorte: "objet", objet: "pile-notifications" }, puces: [] },
  { type: "etape", texteDit: "Elle choisit elle-même son rendez-vous.", numero: 4, total: 6, titre: "Le rendez-vous", ligne: "Elle choisit son créneau.", visuel: { sorte: "ecran", etapeCas: 4, repli: "calendrier" }, puces: [] },
  {
    type: "etape",
    texteDit: "Et si elle oublie, le rappel part tout seul.",
    numero: 5,
    total: 6,
    titre: "Le rappel",
    ligne: "Le rappel part tout seul.",
    visuel: { sorte: "objet", objet: "telephone-notification" },
    puces: [],
    evenements: [{ cible: "notification", surMot: 4, avanceMs: 0 }],
  },
  { type: "objet", texteDit: "Nous, on arrive pour la visio.", titre: "La visio", visuel: { sorte: "objet", objet: "chrono" } },
  {
    type: "chiffre",
    texteDit: "Quinze minutes. C'est notre seul travail.",
    avanceMs: 300,
    valeur: 15,
    unite: "minutes",
    faitId: "visio-quinze-minutes",
    pastilles: ["Notre seul travail"],
    variante: "compteur",
    evenements: [{ cible: "pastille-1", surMot: 2, avanceMs: 0 }],
  },
  {
    type: "etape",
    texteDit: "Derrière, le contrat part tout seul. Elle signe sur son téléphone.",
    numero: 6,
    total: 6,
    titre: "Le contrat",
    ligne: "Elle signe sur son téléphone.",
    visuel: { sorte: "objet", objet: "contrat-signature" },
    puces: [],
    evenements: [{ cible: "signature", surMot: 6, avanceMs: 0 }],
  },
  { type: "objet", texteDit: "Et le dossier est classé.", titre: "Dossier classé", visuel: { sorte: "objet", objet: "dossier-classe" } },
  {
    type: "preuve",
    texteDit: "Et tout est conforme au R.G.P.D. : cent pour cent automatique, sans aucune intervention manuelle.",
    titre: "Conforme au RGPD",
    puces: ["100 % automatique", "Sans intervention"],
    evenements: [
      { cible: "puce-1", surMot: 6, avanceMs: 0 },
      { cible: "puce-2", surMot: 10, avanceMs: 0 },
    ],
  },
  {
    type: "resultat",
    texteDit: "Résultat : des heures gagnées, à chaque recrutement.",
    titre: "Des heures gagnées",
    avant: { libelle: "Avant", valeur: 60 },
    maintenant: { libelle: "Maintenant", valeur: 15 },
    ligne: "À chaque recrutement.",
    evenements: [{ cible: "barre-maintenant", surMot: 2, avanceMs: 0 }],
  },
  {
    type: "question",
    texteDit: "Et dans votre entreprise, quelle tâche pourrait tourner toute seule ?",
    lignes: ["Et chez vous,", "dans votre entreprise"],
    question: "Quelle tâche pourrait tourner toute seule ?",
    evenements: [{ cible: "question", surMot: 5, avanceMs: 0 }],
  },
];

/** Fiche de la vidéo 1 (18 écrans, 6 étapes, fonds alternés), non calée. */
export function ficheVideo1(): FicheEcrans {
  return {
    version: VERSION_FICHE_ECRANS,
    formatId: "cas-concret",
    videoId: "video-1",
    versionId: "version-1",
    habillage: "charte-duo/1",
    ratio: "9:16",
    offre: "integration",
    origine: "porte-a",
    posture: "chez-nous",
    casId: "recrutement-apporteurs",
    empreinteCas: "cas-0123456789abcdef-1a",
    ecrans: corps.map(
      (e, i) =>
        ({
          avanceMs: 0,
          evenements: [],
          ...e,
          id: idEcranAttendu(i),
          fond: i % 2 === 0 ? "sombre" : "ivoire",
          marque: "axion-ia.com",
        }) as EcranCorps,
    ),
  };
}

export function contexteVideo1(sur: Partial<ContexteCasConcret> = {}): ContexteCasConcret {
  return { cas: structuredClone(recrutementApporteurs), texteScript: TEXTE_CORPS_VIDEO_1, ...sur };
}

/** Copie profonde d'une fiche, modifiée par `changer`. */
export function avec(fiche: FicheEcrans, changer: (f: FicheEcrans) => void): FicheEcrans {
  const copie = structuredClone(fiche);
  changer(copie);
  return copie;
}

/** Écran de rang `i` sous son type exact (pour modifier un champ propre au type dans un test). */
export function ecran<T extends EcranCorps["type"]>(f: FicheEcrans, i: number, type: T): Extract<EcranCorps, { type: T }> {
  const e = f.ecrans[i];
  if (e.type !== type) throw new Error(`écran ${e.id} de type ${e.type}, ${type} attendu`);
  return e as Extract<EcranCorps, { type: T }>;
}

/** Les détails, pour un message d'échec lisible. */
export const details = (m: readonly Manquement[]) => m.map((x) => `${x.ecranId ?? "fiche"} : ${x.detail}`).join("\n");
