/**
 * CAL-25 · le formulaire d'ajout manuel ne bloque JAMAIS (règle du fondateur). Tableau de quatre cas :
 * sans fichier, fichier au bon format, fichier au format refusé, dépôt sur une entrée déjà validée.
 * Sans DOM : le formulaire est appelé comme une fonction (mini-moteur de crochets), on soumet son `onSubmit`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
const ajouterEntree = vi.fn(async (s: Record<string, unknown>) => ({ ok: true as const, donnees: { id: "c1", ...s } as never }));
vi.mock("@/app/(studio)/calendrier/actions/ajouter", () => ({ ajouterEntree: (s: Record<string, unknown>) => ajouterEntree(s) }));
const envoyerFichier = vi.fn(async (_f: File, _o: unknown) => ({ fichierId: "fAbc", simulation: false }));
vi.mock("@/lib/envoi-multipart", () => ({ envoyerFichier: (f: File, o: unknown) => envoyerFichier(f, o) }));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { AjouterEntree } = await import("@/components/calendrier/AjouterEntree");
const { DepotMedia } = await import("@/components/calendrier/DepotMedia");
const svc = await import("@/services/medias-deposes");

const fichier = (nom: string, type: string, taille = 1000) => ({ name: nom, type, size: taille }) as unknown as File;

async function soumettre(reseau: "linkedin" | "instagram", f?: File) {
  const m = monter(AjouterEntree, { jour: "2026-12-10", compteCible: "compte-fictif", reseau });
  if (f) {
    const depot = trouver(m.rendre(), (e) => e.type === DepotMedia)[0]!;
    const refuse = reseau === "instagram" && f.type === "application/pdf" ? "Instagram n'accepte pas ce format." : undefined;
    (depot.props.onMedia as (x: unknown) => void)({ nom: f.name, mime: f.type, taille: f.size, fichier: f, ...(refuse ? { formatRefuse: refuse } : {}) });
  }
  const form = trouver(m.rendre(), (e) => e.type === "form")[0]!;
  (form.props.onSubmit as (e: unknown) => void)({ preventDefault: () => undefined });
  await attendre();
  return texteDe(m.rendre());
}

describe("ajout manuel : jamais bloqué", () => {
  it.each([
    { cas: "sans fichier", reseau: "linkedin" as const, f: undefined, envois: 0, rattache: {}, phrase: /Ajouté/ },
    { cas: "fichier au bon format", reseau: "linkedin" as const, f: fichier("a.mp4", "video/mp4"), envois: 1, rattache: { videoId: "fAbc" }, phrase: /Ajouté/ },
    { cas: "fichier au format refusé", reseau: "instagram" as const, f: fichier("a.pdf", "application/pdf"), envois: 0, rattache: {}, phrase: /fichier n'a pas été envoyé/ },
    { cas: "envoi du fichier en échec", reseau: "linkedin" as const, f: fichier("a.mp4", "video/mp4"), envois: 1, rattache: {}, phrase: /fichier n'a pas été envoyé.*à joindre ensuite/, echec: true },
  ])("$cas : l'entrée est créée une fois, le message est clair", async ({ reseau, f, envois, rattache, phrase, echec }) => {
    ajouterEntree.mockClear();
    envoyerFichier.mockClear();
    if (echec) envoyerFichier.mockRejectedValueOnce(new Error("hors ligne"));
    const texte = await soumettre(reseau, f);
    expect(ajouterEntree).toHaveBeenCalledTimes(1);
    expect(envoyerFichier).toHaveBeenCalledTimes(envois);
    expect(ajouterEntree.mock.calls[0]![0]).toMatchObject(rattache);
    if (!("videoId" in rattache)) expect(ajouterEntree.mock.calls[0]![0]).not.toHaveProperty("visuelId");
    expect(texte).toMatch(phrase);
  });

  it("dépôt d'un fichier sur une entrée déjà validée : elle revient à valider", async () => {
    const creneaux = new Map<string, Record<string, unknown>>([["c1", { id: "c1", jourVise: "2026-12-10", heuresParReseau: {}, compteCible: "compte-fictif", statut: "valide", decalages: 0, creeLe: "2026-12-08T08:00:00.000Z", modifieLe: "2026-12-08T08:00:00.000Z" }]]);
    const fichiers = new Map<string, Record<string, unknown>>();
    const deps = {
      fichiers: { obtenir: async (id: string) => (fichiers.get(id) as never) ?? null, enregistrer: async (f: never) => { fichiers.set((f as { id: string }).id, f); return f; } },
      creneaux: { obtenir: async (id: string) => (creneaux.get(id) as never) ?? null, enregistrer: async (c: never) => { creneaux.set((c as { id: string }).id, c); return c; } },
      stockage: { tailleObjet: async () => 1000, empreinteSha256: async (_c: string, t: number) => ({ sha256: "a".repeat(64), taille: t }) },
      maintenant: () => Date.parse("2026-12-09T10:00:00Z"),
    };
    const r = await svc.enregistrerDepot({ fichierId: "f1", creneauId: "c1", reseau: "linkedin", cle: "studio/dev/entree/c1/f1.mp4", nom: "a.mp4", mime: "video/mp4", taille: 1000, sha256: "a".repeat(64) }, deps as never);
    expect(r.ok).toBe(true);
    expect(creneaux.get("c1")).toMatchObject({ statut: "a_valider", videoId: "f1" });
  });
});
