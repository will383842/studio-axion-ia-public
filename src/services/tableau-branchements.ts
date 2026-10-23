/**
 * RACCORDS DU TABLEAU ANIMÉ (tâche TB-11) : ce que les services branchent sur le moteur `montage-tableau` (pur, il
 * n'importe jamais un service), sur le modèle de `facecam-branchements.ts`. Chargé pour son effet par la boucle de fond,
 * qui fait avancer les travaux.
 *
 * Les outils réels sont ceux que partage le lanceur de la plus petite première version (`tableau-outils.ts`,
 * `branchementsReels` : voix prête du personnage, stockage R2, `studio-rendu`) ; la préparation des scènes vient de la
 * brique pure `tableau-scene` (que `studio-rendu` ré-exporte). Rien n'est importé hors de `src/` (l'image du studio
 * ne contient ni `scripts/` ni `studio-rendu/`). Le budget passe par le chemin unique du studio (`verifierEtReserverSelonOrigine`, avec l'origine de la commande),
 * au nom de la vraie vidéo et du vrai travail. Rien n'est construit tant qu'un travail du tableau n'avance pas ; tout
 * ce qui manque lève une phrase claire, que le moteur montre à Will.
 *
 * Pas encore branché (le moteur le dit) : le découpage automatique (appel Claude du rôle `roleDecoupageTableau`) ; les
 * sources de chiffres et les bulles de preuve viendront avec les écrans (TB-21). La case « déjà vu » est cochée à la
 * création et lue dans les entrées de la commande par le moteur.
 */
import "server-only";
import { brancherServicesTableau, type OutilsTableau } from "@/moteurs/montage-tableau";
import { depots } from "./_commun";

/** Date du jour (AAAA-MM-JJ). */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

brancherServicesTableau({
  outils: async (c, travailId): Promise<OutilsTableau | null> => {
    const personnageId = c.distribution[0]?.personnageId;
    if (!personnageId) return null;
    const { branchementsReels, TARIF_VOIX_CENTIMES_PAR_CARACTERE } = await import("./tableau-outils");
    const { controlerProprietes, proprietesScenes } = await import("@/briques/tableau-scene/proprietes");
    const { resoudreFournisseur } = await import("@/fournisseurs");
    const { verifierEtReserverSelonOrigine } = await import("./credits");
    const { centimes } = await import("@/lib/montants");
    const { appelsValides, choisirFinTableau, reseauDuTableau } = await import("./tableau-fin");
    const { lireEntreesTableau } = await import("@/moteurs/montage-tableau/etapes");
    const { versionDuCode } = await import("@/moteurs/montage-tableau/fabriquer");
    const { ajouterEvenement } = await import("./tableau-tracabilite");
    const { codesVersionTableau } = await import("./tableau-code");
    const { fixerRangDeLaVideo } = await import("./illustrations");
    const { codeDuFormat } = await import("@/formats/registre-codes");
    const { lireSorties } = await import("@/moteurs/montage-tableau/formats-sortie");
    const entrees = lireEntreesTableau(c.entrees);
    // Code de version par réseau (« 0042-TB-IG »), posé ici par `codeVariante` et rangé dans la traçabilité (ajout seul :
    // même code, même clé, jamais deux fois). Le rang est fixé au lancement de la fabrication : il ne change plus. Une
    // écriture ratée n'arrête jamais la fabrication.
    try {
      const codesVersion = codesVersionTableau(await fixerRangDeLaVideo(c.videoId), lireSorties(entrees.sorties), codeDuFormat(c.formatId) ?? "TB");
      await ajouterEvenement({ videoId: c.videoId, type: "code", cle: `version:${Object.values(codesVersion).join(",")}`, date: new Date().toISOString(), ordre: 0, origine: "fabrication", donnees: { codesVersion } });
    } catch {
      // Le code se reposera au prochain passage (même clé).
    }
    const b = await branchementsReels(personnageId, c.videoId);
    const stockage = resoudreFournisseur("stockage");
    const d = depots();
    const [preuves, matieres] = await Promise.all([d.preuves.lister(), d.matieres.lister()]);
    return {
      env: b.env,
      voix: b.voix,
      scenes: b.scenes,
      montage: b.montage,
      preparation: { proprietesScenes, controlerProprietes },
      personnageId,
      // Fin tirée de `fiche.appelId` (une fin non validée par Will n'est jamais rendue), pour le groupe de réseaux de chaque
      // sortie, avec le mot à commenter saisi à la création ; mêmes appels pour « Changer la fin ».
      choisirFin: choisirFinTableau(c, { ...(entrees.mot ? { mot: entrees.mot } : {}), ...(entrees.finLiens ? { finLiens: entrees.finLiens } : {}) }),
      // Traçabilité écrite par la fabrication elle-même (ajout seul) ; version du code lue à la construction.
      tracer: (e) => ajouterEvenement({ ...e, origine: "fabrication" }),
      versionCode: versionDuCode(process.env),
      appels: appelsValides(reseauDuTableau(c)).map((f) => f.id),
      // Délai de garde global du travail (minutes, `STUDIO_TABLEAU_GARDE_MIN`) ; absent : celui du moteur (45 min).
      ...(Number(process.env.STUDIO_TABLEAU_GARDE_MIN) >= 1 ? { delaiGardeMs: Number(process.env.STUDIO_TABLEAU_GARDE_MIN) * 60_000 } : {}),
      lireFiche: async (cle) => {
        const url = stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, 600) : await stockage.urlLecture(cle);
        const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`Fiche de scènes illisible (${r.status}).`);
        return r.json();
      },
      // Mots de la douleur validés avec la fiche à la création : la relecture de la fabrication cherche les mêmes.
      contexte: { aujourdhui: aujourdhui(), sourcesChiffres: [], preuves, matieres, ...(entrees.motsDouleur?.length ? { motsDouleur: entrees.motsDouleur } : {}), ...(entrees.origine === "will" ? { texteDeWill: true } : {}) },
      budget: {
        tarifCentimesParCaractere: TARIF_VOIX_CENTIMES_PAR_CARACTERE,
        verifierEtReserver: async (e) => {
          const total = centimes(e.centimes);
          const voix = b.voix.fournisseurVoix ?? "voix";
          // L3-01 : contrôle, réservation et engagement sous le verrou des crédits, avec l'origine de la commande.
          await verifierEtReserverSelonOrigine(c.origine, { lignes: [{ etape: "voix", fournisseur: voix, unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total }, e.centimes, "Cette vidéo", { videoId: c.videoId, travailId });
        },
      },
    };
  },
});
