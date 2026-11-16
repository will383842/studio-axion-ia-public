/**
 * Porte v2, appel 3 : validation venue de l'Usine (POST /api/usine/commandes/<clé>/validation).
 * La route n'appelle que `validerEntreeServeur` (CAL-21) : ici il est remplacé par un double qui compte les appels.
 * Dépôts en mémoire, aucun réseau, aucun diffuseur, secrets d'essai, données fictives (2099). Écrit en avance.
 */
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: { id: string; par: string }[] = [];
const comportement: { refus?: string; vrai?: boolean } = {};
// Par défaut on remplace le câblage serveur (`validerEntreeDuServeur`) par un double qui compte les appels ;
// avec `comportement.vrai`, c'est le vrai `validerEntreeServeur` de CAL-21.
vi.mock("@/services/porte-validation", async (original) => {
  const reel = await original<typeof import("@/services/porte-validation")>();
  const { depots } = await import("@/donnees/memoire");
  return {
    ...reel,
    validerEntreeDuServeur: async (id: string, par: string) => {
      if (comportement.vrai) return reel.validerEntreeDuServeur(id, par);
      appels.push({ id, par });
      await new Promise((r) => setTimeout(r, 5));
      if (comportement.refus) return { ok: false, message: comportement.refus };
      const c = (await depots().creneauxEditoriaux.obtenir(id))!;
      const maj = { ...c, statut: "valide" as const, valideeLe: "2099-01-01T00:00:00.000Z", valideePar: par };
      await depots().creneauxEditoriaux.enregistrer(maj);
      return { ok: true, donnees: maj };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const commandes = await import("@/app/api/usine/commandes/route");
const aValider = await import("@/app/api/usine/commandes/[id]/a-valider/route");
const validation = await import("@/app/api/usine/commandes/[id]/validation/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const ID = "cmd-cmd-essai-0001";
const requete = (url: string, corps: unknown, secret: string | null = SECRET) => {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(`http://studio.test${url}`, { method: "POST", headers: h, body: JSON.stringify(corps) });
};
const empreinte = async (cle = "cmd-essai-0001") =>
  (await (await aValider.POST(requete(`/api/usine/commandes/${cle}/a-valider`, { contrat: 2 }), { params: Promise.resolve({ id: cle }) })).json()).empreinte as string;
const valider = (corps: Record<string, unknown>, cle = "cmd-essai-0001", secret: string | null = SECRET) =>
  validation.POST(requete(`/api/usine/commandes/${cle}/validation`, corps, secret), { params: Promise.resolve({ id: cle }) });
const corpsValide = (empreinteHex: string, extra: Record<string, unknown> = {}) => ({
  contrat: 2, etape: "video", decision: "valide", empreinte: empreinteHex, valide_par: "compte-usine", valide_le: "2099-12-01T10:00:00.000Z", ...extra,
});
const commande = () => ({ contrat: 2, cle: "cmd-essai-0001", reseau: "linkedin", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive" });
async function poser(extra: Record<string, unknown>) {
  const c = (await depots().creneauxEditoriaux.obtenir(ID))!;
  await depots().creneauxEditoriaux.enregistrer({ ...c, ...extra } as typeof c);
}
const instantane = async () => {
  const d = depots();
  return JSON.stringify([await d.creneauxEditoriaux.lister(), await d.parametres.lister(), await d.journalDecalages.lister()]);
};
const statutCreneau = async () => (await depots().creneauxEditoriaux.obtenir(ID))!;

beforeEach(async () => {
  appels.length = 0;
  comportement.refus = undefined;
  comportement.vrai = false;
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
  await commandes.POST(requete("/api/usine/commandes", commande()));
});

describe("critère 1 : un seul chemin vers « Programmé »", () => {
  it("les trois fichiers source n'importent ni n'écrivent rien au-delà de « a_valider »", () => {
    for (const f of ["src/services/porte-validation.ts", "src/app/api/usine/commandes/[id]/validation/route.ts", "src/app/api/usine/commandes/[id]/a-valider/route.ts"]) {
      const source = readFileSync(f, "utf8");
      expect(source, f).not.toMatch(/validerProposition|transitionner|promouvoirEnvoisPlanifies|envoyerDepuisCreneau|@\/fournisseurs|zernio/i);
      expect(source, f).not.toMatch(/statut:\s*"(valide|programme|publie|echec)"/);
    }
  });
});

describe("validation : un appel, une trace", () => {
  it("créneau « propose » : passage à « a_valider » puis un seul appel, trace usine:<compte>", async () => {
    const r = await valider(corpsValide(await empreinte()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "a_valider", valideeLe: "2099-01-01T00:00:00.000Z", deja: false });
    expect(appels).toEqual([{ id: ID, par: "usine:compte-usine" }]);
    expect((await statutCreneau()).valideePar).toBe("usine:compte-usine");
  });
  it("rejeu identique : 0 appel de plus, deja: true", async () => {
    const e = await empreinte();
    await valider(corpsValide(e));
    const r = await valider(corpsValide(e));
    expect(await r.json()).toMatchObject({ etat: "a_valider", deja: true });
    expect(appels).toHaveLength(1);
  });
  it("deux appels simultanés : un seul appel au service, l'autre répond deja: true", async () => {
    const e = await empreinte();
    const [a, b] = await Promise.all([valider(corpsValide(e)), valider(corpsValide(e))]);
    expect(appels).toHaveLength(1);
    const deja = [(await a.json()).deja, (await b.json()).deja].sort();
    expect(deja).toEqual([false, true]);
  });
  it("déjà validé par le fondateur dans le Studio : 0 appel, deja: true", async () => {
    const e = await empreinte();
    await poser({ statut: "valide", valideeLe: "2099-11-01T10:00:00.000Z", valideePar: "fondateur" });
    const r = await valider(corpsValide(e));
    expect(await r.json()).toEqual({ etat: "a_valider", valideeLe: "2099-11-01T10:00:00.000Z", deja: true });
    expect(appels).toHaveLength(0);
  });
  it("refus de CAL-21 (heure passée) : 409 etat_incompatible avec son message, rien d'autre écrit", async () => {
    comportement.refus = "Heure passée : déplacez la publication avant de la valider.";
    const e = await empreinte();
    await poser({ statut: "a_valider" });
    const avant = await instantane();
    const r = await valider(corpsValide(e));
    expect(r.status).toBe(409);
    const corps = await r.json();
    expect(corps.code).toBe("etat_incompatible");
    expect(corps.erreur).toContain("déplacez la publication");
    expect(await instantane()).toBe(avant);
  });
  it.each(["programme", "publie", "echec", "archive"])("statut %s : 409, 0 appel", async (statut) => {
    const e = await empreinte();
    await poser({ statut });
    const r = await valider(corpsValide(e));
    expect(r.status).toBe(409);
    expect(appels).toHaveLength(0);
  });
});

describe("vrai service CAL-21", () => {
  it("réglages absents : validé sous usine:compte-usine, 0 appel au faux diffuseur, trace dans le journal", async () => {
    comportement.vrai = true;
    const diffuseur = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", diffuseur);
    try {
      const e = await empreinte();
      const r = await valider(corpsValide(e, { note: "Note privée." }));
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ etat: "a_valider", deja: false });
      const c = await statutCreneau();
      expect(c.statut).toBe("valide");
      expect(c.valideePar).toBe("usine:compte-usine");
      expect(diffuseur).toHaveBeenCalledTimes(0);
      expect(appels).toHaveLength(0);
      const lignes = (await depots().evenements.lister()).filter((x) => x.type === "porte" && x.message.startsWith("Validation usine"));
      expect(lignes).toHaveLength(1);
      expect(lignes[0].message).toContain(`cmd-essai-0001 étape video décision valide empreinte ${e.slice(0, 12)} par usine:compte-usine`);
      expect(lignes[0].message).not.toContain(e);
      expect(lignes[0].message).not.toContain("Note privée");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("trace et champs", () => {
  it.each([
    ["absent", undefined],
    ["avec @", "nom@exemple.fr"],
    ["trop long", "a".repeat(61)],
    ["majuscules", "Compte-Usine"],
  ])("valide_par %s : 400 champ_invalide, 0 appel", async (_n, valeur) => {
    const corps = corpsValide(await empreinte());
    if (valeur === undefined) delete (corps as Record<string, unknown>).valide_par;
    else corps.valide_par = valeur;
    const r = await valider(corps);
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("champ_invalide");
    expect(appels).toHaveLength(0);
  });
  it.each([
    ["decision", "peut-etre"], ["etape", "audio"], ["empreinte", "abc"], ["valide_le", "demain"],
  ])("%s illisible : 400 champ_invalide", async (champ, valeur) => {
    const r = await valider({ ...corpsValide(await empreinte()), [champ]: valeur });
    expect(r.status).toBe(400);
    expect(appels).toHaveLength(0);
  });
  it("refus sans code, code inconnu ou note de plus de 300 signes : 400", async () => {
    const e = await empreinte();
    for (const extra of [{}, { refus_code: "n_importe_quoi" }, { refus_code: "image", note: "x".repeat(301) }, { refus_code: "image", note: "deux\nlignes" }]) {
      expect((await valider(corpsValide(e, { decision: "refuse", ...extra }))).status).toBe(400);
    }
  });
});

describe("empreinte, garde, arrêt, script", () => {
  it("empreinte périmée (heure déplacée) : 409 version_perimee, rien d'écrit, 0 appel", async () => {
    const e = await empreinte();
    await poser({ heuresParReseau: { linkedin: "2099-12-10T09:00:00.000Z" } });
    const avant = await instantane();
    const r = await valider(corpsValide(e));
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("version_perimee");
    expect(appels).toHaveLength(0);
    expect(await instantane()).toBe(avant);
  });
  it("garde : 401, 404, 426 et champs d'état refusés ; instantané identique, 0 appel", async () => {
    const e = await empreinte();
    const avant = await instantane();
    expect((await valider(corpsValide(e), "cmd-essai-0001", null)).status).toBe(401);
    expect((await valider({ ...corpsValide(e), contrat: undefined })).status).toBe(426);
    for (const champ of ["statut", "etatValidation", "valideeLe", "programmee", "zernio"]) {
      const r = await valider({ ...corpsValide(e), [champ]: "x" });
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await valider(corpsValide(e))).status).toBe(404);
    expect(appels).toHaveLength(0);
    expect(await instantane()).toBe(avant);
  });
  it("« Tout arrêter » : 423 tout_arrete sur l'appel 3, la lecture 2 bis répond", async () => {
    const e = await empreinte();
    vi.stubEnv("USINE_TOUT_ARRETER", "1");
    const avant = await instantane();
    const r = await valider(corpsValide(e));
    expect(r.status).toBe(423);
    expect((await r.json()).code).toBe("tout_arrete");
    expect(appels).toHaveLength(0);
    expect(await instantane()).toBe(avant);
    expect(await empreinte()).toBe(e);
  });
  it("étape script : 409 etat_incompatible, 0 appel", async () => {
    const r = await valider(corpsValide(await empreinte(), { etape: "script" }));
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("etat_incompatible");
    expect(appels).toHaveLength(0);
  });
  it("créneau inconnu : 404", async () => {
    expect((await valider(corpsValide("0".repeat(64)), "cmd-inconnue-01")).status).toBe(404);
  });
});

describe("refus", () => {
  it("refus : archivé avec refuseLe et motif code + note, toujours lisible (refusee), rejeu deja: true", async () => {
    const e = await empreinte();
    const corps = corpsValide(e, { decision: "refuse", refus_code: "accroche_faible", note: "Accroche trop longue." });
    const r = await valider(corps);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ etat: "refusee", deja: false, refuseLe: expect.any(String) });
    const c = await statutCreneau();
    expect(c.statut).toBe("archive");
    expect(c.motifRefus).toBe("accroche_faible : Accroche trop longue.");
    expect(appels).toHaveLength(0);
    expect(await (await valider(corps)).json()).toMatchObject({ etat: "refusee", deja: true });
    expect(await depots().creneauxEditoriaux.obtenir(ID)).toBeTruthy();
  });
  it("refus après validation : 409", async () => {
    const e = await empreinte();
    await poser({ statut: "valide", valideeLe: "2099-11-01T10:00:00.000Z", valideePar: "x" });
    expect((await valider(corpsValide(e, { decision: "refuse", refus_code: "image" }))).status).toBe(409);
  });
});

describe("aucun envoi", () => {
  it("la réponse ne contient ni nom de diffuseur ni identifiant de publication", async () => {
    const r = await valider(corpsValide(await empreinte()));
    expect(JSON.stringify(await r.json())).not.toMatch(/zernio|buffer|postId|publicationId/i);
  });
});
