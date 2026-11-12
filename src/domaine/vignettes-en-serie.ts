/**
 * « Refaire toutes les vignettes » depuis la liste : un clic enchaîne les tours (20 vidéos par appel) jusqu'à
 * « restantes = 0 ». Rien n'est effacé (les anciennes vignettes sont gardées) : on peut relancer sans risque.
 * Arrêt propre : deux erreurs de suite, ou un compteur qui ne baisse plus après 2 tours.
 */
export type TourVignettes = { videos: number; erreurs: number; restantes: number };
export type ReponseTour = { ok: true; donnees: TourVignettes } | { ok: false; message: string };
export type BilanVignettes = { etat: "termine" | "erreur"; videos: number; erreurs: number; restantes: number; message?: string };
export type ProgresVignettes = { videos: number; erreurs: number; restantes: number };

const TOURS_SANS_BAISSE_MAX = 2;
const ERREURS_DE_SUITE_MAX = 2;
const TOURS_MAX = 50;

export async function enchainerVignettes(appel: () => Promise<ReponseTour>, surProgres: (p: ProgresVignettes) => void): Promise<BilanVignettes> {
  let videos = 0;
  let erreurs = 0;
  let restantes = Number.POSITIVE_INFINITY;
  let sansBaisse = 0;
  let erreursDeSuite = 0;
  for (let tour = 0; tour < TOURS_MAX; tour++) {
    const r = await appel().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur inattendue." }));
    if (!r.ok) {
      erreursDeSuite++;
      if (erreursDeSuite >= ERREURS_DE_SUITE_MAX) return { etat: "erreur", videos, erreurs, restantes: Number.isFinite(restantes) ? restantes : 0, message: r.message };
      continue;
    }
    erreursDeSuite = 0;
    videos += r.donnees.videos;
    erreurs += r.donnees.erreurs;
    sansBaisse = r.donnees.restantes < restantes ? 0 : sansBaisse + 1;
    restantes = r.donnees.restantes;
    surProgres({ videos, erreurs, restantes });
    if (restantes === 0) return { etat: "termine", videos, erreurs, restantes };
    if (sansBaisse >= TOURS_SANS_BAISSE_MAX) return { etat: "erreur", videos, erreurs, restantes, message: `Le compteur ne baisse plus : il en reste ${restantes}. Réessayez plus tard.` };
  }
  return { etat: "erreur", videos, erreurs, restantes, message: `Il en reste ${restantes} : relancez.` };
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

export const texteProgres = (p: ProgresVignettes) => `${pluriel(p.videos, "vidéo refaite", "vidéos refaites")}, il en reste ${p.restantes}…`;
export const texteFinal = (b: BilanVignettes) => `Vignettes refaites : ${pluriel(b.videos, "vidéo", "vidéos")}, ${b.erreurs} en échec`;
