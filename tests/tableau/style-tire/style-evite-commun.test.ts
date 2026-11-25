/**
 * BR-TABLEAU-STYLE-b2 : le style tiré du tableau évite les styles des voisines déjà publiées (réglage `varieteCommune`).
 * PAR LE CHEMIN RÉEL : `decouperScriptTableau` puis la boucle de fond `travaillerTachesTableau` (donc `executerDecoupage`),
 * dépôts en mémoire, double de Claude, aucun appel payant. ÉTEINT par défaut : `varieteCommune` absent = tirage identique à master.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereTexte } from "@/domaine/relecture-tableau";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
// Le tirage vu par le découpage : on enregistre le `tirage` reçu par `styleDuDecoupage` (les identifiants de vidéo ne sont pas rejouables).
const vus = vi.hoisted(() => ({ tirages: [] as ({ historique: unknown[]; eviter?: readonly string[] } | undefined)[] }));
vi.mock("../../../src/moteurs/montage-tableau/tirage-style", async (orig) => {
  const vrai = await orig<typeof import("../../../src/moteurs/montage-tableau/tirage-style")>();
  return { ...vrai, styleDuDecoupage: (e: Parameters<typeof vrai.styleDuDecoupage>[0]) => (vus.tirages.push(e.tirage as never), vrai.styleDuDecoupage(e)) };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, travaillerTachesTableau, lireBrouillonTableau, PARAM_STYLE_TIRE_TABLEAU } = await import("@/services/tableau-creation");
const { CLE_HISTORIQUE_STYLES } = await import("@/services/tableau-variete");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "tableau-style-evite-commun";
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["linkedin"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

/** Double de Claude : la fiche d'exemple, AUCUN style de tableau (c'est au code de le poser). */
const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  delete (f as { styleTableau?: string }).styleTableau;
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

/** Une vidéo découpée par le chemin réel ; rend le style tiré. `i` varie le texte (donc l'identifiant et la graine). */
async function decouper(i = 0): Promise<string | undefined> {
  const d = { ...donnees, texte: `${donnees.texte}${" ".repeat(i)}` };
  const relu = repereTexte(d.texte);
  const prix = await decouperScriptTableau(d, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  const r = await decouperScriptTableau(d, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(`découpage non enregistré : ${JSON.stringify(r)}`);
  await travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
  if (b.tache?.statut !== "terminee") throw new Error(`découpage non terminé : ${JSON.stringify(b.tache)}`);
  return b.versions.at(-1)!.fiche.styleTableau;
}

/** Pose une voisine LinkedIn publiée dont le style (noté à l'historique) est `style`, de rang 0 (la plus récente). */
async function poserVoisine(style: StyleTableau, k = 0) {
  const id = `voisine-${k}`;
  await depots().publications.enregistrer({ id: `pub-${id}`, videoId: id, reseau: "linkedin", statut: "publiee", via: "buffer", date: `2026-11-${String(20 - k).padStart(2, "0")}`, texte: "t", creeLe: "2026-11-01T00:00:00Z", modifieLe: "2026-11-01T00:00:00Z" } as never);
  await depots().versions.enregistrer({ id: `ver-${id}`, videoId: id, statut: "prete", numero: 1, creeLe: "2026-11-10T00:00:00Z", commande: { moteurId: "montage-tableau", formatId: "tableau-anime" }, projetMontage: {} } as never);
}

async function preparer(historique: { videoId: string; style: StyleTableau }[]) {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
  await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
  await ecrireParametre(CLE_HISTORIQUE_STYLES, historique);
  for (let k = 0; k < historique.length; k++) await poserVoisine(historique[k].style, k);
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

const HUIT = [0, 1, 2, 3, 4, 5, 6, 7];
/** 8 découpages réels ; l'historique est remis à l'état de départ avant chacun (les identifiants, eux, avancent : 8 graines). */
const huit = async (historique: { videoId: string; style: StyleTableau }[]) => {
  const r: (string | undefined)[] = [];
  for (const i of HUIT) {
    await ecrireParametre(CLE_HISTORIQUE_STYLES, historique);
    r.push(await decouper(i));
  }
  return r;
};
const VOISINE_ARDOISE = [{ videoId: "voisine-0", style: "ardoise" as StyleTableau }];

describe("(a) éteint = identique à master : le tirage ne reçoit aucune liste à éviter", () => {
  it.each([["absent", undefined], ["false", false], ["'true'", "true"], ["{}", {}], ["{ seuil: 'x' }", { seuil: "x" }], ["null", null], ["1", 1]])("varieteCommune %s : 8 découpages, jamais de `eviter`", async (_n, valeur) => {
    await preparer(VOISINE_ARDOISE);
    if (valeur !== undefined) await ecrireParametre("varieteCommune", valeur);
    vus.tirages.length = 0;
    const styles = await huit(VOISINE_ARDOISE);
    expect(styles.every((s) => typeof s === "string")).toBe(true);
    const tires = vus.tirages.filter((t) => t !== undefined); // les appels du prix n'ont pas de tirage
    expect(tires.length).toBeGreaterThan(0);
    for (const t of tires) expect("eviter" in t!).toBe(false);
  });

  it("tableau.styleTire éteint : varieteCommune n'est même pas lu", async () => {
    await preparer([]);
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    await ecrireParametre("varieteCommune", true);
    const parametres = depots().parametres;
    const vraie = parametres.obtenir.bind(parametres);
    const lus: string[] = [];
    const lecture = vi.spyOn(parametres, "obtenir").mockImplementation(async (id: string) => (lus.push(id), vraie(id)));
    try {
      expect(await decouper()).toBeUndefined();
    } finally {
      lecture.mockRestore();
    }
    expect(lus).not.toContain("varieteCommune");
  });
});

describe("(b) allumé : le style de la voisine publiée n'est jamais tiré", () => {
  it("voisine LinkedIn en ardoise (rang 0), vidéo pour LinkedIn : 8 découpages réels, `eviter` = [ardoise], jamais ardoise", async () => {
    await preparer(VOISINE_ARDOISE);
    await ecrireParametre("varieteCommune", true);
    vus.tirages.length = 0;
    const styles = await huit(VOISINE_ARDOISE);
    expect(styles.every((s) => typeof s === "string")).toBe(true);
    expect(styles).not.toContain("ardoise");
    const tires = vus.tirages.filter((t) => t !== undefined);
    expect(tires.length).toBeGreaterThan(0);
    for (const t of tires) expect(t?.eviter).toEqual(["ardoise"]);
  });
});

describe("(c) voisine trop ancienne", () => {
  it("ardoise au rang 2 seulement : elle n'est pas évitée par la variété commune (liste vide)", async () => {
    const { stylesTableauAEviterCommun } = await import("@/services/variete-commune/styles-tableau-commun");
    await preparer([{ videoId: "voisine-0", style: "paperboard" }, { videoId: "voisine-1", style: "paperboard" }, { videoId: "voisine-2", style: "ardoise" }]);
    const liste = await stylesTableauAEviterCommun({ videoId: "en-cours", reseaux: ["linkedin"], le: "2026-11-21T10:00:00.000Z", lire: async (c) => (c === "varieteCommune" ? true : undefined) });
    expect(liste).toEqual(["paperboard"]);
  });
});

describe("(d) tout évité, ou voisines illisibles : le découpage aboutit", () => {
  it("les trois styles évités : un style est tiré, pas d'erreur", async () => {
    await preparer([{ videoId: "voisine-0", style: "ardoise" }, { videoId: "voisine-1", style: "paperboard" }, { videoId: "voisine-2", style: "tableau-blanc" }]);
    await ecrireParametre("varieteCommune", true);
    expect(["ardoise", "paperboard", "tableau-blanc"]).toContain(await decouper());
  });
  it("dépôt des publications qui lève : création OK, rien d'évité", async () => {
    await preparer([{ videoId: "voisine-0", style: "ardoise" }]);
    await ecrireParametre("varieteCommune", true);
    const publications = depots().publications;
    const lecture = vi.spyOn(publications, "lister").mockRejectedValue(new Error("panne"));
    try {
      expect(typeof (await decouper())).toBe("string");
    } finally {
      lecture.mockRestore();
    }
  });
});

describe("(e) un seul lecteur de la clé", () => {
  it("lire-reglage.ts est le seul fichier de src/** qui passe `varieteCommune` à lireParametre", () => {
    const fichiers = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
    const lecteurs = fichiers.filter((f) => /lireParametre(?:<[^()]*?>)?\((?:cle, false|CLE_VARIETE_COMMUNE|"varieteCommune")/.test(readFileSync(f, "utf8")) && /varieteCommune|CLE_VARIETE_COMMUNE|lireVarieteCommune/.test(readFileSync(f, "utf8")));
    expect(lecteurs).toContain("src/services/variete-commune/lire-reglage.ts");
    expect(lecteurs.filter((f) => f !== "src/services/variete-commune/lire-reglage.ts")).toEqual([]);
  });
});
