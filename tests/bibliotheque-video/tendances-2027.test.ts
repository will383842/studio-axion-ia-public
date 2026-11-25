/** X1-00 : 10 lignes `prevu` « tendances 2027 » : jamais permises, catalogue existant inchangé. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_CAPACITES, ID, type LigneCatalogue } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_TENDANCES_2027 } from "@/briques/bibliotheque-video/catalogue/tendances-2027";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const DIX = [
  "texte.poids-variable", "texte.minimal-dynamique", "ecran.fenetre-inclinee", "fond.verre-depoli",
  "transition.zoom-mot", "transition.raccord-forme", "accroche.apercu-fin", "accroche.mot-cle",
  "mention.ia", "rythme.boucle",
] as IdCapacite[];

/** Sérialisation d'une ligne : id|etat|chantier|permis (permis vide si la clé est absente). */
const serialiser = (l: LigneCatalogue) =>
  `${l.id}|${l.etat}|${l.chantier ?? ""}|${"permis" in l ? String(l.permis) : ""}`;

const estTendance = (l: { id: string }) => DIX.includes(l.id as IdCapacite);

/** Instantané réel du catalogue de origin/master (57c4411, avant X1-00), figé en dur, dans l'ordre : id|etat|chantier|permis. */
const INSTANTANE_MASTER: string[] = [
  "texte.mot-dit-accent|prod||",
  "texte.sous-titres-v4|prod||",
  "texte.surlignage-marqueur|eteint|2 (U5, U5bis, U6)|",
  "texte.style-varie|eteint|2 (U5bis, U12)|",
  // C2-U17b 18/11 : les 7 lignes texte livrées sont désormais « eteint » (seconde lecture du pilote).
  "texte.pastille-axion|coulisse|2 (U13, U14)|",
  "texte.pave|eteint|2 (U7a, U7b)|",
  "texte.nom-outil|eteint|2 (U8)|",
  "texte.nom-outil-autonome|eteint|2 (U9)|",
  "texte.bandeau-nom|eteint|2 (U10, U11)|",
  "texte.repere-epaule|eteint|2 (U18)|",
  "texte.sortie-animee|eteint|2 (U19)|",
  "texte.escalier|eteint|2 (U20a, U20b)|",
  "ecran.clip-v4|prod||",
  "ecran.mosaique-extraits|prevu|4 (U4.1 à U4.6)|",
  "ecran.telephone-extrait|eteint|4 (U4.7 à U4.9c)|", // C4-U4.13a 19/11 : livré, éteint
  "calque.texte-derriere-double|absent||",
  "calque.texte-derriere-prise|absent||",
  "plan-scenes.cas-concret|prod||",
  "plan-scenes.facecam|eteint|5 (5.02 à 5.09)|",
  "plan-scenes.tutoriel-outil|prod||",
  "plan-scenes.demo-facecam|prod||",
  "plan-scenes.facecam-animee|eteint||",
  "transition.coupe|prod||",
  "transition.cas-concret|prod||",
  "transition.image-video|prod||",
  "transition.commune|prevu|6 (H1 à H4)|",
  "transition.style-montage|prevu|6 (H24a, H24b, H24c)|",
  "fond.vivant|prevu|6 (H5, H6)|",
  "fond.lumiere|prevu|6 (H5, H6)|",
  "etalonnage.lut-clair-obscur|prod||",
  "etalonnage.lut-naturel-selfie|prod||",
  "etalonnage.lut-doux|demande||",
  "etalonnage.lut-nuit|demande||",
  "etalonnage.lut-nouvelle|prevu|6 (H8, H9)|",
  "son.banque-studio|prod||",
  "son.v4|prod||",
  "son.registre-commun|prevu|6 (H11, H14)|",
  "son.familles-etendues|prevu|6 (H12, H13)|",
  "son.sur-transition|prevu|6 (H15)|",
  "motion.cartes-communes|prod||",
  "motion.plaquettes-v4|prod||",
  "motion.icones-bibliotheque|prevu|6 (H17, H18, H19, H20)|",
  "motion.icones-animees|prevu|6 (H17, H18, H19, H20)|",
  "motion.lottie|prevu|6 (H17, H18, H19, H20)|",
  "texte.logo-outil|prevu|8|",
  "cadrage.zoom-classique|prod|8|",
  "cadrage.zoom-avocat|prod|8|",
  "cadrage.zoom-demo|prod|8|",
  "cadrage.camera-cas-concret|prod|8|",
  "cadrage.zoom-v4|absent|8|",
  "motion.avis-client|prevu|8|",
  "objet.trait|prevu|9|",
  "objet.marque|prevu|9|",
  "objet.etiquette|prevu|9|",
  "objet.appel|prevu|9|",
  "objet.chiffre|prevu|9|",
  "objet.etape|prevu|9|",
  "objet.cartes|prevu|9|",
  "objet.schema|prevu|9|",
  "objet.ecran|prevu|9|",
  "objet.reseau-schema|prevu|9|",
  "objet.manuscrit|prevu|9|",
  "objet.emoji|prevu|9|",
  // CATALOGUE-C10-C11-v21p
  "accroche.script|prevu|10|",
  "rythme.mesure|prevu|10|",
  "etalonnage.noir-blanc|prevu|10|",
  "texte.lueur|prevu|10|",
  "texte.fond-clair|prevu|10|",
  "texte.sous-titres|prevu|E2 (G2-02, G2-03)|",
  "plan-scenes.generique|prevu|E2 (G2-02, G2-03)|",
  "son.pose|prevu|E2 (G2-02, G2-03)|",
  "etalonnage.lut|prevu|E2 (G2-02, G2-03)|",
  // CATALOGUE-C10-C11-v21p
  "texte.marques-au-mot|eteint|11|",
  "texte.selectif|eteint|11|",
  "texte.mode-carte|prevu|11|",
  "texte.effets|prevu|11|",
  "texte.accents-role|prevu|11|",
  "motion.v4-coulisse.LogoOutil|coulisse||",
  "motion.v4-coulisse.Equation|coulisse||",
  "motion.v4-coulisse.FriseEtapes|coulisse||",
  "motion.v4-coulisse.FilEtape|coulisse||",
  "motion.v4-coulisse.AvisEtoiles|coulisse||",
  "motion.v4-coulisse.PageWebDefile|coulisse||",
  "motion.v4-coulisse.FenetrePleinCadre|coulisse||",
  "motion.v4-coulisse.BandeVideo|coulisse||",
  "motion.v4-coulisse.CercleEpaule|coulisse||",
  "motion.v4-coulisse.mot-derriere|coulisse||",
  "motion.v4-coulisse.element-barre-pictos|coulisse||",
  "motion.v4-coulisse.appel-final-pile|coulisse||",
  "motion.v4-coulisse.panneau-fin|coulisse||",
];

describe("X1-00 · tendances 2027", () => {
  it("chaque identifiant : une fois dans ID, une fois au catalogue, prevu, chantier X1", () => {
    for (const id of DIX) {
      expect(Object.values(ID).filter((v) => v === id), id).toHaveLength(1);
      const l = CATALOGUE_CAPACITES.filter((x) => x.id === id);
      expect(l, id).toHaveLength(1);
      expect(l[0].etat).toBe("prevu");
      expect(l[0].chantier).toBe("X1");
    }
    expect(LIGNES_TENDANCES_2027).toHaveLength(10);
  });
  it("aucune ligne permise, aucune chaîne objet.", () => {
    for (const l of LIGNES_TENDANCES_2027) {
      expect("permis" in l).toBe(false);
      expect(l.id.startsWith("objet.")).toBe(false);
    }
    const src = readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/catalogue/tendances-2027.ts"), "utf8");
    expect(src.includes("objet.")).toBe(false);
  });
  it("aucun profil ne permet l'un des 10 ; porteCapacite ne donne jamais permis", () => {
    const profils = [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")];
    for (const p of profils) for (const id of DIX) expect(p.capacites[id]?.permis === true, `${p.id} ${id}`).toBe(false);
    for (const id of DIX) {
      expect(porteCapacite({}, id)).toEqual({ bibliotheque: false });
      const entree = { bibliothequeVideo: { version: "bibliotheque-video/1", profil: profilNeutre("podcast"), recents: [], graine: "g", figeeLe: "2026-11-16T00:00:00.000Z" } };
      const r = porteCapacite(entree, id);
      expect(r.bibliotheque === true ? r.permis : false).toBe(false);
    }
  });
  it("éteint = identique : sans les 10 lignes, le catalogue est celui de master (instantané figé, élément par élément)", () => {
    const hors = CATALOGUE_CAPACITES.filter((l) => !estTendance(l));
    expect(hors.map(serialiser)).toEqual(INSTANTANE_MASTER);
    // les 10 lignes sont en fin de catalogue, dans l'ordre du fichier neuf
    expect(CATALOGUE_CAPACITES.slice(hors.length)).toEqual(LIGNES_TENDANCES_2027);
    expect(CATALOGUE_CAPACITES.slice(hors.length).every(estTendance)).toBe(true);
  });
});
