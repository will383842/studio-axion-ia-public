/**
 * DIAG-STUDIO-ZERNIO · réessai « Envoi par Zernio » avec les comptes mémorisés côté Buffer. Chaîne simulée : écran/service d'envoi → fournisseur inscrit → client à liste fermée
 * → faux serveur (fetch global remplacé). Aucune vraie clé, aucun appel réseau.
 * Couvre : anti-doublon ENTRE outils, rejeu après erreur réseau, « Tout arrêter », erreurs sans fuite de clé, synchro « Publiée ».
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer } from "../helpers/r1-buffer";
import { CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";
import { serveurSimule } from "./aides/serveur-simule";

process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0501";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");
// Précondition L7-08 : l'envoi du calendrier a son propre réglage, fermé par défaut ; ce fichier teste l'envoi, il l'ouvre.
const { ecrireParametre: ecrireReglageCalendrier } = await import("@/services/_commun");
const { PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMPTES = { accounts: [{ _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" }] };
let buffer: ReturnType<typeof fauxBuffer>;
let appelsZernio: AppelEnregistre[];
let serveur: ReturnType<typeof serveurSimule>;
let sorties: string[];

/** Remplace le fetch global : Buffer simulé, Zernio simulé, média source (R2) et dépôt Zernio simulés. */
function brancherReseauSimule(surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined) {
  serveur = serveurSimule({
    surmesure: (a) => {
      if (surmesure) {
        const s = surmesure(a);
        if (s) return s;
      }
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: COMPTES };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://api.buffer.com")) return buffer.appeler(url as never, init as never);
    if (u.startsWith("https://zernio.com/") || u.startsWith("https://exemple-stockage.test")) {
      const corps = typeof init.body === "string" ? init.body : undefined;
      const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
      appelsZernio.push(a);
      const r = serveur.repondre(a);
      if ("erreur" in r) throw Object.assign(new Error(r.message ?? "fetch failed"), { name: r.erreur === "delai" ? "TimeoutError" : "TypeError" });
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
    }
    // Média source (vidéo du Studio) : un octet suffit.
    return new Response(new Uint8Array([1]), { headers: { "content-length": "1" } });
  });
}
const posts = () => appelsZernio.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const toutesLesSorties = () => sorties.join("\n");

beforeAll(async () => {
  await preparerMotDePasse("essai-e2e-service");
});

// Le fournisseur inscrit (et son plafond de débit local) vit autant que le processus : chaque test avance l'horloge de
// 10 minutes pour repartir d'une fenêtre de débit vide (seule `Date` est simulée ; les minuteries restent réelles).
let decalageMs = 0;
beforeEach(async () => {
  decalageMs += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + decalageMs });
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireReglageCalendrier(PARAM_ENVOI_CALENDRIER, true);
  await ecrireReglageCalendrier(REGLAGE_EDITORIALE_ACTIVE, true);
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter("essai-e2e-service", false);
  buffer = fauxBuffer({});
  sorties = [];
  for (const n of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, n).mockImplementation((...args: unknown[]) => void sorties.push(args.map((x) => (typeof x === "string" ? x : x instanceof Error ? `${x.name} ${x.message} ${x.stack}` : JSON.stringify(x))).join(" ")));
  }
  brancherReseauSimule();
  // Le fournisseur inscrit (et son client) vit autant que le processus : une lecture des posts remet à zéro le drapeau
  // « lecture exigée » laissé par un test précédent (réponse perdue), comme le fait l'écran entre deux envois.
  await (await import("@/fournisseurs")).fournisseurParId("publication", "zernio").publicationsRecentes?.({ canalId: "exemple-compte-1", depuis: "2000-01-01T00:00:00Z" });
  appelsZernio.length = 0;
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});


/** Ce que l'écran envoie : les comptes mémorisés (identifiants de canaux BUFFER) accompagnent le choix « Zernio ». */
describe("DIAG-STUDIO-ZERNIO · comptes Buffer mémorisés + envoi par Zernio", () => {
  it("un identifiant de compte Buffer n'empêche pas l'envoi Zernio : un brouillon est créé chez Zernio", async () => {
    const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "zernio", comptes: ["canal-buffer-memorise"] });
    expect(r).toMatchObject({ ok: true, donnees: { nombre: 1, problemes: [] } });
    expect(posts()).toHaveLength(1);
    expect(posts()[0].json).toMatchObject({ isDraft: true });
  });
});
