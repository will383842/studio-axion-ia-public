/**
 * MOTEUR SIMULÉ (PLAN B.6.3, AV2.2-4).
 * - Étapes dépendantes crédibles selon la commande (voix → double → montage → …), ~25 s.
 * - Progression calculée d'après l'horloge (la boucle de fond l'interroge toutes les 5 s, lot M1b).
 * - Chaque étape terminée porte son coût réel (coût en direct) ; « Arrêter » garde ces seules étapes payées.
 * - Échec simulable d'UNE étape (commande.simulerEchecEtape) au premier essai seulement ;
 *   « Réessayer » ne relance que l'étape en échec et ce qui en dépend.
 * - Une sortie par ratio demandé, à partir des vidéos de démonstration (public/demo).
 * Fonctions pures : aucun dépôt, aucun réseau.
 */
import { BRIQUES, briqueExport, versionsBriques } from "@/briques";
import type { CommandeFabrication, EtapeTravail, LigneCout, Ratio, Travail } from "@/domaine/types";
import { additionner, centimes, multiplier } from "@/lib/montants";
import { coutDeLEtape } from "./couts-etapes";
import type { ContexteLancement, DefinitionEtapeMoteur, MoteurVideo, ResultatFabrication, SortieProduite } from "./types";

const VIDEOS_VERTICALES = ["/demo/avocat-droits", "/demo/avocat-licenciement", "/demo/motion-chiffres"];
const VIDEO_HORIZONTALE = "/demo/podcast-entretien";

const RESOLUTIONS: Record<Ratio, string> = { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" };

function hache(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fichierDemo(commande: CommandeFabrication, ratio: Ratio): string {
  if (ratio === "16:9") return VIDEO_HORIZONTALE;
  if (commande.formatId === "motion") return "/demo/motion-chiffres";
  return VIDEOS_VERTICALES[hache(commande.videoId) % 2];
}

function etapesFabrication(commande: CommandeFabrication): DefinitionEtapeMoteur[] {
  const avecDouble = commande.distribution.some((d) => d.source === "double");
  const avecRush = commande.distribution.some((d) => d.source === "rush");
  const avecVoix = commande.distribution.length > 0;
  const plusieurs = commande.distribution.length > 1;
  const b = commande.briques;
  const e: DefinitionEtapeMoteur[] = [];
  if (avecVoix) e.push({ cle: "voix", nom: plusieurs ? "Les voix" : "La voix", icone: "micro", dependDe: [], dureeEstimeeSec: 6 });
  if (avecDouble) e.push({ cle: "visage", nom: plusieurs ? "Les doubles" : "Le double", icone: "visage", dependDe: ["voix"], dureeEstimeeSec: 7 });
  if (avecRush) e.push({ cle: "rushs", nom: "Mes images filmées", icone: "camera", dependDe: [], dureeEstimeeSec: 3 });
  if (!avecVoix) e.push({ cle: "animation", nom: "Les animations", icone: "baguette", dependDe: [], dureeEstimeeSec: 8 });
  if (b.illustrations) e.push({ cle: "illustrations", nom: "Les illustrations", icone: "images", dependDe: [], dureeEstimeeSec: 4 });
  const avantMontage = e.filter((x) => x.cle !== "voix").map((x) => x.cle);
  e.push({ cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: avantMontage, dureeEstimeeSec: 4 });
  if (avecVoix && b["sous-titres"]) e.push({ cle: "sous-titres", nom: "Les sous-titres", icone: "sous-titres", dependDe: ["voix"], dureeEstimeeSec: 3 });
  if (b.etalonnage) e.push({ cle: "etalonnage", nom: "Les couleurs", icone: "contraste", dependDe: ["montage"], dureeEstimeeSec: 2 });
  // Brique « son » coupée : il ne reste que le niveau de la voix ; sans voix, l'étape est sautée (AV2.7).
  if (b.son) e.push({ cle: "son", nom: "Le son", icone: "son", dependDe: avecVoix ? ["voix"] : [], dureeEstimeeSec: 3 });
  else if (avecVoix) e.push({ cle: "son", nom: "Le niveau de la voix", icone: "son", dependDe: ["voix"], dureeEstimeeSec: 1.5 });
  const avantExport = ["montage", ...e.filter((x) => x.cle === "son" || x.cle === "etalonnage" || x.cle === "sous-titres").map((x) => x.cle)];
  e.push({ cle: "export", nom: "Les formats d'image", icone: "telecharger", dependDe: avantExport, dureeEstimeeSec: 3 });
  e.push({ cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["export"], dureeEstimeeSec: 1.5 });
  return e;
}

/** Planifie les étapes non terminées à partir de `depart` (ms), en respectant les dépendances. */
function planifier(etapes: EtapeTravail[], durees: Record<string, number>, depart: number, echec?: string): EtapeTravail[] {
  const fin: Record<string, number> = {};
  for (const e of etapes) if (e.statut === "terminee" || e.statut === "ignoree") fin[e.cle] = depart;
  const resultat = etapes.map((e) => ({ ...e }));
  let restantes = resultat.filter((e) => e.statut !== "terminee" && e.statut !== "ignoree");
  let garde = 0;
  while (restantes.length && garde++ < 100) {
    for (const e of restantes) {
      if (e.dependDe.every((d) => fin[d] !== undefined)) {
        const debut = Math.max(depart, ...e.dependDe.map((d) => fin[d]));
        const duree = (durees[e.cle] ?? 3) * 1000;
        e.planifie = { debut, fin: debut + duree, echecA: echec === e.cle ? debut + duree * 0.6 : undefined };
        e.statut = "en_attente";
        e.progression = 0;
        e.erreur = undefined;
        fin[e.cle] = debut + duree;
      }
    }
    restantes = restantes.filter((e) => fin[e.cle] === undefined);
  }
  return resultat;
}

function dureesDe(etapes: DefinitionEtapeMoteur[]): Record<string, number> {
  return Object.fromEntries(etapes.map((e) => [e.cle, e.dureeEstimeeSec]));
}

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, echec?: string): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const etapes: EtapeTravail[] = defs.map((d) => ({
    cle: d.cle,
    nom: d.nom,
    icone: d.icone,
    dependDe: d.dependDe,
    statut: "en_attente",
    progression: 0,
    sortieFichierIds: [],
  }));
  const planifiees = planifier(etapes, dureesDe(defs), maintenant + 600, echec);
  const finMax = Math.max(...planifiees.map((e) => e.planifie?.fin ?? maintenant));
  return {
    id: ctx.travailId,
    type: ctx.type ?? "fabrication",
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: planifiees,
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${ctx.type ?? "fabrication"}`,
    fournisseurUtilise: "simulation",
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(finMax).toISOString(),
  };
}

function bloquee(e: EtapeTravail, etapes: EtapeTravail[]): boolean {
  return e.dependDe.some((d) => {
    const dep = etapes.find((x) => x.cle === d);
    return !dep || dep.statut === "echec" || bloquee(dep, etapes);
  });
}

function rapport(note: number, commande: CommandeFabrication): SortieProduite["rapportQualite"] {
  // La case « mention IA » n'est comptée que si la mention est activée ; coupée, une INFORMATION est consignée (B.8).
  return { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: !!commande.briques["mention-ia"], droits: false }, alertes: [], niveauSonoreLufs: -14 };
}

function resultatPour(commande: CommandeFabrication, estimees: LigneCout[]): ResultatFabrication {
  const g = hache(commande.videoId + commande.construiteLe);
  const note = 80 + (g % 15);
  const sorties: SortieProduite[] = commande.ratios.map((ratio) => {
    const base = fichierDemo(commande, ratio);
    return {
      ratio,
      fichierCle: `${base}.mp4`,
      vignetteCle: `${base}.jpg`,
      resolution: RESOLUTIONS[ratio],
      dureeSec: commande.dureeCibleSec,
      taille: 900_000 + (g % 400_000),
      rapportQualite: rapport(note, commande),
    };
  });
  const lignesReelles = lignesReellesDe(commande, estimees);
  return {
    sorties,
    noteQualite: {
      globale: note,
      levres: Math.min(99, note + 3),
      son: Math.min(99, note + 5),
      sousTitres: Math.min(99, note + 6),
      realisme: Math.max(60, note - 8),
      alertes: note < 85 ? [{ code: "synchronisation", gravite: "attention", message: "Léger décalage des lèvres au plan 3.", planId: commande.plans[2]?.id }] : [],
    },
    lignesReelles,
    projetMontage: { versionContrat: commande.versionContrat, briques: versionsBriques(), plans: commande.plans.length },
  };
}

/** Coûts « réels » simulés : l'estimation à ±10 %, stable pour une même vidéo. */
function lignesReellesDe(commande: CommandeFabrication, estimees: LigneCout[]): LigneCout[] {
  return estimees.map((l) => {
    const total = multiplier(l.total, 0.9 + (hache(l.etape + commande.videoId) % 20) / 100);
    return { ...l, total, nature: "reel" as const };
  });
}

function estimerLignes(commande: CommandeFabrication): LigneCout[] {
  return BRIQUES.flatMap((b) => b.estimer(commande));
}

/** Plancher d'une retouche (relance des étapes de finition), en centimes. */
const PLANCHER_RETOUCHE = 50;

/** Lignes d'une retouche : les lignes de la vidéo au prorata de la durée des plans refaits (AV2.2-5). */
function lignesRetouche(commande: CommandeFabrication, planIds: string[]): LigneCout[] {
  const duree = (p: { debutSec: number; finSec: number }) => Math.max(0, p.finSec - p.debutSec);
  const totale = commande.plans.reduce((t, p) => t + duree(p), 0) || commande.dureeCibleSec || 1;
  const choisie = commande.plans.filter((p) => planIds.includes(p.id)).reduce((t, p) => t + duree(p), 0);
  const prorata = Math.min(1, choisie / totale);
  const lignes = estimerLignes(commande)
    .map((l) => ({ ...l, quantite: +(l.quantite * prorata).toFixed(2), total: multiplier(l.total, prorata) }))
    .filter((l) => l.total.centimes > 0);
  const somme = lignes.reduce((t, l) => t + l.total.centimes, 0);
  if (somme < PLANCHER_RETOUCHE) {
    const reste = centimes(PLANCHER_RETOUCHE - somme);
    lignes.push({ etape: "Finition", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: reste, total: reste, nature: "estime" });
  }
  return lignes;
}

/** Lignes d'un format ajouté : l'export de ce seul format. */
function lignesReexport(commande: CommandeFabrication, ratio: Ratio): LigneCout[] {
  return briqueExport.estimer({ ...commande, ratios: [ratio] });
}

/** Lignes facturées selon le type de travail : une retouche ou un format ajouté ne repaie que ce qui change. */
function lignesDuTravail(travail: Travail, commande: CommandeFabrication): LigneCout[] {
  if (travail.type === "reexport") {
    const ratio = (travail.parametres?.ratio as Ratio | undefined) ?? commande.ratios[0] ?? "9:16";
    return lignesReexport(commande, ratio);
  }
  if (travail.type === "retouche") return lignesRetouche(commande, (travail.parametres?.planIds as string[] | undefined) ?? []);
  return estimerLignes(commande);
}

function estimationDe(lignes: LigneCout[], dureeFabricationSec: number) {
  return { dureeFabricationSec, lignes, total: additionner(...lignes.map((l) => l.total)) };
}

/** Version synchrone de `lancer` (utilisée par les données de démonstration). */
export function travailSimule(commande: CommandeFabrication, contexte: ContexteLancement): Travail {
  return nouveauTravail(etapesFabrication(commande), contexte, commande, commande.simulerEchecEtape);
}

export const moteurSimulation: MoteurVideo = {
  id: "simulation",
  nom: "Moteur d'essai",
  capacites: {
    dureeMaxSec: 1800,
    ratios: ["9:16", "1:1", "4:5", "16:9"],
    langues: ["fr-FR"],
    retoucheParPlan: true,
    asynchrone: true,
    accordExige: true,
    maquette: true,
  },

  async estimer(commande) {
    const lignes = estimerLignes(commande);
    const defs = etapesFabrication(commande);
    const planifie = planifier(
      defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente", progression: 0, sortieFichierIds: [] })),
      dureesDe(defs),
      0,
    );
    const dureeFabricationSec = Math.round(Math.max(...planifie.map((e) => e.planifie?.fin ?? 0)) / 1000);
    return { dureeFabricationSec, lignes, total: additionner(...lignes.map((l) => l.total)) };
  },

  async estimerRetouche(commande, planIds) {
    return estimationDe(lignesRetouche(commande, planIds), 11);
  },

  async estimerReexport(commande, ratio) {
    return estimationDe(lignesReexport(commande, ratio), 4);
  },

  etapes: etapesFabrication,

  async lancer(commande, contexte) {
    return nouveauTravail(etapesFabrication(commande), contexte, commande, commande.simulerEchecEtape);
  },

  async avancer(travail, commande, maintenant = Date.now()) {
    if (travail.statut === "termine" || travail.statut === "annule") return { travail };
    const etapes = travail.etapes.map((e) => ({ ...e }));
    // Coût en direct (B.9 ter) : chaque étape terminée porte son coût réel.
    const reelles = lignesReellesDe(commande, lignesDuTravail(travail, commande));
    for (const e of etapes) {
      if (e.statut === "terminee" || e.statut === "ignoree" || e.statut === "echec" || !e.planifie) continue;
      if (bloquee(e, etapes)) continue;
      const { debut, fin, echecA } = e.planifie;
      if (echecA !== undefined && maintenant >= echecA) {
        e.statut = "echec";
        e.progression = 60;
        e.erreur = {
          code: "SIMULATION_ECHEC",
          reessayable: true,
          messagePourWill: `${e.nom} n'a pas abouti. Vous pouvez réessayer cette étape seule.`,
          detailTechnique: `Échec simulé de l'étape « ${e.cle} ».`,
        };
      } else if (maintenant >= fin) {
        e.statut = "terminee";
        e.progression = 100;
        e.coutReel = coutDeLEtape(reelles, e.cle);
      } else if (maintenant >= debut) {
        e.statut = "en_cours";
        e.progression = Math.min(99, Math.round(((maintenant - debut) / (fin - debut)) * 100));
      }
    }
    const total = etapes.reduce((t, e) => t + e.progression, 0);
    const progression = Math.round(total / Math.max(etapes.length, 1));
    const enEchec = etapes.find((e) => e.statut === "echec");
    const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
    const iso = new Date(maintenant).toISOString();
    const suivant: Travail = {
      ...travail,
      etapes,
      progression: fini ? 100 : progression,
      statut: enEchec ? "echec" : fini ? "termine" : etapes.some((e) => e.statut !== "en_attente") ? "en_cours" : "en_file",
      erreur: enEchec?.erreur,
      modifieLe: iso,
      termineLe: fini ? iso : undefined,
    };
    if (fini) {
      return { travail: suivant, resultat: resultatPour(commande, lignesDuTravail(travail, commande)) };
    }
    return { travail: suivant };
  },

  async reessayer(travail, maintenant = Date.now()) {
    const durees = Object.fromEntries(
      travail.etapes.map((e) => [e.cle, e.planifie ? (e.planifie.fin - e.planifie.debut) / 1000 : 3]),
    );
    // Les étapes terminées restent terminées ; seules l'étape en échec et ses suites sont replanifiées, sans nouvel échec.
    const etapes = planifier(travail.etapes, durees, maintenant + 300);
    const finMax = Math.max(...etapes.map((e) => e.planifie?.fin ?? maintenant));
    return {
      ...travail,
      etapes,
      statut: "en_cours",
      erreur: undefined,
      tentatives: travail.tentatives + 1,
      modifieLe: new Date(maintenant).toISOString(),
      finEstimee: new Date(finMax).toISOString(),
    };
  },

  async retoucher({ commande, contexte, planIds }) {
    const defs: DefinitionEtapeMoteur[] = [
      { cle: "voix", nom: planIds.length > 1 ? "Les voix des plans" : "La voix du plan", icone: "micro", dependDe: [], dureeEstimeeSec: 3 },
      { cle: "visage", nom: "Le double", icone: "visage", dependDe: ["voix"], dureeEstimeeSec: 4 },
      { cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: ["visage"], dureeEstimeeSec: 2 },
      { cle: "export", nom: "Les formats d'image", icone: "telecharger", dependDe: ["montage"], dureeEstimeeSec: 2 },
    ];
    return { ...nouveauTravail(defs, { ...contexte, type: "retouche" }, commande), parametres: { planIds } };
  },

  async reexporter({ commande, contexte, cible }) {
    const defs: DefinitionEtapeMoteur[] = [{ cle: "export", nom: "Le nouveau format", icone: "telecharger", dependDe: [], dureeEstimeeSec: 4 }];
    const ratio = "ratio" in cible ? cible.ratio : commande.ratios[0];
    return { ...nouveauTravail(defs, { ...contexte, type: "reexport" }, commande), parametres: { ratio } };
  },

  async maquette(commande) {
    const base = fichierDemo(commande, commande.ratios[0] ?? "9:16");
    return { fichierCle: `${base}.mp4`, vignetteCle: `${base}.jpg`, dureeSec: commande.dureeCibleSec };
  },

  /**
   * « Arrêter » (B.9 ter) : rien à annuler chez un fournisseur simulé. Les étapes terminées gardent leur coût
   * (elles seules seront payées) ; les autres ne se feront pas. Idempotent.
   */
  async annuler(travail, maintenant = Date.now()) {
    if (travail.statut === "termine" || travail.statut === "annule") return travail;
    const iso = new Date(maintenant).toISOString();
    return {
      ...travail,
      statut: "annule",
      etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, planifie: undefined, erreur: undefined })),
      erreur: undefined,
      modifieLe: iso,
      termineLe: iso,
    };
  },
};
