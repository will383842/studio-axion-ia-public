/**
 * Fournisseur « site » construit sur un TRANSPORT (plan § 7) : signe chaque appel, le porte, traduit la réponse en
 * résultat ou en erreur claire (401, 409, 410, 422, 5xx, site injoignable). Même code pour le site factice (simulation)
 * et pour le vrai client HTTP (lot S4) : seule la façon de porter la requête change.
 */
import { VERSION_CONTRAT, type CorpsPasseport } from "@/domaine/site-videos/contrat";
import type { ReglagesDuSite } from "@/domaine/site-videos/reglages-site";
import type { CapacitesFournisseur, ModeFournisseur } from "../types";
import { signerAppel } from "./signature";
import { ErreurSite, type FournisseurSite, type ReponsePublication, type ReponseRetrait, type ReponseSite, type TransportSite } from "./types";

export const CHEMIN_REGLAGES = "/api/interne/videos/reglages";
export const CHEMIN_VIDEOS = "/api/interne/videos";

const CAPACITES: CapacitesFournisseur = { asynchrone: false, accordExige: false };

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";
const bool = (x: unknown): boolean | null => (typeof x === "boolean" ? x : null);

/** Traduit une réponse du site qui n'est pas un succès en erreur claire (une phrase, vouvoiement). */
export function erreurDepuisReponse(r: ReponseSite): ErreurSite {
  const erreurs = estObjet(r.corps) && Array.isArray(r.corps.erreurs) ? r.corps.erreurs.filter((e): e is string => typeof e === "string") : [];
  if (r.statut === 401) return new ErreurSite("signature", "Le site a refusé la signature de l'envoi : le secret partagé n'est pas le bon.", 401);
  if (r.statut === 409) return new ErreurSite("conflit", "Le site a déjà une version plus récente de cette vidéo.", 409);
  if (r.statut === 410) return new ErreurSite("retiree", "Cette page a été retirée du site.", 410);
  if (r.statut === 422) return new ErreurSite("invalide", `Le site refuse cette page${erreurs.length ? ` : ${erreurs.join(" ; ")}` : "."}`, 422, erreurs);
  return new ErreurSite("serveur", "Le site a eu un souci : réessayez dans quelques minutes.", r.statut);
}

export function fournisseurSiteDepuisTransport(e: {
  id: string;
  nom: string;
  reelPrevu: string;
  mode: ModeFournisseur;
  secret: string;
  transport: TransportSite;
  /** Millisecondes Unix. */
  maintenant: () => number;
}): FournisseurSite {
  async function appeler(methode: "GET" | "POST" | "DELETE", chemin: string, corps?: unknown): Promise<ReponseSite> {
    const texte = corps === undefined ? "" : JSON.stringify(corps);
    const entetes = signerAppel({ secret: e.secret, methode, chemin, corps: texte, horodatageSec: Math.floor(e.maintenant() / 1000) });
    try {
      return await e.transport({ methode, chemin, corps: texte, entetes });
    } catch (err) {
      if (err instanceof ErreurSite) throw err;
      throw new ErreurSite("injoignable", "Le site ne répond pas : réessayez dans quelques minutes.");
    }
  }

  return {
    id: e.id,
    type: "site",
    nom: e.nom,
    reelPrevu: e.reelPrevu,
    mode: e.mode,
    capacites: CAPACITES,

    async lireReglages(): Promise<ReglagesDuSite> {
      const r = await appeler("GET", CHEMIN_REGLAGES);
      if (r.statut !== 200 || !estObjet(r.corps)) throw erreurDepuisReponse(r);
      return { certifexempleCertificationObtenue: bool(r.corps.certifexempleCertificationObtenue), avisPublies: bool(r.corps.avisPublies) };
    },

    async publier(corps: CorpsPasseport): Promise<ReponsePublication> {
      const r = await appeler("POST", CHEMIN_VIDEOS, corps);
      if (r.statut !== 200 || !estObjet(r.corps)) throw erreurDepuisReponse(r);
      const c = r.corps;
      if (c.statut !== "publiee" || typeof c.slug !== "string" || typeof c.url !== "string" || typeof c.versionPasseport !== "number") {
        throw new ErreurSite("serveur", "La réponse du site est illisible : vérifiez sur le site.", r.statut);
      }
      return { statut: "publiee", slug: c.slug, url: c.url, versionPasseport: c.versionPasseport, inchange: c.inchange === true };
    },

    async retirer(idStudio: string): Promise<ReponseRetrait> {
      const r = await appeler("DELETE", `${CHEMIN_VIDEOS}/${encodeURIComponent(idStudio)}`);
      if (r.statut === 404) return { statut: "inconnue" };
      if (r.statut !== 200) throw erreurDepuisReponse(r);
      return { statut: "retiree" };
    },
  };
}

export { VERSION_CONTRAT };
