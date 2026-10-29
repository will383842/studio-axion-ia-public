/**
 * GARDE COMMUNE des routes /api/usine/* (porte v2 : l'Usine commande le studio). SERVEUR UNIQUEMENT.
 * Deux couches voulues, à ne retirer ni l'une ni l'autre : /api/usine/* est public pour la session (pas de cookie), mais le
 * jeton est vérifié d'abord dans le proxy (src/proxy.ts, `gardeUsine`), puis de nouveau DANS chaque handler, qui appelle
 * LUI-MÊME `garderPorte`. Ordre des contrôles :
 *  1. secret `STUDIO_PORTE_SECRET` absent, de moins de 32 caractères, ou égal à `USINE_PORTE_SECRET` (un secret par sens ; alerte au
 *     journal, sans secret) → 404 sans détail (porte éteinte) ;
 *  2. `Authorization: Bearer …` comparé à temps constant (empreintes SHA-256, `timingSafeEqual`) au secret et, pendant une
 *     rotation, à `STUDIO_PORTE_SECRET_PRECEDENT` (seulement jusqu'à `STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A`, date ISO ; sans échéance valide il est ignoré) → sinon 401 sans détail ;
 *  3. 60 appels par minute au plus (appels authentifiés seulement, sinon un inconnu bloquerait l'Usine) → 429 ;
 *  4. `Content-Type` JSON → 415 ; corps de 16 Ko au plus → 413 ; JSON objet → 400 ;
 *  5. `contrat: 2` obligatoire → 426 `contrat_inconnu` ; champs inconnus refusés → 400 `champ_invalide`.
 * Toute erreur a la forme `{ erreur, code }`. Le journal d'appel garde la route, le code, la durée et le repère ; jamais le
 * secret ni le corps.
 * LIMITE DU COMPTEUR : en mémoire du processus (fenêtre fixe d'une minute), remis à zéro au redémarrage et non partagé
 * entre plusieurs instances. Suffisant pour une seule instance du studio ; à revoir si le studio est répliqué.
 */
import "server-only";
import { NextResponse } from "next/server";
import { journaliser } from "@/services/_commun";
import { jetonAccepte, jetonDeLEntete, LONGUEUR_MIN_SECRET_PORTE, porteAllumee, secretsEnConflit, type Env } from "@/usine/jeton-porte";

export { jetonAccepte, LONGUEUR_MIN_SECRET_PORTE };

export const TAILLE_MAX_CORPS_OCTETS = 16 * 1024;
export const APPELS_MAX_PAR_MINUTE = 60;
export const CONTRAT_PORTE = 2;
const FENETRE_MS = 60_000;

export interface CorpsPorte {
  [champ: string]: unknown;
}
export interface PorteOk {
  ok: true;
  corps: CorpsPorte;
  /** À appeler avec le code HTTP final : écrit la ligne de journal (route, code, durée, repère). */
  terminer: (statut: number) => Promise<void>;
}
export interface PorteRefusee {
  ok: false;
  reponse: NextResponse;
}

export function reponseErreur(statut: number, erreur: string, code: string): NextResponse {
  return NextResponse.json({ erreur, code }, { status: statut, headers: { "Cache-Control": "no-store" } });
}

/** Réponse JSON de la porte (jamais mise en cache). */
export function reponseJson(statut: number, corps: unknown): NextResponse {
  return NextResponse.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
}

/* --- Compteur d'appels (mémoire du processus) ---------------------------- */
let fenetre = { debut: 0, n: 0 };

/** Remet le compteur à zéro (tests seulement). */
export function reinitialiserGardePourEssai(): void {
  fenetre = { debut: 0, n: 0 };
}

function compterAppel(maintenantMs: number): boolean {
  if (maintenantMs - fenetre.debut >= FENETRE_MS) fenetre = { debut: maintenantMs, n: 0 };
  fenetre.n += 1;
  return fenetre.n <= APPELS_MAX_PAR_MINUTE;
}

/**
 * Lit le corps en s'arrêtant au-delà de 16 Ko (null = trop gros). Cette lecture borne le TRAITEMENT du corps, pas la
 * mémoire : le proxy couvre cette route (le jeton y est vérifié aussi), donc Next met le corps en mémoire jusqu'à 10 Mo
 * (`experimental.proxyClientMaxBodySize`, réglage global, laissé par défaut) AVANT que ce handler ne s'exécute.
 */
async function lireCorpsBorne(requete: Request): Promise<string | null> {
  const annonce = Number(requete.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > TAILLE_MAX_CORPS_OCTETS) return null;
  if (!requete.body) return "";
  const lecteur = requete.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAILLE_MAX_CORPS_OCTETS) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux).toString("utf8");
}

/** Repère de l'appel pour le journal : court, sans caractère de contrôle. */
function repereDe(corps: CorpsPorte | null): string | undefined {
  const r = corps?.repere;
  return typeof r === "string" ? r.replace(/[^\w:.\-]/g, "").slice(0, 60) || undefined : undefined;
}

async function ecrireJournal(route: string, statut: number, debut: number, repere?: string, alerte?: string): Promise<void> {
  try {
    await journaliser("porte", alerte ? `Porte usine ${route} → ${statut} : ${alerte}` : `Porte usine ${route} → ${statut} (${Date.now() - debut} ms)${repere ? ` repère ${repere}` : ""}`);
  } catch {
    /* le journal ne change jamais la réponse */
  }
}

export interface OptionsGarde {
  /** Chemin affiché dans le journal (ex. « PUT /api/usine/reglages/budget »). */
  route: string;
  /** Champs permis dans le corps, `contrat` en plus ; tout autre champ → 400 `champ_invalide`. */
  champs: readonly string[];
  env?: Env;
  maintenantMs?: number;
}

/**
 * À appeler en PREMIER dans chaque handler /api/usine/*. Refusé : renvoyer `reponse` telle quelle. Accepté : traiter
 * `corps`, puis appeler `terminer(statut)` pour le journal.
 */
export async function garderPorte(requete: Request, o: OptionsGarde): Promise<PorteOk | PorteRefusee> {
  const debut = Date.now();
  const env = o.env ?? (process.env as Env);
  const refus = async (statut: number, erreur: string, code: string, corps: CorpsPorte | null = null, journal = true): Promise<PorteRefusee> => {
    if (journal) await ecrireJournal(o.route, statut, debut, repereDe(corps));
    return { ok: false, reponse: reponseErreur(statut, erreur, code) };
  };

  if (!porteAllumee(env)) {
    // Éteinte parce que la configuration réutilise le même secret dans les deux sens : alerte (jamais de secret), réponse 404.
    if (secretsEnConflit(env)) {
      console.error("[porte-usine] ALERTE : un secret de la porte est identique à USINE_PORTE_SECRET ; porte éteinte (404). Un secret par sens.");
      await ecrireJournal(o.route, 404, debut, undefined, "ALERTE configuration : secret de la porte identique à celui de l'autre sens, porte éteinte");
    }
    return refus(404, "Introuvable.", "introuvable", null, false);
  }
  const jeton = jetonDeLEntete(requete);
  if (jeton === null || !jetonAccepte(jeton, env, o.maintenantMs)) {
    console.warn(`[porte-usine] ${o.route} → 401`);
    return refus(401, "Non autorisé.", "non_autorise", null, false);
  }
  if (!compterAppel(o.maintenantMs ?? Date.now())) return refus(429, "Trop d'appels : réessayez dans une minute.", "trop_d_appels");

  if (!/^application\/json\s*(;|$)/i.test(requete.headers.get("content-type") ?? "")) return refus(415, "Le corps doit être du JSON (Content-Type: application/json).", "format_non_supporte");
  const texte = await lireCorpsBorne(requete);
  if (texte === null) return refus(413, "Corps trop volumineux (16 Ko au plus).", "corps_trop_gros");
  let analyse: unknown;
  try {
    analyse = JSON.parse(texte);
  } catch {
    return refus(400, "Corps JSON illisible.", "corps_invalide");
  }
  if (!analyse || typeof analyse !== "object" || Array.isArray(analyse)) return refus(400, "Le corps doit être un objet JSON.", "corps_invalide");
  const corps = analyse as CorpsPorte;

  if (corps.contrat !== CONTRAT_PORTE) return refus(426, `Contrat inconnu : ce studio parle le contrat ${CONTRAT_PORTE}.`, "contrat_inconnu", corps);
  const permis = new Set(["contrat", ...o.champs]);
  const inconnu = Object.keys(corps).find((c) => !permis.has(c));
  if (inconnu !== undefined) return refus(400, `Champ invalide : « ${inconnu.slice(0, 40).replace(/[^\w.\-]/g, "?")} » n'est pas permis.`, "champ_invalide", corps);

  return { ok: true, corps, terminer: (statut) => ecrireJournal(o.route, statut, debut, repereDe(corps)) };
}
