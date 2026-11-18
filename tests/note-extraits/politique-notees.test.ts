/**
 * X4-11b : politique « notees » dans l'inscription des extraits (`bibliothequeVideo.archive.sources`).
 * Chemin réel : `inscrireVideo` + `plagesDisponibles`, dépôts en mémoire, horloge injectée, aucun appel externe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Video, VersionVideo, Sortie, SousTitres, Fichier } from "@/domaine/types";
import { plagesDisponibles, type DemandeExtraits } from "@/briques/archive-extraits/choix";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/archive-extraits");

const T0 = "2026-11-17T10:00:00.000Z";
const ANCIEN = "2026-11-01T00:00:00.000Z";
const NOTE = "archiveExtraits.noteInteret";
let horlogeMin = 0;
const ports = (politique?: unknown) => ({
  maintenant: () => new Date(Date.parse(T0) + horlogeMin++ * 60_000).toISOString(),
  ...(politique !== undefined ? { politique: politique as never } : {}),
});

function mots(depart: number, phrases: string[]) {
  let t = depart;
  return phrases.map((texte) => {
    const m = texte.split(" ").map((mot, i) => ({ mot, debutSec: t + i * 0.4, finSec: t + i * 0.4 + 0.35 }));
    t += m.length * 0.4 + 0.6;
    return m;
  });
}

async function semer(id: string, o: { video?: Partial<Video>; version?: Partial<VersionVideo>; cle?: string } = {}) {
  const d = depots();
  const base = { creeLe: ANCIEN, modifieLe: ANCIEN };
  await d.videos.enregistrer({
    id, titre: `Vidéo ${id}`, formatId: "avocat", statut: "prete", etapeEditoriale: "montee", marqueId: "m1", styles: {}, entrees: {}, reglages: {},
    versionChoisieId: `ver-${id}`, typeAutomatisation: "suivi-commercial", ...base, ...o.video,
  } as unknown as Video);
  await d.versions.enregistrer({
    id: `ver-${id}`, videoId: id, numero: 1, statut: "prete", choisie: true, ...base,
    commande: {
      versionContrat: 2, moteurId: "montage-demo-facecam", videoId: id, formatId: "avocat",
      entrees: { demoFacecam: { ecran: { cle: "studio/ecran.mp4", dureeSec: 30 }, synchro: { mode: "fourni", decalageSec: 0 } } },
    },
    projetMontage: { plan: { scenes: [{ piece: "fenetre-app", debutMs: 2000, finMs: 7000 }, { piece: "liste-crm", debutMs: 8000, finMs: 13000 }] } },
    ...o.version,
  } as unknown as VersionVideo);
  await d.fichiers.enregistrer({ id: `fic-${id}`, cleStockage: o.cle ?? `studio/prod/video/${id}/a.mp4`, nom: "a.mp4", mime: "video/mp4", taille: 1, origine: "genere", statut: "pret", ...base } as unknown as Fichier);
  await d.sorties.enregistrer({ id: `sor-${id}`, videoId: id, versionId: `ver-${id}`, ratio: "9:16", appelAuMot: false, fichierId: `fic-${id}`, dureeSec: 60, ...base } as unknown as Sortie);
  const segs = mots(1, ["Bonjour à tous voici une première phrase claire.", "Ensuite une deuxième phrase tout aussi claire."]).map((m, i) => ({ id: `s${i}`, debutSec: m[0].debutSec, finSec: m[m.length - 1].finSec, mots: m }));
  await d.sousTitres.enregistrer({ id: `st-${id}`, videoId: id, versionId: `ver-${id}`, langue: "fr", version: 1, segments: segs, ...base } as unknown as SousTitres);
}

const elementDe = async (id: string) => (await depots().elements.obtenir(svc.idElementArchive(id))) ?? null;
const demande = (): DemandeExtraits => ({
  videoId: "autre", capacite: "ecran.telephone-extrait", reseaux: ["linkedin"], dejaUtilisees: [], maintenant: new Date("2026-11-18T12:00:00Z"),
  dureeMinSec: 0.1,
});
const publier = async (id: string) => {
  const v = (await depots().videos.obtenir(id))!;
  await depots().videos.enregistrer({ ...v, etapeEditoriale: "publiee" } as Video);
};

beforeEach(async () => {
  reinitialiserDepots();
  horlogeMin = 0;
  await ecrireParametre(NOTE, true);
});

/** Fiche et nom écrits par master (58ca853, sans X4-11b) pour la vidéo « a » publiée, politique « pretes », note active : recopie littérale. */
const REFERENCE_MASTER = {
  nom: "Extraits de « Vidéo a » · 66708bd8fd984be438261d24f366b6ef",
  valeur: {
    "type": "source-extraits",
    "fiche": {
      "videoId": "a",
      "versionId": "ver-a",
      "sortieId": "sor-a",
      "ratio": "9:16",
      "licence": {
        "type": "propriete",
        "usageCommercial": true,
        "reseaux": []
      },
      "famille": [
        "a"
      ],
      "plages": [
        {
          "id": "e-200-700",
          "debutSec": 2,
          "finSec": 7,
          "texte": "",
          "motsCles": [],
          "avecVisage": false,
          "texteIncruste": false,
          "etat": "utilisable",
          "origine": "ecran-demo",
          "note": 80,
          "raisonsNote": [
            {
              "code": "interface",
              "points": 35
            },
            {
              "code": "source-propre",
              "points": 20
            },
            {
              "code": "sujet-reconnu",
              "points": 15
            },
            {
              "code": "duree",
              "points": 10
            }
          ],
          "usages": [
            "ecran",
            "fond"
          ],
          "sujet": "suivi-commercial"
        },
        {
          "id": "e-800-1300",
          "debutSec": 8,
          "finSec": 13,
          "texte": "",
          "motsCles": [],
          "avecVisage": false,
          "texteIncruste": false,
          "etat": "utilisable",
          "origine": "ecran-demo",
          "note": 80,
          "raisonsNote": [
            {
              "code": "interface",
              "points": 35
            },
            {
              "code": "source-propre",
              "points": 20
            },
            {
              "code": "sujet-reconnu",
              "points": 15
            },
            {
              "code": "duree",
              "points": 10
            }
          ],
          "usages": [
            "ecran",
            "fond"
          ],
          "sujet": "suivi-commercial"
        }
      ],
      "rangee": false,
      "sourcePreferee": true,
      "ignores": {
        "nombre": 2,
        "raisonPrincipale": "phrase-creuse"
      },
      "rienARetenir": false,
      "noteVersion": "note-extraits/1"
    }
  },
};

describe("a) éteint = identique", () => {
  it.each([undefined, "publiees", "pretes", "cochees", "autre", "notes", true, null])("politique %s : même résultat et même fiche que master, sans attentePublication", async (p) => {
    await semer("a", { video: { etapeEditoriale: "publiee" } });
    const r = await svc.inscrireVideo("a", { ...ports(p), ...(p === "cochees" ? { cochees: ["a"] } : {}) });
    expect(r).toEqual({ ecrite: true });
    const el = (await elementDe("a"))!;
    expect(el.valeur).toEqual(REFERENCE_MASTER.valeur);
    expect(el.nom).toBe(REFERENCE_MASTER.nom);
    expect("attentePublication" in (await svc.ficheDeLaVideo("a"))!).toBe(false);
  });

  it("« cochees » : une vidéo non cochée n'est pas inscrite, comme sur master", async () => {
    await semer("a", { video: { etapeEditoriale: "publiee" } });
    const r = await svc.inscrireVideo("a", { ...ports("cochees"), cochees: [] });
    expect(r.ecrite).toBe(false);
    expect(await elementDe("a")).toBeNull();
  });

  it("« autre » ou absente donne la même fiche qu'avec la politique par défaut explicite", async () => {
    await semer("a", { video: { etapeEditoriale: "publiee" } });
    await svc.inscrireVideo("a", ports("pretes"));
    const ref = await elementDe("a");
    for (const p of ["autre", "notes", 1]) {
      reinitialiserDepots();
      await ecrireParametre(NOTE, true);
      await semer("a", { video: { etapeEditoriale: "publiee" } });
      await svc.inscrireVideo("a", ports(p));
      expect((await elementDe("a"))!.valeur).toEqual(ref!.valeur);
    }
  });

  it("la valeur du réglage lue par le service : « notees » exact seulement", async () => {
    await semer("a", { video: { etapeEditoriale: "publiee" } });
    await ecrireParametre(svc.REGLAGE_SOURCES, "Notees");
    expect((await svc.inscrireVideo("a", ports())).ecrite).toBe(true);
    expect("attentePublication" in (await svc.ficheDeLaVideo("a"))!).toBe(false);
  });
});

describe("b) « notees » : vidéo prête non publiée", () => {
  it("fiche en attente ; la pioche ne propose que le moment d'écran sans visage ni texte", async () => {
    await semer("p");
    await ecrireParametre(svc.REGLAGE_SOURCES, "notees");
    expect(await svc.inscrireVideo("p", ports())).toEqual({ ecrite: true });
    const fiche = (await svc.ficheDeLaVideo("p"))!;
    expect(fiche.attentePublication).toBe(true);
    const utilisables = fiche.plages.filter((x) => x.etat === "utilisable");
    expect(utilisables.some((x) => x.origine === "ecran-demo" && !x.avecVisage && !x.texteIncruste)).toBe(true);
    const dispo = plagesDisponibles([(await elementDe("p"))!], demande());
    expect(dispo.length).toBeGreaterThan(0);
    for (const x of dispo) {
      expect(["ecran-demo", "capture-cas", "scene"]).toContain(x.plage.origine);
      expect(x.plage.avecVisage).toBe(false);
      expect(x.plage.texteIncruste).toBe(false);
    }
    const parlees = utilisables.filter((x) => x.origine === undefined || x.origine === "parole");
    for (const x of parlees) expect(dispo.map((y) => y.plage.id)).not.toContain(x.id);
  });

  it("par la politique injectée (port) aussi", async () => {
    await semer("p");
    await svc.inscrireVideo("p", ports("notees"));
    expect((await svc.ficheDeLaVideo("p"))!.attentePublication).toBe(true);
  });
});

describe("c) publiée ensuite", () => {
  it("relancé : attentePublication absent, les plages d'aujourd'hui reviennent", async () => {
    await semer("p");
    await ecrireParametre(svc.REGLAGE_SOURCES, "notees");
    await svc.inscrireVideo("p", ports());
    const avant = plagesDisponibles([(await elementDe("p"))!], demande()).length;
    await publier("p");
    expect(await svc.inscrireVideo("p", ports())).toEqual({ ecrite: true });
    const fiche = (await svc.ficheDeLaVideo("p"))!;
    expect("attentePublication" in fiche).toBe(false);
    const apres = plagesDisponibles([(await elementDe("p"))!], demande()).length;
    expect(apres).toBe(fiche.plages.filter((x) => x.etat === "utilisable").length);
    expect(apres).toBeGreaterThanOrEqual(avant);
    expect(await svc.inscrireVideo("p", ports())).toEqual({ ecrite: false, raison: "inchangée" });
  });
});

describe("d) jamais inscrite avec « notees »", () => {
  beforeEach(async () => ecrireParametre(svc.REGLAGE_SOURCES, "notees"));
  it.each([
    ["essai", { video: {}, version: { commande: { versionContrat: 2, moteurId: "simulation", videoId: "x", formatId: "avocat" } } }],
    ["démonstration", { video: { estDemo: true } }],
    ["corbeille", { video: { corbeilleLe: "2026-11-10T00:00:00.000Z" } }],
    ["archivée", { video: { statut: "archivee" } }],
  ])("%s", async (_n, o) => {
    await semer("x", o as never);
    const r = await svc.inscrireVideo("x", ports());
    expect(r.ecrite).toBe(false);
    expect(r.raison).toBeTruthy();
    expect(await elementDe("x")).toBeNull();
  });
  it("fichier de démonstration", async () => {
    await semer("x", { cle: "demo/x.mp4" });
    const r = await svc.inscrireVideo("x", ports());
    expect(r.ecrite).toBe(false);
    expect(r.raison).toBeTruthy();
    expect(await elementDe("x")).toBeNull();
  });
});

describe("e) garde statique", () => {
  it("archive-extraits.ts ne cite attentePublication qu'une fois (le verdict de eligibiliteNotees) et écrit la fiche par ficheAvecAttente", () => {
    const src = readFileSync(join(process.cwd(), "src/services/archive-extraits.ts"), "utf8");
    const lignes = src.split("\n").filter((l) => l.includes("attentePublication") && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/eligibiliteNotees\(video,.*\)\.attentePublication/);
    expect(src.match(/ficheAvecAttente\(/g)).toHaveLength(1);
    expect(src).not.toMatch(/\.attentePublication\s*=[^=]/);
    expect(src).not.toMatch(/(ancienneFiche|fiche)\??\.attentePublication/);
  });
});
