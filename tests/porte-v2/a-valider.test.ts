/**
 * Porte v2, appel 2 bis : ce que l'écran « À valider » montre (POST /api/usine/commandes/<clé>/a-valider).
 * Lecture seule. Dépôts en mémoire, aucun réseau, secrets d'essai, données fictives (2099, comptes fictifs).
 * Écrit en avance (empilé sur L5-02a, avant CAL-21).
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const commandes = await import("@/app/api/usine/commandes/route");
const programmations = await import("@/app/api/usine/programmations/route");
const aValider = await import("@/app/api/usine/commandes/[id]/a-valider/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const requete = (url: string, corps: unknown, secret: string | null = SECRET) => {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(`http://studio.test${url}`, { method: "POST", headers: h, body: JSON.stringify(corps) });
};
const lire = (id: string, corps: unknown = { contrat: 2 }, secret: string | null = SECRET) =>
  aValider.POST(requete(`/api/usine/commandes/${id}/a-valider`, corps, secret), { params: Promise.resolve({ id }) });
const commande = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "cmd-essai-0001", reseau: "linkedin", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive", ...extra,
});
const instantane = async () => {
  const d = depots();
  return JSON.stringify([await d.creneauxEditoriaux.lister(), await d.parametres.lister(), await d.journalDecalages.lister()]);
};
async function poser(id: string, extra: Record<string, unknown>) {
  const c = (await depots().creneauxEditoriaux.obtenir(id))!;
  await depots().creneauxEditoriaux.enregistrer({ ...c, ...extra } as typeof c);
}

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
});

describe("appel 2 bis : forme exacte", () => {
  it("créneau à valider : la forme du contrat, rien de plus", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande()));
    await poser("cmd-cmd-essai-0001", { statut: "a_valider", textes: { linkedin: { texte: "Texte fictif de publication.", premierCommentaire: "Premier commentaire fictif." }, facebook: { texte: "autre", premierCommentaire: "autre" } } });
    const r = await lire("cmd-essai-0001");
    expect(r.status).toBe(200);
    const corps = await r.json();
    expect(corps).toEqual({
      etape: "video", etat: "a_valider", reseau: "linkedin", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z", compteCible: "compte-fictif-1",
      media: { type: "video", id: "v-fictive" },
      textes: { texte: "Texte fictif de publication.", premierCommentaire: "Premier commentaire fictif." },
      empreinte: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(Object.keys(corps)).not.toContain("valideePar");
    expect(JSON.stringify(corps)).not.toMatch(/repereUsine|signatureUsine|decalages|facebook|autre/);
  });
  it("créneau « propose » : état recue, sans média ni texte = null ; validé : valideeLe présent", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande({ videoId: undefined })));
    expect(await (await lire("cmd-essai-0001")).json()).toMatchObject({ etat: "recue", media: null, textes: null });
    await poser("cmd-cmd-essai-0001", { statut: "valide", valideeLe: "2099-12-01T10:00:00.000Z", valideePar: "x" });
    const corps = await (await lire("cmd-essai-0001")).json();
    expect(corps).toMatchObject({ etat: "a_valider", valideeLe: "2099-12-01T10:00:00.000Z" });
    expect(JSON.stringify(corps)).not.toContain("valideePar");
  });
  it("visuel rattaché : média de type visuel", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande({ videoId: undefined, visuelId: "vis-fictif" })));
    expect((await (await lire("cmd-essai-0001")).json()).media).toEqual({ type: "visuel", id: "vis-fictif" });
  });
  it("l'empreinte change quand le texte, l'heure ou le média changent, pas quand le statut change", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande()));
    const e0 = (await (await lire("cmd-essai-0001")).json()).empreinte;
    await poser("cmd-cmd-essai-0001", { statut: "a_valider" });
    expect((await (await lire("cmd-essai-0001")).json()).empreinte).toBe(e0);
    await poser("cmd-cmd-essai-0001", { heuresParReseau: { linkedin: "2099-12-10T09:00:00.000Z" } });
    const e1 = (await (await lire("cmd-essai-0001")).json()).empreinte;
    expect(e1).not.toBe(e0);
    await poser("cmd-cmd-essai-0001", { textes: { linkedin: { texte: "autre", premierCommentaire: "" } } });
    expect((await (await lire("cmd-essai-0001")).json()).empreinte).not.toBe(e1);
  });
});

describe("appel 2 bis : clés, statuts, garde", () => {
  it("inconnu et clé mal formée : 404", async () => {
    expect((await lire("cmd-inconnue-01")).status).toBe(404);
    expect((await lire("court")).status).toBe(404);
    expect((await lire("a b/c;d-éè-1234")).status).toBe(404);
  });
  it("clé de l'appel 4 : le créneau prog-<clé> est lu", async () => {
    await programmations.POST(requete("/api/usine/programmations", { contrat: 2, cle: "essai-prog-01", reseau: "facebook", jour: "2099-12-11", instant: "2099-12-11T10:00:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive" }));
    const r = await lire("essai-prog-01");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ reseau: "facebook", etat: "a_valider" });
  });
  it("clé ambiguë (cmd- et prog-) : 409 etat_incompatible", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande({ cle: "meme-cle-001" })));
    await programmations.POST(requete("/api/usine/programmations", { contrat: 2, cle: "meme-cle-001", reseau: "facebook", jour: "2099-12-11", instant: "2099-12-11T10:00:00.000Z", compteCible: "compte-fictif-1" }));
    const r = await lire("meme-cle-001");
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("etat_incompatible");
  });
  it.each(["programme", "publie", "echec", "archive"])("statut %s : 409 etat_incompatible", async (statut) => {
    await commandes.POST(requete("/api/usine/commandes", commande()));
    await poser("cmd-cmd-essai-0001", { statut });
    const r = await lire("cmd-essai-0001");
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("etat_incompatible");
  });
  it("garde : sans jeton 401, porte éteinte 404, sans contrat 426, champ d'état 400 ; instantané identique", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande()));
    const avant = await instantane();
    expect((await lire("cmd-essai-0001", { contrat: 2 }, null)).status).toBe(401);
    expect((await lire("cmd-essai-0001", {})).status).toBe(426);
    for (const champ of ["statut", "etatValidation", "valideeLe", "programmee", "zernio"]) {
      const r = await lire("cmd-essai-0001", { contrat: 2, [champ]: "x" });
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await lire("cmd-essai-0001")).status).toBe(404);
    expect(await instantane()).toBe(avant);
  });
  it("lecture seule : aucune écriture, même « Tout arrêter » actif", async () => {
    await commandes.POST(requete("/api/usine/commandes", commande()));
    vi.stubEnv("USINE_TOUT_ARRETER", "1");
    const avant = await instantane();
    expect((await lire("cmd-essai-0001")).status).toBe(200);
    expect(await instantane()).toBe(avant);
  });
});
