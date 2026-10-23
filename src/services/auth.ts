/**
 * CONNEXION ET SESSIONS (PLAN B.4).
 * - Mot de passe seul, vérifié par argon2id. Empreinte en base (après un changement) PRIORITAIRE
 *   sur STUDIO_PASSWORD_HASH_B64 (base64 de l'empreinte). Le mot de passe n'est jamais stocké.
 * - 5 échecs en 15 min par IP → attente de 15 min. Temps de réponse constant.
 * - Cookie httpOnly, Secure en production, SameSite=Lax, signé HS256 ; 30 j ou 12 h.
 * - Sessions listables et révocables.
 */
import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { DUREE_COURTE_SEC, DUREE_LONGUE_SEC, NOM_COOKIE_SESSION, signerJeton, verifierJeton } from "@/lib/jeton-session";
import { depots, ecrireParametre, ErreurStudio, horodatage, journaliser, lireParametre, maintenant } from "./_commun";

const FENETRE_MS = 15 * 60 * 1000;
const ECHECS_MAX = 5;
const DUREE_REPONSE_MS = 800;
const CLE_EMPREINTE = "auth.empreinteB64";

async function attendre(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function empreinteActuelle(): Promise<string | null> {
  const enBase = await lireParametre<string | null>(CLE_EMPREINTE, null);
  const b64 = enBase ?? process.env.STUDIO_PASSWORD_HASH_B64;
  if (!b64) return null;
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * Adresse IP de la requête, pour la limite d'essais. Un en-tête envoyé par le navigateur ne doit
 * JAMAIS suffire à changer d'adresse (sinon la limite se contourne en changeant d'en-tête) :
 * - STUDIO_ENTETE_IP (ex. « cf-connecting-ip ») : à définir SEULEMENT si le serveur n'est joignable
 *   que par ce proxy de confiance (Cloudflare devant, port fermé ailleurs) ;
 * - sinon la DERNIÈRE valeur de x-forwarded-for, celle qu'ajoute le proxy le plus proche (Coolify),
 *   les valeurs précédentes pouvant venir du navigateur ;
 * - sinon x-real-ip, sinon « local ».
 */
export async function ipRequete(): Promise<string> {
  const h = await headers();
  const entete = process.env.STUDIO_ENTETE_IP?.trim().toLowerCase();
  if (entete) {
    const v = h.get(entete)?.split(",")[0]?.trim();
    if (v) return v;
  }
  const xff = h.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean);
  if (xff?.length) return xff[xff.length - 1];
  return h.get("x-real-ip") ?? "local";
}

/** Échecs toutes adresses confondues : au-delà, chaque essai ralentit, puis tout est bloqué 15 min. */
const ECHECS_GLOBAUX_RALENTIS = 20;
const ECHECS_GLOBAUX_MAX = 50;
const RALENTISSEMENT_MS = 4000;

async function echecsGlobaux(): Promise<number> {
  const depuis = Date.now() - FENETRE_MS;
  return depots().tentatives.compter((t) => !t.reussie && new Date(t.date).getTime() > depuis);
}

/** Heure de démarrage du processus : un jeton plus ancien dont la session n'est plus en mémoire est refusé. */
const cleDemarrage = Symbol.for("studio-axion-ia.demarrage");
function demarrageSec(): number {
  const g = globalThis as typeof globalThis & { [cleDemarrage]?: number };
  g[cleDemarrage] ??= Math.floor(Date.now() / 1000);
  return g[cleDemarrage];
}
demarrageSec();

async function appareilRequete(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Téléphone Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "PC Windows";
  return "Appareil inconnu";
}

/** Nombre d'échecs récents et fin du blocage éventuel. */
export async function etatLimitation(ip: string): Promise<{ bloque: boolean; finBlocage?: string; echecs: number }> {
  const depuis = Date.now() - FENETRE_MS;
  const echecs = (await depots().tentatives.lister((t) => t.ip === ip && !t.reussie && new Date(t.date).getTime() > depuis)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (echecs.length >= ECHECS_MAX) {
    const dernier = new Date(echecs[echecs.length - 1].date).getTime();
    return { bloque: true, finBlocage: new Date(dernier + FENETRE_MS).toISOString(), echecs: echecs.length };
  }
  return { bloque: false, echecs: echecs.length };
}

async function noterTentative(ip: string, reussie: boolean) {
  await depots().tentatives.enregistrer({ id: nouvelId("tc"), ip, reussie, date: maintenant(), ...horodatage() });
}

export type ResultatConnexion = { ok: true } | { ok: false; message: string; bloqueJusqua?: string };

/** Vérifie le mot de passe et ouvre la session (pose le cookie). À appeler depuis une action serveur. */
export async function seConnecter(motDePasse: string, resterConnecte: boolean): Promise<ResultatConnexion> {
  const debut = Date.now();
  const ip = await ipRequete();
  const limitation = await etatLimitation(ip);
  const globaux = await echecsGlobaux();
  const empreinte = await empreinteActuelle();
  const dureeReponse = globaux >= ECHECS_GLOBAUX_RALENTIS ? RALENTISSEMENT_MS : DUREE_REPONSE_MS;

  let correct = false;
  if (empreinte && motDePasse) {
    try {
      correct = await verify(empreinte, motDePasse);
    } catch {
      correct = false;
    }
  } else {
    // Même coût de calcul, même sans empreinte ou sans saisie.
    await hash("temps-constant", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }).catch(() => undefined);
  }

  if (limitation.bloque || globaux >= ECHECS_GLOBAUX_MAX) {
    await attendre(dureeReponse - (Date.now() - debut));
    return { ok: false, message: "Trop d'essais. Réessayez dans 15 minutes.", bloqueJusqua: limitation.finBlocage };
  }

  await noterTentative(ip, correct);
  if (!correct) {
    await attendre(dureeReponse - (Date.now() - debut));
    const restants = ECHECS_MAX - limitation.echecs - 1;
    if (!empreinte) return { ok: false, message: "La connexion n'est pas configurée sur ce serveur." };
    return {
      ok: false,
      message: restants > 0 ? "Mot de passe incorrect." : "Trop d'essais. Réessayez dans 15 minutes.",
    };
  }

  await ouvrirSession(resterConnecte, ip);
  await journaliser("connexion", `Connexion depuis ${await appareilRequete()}`);
  await attendre(DUREE_REPONSE_MS - (Date.now() - debut));
  return { ok: true };
}

async function ouvrirSession(resterConnecte: boolean, ip: string): Promise<void> {
  const duree = resterConnecte ? DUREE_LONGUE_SEC : DUREE_COURTE_SEC;
  const jti = nouvelId("ses");
  const expireLe = new Date(Date.now() + duree * 1000).toISOString();
  const session: Session = {
    id: jti,
    jti,
    appareil: await appareilRequete(),
    ip,
    resterConnecte,
    expireLe,
    derniereActivite: maintenant(),
    ...horodatage(),
  };
  await depots().sessions.enregistrer(session);
  const jeton = await signerJeton({ jti, rc: resterConnecte }, duree);
  (await cookies()).set(NOM_COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: duree,
  });
}

/** Session courante ou null (jeton valide + session non révoquée et non expirée). */
export async function lireSession(): Promise<Session | null> {
  const jeton = (await cookies()).get(NOM_COOKIE_SESSION)?.value;
  const contenu = await verifierJeton(jeton);
  if (!contenu) return null;
  const session = await depots().sessions.obtenir(contenu.jti);
  if (!session) {
    // Session inconnue. Un jeton émis AVANT le démarrage du processus est refusé : sa session a pu être
    // révoquée (déconnexion, changement de mot de passe) et la mémoire l'a oublié. Après un redémarrage,
    // il faut donc se reconnecter. Un jeton émis depuis (cas d'une autre instance) est accepté.
    if (!contenu.iat || contenu.iat < demarrageSec()) return null;
    const m = maintenant();
    const recreee: Session = {
      id: contenu.jti,
      jti: contenu.jti,
      appareil: await appareilRequete(),
      ip: await ipRequete(),
      resterConnecte: contenu.rc,
      expireLe: new Date(Date.now() + (contenu.rc ? DUREE_LONGUE_SEC : DUREE_COURTE_SEC) * 1000).toISOString(),
      derniereActivite: m,
      creeLe: m,
      modifieLe: m,
    };
    return depots().sessions.enregistrer(recreee);
  }
  if (session.revoqueeLe || new Date(session.expireLe) < new Date()) return null;
  return session;
}

/**
 * À APPELER EN PREMIÈRE LIGNE DE CHAQUE ACTION SERVEUR ET DE CHAQUE ROUTE /api.
 * Sans session valide : redirection vers /connexion.
 */
export async function exigerSession(): Promise<Session> {
  const session = await lireSession();
  if (!session) redirect("/connexion");
  const ilYA = Date.now() - new Date(session.derniereActivite).getTime();
  if (ilYA > 60_000) await depots().sessions.modifier(session.id, { derniereActivite: maintenant() });
  return session;
}

/** Variante pour les routes /api : renvoie null au lieu de rediriger (répondre 401). */
export async function sessionApi(): Promise<Session | null> {
  return lireSession();
}

export async function seDeconnecter(): Promise<void> {
  const session = await lireSession();
  if (session) await depots().sessions.modifier(session.id, { revoqueeLe: maintenant() });
  (await cookies()).delete(NOM_COOKIE_SESSION);
}

export async function listerSessions(): Promise<(Session & { courante: boolean })[]> {
  const courante = await exigerSession();
  const toutes = await depots().sessions.lister((s) => !s.revoqueeLe && new Date(s.expireLe) > new Date());
  return toutes
    .sort((a, b) => b.derniereActivite.localeCompare(a.derniereActivite))
    .map((s) => ({ ...s, courante: s.id === courante.id }));
}

export async function revoquerSession(id: string): Promise<void> {
  await exigerSession();
  await depots().sessions.modifier(id, { revoqueeLe: maintenant() });
  await journaliser("session", "Un appareil a été déconnecté");
}

/** Change le mot de passe : l'ancien est exigé ; les autres sessions sont coupées (PLAN B.4-4). */
export async function changerMotDePasse(ancien: string, nouveau: string): Promise<void> {
  const courante = await exigerSession();
  const empreinte = await empreinteActuelle();
  if (!empreinte || !(await verify(empreinte, ancien).catch(() => false))) {
    throw new ErreurStudio("ANCIEN_INCORRECT", "L'ancien mot de passe est incorrect.");
  }
  if (nouveau.length < 12) throw new ErreurStudio("TROP_COURT", "Choisissez 12 caractères au moins.");
  const nouvelle = await hash(nouveau, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await ecrireParametre(CLE_EMPREINTE, Buffer.from(nouvelle).toString("base64"));
  const autres = await depots().sessions.lister((s) => s.id !== courante.id && !s.revoqueeLe);
  for (const s of autres) await depots().sessions.modifier(s.id, { revoqueeLe: maintenant() });
  await journaliser("securite", "Mot de passe changé, autres appareils déconnectés");
}
