/**
 * La chaîne vidéo (lot B) vue par le moteur : statut de chaque étape déclarée (les 4 étapes parlantes du lot A) et
 * résultat de fabrication. PUR.
 */
import type { CommandeFabrication, EtapeTravail } from "@/domaine/types";
import { MENTION_PLAFOND_FACECAM } from "@/domaine/facecam";
import { ZERO } from "@/lib/montants";
import type { ResultatFabrication } from "../types";
import { livraisonChaine, VERSION_CHAINE_FACECAM, type CleTravailChaine, type EtatChaine } from "./chaine";
import { entreesAvecLivraison } from "./raccords";
import { repriseDeLaChaine, signatureMontage } from "./retouche";

/**
 * Lot G : entrées face caméra de la version FINIE (`facecam` + `facecamMonteur`) : celles de la commande, remplacées
 * par ce que le monteur a posé à la fabrication puis par la correction de la relecture, et la livraison (clés R2, coupes
 * du studio). Le service les range sur la version ET sur la vidéo : la retouche suivante repart d'elles.
 */
export function entreesFinales(commande: Pick<CommandeFabrication, "entrees">, etat: EtatChaine): { facecam: Record<string, unknown>; facecamMonteur?: Record<string, unknown> } {
  const base = { ...(commande.entrees ?? {}), ...(etat.monteur?.entrees ?? {}), ...(etat.relecture?.entrees ?? {}) } as Record<string, unknown>;
  const avec = entreesAvecLivraison(base, livraisonChaine(etat).facecam);
  return { facecam: avec.facecam as Record<string, unknown>, ...(avec.facecamMonteur ? { facecamMonteur: avec.facecamMonteur as Record<string, unknown> } : {}) };
}

/** Peau et mur mesurés par la passe image, après retouche (Lab) ; absents : pas de passe. */
export function lookMesure(etat: EtatChaine): { peauLab: number[]; murLab?: number[] } | undefined {
  const m = (etat.travaux.passe?.resultat as { mesures?: { peauLab?: unknown; murLab?: unknown } } | undefined)?.mesures;
  const lab = (x: unknown): x is number[] => Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === "number");
  return lab(m?.peauLab) ? { peauLab: m.peauLab, ...(lab(m.murLab) ? { murLab: m.murLab } : {}) } : undefined;
}

type Statut = EtapeTravail["statut"];

function statutTravail(etat: EtatChaine, cle: CleTravailChaine): { statut: Statut; progression: number } {
  const t = etat.travaux[cle];
  if (!t) return { statut: "en_attente", progression: 0 };
  if (t.statut === "termine") return { statut: "terminee", progression: 100 };
  if (t.statut === "echec") return t.erreur?.reessayable ? { statut: "en_cours", progression: 1 } : { statut: "echec", progression: 50 };
  return { statut: "en_cours", progression: Math.max(1, Math.min(99, t.progression ?? 1)) };
}

/** Statut de chaque étape déclarée, d'après l'état de la chaîne. Une brique sautée compte comme faite (livrée sans elle). */
export function etapesSelonChaine(etapes: EtapeTravail[], etat: EtatChaine): EtapeTravail[] {
  const fait = { statut: "terminee" as Statut, progression: 100 };
  const enCours = (p: number) => ({ statut: "en_cours" as Statut, progression: p });
  const sautee = (cle: CleTravailChaine) => etat.travaux[cle]?.statut === "echec" && !etat.travaux[cle]?.erreur?.reessayable;
  const montage = statutTravail(etat, "cadrage");
  // Lot C (raccord du lot E) : sous-titres et cartes, puis la vidéo finale, suivent l'habillage quand il est branché.
  const hab = etat.habillage;
  const cartesFaites = hab ? hab.cartes.filter((x) => x.statut !== "soumise").length / Math.max(1, hab.cartes.length) : 0;
  const compo = hab?.composition?.["9:16"];
  const progressionCompo = compo?.phase === "faite" ? 100 : (compo as { progression?: number } | undefined)?.progression ?? 0;
  const parCle: Record<string, { statut: Statut; progression: number }> = {
    reception: fait,
    coupes: etat.coupes ? fait : statutTravail(etat, "transcrire").statut === "en_attente" ? { statut: "en_attente", progression: 0 } : enCours(statutTravail(etat, "transcrire").progression),
    son: etat.echec?.brique === "son" ? { statut: "echec", progression: 50 } : statutTravail(etat, "son"),
    etalonnage: sautee("passe") || etat.travaux.passe?.statut === "termine" ? fait : etat.travaux.passe ? statutTravail(etat, "passe") : etat.travaux.visages ? enCours(Math.round(statutTravail(etat, "visages").progression / 3)) : { statut: "en_attente", progression: 0 },
    montage: etat.echec?.brique === "cadrage" ? { statut: "echec", progression: 50 } : montage,
    // Lot C (sous-titres, cartes, composition finale) : sans habillage branché, faits avec le montage.
    "sous-titres": etat.fini || hab?.composition ? fait : hab ? enCours(Math.max(1, Math.round(cartesFaites * 99))) : { statut: "en_attente", progression: 0 },
    decor: etat.decor ? fait : etat.travaux.passe?.statut === "termine" ? enCours(1) : { statut: "en_attente", progression: 0 },
    // 10/10 : export refusé par le garde-fou des couleurs (jamais livré).
    export: etat.echec?.brique === "export" ? { statut: "echec", progression: 99 } : etat.fini ? fait : hab?.composition ? enCours(Math.max(1, Math.min(99, progressionCompo))) : { statut: "en_attente", progression: 0 },
    controle: etat.fini ? fait : { statut: "en_attente", progression: 0 },
  };
  return etapes.map((e) => {
    if (e.statut === "ignoree") return e;
    const s = parCle[e.cle];
    if (!s) return e;
    const erreur =
      s.statut === "echec"
        ? { code: "FACECAM_ECHEC", reessayable: etat.echec?.reessayable ?? true, messagePourWill: e.cle === "export" && etat.echec?.brique === "export" ? etat.echec.message : `${e.nom} n'a pas abouti. Vous pouvez réessayer.`, detailTechnique: etat.echec?.message ?? `Échec de l'étape « ${e.cle} ».` }
        : undefined;
    return { ...e, statut: s.statut, progression: s.progression, erreur, ...(s.statut === "terminee" ? { coutReel: ZERO } : {}) };
  });
}

/** Résultat de fabrication de la chaîne finie : la piste montée 9:16 et les données du face caméra (clés R2). */
export function resultatChaine(commande: CommandeFabrication, etat: EtatChaine, simple: boolean): ResultatFabrication {
  const l = livraisonChaine(etat);
  // Habillage fait (lot C) : la vidéo finale composée (sous-titres, cartes, export 8 bits) remplace la piste montée.
  const habille = etat.habillage?.sortie;
  const alertes = [...l.alertes, ...(habille?.alertes ?? []), ...(simple ? [{ code: "montant" as const, gravite: "info" as const, message: MENTION_PLAFOND_FACECAM }] : [])];
  const bloquantes = alertes.filter((a) => a.gravite === "bloquant").length;
  const note = Math.max(40, (simple ? 80 : 88) - 10 * bloquantes - 3 * (alertes.length - bloquantes));
  const montageCle = l.montageCle ?? "";
  const entrees = entreesFinales(commande, etat);
  return {
    sorties: [
      {
        ratio: "9:16",
        fichierCle: habille?.fichierCle ?? montageCle,
        vignetteCle: habille?.vignetteCle ?? (etat.travaux.cadrage?.resultat as { vignetteCle?: string } | undefined)?.vignetteCle ?? "",
        resolution: "1080x1920",
        dureeSec: l.dureeSec,
        taille: 0,
        rapportQualite: {
          note,
          verifie: { image: true, son: true, sousTitres: !!habille && !!commande.briques["sous-titres"], mentionIA: !!commande.briques["mention-ia"], droits: false },
          alertes,
          niveauSonoreLufs: Number((etat.travaux.cadrage?.resultat as { controles?: { niveauLufs?: number } } | undefined)?.controles?.niveauLufs ?? -14),
        },
      },
    ],
    noteQualite: { globale: note, alertes },
    // 11/10 : la vidéo SANS texte (sous-titres, cartes) est gardée comme piste : les miniatures en sont tirées (image propre).
    ...(habille?.masterCle ? { pistes: [{ type: "master-sans-texte" as const, fournisseur: "studio-rendu", fichierCle: habille.masterCle, ratio: "9:16" as const, cout: ZERO }] } : {}),
    // Lot G : les sous-titres réellement posés (onglet Sous-titres : corriger un mot puis « Appliquer à la vidéo »).
    ...(habille && etat.habillage?.base.segments.length ? { sousTitres: etat.habillage.base.segments } : {}),
    lignesReelles: [{ etape: "Montage face caméra", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "reel" }],
    projetMontage: {
      moteur: "montage-facecam",
      chaine: VERSION_CHAINE_FACECAM,
      version: simple ? "simple" : l.version,
      montageCle,
      ...(l.motsMontesCle ? { motsMontesCle: l.motsMontesCle } : {}),
      facecam: l.facecam,
      coupes: etat.coupes ? { mode: etat.coupes.mode, texteNonRetrouve: etat.coupes.texteNonRetrouve, resume: etat.coupes.resume, gardes: etat.coupes.gardes } : undefined,
      plans: etat.plans,
      sauts: etat.sauts,
      ...(habille ? { habillage: { sortieCle: habille.fichierCle, ...(habille.masterCle ? { masterCle: habille.masterCle } : {}), cartes: etat.habillage!.cartes.filter((x) => x.statut === "faite").map((x) => x.demande.sortie.cle) } } : {}),
      // 10/10 : les cartes automatiques de cette version (fiche « Cartes et effets » : toutes les cartes, auto comprises).
      ...(habille && etat.habillage?.cartesAutoFiche ? { cartesAuto: etat.habillage.cartesAutoFiche.vues } : {}),
      ...(etat.decor && etat.decor.statut !== "ignore" ? { decor: { statut: etat.decor.statut, message: etat.decor.message } } : {}),
      // V6 P0 n° 4 : peau et mur mesurés par la passe image (référence du look si Will a gardé cette version).
      ...(lookMesure(etat) ? { lookMesure: lookMesure(etat) } : {}),
      // Lot G : entrées de la version finie et reprise (clés R2, petits résultats) pour les retouches suivantes.
      entrees,
      reprise: repriseDeLaChaine(etat, signatureMontage(entrees), l.dureeSec),
      ...(etat.relecture ? { relecture: { defauts: etat.relecture.defauts ?? [], correction: etat.relecture.correction ?? null } } : {}),
    },
  };
}
