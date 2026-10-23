/**
 * LE SITE FACTICE (plan § 7.6) : un faux site en mémoire qui vérifie la signature, l'horodatage et le nonce EXACTEMENT
 * comme le vrai (§ 7.2, même fonction que le client), garde les pages, compte les appels et peut tomber en panne.
 * Ses adresses sont en `.invalid` : impossibles à joindre par erreur. Aucun octet ne quitte le processus.
 */
import { VERSION_CONTRAT, type CorpsPasseport } from "@/domaine/site-videos/contrat";
import { CHEMIN_REGLAGES, CHEMIN_VIDEOS, fournisseurSiteDepuisTransport } from "./fournisseur";
import { ENTETE_HORODATAGE, ENTETE_NONCE, ENTETE_SIGNATURE, MEMOIRE_NONCE_MS, TOLERANCE_HORODATAGE_SEC, signatureValide } from "./signature";
import type { FournisseurSite, OptionsObjetPublic, RequeteSignee, ReponseSite, StockagePublic } from "./types";

export const ADRESSE_SITE_FACTICE = "https://site-factice.invalid";

export interface PageFactice {
  idStudio: string;
  slug: string;
  version: number;
  statut: "publiee" | "retiree";
  cree: string;
  modifieLe: string;
  corps: CorpsPasseport;
}

export type PanneSiteFactice = "injoignable" | "500" | "lent" | null;

export interface SiteFactice {
  /** Secret partagé (celui que le client réel aura aussi) et horloge, pour construire un fournisseur qui lui parle. */
  readonly secret: string;
  readonly maintenant: () => number;
  /** Réglages du site, modifiables par le test (défaut : tout faux). */
  reglages: { certifexempleCertificationObtenue: boolean; avisPublies: boolean };
  panne: PanneSiteFactice;
  appels: { reglages: number; publier: number; retirer: number };
  pages: Map<string, PageFactice>;
  /** Traite une requête déjà signée. Lève si le site est « injoignable » ou « lent ». */
  traiter(requete: RequeteSignee): Promise<ReponseSite>;
  /** Comme `fetch`, pour tester le vrai client sans réseau. */
  fetch(url: string | URL | Request, init?: RequestInit): Promise<Response>;
  /** Code HTTP qu'aurait la page publique : 200, 410 (retirée) ou 404 (inconnue). */
  statutPage(idStudio: string): 200 | 404 | 410;
}

export function creerSiteFactice(options: { secret: string; maintenant?: () => number; adresse?: string }): SiteFactice {
  const maintenant = options.maintenant ?? (() => Date.now());
  const adresse = options.adresse ?? ADRESSE_SITE_FACTICE;
  const nonces = new Map<string, number>();
  const pages = new Map<string, PageFactice>();
  const reglages = { certifexempleCertificationObtenue: false, avisPublies: false };

  const rep = (statut: number, corps: unknown): ReponseSite => ({ statut, corps });

  function verifier(r: RequeteSignee): ReponseSite | null {
    const e = r.entetes;
    const horodatage = e[ENTETE_HORODATAGE] ?? "";
    const nonce = e[ENTETE_NONCE] ?? "";
    const signature = e[ENTETE_SIGNATURE] ?? "";
    const refus = rep(401, { erreur: "signature refusée" });
    const t = Number(horodatage);
    if (!Number.isFinite(t) || Math.abs(maintenant() / 1000 - t) > TOLERANCE_HORODATAGE_SEC) return refus;
    for (const [n, vu] of nonces) if (maintenant() - vu > MEMOIRE_NONCE_MS) nonces.delete(n);
    if (!nonce || nonces.has(nonce)) return refus;
    if (!signature || !signatureValide(options.secret, { methode: r.methode, chemin: r.chemin, corps: r.corps, horodatage, nonce, signature })) return refus;
    nonces.set(nonce, maintenant());
    return null;
  }

  function erreursDuCorps(c: Partial<CorpsPasseport>): string[] {
    const erreurs: string[] = [];
    if (c.versionContrat !== VERSION_CONTRAT) erreurs.push("versionContrat inconnue");
    if (!c.idStudio || typeof c.idStudio !== "string") erreurs.push("idStudio manquant");
    if (!Number.isInteger(c.versionPasseport) || (c.versionPasseport ?? 0) < 1) erreurs.push("versionPasseport invalide");
    if (!c.titre || c.titre.length > 60) erreurs.push("titre : 1 à 60 caractères");
    if (!c.resume) erreurs.push("resume manquant");
    for (const k of ["urlVideo", "urlVignette", "urlVtt"] as const) if (!c[k]) erreurs.push(`${k} manquante`);
    return erreurs;
  }

  function adresseUnique(propose: string, idStudio: string): string {
    const base = propose || "video";
    let slug = base;
    for (let n = 2; [...pages.values()].some((p) => p.slug === slug && p.idStudio !== idStudio); n++) slug = `${base}-${n}`;
    return slug;
  }

  function publier(corpsTexte: string): ReponseSite {
    let c: Partial<CorpsPasseport>;
    try {
      c = JSON.parse(corpsTexte) as Partial<CorpsPasseport>;
    } catch {
      return rep(422, { erreurs: ["corps illisible"] });
    }
    const erreurs = erreursDuCorps(c);
    if (erreurs.length) return rep(422, { erreurs });
    const corps = c as CorpsPasseport;
    const existante = pages.get(corps.idStudio);
    const maintenantIso = new Date(maintenant()).toISOString();
    if (existante) {
      if (corps.versionPasseport < existante.version) return rep(409, { erreur: "version plus ancienne que celle du site" });
      const inchange = corps.versionPasseport === existante.version && existante.statut === "publiee";
      if (!inchange) {
        existante.statut = "publiee";
        if (corps.versionPasseport !== existante.version) existante.modifieLe = maintenantIso;
        existante.version = corps.versionPasseport;
        existante.corps = corps;
      }
      return rep(200, { statut: "publiee", slug: existante.slug, url: `${adresse}/fr/videos/${existante.slug}`, versionPasseport: existante.version, inchange });
    }
    // Le slug n'est fixé qu'à la PREMIÈRE publication.
    const slug = adresseUnique(corps.slugPropose, corps.idStudio);
    pages.set(corps.idStudio, { idStudio: corps.idStudio, slug, version: corps.versionPasseport, statut: "publiee", cree: maintenantIso, modifieLe: maintenantIso, corps });
    return rep(200, { statut: "publiee", slug, url: `${adresse}/fr/videos/${slug}`, versionPasseport: corps.versionPasseport, inchange: false });
  }

  function retirer(idStudio: string): ReponseSite {
    const page = pages.get(idStudio);
    if (!page) return rep(404, { erreur: "vidéo inconnue" });
    page.statut = "retiree";
    return rep(200, { statut: "retiree" });
  }

  const site: SiteFactice = {
    secret: options.secret,
    maintenant,
    reglages,
    panne: null,
    appels: { reglages: 0, publier: 0, retirer: 0 },
    pages,
    async traiter(r) {
      if (site.panne === "injoignable") throw new Error("site injoignable");
      if (site.panne === "lent") throw new Error("délai dépassé");
      if (site.panne === "500") return rep(500, { erreur: "souci du site" });
      const refus = verifier(r);
      if (refus) return refus;
      if (r.methode === "GET" && r.chemin === CHEMIN_REGLAGES) {
        site.appels.reglages++;
        return rep(200, { versionContrat: VERSION_CONTRAT, ...reglages });
      }
      if (r.methode === "POST" && r.chemin === CHEMIN_VIDEOS) {
        site.appels.publier++;
        return publier(r.corps);
      }
      if (r.methode === "DELETE" && r.chemin.startsWith(`${CHEMIN_VIDEOS}/`)) {
        site.appels.retirer++;
        return retirer(decodeURIComponent(r.chemin.slice(CHEMIN_VIDEOS.length + 1)));
      }
      return rep(404, { erreur: "point d'accès inconnu" });
    },
    async fetch(url, init) {
      const u = new URL(typeof url === "string" || url instanceof URL ? url : url.url);
      const methode = (init?.method ?? "GET").toUpperCase() as RequeteSignee["methode"];
      const entetes = Object.fromEntries(new Headers(init?.headers).entries());
      const signal = init?.signal ?? undefined;
      if (site.panne === "lent") {
        // Ne répond jamais : seul le délai du client y met fin.
        await new Promise<never>((_, rejeter) => {
          if (signal?.aborted) rejeter(signal.reason);
          signal?.addEventListener("abort", () => rejeter(signal.reason));
        });
      }
      const r = await site.traiter({ methode, chemin: u.pathname, corps: typeof init?.body === "string" ? init.body : "", entetes });
      return new Response(JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json" } });
    },
    statutPage(idStudio) {
      const p = pages.get(idStudio);
      return !p ? 404 : p.statut === "retiree" ? 410 : 200;
    },
  };
  return site;
}

/** Fournisseur « site » en simulation : parle au site factice donné, signature comprise (son secret, son horloge). */
export function creerFournisseurSiteSimulation(site: SiteFactice): FournisseurSite {
  return fournisseurSiteDepuisTransport({ id: "simulation", nom: "Site factice (essai)", reelPrevu: "Le site axion-ia.com", mode: "simulation", secret: site.secret, transport: (r) => site.traiter(r), maintenant: site.maintenant });
}

/* ------------------------------------------------------------------ */
/* Le site factice du processus (celui de la simulation du registre)    */
/* ------------------------------------------------------------------ */

/** Secret du site factice du processus : il n'ouvre rien, c'est une valeur d'essai. */
export const SECRET_SITE_FACTICE = "secret-du-site-factice-du-studio";

const cleSite = Symbol.for("studio-axion-ia.site-factice");
type AvecSite = typeof globalThis & { [cleSite]?: SiteFactice | null };

/** Essais seulement : remplace le site factice du processus. `null` : retour au site factice par défaut. */
export function injecterSiteFactice(site: SiteFactice | null): void {
  (globalThis as AvecSite)[cleSite] = site;
}

/** Le site factice du processus (créé à la demande). */
export function siteFacticeCourant(): SiteFactice {
  const g = globalThis as AvecSite;
  return (g[cleSite] ??= creerSiteFactice({ secret: SECRET_SITE_FACTICE }));
}

/** Fournisseur du registre : à chaque appel, parle au site factice COURANT. */
export const fournisseurSiteSimulation: FournisseurSite = {
  id: "simulation",
  type: "site",
  nom: "Site factice (essai)",
  reelPrevu: "Le site axion-ia.com",
  mode: "simulation",
  capacites: { asynchrone: false, accordExige: false },
  lireReglages: () => creerFournisseurSiteSimulation(siteFacticeCourant()).lireReglages(),
  publier: (corps) => creerFournisseurSiteSimulation(siteFacticeCourant()).publier(corps),
  retirer: (id) => creerFournisseurSiteSimulation(siteFacticeCourant()).retirer(id),
};

/* ------------------------------------------------------------------ */
/* Le stockage public factice (plan § 7.6) : en mémoire, rien ne sort   */
/* ------------------------------------------------------------------ */

export interface ObjetPublicFactice extends OptionsObjetPublic {
  cle: string;
  taille: number;
  /** Clé privée d'où le fichier a été copié (absente pour un texte déposé). */
  source?: string;
  /** Octets, quand le test les fournit (`lireSource`) ou pour un texte. */
  octets?: Uint8Array;
}

export interface StockagePublicFactice extends StockagePublic {
  objets: Map<string, ObjetPublicFactice>;
  /** Journal des gestes dans l'ordre : « copie:<clé> », « texte:<clé> », « efface:<clé> ». */
  journal: string[];
  /** Panne : la prochaine écriture lève. */
  panne: boolean;
}

/** Garde les objets en mémoire (clé, octets, type, `Cache-Control`). `lireSource` : donne les octets d'une clé privée. */
export function creerStockagePublicFactice(options: { lireSource?: (cle: string) => Promise<Uint8Array | undefined> } = {}): StockagePublicFactice {
  const objets = new Map<string, ObjetPublicFactice>();
  const stock: StockagePublicFactice = {
    objets,
    journal: [],
    panne: false,
    async copierDepuisPrive(source, cleCible, opts) {
      if (stock.panne) throw new Error("stockage public en panne");
      const octets = await options.lireSource?.(source.cle);
      objets.set(cleCible, { cle: cleCible, taille: octets?.length ?? source.taille, source: source.cle, ...(octets ? { octets } : {}), ...opts });
      stock.journal.push(`copie:${cleCible}`);
    },
    async deposerTexte(cleCible, texte, opts) {
      if (stock.panne) throw new Error("stockage public en panne");
      const octets = new TextEncoder().encode(texte);
      objets.set(cleCible, { cle: cleCible, taille: octets.length, octets, ...opts });
      stock.journal.push(`texte:${cleCible}`);
    },
    async existe(cle) {
      const o = objets.get(cle);
      return o ? { existe: true, taille: o.taille } : { existe: false };
    },
    async supprimer(cle) {
      objets.delete(cle);
      stock.journal.push(`efface:${cle}`);
    },
  };
  return stock;
}

const cleStockagePublic = Symbol.for("studio-axion-ia.stockage-public-factice");
type AvecStockage = typeof globalThis & { [cleStockagePublic]?: StockagePublicFactice | null };

/** Essais seulement : remplace le stockage public factice du processus. `null` : retour au stockage par défaut. */
export function injecterStockagePublicFactice(s: StockagePublicFactice | null): void {
  (globalThis as AvecStockage)[cleStockagePublic] = s;
}

/** Le stockage public factice du processus (créé à la demande) : la simulation n'envoie jamais un octet nulle part. */
export function stockagePublicFacticeCourant(): StockagePublicFactice {
  const g = globalThis as AvecStockage;
  return (g[cleStockagePublic] ??= creerStockagePublicFactice());
}
