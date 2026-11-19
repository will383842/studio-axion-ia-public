/**
 * G3-06b : démo facecam, envoi réel des deux vidéos et lancement depuis la vitrine, derrière `demoFacecam.envoi` (éteint par défaut).
 * Chemin réel : vraies actions, dépôts mémoire, fichiers créés par le vrai `deposerFichierSimule`. Aucun euro dépensé.
 */
import { hash } from "@node-rs/argon2";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { deposerFichierSimule } = await import("@/services/fichiers");
const { creerDemoDepuisEnvoi } = await import("@/app/(studio)/demo-facecam/actions-envoi");
const { FormulaireDemoFacecam } = await import("@/components/formats/vitrines/FormulaireDemoFacecam");
const { enchainerEnvoiDemo, demanderLancementDemo } = await import("@/components/formats/vitrines/EnvoiDemoFacecam");
const PageDemoFacecam = (await import("@/app/(studio)/demo-facecam/page")).default;

const MDP = "essai-envoi-demo-facecam";
/** HTML de la vitrine pris sur master (43a5845f) le 19/11/2026, AVANT toute modification. */
const HTML_MASTER = `<form class="space-y-4"><div><label for="_R_1_" class="mb-1.5 block text-sm font-semibold text-texte-doux">Titre</label><div class="flex items-center gap-2 rounded-champ border bg-surface-1 px-3.5 transition-colors focus-within:border-accent min-h-12 border-trait hover:border-trait-fort"><input id="_R_1_" class="min-w-0 flex-1 bg-transparent text-texte outline-none placeholder:text-texte-faible text-[15px]" value=""/></div></div><label class="block text-sm font-semibold text-texte-doux">Votre vidéo facecam<input type="file" accept="video/*" class="mt-1.5 block w-full text-sm"/></label><label class="block text-sm font-semibold text-texte-doux">Votre enregistrement d&#x27;écran (facultatif)<input type="file" accept="video/*" class="mt-1.5 block w-full text-sm"/></label><ul class="space-y-1.5" aria-label="Remarques"><li class="flex items-start gap-2 text-sm text-texte-doux"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info mt-0.5 shrink-0 text-ambre" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>Déposez votre vidéo facecam, et si vous l&#x27;avez votre enregistrement d&#x27;écran.</li></ul><button type="submit" class="relative inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-studio active:scale-[0.98] disabled:pointer-events-none disabled:border-surface-3 disabled:bg-surface-3 disabled:text-texte-faible disabled:shadow-none disabled:opacity-100 bg-orange text-sur-orange shadow-orange hover:bg-orange-vif active:brightness-95 min-h-11 px-4 text-sm gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-columns-2 lucide-columns" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M12 3v18"></path></svg>Préparer la démo</button></form>`;

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const deposer = (entiteId: string, nom = "a.mp4") => deposerFichierSimule({ nom, mime: "video/mp4", taille: 1000, typeEntite: "entree", entiteId });
const nbVideos = async () => (await depots().videos.lister()).length;

describe("a) éteint = identique", () => {
  it("la vitrine sans propriété et avec envoi={false} est celle de master, au caractère près", () => {
    expect(renderToStaticMarkup(<FormulaireDemoFacecam />)).toBe(HTML_MASTER);
    expect(renderToStaticMarkup(<FormulaireDemoFacecam envoi={false} />)).toBe(HTML_MASTER);
  });

  it.each([
    ["absent", undefined],
    ["false", false],
    ['"true" (texte)', "true"],
  ])("la page, réglage %s : « Préparer la démo », aucun envoi", async (_n, valeur) => {
    if (valeur !== undefined) await ecrireParametre("demoFacecam.envoi", valeur);
    const html = renderToStaticMarkup(await PageDemoFacecam());
    expect(html).toContain("Préparer la démo");
    expect(html).not.toContain("Lancer la démo");
  });

  it("allumé (true exact) : la page montre l'écran d'envoi", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const html = renderToStaticMarkup(await PageDemoFacecam());
    expect(html).toContain("Envoyer et préparer la démo");
    expect(html).not.toContain("pas encore branchée");
  });
});

describe("b) creerDemoDepuisEnvoi", () => {
  it("éteint : DEMO_FERMEE, aucune vidéo", async () => {
    const f = await deposer("demo-aaa");
    const avant = await nbVideos();
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-aaa", facecamFichierId: f.id });
    expect(r).toMatchObject({ ok: false, code: "DEMO_FERMEE" });
    expect(await nbVideos()).toBe(avant);
  });

  it("allumé + 2 fichiers : brouillon demo-facecam avec les deux clés", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const f = await deposer("demo-aaa", "f.mp4");
    const e = await deposer("demo-aaa", "e.mp4");
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-aaa", facecamFichierId: f.id, ecranFichierId: e.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await depots().videos.obtenir(r.donnees.videoId);
    expect(v?.formatId).toBe("demo-facecam");
    const d = (v?.entrees as { demoFacecam: { facecam: { cle: string }; ecran?: { cle: string } } }).demoFacecam;
    expect(d.facecam.cle).toBe(f.cleStockage);
    expect(d.ecran?.cle).toBe(e.cleStockage);
  });

  it("allumé + facecam seule : pas d'écran", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const f = await deposer("demo-aaa");
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-aaa", facecamFichierId: f.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = ((await depots().videos.obtenir(r.donnees.videoId))?.entrees as { demoFacecam: Record<string, unknown> }).demoFacecam;
    expect(d.ecran).toBeUndefined();
  });

  it("fichier d'un autre entiteId : refus, aucune vidéo", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const f = await deposer("demo-autre");
    const avant = await nbVideos();
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-aaa", facecamFichierId: f.id });
    expect(r.ok).toBe(false);
    expect(await nbVideos()).toBe(avant);
  });
});

const fichier = (nom: string) => new File(["x"], nom, { type: "video/mp4" });

describe("c) enchaînement de l'écran", () => {
  it("2 envois puis 1 création, aucun lancement", async () => {
    const appels: string[] = [];
    const r = await enchainerEnvoiDemo({
      titre: "Démo",
      entiteId: "demo-abc",
      facecam: fichier("f.mp4"),
      ecran: fichier("e.mp4"),
      envoyer: async (f, cible) => {
        appels.push(`envoi:${f.name}:${cible.typeEntite}:${cible.entiteId}`);
        return { fichierId: `id-${f.name}` };
      },
      creer: async (e) => {
        appels.push(`creation:${e.facecamFichierId}:${e.ecranFichierId}`);
        return { ok: true, donnees: { videoId: "v1" } };
      },
    });
    expect(r).toEqual({ ok: true, videoId: "v1" });
    expect(appels).toEqual(["envoi:f.mp4:entree:demo-abc", "envoi:e.mp4:entree:demo-abc", "creation:id-f.mp4:id-e.mp4"]);
  });

  it("envoi en échec : phrase française, création jamais appelée", async () => {
    const creer = vi.fn();
    const r = await enchainerEnvoiDemo({
      titre: "Démo",
      entiteId: "demo-abc",
      facecam: fichier("f.mp4"),
      envoyer: async () => {
        throw new Error("boom");
      },
      creer,
    });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.message).toMatch(/envoy/);
    expect(creer).not.toHaveBeenCalled();
  });

  it("lancement : accord-requis montre le prix, 2e appel avec le prix", async () => {
    const lancer = vi.fn(async (_id: string, accord: unknown) =>
      accord === null
        ? { ok: true as const, donnees: { statut: "accord-requis" as const, centimes: 0, phrase: "x" } }
        : { ok: true as const, donnees: { statut: "lancee" as const, travailId: "t1" } },
    );
    const a = await demanderLancementDemo(lancer, "v1", null);
    expect(a).toEqual({ statut: "accord-requis", centimes: 0, prix: "0,00\u00a0€" });
    const b = await demanderLancementDemo(lancer, "v1", a.statut === "accord-requis" ? a.centimes : -1);
    expect(b).toEqual({ statut: "lancee", travailId: "t1" });
    expect(lancer.mock.calls).toEqual([["v1", null], ["v1", 0]]);
  });

  it("lancement refusé : phrase du serveur, rien de lancé", async () => {
    const r = await demanderLancementDemo(async () => ({ ok: false, message: "Non." }), "v1", null);
    expect(r).toEqual({ statut: "erreur", message: "Non." });
  });
});
