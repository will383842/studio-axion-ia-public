/**
 * DÉPENDANCES RÉELLES de la chaîne vidéo face caméra (plan facecam v4, lot B) : `studio-aligneur`, adresses signées
 * R2 du stockage, lecture des json.gz, glossaire maison.
 *
 * Le réel ne se prend que s'il est DEMANDÉ par la commande (`entrees.facecamAligneurReel === true`, recopié par le
 * service depuis un réglage caché au moment de construire la commande, donc figé pour le travail) ET que
 * `STUDIO_ALIGNEUR_URL` existe. Sinon : `null`, le moteur garde son squelette (et refuse le lancement réel).
 * Aucune variable d'environnement nouvelle. L'habillage (lot C) n'est branché que si `studio-rendu` est réel
 * (`STUDIO_RENDU_URL`) : sinon la piste montée est livrée telle quelle.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { resoudreFournisseur } from "@/fournisseurs";
import { fournisseurFacecam } from "@/fournisseurs/facecam";
import { obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { DependancesChaine } from "./chaine";
import { GLOSSAIRE_FACECAM } from "./glossaire";
import { RECETTE_COMPOSITION_FACECAM } from "./habillage";

const DUREE_LECTURE_SEC = 24 * 3600;
const DUREE_DEPOT_SEC = 6 * 3600;

/**
 * Raccords du lot E : ce que les SERVICES branchent sur la chaîne (le moteur est pur et n'importe jamais un service).
 * Posés une fois au chargement de `services/facecam-branchements.ts` ; absents (tests, simulation) : rien ne change.
 */
export interface ServicesFacecam {
  /** Agent monteur (lot D, `monteurPourFabrication`). `travailId` (lot G) : le plafond du monteur court depuis son début. */
  monteur?: (c: CommandeFabrication, travailId?: string) => DependancesChaine["monteur"];
  /** Décor IA (lot E1, `passeDecorFacecam`) ; appelé seulement si la commande l'a demandé. */
  decor?: (c: CommandeFabrication, travailId: string) => DependancesChaine["decor"];
  /** Relecture Claude des images de contrôle (lot D, `relireImagesControle`), à la fin de la chaîne. */
  relire?: (c: CommandeFabrication, contexte?: ContexteRelecture) => Promise<void>;
  /** Mission H : multicaméra (brique commune, `passeMulticameraFacecam`) ; rend `null` quand l'option est coupée. */
  multicamera?: (c: CommandeFabrication, travailId: string) => DependancesChaine["multicamera"];
  /** Lot I : image de contrôle (JPEG sur R2) décodée en RVB pour la lumière de l'objet 3D ; null : repli. */
  lireImageRvb?: DependancesChaine["lireImageRvb"];
  /** Lot G : relecture CIBLÉE de la vidéo finie (images extraites, 1 appel, 1 correction convertie en entrées). */
  relecture?: (c: CommandeFabrication, travailId: string) => DependancesChaine["relire"];
  /** Lot K : effets réalistes par IA (`passeEffetsRealistesFacecam`) : jamais sans confirmation valide de la version. */
  effetsRealistes?: (c: CommandeFabrication, travailId: string) => DependancesChaine["effetsRealistes"];
}

/** Ce que la relecture Claude reçoit à la fin de la chaîne (Lot I : une image au milieu de chaque effet). */
export interface ContexteRelecture {
  /** Vérif V4 : le travail relu (le plafond du monteur par version court depuis son début, pas depuis l'appel). */
  travailId?: string;
  vignetteCle?: string;
  fichierCle?: string;
  imagesEffets?: { elementId: string; cle: string; legende: string }[];
}

const cleServices = Symbol.for("studio-axion-ia.facecam-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesFacecam };

export function brancherServicesFacecam(s: ServicesFacecam): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesFacecam(): ServicesFacecam {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

/** Outils de `studio-rendu` pour l'habillage (cartes + composition finale), seulement quand le rendu est RÉEL. */
export function outilsHabillage(env: Record<string, string | undefined> = process.env): OutilsMontage | undefined {
  if (renduSimule(env)) return undefined;
  const stockage = resoudreFournisseur("stockage");
  return {
    rendu: () => obtenirServiceRendu(env),
    recette: RECETTE_COMPOSITION_FACECAM,
    async signer(lectures, depots) {
      const sortie = { lectures: {} as Record<string, string>, depots: {} as Record<string, string> };
      for (const [nom, cle] of Object.entries(lectures)) sortie.lectures[nom] = stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : await stockage.urlLecture(cle);
      for (const d of depots) {
        if (!stockage.urlDepotDuree) throw new Error("Stockage sans dépôt signé : l'habillage face caméra exige R2.");
        sortie.depots[d.cle] = await stockage.urlDepotDuree(d.cle, DUREE_DEPOT_SEC, d.mime);
      }
      return sortie;
    },
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}


/** Le service a-t-il demandé le vrai `studio-aligneur` pour cette commande ? */
export function aligneurReelDemande(c: Pick<CommandeFabrication, "entrees">): boolean {
  return (c.entrees as { facecamAligneurReel?: unknown } | undefined)?.facecamAligneurReel === true;
}

export function dependancesChaineParDefaut(c: Pick<CommandeFabrication, "entrees"> & Partial<CommandeFabrication>, env: Record<string, string | undefined> = process.env, travailId = ""): DependancesChaine | null {
  if (!aligneurReelDemande(c)) return null;
  const facecam = fournisseurFacecam({ reel: true }, env);
  if (facecam.mode !== "reel") return null;
  const services = servicesFacecam();
  const commande = c as CommandeFabrication;
  const habillage = outilsHabillage(env);
  const monteur = services.monteur?.(commande, travailId);
  const relire = services.relecture?.(commande, travailId);
  const decor = (c.entrees as { facecamDecorIa?: unknown } | undefined)?.facecamDecorIa === true ? services.decor?.(commande, travailId) : undefined;
  const effetsRealistes = services.effetsRealistes?.(commande, travailId); // Lot K
  // Mission H : multicaméra, seulement si l'habillage est réel (la passe rend `null` quand l'option est coupée).
  const multicamera = habillage ? services.multicamera?.(commande, travailId) : undefined;
  const stockage = resoudreFournisseur("stockage");
  const urlLecture = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle));
  return {
    facecam,
    urlLecture,
    urlDepot: async (cle, mime) => {
      if (!stockage.urlDepotDuree) throw new Error("Stockage sans dépôt signé : le face caméra réel exige R2.");
      return stockage.urlDepotDuree(cle, DUREE_DEPOT_SEC, mime);
    },
    lireJsonGz: async (cle) => {
      const r = await fetch(await urlLecture(cle), { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) return null;
      const { gunzipSync } = await import("node:zlib");
      return JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf-8"));
    },
    glossaire: GLOSSAIRE_FACECAM,
    // Calage du texte validé sur le son monté : l'aligneur existant, même conteneur (`/alignements`).
    alignement: resoudreFournisseur("alignement", "studio-aligneur"),
    ecrireJsonGz: async (cle, donnees) => {
      if (!stockage.urlDepotDuree) return;
      const { gzipSync } = await import("node:zlib");
      const corps = gzipSync(Buffer.from(JSON.stringify(donnees), "utf-8"));
      const r = await fetch(await stockage.urlDepotDuree(cle, DUREE_DEPOT_SEC, "application/gzip"), { method: "PUT", body: corps, headers: { "content-type": "application/gzip" }, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`Dépôt refusé (${r.status}).`);
    },
    // Raccords du lot E (facultatifs) : agent monteur, Décor IA, habillage dans studio-rendu.
    ...(monteur ? { monteur } : {}),
    ...(relire ? { relire } : {}),
    ...(decor ? { decor } : {}),
    ...(effetsRealistes ? { effetsRealistes } : {}),
    ...(habillage ? { habillage } : {}),
    ...(multicamera ? { multicamera } : {}),
    ...(services.lireImageRvb ? { lireImageRvb: services.lireImageRvb } : {}), // Lot I
  };
}
