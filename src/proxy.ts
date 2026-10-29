/**
 * Proxy (ex-middleware, Next 16) : protège TOUT sauf /connexion, /v/*, /api/sante,
 * /api/crochets/*, /api/usine/* (gardée par secret DANS chaque handler, src/usine/garde-porte.ts), /hors-ligne et les fichiers statiques (PLAN B.4-3).
 * ⚠️ Le proxy ne suffit pas : chaque action serveur et chaque route /api appelle
 * exigerSession() (révocation, expiration côté serveur).
 */
import { NextResponse, type NextRequest } from "next/server";
import { NOM_COOKIE_SESSION, verifierJeton } from "@/lib/jeton-session";

const PUBLICS = [/^\/connexion(\/|$)/, /^\/v\//, /^\/api\/sante$/, /^\/api\/crochets\//, /^\/api\/usine\//, /^\/api\/partages\/[^/]+$/, /^\/hors-ligne$/];

/** Code réservé : la page « Ce lien n'est plus actif » (rendue par /v/[code] pour un code inconnu). */
const CODE_LIEN_INACTIF = "lien-inactif";
/** Code réservé : la page « Lien introuvable » (un code qui n'a jamais existé → 404, E2E-1 n° 30). */
const CODE_LIEN_INTROUVABLE = "lien-introuvable";

/**
 * Lien privé expiré, révoqué ou inconnu → 410 Gone avec la page soignée (B.8 #10).
 * Une page Next ne peut pas fixer son statut : le proxy demande l'état du lien à
 * /api/partages/[code], puis renvoie la page « lien inactif » avec le statut 410.
 * Seulement pour les navigations (pas pour les requêtes RSC internes).
 */
async function lienPrive(requete: NextRequest, code: string): Promise<NextResponse> {
  if (code === CODE_LIEN_INACTIF || code === CODE_LIEN_INTROUVABLE || requete.method !== "GET" || requete.headers.get("rsc")) return NextResponse.next();
  const origine = requete.nextUrl.origin;
  try {
    const etat = await fetch(`${origine}/api/partages/${encodeURIComponent(code)}`, { cache: "no-store" });
    const { actif, introuvable } = (await etat.json()) as { actif?: boolean; introuvable?: boolean };
    if (actif) return NextResponse.next();
    // Révoqué ou expiré : 410 « n'est plus actif ». Jamais existé : 404 « introuvable ».
    const page = await fetch(`${origine}/v/${introuvable ? CODE_LIEN_INTROUVABLE : CODE_LIEN_INACTIF}`, { cache: "no-store", headers: { accept: "text/html" } });
    return new NextResponse(page.body, {
      status: introuvable ? 404 : 410,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" },
    });
  } catch {
    // En cas de doute, la page elle-même refusera le lien (404 soigné).
    return NextResponse.next();
  }
}

/**
 * Fiches à adresse variable (E2E-1 n° 23). « /videos/a-ranger » est une vraie page, pas une fiche.
 * E2E-2 parcours n° 26 : les sujets (/ecrire/sujets/[id]) aussi ; le type demandé à /api/fiches est alors « sujets ».
 * Vérif V3 : « /bibliotheque/animations » (Mes animations) aussi est une vraie page — sinon 404 au chargement direct.
 */
const FICHE = /^\/(videos|personnages|scripts|formats|bibliotheque|ecrire\/sujets)\/([^/]+)\/?$/;
const PAGES_FIXES = new Set(["videos/a-ranger", "bibliotheque/animations"]);

/**
 * Adresse → fiche à vérifier (type de /api/fiches et identifiant). VERIF-E2E-2, gêne 3 : aussi /nouvelle/[format],
 * /ecrire/tournage/[id] et /ecrire/sujets/[id]/lire/[variante] (« sujet|variante »). null : rien à vérifier.
 */
export function ficheDeChemin(pathname: string): { type: string; id: string } | null {
  const lecture = /^\/ecrire\/sujets\/([^/]+)\/lire\/([^/]+)\/?$/.exec(pathname);
  if (lecture) {
    const [sujet, variante] = [decoderSansErreur(lecture[1]), decoderSansErreur(lecture[2])];
    return sujet !== null && variante !== null ? { type: "lectures", id: `${sujet}|${variante}` } : null;
  }
  const autre = /^\/(nouvelle|ecrire\/tournage)\/([^/]+)\/?$/.exec(pathname);
  const fiche = autre ?? FICHE.exec(pathname);
  if (!fiche) return null;
  const id = decoderSansErreur(fiche[2]);
  if (id === null || PAGES_FIXES.has(`${fiche[1]}/${id}`)) return null;
  const type = fiche[1] === "ecrire/sujets" ? "sujets" : fiche[1] === "ecrire/tournage" ? "seances" : fiche[1];
  return { type, id };
}
const ENTETE_INTROUVABLE = "x-studio-introuvable";

/**
 * Fiche inconnue → vrai 404 (E2E-1 n° 23). La page s'affiche en flux (chargement d'abord) : une fois commencée, elle
 * répond 200 même quand elle finit sur « Cette page n'existe pas ». Le proxy demande donc d'abord si la fiche existe
 * (/api/fiches/…), puis, si elle n'existe pas, renvoie cette même page soignée avec le statut 404.
 * Seulement pour les navigations (pas pour les requêtes RSC internes). En cas de doute : la page normale.
 */
async function ficheConnue(requete: NextRequest, type: string, id: string): Promise<NextResponse | null> {
  if (requete.method !== "GET" || requete.headers.get("rsc") || requete.headers.get(ENTETE_INTROUVABLE)) return null;
  const origine = requete.nextUrl.origin;
  const cookie = requete.headers.get("cookie") ?? "";
  try {
    const etat = await fetch(`${origine}/api/fiches/${type}/${encodeURIComponent(id)}`, { cache: "no-store", headers: { cookie } });
    const { existe } = (await etat.json()) as { existe?: boolean };
    if (existe !== false) return null;
    return await pageIntrouvable(requete, cookie);
  } catch {
    return null;
  }
}

/** La page demandée, rendue (« Cette page n'existe pas »), renvoyée avec le statut 404. */
async function pageIntrouvable(requete: NextRequest, cookie: string): Promise<NextResponse> {
  const page = await fetch(`${requete.nextUrl.origin}${requete.nextUrl.pathname}`, { cache: "no-store", headers: { cookie, accept: "text/html", [ENTETE_INTROUVABLE]: "1" } });
  return new NextResponse(page.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}

/**
 * Pages réservées au développement (maquettes du générateur, vitrine des composants). E2E-2 données n° 9 : en
 * production elles affichaient « Cette page n'existe pas » avec le statut 200 (la page part en flux avant `notFound()`).
 */
const FERMEES_EN_PRODUCTION = /^\/(maquettes-generateur|styleguide)(\/|$)/;

export function fermeeEnProduction(pathname: string, env: { NODE_ENV?: string } = process.env): boolean {
  return env.NODE_ENV === "production" && FERMEES_EN_PRODUCTION.test(pathname);
}

/** Une adresse mal formée (« %E0%A4% ») ne doit jamais faire tomber le proxy : la page normale répond. */
function decoderSansErreur(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export async function proxy(requete: NextRequest) {
  const { pathname, search } = requete.nextUrl;
  const partage = /^\/v\/([^/]+)\/?$/.exec(pathname);
  if (partage) return lienPrive(requete, partage[1]);
  if (PUBLICS.some((r) => r.test(pathname))) return NextResponse.next();

  const contenu = await verifierJeton(requete.cookies.get(NOM_COOKIE_SESSION)?.value);
  if (contenu) {
    if (fermeeEnProduction(pathname)) {
      // Navigation : la page soignée avec un vrai 404. Requête interne (RSC, ou la page elle-même) : elle suit son cours
      // et finit sur `notFound()`.
      if (requete.method !== "GET" || requete.headers.get("rsc") || requete.headers.get(ENTETE_INTROUVABLE)) return NextResponse.next();
      try {
        return await pageIntrouvable(requete, requete.headers.get("cookie") ?? "");
      } catch {
        return new NextResponse("Cette page n'existe pas.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    const fiche = ficheDeChemin(pathname);
    return (fiche && (await ficheConnue(requete, fiche.type, fiche.id))) || NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  }
  const url = requete.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = pathname !== "/" ? `?suite=${encodeURIComponent(pathname + search)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques de Next, les médias publics de démonstration (`/demo/`), les icônes et les
    // fichiers du manifeste, NOMMÉS un par un. Vérification E2E-1 (03/10) : l'ancienne exception « toute adresse
    // finissant par .mp4, .png, .txt… » laissait passer `/ecrire/sujets/x.mp4` sans connexion (seule la page refusait
    // encore) et ouvrait `/essais/…` à tous : elle est retirée.
    "/((?!_next/static/|_next/image|demo/|icones/|favicon\\.ico$|robots\\.txt$|manifest\\.webmanifest$|sw\\.js$).*)",
  ],
};
