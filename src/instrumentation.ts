/**
 * Au démarrage du serveur (mise en ligne) : prépare la base tout de suite — création de la table,
 * chargement, et données de démonstration si elle est vide — au lieu d'attendre la première visite.
 * Puis applique la migration de données idempotente du moteur avocat (B.0) : rien n'est jamais supprimé.
 * Enfin, lance la BOUCLE DE FOND (lot M1b, B.9 ter) APRÈS la migration : les fabrications avancent sans visiteur,
 * toutes les 5 s. Sans base (développement, données en mémoire), la boucle tourne aussi.
 * La veille des outils (lot B2) se lance à côté, une fois par processus (`STUDIO_VEILLE=0` la coupe).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { avecReessais, refusDemarrageSansBase, refusRenduSansCle } = await import("@/lib/demarrage");
  // E2E-2 données n° 7 : en production, pas de démarrage sans base (la démonstration en mémoire disparaîtrait).
  // Relecture sécurité R45 n° 3 : ni avec un serveur de rendu relié sans sa clé partagée.
  const refus = refusDemarrageSansBase(process.env) ?? refusRenduSansCle(process.env);
  if (refus) {
    console.error(`[studio] ${refus}`);
    process.exit(1);
  }
  if (process.env.DATABASE_URL) {
    const { depots } = await import("@/donnees/memoire");
    // E2E-2 données n° 8 : une base injoignable ne doit pas faire échouer `register()` (Next garderait cet échec à vie,
    // toutes les pages en 500). On réessaie 12 fois toutes les 5 s, puis on arrête : Docker relance le conteneur.
    let n: number;
    try {
      n = await avecReessais(() => depots().parametres.compter(), {
        essais: 12,
        delaiMs: 5000,
        surEchec: (essai, erreur) => console.error(`[studio] base injoignable (essai ${essai}/12) : ${erreur instanceof Error ? erreur.message : String(erreur)}`),
      });
    } catch {
      console.error("[studio] base toujours injoignable après 1 minute : arrêt, Docker relancera le studio.");
      process.exit(1);
    }
    console.log(`[studio] base prête (${n} réglages)`);
    try {
      const { migrerDonnees, resumeDemarrage } = await import("@/services/migrations");
      const r = await migrerDonnees(depots());
      // E2E-2 données n° 6 : le total compte aussi les étapes 12 à 20 (l'étape 19 disait « déjà à jour »).
      console.log(`[studio] migration des données : ${resumeDemarrage(r)}`);
    } catch (erreur) {
      // Une migration en échec ne bloque pas le démarrage : les lecteurs savent lire l'ancien format.
      console.error("[studio] migration des données en échec", erreur);
    }
  }
  // Audit D (un seul réplica garanti) : la veille, la boucle d'écriture (appels Claude payants) et la boucle de fond ne
  // tournent que dans l'instance qui tient le verrou consultatif Postgres. Une seconde instance n'en lance AUCUNE
  // (nouvel essai toutes les 30 s ; `/api/sante` répond 503 au bout de 3 min : deux studios tournent).
  const lancerAvecLeVerrou = async () => {
    // Veille des outils (lot B2) : une lecture des pages publiques par jour, une seule fois par processus.
    // Coupée par STUDIO_VEILLE=0. Rien n'est jamais mis à jour automatiquement.
    if (process.env.STUDIO_VEILLE !== "0") {
      const { demarrerVeille } = await import("@/services/veille");
      if (demarrerVeille()) console.log("[studio] veille des outils démarrée (une lecture par jour)");
    }
    // Lot G4 (générateur) : la boucle d'écriture, SON drapeau, hors de la file `Travail` (B.0 n° 52) ; reprise après un
    // redémarrage depuis la dernière étape terminée (les étapes terminées ne sont pas repayées ; un appel interrompu par
    // le redémarrage peut l'être, plafonné : `solderAppelsInterrompus`). Coupée par STUDIO_BOUCLE_GENERATION=0.
    if (process.env.STUDIO_BOUCLE_GENERATION !== "0") {
      const { assurerBoucleGeneration } = await import("@/services/boucle-generation");
      assurerBoucleGeneration();
      console.log("[studio] boucle d'écriture démarrée (toutes les 4 s)");
    }
  };
  // Relecture paquet 4 (exactitude D1) : verrou perdu, la boucle d'écriture et la veille s'arrêtent aussi ; elles
  // repartent à la reprise du verrou (`avecLeVerrou` est relancé).
  const arreterSansLeVerrou = () => {
    void import("@/services/boucle-generation").then((m) => m.arreterBoucleGeneration());
    void import("@/services/veille").then((m) => m.arreterVeille());
  };
  const { demarrerBoucleUnique } = await import("@/services/boucle");
  const fabrication = process.env.STUDIO_BOUCLE !== "0"; // « 0 » : coupure de secours (variable d'environnement)
  if ((await demarrerBoucleUnique({ boucleFabrication: fabrication, avecLeVerrou: lancerAvecLeVerrou, surPerte: arreterSansLeVerrou })) && fabrication) {
    console.log("[studio] boucle de fond démarrée (toutes les 5 s)");
  }
}
