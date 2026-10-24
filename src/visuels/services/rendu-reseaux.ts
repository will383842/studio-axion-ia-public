import { createHash } from "node:crypto";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { identifiantSur, segmentStockage } from "@/fournisseurs/rendu/commun";
import { PROFILS_RESEAUX, cadreDe, type Cadre, type Reseau } from "../../briques/visuels/reseaux";
import { validerProprietesPage, type SpecValide } from "../proprietes-page";
import { canonique, DELAI_RENDU_MS, rendrePageVisuel, VERSION_RENDU, type DependancesRenduVisuels, type FichierRendu } from "./rendu";

/**
 * Rendu d'un carrousel PAR RÉSEAU (H3) : une version par CADRE, pas par réseau. LinkedIn : chaque page en JPEG ×1 et ×2 et le PDF (document
 * LinkedIn, titre de 40 signes au plus). Meta (Instagram ET Facebook) : UNE seule série de JPEG ×1, sans PDF. Chaque version a sa propre
 * empreinte (le cadre y entre) : même spec et même cadre = aucun nouveau rendu. Le rendu sans cadre (`rendreCarrousel`) ne change pas.
 * Un carrousel plus long que `pagesMax` d'un réseau demandé est refusé et l'interrupteur du générateur est vérifié, avant toute soumission ;
 * une page qui empiète sur une zone réservée du cadre est refusée.
 */

export interface PageReseau {
  index: number;
  x1: FichierRendu;
  /** LinkedIn seulement : la page ×2, source du PDF. */
  x2?: FichierRendu;
}

export interface VersionRendue {
  cadre: Cadre;
  empreinte: string;
  pages: PageReseau[];
  /** LinkedIn : le PDF ; Meta : `null` (les images sont publiées une à une). */
  pdfCle: string | null;
  vignetteCle: string;
}

/** Version rendue et les réseaux demandés qu'elle sert (Instagram et Facebook partagent la version Meta). */
export type VersionReseau = VersionRendue & { reseaux: Reseau[] };

export interface RegistreVersionsReseaux {
  lire(empreinte: string): Promise<VersionRendue | null>;
  ecrire(empreinte: string, version: VersionRendue): Promise<void>;
}

export type DependancesRenduReseaux = Omit<DependancesRenduVisuels, "registre"> & { registre: RegistreVersionsReseaux };

export function creerRegistreVersionsMemoire(): RegistreVersionsReseaux {
  const m = new Map<string, VersionRendue>();
  return { lire: async (e) => m.get(e) ?? null, ecrire: async (e, v) => void m.set(e, v) };
}

/** Empreinte SHA-256 (hexadécimal) d'une version par cadre : version du rendu, cadre, spec VALIDÉ. Lève si le spec est invalide. PUR. */
export function empreinteReseau(spec: unknown, cadre: Cadre): string {
  const { spec: valide } = validerProprietesPage({ spec, index: 0 });
  return createHash("sha256").update(`${VERSION_RENDU}\ncadre=${cadre}\n${canonique(valide)}`).digest("hex");
}

/** Titre du document LinkedIn : au plus `titreDocumentMax` signes (40), coupé sur un mot avec « … » s'il est plus long. PUR. */
export function titreDocument(titre: string): string {
  const max = PROFILS_RESEAUX.linkedin.titreDocumentMax ?? 40;
  const signes = [...titre.trim()];
  if (signes.length <= max) return signes.join("");
  const debut = signes.slice(0, max - 1).join("");
  const coupe = debut.lastIndexOf(" ");
  return `${(coupe > 0 ? debut.slice(0, coupe) : debut).trimEnd()}…`;
}

const enCours = new Map<string, Promise<VersionRendue>>();

export async function rendreVersionsReseaux(spec: unknown, reseaux: readonly Reseau[], deps: DependancesRenduReseaux): Promise<VersionReseau[]> {
  if (reseaux.length === 0) throw new Error("Aucun réseau demandé");
  const inconnu = reseaux.find((r) => !Object.hasOwn(PROFILS_RESEAUX, r));
  if (inconnu !== undefined) throw new Error(`Réseau inconnu « ${String(inconnu)} »`);
  const { spec: valide } = validerProprietesPage({ spec, index: 0 });
  for (const r of reseaux) {
    const max = PROFILS_RESEAUX[r].pagesMax;
    if (valide.pages.length > max) throw new Error(`Carrousel trop long pour ${r} : ${valide.pages.length} pages pour ${max} au plus`);
  }
  const groupes = new Map<Cadre, Reseau[]>();
  for (const r of reseaux) {
    const liste = groupes.get(cadreDe(r)) ?? [];
    if (!liste.includes(r)) liste.push(r);
    groupes.set(cadreDe(r), liste);
  }
  const cibles = [...groupes].map(([cadre, membres]) => ({ cadre, membres, empreinte: empreinteReseau(spec, cadre) }));
  const connues = await Promise.all(cibles.map((c) => deps.registre.lire(c.empreinte)));
  // Interrupteur vérifié avant toute soumission (une version déjà rendue se relit sans rien soumettre).
  if (connues.some((v) => !v) && !(await deps.allume())) throw new Error("Le générateur de carrousels est éteint (Réglages › Carrousels)");
  const versions: VersionReseau[] = [];
  for (const [i, c] of cibles.entries()) {
    const version = connues[i] ?? (await partage(c.empreinte, () => executer(valide, c.cadre, c.empreinte, deps)));
    versions.push({ ...version, reseaux: c.membres });
  }
  return versions;
}

/** Deux demandes simultanées de la même empreinte partagent le même travail. */
function partage(empreinte: string, travail: () => Promise<VersionRendue>): Promise<VersionRendue> {
  const deja = enCours.get(empreinte);
  if (deja) return deja;
  const p = travail().finally(() => enCours.delete(empreinte));
  enCours.set(empreinte, p);
  return p;
}

async function executer(valide: SpecValide, cadre: Cadre, empreinte: string, deps: DependancesRenduReseaux): Promise<VersionRendue> {
  const connu = await deps.registre.lire(empreinte);
  if (connu) return connu;
  const service = deps.rendu();
  const base = `studio/${segmentStockage()}/visuels/${empreinte.slice(0, 32)}`;
  const idBase = identifiantSur(`visuel-${empreinte.slice(0, 32)}`);
  const attente = { delaiMs: deps.delaiMs ?? DELAI_RENDU_MS, attendre: deps.attendre, maintenant: deps.maintenant };
  const linkedin = cadre === "linkedin";
  const page = (index: number, scale: 1 | 2) => rendrePageVisuel({ service, attente, stockage: deps.stockage, base, idBase, spec: valide, index, scale, cadre });

  // Une page à la fois (×1, et ×2 pour LinkedIn), comme le rendu sans cadre.
  const pages: PageReseau[] = [];
  for (const index of valide.pages.keys()) {
    if (linkedin) {
      const [x1, x2] = await Promise.all([page(index, 1), page(index, 2)]);
      pages.push({ index, x1, x2 });
    } else pages.push({ index, x1: await page(index, 1) });
  }

  let pdfCle: string | null = null;
  if (linkedin) {
    pdfCle = `${base}/carrousel.pdf`;
    const entrees: Record<string, string> = {};
    for (const p of pages) entrees[`page-${p.index + 1}`] = await deps.stockage.urlLecture(p.x2!.cle);
    const couverture = valide.pages[0];
    const titre = titreDocument("titre" in couverture ? couverture.titre : valide.alt);
    await executerRendu(
      service,
      { idRendu: `${idBase}-pdf`, operation: "assemblage-pdf", file: "courte", entrees, sortie: { urlDepot: await deps.stockage.urlDepot(pdfCle), cle: pdfCle }, parametres: { titre } },
      attente,
    );
  }

  const version: VersionRendue = { cadre, empreinte, pages, pdfCle, vignetteCle: pages[0].x1.cle };
  await deps.registre.ecrire(empreinte, version);
  return version;
}
