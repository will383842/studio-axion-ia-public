/**
 * TXT-SOURCE · le texte du post s'écrit depuis le vrai script (relié, sinon gardé par le générateur), le titre en dernier
 * recours, et l'écran le dit. Aucun appel réel : le rédacteur « texte-reseaux » est une doublure, données fictives.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const fournisseurs = await import("@/fournisseurs");
const src = await import("@/services/source-texte-post");

const MDP = "essai-txt-source";
const VIDEO = "v-15";
const TITRE = "Zorbluxe le titre inventé";
const SCRIPT_RELIE = "Voici le script relié de la vidéo fictive.";
const SCRIPT_TABLEAU = "Voici le texte dit du brouillon du tableau.";
const SCRIPT_FACECAM = "Voici le script validé de la face caméra animée.";

const bloc = (texte: string) => [{ id: "b1", blocRecette: "explication", segments: [{ id: "s1", texte }] }];
async function poser(e: { scriptRelie?: string | null; tableau?: string; facecam?: string; garderKit?: boolean }) {
  const d = depots();
  const v = (await d.videos.obtenir(VIDEO))!;
  if (!e.garderKit) for (const k of await d.kits.lister((x) => x.videoId === VIDEO)) await d.kits.supprimer(k.id);
  let scriptId: string | undefined;
  if (e.scriptRelie !== undefined && e.scriptRelie !== null) {
    const s = (v.scriptId ? await d.scripts.obtenir(v.scriptId) : null) ?? (await d.scripts.lister(() => true))[0];
    await d.scripts.modifier(s.id, { blocs: bloc(e.scriptRelie) } as never);
    scriptId = s.id;
  }
  await d.videos.modifier(VIDEO, { titre: TITRE, scriptId, entrees: { ...(v.entrees ?? {}), ...(e.tableau ? { tableauCreation: { donnees: { texte: e.tableau }, versions: [] } } : {}) } } as never);
  if (e.facecam) {
    const ver = (await d.versions.obtenir("v-15-ver-1"))!;
    await d.versions.modifier(ver.id, { commande: { ...ver.commande, entrees: { facecamAnimee: { texteValide: e.facecam } } } } as never);
  }
}
const kitInstagram = async () => (await pub.obtenirKit(VIDEO))!;

let redacteur: ReturnType<typeof vi.spyOn>;
const demandes = () => redacteur.mock.calls.map((c: unknown[]) => c[0] as { texteScript: string; titre: string });
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.restoreAllMocks();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  redacteur = vi.spyOn(fournisseurs.resoudreFournisseur("texte-reseaux", null), "ecrire");
});

describe("TXT-SOURCE · choix de la source (pur)", () => {
  it("le script relié passe avant le script gardé, qui passe avant le titre", () => {
    expect(src.choisirSourceTextePost({ scriptRelie: "A", gardes: ["B"], titre: "T" })).toEqual({ texte: "A", origine: "script" });
    expect(src.choisirSourceTextePost({ scriptRelie: null, gardes: [null, "B", "C"], titre: "T" })).toEqual({ texte: "B", origine: "generateur" });
    expect(src.choisirSourceTextePost({ gardes: [], titre: "T" })).toEqual({ texte: "T", origine: "titre" });
  });
  it("un script vide, blanc ou illisible compte comme absent (le script provisoire d'un brouillon est vide)", () => {
    expect(src.choisirSourceTextePost({ scriptRelie: "   ", gardes: ["", undefined, 42 as never, " B "], titre: "T" })).toEqual({ texte: "B", origine: "generateur" });
    expect(src.choisirSourceTextePost({ scriptRelie: "", gardes: [], titre: "T" }).origine).toBe("titre");
  });
  it("lit le texte dit du tableau, de la face caméra animée, des écrans du cas concret et de la fiche image → vidéo ; vide ou illisible : rien", () => {
    expect(src.scriptGardeTableau({ tableauCreation: { donnees: { texte: " Dit tableau " }, versions: [] } })).toBe("Dit tableau");
    expect(src.scriptGardeTableau({ tableauCreation: "x" })).toBeNull();
    expect(src.scriptGardeTableau(undefined)).toBeNull();
    expect(src.scriptGardeFacecam({ facecamAnimee: { texteValide: "Dit face caméra" } })).toBe("Dit face caméra");
    expect(src.scriptGardeFacecam({ facecamAnimee: { texteValide: "  " } })).toBeNull();
    expect(src.scriptGardeEcrans([{ texteDit: "Un." }, { texteDit: "Deux." }, { texteDit: 3 }])).toBe("Un. Deux.");
    expect(src.scriptGardeEcrans("pas un tableau")).toBeNull();
    expect(src.scriptGardeEcrans([])).toBeNull();
  });
});

describe("TXT-SOURCE · le texte demandé au rédacteur", () => {
  it("(1) script relié : la demande porte ce script, le kit ne dit pas « titre »", async () => {
    await poser({ scriptRelie: SCRIPT_RELIE });
    const kit = await kitInstagram();
    expect(demandes().length).toBeGreaterThan(0);
    for (const d of demandes()) expect(d.texteScript).toBe(SCRIPT_RELIE);
    expect(kit.texteDepuis).toBeUndefined();
  });
  it("(1) sans script relié : le brouillon du tableau", async () => {
    await poser({ scriptRelie: null, tableau: SCRIPT_TABLEAU });
    const kit = await kitInstagram();
    for (const d of demandes()) expect(d.texteScript).toBe(SCRIPT_TABLEAU);
    expect(kit.texteDepuis).toBeUndefined();
  });
  it("(1) sans script relié : le script validé de la face caméra animée", async () => {
    await poser({ scriptRelie: null, facecam: SCRIPT_FACECAM });
    await kitInstagram();
    for (const d of demandes()) expect(d.texteScript).toBe(SCRIPT_FACECAM);
  });
  it("(1) le script relié passe avant celui du générateur", async () => {
    await poser({ scriptRelie: SCRIPT_RELIE, tableau: SCRIPT_TABLEAU, facecam: SCRIPT_FACECAM });
    await kitInstagram();
    for (const d of demandes()) expect(d.texteScript).toBe(SCRIPT_RELIE);
  });
  it("(2) sans aucun script : le titre sert de source et la vue le dit", async () => {
    await poser({ scriptRelie: null });
    const kit = await kitInstagram();
    for (const d of demandes()) expect(d.texteScript).toBe(TITRE);
    expect(kit.texteDepuis).toBe("titre");
  });
  it("(2) un script relié vide (brouillon provisoire) : retombe sur le titre et le dit", async () => {
    await poser({ scriptRelie: "   " });
    expect((await kitInstagram()).texteDepuis).toBe("titre");
  });
  it("(3) avec un script fictif, aucun mot du titre absent du script n'entre dans le texte demandé", async () => {
    await poser({ scriptRelie: SCRIPT_RELIE });
    await kitInstagram();
    const motsScript = new Set(SCRIPT_RELIE.toLowerCase().split(/\W+/));
    const absents = TITRE.toLowerCase().split(/\W+/).filter((m) => m && !motsScript.has(m));
    expect(absents.length).toBeGreaterThan(0);
    for (const d of demandes()) for (const m of absents) expect(d.texteScript.toLowerCase()).not.toContain(m);
  });
  it("(4) une retouche à la main n'est jamais écrasée, même quand un script apparaît ensuite", async () => {
    await poser({ scriptRelie: null });
    await pub.genererKit(VIDEO);
    await pub.modifierTexteKit(VIDEO, "instagram", "Ma retouche", ["#moi"]);
    await poser({ scriptRelie: SCRIPT_RELIE, garderKit: true });
    const insta = (await kitInstagram()).reseaux.find((r) => r.reseau === "instagram")!;
    expect(insta.texte).toBe("Ma retouche");
    expect(insta.origine).toBe("main");
    expect((await kitInstagram()).reseaux.find((r) => r.reseau === "instagram")!.texte).toBe("Ma retouche");
  });
});
