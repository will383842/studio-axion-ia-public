import { createHash } from "node:crypto";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { executerRendu, type OptionsAttente } from "@/fournisseurs/rendu/attente";
import { identifiantSur, segmentStockage } from "@/fournisseurs/rendu/commun";
import type { Cadre } from "../../briques/visuels/reseaux";
import { validerProprietesPage, type SpecValide } from "../proprietes-page";

/**
 * Rendu d'un carrousel (V2-A, M2-03) par `studio-rendu` : chaque page en JPEG ×1 et ×2 (opération `visuel-page`), le PDF
 * (`assemblage-pdf`, à partir des pages ×2) et la vignette (la page 1 en ×1 : même fichier, aucun rendu de plus).
 * IDEMPOTENT par EMPREINTE du contenu : même empreinte = aucun nouveau rendu (registre) ; deux demandes simultanées
 * partagent le même travail. Les identifiants de rendu dérivent de l'empreinte : un 404 de redémarrage du conteneur est
 * resoumis sous le MÊME `idRendu` (`executerRendu`). Une page qui déborde ou dont le texte passe sous 26 px est refusée.
 */

/** À changer quand la composition ou le rendu changent : les anciens rendus ne servent plus. */
export const VERSION_RENDU = "visuel-page/10";
export const TAILLE_TEXTE_MIN_PX = 26;
export const DELAI_RENDU_MS = 180_000;
/** Une page à la fois (×1 et ×2 ensemble) : le plus simple pour ne pas saturer le navigateur de la file courte (partagée avec les miniatures). */
const PAGES_EN_PARALLELE = 1;

export interface FichierRendu {
  cle: string;
  mesures: Record<string, number>;
}

export interface PageRendue {
  index: number;
  x1: FichierRendu;
  x2: FichierRendu;
}

export interface ResultatRendu {
  empreinte: string;
  pages: PageRendue[];
  pdfCle: string;
  vignetteCle: string;
}

export interface RegistreRendus {
  lire(empreinte: string): Promise<ResultatRendu | null>;
  ecrire(empreinte: string, resultat: ResultatRendu): Promise<void>;
}

export interface DependancesRenduVisuels {
  rendu: () => ServiceRendu;
  /** Adresses signées : dépôt (écriture) et lecture d'une clé de stockage. */
  stockage: { urlDepot(cle: string): Promise<string>; urlLecture(cle: string): Promise<string> };
  registre: RegistreRendus;
  /** Interrupteur « carrousels » (en production : `generateurAllume("carrousels")`), vérifié avant toute soumission. */
  allume: () => Promise<boolean>;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
  delaiMs?: number;
}

export function creerRegistreMemoire(): RegistreRendus {
  const m = new Map<string, ResultatRendu>();
  return { lire: async (e) => m.get(e) ?? null, ecrire: async (e, r) => void m.set(e, r) };
}

/** JSON à clés triées : deux contenus identiques donnent la même chaîne, quel que soit l'ordre des clés. PUR. */
export function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonique(x)}`).join(",")}}`;
  return JSON.stringify(v);
}

/** Empreinte SHA-256 (hexadécimal) du spec VALIDÉ et de la version du rendu. Lève si le spec est invalide. PUR. */
export function empreinteCarrousel(spec: unknown): string {
  const { spec: valide } = validerProprietesPage({ spec, index: 0 });
  return createHash("sha256").update(`${VERSION_RENDU}\n${canonique(valide)}`).digest("hex");
}

const enCours = new Map<string, Promise<ResultatRendu>>();

export async function rendreCarrousel(spec: unknown, deps: DependancesRenduVisuels): Promise<ResultatRendu> {
  const empreinte = empreinteCarrousel(spec);
  const verrou = `${empreinte}`;
  const deja = enCours.get(verrou);
  if (deja) return deja;
  const travail = executer(spec, empreinte, deps).finally(() => enCours.delete(verrou));
  enCours.set(verrou, travail);
  return travail;
}

async function executer(spec: unknown, empreinte: string, deps: DependancesRenduVisuels): Promise<ResultatRendu> {
  const connu = await deps.registre.lire(empreinte);
  if (connu) return connu;
  if (!(await deps.allume())) throw new Error("Le générateur de carrousels est éteint (Réglages › Carrousels)");
  const { spec: valide } = validerProprietesPage({ spec, index: 0 });
  const service = deps.rendu();
  const base = `studio/${segmentStockage()}/visuels/${empreinte.slice(0, 32)}`;
  const idBase = identifiantSur(`visuel-${empreinte.slice(0, 32)}`);
  const attente = { delaiMs: deps.delaiMs ?? DELAI_RENDU_MS, attendre: deps.attendre, maintenant: deps.maintenant };

  const page = (index: number, scale: 1 | 2) => rendrePageVisuel({ service, attente, stockage: deps.stockage, base, idBase, spec: valide, index, scale });

  const travaux = valide.pages.flatMap((_, index) => [() => page(index, 1), () => page(index, 2)] as const);
  const faits: FichierRendu[] = [];
  for (let i = 0; i < travaux.length; i += PAGES_EN_PARALLELE * 2) {
    faits.push(...(await Promise.all(travaux.slice(i, i + PAGES_EN_PARALLELE * 2).map((t) => t()))));
  }
  const pages: PageRendue[] = valide.pages.map((_, index) => ({ index, x1: faits[2 * index], x2: faits[2 * index + 1] }));

  const pdfCle = `${base}/carrousel.pdf`;
  const entrees: Record<string, string> = {};
  for (const p of pages) entrees[`page-${p.index + 1}`] = await deps.stockage.urlLecture(p.x2.cle);
  await executerRendu(
    service,
    {
      idRendu: `${idBase}-pdf`,
      operation: "assemblage-pdf",
      file: "courte",
      entrees,
      sortie: { urlDepot: await deps.stockage.urlDepot(pdfCle), cle: pdfCle },
      parametres: { titre: valide.alt.slice(0, 120) },
    },
    attente,
  );

  const resultat: ResultatRendu = { empreinte, pages, pdfCle, vignetteCle: pages[0].x1.cle };
  await deps.registre.ecrire(empreinte, resultat);
  return resultat;
}

export interface DemandePageVisuel {
  service: ServiceRendu;
  attente: OptionsAttente;
  stockage: DependancesRenduVisuels["stockage"];
  /** Préfixe des clés de stockage et des identifiants de rendu (dérivés de l'empreinte). */
  base: string;
  idBase: string;
  spec: SpecValide;
  index: number;
  scale: 1 | 2;
  /** Cadre du réseau visé (H2) ; absent : propriétés envoyées sans la clé, comme avant. */
  cadre?: Cadre;
}

/**
 * Rend UNE page (opération `visuel-page`) et vérifie ses mesures : une page qui déborde, dont le texte passe sous 26 px, qui pose un texte
 * en zone réservée, qui chevauche, ou qui empiète sur une zone interdite du cadre (`intrusions`, H3) est refusée. Une mesure absente est
 * refusée aussi (aucune tolérance N-1) ; `intrusions` n'est exigée que dans un cadre.
 */
export async function rendrePageVisuel({ service, attente, stockage, base, idBase, spec, index, scale, cadre }: DemandePageVisuel): Promise<FichierRendu> {
  const cle = `${base}/page-${index + 1}-x${scale}.jpg`;
  const demande: DemandeRendu = {
    idRendu: `${idBase}-p${index + 1}-x${scale}`,
    operation: "visuel-page",
    file: "courte",
    entrees: {},
    sortie: { urlDepot: await stockage.urlDepot(cle), cle },
    parametres: { proprietes: cadre ? { spec, index, cadre } : { spec, index }, scale, jpegQuality: 88 },
  };
  const fini = await executerRendu(service, demande, attente);
  const mesures = fini.mesures ?? {};
  if (typeof mesures.debordements !== "number") throw new Error(`La page ${index + 1} : mesure des débordements absente (rendu refusé)`);
  if (mesures.debordements >= 1) throw new Error(`La page ${index + 1} déborde de son cadre (${mesures.debordements} débordement(s)) : texte coupé`);
  if (typeof mesures.taillePoliceMin !== "number") throw new Error(`La page ${index + 1} : mesure de la police absente (rendu refusé)`);
  if (mesures.taillePoliceMin < TAILLE_TEXTE_MIN_PX) throw new Error(`La page ${index + 1} a un texte sous ${TAILLE_TEXTE_MIN_PX} px (${mesures.taillePoliceMin})`);
  // Aucune tolérance N-1 : un studio-rendu sans cette mesure n'a pas vérifié les zones réservées (flèche, pastille) ;
  // mieux vaut refuser (réessayable une fois le nouveau studio-rendu déployé) que publier une page non vérifiée.
  if (typeof mesures.textesEnZone !== "number") throw new Error(`La page ${index + 1} : mesure des textes en zone réservée absente (rendu refusé)`);
  if (mesures.textesEnZone >= 1) throw new Error(`La page ${index + 1} : un texte entre dans une zone réservée (${mesures.textesEnZone} ligne(s)) : rendu refusé`);
  // Chevauchements texte/texte et texte/illustration (L9) : même règle, aucune tolérance pour une mesure absente.
  if (typeof mesures.chevauchements !== "number") throw new Error(`La page ${index + 1} : mesure des chevauchements absente (rendu refusé)`);
  if (mesures.chevauchements >= 1) throw new Error(`La page ${index + 1} : un texte en chevauche un autre ou une illustration (${mesures.chevauchements} cas) : rendu refusé`);
  // Zones interdites du cadre (H3) : `intrusion_<zone>` nomme la zone touchée.
  if (cadre && typeof mesures.intrusions !== "number") throw new Error(`La page ${index + 1} : mesure des intrusions absente (rendu refusé)`);
  if (typeof mesures.intrusions === "number" && mesures.intrusions >= 1) {
    const zone = Object.keys(mesures).find((k) => k.startsWith("intrusion_") && mesures[k] >= 1)?.slice("intrusion_".length) ?? "zone du cadre";
    throw new Error(`La page ${index + 1} empiète sur une zone réservée (${zone})`);
  }
  return { cle, mesures };
}
