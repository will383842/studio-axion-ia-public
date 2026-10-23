/**
 * ENTRÉES DE LA COMPOSITION « blocs/2 » (essai réel après la PR #76, 12/10) : les bruitages du tableau vivent dans
 * `public/bruitages/` (clés `/bruitages/…`), pas dans le stockage. Avant : la clé était signée telle quelle, studio-rendu
 * répondait 404 (`fichier-inaccessible`) et la composition était resoumise sans fin.
 *
 * - l'adresse d'un bruitage passe par le chemin commun `cleLisibleParLeRendu` (copie une fois sous
 *   `studio/{env}/public/…`, rejouable), jamais une adresse signée de la clé publique ;
 * - un bruitage introuvable : la vidéo se fabrique sans lui, avec une alerte (rapport, journal, traçabilité) ;
 * - un `fichier-inaccessible` répété : arrêt après une série d'essais, entrée en cause (nom et clé, jamais l'adresse
 *   signée) au journal et à la traçabilité, message en français, code 4 au lanceur.
 * Aucun appel réseau : `fetch` est doublé.
 */
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleLisibleParLeRendu } from "../../../src/services/etalonnage";
import { entreeLisible, lectureSignee } from "../../../src/services/tableau-outils";
import { SONS_TABLEAU } from "../../../src/donnees/bruitages";
import { ErreurFabrication, fabriquerTableau, retirerBruitagesIntrouvables, type EvenementFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "../../../src/fournisseurs/types";
import { stockageSimulation } from "../../../src/fournisseurs/simulation/autres";
import { branchementsSimules, lancer, type Branchements } from "../../../scripts/tableau/fabriquer";
import { doubles } from "../fabriquer/doubles";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";
import { ficheDemonstration } from "../regles/exemples";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Stockage façon R2 : signe toute clé (comme le vrai, qui retire le « / » de tête), HEAD sur les clés déposées. */
function stockageR2(deposees = new Set<string>()): StockageFichiers & { deposees: Set<string>; signees: string[] } {
  const signees: string[] = [];
  return {
    ...stockageSimulation,
    mode: "reel",
    deposees,
    signees,
    async confirmerDepot(cle: string) {
      return { ok: deposees.has(cle) };
    },
    async urlLecture(cle: string) {
      signees.push(cle);
      return `https://r2.exemple/${cle.replace(/^\/+/, "")}?signe`;
    },
    async urlLectureDuree(cle: string) {
      signees.push(cle);
      return `https://r2.exemple/${cle.replace(/^\/+/, "")}?signe`;
    },
    async urlDepotDuree(cle: string) {
      return `https://r2.exemple/depot/${cle}`;
    },
  };
}

/** `fetch` doublé : un PUT dépose la clé dans le stockage doublé. */
function depotsEspion(s: ReturnType<typeof stockageR2>) {
  const puts: { cle: string; type: string | null; octets: number }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const u = String(url);
    if (init?.method !== "PUT" || !u.startsWith("https://r2.exemple/depot/")) throw new Error(`Appel réseau inattendu : ${u}`);
    const cle = u.slice("https://r2.exemple/depot/".length);
    s.deposees.add(cle);
    puts.push({ cle, type: new Headers(init.headers).get("content-type"), octets: (init.body as Uint8Array).byteLength });
    return new Response(null, { status: 200 });
  });
  return puts;
}

describe("adresse d'un bruitage du tableau : le chemin commun", () => {
  it("chaque son du tableau est copié une fois sous studio/dev/public/…, puis c'est la copie qui est signée", async () => {
    const s = stockageR2();
    const puts = depotsEspion(s);
    const signer = lectureSignee(s, cleLisibleParLeRendu);
    for (const son of SONS_TABLEAU) {
      expect(son.cleStockage).toMatch(/^\/bruitages\/tableau-/);
      const url = await signer(son.cleStockage);
      expect(url).toBe(`https://r2.exemple/studio/dev/public${son.cleStockage}?signe`);
    }
    // Jamais une adresse signée de la clé publique (ni avec, ni sans le « / » de tête).
    expect(s.signees.some((c) => /^\/?bruitages\//.test(c))).toBe(false);
    expect(puts.map((p) => p.cle)).toEqual(SONS_TABLEAU.map((x) => `studio/dev/public${x.cleStockage}`));
    for (const [i, p] of puts.entries()) {
      expect(p.type).toBe("audio/wav");
      expect(p.octets).toBe((await stat(join(process.cwd(), "public", SONS_TABLEAU[i].cleStockage))).size);
    }
  });

  it("rejouable : une seconde fois, rien n'est redéposé ; une clé du stockage est signée telle quelle", async () => {
    const s = stockageR2(new Set(SONS_TABLEAU.map((x) => `studio/dev/public${x.cleStockage}`)));
    const puts = depotsEspion(s);
    const signer = lectureSignee(s, cleLisibleParLeRendu);
    for (const son of SONS_TABLEAU) await signer(son.cleStockage);
    expect(puts).toEqual([]);
    expect(await signer("studio/dev/videos/v1/scene.mp4")).toBe("https://r2.exemple/studio/dev/videos/v1/scene.mp4?signe");
  });

  it("une clé publique hors des dossiers permis est refusée (jamais signée)", async () => {
    const s = stockageR2();
    depotsEspion(s);
    await expect(lectureSignee(s, cleLisibleParLeRendu)("/../secret.wav")).rejects.toThrow();
    expect(s.signees).toEqual([]);
  });

  it("entreeLisible : copie déposée → vrai ; fichier absent du studio ou dépôt refusé → faux, sans exception", async () => {
    const s = stockageR2();
    depotsEspion(s);
    expect(await entreeLisible("/bruitages/tableau-toc.wav", s, cleLisibleParLeRendu)).toBe(true);
    expect(await entreeLisible("/bruitages/absent-du-studio.wav", s, cleLisibleParLeRendu)).toBe(false);
    expect(await entreeLisible("studio/dev/videos/v-absente/x.mp4", s, cleLisibleParLeRendu)).toBe(false);
  });
});

describe("repli sûr : un bruitage introuvable est retiré, la vidéo se fabrique sans lui", () => {
  it("retirerBruitagesIntrouvables garde les sons lisibles, retire les autres (places et médias)", async () => {
    const sons = {
      places: [
        { elementId: "son:tableau-trait", declencheur: "document" as const, debutSec: 1, dureeSec: 0.4, gainDb: -18 },
        { elementId: "son:tableau-toc", declencheur: "chiffre" as const, debutSec: 2, dureeSec: 0.4, gainDb: -18 },
      ],
      medias: { "son:tableau-trait": { cle: "/bruitages/tableau-trait.wav", mime: "audio/wav" }, "son:tableau-toc": { cle: "/bruitages/tableau-toc.wav", mime: "audio/wav" } },
    };
    const r = await retirerBruitagesIntrouvables(sons, async (cle) => !cle.includes("trait"));
    expect(r.places.map((p) => p.elementId)).toEqual(["son:tableau-toc"]);
    expect(Object.keys(r.medias)).toEqual(["son:tableau-toc"]);
    expect(r.manquants).toEqual([{ entree: "son:tableau-trait", cle: "/bruitages/tableau-trait.wav" }]);
    // Sans vérification possible : rien n'est retiré (comportement d'avant).
    expect((await retirerBruitagesIntrouvables(sons)).places.length).toBe(2);
  });

  it("chaîne « blocs/2 » : le son « trait » introuvable est retiré, alerte au rapport, au journal et à la traçabilité", async () => {
    const d = doubles(ficheFormation());
    const traces: EvenementFabrication[] = [];
    const r = await fabriquerTableau({
      ...d.outils,
      contexte: contexteFormation(),
      montage: { ...d.outils.montage, lisible: async (cle) => cle !== "/bruitages/tableau-trait.wav" },
      tracer: async (e) => {
        traces.push(e);
      },
    });
    const [c] = d.compositionsSoumises();
    const p = c.parametres as { son: { bruitages?: { entree: string }[] } };
    expect(p.son.bruitages?.length).toBeGreaterThan(0);
    for (const b of p.son.bruitages!) expect(c.entrees[b.entree]).toMatch(/tableau-(toc|validation)\.wav/);
    expect(r.alertes).toEqual([{ code: "bruitage", gravite: "attention", message: "Bruitage « trait » introuvable (/bruitages/tableau-trait.wav) : la vidéo est fabriquée sans ce son." }]);
    expect(r.sorties[0].alertes).toEqual(r.alertes);
    expect(d.journal.valeur?.alertes).toMatchObject([{ etape: "composition", code: "bruitage-introuvable", entree: "son:tableau-trait", cle: "/bruitages/tableau-trait.wav" }]);
    expect(traces.find((t) => t.type === "controle" && t.donnees.moment === "avant-montage")?.donnees).toMatchObject({ alertes: 1, manquants: [{ entree: "son:tableau-trait", cle: "/bruitages/tableau-trait.wav" }] });
  });

  it("tous les sons lisibles : aucune alerte, les trois familles sont mixées", async () => {
    const d = doubles(ficheFormation());
    const r = await fabriquerTableau({ ...d.outils, contexte: contexteFormation(), montage: { ...d.outils.montage, lisible: async () => true } });
    expect(r.alertes).toBeUndefined();
    expect(d.journal.valeur?.alertes).toBeUndefined();
    const [c] = d.compositionsSoumises();
    const cles = new Set(Object.entries(c.entrees).filter(([n]) => n.startsWith("bruitage-")).map(([, u]) => u));
    expect(cles.size).toBe(3);
  });
});

/** Rendu dont chaque composition complète échoue en `fichier-inaccessible` (les scènes passent). */
function renduEntreeAbsente(base: ServiceRendu) {
  const completes: DemandeRendu[] = [];
  const rendu: ServiceRendu = {
    async soumettre(dm) {
      if ((dm.parametres as { mode?: string }).mode === "complet") {
        completes.push(dm);
        return { idRendu: dm.idRendu };
      }
      return base.soumettre(dm);
    },
    async etat(id): Promise<EtatRendu> {
      if (completes.some((x) => x.idRendu === id)) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Entrée inaccessible (404)." } };
      return base.etat(id);
    },
  };
  return { rendu, completes };
}

describe("échec répété `fichier-inaccessible` : arrêt borné et alerte", () => {
  it("après une série d'essais : arrêt, entrée en cause nommée (nom et clé, jamais l'adresse signée), journal et traçabilité", async () => {
    const d = doubles(ficheFormation());
    const { rendu, completes } = renduEntreeAbsente(d.outils.montage.rendu());
    const traces: EvenementFabrication[] = [];
    const absente = (cle: string) => cle.startsWith("studio/dev/scenes/");
    const err = await fabriquerTableau({
      ...d.outils,
      contexte: contexteFormation(),
      montage: { ...d.outils.montage, rendu: () => rendu, lisible: async (cle) => !absente(cle) },
      tracer: async (e) => {
        traces.push(e);
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurFabrication);
    const f = err as ErreurFabrication;
    expect(f.etape).toBe("composition");
    // Borné : la demande d'origine et trois essais, puis l'arrêt (plus de resoumission sans fin).
    expect(completes.length).toBe(4);
    const message = f.raisons.join(" ");
    expect(message).toMatch(/^Le montage est arrêté : studio-rendu n'a pas pu lire une entrée/);
    expect(message).toMatch(/Introuvable dans le stockage : [\w:-]+ \(studio\/dev\/scenes\/[^)]+\)/);
    expect(message).not.toContain("https://");
    const alertes = d.journal.valeur?.alertes ?? [];
    expect(alertes.find((a) => a.code === "entree-introuvable")?.cle).toMatch(/^studio\/dev\/scenes\//);
    expect(alertes.find((a) => a.code === "composition-arretee")?.message).toBe(message);
    expect(JSON.stringify(alertes)).not.toContain("https://");
    // L'état en cours est oublié : une relance repart d'une demande neuve.
    expect(d.journal.valeur?.composition).toBeUndefined();
    const arret = traces.find((t) => t.type === "etape" && t.donnees.resultat === "echec");
    expect(arret?.donnees).toMatchObject({ etape: "composition", code: "fichier-inaccessible" });
    expect((arret?.donnees.entrees as { cle: string }[]).length).toBeGreaterThan(0);
    expect(JSON.stringify(arret)).not.toContain("https://");
  });

  it("le lanceur affiche l'avancement au fil de l'eau, puis l'arrêt en français, code de sortie 4", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "tb-bruitages-"));
    const fiche = join(dossier, "fiche.json");
    await writeFile(fiche, JSON.stringify(ficheDemonstration));
    const contexte = join(dossier, "contexte.json");
    await writeFile(
      contexte,
      JSON.stringify({
        aujourdhui: "2026-10-11",
        sourcesChiffres: ["source-delai-relance"],
        preuves: [{ id: "preuve-compte-rendu", statut: "validee", perimeLe: "2027-01-09" }],
        matieres: ["questions", "idees", "relance"].map((m) => ({ id: `matiere-demo-${m}`, type: "demonstration", statut: "validee", perimeLe: "2027-01-09" })),
        contenusPreuves: { "matiere-demo-idees": { phrase: "Donnez-moi trois idées", testeLe: "2026-10-09" } },
      }),
    );
    const reels = async (_p: string, videoId: string): Promise<Branchements> => {
      const b = branchementsSimules(dossier, videoId);
      const { rendu } = renduEntreeAbsente(b.montage.rendu());
      return { ...b, montage: { ...b.montage, rendu: () => rendu, lisible: async (cle) => !cle.includes("/scenes/") } };
    };
    const lignes: string[] = [];
    const code = await lancer({ fiche, contexte, personnage: "williams", reel: true, accordCentimes: 100, dejaVu: "2026-10-10", dossier }, { ecrire: (l) => lignes.push(l), reels });
    const texte = lignes.join("\n");
    expect(code, texte).toBe(4);
    // Avancement au fil de l'eau, dans l'ordre, AVANT l'arrêt.
    const ordre = ["Voix : en cours…", "Voix : faite en", "Dessin des scènes : faite en", "Montage : en cours…", "Fabrication arrêtée à l'étape « composition »"].map((x) => texte.indexOf(x));
    expect(ordre.every((i) => i >= 0), texte).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(texte).toMatch(/Introuvable dans le stockage : [\w:-]+ \(studio\/dev\/scenes\//);
    expect(texte).not.toContain("https://");
    const journal = JSON.parse(await readFile(join(dossier, "journal.json"), "utf8"));
    expect(journal.alertes.some((a: { code: string }) => a.code === "composition-arretee")).toBe(true);
  });
});
