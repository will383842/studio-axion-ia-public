/**
 * FACE CAMÉRA ANIMÉE — COÛT HONNÊTE (relevé de Will : 0,05 € annoncé, 2,00 € payé pour l'appel Opus). L'estimation affichée avant
 * « Animer ma vidéo » chiffre la vraie requête du réalisateur v4 (jusqu'à 3 essais) et nomme le plafond Claude de 4 $ par vidéo ;
 * après coup, le vrai coût payé s'affiche. Aucun appel réseau, aucun plafond ni prix changé.
 */
import { describe, expect, it } from "vitest";
import { dollarsFA, eurosFA, lignesCout, phrasePaye } from "@/components/formats/facecam-animee/cout";
import { MAX_JETONS_REALISATEUR_V4, entreeRoleRealisateurV4, roleRealisateurV4 } from "@/moteurs/montage-facecam-animee/realisateur/role-v4";
import { estimerOpusV4, motsPourEstimation } from "@/moteurs/montage-facecam-animee/realisateur/cout-v4";
import { ESSAIS_MAX_REALISATEUR, messageAvecErreurs, messageRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { construireRequete } from "@/generateur/roles/types";
import { MODELE_ECRITURE, coutUsd, jetonsEstimes } from "@/fournisseurs/claude/tarifs";
import { PLAFOND_CLAUDE_FA_USD, estimationDuLot } from "@/services/facecam-animee";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";

const PLAFOND = PLAFOND_CLAUDE_FA_USD;

/** Un essai SIMULÉ au coût réel de l'API : la vraie requête d'une prise parlée au débit donné, sortie à son maximum (pensée comprise). */
function coutEssaiSimuleUsd(dureeSec: number, motsParSeconde: number, essai: number): number {
  const n = Math.ceil(dureeSec * motsParSeconde);
  const mots = Array.from({ length: n }, (_, i) => ({ w: i % 7 ? "automatiser" : "dossier,", a: i / motsParSeconde, f: (i + 0.8) / motsParSeconde }));
  const entree = { mots, dureeSec, titre: "Vidéo", prise: { src: "p", finSec: dureeSec }, fin: { marque: "", adresse: "", motCle: "", tuiles: [] } };
  let message = messageRealisateur(entree);
  if (essai > 1) message = messageAvecErreurs(message, ["Forme : elementsV4[3].mots — trop long.", "V8a — mot interdit."], { elementsV4: Array.from({ length: 40 }, (_, i) => ({ id: "CarteChecklist", debut: i, fin: i + 2, mots: ["DOSSIER"], recherches: ["un chef de chantier devant un plan"] })) });
  const requete = construireRequete(roleRealisateurV4(), entreeRoleRealisateurV4({ systeme: "", message, schema: {} }));
  const texte = [...requete.systeme.map((b) => b.texte), ...requete.messages.map((m) => m.contenu)].join("\n");
  // Tout l'entrant compté en écriture de cache (le plus cher), toute la sortie permise consommée.
  return coutUsd({ entree: 0, cacheLu: 0, cacheEcrit: jetonsEstimes(texte), sortie: MAX_JETONS_REALISATEUR_V4 }, MODELE_ECRITURE);
}

describe("Coût honnête · l'estimation n'est jamais sous le coût réel", () => {
  it.each([15, 30, 60, 80, 120, 180])("prise de %i s : le pire cas couvre 3 essais simulés au maximum de sortie", (duree) => {
    const reel = [1, 2, 3].reduce((t, e) => t + coutEssaiSimuleUsd(duree, 3.2, e), 0);
    const e = estimerOpusV4({ dureeSec: duree, plafondUsd: PLAFOND });
    expect(e.pireCasUsd).toBeGreaterThanOrEqual(reel);
    expect(e.unEssaiUsd).toBeGreaterThanOrEqual(coutEssaiSimuleUsd(duree, 3.2, 1));
    expect(e.essaisMax).toBe(ESSAIS_MAX_REALISATEUR);
  });

  it("le coût mesuré de l'essai réel de Will (2,00 € pour l'appel Opus) est couvert, en euros, pour une prise de 80 s", () => {
    const e = estimerOpusV4({ dureeSec: 80, plafondUsd: PLAFOND });
    expect(e.pireCasUsd * TAUX_USD_EUR_PAR_DEFAUT).toBeGreaterThanOrEqual(2.0);
    // Et l'ancienne annonce (0,05 €) était bien plus basse que ce que le plafond laisse dépenser.
    expect(0.05).toBeLessThan(e.engageMaxUsd * TAUX_USD_EUR_PAR_DEFAUT);
  });

  it("le texte dit, plus long que la durée ne le laisse croire, fait monter l'estimation (jamais l'inverse)", () => {
    const court = estimerOpusV4({ dureeSec: 30, plafondUsd: PLAFOND });
    const long = estimerOpusV4({ dureeSec: 30, motsTexte: 900, plafondUsd: PLAFOND });
    expect(long.pireCasUsd).toBeGreaterThan(court.pireCasUsd);
    expect(motsPourEstimation(30, 10)).toBe(Math.ceil(30 * 3.5));
    expect(motsPourEstimation(30, 900)).toBe(900);
  });
});

describe("Coût honnête · plafond de 4 $ par vidéo", () => {
  it("le plafond n'a pas bougé et borne la dépense annoncée", () => {
    expect(PLAFOND_CLAUDE_FA_USD).toBe(4);
    const e = estimerOpusV4({ dureeSec: 600, plafondUsd: PLAFOND });
    expect(e.engageMaxUsd).toBeLessThanOrEqual(PLAFOND);
    expect(e.engageMaxUsd).toBe(Math.min(e.pireCasUsd, PLAFOND));
  });

  it("lot : plafond par vidéo, total = somme des vidéos", () => {
    const e = estimationDuLot([{ dureeSec: 60 }, { dureeSec: 60 }], PLAFOND, TAUX_USD_EUR_PAR_DEFAUT);
    const une = estimationDuLot([{ dureeSec: 60 }], PLAFOND, TAUX_USD_EUR_PAR_DEFAUT);
    expect(e.videos).toBe(2);
    expect(e.pireCasLotCentimesEur).toBe(2 * une.pireCasCentimesEur);
    expect(e.plafondUsd).toBe(4);
    expect(e.renduCentimesEur).toBe(0);
    expect(e.voixCentimesEur).toBe(0);
  });
});

describe("Coût honnête · ce qui s'affiche", () => {
  const e = estimationDuLot([{ dureeSec: 80 }], PLAFOND, TAUX_USD_EUR_PAR_DEFAUT);
  const l = lignesCout(e);
  it("pire cas, plafond en dollars et en euros, rendu et voix à 0 €", () => {
    expect(l.pireCas).toContain(eurosFA(e.pireCasCentimesEur));
    expect(l.pireCas).toContain("3 essais");
    expect(l.plafond).toContain("4 $");
    expect(l.plafond).toContain(eurosFA(e.plafondCentimesEur));
    expect(l.autres).toContain("0 €");
  });
  it("aucun mot interdit à l'écran", () => {
    const tout = [...Object.values(l), phrasePaye(138), dollarsFA(4)].join(" ");
    expect(tout).not.toMatch(/\b(job|render|prompt|token|api|upload|pipeline|workflow|mock|fictif|dashboard|avatar)\b|certifexemple|certifi|villeexemple/i);
  });
  it("le vrai coût payé se dit en euros", () => {
    expect(phrasePaye(200)).toBe(`Déjà payé : ${eurosFA(200)}`);
    expect(eurosFA(200)).toMatch(/^2,00\s€$/);
  });
});
