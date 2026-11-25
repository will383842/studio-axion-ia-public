/**
 * Propriétés PAR DÉFAUT de `VideoLongue` : le story-board d'essai (≈ 2 min, `SCRIPT_ESSAI` de `scripts/essai-video-longue.ts`,
 * question « Comment suivre ses stocks sans y passer des heures ? »), écrit à la main d'après le contrat. Les vraies propriétés
 * arrivent par la demande de rendu. Sert à la planche d'images et aux tests.
 */
import {
  FORMAT_LONGUE,
  LIBELLE_APPEL_LONGUE,
  VERSION_STORYBOARD,
  type ChiffreCle,
  type ElementApparition,
  type FondScene,
  type FormeLongue,
  type LigneSousTitre,
  type ProprietesVideoLongue,
  type SceneLongue,
  type TransitionLongue,
} from "../../../../src/moteurs/montage-video-longue/storyboard-types";

const QUESTION = "Comment suivre ses stocks sans y passer des heures ?";
const base = (id: string, chapitreId: string, debutMs: number, finMs: number, entree: TransitionLongue, fond: FondScene = "ivoire") => ({ id, chapitreId, debutMs, finMs, entree, fond });
const el = (texte: string, apparitionMs: number, accent: string | null = null): ElementApparition => ({ texte, apparitionMs, accent });
const nb = (valeur: number, ecrit: string, affiche: string, unite: string, apparitionMs: number): ChiffreCle => ({ valeur, ecrit, affiche, unite, apparitionMs });
const cle = (id: string, ch: string, a: number, b: number, entree: TransitionLongue, phrase: string, motCle: string | null, forme: FormeLongue): SceneLongue => ({ ...base(id, ch, a, b, entree), type: "phrase-cle", phrase, motCle, forme });

const scenes: SceneLongue[] = [
  { ...base("s01", "c1", 0, 3000, "aucune"), type: "carton-titre", question: QUESTION },
  { ...base("s02", "c1", 3000, 5500, "fondu", "noir"), type: "carton-chapitre", rang: 1, total: 4, titre: "Le problème : compter à la main" },
  cle("s03", "c1", 5500, 12000, "volet", "Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main", "tableur", "graphique"),
  { ...base("s04", "c1", 12000, 19000, "glisse"), type: "chiffre", chiffres: [nb(1, "une", "1", "journée entière", 13000)], contexte: "quelqu'un passe une journée entière à compter les étagères" },
  cle("s05", "c1", 19000, 25500, "fondu", "Une rupture se découvre quand un client appelle", "rupture", "alerte"),
  cle("s06", "c1", 25500, 29000, "glisse", "Les chiffres sont faux dès le lendemain", "faux", "horloge"),
  cle("s07", "c1", 29000, 32000, "fondu", "Et personne ne sait vraiment ce qui dort au fond de l'entrepôt", "personne", "cercle"),
  { ...base("s08", "c2", 32000, 34500, "volet", "noir"), type: "carton-chapitre", rang: 2, total: 4, titre: "La solution : un tableau de bord qui se met à jour seul" },
  cle("s09", "c2", 34500, 41500, "fondu", "lit chaque vente et chaque livraison au moment où elles arrivent", "chaque vente", "fleche"),
  { ...base("s10", "c2", 41500, 50500, "glisse"), type: "liste", titre: "En haut, trois chiffres", elements: [el("la valeur du stock", 42800, "stock"), el("les articles bientôt épuisés", 45000, "épuisés"), el("les commandes en attente", 47400, "attente")], compte: 3 },
  { ...base("s11", "c2", 50500, 56500, "fondu"), type: "chiffre", chiffres: [nb(12, "douze", "12", "mois", 51500)], contexte: "Un clic sur un article montre son historique" },
  { ...base("s12", "c2", 56500, 66000, "volet"), type: "avant-apres", avant: "compter à la main", apres: "le stock est juste à chaque instant", apparitionApresMs: 61000 },
  { ...base("s13", "c3", 66000, 68500, "volet", "noir"), type: "carton-chapitre", rang: 3, total: 4, titre: "Les alertes : savoir avant de manquer" },
  cle("s14", "c3", 68500, 74500, "fondu", "Pour chaque article, vous fixez un seuil minimum", "seuil minimum", "cible"),
  { ...base("s15", "c3", 74500, 84000, "glisse"), type: "etapes", numeroDepart: 1, elements: [el("Le stock passe sous ce seuil", 75500, "seuil"), el("Un message part automatiquement", 78500, "automatiquement"), el("Il arrive à la bonne personne", 81500, "bonne personne")] },
  cle("s16", "c3", 84000, 90000, "fondu", "Chaque lundi matin, un résumé de la semaine arrive dans votre boîte", "lundi matin", "calendrier"),
  cle("s17", "c3", 90000, 94000, "glisse", "Vous savez avant de manquer, et plus jamais par un client mécontent", "avant de manquer", "coche"),
  { ...base("s18", "c4", 94000, 96500, "volet", "noir"), type: "carton-chapitre", rang: 4, total: 4, titre: "Par où commencer" },
  { ...base("s19", "c4", 96500, 102500, "fondu"), type: "chiffre", chiffres: [nb(20, "vingt", "20", "articles", 97500), nb(2, "deux", "2", "semaines", 99800)], contexte: "Commencez petit : les vingt articles qui se vendent le plus, deux semaines" },
  { ...base("s20", "c4", 102500, 110500, "glisse"), type: "etapes", numeroDepart: 1, elements: [el("Choisissez les vingt articles qui se vendent le plus", 103500, "vingt articles"), el("Reliez le tableau de bord à votre outil de vente", 105800, "outil de vente"), el("Vérifiez pendant deux semaines que les chiffres sont justes", 108000, "deux semaines")] },
  { ...base("s21", "c4", 110500, 115000, "fondu"), type: "etapes", numeroDepart: 4, elements: [el("Ajoutez ensuite le reste du catalogue", 111500, "catalogue"), el("famille par famille", 113500, "famille")] },
  { ...base("s22", "c4", 115000, 120000, "fondu", "noir"), type: "fin", question: QUESTION, appel: LIBELLE_APPEL_LONGUE, adresse: "axion-ia.com" },
];

const ligne = (debutMs: number, finMs: number, texte: string): LigneSousTitre => ({ debutMs, finMs, texte });

export const PROPRIETES_EXEMPLE_LONGUE: ProprietesVideoLongue = {
  storyboard: {
    version: VERSION_STORYBOARD,
    format: FORMAT_LONGUE,
    dureeMs: 120_000,
    question: QUESTION,
    chapitres: [
      { id: "c1", rang: 1, titre: "Le problème : compter à la main", debutMs: 0, finMs: 32000 },
      { id: "c2", rang: 2, titre: "La solution : un tableau de bord qui se met à jour seul", debutMs: 32000, finMs: 66000 },
      { id: "c3", rang: 3, titre: "Les alertes : savoir avant de manquer", debutMs: 66000, finMs: 94000 },
      { id: "c4", rang: 4, titre: "Par où commencer", debutMs: 94000, finMs: 120000 },
    ],
    scenes,
    sousTitres: [
      ligne(5700, 12000, "Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main."),
      ligne(12200, 18800, "Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères."),
      ligne(19200, 25300, "Une rupture se découvre quand un client appelle."),
      ligne(25700, 28800, "Les chiffres sont faux dès le lendemain."),
      ligne(29200, 31800, "Et personne ne sait vraiment ce qui dort au fond de l'entrepôt."),
      ligne(34700, 41300, "Le tableau de bord lit chaque vente et chaque livraison au moment où elles arrivent."),
      ligne(41700, 50300, "En haut, trois chiffres : la valeur du stock, les articles bientôt épuisés, et les commandes en attente."),
      ligne(50700, 56300, "Un clic sur un article montre son historique sur douze mois."),
      ligne(56700, 65800, "Plus besoin de compter : le stock est juste à chaque instant."),
      ligne(68700, 74300, "Pour chaque article, vous fixez un seuil minimum."),
      ligne(74700, 83800, "Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne."),
      ligne(84200, 89800, "Chaque lundi matin, un résumé de la semaine arrive dans votre boîte."),
      ligne(90200, 93800, "Vous savez avant de manquer, et plus jamais par un client mécontent."),
      ligne(96700, 102300, "Commencez petit. Choisissez les vingt articles qui se vendent le plus."),
      ligne(102700, 110300, "Reliez le tableau de bord à votre outil de vente. Vérifiez pendant deux semaines que les chiffres sont justes."),
      ligne(110700, 114800, "Ajoutez ensuite le reste du catalogue, famille par famille."),
    ],
    alertes: [],
  },
};
