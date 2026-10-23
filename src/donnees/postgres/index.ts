/**
 * Dépôts PERSISTANTS (mise en ligne) : même contrat que les dépôts en mémoire, mais chaque écriture
 * part aussitôt dans PostgreSQL, et tout est rechargé au démarrage.
 *
 * Stockage « documents » : une seule table `documents (collection, id, data jsonb)`. Les filtres des
 * services sont des fonctions JavaScript : on garde donc une copie en mémoire (un seul utilisateur,
 * un seul processus) et Postgres est la source durable. Passer plus tard à des tables Prisma dédiées
 * ne touche que ce fichier.
 *
 * L3-01 (argent, deux processus) : le verrou des crédits est un verrou consultatif Postgres (`sousVerrouCredits`), et
 * les collections de l'argent sont RELUES dans la base sous ce verrou : un second processus (redéploiement, deux
 * conteneurs) voit les réservations et engagements du premier avant de contrôler. Hors de ce verrou, la copie en
 * mémoire reste celle de ce processus.
 *
 * Premier démarrage sur une base vide : les données de démonstration sont écrites (marquées estDemo,
 * masquables dans Réglages). Rien n'est purgé automatiquement : les seules requêtes DELETE servent la suppression
 * MANUELLE d'une vidéo par Will, confirmée (décision du 17/10), et l'oubli d'un bail expiré de cette vidéo.
 *
 * ⚠️ Importé UNIQUEMENT par src/donnees/memoire (aiguillage de depots()).
 */
import "server-only";
import { Client, Pool, type PoolConfig } from "pg";
import type { Depot, Depots, LotEcritures } from "@/domaine/depots";
import type { Id } from "@/domaine/types";
import { creerDonneesDemo } from "../memoire/demo";

type Ligne = { collection: string; id: string; data: unknown };
type Collections = Map<string, Map<Id, unknown>>;

const COLLECTIONS: (keyof Depots)[] = [
  "marques", "fichiers", "personnages", "visages", "voix", "prononciations", "elements", "scripts",
  "videos", "versions", "plans", "pistes", "retouches", "miniatures", "sousTitres", "sorties", "kits",
  "publications", "partages", "modeles", "idees", "series", "rushs", "travaux", "depenses",
  "ressourcesFournisseurs", "evenementsFournisseurs", "notifications", "sessions", "tentatives",
  "parametres", "evenements", "veilleOutils", "veilleNouveautes",
  // Lot « crédits » (02/10).
  "recharges", "reservations", "relevesSoldes",
  // Générateur de scripts (lot G1a, plan v5 B.2) : 12 collections, vides au départ en production.
  "scriptsMaitres", "variantes", "preuves", "matieres", "exemplesStyle", "fichesStyle", "tournesInterdites",
  "generations", "bilansApprentissage", "contexteAxion", "reglesDatees", "sessionsTournage",
  // Traçabilité du tableau animé (ajout seul).
  "tracesTableau",
  // Source axion-ia.com (03/10) : pages du site connues du studio.
  "pagesSite",
  // Générateur de scripts du tableau animé : une trace par génération, ajout seul.
  "tracesScriptsTableau",
  // Comité éditorial : idées de l'Usine jugées.
  "ideesJugees",
  // Mémoire de la voix de Will : ses corrections à la relecture, ajout seul.
  "correctionsWill",
  // Carrousels (V3).
  "visuels",
];

/**
 * Audit D, B9 : délais bornés côté base. Avant, une requête qui ne revenait jamais bloquait le verrou global du studio
 * (chaîne de promesses) et donc tout, y compris « Arrêter ». `statement_timeout` : Postgres coupe une requête au-delà
 * de 30 s ; `query_timeout` : le client abandonne aussi (connexion muette) ; une transaction oubliée est coupée à 60 s.
 */
export const DELAI_REQUETE_MS = 30_000;

export function optionsPool(url: string): PoolConfig {
  return {
    connectionString: url,
    max: 5,
    // Délai de connexion borné : une base injoignable répond « non » en 5 s au lieu de bloquer les pages.
    connectionTimeoutMillis: 5000,
    statement_timeout: DELAI_REQUETE_MS,
    query_timeout: DELAI_REQUETE_MS + 5_000,
    idle_in_transaction_session_timeout: 60_000,
  };
}

/**
 * Audit D (un seul réplica) : clé du verrou consultatif Postgres de la BOUCLE DE FOND. Une seule instance du studio la
 * tient (connexion dédiée, gardée ouverte) ; une seconde instance ne fait pas tourner la boucle.
 */
export const CLE_VERROU_BOUCLE = 7_354_219_001;

/**
 * L3-01 : clé du verrou consultatif Postgres des CRÉDITS (contrôle du budget et des crédits, réservation, engagement),
 * partagé par tous les processus du studio. Distincte de celle de la boucle.
 */
export const CLE_VERROU_CREDITS = 7_354_219_002;

/**
 * Collections relues dans la base sous le verrou des crédits : tout ce que lisent le contrôle du budget du mois (dépensé,
 * engagé, budget de l'Usine, plafond), le contrôle des crédits (recharges, relevés, réservations) et l'engagement d'un
 * travail (son statut).
 */
export const COLLECTIONS_ARGENT = ["reservations", "parametres", "depenses", "travaux", "recharges", "relevesSoldes"] as const;

/** Collection des BAUX (verrous exclusifs partagés entre machines, avec expiration) : jamais lue par les services. */
export const COLLECTION_BAUX = "baux";

/** Collection des COMPTEURS (numéro du lien suivi) : jamais lue par les services, jamais effacée. */
export const COLLECTION_COMPTEURS = "compteurs";

function copie<T>(x: T): T {
  return structuredClone(x);
}

const cleLigne = (collection: string, id: Id) => `${collection}\u0000${id}`;

class Base {
  readonly pool: Pool;
  private readonly url: string;
  /** Connexion dédiée qui TIENT le verrou de la boucle (jamais rendue au pool). */
  private clientVerrou: Client | null = null;
  readonly tables: Collections = new Map();
  /** Chargement en cours ou réussi. Un échec est OUBLIÉ : l'appel suivant réessaie (E2E-2 données n° 8). */
  private chargement: Promise<void> | null = null;
  /**
   * L3-01 : écritures de CE processus, pour que la relecture sous verrou n'écrase jamais une valeur plus neuve que sa
   * photo de la base : numéro de la dernière écriture COMMENCÉE par ligne, et lignes dont une écriture est en vol.
   */
  private numeroEcriture = 0;
  private readonly derniereEcriture = new Map<string, number>();
  private readonly ecrituresEnVol = new Map<string, number>();

  constructor(url: string) {
    this.url = url;
    this.pool = new Pool(optionsPool(url));
    this.pool.on("error", (erreur) => console.error("[studio] connexion à la base perdue", erreur.message));
    void this.pret.catch(() => {}); // le chargement démarre tout de suite ; son échec est relu par chaque appel
  }

  /**
   * Base chargée. Avant la n° 8, une base injoignable au démarrage gardait la promesse rejetée À VIE : toutes les
   * pages répondaient 500, même la base revenue. Désormais un échec est oublié et l'accès suivant recharge.
   */
  get pret(): Promise<void> {
    this.chargement ??= this.charger().catch((erreur) => {
      this.chargement = null;
      throw erreur;
    });
    return this.chargement;
  }

  /** Sonde : la base répond-elle MAINTENANT ? (la copie en mémoire ne suffit pas à le dire). */
  async sonder(): Promise<void> {
    await this.pret;
    await this.pool.query("SELECT 1");
  }

  /**
   * Prend le verrou consultatif de la boucle (`pg_try_advisory_lock`, sans attendre). true : cette instance le tient,
   * jusqu'à la fin du processus (ou la perte de la connexion : `surPerte` est alors appelée, le verrou est perdu).
   */
  async prendreVerrouBoucle(surPerte: () => void): Promise<boolean> {
    if (this.clientVerrou) return true;
    const client = new Client({ connectionString: this.url, connectionTimeoutMillis: 5000, query_timeout: 10_000 });
    await client.connect();
    try {
      const { rows } = await client.query<{ pris: boolean }>("SELECT pg_try_advisory_lock($1) AS pris", [CLE_VERROU_BOUCLE]);
      if (!rows[0]?.pris) {
        await client.end().catch(() => undefined);
        return false;
      }
    } catch (erreur) {
      await client.end().catch(() => undefined);
      throw erreur;
    }
    client.on("error", (erreur) => {
      console.error("[studio] connexion du verrou de la boucle perdue", erreur.message);
      if (this.clientVerrou === client) this.clientVerrou = null;
      void client.end().catch(() => undefined);
      surPerte();
    });
    this.clientVerrou = client;
    return true;
  }

  /**
   * L3-01 : exécute `f` sous le verrou consultatif des crédits (`pg_advisory_lock`, attente bornée par le délai des
   * requêtes : au-delà, refus, rien ne part), après avoir relu dans la base les collections de l'argent. Connexion dédiée
   * le temps de `f` ; le verrou est rendu à la fin, même en cas de panne (connexion détruite si le déverrouillage échoue :
   * le serveur le rend alors de lui-même).
   */
  async sousVerrouCredits<T>(f: () => Promise<T>): Promise<T> {
    await this.pret;
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [CLE_VERROU_CREDITS]);
    } catch (erreur) {
      client.release(true);
      throw new Error(`Verrou des crédits indisponible (base occupée ou injoignable) : rien ne part. ${erreur instanceof Error ? erreur.message : ""}`.trim());
    }
    let casse = false;
    try {
      await this.relire(COLLECTIONS_ARGENT);
      return await f();
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [CLE_VERROU_CREDITS]);
      } catch {
        casse = true;
      }
      client.release(casse);
    }
  }

  /**
   * Relit ces collections dans la base et met la copie à jour (ajouts et changements des autres processus ; rien n'est
   * retiré). Une ligne que CE processus écrit pendant la relecture (en vol au moment de la photo, ou commencée après)
   * garde sa valeur : la photo de la base peut être plus ancienne qu'elle.
   */
  private async relire(collections: readonly string[]): Promise<void> {
    const numero = this.numeroEcriture;
    const enVol = new Set(this.ecrituresEnVol.keys());
    const { rows } = await this.pool.query<Ligne>("SELECT collection, id, data FROM documents WHERE collection = ANY($1)", [collections]);
    for (const r of rows) {
      const k = cleLigne(r.collection, r.id);
      if (enVol.has(k) || (this.derniereEcriture.get(k) ?? 0) > numero) continue;
      if (!this.tables.has(r.collection)) this.tables.set(r.collection, new Map());
      this.tables.get(r.collection)!.set(r.id, r.data);
    }
  }

  /** Suit une écriture de ce processus (voir `relire`). */
  async suivreEcriture<T>(lignes: { collection: string; id: Id }[], f: () => Promise<T>): Promise<T> {
    const numero = ++this.numeroEcriture;
    const cles = lignes.map((l) => cleLigne(l.collection, l.id));
    for (const k of cles) {
      this.derniereEcriture.set(k, numero);
      this.ecrituresEnVol.set(k, (this.ecrituresEnVol.get(k) ?? 0) + 1);
    }
    try {
      return await f();
    } finally {
      for (const k of cles) {
        const reste = (this.ecrituresEnVol.get(k) ?? 1) - 1;
        if (reste > 0) this.ecrituresEnVol.set(k, reste);
        else this.ecrituresEnVol.delete(k);
      }
    }
  }

  /**
   * Bail exclusif (verrou partagé entre machines : le lanceur « Image → vidéo », une vidéo à la fois). Pris si la clé est
   * libre, expirée, ou déjà tenue par ce titulaire (il est alors prolongé). UNE requête atomique, à l'heure de la base
   * (jamais l'horloge d'une machine) : deux preneurs simultanés, un seul gagne. Un processus mort le laisse expirer.
   */
  async prendreBail(cle: string, titulaire: string, dureeMs: number): Promise<boolean> {
    await this.pret;
    const { rows } = await this.pool.query(
      `INSERT INTO documents (collection, id, data, modifie_le)
         VALUES ($1, $2, jsonb_build_object('titulaire', $3::text, 'expireLe', now() + make_interval(secs => $4::double precision / 1000)), now())
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now()
         WHERE documents.data->>'titulaire' = $3::text OR (documents.data->>'expireLe')::timestamptz <= now()
       RETURNING id`,
      [COLLECTION_BAUX, cle, titulaire, dureeMs],
    );
    return rows.length === 1;
  }

  /**
   * Numéro suivant d'un compteur (lien suivi des versions), UNE requête atomique : le compteur ne redescend jamais et
   * rattrape le plus haut `numeroSuivi` / `numero` déjà écrit dans [min, max] par un autre chemin. Lu dans la base, jamais
   * dans la copie en mémoire de ce processus : deux conteneurs en même temps ne reçoivent jamais le même numéro.
   */
  async prochainNumeroSuivi(cle: string, min: number, max: number): Promise<number> {
    await this.pret;
    const { rows } = await this.pool.query(
      `WITH amorce AS (SELECT COALESCE(MAX(n), $2::int - 1) AS n FROM (SELECT GREATEST(CASE WHEN jsonb_typeof(data->'numeroSuivi') = 'number' THEN floor((data->>'numeroSuivi')::numeric)::int END, CASE WHEN jsonb_typeof(data->'numero') = 'number' THEN floor((data->>'numero')::numeric)::int END) AS n FROM documents WHERE collection = $5) v WHERE n BETWEEN $2::int AND $3::int)
       INSERT INTO documents (collection, id, data, modifie_le) SELECT $4, $1, jsonb_build_object('dernier', amorce.n + 1), now() FROM amorce
       ON CONFLICT (collection, id) DO UPDATE SET data = jsonb_build_object('dernier', GREATEST((documents.data->>'dernier')::int + 1, (EXCLUDED.data->>'dernier')::int)), modifie_le = now()
       RETURNING (data->>'dernier')::int AS dernier`,
      [cle, min, max, COLLECTION_COMPTEURS, "versions"],
    );
    if (rows.length !== 1) throw new Error(`Compteur ${cle} : réponse inattendue de la base.`);
    return Number((rows[0] as { dernier: unknown }).dernier);
  }

  /** Rend le bail s'il est encore à ce titulaire (il expire aussitôt ; aucune requête DELETE). */
  async rendreBail(cle: string, titulaire: string): Promise<void> {
    await this.pret;
    await this.pool.query(
      `UPDATE documents SET data = jsonb_set(data, '{expireLe}', to_jsonb(now() - interval '1 second')), modifie_le = now()
       WHERE collection = $1 AND id = $2 AND data->>'titulaire' = $3::text`,
      [COLLECTION_BAUX, cle, titulaire],
    );
  }

  /** Le bail est-il tenu en ce moment (à l'heure de la base) ? */
  async bailTenu(cle: string): Promise<boolean> {
    await this.pret;
    const { rows } = await this.pool.query(`SELECT 1 FROM documents WHERE collection = $1 AND id = $2 AND (data->>'expireLe')::timestamptz > now()`, [COLLECTION_BAUX, cle]);
    return rows.length === 1;
  }

  /** Efface le bail s'il est expiré (ou rendu) ; un bail encore tenu reste. */
  async oublierBailExpire(cle: string): Promise<void> {
    await this.pret;
    await this.pool.query(
      `DELETE FROM documents WHERE collection = $1 AND id = $2 AND (data->>'expireLe')::timestamptz <= now()`,
      [COLLECTION_BAUX, cle],
    );
  }

  private async charger(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        collection text NOT NULL,
        id text NOT NULL,
        data jsonb NOT NULL,
        modifie_le timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, id)
      )`);
    this.tables.clear();
    for (const c of COLLECTIONS) this.tables.set(c, new Map());
    const { rows } = await this.pool.query<Ligne>("SELECT collection, id, data FROM documents");
    if (rows.length === 0) {
      await this.semer();
      return;
    }
    for (const r of rows) {
      if (!this.tables.has(r.collection)) this.tables.set(r.collection, new Map());
      this.tables.get(r.collection)!.set(r.id, r.data);
    }
  }

  /** Base vide : écrit les données de démonstration, en une transaction. */
  private async semer(): Promise<void> {
    const demo = creerDonneesDemo() as unknown as Record<string, { id: Id }[] | undefined>;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const c of COLLECTIONS) {
        for (const e of demo[c] ?? []) {
          this.tables.get(c)!.set(e.id, copie(e));
          await client.query(
            "INSERT INTO documents (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [c, e.id, JSON.stringify(e)],
          );
        }
      }
      await client.query("COMMIT");
    } catch (erreur) {
      await client.query("ROLLBACK");
      throw erreur;
    } finally {
      client.release();
    }
  }

  /** Efface une ligne (suppression manuelle d'une vidéo, décision du 17/10). */
  async effacer(collection: string, id: Id): Promise<void> {
    await this.suivreEcriture([{ collection, id }], () => this.pool.query("DELETE FROM documents WHERE collection = $1 AND id = $2", [collection, id]));
  }

  /**
   * Lot en UNE transaction : tout part dans la base ou rien (ROLLBACK). La copie en mémoire n'est touchée qu'après le
   * COMMIT : un échec laisse la base ET la copie comme avant.
   */
  async appliquerLot(lot: LotEcritures): Promise<void> {
    await this.pret;
    await this.suivreEcriture([...lot.supprimer, ...lot.enregistrer.map((e) => ({ collection: e.collection, id: e.entite.id }))], () => this.ecrireLot(lot));
    for (const s of lot.supprimer) this.tables.get(s.collection)?.delete(s.id);
    for (const e of lot.enregistrer) this.tables.get(e.collection)?.set(e.entite.id, copie(e.entite));
  }

  private async ecrireLot(lot: LotEcritures): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of lot.supprimer) await client.query("DELETE FROM documents WHERE collection = $1 AND id = $2", [s.collection, s.id]);
      for (const e of lot.enregistrer) {
        await client.query(
          `INSERT INTO documents (collection, id, data, modifie_le) VALUES ($1, $2, $3, now())
           ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now()`,
          [e.collection, e.entite.id, JSON.stringify(e.entite)],
        );
      }
      await client.query("COMMIT");
    } catch (erreur) {
      await client.query("ROLLBACK");
      throw erreur;
    } finally {
      client.release();
    }
  }

  async ecrire(collection: string, entite: { id: Id }): Promise<void> {
    await this.suivreEcriture([{ collection, id: entite.id }], () =>
      this.pool.query(
        `INSERT INTO documents (collection, id, data, modifie_le) VALUES ($1, $2, $3, now())
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now()`,
        [collection, entite.id, JSON.stringify(entite)],
      ),
    );
  }
}

class DepotPersistant<T extends { id: Id }> implements Depot<T> {
  constructor(
    private readonly base: Base,
    private readonly collection: string,
  ) {}

  private async table(): Promise<Map<Id, T>> {
    await this.base.pret;
    return this.base.tables.get(this.collection) as Map<Id, T>;
  }

  async lister(filtre?: (e: T) => boolean, projeter?: (e: T) => T): Promise<T[]> {
    const tout = Array.from((await this.table()).values());
    const gardes = filtre ? tout.filter(filtre) : tout;
    return copie(projeter ? gardes.map(projeter) : gardes);
  }

  async obtenir(id: Id): Promise<T | null> {
    const e = (await this.table()).get(id);
    return e ? copie(e) : null;
  }

  async trouver(filtre: (e: T) => boolean): Promise<T | null> {
    for (const e of (await this.table()).values()) if (filtre(e)) return copie(e);
    return null;
  }

  async enregistrer(entite: T): Promise<T> {
    const t = await this.table();
    await this.base.ecrire(this.collection, entite);
    t.set(entite.id, copie(entite));
    return copie(entite);
  }

  async modifier(id: Id, patch: Partial<T>): Promise<T> {
    const t = await this.table();
    const actuelle = t.get(id);
    if (!actuelle) throw new Error(`Introuvable : ${id}`);
    const suivante = { ...actuelle, ...copie(patch) } as T;
    if ("modifieLe" in suivante) (suivante as { modifieLe: string }).modifieLe = new Date().toISOString();
    await this.base.ecrire(this.collection, suivante);
    t.set(id, suivante);
    return copie(suivante);
  }

  async supprimer(id: Id): Promise<boolean> {
    const t = await this.table();
    if (!t.has(id)) return false;
    await this.base.effacer(this.collection, id);
    t.delete(id);
    return true;
  }

  async compter(filtre?: (e: T) => boolean): Promise<number> {
    const t = await this.table();
    if (!filtre) return t.size;
    let n = 0;
    for (const e of t.values()) if (filtre(e)) n++;
    return n;
  }
}

/**
 * La base est accrochée aux dépôts par un symbole GLOBAL (et non une table propre à ce module) : Next charge ce
 * module plusieurs fois (démarrage, routes), et seul l'objet des dépôts, rangé sur globalThis, est partagé.
 */
const CLE_BASE = Symbol.for("studio-axion-ia.base-postgres");

/** Crée les dépôts adossés à Postgres. Le chargement démarre tout de suite et chaque appel l'attend. */
export function creerDepotsPostgres(url: string): Depots {
  const base = new Base(url);
  const depots = {} as Record<keyof Depots, unknown>;
  for (const c of COLLECTIONS) depots[c] = new DepotPersistant(base, c);
  Object.defineProperty(depots, CLE_BASE, { value: base, enumerable: false });
  return depots as Depots;
}

/** Sonde de santé : `null` si ces dépôts ne sont pas adossés à Postgres ; sinon rejette si la base ne répond pas. */
export function sonderBasePostgres(d: Depots): Promise<void> | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? base.sonder() : null;
}

/** Verrou de la boucle de fond : `null` si ces dépôts ne sont pas adossés à Postgres (mémoire : un seul processus). */
export function prendreVerrouBouclePostgres(d: Depots, surPerte: () => void): Promise<boolean> | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? base.prendreVerrouBoucle(surPerte) : null;
}

/**
 * L3-01 : verrou des crédits partagé entre processus (verrou consultatif Postgres, copie de l'argent relue dessous) :
 * `null` si ces dépôts ne sont pas adossés à Postgres.
 */
export function verrouCreditsPostgres(d: Depots): (<T>(f: () => Promise<T>) => Promise<T>) | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? (f) => base.sousVerrouCredits(f) : null;
}

/** Bail exclusif partagé entre machines : `null` si ces dépôts ne sont pas adossés à Postgres. */
export function bailPostgres(d: Depots): { prendre: (cle: string, titulaire: string, dureeMs: number) => Promise<boolean>; rendre: (cle: string, titulaire: string) => Promise<void>; oublierExpire: (cle: string) => Promise<void>; tenu: (cle: string) => Promise<boolean> } | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? { prendre: (c, t, ms) => base.prendreBail(c, t, ms), rendre: (c, t) => base.rendreBail(c, t), oublierExpire: (c) => base.oublierBailExpire(c), tenu: (c) => base.bailTenu(c) } : null;
}

/** Compteur du numéro de lien suivi, dans la base : `null` si ces dépôts ne sont pas adossés à Postgres. */
export function numeroSuiviPostgres(d: Depots): { suivant: (cle: string, min: number, max: number) => Promise<number> } | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? { suivant: (c, min, max) => base.prochainNumeroSuivi(c, min, max) } : null;
}

/** Lot d'écritures en une transaction : `null` si ces dépôts ne sont pas adossés à Postgres. */
export function appliquerLotPostgres(d: Depots, lot: LotEcritures): Promise<void> | null {
  const base = (d as unknown as Record<symbol, Base | undefined>)[CLE_BASE];
  return base ? base.appliquerLot(lot) : null;
}
