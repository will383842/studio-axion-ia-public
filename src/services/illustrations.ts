/**
 * ILLUSTRATIONS — la cascade AU SERVICE, à l'Aperçu (plan du moteur avocat B.6, lot A2 = M5).
 * Le moteur trouve SEUL les illustrations de chaque vidéo :
 *   0. Mes images (prêtes) → 0 bis. réutilisation (déjà payées / téléchargées, anti-répétition à 10 vidéos)
 *   → 1. banques gratuites (Pexels puis Pixabay, vidéos verticales, licence enregistrée, recopiées dans notre stockage)
 *   → 2. « à fabriquer » : fabriqué AU MOTEUR (fal.ai), payé, rangé ensuite dans la Bibliothèque.
 * Mode « économique » : banques seulement (rien n'est fabriqué). Un choix VERROUILLÉ par Will n'est jamais touché.
 * Les règles sont pures (`domaine/illustrations.ts`) ; ce service lit les dépôts et appelle le fournisseur.
 */
import "server-only";
import type { ElementBibliotheque, Fichier, Id, Plan } from "@/domaine/types";
import {
  choisirDansLaBibliotheque,
  utilisableParLeMoteur,
  motsAnglais,
  motsSignificatifs,
  requeteDuPlan,
  requeteFabrication,
  resultatBanqueAcceptable,
  usageApres,
  type DecisionIllustration,
  type OrigineCascade,
} from "@/domaine/illustrations";
import type { DefinitionFormat } from "@/formats/types";
import type { ResultatBanque } from "@/fournisseurs";
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";
import { nouvelId } from "@/lib/ids";
import { depots, ecrireParametre, fournisseur, horodatage, journaliser, lireParametre } from "./_commun";

const CLE_COMPTEUR = "illustrations.compteurVideos";
const cleRang = (videoId: Id) => `illustrations.rang.${videoId}`;
const cleEconomique = (videoId: Id) => `illustrations.economique.${videoId}`;

/* ------------------------------------------------------------------ */
/* Rang des vidéos (anti-répétition)                                   */
/* ------------------------------------------------------------------ */

/** Rang de la vidéo dans la suite des vidéos fabriquées ; une vidéo pas encore fabriquée prend le rang suivant. */
export async function rangDeLaVideo(videoId: Id): Promise<number> {
  const r = await lireParametre<number | null>(cleRang(videoId), null);
  if (r !== null) return r;
  return (await lireParametre<number>(CLE_COMPTEUR, 0)) + 1;
}

/** Fixe le rang au premier lancement (une même vidéo garde son rang pour ses nouvelles versions). */
export async function fixerRangDeLaVideo(videoId: Id): Promise<number> {
  const r = await lireParametre<number | null>(cleRang(videoId), null);
  if (r !== null) return r;
  const rang = (await lireParametre<number>(CLE_COMPTEUR, 0)) + 1;
  await ecrireParametre(CLE_COMPTEUR, rang);
  await ecrireParametre(cleRang(videoId), rang);
  return rang;
}

/** Les illustrations d'une vidéo fabriquée sont marquées utilisées (compteur, dernière vidéo, rang). */
export async function marquerUtilisations(videoId: Id, elementIds: (Id | undefined)[], rang: number): Promise<void> {
  const d = depots();
  for (const id of new Set(elementIds.filter((x): x is Id => !!x))) {
    const e = await d.elements.obtenir(id);
    if (!e || (e.type !== "illustration-image" && e.type !== "illustration-video")) continue;
    await d.elements.modifier(id, usageApres(e, videoId, rang));
  }
}

/* ------------------------------------------------------------------ */
/* Mode économique                                                     */
/* ------------------------------------------------------------------ */

/** Mode économique de la vidéo (sinon le réglage général `illustrations.economique`). */
export async function modeEconomique(videoId: Id): Promise<boolean> {
  const v = await lireParametre<boolean | null>(cleEconomique(videoId), null);
  return v ?? (await lireParametre<boolean>("illustrations.economique", false));
}

export async function changerModeEconomique(videoId: Id, actif: boolean): Promise<void> {
  await ecrireParametre(cleEconomique(videoId), actif);
}

/* ------------------------------------------------------------------ */
/* Banques : un résultat devient un élément de la Bibliothèque          */
/* ------------------------------------------------------------------ */

async function fichierDe(cle: string, mime: string, extra: Partial<Fichier> = {}): Promise<Id> {
  const d = depots();
  const existant = await d.fichiers.trouver((f) => f.cleStockage === cle);
  if (existant) return existant.id;
  const f = await d.fichiers.enregistrer({ id: nouvelId("f"), cleStockage: cle, nom: cle.split("/").pop() ?? cle, mime, taille: 0, origine: "fournisseur", statut: "pret", ...extra, ...horodatage() });
  return f.id;
}

/** Empreinte d'un résultat de banque : sa source et son identifiant (jamais téléchargé deux fois). */
export const empreinteBanque = (r: Pick<ResultatBanque, "source" | "idExterne">) => `${r.source}:${r.idExterne}`;

/**
 * Enregistre un résultat de banque comme élément `illustration-video` (`origine: banque`), avec sa licence ; ses
 * mots-clés = la requête du plan + la description. Recopié dans notre stockage s'il ne l'est pas encore.
 */
export async function enregistrerResultatBanque(r: ResultatBanque, motsFr: string[], illustrations: FournisseurIllustrationEtendu): Promise<Id> {
  const d = depots();
  const empreinte = empreinteBanque(r);
  const existant = await d.elements.trouver((e) => e.empreinte === empreinte);
  if (existant) return existant.id;
  const copie = illustrations.recopierResultat ? await illustrations.recopierResultat(r) : r;
  const fichierId = await fichierDe(copie.fichierCle, "video/mp4", { dureeSec: copie.dureeSec, largeur: copie.largeur, hauteur: copie.hauteur });
  const vignetteFichierId = copie.vignetteCle ? await fichierDe(copie.vignetteCle, "image/jpeg") : undefined;
  const description = copie.description || motsFr.join(" ");
  const motsCles = Array.from(new Set([...motsFr, ...motsSignificatifs(description)])).slice(0, 20);
  const id = nouvelId("el");
  const nom = (description.charAt(0).toUpperCase() + description.slice(1)).slice(0, 80) || "Vidéo";
  await d.elements.enregistrer({
    id,
    type: "illustration-video",
    nom,
    motsCles,
    motsClesEn: Array.from(new Set([...motsAnglais(motsFr.join(" ")), ...motsSignificatifs(description)])).slice(0, 20),
    description,
    valeur: { type: "illustration-video" },
    fichierId,
    vignetteFichierId,
    licence: copie.licence,
    formatsParDefaut: [],
    marqueId: "marque-axion",
    origine: "banque",
    empreinte,
    ...horodatage(),
  });
  await journaliser("bibliotheque", `Vidéo ${r.source === "pexels" ? "Pexels" : "Pixabay"} ajoutée : ${nom}`, { type: "element", id });
  return id;
}

/* ------------------------------------------------------------------ */
/* La cascade, plan par plan                                            */
/* ------------------------------------------------------------------ */

export interface OptionsCascade {
  economique: boolean;
  /** Banques autorisées par le format. */
  banques: boolean;
  /** Fabrication autorisée par le format. */
  fabrication: boolean;
}

export function optionsDuFormat(format: DefinitionFormat, economique: boolean): OptionsCascade {
  const s = format.illustrations.sourcesAutorisees;
  return { economique, banques: s.includes("banque"), fabrication: s.includes("generee-ia") && !economique };
}

/** Banques dans l'ordre : Pexels puis Pixabay ; le premier résultat acceptable, pas déjà pris dans la vidéo. */
async function chercherDansLesBanques(illustrations: FournisseurIllustrationEtendu, requete: string, dureeMinSec: number, dejaPris: Set<string>): Promise<ResultatBanque | null> {
  if (!requete.trim()) return null;
  for (const source of ["pexels", "pixabay"] as const) {
    let resultats: ResultatBanque[] = [];
    try {
      resultats = await illustrations.chercher({ requete, ratio: "9:16", dureeMinSec, sources: [source] });
    } catch (e) {
      console.error(`[studio] recherche ${source} impossible`, (e as Error).message);
      continue;
    }
    const bon = resultats.find((r) => resultatBanqueAcceptable(r, "9:16", dureeMinSec, requete) && !dejaPris.has(empreinteBanque(r)));
    if (bon) return bon;
  }
  return null;
}

/**
 * Applique la cascade aux plans d'illustration NON verrouillés (modifie les plans, renvoie les décisions).
 * Une banque en panne ou une recopie impossible n'empêche rien : le plan passe à l'étape suivante.
 */
export async function appliquerCascade(videoId: Id, plans: Plan[], options: OptionsCascade): Promise<DecisionIllustration[]> {
  const d = depots();
  const illustrations = (await fournisseur("illustration")) as FournisseurIllustrationEtendu;
  const rang = await rangDeLaVideo(videoId);
  const dejaPris = new Set<string>(plans.map((p) => p.illustration?.elementId).filter((x): x is string => !!x));
  const decisions: DecisionIllustration[] = [];
  let elements = await d.elements.lister((e) => !e.archiveLe && (e.type === "illustration-image" || e.type === "illustration-video"));
  for (const p of plans) {
    if (!p.illustration || p.sourceImage !== "illustration") continue;
    if (p.illustration.verrouille) {
      decisions.push({ planId: p.id, origine: "choix", elementId: p.illustration.elementId });
      continue;
    }
    const req = requeteDuPlan({ id: p.id, ordre: p.ordre, texte: p.texte, requete: p.illustration.requete });
    // 0 et 0 bis : Mes images, puis ce qui est déjà payé ou téléchargé.
    const trouve = choisirDansLaBibliotheque(req, elements, { videoId, rang, dejaPris });
    if (trouve) {
      dejaPris.add(trouve.elementId);
      const el = elements.find((e) => e.id === trouve.elementId);
      p.illustration = { ...p.illustration, source: "bibliotheque", elementId: trouve.elementId, candidats: [] };
      p.vignetteFichierId = el?.vignetteFichierId ?? el?.fichierId ?? p.vignetteFichierId;
      decisions.push({ planId: p.id, origine: trouve.origine, elementId: trouve.elementId, score: trouve.score, requeteEn: req.requeteEn });
      continue;
    }
    // Essai (aucune banque ni fabrication reliée) : comme avant le lot M5, la meilleure image de la Bibliothèque est
    // proposée même sous le seuil, pour que l'Aperçu reste parlant ; aucun faux résultat de banque n'est créé.
    if (illustrations.mode === "simulation") {
      const candidats = elements.filter((e) => utilisableParLeMoteur(e) && !dejaPris.has(e.id)).map((e) => ({ id: e.id, motsCles: e.motsCles }));
      const [id] = candidats.length ? await illustrations.choisir({ requete: p.illustration.requete ?? p.texte, candidats, nombre: 1 }) : [];
      if (id) {
        dejaPris.add(id);
        const el = elements.find((e) => e.id === id);
        p.illustration = { ...p.illustration, source: "bibliotheque", elementId: id, candidats: [] };
        p.vignetteFichierId = el?.vignetteFichierId ?? p.vignetteFichierId;
        decisions.push({ planId: p.id, origine: "reutilisee", elementId: id, requeteEn: req.requeteEn });
        continue;
      }
    }
    // 1 : banques gratuites (vidéo verticale, durée du plan au moins).
    if (options.banques && illustrations.mode !== "simulation") {
      const duree = Math.max(2, Math.ceil(p.finSec - p.debutSec));
      const r = await chercherDansLesBanques(illustrations, req.requeteEn || req.motsFr.join(" "), duree, new Set([...dejaPris].map(String)));
      if (r) {
        try {
          const id = await enregistrerResultatBanque(r, req.motsFr, illustrations);
          dejaPris.add(id);
          dejaPris.add(empreinteBanque(r));
          const el = await d.elements.obtenir(id);
          if (el) elements = [...elements.filter((x) => x.id !== id), el];
          p.illustration = { ...p.illustration, source: "banque", elementId: id, candidats: [] };
          p.vignetteFichierId = el?.vignetteFichierId ?? p.vignetteFichierId;
          decisions.push({ planId: p.id, origine: "banque", elementId: id, requeteEn: req.requeteEn });
          continue;
        } catch (e) {
          console.error("[studio] vidéo de banque non recopiée", (e as Error).message);
        }
      }
    }
    // 2 : à fabriquer au moteur (payé), sauf en mode économique : le plan revient alors au double.
    // (Rien de concret à montrer sans personne, ni logo, ni uniforme : on ne promet pas de fabrication.)
    if (options.fabrication && requeteFabrication(req.requeteEn)) {
      p.illustration = { ...p.illustration, source: "generee-ia", elementId: undefined, candidats: [] };
      decisions.push({ planId: p.id, origine: "a-fabriquer", requeteEn: req.requeteEn });
    } else {
      p.illustration = { ...p.illustration, source: "aucune", elementId: undefined, candidats: [] };
      decisions.push({ planId: p.id, origine: "double", requeteEn: req.requeteEn });
    }
  }
  return decisions;
}

/* ------------------------------------------------------------------ */
/* Lecture de l'origine (Aperçu)                                        */
/* ------------------------------------------------------------------ */

/** Origine affichée d'un plan, relue sur le plan et son élément (aucune décision n'est stockée à part). */
export function origineDuPlan(p: Pick<Plan, "sourceImage" | "illustration">, e: Pick<ElementBibliotheque, "origine" | "utilisations"> | undefined): OrigineCascade | null {
  if (p.sourceImage !== "illustration" || !p.illustration) return null;
  if (p.illustration.verrouille && p.illustration.elementId) return "choix";
  if (!p.illustration.elementId) return p.illustration.source === "generee-ia" ? "a-fabriquer" : "double";
  if (e?.origine === "personnelle") return "mes-images";
  if (e?.origine === "banque" && !(e.utilisations ?? 0)) return "banque";
  return "reutilisee";
}

/* ------------------------------------------------------------------ */
/* CORRECTEUR 1 — B3 : plafond fal.ai calculé depuis la base             */
/* ------------------------------------------------------------------ */

/** Une ligne de dépense chez fal.ai (illustrations, décors). */
const estLigneFal = (fournisseurLigne: string) => ["fal", "fal.ai", "fal-ai"].includes(fournisseurLigne.trim().toLowerCase());

/**
 * Ce qui est DÉJÀ dépensé chez fal.ai ce mois-ci (mois de Paris), lu EN BASE, en centimes de dollar : les dépenses
 * enregistrées, plus ce que les travaux en cours ont engagé et pas encore enregistré (illustrations faites, demandes
 * soumises). Rend aussi les demandes que la base connaît. Sert au plafond `FAL_PLAFOND_USD` : il tient après un
 * redémarrage (le compteur gardé en mémoire repartait de zéro). Aucun appel réseau.
 */
export async function depenseFalEnBase(): Promise<{ usdCentimes: number; demandes: Set<string> }> {
  const d = depots();
  const { moisParis } = await import("./couts");
  const { eurVersUsd } = await import("@/domaine/credits");
  const { engagementFal } = await import("@/moteurs/montage-avocat/fabrication-illustrations");
  const { TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const mois = moisParis();
  const parTravail = new Map<string, number>();
  let usd = 0;
  for (const dep of await d.depenses.lister((x) => moisParis(x.date) === mois)) {
    for (const l of dep.lignes) {
      if (!estLigneFal(l.fournisseur)) continue;
      const u = eurVersUsd(l.total.centimes, taux);
      usd += u;
      if (dep.travailId) parTravail.set(dep.travailId, (parTravail.get(dep.travailId) ?? 0) + u);
    }
  }
  const demandes = new Set<string>();
  for (const t of await d.travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) {
    const e = engagementFal(t.parametres?.illustrations as Parameters<typeof engagementFal>[0]);
    for (const id of e.demandes) demandes.add(id);
    usd += Math.max(0, e.usdCentimes - (parTravail.get(t.id) ?? 0));
  }
  return { usdCentimes: Math.round(usd), demandes };
}

/** INTÉGRATION FINALE : trace en base d'une soumission fal.ai (par clé d'idempotence), lue avant toute soumission. */
export async function lireTraceFal(cle: string): Promise<import("@/fournisseurs/illustration/fal").TraceDemandeFal | null> {
  return lireParametre(`fal.demande.${cle}`, null);
}

export async function ecrireTraceFal(cle: string, trace: import("@/fournisseurs/illustration/fal").TraceDemandeFal): Promise<void> {
  await ecrireParametre(`fal.demande.${cle}`, trace);
}
