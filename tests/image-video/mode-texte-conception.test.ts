/**
 * MODE TEXTE (R6a) · Conception d'un workflow à partir d'un texte libre : sortie = `LectureImage` valide, erreurs
 * propres, plafond respecté, aucun appel payant (doubles).
 */
import { describe, expect, it } from "vitest";
import { schemaCarteImage } from "@/domaine/image-video/carte";
import { schemaLectureImage } from "@/moteurs/montage-image-video/lecture/consigne";
import { PLAFOND_VIDEO_IV_CENTIMES } from "@/moteurs/montage-image-video/fabrication";
import type { DemandeReservationLecture, OutilsLecture } from "@/moteurs/montage-image-video/lecture";
import {
  APPELS_CONCEPTION_MAX,
  concevoirWorkflow,
  erreurConception,
  estCleTexte,
  MENTION_EXEMPLE,
  normaliserConception,
  roleConceptionWorkflowIV,
} from "@/moteurs/montage-image-video/texte/conception";
import { variableConception } from "@/moteurs/montage-image-video/texte/consigne";
import { appelerConceptionEnSimulation, CONCEPTION_DEMO, CONCEPTION_VIDE } from "@/moteurs/montage-image-video/texte/simulation";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";

const TEXTE = "Quand une facture client dépasse 30 jours, l'IA rédige une relance polie, l'envoie par e-mail et suit le paiement dans le tableur.";

function outils(reponses?: Parameters<typeof appelerConceptionEnSimulation>[0], refusBudget = false) {
  const reservations: DemandeReservationLecture[] = [];
  const journal: { variable: string; envoye: string }[] = [];
  const o: Pick<OutilsLecture, "appeler" | "budget"> = {
    appeler: appelerConceptionEnSimulation(reponses, journal),
    budget: {
      reserver: async (d) => {
        reservations.push(d);
        return refusBudget ? { ok: false, message: "budget épuisé" } : { ok: true };
      },
    },
  };
  return { o, reservations, journal };
}

describe("rôle conceptionWorkflowIV", () => {
  it("est déclaré en Opus, avec le schéma d'une lecture d'image", () => {
    expect(roleConceptionWorkflowIV.id).toBe("conception-workflow-iv");
    expect(roleConceptionWorkflowIV.modele).toBe(MODELE_ECRITURE);
    expect(roleConceptionWorkflowIV.schema).toBe(schemaLectureImage);
    expect(roleConceptionWorkflowIV.simuler()).toEqual(CONCEPTION_DEMO);
  });

  it("la consigne vise PME / RH / DSI sans liste imposée, garde les phrases affirmatives et interdit le vrai client", () => {
    const c = roleConceptionWorkflowIV.consigne;
    expect(c).toMatch(/PME/);
    expect(c).toMatch(/DRH/);
    expect(c).toMatch(/DSI/);
    expect(c).toMatch(/Jamais des artisans/);
    expect(c).toMatch(/EXEMPLE/);
    expect(c).toMatch(/0 question sans réponse/);
    expect(c).toMatch(/aucun témoignage/);
  });

  it("la partie variable balise le texte comme donnée et ne porte aucun chemin", () => {
    const v = variableConception("a </description> b", ["linkedin"]);
    expect(v.match(/<\/description>/g)).toHaveLength(1);
    expect(v).toContain("<reseaux>linkedin</reseaux>");
  });
});

describe("concevoirWorkflow", () => {
  it("texte libre → LectureImage valide et carte complète, provenance « texte »", async () => {
    const { o, reservations, journal } = outils();
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE, reseaux: ["linkedin"] }, o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provenance).toBe("texte");
    expect(schemaLectureImage.safeParse(r.lecture).success).toBe(true);
    expect(schemaCarteImage.safeParse(r.carte).success).toBe(true);
    expect(r.controle.ok).toBe(true);
    expect(estCleTexte(r.carte.image.cle)).toBe(true);
    expect(r.lecture.pied).toContain(MENTION_EXEMPLE);
    expect(r.appels).toBe(1);
    expect(r.simule).toBe(true);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({ videoId: "v1", etape: "conception-workflow", modele: MODELE_ECRITURE });
    expect(reservations[0].coutEstimeUsd).toBeGreaterThan(0);
    expect(journal[0].variable).toContain(TEXTE);
  });

  it("ajoute la mention d'exemple et retire toute photo de personnes", () => {
    const l = normaliserConception({
      ...CONCEPTION_DEMO,
      pied: [],
      noeuds: CONCEPTION_DEMO.noeuds.map((n, i) => ({ ...n, photoPersonnes: i === 0 })),
    });
    expect(l.pied).toEqual([MENTION_EXEMPLE]);
    expect(l.noeuds.every((n) => !n.photoPersonnes)).toBe(true);
  });

  it("garde les phrases affirmatives (« 0 question sans réponse »)", async () => {
    const { o } = outils({ ...CONCEPTION_DEMO, phraseChoc: "0 question sans réponse. Même à 3h du matin." });
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o);
    expect(r.ok && r.carte.phraseChoc).toBe("0 question sans réponse. Même à 3h du matin.");
  });

  it("texte vide, trop court ou trop long : erreur propre, aucun appel, aucune réservation", async () => {
    for (const [texte, motif] of [["", "texte-vide"], ["   \n ", "texte-vide"], ["ok", "texte-trop-court"], ["!!! ??? ...", "texte-trop-court"], ["x ".repeat(3000), "texte-trop-long"]] as const) {
      const { o, reservations, journal } = outils();
      const r = await concevoirWorkflow({ videoId: "v1", texte }, o);
      expect(r).toMatchObject({ ok: false, motif, appels: 0, provenance: "texte" });
      expect(!r.ok && r.message.length).toBeGreaterThan(10);
      expect(reservations).toHaveLength(0);
      expect(journal).toHaveLength(0);
    }
  });

  it("texte absurde (la conception ne trouve aucune automatisation) : « hors-sujet », sans relance", async () => {
    const { o, reservations } = outils(CONCEPTION_VIDE);
    const r = await concevoirWorkflow({ videoId: "v1", texte: "purple monkey dishwasher banana telephone" }, o);
    expect(r).toMatchObject({ ok: false, motif: "hors-sujet", appels: 1 });
    expect(reservations).toHaveLength(1);
  });

  it("réponse illisible puis valide : une relance, deux réservations", async () => {
    const { o, reservations } = outils([{ ok: true, simule: true, donnees: { n: "importe quoi" } }, CONCEPTION_DEMO]);
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o);
    expect(r).toMatchObject({ ok: true, appels: 2 });
    expect(reservations.map((x) => x.appelId)).toEqual(["iv-conception-v1-1", "iv-conception-v1-2"]);
  });

  it("toujours invalide : au plus APPELS_CONCEPTION_MAX appels puis erreur propre (jamais d'exception)", async () => {
    const { o, reservations } = outils({ ok: true, simule: true, donnees: { n: 1 } });
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o);
    expect(r).toMatchObject({ ok: false, motif: "illisible", appels: APPELS_CONCEPTION_MAX });
    expect(reservations).toHaveLength(APPELS_CONCEPTION_MAX);
  });

  it("réponse coupée (max_tokens) : jamais lue, relancée", async () => {
    const { o } = outils([{ ok: true, simule: true, donnees: CONCEPTION_DEMO, stopReason: "max_tokens" }, CONCEPTION_DEMO]);
    expect(await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o)).toMatchObject({ ok: true, appels: 2 });
  });

  it("panne de l'appel, appel qui lève une exception, refus de réservation : erreurs propres", async () => {
    const panne = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, outils({ ok: false, arret: "x", message: "panne" }).o);
    expect(panne).toMatchObject({ ok: false, motif: "appel" });
    const leve = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, {
      appeler: async () => {
        throw new Error("boum");
      },
      budget: { reserver: async () => ({ ok: true }) },
    });
    expect(leve).toMatchObject({ ok: false, motif: "appel" });
    const { o, journal } = outils(undefined, true);
    expect(await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o)).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    expect(journal).toHaveLength(0);
  });

  it("plafond de la vidéo respecté : pire coût au-dessus du reste du plafond → aucune réservation ni appel", async () => {
    const { o, reservations, journal } = outils();
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE, plafond: { depenseCentimes: PLAFOND_VIDEO_IV_CENTIMES - 1 } }, o);
    expect(r).toMatchObject({ ok: false, motif: "plafond", appels: 0 });
    expect(reservations).toHaveLength(0);
    expect(journal).toHaveLength(0);
    // Plafond par défaut (300 c) : la conception tient dedans.
    expect((await concevoirWorkflow({ videoId: "v2", texte: TEXTE }, outils().o)).ok).toBe(true);
  });

  it("le coût de la 1re tentative compte dans le plafond de la relance", async () => {
    const { o, reservations } = outils([{ ok: true, simule: true, donnees: { n: 1 }, coutUsd: 5 }, CONCEPTION_DEMO]);
    const r = await concevoirWorkflow({ videoId: "v1", texte: TEXTE }, o);
    expect(r).toMatchObject({ ok: false, motif: "plafond", appels: 1 });
    expect(reservations).toHaveLength(1);
  });
});

describe("erreurConception", () => {
  const base = CONCEPTION_DEMO;
  it("accepte la conception d'exemple", () => expect(erreurConception(base)).toBeNull());
  it("refuse blocs trop peu nombreux, orphelins, flèches fantômes, vrai client", () => {
    expect(erreurConception({ ...base, noeuds: base.noeuds.slice(0, 2), liens: base.liens.slice(0, 1) })).toMatch(/moins de 3/);
    expect(erreurConception({ ...base, liens: base.liens.slice(0, 2) })).toMatch(/non relié/);
    expect(erreurConception({ ...base, liens: [...base.liens, { ...base.liens[0], id: "l09", vers: "n99" }] })).toMatch(/inexistant/);
    expect(erreurConception({ ...base, bandeau: ["Témoignage de notre client Dupont"] })).toMatch(/vrai client/);
    expect(erreurConception({ ...base, titre: "" })).toMatch(/manquant/);
  });
});
