/**
 * TEXTES DE PUBLICATION DU CAS CONCRET (tâche M2, plan cas concret § 4-d et § 4-e ; X6). PUR.
 *
 * Par réseau : le texte du post (promesse, « avant », résultat, question, ligne d'appel du réseau), le texte du premier
 * commentaire quand le lien y va, et la consigne « où poser le lien ». Aucune phrase d'appel n'est inventée : la ligne d'appel
 * reprend les phrases dites des lignes de la fin. Une seule demande : le diagnostic et son lien, ou le mot et son envoi
 * (aucun lien annoncé). LinkedIn ne dit jamais de commenter : quand la vidéo porte le mot, la proposition tient en
 * dernière ligne du texte.
 */
import type { ReseauCas } from "@/formats/cas-concret";
import type { FicheEcrans, PlanDesFins } from "./fiche";

export type OuPoserLeLien = "premier-commentaire" | "profil" | "aucun";

export interface TextePublication {
  reseau: ReseauCas;
  texte: string;
  /** Présent seulement quand le lien va en premier commentaire. */
  premierCommentaire?: string;
  ouPoserLeLien: OuPoserLeLien;
  consigneLien: string;
}

export interface OptionsPublication {
  /** Mot à commenter, quand la vidéo le dit sur au moins un compte ; absent ou vide : aucune proposition de mot. */
  mot?: string;
}

/** Premier commentaire : « Votre diagnostic gratuit, en quelques minutes : <lien> ». */
export const premierCommentaireDiagnostic = (lien: string): string => `Votre diagnostic gratuit, en quelques minutes : ${lien}`;
/** Indication propre à Facebook. */
export const INDICATION_FACEBOOK = "À poser à la main : Buffer ne pose pas de premier commentaire sous un Reel Facebook.";
export const CONSIGNE_PREMIER_COMMENTAIRE = "Poser ce lien en premier commentaire, juste après la publication.";
export const CONSIGNE_PROFIL = "Poser ce lien dans le profil du compte avant de publier.";
export const CONSIGNE_SANS_LIEN = "Aucun lien à poser : la vidéo invite à écrire le mot.";
/** Une fin au mot en une phrase (X7, Instagram) : l'écrit (le mot sous sa forme écrite, « IA »), puis la suite dite. */
function motEcritPuisSuite(fin: { dit: string; ecran: string }): string {
  const ecrit = fin.ecran.trim();
  const dernier = ecrit.split(/\s+/).at(-1) ?? "";
  const i = dernier ? fin.dit.lastIndexOf(dernier) : -1;
  return i >= 0 ? phrase(`${ecrit}${fin.dit.slice(i + dernier.length)}`) : phrase(fin.dit);
}

/** Dernière ligne du texte LinkedIn quand la vidéo porte le mot. */
export const ligneMotLinkedIn = (mot: string): string => `Écrivez ${mot.trim().toUpperCase()} si vous voulez la structure complète : je vous l'envoie.`;

const minuscule = (t: string): string => (t ? t[0].toLowerCase() + t.slice(1) : t);
const phrase = (t: string): string => {
  const s = t.trim();
  return /[.!?…]$/.test(s) ? s : `${s}.`;
};

/** Le lien d'une fin va en premier commentaire quand sa ligne le dit, sinon dans le profil. */
function ouVaLeLien(ecran: string): OuPoserLeLien {
  return /commentaire/i.test(ecran) ? "premier-commentaire" : "profil";
}

export function textesDePublication(fiche: Pick<FicheEcrans, "ecrans">, plan: PlanDesFins, liens: Readonly<Record<string, string>>, options: OptionsPublication = {}): TextePublication[] {
  const accroche = fiche.ecrans.find((e) => e.type === "accroche");
  const avant = fiche.ecrans.find((e) => e.type === "liste-avant");
  const resultat = fiche.ecrans.find((e) => e.type === "resultat");
  const question = fiche.ecrans.find((e) => e.type === "question");

  const haut: string[] = [];
  if (accroche?.type === "accroche") haut.push(phrase(accroche.lignes.join(" ")));
  if (avant?.type === "liste-avant") haut.push(phrase(`Avant : ${avant.taches.map(minuscule).join(", ")}${avant.total ? ` (${minuscule(avant.total)})` : ""}`));
  if (resultat?.type === "resultat") haut.push(phrase(resultat.ligne));
  if (question?.type === "question") haut.push(question.question.trim());

  const res: TextePublication[] = [];
  for (const fin of plan.fins) {
    const diagnostic = fin.appels.find((a) => a.type === "rendez-vous");
    const lienFin = fin.appels.find((a) => a.type === "lien");
    const motFin = fin.appels.find((a) => a.type === "commentaire");
    const envoi = fin.appels.find((a) => a.type === "cadeau");
    for (const reseau of fin.reseaux) {
      const lignes = [...haut];
      if (motFin && !lienFin && !diagnostic) {
        // Fin au mot : aucun lien annoncé. Instagram (X7) : la phrase dite porte l'abonnement et l'envoi, telle quelle.
        lignes.push(envoi ? `${motFin.ecran.trim()} : ${minuscule(phrase(envoi.dit))}` : motEcritPuisSuite(motFin));
        res.push({ reseau, texte: lignes.join("\n\n"), ouPoserLeLien: "aucun", consigneLien: CONSIGNE_SANS_LIEN });
        continue;
      }
      const lien = liens[reseau];
      if (!diagnostic || !lienFin || !lien) continue;
      const ou = ouVaLeLien(lienFin.ecran);
      lignes.push(`${phrase(diagnostic.dit)} ${phrase(lienFin.dit)}`);
      if (reseau === "linkedin" && options.mot?.trim()) lignes.push(ligneMotLinkedIn(options.mot));
      const consigne = ou === "premier-commentaire" ? CONSIGNE_PREMIER_COMMENTAIRE : CONSIGNE_PROFIL;
      res.push({
        reseau,
        texte: lignes.join("\n\n"),
        ...(ou === "premier-commentaire" ? { premierCommentaire: premierCommentaireDiagnostic(lien) } : {}),
        ouPoserLeLien: ou,
        consigneLien: reseau === "facebook" && ou === "premier-commentaire" ? `${consigne} ${INDICATION_FACEBOOK}` : consigne,
      });
    }
  }
  return res;
}
