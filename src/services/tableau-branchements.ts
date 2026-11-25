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
import { cleDepenseUsine } from "./cle-depense-usine";
import "server-only";
import { brancherServicesTableau, ID_MOTEUR_TABLEAU, type OutilsTableau } from "@/moteurs/montage-tableau";
import type { ResumeVisuel } from "@/briques/variete";
import { resumeVisuelDepuisFiche } from "@/briques/variete/resume";
import type { FicheScenes } from "@/briques/fiche-scenes";
import { depots, lireParametre } from "./_commun";
import { dejaVuUsine } from "./tableau-deja-vu-usine";
import { preteAvecRemarquesActive } from "./tableau-remarques";
import { lireEntreesTableau as lireEntreesSansVoix } from "@/moteurs/montage-tableau/etapes";
import { MOTEUR_SANS_VOIX_PRET, RAISON_SANS_VOIX_MOTEUR_ABSENT } from "@/moteurs/montage-tableau/sans-voix";

/** Date du jour (AAAA-MM-JJ). */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * GV2-47 : résumés visuels des 10 vidéos « prêtes » les plus récentes du tableau (une par vidéo, hors vidéo en cours),
 * créées AVANT `avant` (date de création de la version en cours) : la même fabrication relit donc toujours le même
 * historique, et l'empreinte de l'étape « script » ne bouge pas d'une reprise à l'autre. Une fiche illisible : cette
 * vidéo est ignorée ; une lecture en échec : historique vide. Jamais d'arrêt de la fabrication.
 */
export async function historiqueVarieteTableau(videoIdEnCours: string, avant: string): Promise<ResumeVisuel[]> {
  try {
    const versions = await depots().versions.lister((v) => v.statut === "prete" && v.commande?.moteurId === ID_MOTEUR_TABLEAU && v.videoId !== videoIdEnCours && (v.creeLe ?? "") < avant);
    const vus = new Set<string>();
    const resumes: ResumeVisuel[] = [];
    for (const v of [...versions].sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""))) {
      if (vus.has(v.videoId)) continue;
      vus.add(v.videoId);
      if (vus.size > 10) break;
      try {
        const fiche = (v.projetMontage?.tableau as { fiche?: unknown } | undefined)?.fiche as FicheScenes<unknown> | undefined;
        if (fiche && typeof fiche === "object" && Array.isArray(fiche.scenes)) resumes.push(resumeVisuelDepuisFiche(fiche));
      } catch {
        // Fiche illisible : cette vidéo n'entre pas dans l'historique.
      }
    }
    return resumes;
  } catch (e) {
    console.warn("[studio] historique de variété du tableau illisible :", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Date de création de la version en cours (celle du travail) ; absente ou illisible : « » (historique vide, stable). */
async function creationVersionEnCours(travailId: string): Promise<string> {
  try {
    const v = await depots().versions.trouver((x) => x.travailId === travailId);
    return v?.creeLe ?? "";
  } catch {
    return "";
  }
}

export const PARAM_RACCORDS_TABLEAU = "tableau.raccords"; // BR-TABLEAU-RACCORDS-c : éteint par défaut, seul true exact allume
brancherServicesTableau({
  outils: async (c, travailId): Promise<OutilsTableau | null> => {
    // TA-SV : « sans voix » : jamais de voix résolue ni de budget « voix » ; refus net tant que le moteur ne le gère pas (rien n'est dépensé).
    if (lireEntreesSansVoix(c.entrees).sansVoix && !MOTEUR_SANS_VOIX_PRET) throw new Error(RAISON_SANS_VOIX_MOTEUR_ABSENT);
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
    const raccords = (await lireParametre<unknown>(PARAM_RACCORDS_TABLEAU, false).catch(() => false)) === true;
    const b = await branchementsReels(personnageId, c.videoId);
    const stockage = resoudreFournisseur("stockage");
    const d = depots();
    const [preuves, matieres] = await Promise.all([d.preuves.lister(), d.matieres.lister()]);
    return {
      ...(raccords ? { raccords: true as const } : {}),
      // S-13 : décisions n° 8 et 9, éteint par défaut (seul `true` exact allume).
      ...((await preteAvecRemarquesActive()) ? { preteAvecRemarques: true as const } : {}),
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
      historique: await historiqueVarieteTableau(c.videoId, await creationVersionEnCours(travailId)),
      // FIX-TABLEAU-CASE-PREMIERE-PAGE : commande de l'usine + réglage allumé seulement (éteint par défaut) ; date de la version.
      ...(await dejaVuUsine(c, await creationVersionEnCours(travailId)).then((d) => (d ? { dejaVu: d } : {}))),
      contexte: { aujourdhui: aujourdhui(), sourcesChiffres: [], preuves, matieres, ...(entrees.motsDouleur?.length ? { motsDouleur: entrees.motsDouleur } : {}), ...(entrees.origine === "will" ? { texteDeWill: true } : {}) },
      budget: {
        tarifCentimesParCaractere: TARIF_VOIX_CENTIMES_PAR_CARACTERE,
        verifierEtReserver: async (e) => {
          const total = centimes(e.centimes);
          const voix = b.voix.fournisseurVoix ?? "voix";
          // L3-01 : contrôle, réservation et engagement sous le verrou des crédits, avec l'origine de la commande.
          await verifierEtReserverSelonOrigine(c.origine, { lignes: [{ etape: "voix", fournisseur: voix, unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total }, e.centimes, "Cette vidéo", { videoId: c.videoId, travailId, ...cleDepenseUsine(c.origine, travailId) });
        },
      },
    };
  },
});
