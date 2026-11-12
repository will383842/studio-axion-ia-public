import { GroupeFiltres, PuceLien } from "@/components/ui/PanneauFiltres";
import { NON_PRECISE, classerContenus, type CleClassement } from "@/domaine/classement-contenus";
import type { ContenuBibliotheque, FiltresContenus as Filtres } from "@/domaine/filtres-contenus";
import { estIdReseau } from "@/domaine/reseaux-video";
import { STATUTS_COMMUNS, TYPES_CONTENU, libelleStatutCommun, type StatutCommun, type TypeContenu } from "@/domaine/taxonomie-contenu";
import { listerReseaux, obtenirReseau } from "@/reseaux";

/**
 * Filtres de l'écran /contenus : type (les 3 familles), réseau, statut. Tout est dans l'adresse (liens, aucun état caché) :
 * le partage et le rechargement rouvrent la même vue. Composant serveur ; une valeur inconnue de l'adresse est ignorée.
 */
export const BASE_CONTENUS = "/contenus";
export const PAGE_MAX = 1_000_000;

export type ParametresContenus = Record<string, string | string[] | undefined>;
export interface FiltresLus extends Filtres {
  page: number;
}

export const PLURIEL_TYPE: Readonly<Record<TypeContenu, string>> = { video: "Vidéos", image: "Images", carrousel: "Carrousels" };

const premier = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function lireFiltresContenus(sp: ParametresContenus): FiltresLus {
  const type = premier(sp.type);
  const reseau = premier(sp.reseau);
  const statut = premier(sp.statut);
  const brut = Number(premier(sp.page));
  const page = Number.isFinite(brut) ? Math.min(PAGE_MAX, Math.max(1, Math.floor(brut))) : brut === Infinity ? PAGE_MAX : 1;
  const f: FiltresLus = { page };
  if (type && (TYPES_CONTENU as readonly string[]).includes(type)) f.type = type as TypeContenu;
  if (reseau && (reseau === NON_PRECISE || estIdReseau(reseau))) f.reseau = reseau as CleClassement;
  if (statut && (STATUTS_COMMUNS as readonly string[]).includes(statut)) f.statut = statut as StatutCommun;
  return f;
}

/** Adresse avec un changement ; `undefined` retire le paramètre. Les autres paramètres sont gardés ; changer un filtre revient à la page 1. */
export function lienContenus(params: ParametresContenus, changement: { type?: string; reseau?: string; statut?: string; page?: string }): string {
  const q = new URLSearchParams();
  const touchePage = "page" in changement;
  const change = Object.keys(changement).some((k) => k !== "page");
  for (const [cle, valeur] of Object.entries(params)) {
    const v = premier(valeur);
    if (!v || cle in changement || (cle === "page" && (change || touchePage))) continue;
    q.set(cle, v);
  }
  for (const [cle, valeur] of Object.entries(changement)) if (valeur) q.set(cle, valeur);
  const s = q.toString();
  return s ? `${BASE_CONTENUS}?${s}` : BASE_CONTENUS;
}

export interface ComptesContenus {
  types: Record<TypeContenu, number>;
  reseaux: { cle: CleClassement; nombre: number }[];
  statuts: { statut: StatutCommun; nombre: number }[];
}

/** Compteurs des puces : les 3 types toujours là ; réseaux et statuts seulement s'ils ont au moins un contenu. */
export function compterContenus(contenus: readonly ContenuBibliotheque[]): ComptesContenus {
  const types: Record<TypeContenu, number> = { video: 0, image: 0, carrousel: 0 };
  for (const c of contenus) types[c.type]++;
  const { parReseau } = classerContenus(contenus);
  const ordre: CleClassement[] = [...listerReseaux().map((r) => r.id), NON_PRECISE];
  const reseaux = ordre.flatMap((cle) => (parReseau[cle] ? [{ cle, nombre: parReseau[cle] as number }] : []));
  const statuts = STATUTS_COMMUNS.flatMap((statut) => {
    const nombre = contenus.filter((c) => c.statut === statut).length;
    return nombre > 0 ? [{ statut, nombre }] : [];
  });
  return { types, reseaux, statuts };
}

export const libelleReseauContenu = (cle: CleClassement): string => (cle === NON_PRECISE ? "Non précisé" : obtenirReseau(cle).nom);

const Nombre = ({ n }: { n: number }) => <span className="text-[11px] tabular-nums opacity-70">{n}</span>;

export function FiltresContenus({ params, filtres, comptes }: { params: ParametresContenus; filtres: Filtres; comptes: ComptesContenus }) {
  return (
    <div className="flex flex-col gap-4" data-testid="filtres-contenus">
      <GroupeFiltres titre="Type">
        <PuceLien href={lienContenus(params, { type: undefined })} actif={!filtres.type}>
          Tous
        </PuceLien>
        {TYPES_CONTENU.map((t) => (
          <PuceLien key={t} href={lienContenus(params, { type: t })} actif={filtres.type === t}>
            {PLURIEL_TYPE[t]}
            <Nombre n={comptes.types[t]} />
          </PuceLien>
        ))}
      </GroupeFiltres>
      {(comptes.reseaux.length > 0 || filtres.reseau) && (
        <GroupeFiltres titre="Réseau">
          <PuceLien href={lienContenus(params, { reseau: undefined })} actif={!filtres.reseau}>
            Tous
          </PuceLien>
          {comptes.reseaux.map(({ cle, nombre }) => (
            <PuceLien key={cle} href={lienContenus(params, { reseau: cle })} actif={filtres.reseau === cle}>
              {libelleReseauContenu(cle)}
              <Nombre n={nombre} />
            </PuceLien>
          ))}
        </GroupeFiltres>
      )}
      {(comptes.statuts.length > 0 || filtres.statut) && (
        <GroupeFiltres titre="Étape">
          <PuceLien href={lienContenus(params, { statut: undefined })} actif={!filtres.statut}>
            Toutes
          </PuceLien>
          {comptes.statuts.map(({ statut, nombre }) => (
            <PuceLien key={statut} href={lienContenus(params, { statut })} actif={filtres.statut === statut}>
              {libelleStatutCommun(statut)}
              <Nombre n={nombre} />
            </PuceLien>
          ))}
        </GroupeFiltres>
      )}
    </div>
  );
}
