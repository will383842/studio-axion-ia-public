/**
 * L2 · Trajectoire de caméra : avance 0,2-0,3 s, vitesse ≤ 1,2 écran/s, zoom 0,8-1,6 (aucun dézoom d'ensemble), nœud
 * parlé entier dans la bande de contenu à l'heure de son mot, taille effective (taille × zoom) ≥ plancher à tout instant.
 * Heures des mots simulées, figées : 8 mots par nœud à 2,75 mots/s, 4 mots de transition à chaque changement de groupe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { BORNES_CAMERA, boiteALEcran, cameraA, deborde, doux, mesurerTrajectoire, posesDesMots, trajectoireCamera } from "@/briques/schema-motion/camera";
import { disposerToile } from "@/briques/schema-motion/disposition";
import { controlerLisibiliteToile, PLANCHER_IV, TAILLE_DETAIL_IV, TAILLE_LIBELLE_IV, tailleEffective } from "@/briques/schema-motion/lisibilite";
import { ECRAN_IV, ZONE_CONTENU_IV, type MotParle } from "@/briques/schema-motion/types";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const SCHEMAS = ["C", "D", "E", "F", "faux-16-noeuds"] as const;
const DEBIT = 2.75;

/**
 * Ordre de récit : tronc, puis chaque branche (majoritaire d'abord) avec retour visible au nœud de décision avant la
 * suivante ; sans branche, ordre de lecture. Heures : 8 mots par nœud, + 4 mots quand le groupe change.
 */
function motsSimules(carte: CarteImage): MotParle[] {
  const tries = [...carte.noeuds].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
  const branches = carte.groupes.filter((g) => g.sorte === "branche");
  const decision = carte.noeuds.find((n) => n.role === "decision");
  const suite: string[] = [];
  if (branches.length >= 2 && decision) {
    const dansBranche = new Set(branches.flatMap((g) => g.noeuds));
    const tronc = tries.filter((n) => !dansBranche.has(n.id));
    const avant = tronc.filter((n) => n.ordre <= decision.ordre).map((n) => n.id);
    const apres = tronc.filter((n) => n.ordre > decision.ordre).map((n) => n.id);
    const ordonnees = [...branches].sort((a, b) => Number(!!b.majoritaire) - Number(!!a.majoritaire) || a.id.localeCompare(b.id));
    suite.push(...avant);
    ordonnees.forEach((g, i) => {
      if (i > 0) suite.push(decision.id);
      suite.push(...tries.filter((n) => g.noeuds.includes(n.id)).map((n) => n.id));
    });
    suite.push(...apres);
  } else suite.push(...tries.map((n) => n.id));
  const groupeDe = new Map(carte.noeuds.map((n) => [n.id, n.groupe ?? ""]));
  const mots: MotParle[] = [];
  let t = 1;
  suite.forEach((id, i) => {
    if (i > 0 && groupeDe.get(id) !== groupeDe.get(suite[i - 1])) t += 4 / DEBIT;
    mots.push({ noeud: id, t: Math.round(t * 1000) / 1000 });
    t += 8 / DEBIT;
  });
  return mots;
}

for (const nom of SCHEMAS) {
  describe(`caméra sur ${nom}`, () => {
    const carte = lire(nom);
    const toile = disposerToile(carte);
    const mots = motsSimules(carte);
    const duree = mots[mots.length - 1].t + 3;
    const traj = trajectoireCamera(toile, mots, duree);

    it("aucun retard signalé", () => {
      expect(traj.alertes).toEqual([]);
    });

    it("vitesse ≤ 1,2 écran/s et zoom dans 0,8-1,6 à tout instant", () => {
      const m = mesurerTrajectoire(traj);
      expect(m.vitesseMax).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-9);
      expect(m.zoomMin).toBeGreaterThanOrEqual(BORNES_CAMERA.zoomMin);
      expect(m.zoomMax).toBeLessThanOrEqual(BORNES_CAMERA.zoomMax);
    });

    it("le nœud parlé est entier dans la bande de contenu à l'heure de son mot", () => {
      const parId = new Map(toile.boites.map((b) => [b.id, b]));
      for (const m of mots) {
        const e = boiteALEcran(parId.get(m.noeud)!, cameraA(traj, m.t));
        expect(e.x, m.noeud).toBeGreaterThanOrEqual(0);
        expect(e.x + e.largeur, m.noeud).toBeLessThanOrEqual(ECRAN_IV.largeur);
        expect(e.y, m.noeud).toBeGreaterThanOrEqual(ZONE_CONTENU_IV.haut * ECRAN_IV.hauteur - 1e-6);
        expect(e.y + e.hauteur, m.noeud).toBeLessThanOrEqual(ZONE_CONTENU_IV.bas * ECRAN_IV.hauteur + 1e-6);
      }
    });

    it("la caméra est arrivée 0,2 à 0,3 s avant chaque mot et ne bouge plus jusqu'au mot", () => {
      // Pose visée à chaque mot : cadrage propre (aucun bloc coupé), calculé par `posesDesMots`.
      const poses = posesDesMots(toile, mots, duree);
      const poseDe = (m: MotParle) => poses.find((x) => x.noeud === m.noeud && x.t === m.t)!.pose;
      for (const m of mots) {
        const cible = poseDe(m);
        for (const avance of [BORNES_CAMERA.avanceMin, 0.1, 0]) {
          const p = cameraA(traj, m.t - avance);
          expect(p.cx).toBeCloseTo(cible.cx, 6);
          expect(p.cy).toBeCloseTo(cible.cy, 6);
          expect(p.zoom).toBeCloseTo(cible.zoom, 6);
        }
      }
      // Arrivée (image clé sur la pose du nœud) entre 0,3 et 0,2 s avant le mot, sauf au premier mot (cadré dès 0 s) et
      // quand le cadrage du mot d'avant convient déjà (la caméra ne bouge pas).
      for (const [i, m] of mots.entries()) {
        if (i === 0) continue;
        const cible = poseDe(m);
        const avant = poseDe(mots[i - 1]);
        if (avant.cx === cible.cx && avant.cy === cible.cy && avant.zoom === cible.zoom) continue;
        const arrivee = traj.images.find((i) => Math.abs(i.cx - cible.cx) < 1e-9 && Math.abs(i.cy - cible.cy) < 1e-9 && i.zoom === cible.zoom && i.t <= m.t);
        expect(arrivee, m.noeud).toBeDefined();
        const derniere = [...traj.images].reverse().find((i) => i.t <= m.t && Math.abs(i.cx - cible.cx) < 1e-9 && Math.abs(i.cy - cible.cy) < 1e-9)!;
        const premiereDuMaintien = traj.images.filter((i) => i.t <= derniere.t && i.t > m.t - 10).find((i) => Math.abs(i.cx - cible.cx) < 1e-9 && Math.abs(i.cy - cible.cy) < 1e-9 && i.t >= m.t - BORNES_CAMERA.avanceMax - 1e-9);
        expect(premiereDuMaintien, m.noeud).toBeDefined();
        expect(m.t - premiereDuMaintien!.t).toBeGreaterThanOrEqual(BORNES_CAMERA.avanceMin - 1e-9);
      }
    });

    it("aucun texte lisible sous le plancher effectif, à aucun instant", () => {
      expect(controlerLisibiliteToile(toile, traj)).toEqual([]);
    });

    it("même trajectoire à chaque appel (20 fois)", () => {
      for (let i = 0; i < 20; i++) expect(trajectoireCamera(toile, mots, duree)).toEqual(traj);
    });
  });
}

describe("bornes et cas limites", () => {
  const carte = lire("C");
  const toile = disposerToile(carte);

  it("tailles de la toile : au plancher même au zoom le plus faible", () => {
    expect(tailleEffective(TAILLE_LIBELLE_IV, BORNES_CAMERA.zoomMin)).toBeGreaterThanOrEqual(PLANCHER_IV);
    expect(tailleEffective(TAILLE_DETAIL_IV, BORNES_CAMERA.zoomMin)).toBeGreaterThanOrEqual(PLANCHER_IV - 1e-12);
  });

  it("deux mots trop rapprochés : la vitesse n'est jamais dépassée, le retard est signalé", () => {
    const loin: MotParle[] = [
      { noeud: "n06", t: 1 },
      { noeud: "n01", t: 1.3 },
    ];
    const traj = trajectoireCamera(toile, loin, 4);
    expect(traj.alertes).toHaveLength(1);
    expect(mesurerTrajectoire(traj).vitesseMax).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-9);
  });

  it("le contrôle de lisibilité repère un zoom sous 0,8 (dézoom d'ensemble refusé)", () => {
    const b = toile.boites[0];
    const traj = { images: [{ t: 0, cx: b.x, cy: b.y, zoom: 0.55 }, { t: 1, cx: b.x, cy: b.y, zoom: 0.55 }] };
    expect(controlerLisibiliteToile(toile, traj).length).toBeGreaterThan(0);
  });

  it("un nœud absent de la toile est signalé, jamais inventé", () => {
    expect(trajectoireCamera(toile, [{ noeud: "n99", t: 1 }], 3).alertes).toEqual(["Le bloc n99 n'est pas sur la toile."]);
  });

  it("une boîte trop haute pour tenir au zoom 0,8 est signalée (le zoom reste borné)", () => {
    const haute = { ...toile.boites[0], id: "haute", hauteur: 1400 };
    expect(deborde(haute)).toBe(true);
    for (const b of toile.boites) expect(deborde(b), b.id).toBe(false);
    const traj = trajectoireCamera({ ...toile, boites: [...toile.boites, haute] }, [{ noeud: "haute", t: 1 }], 3);
    expect(traj.alertes).toEqual(["Le bloc haute est trop grand pour tenir entier dans le cadre : raccourcissez son texte."]);
    expect(traj.images[0].zoom).toBe(BORNES_CAMERA.zoomMin);
  });

  it("courbe douce : part et arrive à vitesse nulle", () => {
    expect(doux(0)).toBe(0);
    expect(doux(1)).toBe(1);
    expect(doux(0.001)).toBeLessThan(0.0001);
    expect(1 - doux(0.999)).toBeLessThan(0.0001);
  });
});
