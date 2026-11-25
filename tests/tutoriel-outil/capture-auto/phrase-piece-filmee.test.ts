/**
 * PHRASE-3 · DE LA PHRASE AU FILM, SANS GESTE AUTRE QUE LES DEUX OUI VOULUS (maquette, script).
 *
 * Une vidéo partie d'UNE phrase (celle du pilote), sans voix, tous les réglages allumés (formulaire, phrase, équipe, Claude, pièce créée,
 * capture automatique) : maquettiste (simulé) → le STUDIO fait l'aperçu seul (aucune image, contrôle de la charte) → pause voulue « votre maquette
 * attend votre choix » → Williams garde la maquette → stratège, scénariste (simulés) → pause voulue « relisez les deux scripts » → Williams valide →
 * silence (mots horodatés) → calage → pause du film → la capture automatique écrit une demande `film-zip` dont le `dossier.zip` est fabriqué par le
 * Studio depuis la maquette GARDÉE → FAUX POSTE : un VRAI petit MP4 + navigation.json et ffprobe.json cohérents → film rangé → la chaîne reprend →
 * plan de scènes → la demande de rendu porte le film. Aucun appel réel (Claude, HeyGen, ElevenLabs piégés), aucun réseau : 0 €.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  const moduleEspion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
    const vrai = await importOriginal();
    return Object.fromEntries(
      Object.entries(vrai).map(([cle, v]) => [
        cle,
        typeof v === "function" && /^[a-z]/.test(cle)
          ? () => {
              appels.push(`${nom}.${cle}`);
              throw new Error(`${nom}.${cle} ne doit pas être appelé : aucun appel réel`);
            }
          : v,
      ]),
    );
  };
  return { appels, moduleEspion };
});
vi.mock("@/fournisseurs/heygen/voix", (o) => pieges.moduleEspion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => pieges.moduleEspion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => pieges.moduleEspion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => pieges.moduleEspion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => pieges.moduleEspion("credits/elevenlabs")(o as never));
vi.mock("@/fournisseurs/claude/client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  envoyerMessage: () => {
    pieges.appels.push("claude/client.envoyerMessage");
    throw new Error("claude/client.envoyerMessage ne doit pas être appelé : aucun appel réel");
  },
}));

import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { ENTREE_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/entrees";
import { ROLES_APPELES, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { CODE_PIECE_A_CONSTRUIRE } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { empreinteDescription, PARAM_ENTREE_PHRASE, PARAM_PIECE_CLAUDE } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PARAM_CAPTURE_AUTO } from "@/services/tutoriel-capture-auto";
import { PARAM_CLAUDE_TUTORIEL } from "@/services/tutoriel-claude";
import { deposerTutoriel, PARAM_FORMULAIRE } from "@/services/tutoriel-depot";
import { PARAM_EQUIPE_TUTORIEL, portsEquipeAvecPhrase } from "@/services/tutoriel-equipe";
import { garderPiece, vuePieceCreee } from "@/services/tutoriel-piece-creee";
import { PHRASE_PARCOURS_HORS_MAQUETTE } from "@/services/tutoriel-piece-construite";
import { PieceCreee } from "@/components/tutoriel-outil/PieceCreee";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { choisirVersion, validerTutoriel } from "@/services/tutoriel-validation";
import { PARAM_ENTREE_ZIP } from "@/services/zip-tutoriel";
import { commandeTutoriel, outilsDoubles, type Journal } from "../doubles";
import { planDuDouble, scriptsDuDouble, type MomentFiche } from "../phrase/phrases";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { avancerCapturesTutoriel } = await import("@/services/tutoriel-capture-auto");
const { ecrireParametre } = await import("@/services/_commun");
const { extraireZipSur } = await import("@/services/zip-tutoriel");
const { dureeFilmAttendueMs } = await import("@/moteurs/montage-tutoriel-outil/capture-auto/contrat");

/** La phrase du pilote. */
const PHRASE = "Un tableau de bord qui suit les stocks d'une PME et prévient avant la rupture, pour ne plus compter à la main.";
const VIDEO = "v-phrase3";
const TRAVAIL = "t-phrase3";
const VERSION = "ver-phrase3";
const T0 = Date.UTC(2026, 10, 25, 9);
const T_ISO = new Date(T0).toISOString();
const FILM = readFileSync(join(__dirname, "../fixtures/film-court.mp4"));
const REGLAGES = [PARAM_FORMULAIRE, PARAM_ENTREE_PHRASE, PARAM_EQUIPE_TUTORIEL, PARAM_CLAUDE_TUTORIEL, PARAM_PIECE_CLAUDE, PARAM_CAPTURE_AUTO, PARAM_ENTREE_ZIP];

let boite: string;
let lectures: string[] = [];
const puts = new Map<string, Buffer>();
const cloches: { titre: string; message: string }[] = [];
const appelsRoles: string[] = [];

const stockage = {
  mode: "simulation",
  preparerDepot: async (d: { fichierId: string; entiteId: string }) => ({ cleStockage: `studio/dev/entree/${d.entiteId}/${d.fichierId}.mp4`, urlDepot: "" }),
  confirmerDepot: async (cle: string) => {
    const o = puts.get(`https://depot.test/${cle}`);
    return o ? { ok: true, sha256: createHash("sha256").update(o).digest("hex"), taille: o.length } : { ok: false };
  },
  urlLecture: async (c: string) => `https://stockage.test/${c}`,
  urlLectureDuree: async (c: string) => `https://stockage.test/${c}`,
  urlDepotDuree: async (c: string) => `https://depot.test/${c}`,
};

const dep = (extra: Record<string, unknown> = {}) => ({
  racine: boite,
  stockage: async () => stockage as never,
  cloche: async (n: { titre: string; message: string }) => {
    cloches.push(n);
    await depots().notifications.enregistrer({ id: `not-${cloches.length}`, lue: false, creeLe: T_ISO, modifieLe: T_ISO, ...n } as never);
  },
  ...extra,
});

/** Faux Claude des rôles : la simulation déterministe de chaque rôle ; le scénariste écrit selon les moments de la fiche reçue. */
const executer = (async (_videoId: string, role: { id: string; simuler: (e: never) => unknown }, entree: { variable: string }) => {
  const id = Object.entries(ROLES_APPELES).find(([, d]) => d?.id === role.id)?.[0] ?? role.id;
  appelsRoles.push(id);
  let donnees: unknown;
  if (id === "scenariste") {
    const brut = entree.variable.match(/<scenariste>([\s\S]*)<\/scenariste>/)?.[1] ?? "{}";
    const fiche = (JSON.parse(brut.replace(/<\\\//g, "</")) as { fiche: { moments: MomentFiche[] } }).fiche;
    donnees = scriptsDuDouble(fiche.moments);
  } else donnees = role.simuler(entree as never);
  return { ok: true, simule: false, donnees, texte: "", modele: "double", coutUsd: 0, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
}) as never;

beforeEach(async () => {
  reinitialiserDepots();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.capture-auto")];
  puts.clear();
  cloches.length = 0;
  appelsRoles.length = 0;
  pieges.appels.length = 0;
  lectures = [];
  boite = mkdtempSync(join(tmpdir(), "phrase3-"));
  for (const d of ["demandes", "reponses", "echecs"]) mkdirSync(join(boite, d));
  writeFileSync(join(boite, "PRET"), "");
  writeFileSync(join(boite, "pouls"), new Date().toISOString() + "\n");
  for (const r of REGLAGES) await ecrireParametre(r, true);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.set(url, Buffer.from(init.body as Uint8Array));
      return new Response(null, { status: 200 });
    }
    lectures.push(url); // aucune lecture au stockage ne doit avoir lieu : le zip est fabriqué par le Studio
    return new Response("refusé", { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(boite, { recursive: true, force: true });
});

/** Tout ce qu'il faut pour mener UNE vidéo partie d'une phrase : dépôt réel (formulaire), moteur réel, ports réels de l'équipe, doubles comptés. */
async function monde(options: { apercuStudio?: "absent" | NonNullable<OutilsTutoriel["equipe"]>["apercuStudio"] } = {}) {
  const journal: Journal = { voix: [], claude: [], rendus: [] };
  let entrees: Record<string, unknown> | undefined;
  const depot = await deposerTutoriel(
    { mode: "phrase", phrase: PHRASE, ratios: ["4:5"], modeVoix: "sans-voix" },
    {
      equipe: async () => true,
      brouillon: async (e) => {
        entrees = e.entrees;
        return { id: VIDEO };
      },
      ratios: async () => undefined,
      lancer: async () => ({ statut: "lancee", travailId: TRAVAIL }),
      abandonner: async () => undefined,
    },
  );
  expect(depot.statut).toBe("lancee");
  const commandeDepart: CommandeFabrication = commandeTutoriel({ videoId: VIDEO, ratios: ["4:5"], distribution: [], script: { blocs: [], texteComplet: "" }, entrees: { [ENTREE_TUTORIEL]: (entrees?.[ENTREE_TUTORIEL] as object) ?? {} } });
  expect(commandeDepart.entrees).toMatchObject({ [ENTREE_TUTORIEL]: { depot: { mode: "phrase", phrase: PHRASE }, modeVoix: "sans-voix" } });

  const base = outilsDoubles(journal);
  const outils = async (): Promise<OutilsTutoriel> => {
    const c = (await depots().versions.obtenir(VERSION))!.commande;
    const { apercuStudio: reel, ...equipe } = await portsEquipeAvecPhrase(c, VIDEO, { executer });
    const apercuStudio = options.apercuStudio === "absent" ? undefined : (options.apercuStudio ?? reel);
    return {
      ...base,
      claude: async (requete) => {
        journal.claude.push(requete);
        return { texte: planDuDouble(requete.messages[0].contenu, ["", ""]), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as never;
      },
      equipe: { ...equipe, ...(apercuStudio ? { apercuStudio } : {}), maintenant: () => T_ISO },
    };
  };
  const moteur = creerMoteurTutorielOutil({ outils });
  const t0: Travail = await moteur.lancer(commandeDepart, { travailId: TRAVAIL, versionId: VERSION, titre: "Mon tutoriel", maintenant: T0 });
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: commandeDepart.entrees, creeLe: T_ISO, modifieLe: T_ISO } as never);
  await depots().versions.enregistrer({ id: VERSION, videoId: VIDEO, numero: 1, statut: "en_fabrication", commande: commandeDepart, creeLe: T_ISO, modifieLe: T_ISO } as never);
  await depots().travaux.enregistrer({ ...t0, id: TRAVAIL, cibleId: VIDEO, versionId: VERSION, type: "fabrication", creeLe: T_ISO, modifieLe: T_ISO } as never);

  let tours = 0;
  const travail = async (): Promise<Travail> => (await depots().travaux.obtenir(TRAVAIL)) as Travail;
  /** Avance jusqu'à une pause, un échec ou la fin (le travail vit dans le dépôt : les gestes de Williams et la capture y écrivent). */
  const mener = async (): Promise<Travail> => {
    let t = await travail();
    for (let i = 0; i < 600; i++) {
      const c = (await depots().versions.obtenir(VERSION))!.commande;
      t = (await moteur.avancer(t, c, T0 + tours++ * 1000)).travail;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    await depots().travaux.enregistrer(t);
    return t;
  };
  const etat = async (): Promise<EtatTutoriel> => (await travail()).parametres!.tutoriel as EtatTutoriel;
  const equipe = async (): Promise<EtatEquipe> => (await etat()).equipe!;
  const pause = async (): Promise<string | undefined> => ((await travail()).parametres?.pause as { code?: string } | undefined)?.code;
  return { journal, moteur, travail, mener, etat, equipe, pause };
}
type Monde = Awaited<ReturnType<typeof monde>>;

const ecran = { session: async () => ({}), relancer: async () => undefined, maintenant: () => T_ISO };
const compos = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");

/** Jusqu'à « votre maquette attend votre choix » : l'aperçu est rangé par le Studio, sans aucun geste. */
async function jusquALaMaquette(m: Monde) {
  const t = await m.mener();
  expect(t.erreur).toBeUndefined();
  expect(await m.pause()).toBe("TO_PIECE_A_VALIDER");
  return t;
}

/** Joue le rôle du poste : prend la demande et rend un VRAI petit MP4 avec navigation.json et ffprobe.json cohérents. */
function repondre(): { scenario: { maquette: string; largeur: number; hauteur: number }; calage: { dureeVoixMs: number } } {
  const [nom] = readdirSync(join(boite, "demandes"));
  const calage = JSON.parse(readFileSync(join(boite, "demandes", nom!, "calage.json"), "utf8")) as { dureeVoixMs: number; etapes: { id: string; debutMs: number; finMs: number }[] };
  const scenario = JSON.parse(readFileSync(join(boite, "demandes", nom!, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number };
  rmSync(join(boite, "demandes", nom!), { recursive: true });
  const cible = join(boite, "reponses", nom!);
  mkdirSync(cible);
  writeFileSync(join(cible, "etat.txt"), "ok\nOK\n");
  writeFileSync(join(cible, "navigation.mp4"), FILM);
  writeFileSync(
    join(cible, "navigation.json"),
    JSON.stringify({
      version: "navigation-filmee.v1", maquette: scenario.maquette, largeur: scenario.largeur, hauteur: scenario.hauteur, debutFilmMs: 0, dureeVoixMs: calage.dureeVoixMs,
      cibles: calage.etapes.map((e) => ({ etapeId: e.id, instantMs: e.debutMs + 600, finMs: e.finMs, zonePct: { x: 10, y: 10, largeur: 30, hauteur: 10 } })),
    }),
  );
  writeFileSync(
    join(cible, "ffprobe.json"),
    JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: scenario.largeur * 2, height: scenario.hauteur * 2 }], format: { duration: String(dureeFilmAttendueMs(calage.dureeVoixMs) / 1000) } }),
  );
  return { scenario, calage };
}

describe("PHRASE-3 : de la phrase au film, sans geste autre que les deux oui voulus", () => {
  it("aperçu rangé par le Studio, maquette gardée, script validé, film demandé au poste avec le zip du Studio, film rangé, rendu AVEC le film", async () => {
    const m = await monde();

    // 1. Le maquettiste (simulé) propose ; le STUDIO fait l'aperçu seul : pause voulue « à valider », aucun dépôt manuel.
    await jusquALaMaquette(m);
    expect(appelsRoles).toEqual(["maquettiste"]);
    const piece = (await m.equipe()).pieceCreee!;
    expect(piece).toMatchObject({ genre: "maquette", statut: "a-valider", apercu: { source: "studio", images: [], controle: { ok: true, defauts: [] } } });
    expect(piece.apercu!.empreinteDescription).toBe(piece.empreinte);
    // Sans pièce gardée : aucune demande de film (et la vidéo n'est même pas en pause du film).
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    // L'écran de la maquette : textes, chiffres à relire, et la phrase sur l'image.
    const vue = await vuePieceCreee(VIDEO, { session: ecran.session });
    expect(vue).toMatchObject({ statut: "a-valider", apercu: [], apercuDuStudio: true });
    expect(vue!.textes.length).toBeGreaterThan(0);
    expect(vue!.chiffres.length).toBeGreaterThan(0);
    expect(renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue: vue! }))).toContain("L&#x27;image de votre maquette sera filmée après votre accord.");

    // 2. Williams GARDE la maquette (premier arrêt voulu), puis stratège et scénariste (simulés) : second arrêt voulu.
    expect(await garderPiece(VIDEO, { empreinte: piece.empreinte }, ecran)).toMatchObject({ ok: true, statut: "gardee" });
    const sc = await m.mener();
    expect(sc.erreur).toBeUndefined();
    expect(await m.pause()).toBe("TO_SCRIPT_A_VALIDER");
    expect(appelsRoles).toEqual(["maquettiste", "stratege", "scenariste"]);

    // 3. Williams choisit le script ; sans voix (silence, mots horodatés), calage, pause du film.
    expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
    expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
    const attente = await m.mener();
    expect(attente.erreur).toBeUndefined();
    expect(await m.pause()).toBe("TO_FILM_A_CAPTURER");
    const etat = await m.etat();
    expect(etat.audio?.fournisseur).toBe("aucune");
    expect(compos(m.journal)).toHaveLength(0);
    expect(m.journal.voix).toEqual([]);

    // 4. Tour de la capture automatique : UNE demande film-zip, dont le dossier.zip est fabriqué par le Studio depuis la maquette GARDÉE.
    await avancerCapturesTutoriel(dep());
    const demandes = readdirSync(join(boite, "demandes"));
    expect(demandes).toHaveLength(1);
    expect(demandes[0]).toMatch(/^film-zip--/);
    const dossier = join(boite, "demandes", demandes[0]!);
    expect(readdirSync(dossier).sort()).toEqual(["calage.json", "dossier.zip", "scenario.json"]);
    const scenarioEnvoye = JSON.parse(readFileSync(join(dossier, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number; etapes: { aller: string }[] };
    expect(scenarioEnvoye).toEqual(JSON.parse(JSON.stringify(etat.equipe!.parcours!.scenario)));
    const extrait = await extraireZipSur(new Uint8Array(readFileSync(join(dossier, "dossier.zip"))), { attestationImages: false });
    expect(extrait.ok, JSON.stringify(extrait.rapport)).toBe(true);
    if (!extrait.ok) return;
    expect([...extrait.fichiers.keys()].sort()).toEqual(["app.js", "demo-data.js", "index.html", "manrope-latin.woff2", "styles.css"]);
    const html = new TextDecoder().decode(extrait.fichiers.get("index.html"));
    const zones = scenarioEnvoye.etapes.map((e) => e.aller).filter((a) => a !== "avant" && a !== "maintenant" && !html.includes(`data-ecran="${a}"`));
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones) expect(html, `zone ${z}`).toContain(`data-zone="${z}"`);
    expect(new TextDecoder().decode(extrait.fichiers.get("app.js"))).toContain("window.demoMaquette");
    expect(new TextDecoder().decode(extrait.fichiers.get("styles.css"))).toContain('url("manrope-latin.woff2")');
    expect(lectures).toEqual([]); // aucun dossier relu au stockage
    // Une seule demande en vol : un nouveau tour n'en écrit pas une seconde.
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toHaveLength(1);

    // 5. Faux poste : un VRAI petit MP4 ; la capture relit la réponse et range le film par le chemin du dépôt manuel.
    const { scenario } = repondre();
    expect(scenario.maquette).toBe(scenarioEnvoye.maquette);
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "reponses"))).toEqual([]);
    expect(await m.pause()).toBeUndefined();
    const cleFilm = [...puts.entries()].find(([, o]) => o.equals(FILM))?.[0];
    expect(cleFilm).toBeDefined();
    expect(cloches).toEqual([]);

    // 6. La chaîne reprend : plan de scènes AVEC le film, rendu qui porte le film.
    const fin = await m.mener();
    expect(fin.erreur).toBeUndefined();
    expect(fin.statut).toBe("termine");
    const e2 = await m.etat();
    expect(e2.plan).toBeDefined();
    const rendus = compos(m.journal);
    expect(rendus.length).toBeGreaterThan(0);
    const cleRangee = cleFilm!.replace("https://depot.test/", "");
    for (const d of rendus) {
      const p = d.parametres.proprietes as { navigation?: { maquette: string } };
      expect(p.navigation).toMatchObject({ maquette: scenario.maquette });
      expect(d.entrees.filmNavigation).toBe(`https://stockage.test/${cleRangee}`);
    }
    expect(pieges.appels).toEqual([]);
    expect(appelsRoles.every((r) => ["maquettiste", "stratege", "scenariste"].includes(r))).toBe(true);
  });

  it("pièce pas gardée (ou plus celle du oui) : aucun film demandé, même en pause du film ; réglage éteint : rien du tout", async () => {
    const m = await monde();
    await jusquALaMaquette(m);
    const piece = (await m.equipe()).pieceCreee!;
    expect(await garderPiece(VIDEO, { empreinte: piece.empreinte }, ecran)).toMatchObject({ ok: true });
    await m.mener();
    expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
    expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
    await m.mener();
    expect(await m.pause()).toBe("TO_FILM_A_CAPTURER");

    const t = await m.travail();
    const modifier = async (f: (p: NonNullable<EtatEquipe["pieceCreee"]>) => NonNullable<EtatEquipe["pieceCreee"]>) => {
      const e = t.parametres!.tutoriel as EtatTutoriel;
      await depots().travaux.modifier(TRAVAIL, { parametres: { ...t.parametres, tutoriel: { ...e, equipe: { ...e.equipe!, pieceCreee: f(e.equipe!.pieceCreee!) } } } });
    };
    // Le oui de Williams ne porte plus l'empreinte de la pièce.
    await modifier((p) => ({ ...p, gardee: { empreinte: "autre-empreinte", le: T_ISO } }));
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    // Pièce revenue « à valider ».
    await modifier((p) => ({ ...p, statut: "a-valider", gardee: undefined }));
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    // Pièce gardée, mais interrupteur de la capture éteint : rien.
    await modifier((p) => ({ ...p, statut: "gardee", gardee: { empreinte: p.empreinte, le: T_ISO } }));
    await ecrireParametre(PARAM_CAPTURE_AUTO, false);
    await avancerCapturesTutoriel(dep({ allumee: undefined }));
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    // Allumé de nouveau : la demande part.
    await ecrireParametre(PARAM_CAPTURE_AUTO, true);
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toHaveLength(1);
  });

  it("la description gardée a changé depuis le oui (empreinte) : le zip n'est pas fabriqué, la panne est une phrase claire sans donnée du client", async () => {
    const m = await monde();
    await jusquALaMaquette(m);
    const piece = (await m.equipe()).pieceCreee!;
    expect(await garderPiece(VIDEO, { empreinte: piece.empreinte }, ecran)).toMatchObject({ ok: true });
    await m.mener();
    expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
    expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
    await m.mener();
    expect(await m.pause()).toBe("TO_FILM_A_CAPTURER");
    // Le contenu change sans que l'empreinte gardée suive.
    const t = await m.travail();
    const e = t.parametres!.tutoriel as EtatTutoriel;
    const p = e.equipe!.pieceCreee!;
    const contenu = structuredClone(p.contenu) as { nom: string; ecrans: { titre: string }[] };
    contenu.ecrans[0]!.titre = "Un autre titre";
    expect(empreinteDescription(contenu as never)).not.toBe(p.empreinte);
    await depots().travaux.modifier(TRAVAIL, { parametres: { ...t.parametres, tutoriel: { ...e, equipe: { ...e.equipe!, pieceCreee: { ...p, contenu: contenu as never } } } } });
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    expect(cloches).toHaveLength(1);
    expect(cloches[0]!.message).toMatch(/gardée/);
    expect(JSON.stringify(cloches)).not.toContain(PHRASE);
    expect(CODE_PIECE_A_CONSTRUIRE).toBe("TO_PIECE_A_CONSTRUIRE");
  });

  it("parcours du réalisateur qui vise une zone absente de la maquette gardée : aucune demande, phrase claire", async () => {
    const m = await monde();
    await jusquALaMaquette(m);
    expect(await garderPiece(VIDEO, { empreinte: (await m.equipe()).pieceCreee!.empreinte }, ecran)).toMatchObject({ ok: true });
    await m.mener();
    expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
    expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
    await m.mener();
    expect(await m.pause()).toBe("TO_FILM_A_CAPTURER");
    const t = await m.travail();
    const e = t.parametres!.tutoriel as EtatTutoriel;
    const scenario = structuredClone(e.equipe!.parcours!.scenario);
    scenario.etapes[1] = { ...scenario.etapes[1]!, aller: "zone-qui-n-existe-pas" };
    await depots().travaux.modifier(TRAVAIL, { parametres: { ...t.parametres, tutoriel: { ...e, equipe: { ...e.equipe!, parcours: { ...e.equipe!.parcours!, scenario } } } } });
    await avancerCapturesTutoriel(dep());
    expect(readdirSync(join(boite, "demandes"))).toEqual([]);
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_PARCOURS_HORS_MAQUETTE]);
  });
});

describe("PHRASE-3 : l'aperçu du Studio ne se range que pour CETTE pièce, décidé sur l'état", () => {
  const apercuDe = (piece: { empreinte: string }, plus: Record<string, unknown> = {}) => ({ version: "apercu-piece.v1", empreinteDescription: piece.empreinte, images: [], controle: { ok: true, defauts: [] }, source: "studio", ...plus }) as never;

  it("sans le port (réglage lu en échec à ce tour) : la pièce reste « à construire » ; au tour suivant le port est là et l'aperçu est rangé", async () => {
    const options: Parameters<typeof monde>[0] = { apercuStudio: "absent" };
    const m = await monde(options);
    const t = await m.mener();
    expect(t.erreur).toBeUndefined();
    expect(await m.pause()).toBe(CODE_PIECE_A_CONSTRUIRE);
    expect((await m.equipe()).pieceCreee).toMatchObject({ statut: "a-construire" });
    expect((await m.equipe()).pieceCreee!.apercu).toBeUndefined();
    // Le port revient : la décision se prend sur l'état de la pièce, l'aperçu part tout seul.
    delete options.apercuStudio;
    await m.mener();
    expect(await m.pause()).toBe("TO_PIECE_A_VALIDER");
    expect((await m.equipe()).pieceCreee).toMatchObject({ statut: "a-valider", apercu: { source: "studio" } });
    expect(appelsRoles).toEqual(["maquettiste"]); // le maquettiste n'a pas été rappelé
  });

  it.each([
    ["d'une AUTRE empreinte", (p: { empreinte: string }) => apercuDe({ empreinte: `${p.empreinte}-autre` })],
    ["sans la marque du Studio", (p: { empreinte: string }) => apercuDe(p, { source: undefined })],
    ["avec une image (ce n'est plus un aperçu du Studio)", (p: { empreinte: string }) => apercuDe(p, { images: [{ ecranId: "a", etat: "avant", cle: "../x" }] })],
  ])("aperçu %s : rien n'est rangé", async (_nom, faux) => {
    const m = await monde({ apercuStudio: async (p) => faux(p) });
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_CONSTRUIRE);
    expect((await m.equipe()).pieceCreee).toMatchObject({ statut: "a-construire" });
    expect((await m.equipe()).pieceCreee!.apercu).toBeUndefined();
  });

  it("le port lève : la vidéo ne tombe pas en échec, la pièce reste « à construire »", async () => {
    const m = await monde({ apercuStudio: async () => Promise.reject(new Error("panne")) });
    const t = await m.mener();
    expect(t.statut).not.toBe("echec");
    expect(await m.pause()).toBe(CODE_PIECE_A_CONSTRUIRE);
  });

  it("contrôle de la charte en échec : la pièce passe « à revoir » avec les défauts en phrases simples, rien ne peut être gardé", async () => {
    const m = await monde({ apercuStudio: async (p) => apercuDe(p, { controle: { ok: false, defauts: ["La maquette contient du bleu : la charte n'en veut pas."] } }) });
    await m.mener();
    expect(await m.pause()).toBe("TO_PIECE_A_REVOIR");
    const piece = (await m.equipe()).pieceCreee!;
    expect(piece).toMatchObject({ statut: "a-revoir", erreurs: ["La maquette contient du bleu : la charte n'en veut pas."] });
    expect(await garderPiece(VIDEO, { empreinte: piece.empreinte }, ecran)).toMatchObject({ ok: false });
    const vue = await vuePieceCreee(VIDEO, { session: ecran.session });
    expect(vue!.defauts).toContain("La maquette contient du bleu : la charte n'en veut pas.");
  });
});
