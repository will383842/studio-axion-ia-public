import { createHash } from "node:crypto";
import { GABARITS } from "@/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "@/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "@/briques/visuels/continu/registre-raccords";
import { empreinteToile } from "@/domaine/visuels/continu/empreinte";
import { validerProprietesToile, type VersionsToile } from "@/domaine/visuels/continu/proprietes-toile";
import type { ToileSpecType } from "@/domaine/visuels/continu/schema-toile";
import { VERSION_TOILE_SOCLE } from "@/domaine/visuels/continu/version";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { identifiantSur, segmentStockage } from "@/fournisseurs/rendu/commun";
import type { DemandeRendu } from "@/fournisseurs/types";
import { DELAI_RENDU_MS, TAILLE_TEXTE_MIN_PX, type DependancesRenduVisuels } from "@/visuels/services/rendu";

/**
 * Rendu d'une toile continue : UNE demande `toile-continue` (file courte) qui rend la toile large puis la découpe en N JPEG déposés aux adresses
 * signées. IDEMPOTENT par empreinte de la toile (registre `visuels.toile.<empreinte>`) ; deux demandes simultanées partagent le même travail.
 * Mêmes refus que `rendrePageVisuel` (mesure absente = refus, aucune tolérance), plus ceux propres à la toile (couture, première page).
 */

export const QUALITE_JPEG_TOILE = 95;

export interface ResultatRenduToile {
  empreinte: string;
  format: "4:5" | "3:4";
  pages: { index: number; cle: string }[];
  bandeCle: string;
  vignetteCle: string;
}

export interface RegistreToiles {
  lire(empreinte: string): Promise<ResultatRenduToile | null>;
  ecrire(empreinte: string, resultat: ResultatRenduToile): Promise<void>;
}

export type DependancesRenduToile = Omit<DependancesRenduVisuels, "registre"> & { registre: RegistreToiles };

export function creerRegistreToilesMemoire(): RegistreToiles {
  const m = new Map<string, ResultatRenduToile>();
  return { lire: async (e) => m.get(e) ?? null, ecrire: async (e, r) => void m.set(e, r) };
}

/** Vérifie les mesures de la toile (aucune tolérance pour une mesure absente) ; lève la phrase du premier défaut. PUR. */
export function verifierMesuresToile(mesures: Record<string, number>): void {
  const nombre = (cle: string, phrase: string): number => {
    const v = mesures[cle];
    if (typeof v !== "number") throw new Error(`La toile : mesure ${phrase} absente (rendu refusé)`);
    return v;
  };
  if (nombre("debordements", "des débordements") >= 1) throw new Error(`La toile : un texte déborde de son cadre (${mesures.debordements} débordement(s)) : texte coupé`);
  const police = nombre("taillePoliceMin", "de la police");
  if (police < TAILLE_TEXTE_MIN_PX) throw new Error(`La toile : un texte est sous ${TAILLE_TEXTE_MIN_PX} px (${police})`);
  if (nombre("textesSurCouture", "des textes sur une couture") >= 1) throw new Error("La toile : un texte passe sur la couture entre deux pages (rendu refusé)");
  if (nombre("textesHorsMarge", "des textes hors de la marge sûre") >= 1) throw new Error("La toile : un texte sort de la marge sûre de 80 px (rendu refusé)");
  if (nombre("textesCoinReserve", "des textes dans le coin réservé") >= 1) throw new Error("La toile : un texte entre dans le coin bas droit réservé (rendu refusé)");
  if (nombre("chevauchements", "des chevauchements") >= 1) throw new Error(`La toile : un texte en chevauche un autre ou une illustration (${mesures.chevauchements} cas) : rendu refusé`);
  if (nombre("intrusionsMetaP1", "des zones interdites de la page 1") >= 1) throw new Error("La page 1 empiète sur une zone réservée d'Instagram et de Facebook (rendu refusé)");
  if (nombre("traitsFinsSurCouture", "des traits fins sur une couture") >= 1) throw new Error("La toile : un trait fin tombe sur une couture (rendu refusé)");
  if (nombre("debordCouture1", "de l'objet sur la première couture") < 1) throw new Error("La page 1 n'invite pas à glisser : aucun objet ne passe sur la première couture");
}

const enCours = new Map<string, Promise<ResultatRenduToile>>();

export async function rendreToile(toile: unknown, deps: DependancesRenduToile): Promise<ResultatRenduToile> {
  // Validée AVANT toute demande : 11 pages, une version inconnue ou un texte avec lien ne partent jamais au serveur.
  const { toile: valide, versions } = validerProprietesToile({ toile, versions: versionsDe(toile) });
  const empreinte = empreinteToile(valide);
  const deja = enCours.get(empreinte);
  if (deja) return deja;
  const travail = executer(valide, versions, empreinte, deps).finally(() => enCours.delete(empreinte));
  enCours.set(empreinte, travail);
  return travail;
}

/** Versions du socle et des gabarits, parcours et raccords UTILISÉS par la toile (ce que l'opération exige). Tolère une toile brute illisible : la validation donne alors la phrase en français. PUR. */
export function versionsDe(brute: unknown): VersionsToile {
  const lire = (cle: string) => {
    const liste = (brute as Record<string, unknown> | null)?.[cle];
    return new Set(Array.isArray(liste) ? liste.map((x: { type?: unknown } | null) => x?.type) : []);
  };
  const types = lire("pages");
  const utilises = lire("raccords");
  return {
    socle: VERSION_TOILE_SOCLE,
    gabarits: Object.fromEntries(GABARITS.filter((g) => types.has(g.type)).map((g) => [g.type, g.version])),
    parcours: Object.fromEntries(PARCOURS.filter((p) => p.pagesTypes.some((t) => types.has(t))).map((p) => [p.id, p.version])),
    raccords: Object.fromEntries(RACCORDS.filter((r) => utilises.has(r.type)).map((r) => [r.type, r.version])),
  };
}

async function executer(toile: ToileSpecType, versions: VersionsToile, empreinte: string, deps: DependancesRenduToile): Promise<ResultatRenduToile> {
  const connu = await deps.registre.lire(empreinte);
  if (connu) return connu;
  if (!(await deps.allume())) throw new Error("Le générateur de carrousels continus est éteint (Réglages › Carrousels)");
  const service = deps.rendu();
  const base = `studio/${segmentStockage()}/toiles/${empreinte.slice(0, 32)}`;
  const n = toile.pages.length;
  const cles = Array.from({ length: n }, (_, i) => `${base}/page-${i + 1}.jpg`);
  const bandeCle = `${base}/bande.jpg`;
  const demande: DemandeRendu = {
    idRendu: identifiantSur(`toile-${createHash("sha256").update(empreinte).digest("hex").slice(0, 32)}`),
    operation: "toile-continue",
    file: "courte",
    entrees: {},
    sortie: { urlDepot: await deps.stockage.urlDepot(bandeCle), cle: bandeCle },
    parametres: {
      proprietes: { toile, versions },
      depotsPages: await Promise.all(cles.map(async (cle) => ({ cle, urlDepot: await deps.stockage.urlDepot(cle) }))),
      qualite: QUALITE_JPEG_TOILE,
    },
  };
  const fini = await executerRendu(service, demande, { delaiMs: deps.delaiMs ?? DELAI_RENDU_MS, attendre: deps.attendre, maintenant: deps.maintenant });
  verifierMesuresToile(fini.mesures ?? {});
  const resultat: ResultatRenduToile = { empreinte, format: toile.format, pages: cles.map((cle, index) => ({ index, cle })), bandeCle, vignetteCle: cles[0] };
  await deps.registre.ecrire(empreinte, resultat);
  return resultat;
}
