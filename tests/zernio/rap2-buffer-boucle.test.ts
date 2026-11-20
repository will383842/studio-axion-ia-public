/** RAP-2 · une rapatriée n'entre jamais dans la relecture des envois incertains (boucle Buffer, bouton, reprise). Fournisseur factice, données fictives. */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const appels = { publicationsRecentes: 0 };
vi.mock("@/fournisseurs", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/fournisseurs")>();
  return {
    ...orig,
    fournisseurParId: (type: string, id: string) => {
      if (type === "publication" && id === "zernio") {
        return { id: "zernio", async publicationsRecentes() { appels.publicationsRecentes++; return []; } };
      }
      return (orig.fournisseurParId as (t: string, i: string) => unknown)(type, id);
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { synchroniserEtatsBuffer, reconcilierEnvoi } = await import("@/services/buffer");
const MDP = "essai-rap2-boucle";
let nbNotifs = 0;
const nouvelles = async () => (await depots().notifications.lister(() => true)).slice(nbNotifs);
const T0 = Date.parse("2026-11-20T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appels.publicationsRecentes = 0;
  // Les dépôts en mémoire portent des données de démonstration : on ne mesure que ce que ces tests y ajoutent.
  nbNotifs = (await depots().notifications.lister(() => true)).length;
  await auth.seConnecter(MDP, false);
});

/** Début d'envoi vieux de plus de 30 min : une publication du Studio passerait « absente ». */
const base = { reseau: "instagram", statut: "programmee", via: "zernio", date: iso(T0 + 86_400_000), texte: "t", canalId: "compte-fictif", etatEnvoi: "a-verifier", envoiCommenceLe: iso(T0 - 3 * 3600_000), creeLe: iso(T0), modifieLe: iso(T0) };
const rapatriee = (n: number) => ({ ...base, id: `rap-${n}`, idExterne: `p-${n}`, rapatrieeLe: iso(T0 - 3 * 3600_000) });

describe("une rapatriée « à vérifier » reste hors de la relecture des envois incertains", () => {
  it("5 rapatriées puis synchro forcée : aucun absent, aucun échec, aucune notification d'envoi, zéro requête", async () => {
    for (let i = 0; i < 5; i++) await depots().publications.enregistrer(rapatriee(i) as never);
    await synchroniserEtatsBuffer({ force: true, instant: T0 + 3600_000 });
    const pubs = await depots().publications.lister((p) => p.id.startsWith("rap-"));
    expect(pubs).toHaveLength(5);
    for (const p of pubs) {
      expect(p.etatEnvoi).toBe("a-verifier");
      expect(p.statut).toBe("programmee");
      expect(p.erreur).toBeUndefined();
    }
    const notifs = await nouvelles();
    expect(notifs.filter((n) => (n as { envoi?: unknown }).envoi)).toHaveLength(0);
    expect(notifs).toHaveLength(0);
    expect(appels.publicationsRecentes).toBe(0);
  });

  it("le bouton « Relire chez le diffuseur » (reconcilierEnvoi) ne casse rien : sortie sans écriture, sans notification, sans requête", async () => {
    await depots().publications.enregistrer(rapatriee(1) as never);
    const avant = await depots().publications.obtenir("rap-1");
    const apres = await reconcilierEnvoi("rap-1", T0 + 3600_000);
    expect(apres).toEqual(avant);
    expect((await depots().publications.obtenir("rap-1"))?.modifieLe).toBe(iso(T0));
    expect(await nouvelles()).toHaveLength(0);
    expect(appels.publicationsRecentes).toBe(0);
  });

  it("non-régression : une publication née au Studio garde le comportement actuel (relue, absente, notifiée)", async () => {
    await depots().publications.enregistrer({ ...base, id: "pub-studio", videoId: "v-03", idExterne: undefined } as never);
    await synchroniserEtatsBuffer({ force: true, instant: T0 + 3600_000 });
    const p = await depots().publications.obtenir("pub-studio");
    expect(p?.etatEnvoi).toBe("absent");
    expect(p?.statut).toBe("echec");
    expect(appels.publicationsRecentes).toBe(1);
    const notifs = await nouvelles();
    expect(notifs).toHaveLength(1);
    expect((notifs[0] as { envoi?: { statut: string } }).envoi?.statut).toBe("a-envoyer");
  });
});
