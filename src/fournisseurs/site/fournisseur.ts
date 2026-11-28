/**
 * Fournisseur « site » construit sur un TRANSPORT (plan § 7) : signe chaque appel, le porte, traduit la réponse en
 * résultat ou en erreur claire (401, 409, 410, 422, 5xx, site injoignable). Même code pour le site factice (simulation)
 * et pour le vrai client HTTP (lot S4) : seule la façon de porter la requête change.
 */
import { VERSION_CONTRAT, type CorpsPasseport } from "@/domaine/site-videos/contrat";
import type { ReglagesDuSite } from "@/domaine/site-videos/reglages-site";
import type { CapacitesFournisseur, ModeFournisseur } from "../types";
import { signerAppel } from "./signature";
import { ErreurSite, type FournisseurSite, type MotifRetrait, type ReponsePublication, type ReponseRetrait, type ReponseSite, type TransportSite } from "./types";

export const CHEMIN_REGLAGES = "/api/interne/reglages-publics";
export const CHEMIN_VIDEOS = "/api/interne/videos";
/** Le site retire par un DELETE sur la même route que la publication, avec un corps (pas d'identifiant dans l'adresse). */
export const CHEMIN_RETRAIT = CHEMIN_VIDEOS;
/** Version du contrat du site (champ `schemaVersion` des corps de retrait). */
const VERSION_CORPS_SITE = 1;

const CAPACITES: CapacitesFournisseur = { asynchrone: false, accordExige: false };

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";
const bool = (x: unknown): boolean | null => (typeof x === "boolean" ? x : null);

const texteDe = (x: unknown): string[] => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : []);

/** Traduit une réponse du site qui n'est pas un succès en erreur claire (une phrase, vouvoiement). */
export function erreurDepuisReponse(r: ReponseSite): ErreurSite {
  const corps = estObjet(r.corps) ? r.corps : {};
  // Le site range les champs en faute dans `champs` ; `erreurs` reste lu (ancien format).
  const erreurs = [...texteDe(corps.champs), ...texteDe(corps.erreurs)];
  const code = typeof corps.erreur === "string" ? corps.erreur : "";
  if (r.statut === 401) return new ErreurSite("signature", "Le site a refusé la signature de l'envoi : le secret partagé n'est pas le bon.", 401);
  if (r.statut === 409) {
    if (code === "video_retiree") return new ErreurSite("retiree", "Cette vidéo a été retirée du site : le retrait est définitif, elle ne peut pas y revenir.", 409);
    if (code === "slug_deja_pris" || code === "slug_immuable") return new ErreurSite("conflit", "L'adresse de cette page n'est pas disponible ou ne peut plus changer sur le site.", 409);
    if (code === "version_deja_publiee") return new ErreurSite("conflit", "Le site a déjà cette même version avec un contenu différent : changez le numéro de version.", 409);
    if (code === "nonce_reutilise") return new ErreurSite("conflit", "Le site a refusé l'envoi (appel déjà vu) : réessayez.", 409);
    return new ErreurSite("conflit", "Le site a déjà une version plus récente de cette vidéo.", 409);
  }
  if (r.statut === 410) return new ErreurSite("retiree", "Cette page a été retirée du site.", 410);
  if (r.statut === 422) return new ErreurSite("invalide", `Le site refuse cette page${erreurs.length ? ` : ${erreurs.join(" ; ")}` : "."}`, 422, erreurs);
  if (r.statut === 503 && code === "reception_eteinte") return new ErreurSite("eteinte", "La réception des vidéos est éteinte sur le site : rien n'a été envoyé.", 503);
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
      // Le site répond 201 à la première publication, 200 sinon ; la version est `version`, le rejeu est `rejeu`.
      if ((r.statut !== 200 && r.statut !== 201) || !estObjet(r.corps)) throw erreurDepuisReponse(r);
      const c = r.corps;
      const version = typeof c.version === "number" ? c.version : c.versionPasseport;
      if (c.statut !== "publiee" || typeof c.slug !== "string" || typeof c.url !== "string" || typeof version !== "number") {
        throw new ErreurSite("serveur", "La réponse du site est illisible : vérifiez sur le site.", r.statut);
      }
      return { statut: "publiee", slug: c.slug, url: c.url, versionPasseport: version, inchange: c.rejeu === true || c.inchange === true };
    },

    async retirer(idStudio: string, motif: MotifRetrait = "obsolete"): Promise<ReponseRetrait> {
      const r = await appeler("DELETE", CHEMIN_RETRAIT, { schemaVersion: VERSION_CORPS_SITE, studioVideoId: idStudio, motif });
      if (r.statut === 404) {
        // Seul le corps « video_inconnue » veut dire « vidéo inconnue » ; une route absente n'est jamais un succès.
        if (estObjet(r.corps) && r.corps.erreur === "video_inconnue") return { statut: "inconnue" };
        throw new ErreurSite("route-absente", "Le site ne connaît pas cette adresse de retrait : rien n'a été retiré, vérifiez le branchement.", 404);
      }
      if (r.statut !== 200) throw erreurDepuisReponse(r);
      // Un 200 sans le corps du site (page de proxy, corps vide) n'est pas un retrait prouvé.
      if (!estObjet(r.corps) || r.corps.ok !== true || r.corps.statut !== "retiree") throw new ErreurSite("serveur", "La réponse du site au retrait est illisible : vérifiez sur le site.", r.statut);
      return { statut: "retiree" };
    },
  };
}

export { VERSION_CONTRAT };
