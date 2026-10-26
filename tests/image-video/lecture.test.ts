/**
 * L5 · Lecteur d'image : préparation (PNG, tuiles, refus), double lecture simulée, fusion par le code, écarts, alertes,
 * refus, réservation avant chaque appel. AUCUN appel réel : `appeler` est un double, `convertir` aussi. Tout est figé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { pireCasRole, schemaJson, type DefinitionRole } from "@/generateur/roles/types";
import { complexiteSchema, estimationGrammaire, SEUILS_GRAMMAIRE } from "@/generateur/roles/schema-api";
import {
  fusionnerLectures,
  lireImage,
  roleLectureImage,
  schemaLectureImage,
  type DemandeReservationLecture,
  type LectureImage,
  type OutilsLecture,
} from "@/moteurs/montage-image-video/lecture";
import { CONSIGNE_LECTURE, variableLecture } from "@/moteurs/montage-image-video/lecture/consigne";
import {
  COTE_MAX_CLAUDE,
  dimensionsDe,
  formatDe,
  morceauxDe,
  planPreparation,
  preparerImage,
  type DemandeConversion,
} from "@/moteurs/montage-image-video/lecture/preparation";
import {
  appelerEnSimulation,
  convertirEnSimulation,
  enTeteImage,
  LECTURE_DEMO,
  LECTURE_VIDE,
  lectureDeCarte,
  pngSimule,
} from "@/moteurs/montage-image-video/lecture/simulation";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const LETTRES = ["A", "B", "C", "D", "E", "F"] as const;
const cartes = Object.fromEntries(LETTRES.map((l) => [l, lire(l)])) as Record<(typeof LETTRES)[number], CarteImage>;

type Journal = Parameters<typeof appelerEnSimulation>[1] & object;

/** Outils de simulation : conversion simulée, appels simulés, réservations notées dans l'ordre (avec les appels). */
function outils(lectures: Parameters<typeof appelerEnSimulation>[0], o: { refuserBudget?: boolean; conversions?: DemandeConversion[] } = {}) {
  const journal: Journal = [];
  const ordre: string[] = [];
  const reservations: DemandeReservationLecture[] = [];
  const appeler = appelerEnSimulation(lectures, journal);
  const res: OutilsLecture = {
    convertir: async (d) => {
      o.conversions?.push(d);
      return convertirEnSimulation(d);
    },
    appeler: async (role, entree) => {
      ordre.push(`appel ${entree.variable.includes("tuiles-puis-entiere") ? "b" : "a"}`);
      return appeler(role, entree);
    },
    budget: {
      reserver: async (d) => {
        ordre.push(`réserve ${d.appelId}`);
        reservations.push(d);
        return o.refuserBudget ? { ok: false, message: "plafond de dépense atteint" } : { ok: true };
      },
    },
  };
  return { outils: res, journal, ordre, reservations };
}

const source = (carte: CarteImage, octets = pngSimule(carte.image.largeur, carte.image.hauteur)) => ({ cle: carte.image.cle, empreinte: carte.image.empreinte, octets });

describe("préparation : format, dimensions, tuiles", () => {
  it("reconnaît PNG, JPEG, WebP et GIF par leurs octets et lit leurs dimensions", () => {
    for (const f of ["png", "jpeg", "webp", "gif"] as const) {
      const o = enTeteImage(f, 1080, 1350);
      expect(formatDe(o)).toBe(f);
      expect(dimensionsDe(o)).toEqual({ largeur: 1080, hauteur: 1350 });
    }
  });

  it("4 tuiles qui couvrent toute l'image et se recouvrent de 10 % du côté, agrandies ×2 sans dépasser 1 568 px", () => {
    const [entiere, ...tuiles] = morceauxDe(1080, 1350);
    expect(entiere).toMatchObject({ nom: "entiere", x: 0, y: 0, largeur: 1080, hauteur: 1350, sortieLargeur: 1080, sortieHauteur: 1350 });
    expect(tuiles.map((t) => t.nom)).toEqual(["haut-gauche", "haut-droite", "bas-gauche", "bas-droite"]);
    for (const t of tuiles) {
      expect(t.x + t.largeur).toBeLessThanOrEqual(1080);
      expect(t.y + t.hauteur).toBeLessThanOrEqual(1350);
      expect([t.sortieLargeur, t.sortieHauteur]).toEqual([t.largeur * 2, t.hauteur * 2]);
    }
    const [hg, hd, bg] = tuiles;
    // Recouvrement de 10 % du côté, à un pixel près (arrondi d'un côté impair).
    expect(Math.abs(hg.largeur + hd.largeur - 1080 - 108)).toBeLessThanOrEqual(1);
    expect(Math.abs(hg.hauteur + bg.hauteur - 1350 - 135)).toBeLessThanOrEqual(1);
    // Grande image : rien n'est envoyé au-delà de ce que Claude lit sans réduire.
    for (const m of morceauxDe(4000, 3000)) expect(Math.max(m.sortieLargeur, m.sortieHauteur)).toBeLessThanOrEqual(COTE_MAX_CLAUDE);
  });

  it("image de 600 px : refus avec une phrase simple, avant toute conversion", () => {
    const p = planPreparation(enTeteImage("png", 600, 900));
    expect(p).toMatchObject({ ok: false, motif: "trop-petite" });
    expect(!p.ok && p.message).toContain("800 px");
  });

  it("fichier qui n'est pas une image : refus « format »", () => {
    expect(planPreparation(new TextEncoder().encode("%PDF-1.7 ceci n'est pas une image"))).toMatchObject({ ok: false, motif: "format" });
  });

  it("un WebP en entrée part en PNG vers Claude (type, signature et dimensions vérifiés)", async () => {
    const conversions: DemandeConversion[] = [];
    const prep = await preparerImage(enTeteImage("webp", 1080, 1350), async (d) => {
      conversions.push(d);
      return convertirEnSimulation(d);
    });
    expect(conversions.map((c) => c.format)).toEqual(["webp"]);
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    for (const i of [prep.entiere, ...prep.tuiles]) {
      expect(i.type).toBe("image/png");
      const o = new Uint8Array(Buffer.from(i.base64, "base64"));
      expect(formatDe(o)).toBe("png");
    }
    expect(dimensionsDe(new Uint8Array(Buffer.from(prep.tuiles[0].base64, "base64")))).toEqual({ largeur: 1188, hauteur: 1486 });
  });

  it("une conversion qui rend autre chose qu'un PNG aux bonnes dimensions est refusée : rien ne part", async () => {
    const webp = enTeteImage("webp", 1080, 1350);
    expect(await preparerImage(webp, async (d) => d.morceaux.map(() => webp))).toMatchObject({ ok: false, motif: "conversion" });
    expect(await preparerImage(webp, async (d) => d.morceaux.map(() => pngSimule(100, 100)))).toMatchObject({ ok: false, motif: "conversion" });
    expect(await preparerImage(webp, async () => [])).toMatchObject({ ok: false, motif: "conversion" });
    expect(
      await preparerImage(webp, async () => {
        throw new Error("panne");
      }),
    ).toMatchObject({ ok: false, motif: "conversion" });
  });
});

describe("les 6 images redonnent exactement les cartes attendues (simulation)", () => {
  for (const l of LETTRES) {
    it(`${l}`, async () => {
      const lecture = lectureDeCarte(cartes[l]);
      const o = outils({ a: lecture, b: lecture });
      const r = await lireImage({ videoId: `essai-${l}`, source: source(cartes[l]) }, o.outils);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.carte).toEqual(cartes[l]);
      expect(r.controle.erreurs).toEqual([]);
      expect(r.appels).toBe(2);
      expect(r.simule).toBe(true);
    });
  }

  it("même résultat sur 10 lancements, et quel que soit l'ordre des listes de la lecture B", async () => {
    const lecture = lectureDeCarte(cartes.E);
    const retournee: LectureImage = { ...lecture, noeuds: [...lecture.noeuds].reverse(), liens: [...lecture.liens].reverse(), groupes: [...lecture.groupes].reverse() };
    for (let i = 0; i < 10; i++) {
      const r = await lireImage({ videoId: "essai-E", source: source(cartes.E) }, outils({ a: lecture, b: retournee }).outils);
      expect(r.ok && r.carte).toEqual(cartes.E);
    }
  });

  it("la lecture de démonstration du rôle (mode simulation du studio) est celle de l'image C", () => {
    expect(LECTURE_DEMO).toEqual(lectureDeCarte(cartes.C));
    expect(schemaLectureImage.safeParse(roleLectureImage.simuler()).success).toBe(true);
  });
});

describe("écarts entre les deux lectures", () => {
  const a = lectureDeCarte(cartes.C);
  const b: LectureImage = { ...a, noeuds: a.noeuds.map((n) => (n.id === "n04" ? { ...n, libelle: "Envoyée en 4 min" } : n)) };

  it("lecture B modifiée (« 4 sec » → « 4 min ») : un écart visible, la valeur de A gardée, le chiffre marqué « lu une fois »", async () => {
    const r = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, outils({ a, b }).outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.lecture.ecarts).toEqual([{ champ: "noeuds.n04.libelle", lectureA: "Envoyée en 4 sec", lectureB: "Envoyée en 4 min" }]);
    expect(r.carte.noeuds.find((n) => n.id === "n04")?.libelle).toBe("Envoyée en 4 sec");
    expect(r.carte.chiffres.find((c) => c.brut === "4 sec")?.lu).toBe("une-seule");
    expect(r.controle.alertes).toContain("Le chiffre « 4 sec » n'a été lu qu'une fois : vérifiez-le.");
  });

  it("un bloc vu par une seule lecture est gardé, avec une alerte et un écart", () => {
    const enPlus: LectureImage = {
      ...a,
      noeuds: [...a.noeuds, { ...a.noeuds[0], id: "n11", libelle: "Relance automatique", detail: "", ordre: 11 }],
      liens: [...a.liens, { id: "l99", de: "n10", vers: "n11", etiquette: "", part: null, couleur: "noir", style: "plein" }],
    };
    const f = fusionnerLectures(a, enPlus);
    expect(f.brouillon.noeuds.map((n) => n.id)).toContain("n11");
    expect(f.alertes).toContain("Le bloc « Relance automatique » n'a été vu que par une des deux lectures : vérifiez-le.");
    expect(f.ecarts).toContainEqual({ champ: "noeuds.n11", lectureA: "", lectureB: "Relance automatique" });
    expect(f.alertes).toContain("La flèche « Client informé » → « Relance automatique » n'a été vue que par une des deux lectures : vérifiez-la.");
  });

  it("des ids différents d'une lecture à l'autre n'inventent aucun écart (appariement par le texte)", () => {
    const renomme = (id: string) => id.replace(/^n(\d+)$/, (_, d) => `n${String(40 - Number(d)).padStart(2, "0")}`);
    const autresIds: LectureImage = {
      ...a,
      noeuds: a.noeuds.map((n) => ({ ...n, id: renomme(n.id) })),
      liens: a.liens.map((l) => ({ ...l, de: renomme(l.de), vers: renomme(l.vers) })),
      groupes: a.groupes.map((g) => ({ ...g, noeuds: g.noeuds.map(renomme) })),
    };
    const f = fusionnerLectures(a, autresIds);
    expect(f.ecarts).toEqual([]);
    expect(f.alertes).toEqual([]);
  });

  it("blocs et flèches vus par la seule lecture B : même carte (ids des chiffres compris) quel que soit l'ordre de B", async () => {
    const enPlus: LectureImage = {
      ...a,
      noeuds: [
        ...a.noeuds,
        { ...a.noeuds[0], id: "n11", libelle: "Relance sous 24h", detail: "", ordre: 11 },
        { ...a.noeuds[0], id: "n12", libelle: "Rappel en 5 min", detail: "", ordre: 12 },
      ],
      liens: [
        ...a.liens,
        { id: "l98", de: "n10", vers: "n11", etiquette: "1er rappel", part: null, couleur: "noir", style: "plein" },
        { id: "l99", de: "n11", vers: "n12", etiquette: "2 essais", part: null, couleur: "noir", style: "plein" },
      ],
    };
    const retournee: LectureImage = { ...enPlus, noeuds: [...enPlus.noeuds].reverse(), liens: [...enPlus.liens].reverse() };
    const r1 = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, outils({ a, b: enPlus }).outils);
    const r2 = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, outils({ a, b: retournee }).outils);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.carte).toEqual(r1.carte);
  });

  it("une photo de personnes vue par une seule lecture est marquée (jamais reprise) et signalée", async () => {
    const la = lectureDeCarte(cartes.A);
    const sansPhoto: LectureImage = { ...la, noeuds: la.noeuds.map((n) => ({ ...n, photoPersonnes: false })) };
    const r = await lireImage({ videoId: "essai-A", source: source(cartes.A) }, outils({ a: sansPhoto, b: la }).outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.noeuds.find((n) => n.id === "n01")?.photoPersonnes).toBe(true);
    expect(r.carte.lecture.ecarts).toContainEqual({ champ: "noeuds.n01.photoPersonnes", lectureA: "non", lectureB: "oui" });
    expect(r.controle.alertes.some((x) => x.includes("photo de personnes"))).toBe(true);
  });
});

describe("refus", () => {
  it("image de 600 px : refus, aucune réservation, aucun appel", async () => {
    const o = outils({ a: LECTURE_DEMO, b: LECTURE_DEMO });
    const r = await lireImage({ videoId: "v", source: { cle: "x", octets: pngSimule(600, 900) } }, o.outils);
    expect(r).toMatchObject({ ok: false, motif: "trop-petite", appels: 0 });
    expect(o.ordre).toEqual([]);
  });

  it("image sans texte : refus avec une phrase simple", async () => {
    const r = await lireImage({ videoId: "v", source: { cle: "x", octets: pngSimule(1080, 1080) } }, outils({ a: LECTURE_VIDE, b: LECTURE_VIDE }).outils);
    expect(r).toMatchObject({ ok: false, motif: "sans-texte" });
    expect(!r.ok && r.message).toMatch(/^Je ne lis presque aucun texte/);
  });

  it("image sans phrase du bas : la lecture réussit, la phrase du bas vaut le titre, alerte non bloquante", async () => {
    const la: LectureImage = { ...lectureDeCarte(cartes.B), phraseChoc: "", sousTitre: "" };
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, outils({ a: la, b: la }).outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.phraseChoc).toBe(r.carte.titre);
expect(r.carte.lecture.alertes.some((x) => /phrase du bas/i.test(x))).toBe(true);
  });

  it("image sans titre : le titre est déduit (sous-titre, sinon premier bloc)", async () => {
    const la: LectureImage = { ...lectureDeCarte(cartes.B), titre: "", sousTitre: "" };
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, outils({ a: la, b: la }).outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.titre).toBe(r.carte.noeuds[0]!.libelle);
    expect(r.carte.lecture.alertes.some((x) => /titre non lu/i.test(x))).toBe(true);
  });

  it("image sans aucun bloc : refus « incomplete »", async () => {
    const la: LectureImage = { ...lectureDeCarte(cartes.B), noeuds: [], liens: [], bandeau: ["a", "b", "c", "d"] };
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, outils({ a: la, b: la }).outils);
    expect(r).toMatchObject({ ok: false, motif: "incomplete" });
  });

  it("type reconnu par aucune des deux lectures (R1) : plus de refus, le type vient du code avec l'adaptation « type déduit »", async () => {
    const inconnu: LectureImage = { ...lectureDeCarte(cartes.B), type: "inconnu" };
    const o = outils({ a: inconnu, b: inconnu });
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, o.outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.types).toEqual(["benefices"]);
    expect(r.carte.adaptations?.some((x) => /type déduit/.test(x))).toBe(true);
  });

  it("enchaînement R1 puis R2 : type déduit, puis cycle excédentaire réparé, les deux dans carte.adaptations", async () => {
    const lien = (id: string, de: string, vers: string) => ({ id, de, vers, couleur: "noir" as const, style: "plein" as const });
    const abimee: CarteImage = { ...cartes.B, liens: [...cartes.B.liens, lien("r1", cartes.B.noeuds[2]!.id, cartes.B.noeuds[0]!.id), lien("r2", cartes.B.noeuds[2]!.id, cartes.B.noeuds[1]!.id), lien("l1", cartes.B.noeuds[0]!.id, cartes.B.noeuds[1]!.id), lien("l2", cartes.B.noeuds[1]!.id, cartes.B.noeuds[2]!.id)] };
    const inconnu: LectureImage = { ...lectureDeCarte(abimee), type: "inconnu" };
    const o = outils({ a: inconnu, b: inconnu });
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, o.outils);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const adaptations = r.carte.adaptations ?? [];
    expect(adaptations.some((x) => /type déduit/.test(x))).toBe(true);
    expect(adaptations.some((x) => x.startsWith("Adapté automatiquement : ") && /tournait en rond/.test(x))).toBe(true);
    expect(r.carte.lecture.alertes.some((x) => x.includes("Réparé"))).toBe(false);
    expect(r.controle.erreurs).not.toContain("Le schéma tourne en rond plus d'une fois.");
  });

  it("Will peut toujours imposer le type, sans repayer (états anciens « type à choisir »)", async () => {
    const inconnu: LectureImage = { ...lectureDeCarte(cartes.B), type: "inconnu" };
    const o2 = outils({ a: LECTURE_VIDE, b: LECTURE_VIDE });
    const r2 = await lireImage({ videoId: "essai-B", source: source(cartes.B), typeImpose: "chaine" }, o2.outils, { a: inconnu, b: inconnu });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.appels).toBe(0);
    expect(o2.ordre).toEqual([]);
    expect(r2.carte.types).toEqual(["chaine"]);
    expect(r2.carte.automatisation).toBe(true);
    expect(r2.carte.offre).toBe("integration");
  });

  it("un seul des deux lit le type : pas de refus, mais un écart « type »", async () => {
    const la = lectureDeCarte(cartes.B);
    const r = await lireImage({ videoId: "essai-B", source: source(cartes.B) }, outils({ a: la, b: { ...la, type: "inconnu" } }).outils);
    expect(r.ok && r.carte.lecture.ecarts).toEqual([{ champ: "type", lectureA: "benefices", lectureB: "inconnu" }]);
  });
});

describe("appels Claude : prix réservé avant, indépendance, aucun nom de fichier", () => {
  it("chaque appel est précédé de la réservation de son pire coût (`pireCasUsd` via le rôle)", async () => {
    const lecture = lectureDeCarte(cartes.C);
    const o = outils({ a: lecture, b: lecture });
    await lireImage({ videoId: "essai-C", source: source(cartes.C) }, o.outils);
    expect(o.ordre).toEqual(["réserve iv-lecture-essai-C-a-1", "appel a", "réserve iv-lecture-essai-C-b-1", "appel b"]);
    const role = roleLectureImage as unknown as DefinitionRole;
    for (const [i, res] of o.reservations.entries()) {
      expect(res).toMatchObject({ videoId: "essai-C", etape: "lecture-image", modele: "claude-opus-5-5" });
      const e = JSON.parse(o.journal[i].envoye);
      expect(res.coutEstimeUsd).toBeCloseTo(pireCasRole(role, e), 10);
      expect(res.coutEstimeUsd).toBeGreaterThan(0.1);
      expect(res.coutEstimeUsd).toBeLessThan(0.5);
    }
  });

  it("réservation refusée : aucun appel", async () => {
    const o = outils({ a: LECTURE_DEMO, b: LECTURE_DEMO }, { refuserBudget: true });
    const r = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, o.outils);
    expect(r).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    expect(o.ordre).toEqual(["réserve iv-lecture-essai-C-a-1"]);
  });

  it("deux appels indépendants : 5 images chacun (entière + 4 tuiles), ordre inverse, aucun ne voit l'autre", async () => {
    const lecture = lectureDeCarte(cartes.C);
    const o = outils({ a: lecture, b: lecture });
    await lireImage({ videoId: "essai-C", source: source(cartes.C) }, o.outils);
    const [ja, jb] = o.journal;
    expect([ja.sens, jb.sens]).toEqual(["a", "b"]);
    expect([ja.images, jb.images]).toEqual([5, 5]);
    expect(ja.legendes[0]).toBe("Image entière.");
    expect(jb.legendes[4]).toBe("Image entière.");
    expect(jb.envoye).not.toContain("Envoyée en 4 sec");
  });

  it("le nom du fichier et la clé de stockage ne sont JAMAIS transmis à Claude", async () => {
    const cle = "clients/Dupont-SARL/facture-confidentielle-2026.webp";
    const lecture = lectureDeCarte(cartes.C);
    const o = outils({ a: lecture, b: lecture });
    const r = await lireImage({ videoId: "essai-C", source: { cle, octets: enTeteImage("webp", 1080, 1350) } }, o.outils);
    expect(r.ok && r.carte.image.cle).toBe(cle);
    for (const j of o.journal) {
      for (const mot of ["Dupont", "facture", "confidentielle", ".webp", "clients/"]) expect(j.envoye).not.toContain(mot);
    }
    expect(CONSIGNE_LECTURE).not.toContain("Dupont");
  });

  it("réponse coupée ou illisible : une relance au plus, réservée elle aussi ; deux échecs → refus", async () => {
    const lecture = lectureDeCarte(cartes.C);
    const coupee = { ok: true as const, simule: true, texte: "{\"type\":", stopReason: "max_tokens" };
    const o = outils({ a: [coupee, lecture], b: lecture });
    const r = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, o.outils);
    expect(r.ok && r.appels).toBe(3);
    expect(o.ordre).toEqual(["réserve iv-lecture-essai-C-a-1", "appel a", "réserve iv-lecture-essai-C-a-2", "appel a", "réserve iv-lecture-essai-C-b-1", "appel b"]);

    const illisible = { ok: true as const, simule: true, texte: "pas du JSON" };
    const r2 = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, outils({ a: [illisible, illisible], b: lecture }).outils);
    expect(r2).toMatchObject({ ok: false, motif: "illisible", appels: 2 });
  });

  it("une réponse texte JSON (chemin réel, sans `donnees`) est lue comme une sortie déjà validée", async () => {
    const lecture = lectureDeCarte(cartes.D);
    const texte = { ok: true as const, simule: false, texte: JSON.stringify(lecture), coutUsd: 0.05 };
    const r = await lireImage({ videoId: "essai-D", source: source(cartes.D) }, outils({ a: texte, b: texte }).outils);
    expect(r.ok && r.carte).toEqual(cartes.D);
    expect(r.ok && r.simule).toBe(false);
    expect(r.ok && r.coutUsd).toBeCloseTo(0.1, 10);
  });

  it("panne d'appel : refus « appel », phrase reprise", async () => {
    const r = await lireImage({ videoId: "essai-C", source: source(cartes.C) }, outils({ a: { ok: false, arret: "surcharge", message: "Claude est surchargé." }, b: LECTURE_DEMO }).outils);
    expect(r).toMatchObject({ ok: false, motif: "appel", message: "Lecture de l'image interrompue : Claude est surchargé." });
  });

  it("schéma envoyé à l'API : conforme aux limites de la sortie structurée et sous les seuils de grammaire", () => {
    const s = schemaJson(schemaLectureImage);
    expect(complexiteSchema(s).problemes).toEqual([]);
    const e = estimationGrammaire(s);
    for (const k of Object.keys(SEUILS_GRAMMAIRE) as (keyof typeof SEUILS_GRAMMAIRE)[]) expect(e[k], k).toBeLessThanOrEqual(SEUILS_GRAMMAIRE[k]);
  });

  it("la partie variable ne porte que les dimensions et l'ordre des images", () => {
    expect(variableLecture("a", 1080, 1350)).toBe(
      '<image largeur="1080" hauteur="1350" ordre="entiere-puis-tuiles">\nLes images arrivent dans cet ordre : l\'image entière, puis les 4 tuiles. Pars de l\'image entière.\nRends la lecture complète de l\'image.\n</image>',
    );
  });
});
