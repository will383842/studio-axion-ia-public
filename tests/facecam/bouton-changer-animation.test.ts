/**
 * S-09b-FACECAM-BOUTON-CARTE · « Changer l'animation » d'une carte posée par le monteur (0 €, sans Claude).
 * Chemin réel : vrai `changerAnimationCarte` du service, dépôts mémoire ; seul `lancerRetouche` est remplacé (une nouvelle
 * version en fabrication, comme la vraie, sans moteur). Le composant est rendu côté serveur (pas de jsdom) ; le clic passe par
 * la fonction de choix extraite, comme le test voisin du bouton « Animations ».
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { lireEntreesFacecam } from "@/domaine/facecam";
import { modelesPossibles } from "@/moteurs/montage-facecam/monteur/modeles-possibles";
import { MODELES_CARTE } from "@/moteurs/montage-facecam/monteur/operations";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/videos/v-04", useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

const retouches: { versionId: string; consigne: string; entrees?: Record<string, unknown> }[] = [];
let appelsClaude = 0;
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, _plans: string[], consigne: string, options: { entrees?: Record<string, unknown> } = {}) => {
      const { depots } = await import("@/donnees/memoire");
      const v = (await depots().videos.obtenir(videoId))!;
      const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
      const n = retouches.length + 1;
      const versionId = `ver-anim-${n}`;
      const travailId = `trav-anim-${n}`;
      retouches.push({ versionId, consigne, entrees: options.entrees });
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 100 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "retouche", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});
// Double compteur « 0 appel Claude » : le chemin de dépense Claude de la vidéo est compté (le réseau est aussi interdit).
vi.mock("@/services/depense-claude-video", async (original) => {
  const vrai = await original<typeof import("@/services/depense-claude-video")>();
  return {
    ...vrai,
    executerRolePourVideo: (...a: Parameters<typeof vrai.executerRolePourVideo>) => {
      appelsClaude++;
      return vrai.executerRolePourVideo(...a);
    },
  };
});
const actionAppelee = vi.fn(async (...a: unknown[]) => ({ ok: true as const, travailId: String(a.length) }));
vi.mock("@/app/(studio)/videos/actions-facecam", () => ({
  changerTexteCarteAction: vi.fn(),
  deplacerCarteAction: vi.fn(),
  remettreCarteAutoAction: vi.fn(),
  retirerCarteAutoAction: vi.fn(),
  retirerPassageAction: vi.fn(),
  changerAnimationCarteAction: (...a: unknown[]) => actionAppelee(...a),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/monteur-facecam");
const { CartesVideoFacecam, choisirAnimation } = await import("@/components/facecam/CartesVideoFacecam");

const MDP = "essai-animation-carte";
const VIDEO = "v-04";
const TEXTES = ["Trois étapes", "Un", "Deux", "Trois"];

function passage(id: string, modele: string | null, textes: string[]) {
  return {
    id,
    type: "carte",
    debutSec: 10,
    finSec: 16,
    ...(modele ? { modele } : {}),
    texte: textes.join(" · "),
    origine: "demande",
    ancre: { debutPriseSec: 10, finPriseSec: 16 },
    operation: { type: "ajouterCarte", debutMot: 3, finMot: 9, modele, textes, html: null, disposition: "plein-ecran", description: "essai", animationGardeeId: null },
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  retouches.length = 0;
  appelsClaude = 0;
  vi.stubGlobal("fetch", (async () => {
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "facecam", statut: "prete", ratios: ["9:16"] });
  const facecam = { passages: [passage("p-liste", "liste", TEXTES), passage("p-mesure", null, ["Sur mesure"])] };
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", ratios: ["9:16"], entrees: { facecam } }, statut: "prete" });
});
afterEach(() => vi.unstubAllGlobals());

const impossibles = () => MODELES_CARTE.filter((m) => m !== "liste" && !modelesPossibles(TEXTES, "liste").includes(m));

describe("changerAnimationCarte (chemin réel)", () => {
  it("a) une nouvelle version : la carte garde id, ancre, textes ; seul le modèle change ; 0 appel Claude", async () => {
    const cible = modelesPossibles(TEXTES, "liste")[0];
    expect(cible).toBeDefined();
    const r = await service.changerAnimationCarte(VIDEO, "p-liste", cible);
    expect(r.travailId).toBeTruthy();
    expect(retouches).toHaveLength(1);
    expect(retouches[0].consigne).toBe(`Animation de carte changée : ${cible}`);
    const p = lireEntreesFacecam(retouches[0].entrees!).passages.find((x) => x.id === "p-liste") as unknown as ReturnType<typeof passage>;
    expect(p.modele).toBe(cible);
    expect(p.operation.modele).toBe(cible);
    expect(p.operation.textes).toEqual(TEXTES);
    expect(p.ancre).toEqual({ debutPriseSec: 10, finPriseSec: 16 });
    expect(p.debutSec).toBe(10);
    expect(appelsClaude).toBe(0);
  });

  it("b) un modèle où les textes ne tiennent pas : erreur claire, aucune version", async () => {
    const mauvais = impossibles()[0];
    expect(mauvais).toBeDefined();
    await expect(service.changerAnimationCarte(VIDEO, "p-liste", mauvais)).rejects.toMatchObject({ name: "ErreurStudio", message: expect.stringContaining("ne tiennent pas") });
    expect(retouches).toHaveLength(0);
  });

  it("c) carte sur mesure, carte automatique ou inconnue : refus clair, aucune version", async () => {
    await expect(service.changerAnimationCarte(VIDEO, "p-mesure", "liste")).rejects.toMatchObject({ message: expect.stringContaining("sur mesure") });
    await expect(service.changerAnimationCarte(VIDEO, "auto-0-liste", "liste")).rejects.toMatchObject({ name: "ErreurStudio" });
    await expect(service.changerAnimationCarte(VIDEO, "inconnue", "liste")).rejects.toMatchObject({ name: "ErreurStudio" });
    expect(retouches).toHaveLength(0);
    expect(appelsClaude).toBe(0);
  });
});

describe("CartesVideoFacecam : choix de l'animation", () => {
  const carte = (o: Record<string, unknown> = {}) => ({ id: "p-liste", origine: "monteur", type: "carte", modele: "liste", textes: TEXTES, debutSec: 10, finSec: 16, etat: "posee", deplacable: true, texteModifiable: true, ...o });
  const rendre = (cartes: unknown[]) => renderToStaticMarkup(createElement(CartesVideoFacecam, { videoId: VIDEO, cartes: cartes as never, possible: true, envoi: false, geste: () => undefined }));
  const options = (html: string) => [...(html.match(/<select[\s\S]*?<\/select>/)?.[0] ?? "").matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);

  it("d) montre seulement les modèles possibles, jamais l'actuel ni un modèle où les textes ne tiennent pas", () => {
    const html = rendre([carte()]);
    expect(html).toContain("Changer l&#x27;animation");
    expect(options(html).sort()).toEqual([...modelesPossibles(TEXTES, "liste")].sort());
    for (const m of impossibles()) expect(options(html)).not.toContain(m);
    expect(options(html)).not.toContain("liste");
  });

  it("d) pas de choix sur une carte automatique, une carte sur mesure ou un zoom", () => {
    for (const c of [carte({ origine: "auto" }), carte({ modele: "sur-mesure" }), carte({ type: "zoom" })]) expect(rendre([c])).not.toContain("Changer l&#x27;animation");
  });

  it("d) le choix appelle l'action avec la vidéo, la carte et le modèle", async () => {
    const geste = vi.fn(async (action: () => Promise<unknown>) => {
      await action();
    });
    choisirAnimation(geste as never, VIDEO, "p-liste", "chiffre");
    await Promise.resolve();
    expect(actionAppelee).toHaveBeenCalledWith(VIDEO, "p-liste", "chiffre");
  });
});
