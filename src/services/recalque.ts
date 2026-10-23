/**
 * RECALQUE DES SOUS-TITRES (lot M4 ; plan B.0 §20, B.5, B.9). Après la correction d'un mot (une NOUVELLE version des
 * sous-titres, lot M2), « Appliquer à la vidéo » recompose SEULEMENT l'encadré et les sous-titres sur la piste
 * `master-sans-texte` de chaque format d'image : ni la voix, ni le visage, ni les illustrations ne sont refaits,
 * le coût est nul. Le résultat est une NOUVELLE version de la vidéo (l'ancienne reste, rien n'est effacé), qui devient
 * la version choisie à la fin.
 * Lot « bruitages » (02/10, D1) : `appliquerSons` — même chemin, le son seul est refait sous l'image gardée.
 */
import "server-only";
import type { ChoixBruitagePlan, Id, VersionVideo } from "@/domaine/types";
import { ENTREE_BRUITAGES_PLANS } from "@/briques/intensite";
import { bruitagesDeLaCommande, mediasDesBruitages } from "./bruitages";
import { nouvelId } from "@/lib/ids";
import { moteurDeCommande } from "@/moteurs";
import { depots, ErreurStudio, horodatage, journaliser } from "./_commun";
import { ID_MOTEUR_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import { exigerSession } from "./auth";
import { parentDeLaVersion, prochainNumero } from "./fabrication";
import { sousTitresCourants } from "./videos";

/** Les sous-titres de la version ont-ils été corrigés depuis la fabrication (version la plus haute > celle du rendu) ? */
export async function correctionEnAttente(versionId: Id): Promise<boolean> {
  const d = depots();
  const liste = await d.sousTitres.lister((s) => s.versionId === versionId);
  if (liste.length < 2) return false;
  const version = await d.versions.obtenir(versionId);
  const applique = (version?.projetMontage as { recalque?: { sousTitresId?: string } } | undefined)?.recalque?.sousTitresId;
  const courants = await sousTitresCourants(versionId);
  return !!courants && courants.id !== applique && courants.version > 1;
}

/** « Appliquer à la vidéo » : lance le recalque gratuit sur la version choisie. */
export async function appliquerSousTitres(videoId: Id): Promise<{ travailId: Id; versionId: Id }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à corriger.");
  const moteur = moteurDeCommande(courante.commande);
  if (!moteur.recalquer) throw new ErreurStudio("RECALQUE_IMPOSSIBLE", "Cette vidéo ne peut pas recevoir la correction sans être refaite.");
  // Cas concret : les sous-titres suivent la voix, jamais de correction seule (le moteur la refuse), réglage `retouches` allumé ou non.
  if (!video.estDemo && courante.commande.moteurId === ID_MOTEUR_CAS_CONCRET) throw new ErreurStudio("RECALQUE_IMPOSSIBLE", "Cette vidéo ne peut pas recevoir la correction sans être refaite.");
  // Facecam lot G : le recalque passe par la chaîne réelle ; sans elle, refus clair avant toute nouvelle version.
  if (!video.estDemo && moteur.refusRetouche?.(courante.commande)) throw new ErreurStudio("RECALQUE_IMPOSSIBLE", "Cette vidéo ne peut pas recevoir la correction sans être refaite.");
  const deja = await d.travaux.trouver((t) => t.cibleId === videoId && t.type === "recalque-sous-titres" && (t.statut === "en_cours" || t.statut === "en_file"));
  if (deja) return { travailId: deja.id, versionId: deja.versionId ?? "" };
  const sousTitres = await sousTitresCourants(courante.id);
  if (!sousTitres) throw new ErreurStudio("SANS_SOUS_TITRES", "Cette vidéo n'a pas de sous-titres.");

  // Nouvelle version : mêmes plans, mêmes pistes (déjà payées), les sous-titres corrigés en version 1.
  const versionId = nouvelId("ver");
  const travailId = nouvelId("trav");
  const numero = await prochainNumero(videoId);
  // recopie numeroSuivi : VOULU. Le recalque (sous-titres ou son seuls, gratuit) garde le lien suivi de la version corrigée ;
  // cas concret et image→vidéo refusent le recalque : la version recopiée ne pose aucun lien.
  const version: VersionVideo = { ...courante, id: versionId, numero, parentVersionId: courante.id, statut: "en_fabrication", travailId, choisie: false, coutReel: undefined, noteRetouche: "Sous-titres corrigés", ...horodatage() };
  await d.versions.enregistrer(version);
  for (const p of await d.plans.lister((x) => x.versionId === courante.id)) await d.plans.enregistrer({ ...p, id: `${versionId}-plan-${p.ordre}`, versionId });
  for (const p of await d.pistes.lister((x) => x.versionId === courante.id)) await d.pistes.enregistrer({ ...p, id: nouvelId("piste"), versionId, ...horodatage() });
  const copie = { ...sousTitres, id: nouvelId("st"), versionId, version: 1, ...horodatage() };
  await d.sousTitres.enregistrer(copie);

  const parent = await parentDeLaVersion(courante);
  const travail = await moteur.recalquer({ commande: courante.commande, contexte: { travailId, versionId, titre: `Sous-titres corrigés — ${video.titre}` }, sousTitresId: copie.id, segments: copie.segments, parent });
  await d.travaux.enregistrer({ ...travail, estDemo: video.estDemo });
  await d.videos.modifier(videoId, { statut: "en_fabrication" });
  await journaliser("retouche", "Correction des sous-titres appliquée à la vidéo (gratuit)", { type: "video", id: videoId });
  return { travailId, versionId };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Lot « bruitages » (02/10, D1) : « retirer / ajouter le son » d'un plan APRÈS fabrication ne refait QUE le mixage.   */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Choix de son de chaque plan de la version (par ordre), tels que Will les a posés. */
async function choixDesPlans(versionId: Id): Promise<Record<string, ChoixBruitagePlan | null>> {
  const plans = await depots().plans.lister((p) => p.versionId === versionId);
  return Object.fromEntries(plans.sort((a, b) => a.ordre - b.ordre).map((p) => [String(p.ordre), p.bruitage ?? null]));
}

/** Choix appliqués quand la version a été faite (fabrication : ceux des plans produits ; remixage : ceux demandés). */
function choixAppliques(version: VersionVideo): Record<string, ChoixBruitagePlan | null> {
  const demandes = version.commande.entrees?.[ENTREE_BRUITAGES_PLANS] as Record<string, ChoixBruitagePlan | null> | undefined;
  if (demandes) return demandes;
  const produits = (version.projetMontage as { plansProduits?: { ordre: number; bruitage?: ChoixBruitagePlan }[] } | undefined)?.plansProduits ?? [];
  return Object.fromEntries(produits.map((p) => [String(p.ordre), p.bruitage ?? null]));
}

/** Un son de plan a-t-il été changé depuis la fabrication de la version (« Appliquer » à proposer) ? */
export async function sonsEnAttente(versionId: Id): Promise<boolean> {
  const version = await depots().versions.obtenir(versionId);
  if (!version) return false;
  const voulus = await choixDesPlans(versionId);
  const faits = choixAppliques(version);
  return Object.entries(voulus).some(([ordre, c]) => JSON.stringify(c ?? null) !== JSON.stringify(faits[ordre] ?? null));
}

/**
 * « Appliquer » les sons choisis plan par plan : NOUVELLE version (l'ancienne reste), mêmes plans, mêmes pistes, mêmes
 * sous-titres ; le moteur ne refait que le son sous l'image gardée (gratuit). Les sons validés depuis la fabrication
 * sont proposés eux aussi.
 */
export async function appliquerSons(videoId: Id): Promise<{ travailId: Id; versionId: Id }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à remixer.");
  const moteur = moteurDeCommande(courante.commande);
  if (!moteur.recalquer) throw new ErreurStudio("RECALQUE_IMPOSSIBLE", "Cette vidéo ne peut pas changer de son sans être refaite.");
  const deja = await d.travaux.trouver((t) => t.cibleId === videoId && t.type === "recalque-sous-titres" && (t.statut === "en_cours" || t.statut === "en_file"));
  if (deja) return { travailId: deja.id, versionId: deja.versionId ?? "" };

  const choix = await choixDesPlans(courante.id);
  const reglage = courante.commande.intensite?.bruitages ?? "aucun";
  const disponibles = await bruitagesDeLaCommande(reglage === "aucun" && Object.values(choix).some((c) => c?.mode === "ajoute") ? "discrets" : reglage, courante.commande.formatId);
  const commande = {
    ...courante.commande,
    entrees: { ...courante.commande.entrees, [ENTREE_BRUITAGES_PLANS]: choix },
    bruitagesDisponibles: disponibles,
    medias: { ...(courante.commande.medias ?? {}), ...(await mediasDesBruitages(disponibles)) },
  };
  const versionId = nouvelId("ver");
  const travailId = nouvelId("trav");
  const numero = await prochainNumero(videoId);
  // recopie numeroSuivi : VOULU. Le recalque (sous-titres ou son seuls, gratuit) garde le lien suivi de la version corrigée ;
  // cas concret et image→vidéo refusent le recalque : la version recopiée ne pose aucun lien.
  await d.versions.enregistrer({ ...courante, id: versionId, numero, parentVersionId: courante.id, statut: "en_fabrication", travailId, choisie: false, coutReel: undefined, noteRetouche: "Sons changés", commande, ...horodatage() });
  for (const p of await d.plans.lister((x) => x.versionId === courante.id)) await d.plans.enregistrer({ ...p, id: `${versionId}-plan-${p.ordre}`, versionId });
  for (const p of await d.pistes.lister((x) => x.versionId === courante.id)) await d.pistes.enregistrer({ ...p, id: nouvelId("piste"), versionId, ...horodatage() });
  const sousTitres = await sousTitresCourants(courante.id);
  const copie = sousTitres ? { ...sousTitres, id: nouvelId("st"), versionId, version: 1, ...horodatage() } : null;
  if (copie) await d.sousTitres.enregistrer(copie);
  const parent = await parentDeLaVersion(courante);
  const travail = await moteur.recalquer({ commande, contexte: { travailId, versionId, titre: `Sons changés — ${video.titre}` }, sousTitresId: copie?.id ?? "", segments: copie?.segments ?? [], parent });
  await d.travaux.enregistrer({ ...travail, estDemo: video.estDemo });
  await d.videos.modifier(videoId, { statut: "en_fabrication" });
  await journaliser("retouche", "Sons des plans appliqués à la vidéo (gratuit)", { type: "video", id: videoId });
  return { travailId, versionId };
}
