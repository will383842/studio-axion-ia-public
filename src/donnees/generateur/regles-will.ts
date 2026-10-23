/**
 * Les tics d'écriture IA et les annonces d'outil que le code repère (`violationsReglesWill`), écrits en clair. UNE SEULE
 * SOURCE : le filtre en fait ses motifs, la consigne ci-dessous les cite telles quelles (jamais recopiées à la main).
 */
export const TICS_IA_WILL: readonly string[] = ["dans un monde où", "game changer", "changement de paradigme", "plongeons", "et si je vous disais", "spoiler"];
export const ANNONCES_OUTIL_WILL: readonly string[] = ["vient de sortir", "vient de lancer", "nouvel outil", "nouveaux outils", "nouvelle fonctionnalité", "nouvelles fonctionnalités", "vient d'annoncer", "viennent d'annoncer"];
const citer = (l: readonly string[]) => l.map((t) => `« ${t} »`).join(", ");

/**
 * Règles d'écriture de la version publique (jeu GÉNÉRIQUE et réduit), UNE SEULE SOURCE pour tous les écrivains de scripts du
 * générateur : la chaîne « équipe » (`generateur/roles/equipe-*.ts`) et la chaîne courte (`generateur/chaine-courte.ts`).
 * Écrites dans la consigne du rôle (partie en cache), jamais dans la partie variable. Le jeu complet du studio n'est pas publié.
 */
/** Ligne ajoutée par le lot A (#499) ; absente du texte des formats hors recette commune (`REGLES_WILL_AVANT_LOT_A`). */
const LIGNE_TUTORIEL_WILL = "- Une suite de consignes à l'impératif adressées au spectateur (« Un. Listez… Deux. Cochez… ») est un tutoriel, donc interdite.";

export const REGLES_WILL = [
  "RÈGLES D'ÉCRITURE (ordres permanents, elles l'emportent sur toute autre consigne) :",
  "- Apporter de la valeur, mais ne JAMAIS conclure par « faites-le vous-même » : la fin dit ce que nous mettons en place.",
  "- Pas de suite de consignes à l'impératif adressées au spectateur : ce serait un tutoriel.",
  "- Pas d'annonce d'outil ni de nouveauté (« dernière mise à jour », « l'annonce de ») : on parle du bénéfice pour l'entreprise.",
  "- Une vidéo = UNE cible (TPE, PME, ETI ou grand groupe), jamais plusieurs.",
  "- Pas de tics d'IA : jamais « ce n'est pas X, c'est Y », aucun superlatif creux.",
  `- Mots et tournures que le contrôle refuse (les éviter dès l'écriture) : tics d'IA : ${citer(TICS_IA_WILL)} ; annonces d'outil : ${citer(ANNONCES_OUTIL_WILL)}.`,
  "- Interdits permanents : aucun gain garanti, aucun chiffre sans source (une <preuve> fournie), aucun faux client.",
].join("\n");

/** Les règles de Will telles qu'elles étaient avant le lot A (sans la ligne « tutoriel ») : l'avocat les reçoit ainsi. */
export const REGLES_WILL_AVANT_LOT_A = REGLES_WILL.replace(`\n${LIGNE_TUTORIEL_WILL}`, "");
