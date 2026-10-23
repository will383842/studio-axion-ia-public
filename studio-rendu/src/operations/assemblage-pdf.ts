/**
 * Opération `assemblage-pdf` (file courte, carrousels V2-A, M2-02) : les JPEG des pages assemblés en un PDF (`ecrire-pdf.ts`).
 * Entrées : `page-1` … `page-N` (adresses signées des JPEG, dans l'ordre ; 1 à 20, sans trou). Paramètres : `titre`.
 * Sortie : PDF déposé à `sortie.urlDepot`. Mesures : pages, octets.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, telecharger } from "../outils.js";
import { ecrirePdf, PAGES_MAX } from "../pdf/ecrire-pdf.js";

export interface DependancesAssemblagePdf {
  telecharger(url: string, chemin: string, signal?: AbortSignal): Promise<void>;
  deposer(urlDepot: string, chemin: string, mime: string, signal?: AbortSignal): Promise<void>;
}

const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });

/** Noms d'entrée dans l'ordre des pages ; refuse un nom inconnu, un trou ou plus de 20 pages. PUR. */
export function pagesDemandees(entrees: Record<string, string>): string[] {
  const noms = Object.keys(entrees);
  if (noms.length < 1 || noms.length > PAGES_MAX) throw refus(`Le PDF compte de 1 à ${PAGES_MAX} pages (reçu : ${noms.length})`);
  const rangs = noms.map((n) => /^page-([1-9]\d?)$/.exec(n)?.[1]);
  if (rangs.some((r) => r === undefined)) throw refus("Entrées attendues : page-1, page-2…");
  const ordre = noms.map((n, k) => ({ n, rang: Number(rangs[k]) })).sort((a, b) => a.rang - b.rang);
  if (ordre.some((o, k) => o.rang !== k + 1)) throw refus("Les pages doivent se suivre sans trou, à partir de page-1");
  return ordre.map((o) => o.n);
}

export function creerAssemblagePdf(deps: DependancesAssemblagePdf): Operation {
  return async (demande, contexte) => {
    const titre = demande.parametres.titre;
    if (typeof titre !== "string" || !titre.trim() || titre.length > 200) throw refus("titre : texte de 1 à 200 signes");
    const inconnu = Object.keys(demande.parametres).find((k) => k !== "titre");
    if (inconnu) throw refus(`Paramètre inconnu « ${inconnu} »`);
    const noms = pagesDemandees(demande.entrees);
    const pages: Buffer[] = [];
    for (const [k, nom] of noms.entries()) {
      const chemin = join(contexte.dossier, `${nom}.jpg`);
      await deps.telecharger(demande.entrees[nom], chemin, contexte.signal);
      pages.push(await readFile(chemin));
      contexte.progression(Math.round(((k + 1) / noms.length) * 70));
    }
    let pdf: Buffer;
    try {
      pdf = ecrirePdf({ titre, pages });
    } catch (e) {
      throw refus(e instanceof Error ? e.message : "Assemblage impossible");
    }
    const sortie = join(contexte.dossier, "carrousel.pdf");
    await writeFile(sortie, pdf);
    await deps.deposer(demande.sortie.urlDepot, sortie, "application/pdf", contexte.signal);
    return { mesures: { pages: pages.length, octets: pdf.length } };
  };
}

/** Un JPEG de page (×2, qualité 88) pèse quelques centaines de Ko : 3 Mo au plus par page. */
const OCTETS_MAX_PAGE = 3 * 1024 * 1024;

export const assemblagePdf: Operation = creerAssemblagePdf({
  telecharger: (url, chemin, signal) => telecharger(url, chemin, signal, OCTETS_MAX_PAGE),
  deposer,
});
