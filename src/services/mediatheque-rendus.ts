/** Chaque rendu devient un Fichier (L2-11) : une fiche par page (1x) et une pour le PDF, sur les clés déjà écrites. */
import type { Fichier } from "@/domaine/types";
import type { RenduVisuel } from "@/domaine/visuels/visuel";
import { cleMediaRendu, idFichierDeCle, typeMimeDeCle } from "@/domaine/mediatheque/cle-media";
import { SEGMENT_CLE_VISUELS } from "@/domaine/mediatheque/types-entite";

/** Le morceau du dépôt de Fichier dont ce service a besoin (injecté : aucun service réel ici). */
export interface DepotFichiers {
  obtenir(id: string): Promise<Fichier | null>;
  enregistrer(f: Fichier): Promise<Fichier>;
}

export interface DemandeEnregistrement {
  visuelId: string;
  rendu: RenduVisuel;
  depot: DepotFichiers;
  maintenant: () => string;
}

export interface FichiersDuRendu {
  pages: Fichier[];
  pdf: Fichier;
}

async function inscrire(depot: DepotFichiers, cle: string, nom: string, maintenant: string): Promise<Fichier> {
  const id = idFichierDeCle(cle);
  const existant = await depot.obtenir(id);
  if (existant) return existant;
  return depot.enregistrer({ id, cleStockage: cle, nom, mime: typeMimeDeCle(cle), taille: 0, origine: "fabrication", statut: "pret", creeLe: maintenant, modifieLe: maintenant });
}

/** Inscrit le PDF et chaque page du rendu. Rejouable : un Fichier déjà inscrit n'est ni réécrit ni dupliqué. */
export async function enregistrerRendu(d: DemandeEnregistrement): Promise<FichiersDuRendu> {
  // Préfixe réel écrit par le rendu : studio/<env>/visuels/<empreinte 32>/ (l'environnement est un seul segment).
  const empreinte = d.rendu.empreinte.slice(0, 32);
  const dansLeVisuel = (cle: string) => {
    const s = cle.split("/");
    return s.length >= 5 && s[0] === "studio" && s[1] !== "" && s[2] === SEGMENT_CLE_VISUELS && s[3] === empreinte;
  };
  const nomDeCle = (cle: string) => cle.split("/").pop() as string;
  const entrees = [
    { cle: cleMediaRendu(d.rendu.pdfCle), nom: "carrousel.pdf" },
    ...d.rendu.pages.map((p) => ({ cle: cleMediaRendu(p.x1Cle), nom: nomDeCle(p.x1Cle) })),
  ];
  // Tout est vérifié avant la première écriture : une clé invalide n'écrit rien.
  for (const e of entrees) if (!dansLeVisuel(e.cle)) throw new Error("Clé de média hors du visuel.");
  const maintenant = d.maintenant();
  const [pdf, ...pages] = await Promise.all(entrees.map((e) => inscrire(d.depot, e.cle, e.nom, maintenant)));
  return { pages, pdf };
}
