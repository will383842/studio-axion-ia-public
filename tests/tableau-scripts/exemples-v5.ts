/**
 * LE TÉMOIN V5 DU TABLEAU (lot B1, décision D1 de Will, « oui », 18/10/2026) : plus de tutoriel numéroté à l'impératif.
 * Le corps dit CE QUI CHANGE (constats à l'indicatif, sans numéro dit), la douleur finit par une question au spectateur,
 * la promesse n'annonce aucun nombre d'étapes, « à retenir » ne redit pas l'accroche, et l'entreprise « le met en place
 * pour vous » juste après la question sur l'IA. Texte dit recopié mot pour mot de `exemples-v5/01-continuite.md`
 * (vérifié par `exemples-v5.test.ts`) ; il passe TOUS les contrôles en code. C'est le script témoin donné au générateur
 * (`SCRIPT_TEMOIN`). L'ancien témoin (tutoriel, `exemples-v4.ts`) n'est gardé que pour montrer l'ANCIEN défaut.
 */
import type { DemandeScriptTableau, EcritureScript, LigneGrille } from "@/domaine/scripts-tableau";

export interface ExempleV5 {
  /** Nom du fichier dans `exemples-v5/` (sans « .md »). */
  fichier: string;
  titre: string;
  demande: DemandeScriptTableau;
  ecriture: EcritureScript;
  grille: LigneGrille[];
  manques: string[];
}

const p = (dit: string, ecran: string) => ({ dit, ecran });
const ok = (critere: LigneGrille["critere"], remarque: string): LigneGrille => ({ critere, respecte: true, remarque });

const CONTINUITE: ExempleV5 = {
  fichier: "01-continuite",
  titre: "Automatisations · Le seul qui connaît ce dossier client est en congé",
  demande: {
    serie: "automatisations",
    sujet: "Un dossier client qui se reprend sans appeler le collègue absent",
    public: "Dirigeants de TPE et PME dont les dossiers clients tiennent à une seule personne",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : où les dossiers de l'entreprise dépendent d'une seule personne, et ce qu'on y met en place",
    duree: 60,
  },
  ecriture: {
    idee: "Une fiche tenue à jour remplace l'appel au collègue absent.",
    gain: { formule: "Trois lignes à lire au lieu de fouiller la boîte mail", unite: "lignes" },
    metierExemple: "cabinet comptable",
    script: {
      accroche: [p("Le seul qui connaît ce dossier client est en congé.", "Dossier client, collègue en congé")],
      douleur: [
        p("Un client appelle.", "Un appel arrive"),
        p("On fouille la boîte mail du collègue.", "On fouille ses mails"),
        p("Puis on l'appelle en congé.", "Rappel du collègue absent"),
        p("Le client s'en aperçoit.", "Il s'en aperçoit"),
        p("Chez vous, qui reprendrait ce dossier ?", "Chez vous, qui reprend ?"),
      ],
      promesse: [p("Un dossier peut se reprendre en lisant trois lignes.", "Trois lignes suffisent"), p("Reste à savoir qui les écrit.", "Qui les écrit ?")],
      etapes: [
        {
          action: p("Une automatisation écrit trois lignes dans la fiche.", "Trois lignes dans la fiche"),
          comment: [p("Elles disent où en est le dossier, et la suite.", "État du dossier, suite")],
        },
        {
          action: p("Le collègue n'est plus dérangé en congé.", "Congé respecté"),
          comment: [p("On ne fouille plus l'historique de ses mails.", "Historique : plus de fouille")],
        },
        {
          action: p("Le client ne répète plus son histoire.", "Il ne répète plus"),
          comment: [p("On connaît déjà sa demande, avant même de décrocher.", "Demande connue d'avance")],
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons un cabinet comptable.", "Un cabinet comptable"),
          p("Avant, l'assistante cherchait partout, puis appelait le collègue absent.", "Avant : elle cherche partout"),
          p("Maintenant, elle lit trois lignes et prépare la suite.", "Maintenant : trois lignes"),
        ],
      },
      aRetenir: [p("Une fiche tenue à jour remplace l'appel au collègue absent.", "La fiche remplace l'appel")],
      appel: [
        p("En quoi l'IA peut-elle vous aider ?", ""),
        p("Axion-IA met cette fiche en place pour vous.", "Axion-IA la met en place"),
        p("Réservez un appel de diagnostic.", "Réservez un diagnostic"),
      ],
    },
    motsDouleur: ["dossier client", "en congé"],
    sources: [],
    affirmations: [
      {
        extrait: "On ne fouille plus l'historique de ses mails.",
        nature: "fait",
        pourquoi: "Description du résultat attendu : la fiche reprend à chaque échange le point du dossier, donc le remplaçant n'a pas à relire les mails.",
      },
    ],
    variantes: [],
    aPreparer: ["Le lien de réservation de l'appel de diagnostic."],
  },
  grille: [
    ok("une-idee", "Une idée : une fiche tenue à jour remplace l'appel au collègue absent ; dite en une phrase à la fin."),
    ok("gain", "Trois lignes à lire au lieu de fouiller la boîte mail : annoncé en promesse, montré dans l'exemple."),
    ok("accroche-douleur", "Une phrase, pour qui (un dossier client), lisible sans le son."),
    ok("douleur-vecue", "Le client appelle, on fouille, on rappelle : la scène se voit ; la question finale touche le spectateur."),
    ok("promesse-tenue", "Le gain pour lui, sans nombre d'étapes ; la boucle « qui les écrit » est tenue au premier constat."),
    ok("etapes-claires", "Trois constats à l'indicatif, sujet = la chose qui change, aucun impératif adressé au spectateur."),
    ok("clarte", "Mots simples, aucun jargon, aucune formule creuse, rien de répété."),
    ok("verite", "Pas de chiffre statistique ; la seule affirmation de fait est justifiée."),
    ok("une-seule-demande", "Une demande, quatre mots ; la phrase sur l'entreprise est liée à l'idée et répond à la question sur l'IA."),
    ok("cadre", "Six passages dans l'ordre, chaque passage et chaque constat dans son repère de mots, le total dans 125 à 145."),
  ],
  manques: [],
};

export const EXEMPLES_V5: readonly ExempleV5[] = [CONTINUITE];

/** Une copie neuve de l'exemple `fichier` (les essais la modifient librement). */
export function exempleV5(fichier: string): ExempleV5 {
  const e = EXEMPLES_V5.find((x) => x.fichier === fichier);
  if (!e) throw new Error(`exemple inconnu : ${fichier}`);
  return structuredClone(e);
}
