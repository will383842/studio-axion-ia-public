/** Compteur de caractères du texte d'un visuel (L4-13, D4-20). PUR : utilisable côté serveur et côté navigateur. */
import type { IdReseau } from "@/domaine/types";
import { obtenirReseau } from "@/reseaux";

export interface EtatCompteur {
  caracteres: number;
  /** Longueur maximale permise par le réseau. */
  max: number;
  /** Nombre de caractères visibles avant « voir plus ». */
  visible: number;
  /** Négatif quand le texte est trop long. */
  restant: number;
  depasse: boolean;
}

export type VerdictLegende = { ok: true } | { ok: false; code: "TROP_LONG" | "VIDE"; phrase: string };

/** Sauts de ligne en « \n » (un formulaire envoie « \r\n ») : c'est ce texte-là qui est compté et enregistré. */
export function normaliserLegende(texte: string): string {
  return texte.replace(/\r\n?/g, "\n");
}

/** Le texte normalisé, sans espaces autour, compté en points de code (un emoji vaut 1 ; avec teinte, 2). */
export function mesurerLegende(texte: string): number {
  return [...normaliserLegende(texte).trim()].length;
}

/** Même mesure que l'évaluation du rôle de publication : le texte sans espaces autour. */
export function compterLegende(texte: string, reseau: IdReseau): EtatCompteur {
  const { longueurMax, longueurVisible } = obtenirReseau(reseau).legende;
  const caracteres = mesurerLegende(texte);
  return { caracteres, max: longueurMax, visible: longueurVisible, restant: longueurMax - caracteres, depasse: caracteres > longueurMax };
}

const nombre = (n: number) => n.toLocaleString("fr-FR");

export function phraseCompteur(etat: EtatCompteur): string {
  return `${nombre(etat.caracteres)} sur ${nombre(etat.max)} caractères`;
}

export function verifierLegende(texte: string, reseau: IdReseau): VerdictLegende {
  const etat = compterLegende(texte, reseau);
  if (etat.caracteres === 0) return { ok: false, code: "VIDE", phrase: "Le texte est vide : écrivez quelques lignes avant d'enregistrer." };
  if (etat.depasse) return { ok: false, code: "TROP_LONG", phrase: `Le texte est trop long pour ce réseau : ${nombre(-etat.restant)} ${-etat.restant === 1 ? "caractère" : "caractères"} à retirer.` };
  return { ok: true };
}

/** Phrase d'erreur à partir du code lu dans l'adresse ; un code inconnu ne donne rien. */
export function phraseDuCodeLegende(code: string | undefined): string | undefined {
  if (code === "TROP_LONG") return "Le texte est trop long pour ce réseau : rien n'a été enregistré. Raccourcissez-le puis recommencez.";
  if (code === "VIDE") return "Le texte est vide : rien n'a été enregistré.";
  return undefined;
}
