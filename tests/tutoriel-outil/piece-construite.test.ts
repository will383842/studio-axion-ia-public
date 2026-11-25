/**
 * PHRASE-3 : la maquette créée depuis une phrase, construite par le Studio (sans IA, sans réseau, sans navigateur) : aperçu sans image,
 * zip en mémoire déterministe qui passe `extraireZipSur`, défauts de la charte en phrases simples, règles de `lireApercu`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import type { PieceCreee } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { empreinteDescription, lireApercu, scenarioApercu, VERSION_APERCU } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import * as controleSrc from "@/moteurs/montage-tutoriel-outil/constructeur/controle-charte";
import * as construireSrc from "@/moteurs/montage-tutoriel-outil/constructeur/construire";
import { lireZip } from "@/lib/zip";
import { ecrireParametre } from "@/services/_commun";
import {
  apercuDuStudio,
  etapesHorsMaquette,
  PHRASE_CHARTE_ILLISIBLE,
  PHRASE_DESCRIPTION_ILLISIBLE,
  PHRASE_MAQUETTE_REFUSEE,
  PHRASE_PARCOURS_HORS_MAQUETTE,
  PHRASE_PIECE_NON_GARDEE,
  phrasesDesDefauts,
  zipDeLaPieceGardee,
} from "@/services/tutoriel-piece-construite";
import { PARAM_ENTREE_ZIP, extraireZipSur } from "@/services/zip-tutoriel";
import { reinitialiserDepots } from "@/donnees/memoire";
import { descriptionAtelier } from "./phrase/phrases";
// Les chemins d'`outils/` (tests, poste « écrire la maquette ») doivent rester valables : ils ré-exportent le code de `src/`.
import * as controleOutils from "../../outils/maquettes-tableaux-de-bord/charte/controle";
import * as construireOutils from "../../outils/maquettes-tableaux-de-bord/constructeur/construire";

const CHARTE = readFileSync(join(process.cwd(), "outils", "maquettes-tableaux-de-bord", "charte", "charte.css"));
const POLICE = readFileSync(join(process.cwd(), "src", "app", "polices", "manrope-latin.woff2"));

/** Lecture des deux fichiers de la charte sans toucher au disque (ou avec une charte tordue). */
const lireFichier = (css: Buffer = CHARTE) => async (chemin: string): Promise<Buffer> => {
  if (chemin.endsWith("charte.css")) return css;
  if (chemin.endsWith("manrope-latin.woff2")) return POLICE;
  throw new Error("fichier inattendu");
};

const description = (): DescriptionMaquette => {
  const r = lireDescriptionMaquette(descriptionAtelier(), { interdits: [] });
  if (!r.ok) throw new Error(r.erreurs.join(" "));
  return r.description;
};

const piece = (plus: Partial<PieceCreee> = {}, d: DescriptionMaquette = description()): PieceCreee => {
  const empreinte = empreinteDescription(d);
  return { genre: "maquette", proposition: 1, contenu: d, empreinte, statut: "gardee", gardee: { empreinte, le: "2026-11-25T09:00:00.000Z" }, ...plus };
};

beforeEach(async () => {
  reinitialiserDepots();
  await ecrireParametre(PARAM_ENTREE_ZIP, true);
});

describe("le constructeur et le contrôle vivent sous src/ et sont ré-exportés par outils/", () => {
  it("mêmes fonctions des deux côtés", () => {
    expect(construireOutils.construireMaquette).toBe(construireSrc.construireMaquette);
    expect(construireOutils.NOMS_FICHIERS).toBe(construireSrc.NOMS_FICHIERS);
    expect(controleOutils.controlerMaquette).toBe(controleSrc.controlerMaquette);
  });
});

describe("aperçu fait par le Studio", () => {
  it("sans image, marqué `studio`, empreinte de la pièce, contrôle réussi ; relu par lireApercu", async () => {
    const p = piece({ statut: "a-construire", gardee: undefined });
    const a = await apercuDuStudio(p, { lireFichier: lireFichier() });
    expect(a).toEqual({ version: VERSION_APERCU, empreinteDescription: p.empreinte, images: [], controle: { ok: true, defauts: [] }, source: "studio" });
    expect(lireApercu(a, { studioPermis: true })).toMatchObject({ ok: true, apercu: { source: "studio", images: [] } });
  });

  it("rien pour un flux, ni pour une pièce dont la description n'est plus celle de l'empreinte", async () => {
    expect(await apercuDuStudio(piece({ genre: "flux" }), { lireFichier: lireFichier() })).toBeNull();
    expect(await apercuDuStudio(piece({ empreinte: "autre" }), { lireFichier: lireFichier() })).toBeNull();
  });

  it("description illisible (empreinte juste) : un aperçu « à revoir » avec une phrase claire, jamais un arrêt muet", async () => {
    const illisible = { ...description(), version: "autre" } as unknown as DescriptionMaquette;
    const a = await apercuDuStudio(piece({ contenu: illisible, empreinte: empreinteDescription(illisible) }), { lireFichier: lireFichier() });
    expect(a?.controle).toEqual({ ok: false, defauts: [PHRASE_DESCRIPTION_ILLISIBLE] });
  });

  it("charte qui contient du bleu : contrôle en échec, défaut dit en une phrase simple (ni règle, ni ligne de code)", async () => {
    const bleue = Buffer.from(`${CHARTE.toString("utf8")}\n.x { color: #1E40AF; }\n`);
    const a = await apercuDuStudio(piece(), { lireFichier: lireFichier(bleue) });
    expect(a?.controle.ok).toBe(false);
    expect(a?.controle.defauts).toEqual(["La maquette contient du bleu : la charte n'en veut pas."]);
  });

  it("charte ou police illisible : la fonction lève (le port le rattrape), rien n'est rangé", async () => {
    await expect(apercuDuStudio(piece(), { lireFichier: async () => Promise.reject(new Error("absent")) })).rejects.toMatchObject({ phrase: PHRASE_CHARTE_ILLISIBLE });
  });

  it("toutes les règles de la charte ont une phrase simple, sans montant ni mot technique", () => {
    const regles = ["bleu", "jaune", "degrade", "police", "argent", "marque", "flou", "reseau", "pilotage", "inconnue"];
    const phrases = phrasesDesDefauts(regles.map((regle) => ({ chemin: "styles.css", ligne: 3, regle, extrait: "x" })));
    expect(phrases).toHaveLength(regles.length);
    for (const f of phrases) expect(f).not.toMatch(/styles\.css|ligne|regex|css|html|json|script/i);
    // Deux défauts de même règle : une seule phrase.
    expect(phrasesDesDefauts([{ chemin: "a", ligne: 1, regle: "bleu", extrait: "" }, { chemin: "b", ligne: 9, regle: "bleu", extrait: "" }])).toHaveLength(1);
  });
});

describe("zip de la maquette gardée", () => {
  const scenario = () => scenarioApercu(description(), description().nom);

  it("mêmes octets à chaque fabrication, date fixe, 5 fichiers à la racine, passe extraireZipSur comme un dossier déposé", async () => {
    const a = await zipDeLaPieceGardee(piece(), scenario(), { lireFichier: lireFichier() });
    const b = await zipDeLaPieceGardee(piece(), scenario(), { lireFichier: lireFichier() });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(Buffer.from(a.zip).equals(Buffer.from(b.zip))).toBe(true);
    expect(lireZip(a.zip).map((f) => f.nom)).toEqual(["index.html", "app.js", "demo-data.js", "styles.css", "manrope-latin.woff2"]);
    const extrait = await extraireZipSur(a.zip, { attestationImages: false });
    expect(extrait.ok, JSON.stringify(extrait.ok ? null : extrait.rapport)).toBe(true);
    if (!extrait.ok) return;
    expect(extrait.fichiers.size).toBe(5);
    expect(Buffer.from(extrait.fichiers.get("manrope-latin.woff2")!).equals(POLICE)).toBe(true);
    // La police se lit à côté de la feuille de style, jamais par un chemin du dépôt.
    const styles = new TextDecoder().decode(extrait.fichiers.get("styles.css"));
    expect(styles).toContain('url("manrope-latin.woff2")');
    expect(styles).not.toContain("src/app/polices");
    // Chaque zone et chaque écran de la description est dans la page ; la maquette est vivante (animations du film).
    const html = new TextDecoder().decode(extrait.fichiers.get("index.html"));
    for (const e of description().ecrans) {
      expect(html).toContain(`data-ecran="${e.id}"`);
      for (const z of e.zones) expect(html).toContain(`data-zone="${z.id}"`);
    }
    expect(html).toContain('class="vivant"');
  });

  it("pièce pas gardée, gardée avec une autre empreinte, ou flux : refus en phrase fixe", async () => {
    for (const p of [piece({ statut: "a-valider" }), piece({ gardee: { empreinte: "autre", le: "x" } }), piece({ gardee: undefined }), piece({ genre: "flux" }), piece({ empreinte: "autre", gardee: { empreinte: "autre", le: "x" } })]) {
      expect(await zipDeLaPieceGardee(p, scenario(), { lireFichier: lireFichier() })).toEqual({ ok: false, phrase: PHRASE_PIECE_NON_GARDEE });
    }
  });

  it("charte qui refuse la maquette : pas de zip ; charte illisible : pas de zip", async () => {
    const bleue = Buffer.from(`${CHARTE.toString("utf8")}\n.x { color: #1E40AF; }\n`);
    expect(await zipDeLaPieceGardee(piece(), scenario(), { lireFichier: lireFichier(bleue) })).toEqual({ ok: false, phrase: PHRASE_MAQUETTE_REFUSEE });
    expect(await zipDeLaPieceGardee(piece(), scenario(), { lireFichier: async () => Promise.reject(new Error("absent")) })).toEqual({ ok: false, phrase: PHRASE_CHARTE_ILLISIBLE });
  });

  it("parcours qui vise un écran ou une zone absents : refus, sans nommer le texte du client", async () => {
    const s = scenario();
    s.etapes[0] = { ...s.etapes[0]!, aller: "n-existe-pas" };
    expect(await zipDeLaPieceGardee(piece(), s, { lireFichier: lireFichier() })).toEqual({ ok: false, phrase: PHRASE_PARCOURS_HORS_MAQUETTE });
    const bon = scenario();
    expect(etapesHorsMaquette(bon, description(), "")).toEqual([]);
    // Une cible `[data-zone="…"]` doit aussi être dans la page elle-même.
    const zone = description().ecrans[0]!.zones[0]!.id;
    const avecCible = { ...bon, etapes: [{ ...bon.etapes[0]!, aller: zone, cible: `[data-zone="${zone}"]` }] };
    expect(etapesHorsMaquette(avecCible, description(), `<section data-zone="${zone}">`)).toEqual([]);
    expect(etapesHorsMaquette(avecCible, description(), "<main></main>")).toEqual([avecCible.etapes[0]!.id]);
  });
});

describe("lireApercu : un aperçu déposé à la main garde ses règles d'aujourd'hui", () => {
  const base = { version: VERSION_APERCU, empreinteDescription: "abc", controle: { ok: true, defauts: [] } };

  it("sans image : refusé, avec ou sans le champ `source`", () => {
    expect(lireApercu({ ...base, images: [] }).ok).toBe(false);
    expect(lireApercu({ ...base, images: [], source: "studio" }).ok).toBe(false);
    expect(lireApercu({ ...base, images: [], source: "studio" }, { studioPermis: false }).ok).toBe(false);
  });

  it("une image + `source` : refusé (le champ n'existe pas pour un aperçu déposé)", () => {
    const image = { ecranId: "a", etat: "avant", cle: "apercu/a.png" };
    expect(lireApercu({ ...base, images: [image] }).ok).toBe(true);
    expect(lireApercu({ ...base, images: [image], source: "studio" }).ok).toBe(false);
  });

  it("le Studio seul (permission explicite, source exacte) peut ranger un aperçu sans image ; toute autre source reste refusée", () => {
    expect(lireApercu({ ...base, images: [], source: "studio" }, { studioPermis: true })).toMatchObject({ ok: true, apercu: { source: "studio", images: [] } });
    expect(lireApercu({ ...base, images: [], source: "autre" }, { studioPermis: true }).ok).toBe(false);
    expect(lireApercu({ ...base, images: [] }, { studioPermis: true }).ok).toBe(false);
  });
});
