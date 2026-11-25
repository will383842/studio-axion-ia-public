/** C9-03 : famille `objet` au catalogue : 12 lignes `prevu`, jamais permises. */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPACITES_OBJET } from "@/briques/motion/petits-objets/contrat";
import { CATALOGUE_CAPACITES, ID } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_OBJETS } from "@/briques/bibliotheque-video/catalogue/objets";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const racine = process.cwd();
const IDS_OBJET = Object.values(ID).filter((i) => i.startsWith("objet.")) as IdCapacite[];

/** Lignes (id|etat) du catalogue sur master avant C9-03, hors `objet.*`. */
const HORS_OBJET_MASTER = [
  "texte.mot-dit-accent|prod",
  "texte.sous-titres-v4|prod",
  "texte.surlignage-marqueur|eteint",
  "texte.style-varie|eteint",
  // C2-U17b 18/11 : les 7 lignes texte livrées sont désormais « eteint » (seconde lecture du pilote).
  "texte.pastille-axion|coulisse",
  "texte.pave|eteint",
  "texte.nom-outil|eteint",
  "texte.nom-outil-autonome|eteint",
  "texte.bandeau-nom|eteint",
  "texte.repere-epaule|eteint",
  "texte.sortie-animee|eteint",
  "texte.escalier|eteint",
  "ecran.clip-v4|prod",
  "ecran.mosaique-extraits|eteint", // C4-U4.13-b-v20j 20/11 : livré, branché, éteint
  "ecran.telephone-extrait|eteint", // C4-U4.13a 19/11 : livré, éteint
  "calque.texte-derriere-double|absent",
  "calque.texte-derriere-prise|absent",
  "plan-scenes.cas-concret|prod",
  "plan-scenes.facecam|eteint",
  "plan-scenes.tutoriel-outil|prod",
  "plan-scenes.demo-facecam|prod",
  "plan-scenes.facecam-animee|eteint",
  "transition.coupe|prod",
  "transition.cas-concret|prod",
  "transition.image-video|prod",
  "transition.commune|prevu",
  "transition.style-montage|prevu",
  "fond.vivant|prevu",
  "fond.lumiere|prevu",
  "etalonnage.lut-clair-obscur|prod",
  "etalonnage.lut-naturel-selfie|prod",
  "etalonnage.lut-doux|demande",
  "etalonnage.lut-nuit|demande",
  "etalonnage.lut-nouvelle|prevu",
  "son.banque-studio|prod",
  "son.v4|prod",
  "son.registre-commun|prevu",
  "son.familles-etendues|prevu",
  "son.sur-transition|prevu",
  "motion.cartes-communes|prod",
  "motion.plaquettes-v4|prod",
  "motion.icones-bibliotheque|prevu",
  "motion.icones-animees|prevu",
  "motion.lottie|prevu",
  "texte.logo-outil|prevu",
  "cadrage.zoom-classique|prod",
  "cadrage.zoom-avocat|prod",
  "cadrage.zoom-demo|prod",
  "cadrage.camera-cas-concret|prod",
  "cadrage.zoom-v4|eteint", // C8-X01-b-v20j (seconde lecture du pilote)
  "motion.avis-client|prevu",
  // CATALOGUE-C10-C11-v21p
  "accroche.script|prevu",
  "rythme.mesure|prevu",
  "etalonnage.noir-blanc|prevu",
  "texte.lueur|prevu",
  "texte.fond-clair|prevu",
  "texte.sous-titres|prevu",
  "plan-scenes.generique|prevu",
  "son.pose|prevu",
  "etalonnage.lut|prevu",
  // CATALOGUE-C10-C11-v21p
  "texte.marques-au-mot|eteint",
  "texte.selectif|eteint",
  "texte.mode-carte|prevu",
  "texte.effets|prevu",
  "texte.accents-role|prevu",
  // C11-C2-a-v20k (seconde lecture du pilote)
  "cadrage.camera-couverture|eteint",
  "ecran.carte-video-arrondie|prevu",
  "ecran.grilles-archive|prevu",
  "ecran.ecrans-composes|prevu",
  "motion.titre-etape-montante|prevu",
  "motion.v4-coulisse.LogoOutil|coulisse",
  "motion.v4-coulisse.Equation|coulisse",
  "motion.v4-coulisse.FriseEtapes|coulisse",
  "motion.v4-coulisse.FilEtape|coulisse",
  "motion.v4-coulisse.AvisEtoiles|coulisse",
  "motion.v4-coulisse.PageWebDefile|coulisse",
  "motion.v4-coulisse.FenetrePleinCadre|coulisse",
  "motion.v4-coulisse.BandeVideo|coulisse",
  "motion.v4-coulisse.CercleEpaule|coulisse",
  "motion.v4-coulisse.mot-derriere|coulisse",
  "motion.v4-coulisse.element-barre-pictos|coulisse",
  "motion.v4-coulisse.appel-final-pile|coulisse",
  "motion.v4-coulisse.panneau-fin|coulisse",
  // X1-00
  "texte.poids-variable|prevu",
  "texte.minimal-dynamique|prevu",
  "ecran.fenetre-inclinee|prevu",
  "fond.verre-depoli|prevu",
  "transition.zoom-mot|prevu",
  "transition.raccord-forme|prevu",
  "accroche.apercu-fin|prevu",
  "accroche.mot-cle|prevu",
  "mention.ia|prevu",
  "rythme.boucle|prevu",
];

describe("famille objet (C9-03)", () => {
  it("les 12 ids de LIGNES_OBJETS = CAPACITES_OBJET du socle, tous prevu", () => {
    expect(LIGNES_OBJETS.map((l) => l.id).sort()).toEqual([...CAPACITES_OBJET].sort());
    expect(IDS_OBJET.sort()).toEqual([...CAPACITES_OBJET].sort());
    expect(LIGNES_OBJETS.every((l) => l.etat === "prevu" && l.chantier === "9")).toBe(true);
    expect(LIGNES_OBJETS.find((l) => l.id === "objet.emoji")?.note).toBe("attend W-K / W-14");
  });

  it("aucune ligne objet.* hors de objets.ts", () => {
    const dir = join(racine, "src/briques/bibliotheque-video/catalogue");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && n !== "objets.ts")) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/objet\./);
    }
    expect(CATALOGUE_CAPACITES.filter((l) => l.id.startsWith("objet.")).map((l) => l.id).sort()).toEqual([...CAPACITES_OBJET].sort());
  });

  it("aucun profil ne permet une capacité objet, sauf les 3 du tableau animé (ALLUMER-OBJETS-TABLEAU-v20g)", () => {
    const TABLEAU = ["objet.chiffre", "objet.etape", "objet.marque"];
    for (const p of [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")]) {
      for (const id of IDS_OBJET) expect(p.capacites[id]?.permis === true, `${p.id} ${id}`).toBe(p.id === "tableau-anime/1" && TABLEAU.includes(id));
    }
  });

  it("porte : sans entrée, ou avec un profil sans liste, rien d'objet n'est permis", () => {
    for (const id of IDS_OBJET) {
      expect(porteCapacite({}, id)).toEqual({ bibliotheque: false });
      const entree = { bibliothequeVideo: { version: "bibliotheque-video/1", profil: profilNeutre("podcast"), recents: [], graine: "g", figeeLe: "2026-11-16T00:00:00.000Z" } };
      const r = porteCapacite(entree, id);
      expect(r.bibliotheque === true ? r.permis : false).toBe(false);
    }
  });

  it("éteint = identique : le catalogue hors objet.* est celui de master", () => {
    const hors = CATALOGUE_CAPACITES.filter((l) => !l.id.startsWith("objet.")).map((l) => `${l.id}|${l.etat}`);
    expect(hors).toEqual(HORS_OBJET_MASTER);
  });
});
