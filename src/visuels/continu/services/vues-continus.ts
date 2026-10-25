import { joursRestants } from "@/domaine/corbeille";
import type { ActionCarrousel, NiveauControle, RapportPorte } from "@/domaine/visuels/contrats";
import { nomFichierPdf } from "@/domaine/visuels/depot";
import { LIBELLES_STATUT } from "@/domaine/visuels/statuts";
import { LIBELLES_MOTIF, type ModeTexte, type Visuel } from "@/domaine/visuels/visuel";
import type { StatutVisuel } from "@/domaine/visuels/statuts";
import { ErreurVisuel } from "@/visuels/services/carrousels";
import { actionsPermises, renduRecent, type VueListe } from "@/visuels/services/vues";
import { lireToile, PHRASE_TOILE, type DependancesContinus } from "./carrousels-continus";

/** Vues de lecture des carrousels continus : cartes de la liste, fiche, texte du post et contenu du ZIP. URL de lecture par `urlLecture`, jamais en dur. */

export type DependancesVuesContinus = Pick<DependancesContinus, "depot" | "urlLecture" | "urlTelechargement" | "allume" | "maintenant">;

export interface VueToileCarte {
  id: string;
  titre: string;
  statut: StatutVisuel;
  libelleStatut: string;
  verdict?: NiveauControle;
  nbPages: number;
  format?: "4:5" | "3:4";
  vignetteUrl?: string;
  modifieLe: string;
  joursRestantsCorbeille?: number;
}

export interface VueToileFiche extends VueToileCarte {
  modeTexte: ModeTexte;
  pourquoi: string[];
  rapport?: RapportPorte;
  pages: { index: number; type: string; alt: string; url?: string }[];
  bandeUrl?: string;
  zipUrl?: string;
  textePost: string;
  erreur?: string;
  entree: "sujet" | "session";
  renduEnCours: boolean;
  noteTexte?: string;
  refus: { motif: string; libelleMotif: string; page?: number; commentaire?: string; le: string }[];
  actionsPermises: ActionCarrousel[];
  generateurAllume: boolean;
}

const filtres: Record<VueListe, (v: Visuel) => boolean> = {
  tous: (v) => !v.corbeilleLe,
  a_valider: (v) => !v.corbeilleLe && v.statut === "a_valider",
  valides: (v) => !v.corbeilleLe && v.statut === "valide",
  corbeille: (v) => !!v.corbeilleLe,
};

const estContinu = (v: Visuel) => v.famille === "carrousel-continu";

/** Texte du post. BOUCHON P7 : le titre ; le vrai texte (et son texte alternatif) vient du lot P7. */
export const texteDuPost = (v: Visuel): string => v.titre;

const nomPage = (i: number) => `page-${String(i + 1).padStart(2, "0")}.jpg`;
const sansSautDeLigne = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();

async function carte(v: Visuel, deps: DependancesVuesContinus): Promise<VueToileCarte> {
  return {
    id: v.id,
    titre: v.titre,
    statut: v.statut,
    libelleStatut: LIBELLES_STATUT[v.statut],
    ...(v.rapport ? { verdict: v.rapport.verdict } : {}),
    nbPages: v.toile?.pages.length ?? 0,
    ...(v.renduToile ? { format: v.renduToile.format, vignetteUrl: await deps.urlLecture(v.renduToile.vignetteCle) } : v.toile ? { format: v.toile.format } : {}),
    modifieLe: v.modifieLe,
    ...(v.corbeilleLe ? { joursRestantsCorbeille: joursRestants(v.corbeilleLe, Date.parse(deps.maintenant())) } : {}),
  };
}

export async function listerToiles(vue: VueListe, deps: DependancesVuesContinus): Promise<VueToileCarte[]> {
  const visuels = (await deps.depot.lister((v) => estContinu(v) && filtres[vue](v))).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return Promise.all(visuels.map((v) => carte(v, deps)));
}

/** Un rendu refusé pour une raison de mise en page (hors « mesure absente », qui se relance) ne passe pas en le relançant : « Refaire » (sujet) à la place. */
function actionsToile(v: Visuel, maintenantMs: number): ActionCarrousel[] {
  const actions = actionsPermises(v, maintenantMs);
  const erreur = v.erreur ?? "";
  if (v.corbeilleLe || v.statut !== "echec_rendu" || !PHRASE_TOILE.test(erreur) || /mesure[^\n]*absente/.test(erreur)) return actions;
  const sans = actions.filter((a) => a !== "relancer_rendu");
  if (v.entree.type !== "sujet" || sans.includes("refaire")) return sans;
  const avantCorbeille = sans.includes("corbeille") ? sans.indexOf("corbeille") : sans.length;
  return [...sans.slice(0, avantCorbeille), "refaire", ...sans.slice(avantCorbeille)];
}

export async function ficheToile(id: string, deps: DependancesVuesContinus): Promise<VueToileFiche> {
  const v = await lireToile(id, deps);
  const rendues = new Map((v.renduToile?.pages ?? []).map((p) => [p.index, p.cle]));
  const pages = await Promise.all(
    (v.toile?.pages ?? []).map(async (p, index) => ({ index, type: p.type, alt: p.alt, ...(rendues.has(index) ? { url: await deps.urlLecture(rendues.get(index)!) } : {}) })),
  );
  return {
    ...(await carte(v, deps)),
    modeTexte: v.modeTexte,
    pourquoi: v.pourquoi ?? [],
    ...(v.rapport ? { rapport: v.rapport } : {}),
    pages,
    ...(v.renduToile ? { bandeUrl: await deps.urlLecture(v.renduToile.bandeCle), zipUrl: `/api/carrousels-continus/${v.id}/zip` } : {}),
    textePost: texteDuPost(v),
    ...(v.erreur ? { erreur: v.erreur } : {}),
    entree: v.entree.type,
    renduEnCours: !v.corbeilleLe && renduRecent(v, Date.parse(deps.maintenant())),
    ...(v.noteTexte ? { noteTexte: v.noteTexte } : {}),
    refus: (v.refus ?? []).map((r) => ({ ...r, libelleMotif: LIBELLES_MOTIF[r.motif] })),
    actionsPermises: actionsToile(v, Date.parse(deps.maintenant())),
    generateurAllume: await deps.allume(),
  };
}

export const LISEZMOI_TOILE = "4:5 : Instagram et Facebook ; 3:4 : téléchargement seulement, l'API Instagram refuse un ratio sous 0,8\n";

export type EntreeZipToile = { nom: string; url: string } | { nom: string; contenu: string };

/** Contenu de l'archive : `page-01.jpg`…, `texte-du-post.txt`, `textes-alternatifs.txt` (une ligne par page), `LISEZMOI.txt`. */
export async function contenuZipToile(id: string, deps: Pick<DependancesContinus, "depot" | "urlLecture">): Promise<{ nom: string; entrees: EntreeZipToile[] }> {
  const v = await lireToile(id, deps);
  if (!v.renduToile || !v.toile) throw new ErreurVisuel("INTROUVABLE", "Ce carrousel n'a pas encore de pages rendues");
  const pages = await Promise.all(v.renduToile.pages.map(async (p) => ({ nom: nomPage(p.index), url: await deps.urlLecture(p.cle) })));
  return {
    nom: nomFichierPdf(v.titre).replace(/\.pdf$/, ".zip"),
    entrees: [
      ...pages,
      { nom: "texte-du-post.txt", contenu: `${texteDuPost(v)}\n` },
      { nom: "textes-alternatifs.txt", contenu: `${v.toile.pages.map((p) => sansSautDeLigne(p.alt)).join("\n")}\n` },
      { nom: "LISEZMOI.txt", contenu: LISEZMOI_TOILE },
    ],
  };
}
