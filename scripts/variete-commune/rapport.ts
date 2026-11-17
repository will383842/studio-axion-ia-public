// RAPPORT « MESURE SEULE » DE LA VARIÉTÉ COMMUNE (E2, fiche X2-09). Lancé À LA MAIN par la session de mise en ligne,
// jamais planifié, rien ne l'importe. LECTURE SEULE : aucune écriture en base ni en stockage, ne lit aucun réglage,
// aucun appel payant.
//
// Usage (tsx ; « server-only » demande la condition react-server) :
//   tsx --conditions=react-server scripts/variete-commune/rapport.ts
//
// Pour chaque réseau : les 30 dernières vidéos publiées ou programmées (`voisinesDuReseau` compte aussi les vidéos
// « programmee » et ignore celles sans empreinte : ce sont donc les 30 dernières programmées/publiées AYANT une
// empreinte) ; pour chacune, le score de ressemblance maximal avec ses
// 10 voisines précédentes (plus anciennes), la voisine en cause et les axes communs.
import type { EmpreinteVideo } from "../../src/briques/variete-commune/types";
import { SEUIL_COMMUN, ressemblance } from "../../src/briques/variete-commune/ressemblance";

export const NB_VIDEOS = 30;
export const NB_VOISINES = 10;

export interface EntreeReseau {
  reseau: string;
  /** Empreintes du réseau, de la plus récente à la plus ancienne. */
  videos: readonly EmpreinteVideo[];
}

const ENTETE = ["Date", "Réseau", "Générateur", "Score", "Trop proche", "Voisine", "Axes communs"];
const cellule = (s: string) => s.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ");
const ligne = (c: string[]) => `| ${c.map(cellule).join(" | ")} |`;

/** Fonction pure : même entrée, même sortie. Ne modifie pas ses entrées. */
export function construireRapport(entrees: readonly EntreeReseau[]): string {
  const lignes = [ligne(ENTETE), ligne(ENTETE.map(() => "---"))];
  for (const { reseau, videos } of entrees) {
    if (videos.length === 0) {
      lignes.push(ligne(["—", reseau, "—", "—", "—", "—", "aucune vidéo"]));
      continue;
    }
    const recentes = [...videos].sort((a, b) => (a.le < b.le ? 1 : a.le > b.le ? -1 : a.videoId < b.videoId ? -1 : a.videoId > b.videoId ? 1 : 0));
    recentes.slice(0, NB_VIDEOS).forEach((v, i) => {
      let meilleur: { score: number; voisine: string; axes: string[] } | null = null;
      for (const w of recentes.slice(i + 1, i + 1 + NB_VOISINES)) {
        const r = ressemblance(v, w);
        if (r.score !== null && (!meilleur || r.score > meilleur.score)) meilleur = { score: r.score, voisine: w.videoId, axes: r.axesCommuns };
      }
      if (!meilleur) {
        lignes.push(ligne([v.le.slice(0, 10), reseau, v.formatId, "—", "—", "—", "aucun score (voisines absentes ou trop peu d'axes)"]));
        return;
      }
      lignes.push(ligne([v.le.slice(0, 10), reseau, v.formatId, `${Math.round(meilleur.score * 100)} %`, meilleur.score >= SEUIL_COMMUN ? "oui" : "non", meilleur.voisine, meilleur.axes.join(", ") || "aucun"]));
    });
  }
  return lignes.join("\n") + "\n";
}

/** Point d'entrée : lecture par les fonctions existantes, écriture sur la sortie standard seulement. */
export async function principal(): Promise<void> {
  const { RESEAUX } = await import("../../src/reseaux");
  const { voisinesDuReseau } = await import("../../src/services/variete-commune/voisines");
  const entrees: EntreeReseau[] = [];
  for (const r of RESEAUX) entrees.push({ reseau: r.id, videos: await voisinesDuReseau({ reseau: r.id, fenetre: NB_VIDEOS + NB_VOISINES }) });
  process.stdout.write(construireRapport(entrees));
}

if (process.argv[1] && /variete-commune[\\/]rapport\.ts$/.test(process.argv[1])) {
  principal().catch((e) => {
    console.error("[rapport variété commune]", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
