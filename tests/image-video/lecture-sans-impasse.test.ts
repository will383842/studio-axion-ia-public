/**
 * R1 · Lecture sans impasse : une image aux incohérences est RÉPARÉE par le code (avec une adaptation écrite), jamais
 * refusée ; seule une image trop chargée garde un refus, avec ce qu'il faut faire. AUCUN appel réel (doubles).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaCarteImage, type CarteImage } from "@/domaine/image-video/carte";
import { normaliserCarteBrute } from "@/domaine/image-video/normalisation";
import { lireImage, type LectureImage, type OutilsLecture, type DemandeReservationLecture } from "@/moteurs/montage-image-video/lecture";
import { appelerEnSimulation, convertirEnSimulation, lectureDeCarte, pngSimule } from "@/moteurs/montage-image-video/lecture/simulation";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

const B: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/B.json"), "utf8"));
const source = (c: CarteImage) => ({ cle: c.image.cle, empreinte: c.image.empreinte, octets: pngSimule(c.image.largeur, c.image.hauteur) });

function outils(lecture: LectureImage): { outils: OutilsLecture; reservations: DemandeReservationLecture[] } {
  const reservations: DemandeReservationLecture[] = [];
  const appeler = appelerEnSimulation({ a: lecture, b: lecture });
  return {
    reservations,
    outils: {
      convertir: async (d) => convertirEnSimulation(d),
      appeler,
      budget: { reserver: async (d) => (reservations.push(d), { ok: true }) },
    },
  };
}

/** Lecture de B dont on abîme un point. */
function abimee(f: (l: LectureImage) => void): LectureImage {
  const l = structuredClone(lectureDeCarte(B));
  f(l);
  return l;
}

async function lire(l: LectureImage) {
  return lireImage({ videoId: "essai", source: source(B) }, outils(l).outils);
}

const adaptee = (r: Awaited<ReturnType<typeof lire>>, motif: RegExp) => {
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.message);
  const a = r.carte.adaptations ?? [];
  expect(
    a.some((x) => motif.test(x)),
    a.join(" | "),
  ).toBe(true);
  expect(a.every((x) => x.startsWith("Adapté automatiquement : "))).toBe(true);
  expect(schemaCarteImage.safeParse(r.carte).success).toBe(true);
  return r.carte;
};

describe("R1 · incohérences réparées à la lecture", () => {
  it("libellé vide : pris dans le détail", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.noeuds[1].libelle = "   ";
        }),
      ),
      /libellé/i,
    );
    expect(carte.noeuds[1].libelle).toBe("IA + données : décidez plus vite et plus juste");
    expect(carte.noeuds[1].detail).toBeUndefined();
  });

  it("libellé vide et pas de détail : le bloc est retiré", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.noeuds[2].libelle = "";
          l.noeuds[2].detail = "";
        }),
      ),
      /bloc retiré/i,
    );
    expect(carte.noeuds.some((n) => n.id === "n03")).toBe(false);
  });

  it("groupe « Branche A » : remis au bon format", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.groupes = [{ id: "branche-a", sorte: "branche", titre: "", noeuds: ["n01"], majoritaire: false }];
          l.noeuds[0].groupe = "Branche A";
        }),
      ),
      /Branche A/,
    );
    expect(carte.noeuds[0].groupe).toBe("branche-a");
  });

  it("groupe cité qui n'existe pas : retiré du bloc", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.noeuds[0].groupe = "Zone Inconnue";
        }),
      ),
      /Zone Inconnue/,
    );
    expect(carte.noeuds[0].groupe).toBeUndefined();
  });

  it("quantité 150 : retirée", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.noeuds[0].quantite = 150;
        }),
      ),
      /quantité/i,
    );
    expect(carte.noeuds[0].quantite).toBeUndefined();
  });

  it("part 120 : retirée", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.liens = [{ id: "l01", de: "n01", vers: "n02", etiquette: "", part: 120, couleur: "orange", style: "plein" }];
        }),
      ),
      /part/i,
    );
    expect(carte.liens[0].part).toBeUndefined();
  });

  it("groupe vide : retiré", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.groupes = [{ id: "g-vide", sorte: "colonne", titre: "", noeuds: [], majoritaire: false }];
        }),
      ),
      /groupe.*vide|vide.*groupe/i,
    );
    expect(carte.groupes).toEqual([]);
  });

  it("texte de plus de 300 caractères : coupé au mot", async () => {
    const long = "mot ".repeat(100).trim();
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.noeuds[0].detail = long;
        }),
      ),
      /coupé/i,
    );
    expect(carte.noeuds[0].detail!.length).toBeLessThanOrEqual(300);
    expect(long.startsWith(carte.noeuds[0].detail!)).toBe(true);
  });

  it("type « inconnu » aux deux lectures : plus de refus, type déduit par le code", async () => {
    const carte = adaptee(
      await lire(
        abimee((l) => {
          l.type = "inconnu";
        }),
      ),
      /type déduit/i,
    );
    expect(carte.types[0]).toBe("benefices");
  });

  it("type « inconnu » et rien à déduire : « chaine »", async () => {
    const r = await lire(
      abimee((l) => {
        l.type = "inconnu";
        l.noeuds = l.noeuds.slice(0, 1).map((n) => ({ ...n, role: "etape" as const }));
        l.liens = [];
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.carte.types).toEqual(["chaine"]);
  });

  it("une carte propre n'a aucune adaptation", async () => {
    const r = await lire(lectureDeCarte(B));
    expect(r.ok && r.carte.adaptations).toBeUndefined();
  });
});

describe("R1 · seul refus : image trop chargée", () => {
  it("41 blocs : refus qui dit quoi faire", async () => {
    const l = abimee((x) => {
      x.noeuds = Array.from({ length: 41 }, (_, i) => ({ ...x.noeuds[0], id: `n${String(i + 1).padStart(2, "0")}`, libelle: `Bloc numéro ${i + 1}`, detail: "", ordre: i + 1 }));
      x.liens = [];
    });
    const r = await lire(l);
    expect(r).toMatchObject({ ok: false, motif: "trop-chargee", message: "Image trop chargée (41 blocs, 40 au plus) : découpez-la en deux images." });
  });
});

describe("R1 · normaliserCarteBrute (pur)", () => {
  it("rogne, ramène l'ordre, coupe les listes au maximum du schéma", () => {
    const brut = { ...structuredClone(B), titre: "  Titre  ", bandeau: Array.from({ length: 9 }, (_, i) => `b${i}`), pied: Array.from({ length: 12 }, (_, i) => `p${i}`) };
    brut.noeuds[0].ordre = 5000;
    brut.noeuds[0].icone = "x".repeat(41);
    brut.noeuds[1].sousElements = Array.from({ length: 15 }, (_, i) => `s${i}`);
    const { carte, adaptations } = normaliserCarteBrute(brut);
    expect(carte.titre).toBe("Titre");
    expect(carte.bandeau).toHaveLength(6);
    expect(carte.pied).toHaveLength(10);
    expect(carte.noeuds[0].ordre).toBe(999);
    expect(carte.noeuds[0].icone).toBeUndefined();
    expect(carte.noeuds[1].sousElements).toHaveLength(12);
    expect(adaptations.length).toBeGreaterThanOrEqual(4);
    for (const a of adaptations) expect(Object.keys(a).sort()).toEqual(["apres", "avant", "code", "raison"]);
  });
});

describe("R1 · reprise après « incomplete »", () => {
  it("efface les lectures gardées et relit vraiment (2 appels réservés de plus)", async () => {
    const carte = carteFixe("B");
    const vide: LectureImage = { ...lectureDeCarte(carte), titre: "", phraseChoc: "" };
    const m = monde();
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes: 5000 })), outilsSimules(carte, m, { lectures: { a: vide, b: vide } }));
    expect(e.refus?.code).toBe("IV_IMAGE");
    expect(e.lectures?.a).toBeDefined();
    const avant = e.caisse.reservations.filter((r) => r.etape === "lecture").length;

    e = reprendreIV(e);
    expect(e.lectures).toBeUndefined();
    expect(e.journal.at(-1)).toMatch(/relecture neuve, comptée dans le prix accordé/);

    const m2 = monde();
    e = await avancerJusquAArretIV(e, outilsSimules(carte, m2));
    expect(e.refus).toBeUndefined();
    expect(attendWillIV(e)).toBe("carte");
    expect(m2.appelsClaude.filter((a) => a.role === "lecture-image")).toHaveLength(2);
    expect(e.caisse.reservations.filter((r) => r.etape === "lecture").length).toBe(avant + 2);
  });
});
