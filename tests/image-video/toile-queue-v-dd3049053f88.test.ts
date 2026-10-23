/**
 * Correctif du travail v-dd3049053f88 (64,3 s, 5 réseaux), refusé par les contrôles GRATUITS après rendu :
 *  1. Q21 · la vue d'ensemble de sa toile (12 blocs + 3 chiffres-clés) descendait dans la bande des sous-titres
 *     (y 509 → 1361 pour une zone utile de 605 px, y 509 → 1114). Fixture : le schéma et les vues d'ensemble du vrai travail.
 *  2. Q24 · image figée 1,72 s sans voix : la queue de fin (voix finie ≥ 1,5 s avant la fin, Q19) restait immobile.
 *     Prévu ici depuis la ligne de temps seule (`passagesFigesPrevusIV`), jugé comme sur le fichier final
 *     (`figeHorsVoixMaxSec` avec les paroles de la ligne).
 * PUR : aucun rendu, aucun appel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SchemaEntree } from "@/briques/schema-motion";
import { empriseEnsemble } from "@/briques/schema-motion/emprise";
import { controlerMiseEnPage, PLANCHER_PX_IV, zoneUtile } from "@/briques/schema-motion/mise-en-page";
import { planEnsemble } from "@/briques/schema-motion/plan-objets";
import { BANDE_SOUS_TITRES_IV } from "@/briques/schema-motion/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FIGE_IV, figeHorsVoixMaxSec } from "@/moteurs/montage-image-video/commandes-ffmpeg";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { passagesFigesPrevusIV } from "@/moteurs/montage-image-video/queue-fin";
import { QUEUE_FIN_IV, planQueueFin } from "@/briques/schema-motion/queue-fin";
import { COMPOSITIONS_RENDU_IV, parolesDeLaLigneIV, scenesDeLaLigne } from "@/services/image-video-rendu";

const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/toile-v-dd3049053f88.json"), "utf8")) as { schema: SchemaEntree };
const CHIFFRES = ["23h14", "80%", "4 sec"];
const ZONE = zoneUtile();
const H = 1920;

describe("v-dd3049053f88 · la vue d'ensemble de la toile (12 blocs, 3 chiffres-clés) tient dans la zone utile", () => {
  const allumages = [["n01"], ...FIXTURE.schema.noeuds.filter((n) => n.id !== "n01").map((n) => [n.id])];
  for (const allumes of allumages) {
    it(`allumé ${allumes[0]} : ni bande des sous-titres, ni bord, ni plancher ; blocs et chiffres dans la zone utile`, () => {
      const plan = planEnsemble(FIXTURE.schema, { allumes, chiffresCles: CHIFFRES });
      const defauts = controlerMiseEnPage(empriseEnsemble(plan));
      expect(defauts.filter((d) => /bande|touche le bord|plancher/.test(d))).toEqual([]);
      expect(plan.blocs.map((b) => b.id).sort()).toEqual(FIXTURE.schema.noeuds.map((n) => n.id).sort());
      const poses = [...plan.blocs.map((b) => ({ nom: b.id, y: b.y, bas: b.y + b.hauteur })), ...plan.chiffres.map((c) => ({ nom: c.texte, y: c.y, bas: c.y + c.hauteur }))];
      for (const p of poses) {
        expect(p.y, p.nom).toBeGreaterThanOrEqual(ZONE.y - 1e-6);
        expect(p.bas, p.nom).toBeLessThanOrEqual(ZONE.y + ZONE.hauteur + 1e-6);
        expect(p.bas, p.nom).toBeLessThanOrEqual(BANDE_SOUS_TITRES_IV.haut * H);
      }
      for (const b of plan.blocs) expect(b.libelle.taille, b.id).toBeGreaterThanOrEqual(PLANCHER_PX_IV - 1e-6);
      for (const c of plan.chiffres) expect(c.taille * H, c.texte).toBeGreaterThanOrEqual(PLANCHER_PX_IV - 1e-6);
    });
  }
});

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", C: "essai-c", "faux-16-noeuds": "essai-faux16" } as const;

function lignesDe(nom: keyof typeof IMAGES): LigneDeTempsIV[] {
  const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
  return fins.map((fin) => mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES }).ligne);
}

describe("queue de fin : aucune image figée prévisible de plus de 0,5 s hors voix", () => {
  for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
    it(`${nom} : chaque version (avec ou sans segment de fin)`, () => {
      for (const ligne of lignesDe(nom)) {
        const horsVoix = figeHorsVoixMaxSec(passagesFigesPrevusIV(ligne), parolesDeLaLigneIV(ligne));
        expect(horsVoix, `${nom} ${ligne.version}`).toBeLessThanOrEqual(FIGE_IV.horsVoixMaxSec + 1e-9);
      }
    });
  }
});

describe("queue de fin : le trait se dessine dans le dernier bloc rendu", () => {
  it("la queue va du dernier mot dit à 0,2 s avant la fin ; seul le dernier bloc la reçoit (un écran v4 passe par ImageVideoEcranFin)", () => {
    for (const ligne of lignesDe("C")) {
      const q = ligne.queue!;
      const paroles = parolesDeLaLigneIV(ligne);
      expect(q.debutSec).toBeCloseTo(Math.max(...paroles.map((m) => m.finSec)), 3);
      expect(q.finSec).toBeCloseTo(ligne.dureeSec - QUEUE_FIN_IV.tenueSec, 3);
      // Q19 inchangé : la voix finit toujours ≥ 1,5 s avant la fin.
      expect(ligne.dureeSec - ligne.finVoixSec).toBeGreaterThanOrEqual(1.5 - 1e-6);
      const scenes = scenesDeLaLigne(ligne, { env: "test", videoId: "v-test" });
      const avecQueue = scenes.filter((s) => "queue" in s.parametres.proprietes);
      expect(avecQueue.map((s) => s.id)).toEqual([scenes[scenes.length - 1].id]);
      const derniere = avecQueue[0];
      expect(derniere.parametres.proprietes.queue).toEqual({ debutSec: +Math.max(0, q.debutSec - derniere.debutSec).toFixed(3), finSec: +(q.finSec - derniere.debutSec).toFixed(3) });
      if (derniere.sorte === "ecran") expect(derniere.parametres.composition).toBe(COMPOSITIONS_RENDU_IV.ecranFin);
    }
  });

  it("le trait avance d'un mouvement régulier (jamais deux images de suite identiques) puis reste posé ; dans la bande des sous-titres", () => {
    const q = { debutSec: 10, finSec: 11.5 };
    expect(planQueueFin(q, 9.99)).toBeNull();
    const pas = 1 / 25;
    let avant = -1;
    for (let t = q.debutSec + pas; t <= q.finSec + 1e-9; t += pas) {
      const p = planQueueFin(q, t)!;
      expect(p.trait - avant).toBeGreaterThan(20);
      avant = p.trait;
    }
    const fin = planQueueFin(q, 12)!;
    expect(fin.trait).toBe(fin.largeur);
    expect(fin.y).toBeGreaterThanOrEqual(BANDE_SOUS_TITRES_IV.haut * H);
    expect(fin.y + fin.hauteur).toBeLessThanOrEqual(BANDE_SOUS_TITRES_IV.bas * H);
    expect(fin.x).toBeGreaterThanOrEqual(0.05 * 1080);
  });
});
