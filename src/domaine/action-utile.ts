/**
 * S-02 : « Reprendre » n'est pas proposé pour rien. Un refus que la même entrée redonnerait (`reessayable === false`) ne se
 * relance pas : on dit l'action utile, choisie par le préfixe du code. Fonction pure, aucun montant, aucun appel.
 */
interface ErreurLue {
  code?: string;
  reessayable?: boolean;
  messagePourWill?: string;
}

const DEBUT = "Ce refus reviendrait à l'identique : ";

const ACTIONS: [string, string][] = [
  ["TABLEAU_", "ouvrez la vidéo, corrigez la fiche ou touchez « Relancer » sur sa page."],
  ["CAS_CONCRET_", "reprenez le cas ou la fiche depuis la page de la vidéo."],
  ["IV_", "ouvrez la vidéo et touchez « Refaire le script »."],
  ["FACECAM_", "redemandez la modification au monteur depuis la page de la vidéo."],
];

/** `null` si l'erreur n'est pas un refus définitif ; sinon « <raison> <action> ». */
export function actionUtileApresRefus(erreur: ErreurLue | null | undefined): string | null {
  if (erreur?.reessayable !== false) return null;
  const code = erreur.code ?? "";
  const action = ACTIONS.find(([prefixe]) => code.startsWith(prefixe))?.[1] ?? "ouvrez la vidéo pour la corriger.";
  const raison = (erreur.messagePourWill ?? "").trim();
  return `${raison ? `${raison} ` : ""}${DEBUT}${action}`;
}
