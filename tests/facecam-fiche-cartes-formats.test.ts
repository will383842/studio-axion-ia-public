/**
 * FICHE VIDÉO FACE CAMÉRA (10/10, test de l'interface sur la vidéo v-f9fa51b46cba) — aucun appel réel.
 *  1. « Cartes et effets » liste TOUTES les cartes (automatiques comprises) ; retirer, déplacer, changer le texte d'une
 *     carte automatique ne refait que la piste habillée, et une carte retirée ne revient pas à la retouche suivante ;
 *     les cartes du monteur cohabitent avec les cartes automatiques (celles-ci s'effacent devant elles).
 *  2. Nouveau format : durée annoncée honnête (passe image comprise) et progression qui suit la vraie passe.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { planifierCartesAuto } from "@/briques/habillage-facecam";
import { carteDepuisTextes } from "@/briques/motion";
import { ajustementsAuMontage, carteAvecTextes, cartesAutoDeLaVideo, cleCarteAuto, lireInstant, priseVersMonteeGardes, textesDeCarte } from "@/moteurs/montage-facecam/cartes-video";
import { cartesAPoser, habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { lireReglagesMonteur, reglagesMonteurVides } from "@/moteurs/montage-facecam/monteur";
import { partiesARefaire, signatureMontage } from "@/moteurs/montage-facecam/retouche";
import { DUREES_NOUVEAU_FORMAT, estimationNouveauFormat, progressionNouveauFormat } from "@/moteurs/montage-facecam/declinaisons";
import type { EtatChaine } from "@/moteurs/montage-facecam/chaine";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const MOTS = reel.mots;
const DUREE = 130.732;
const AUTO = planifierCartesAuto(MOTS, DUREE);

describe("1 · toutes les cartes de la vidéo, automatiques comprises", () => {
  it("le fixture réel porte plusieurs cartes automatiques : toutes listées, avec modèle, textes et moment", () => {
    const { posees, vues } = cartesAutoDeLaVideo(MOTS, DUREE);
    expect(AUTO.length).toBeGreaterThanOrEqual(3);
    expect(vues).toHaveLength(AUTO.length);
    expect(posees).toHaveLength(AUTO.length);
    expect(vues.map((v) => v.id)).toEqual(AUTO.map((_, i) => `auto-${i + 1}`));
    for (const v of vues) {
      expect(v.etat).toBe("posee");
      expect(v.textes.filter(Boolean).length).toBeGreaterThan(0);
      expect(v.finSec).toBeGreaterThan(v.debutSec);
    }
  });

  it("clé stable (modèle + textes) et textes aller-retour : chaque carte se refait à l'identique depuis ses textes", () => {
    for (const c of AUTO) {
      expect(cleCarteAuto(c.carte)).toBe(cleCarteAuto(structuredClone(c.carte)));
      const r = carteAvecTextes(c.carte, textesDeCarte(c.carte));
      expect("carte" in r).toBe(true);
      // Rien ne se perd : icônes, numérotation, sur-titre et instants dits restent tels quels.
      if ("carte" in r) expect(r.carte).toEqual(c.carte);
    }
    // Les instants ne comptent pas dans la clé : la même carte plus tard garde sa clé.
    const decale = MOTS.map((m) => ({ ...m, debutSec: m.debutSec + 4, finSec: m.finSec + 4 }));
    const cles = planifierCartesAuto(decale, DUREE + 4).map((c) => cleCarteAuto(c.carte));
    expect(cles).toEqual(AUTO.map((c) => cleCarteAuto(c.carte)));
  });

  it("retirer une carte automatique : plus posée, et elle ne revient pas à la retouche suivante", () => {
    const cle = cleCarteAuto(AUTO[1].carte);
    const r = cartesAutoDeLaVideo(MOTS, DUREE, [{ cle, retiree: true }]);
    expect(r.posees.map((p) => p.id)).not.toContain("auto-2");
    expect(r.vues.find((v) => v.cle === cle)?.etat).toBe("retiree");
    // Retouche suivante (rien d'autre ne change) : mêmes gestes relus des entrées → toujours retirée.
    const entrees = { facecamMonteur: { ...reglagesMonteurVides(), cartesAuto: [{ cle, retiree: true }] } };
    const relus = lireReglagesMonteur(entrees).cartesAuto;
    const suivante = cartesAutoDeLaVideo(MOTS, DUREE, ajustementsAuMontage(relus, (s) => s));
    expect(suivante.posees.map((p) => p.id)).not.toContain("auto-2");
    // Et dans l'habillage réel (écrans partagés de la composition) : une carte de moins.
    const avant = habillageFacecam({ pisteMonteeCle: "p.mov", dureeSec: DUREE, mots: MOTS, prefixeCartes: "c" });
    const apres = habillageFacecam({ pisteMonteeCle: "p.mov", dureeSec: DUREE, mots: MOTS, prefixeCartes: "c", cartesAuto: [{ cle, retiree: true }] });
    expect(apres.cartes.length).toBe(avant.cartes.length - 1);
    expect(apres.cartesAutoVues.find((v) => v.cle === cle)?.etat).toBe("retiree");
  });

  it("déplacer « à 0:32 » : même durée, et la carte automatique qu'elle recouvre est masquée", () => {
    const c = AUTO[AUTO.length - 1];
    const cle = cleCarteAuto(c.carte);
    const cible = AUTO[0].debutSec;
    const r = cartesAutoDeLaVideo(MOTS, DUREE, [{ cle, debutSec: cible }]);
    const v = r.vues.find((x) => x.cle === cle)!;
    expect(v.debutSec).toBeCloseTo(cible, 3);
    expect(v.finSec - v.debutSec).toBeCloseTo(c.finSec - c.debutSec, 3);
    expect(v.deplacee).toBe(true);
    expect(r.vues[0].etat).toBe("masquee");
    expect(r.posees.some((p) => p.id === v.id && Math.abs(p.debutSec - cible) < 1e-3)).toBe(true);
  });

  it("changer le texte : la carte est refaite avec les nouveaux textes ; un texte qui ne tient pas est refusé en clair", () => {
    const liste = AUTO.find((c) => c.carte.modele === "liste" || c.carte.modele === "check-list") ?? AUTO[0];
    const textes = textesDeCarte(liste.carte).map((t, i) => (i === 0 ? `${t} (corrigé)` : t));
    const r = cartesAutoDeLaVideo(MOTS, DUREE, [{ cle: cleCarteAuto(liste.carte), textes }]);
    const v = r.vues.find((x) => x.texteChange)!;
    expect(v.textes[0]).toContain("(corrigé)");
    const chiffre = AUTO.find((c) => c.carte.modele === "chiffre")!;
    expect(carteAvecTextes(chiffre.carte, ["pas de nombre ici", "x"])).toEqual({ message: expect.stringContaining("Ce texte ne tient pas") });
    expect(carteAvecTextes(liste.carte, ["", " "])).toEqual({ message: "Écrivez le texte de la carte." });
    // « 45 min » → « 30 min » : valeur changée, sur-titre et icône gardés.
    const trente = carteAvecTextes(chiffre.carte, ["30 min", "gratuit · en visio", "Le diagnostic fuite"]);
    expect("carte" in trente && (trente.carte.donnees as unknown as { valeur: number; surTitre: string; icone: string })).toMatchObject({ valeur: 30, surTitre: "Le diagnostic fuite", icone: "loupe" });
  });

  it("cartes du monteur ET cartes automatiques cohabitent (avant : la moindre carte du monteur effaçait les automatiques)", () => {
    const a = AUTO[0];
    // Intégration avec V6 P0 n° 9 (#24) : 1 s d'écart au moins entre une carte du monteur et une automatique ; la carte
    // du monteur finit donc assez tôt pour ne pas toucher la carte automatique suivante (24,39 s sur le fixture réel).
    const monteur = { id: "pas-1", debutSec: a.debutSec + 0.5, finSec: a.debutSec + 3, disposition: "moitie-haute" as const, carte: carteDepuisTextes("liste", ["Trois étapes", "Un", "Deux", "Trois"])! };
    const { posees, cartesAuto } = cartesAPoser({ mots: MOTS, dureeSec: DUREE, cartes: [monteur] });
    expect(posees.map((p) => p.id)).toContain("pas-1");
    expect(posees.length).toBe(1 + AUTO.length - 1);
    expect(cartesAuto[0].etat).toBe("masquee");
    expect(posees.map((p) => p.debutSec)).toEqual([...posees.map((p) => p.debutSec)].sort((x, y) => x - y));
  });

  it("retouche partielle « carte » : un geste sur une carte automatique ne refait QUE la piste habillée", () => {
    const base = { facecam: { coupes: { auto: [{ id: "c1", type: "silence", debutSec: 10, finSec: 12 }], retablies: [] }, passages: [], consignes: [] } };
    const avec = { ...base, facecamMonteur: { ...reglagesMonteurVides(), cartesAuto: [{ cle: "ca-x", retiree: true }] } };
    const s1 = signatureMontage(base);
    const s2 = signatureMontage(avec);
    expect(s2.habillage).not.toBe(s1.habillage);
    expect([...partiesARefaire(s1, s2)]).toEqual(["habillage"]);
    // Sans geste : empreinte identique à celle des versions d'avant (rien n'est refait pour rien).
    expect(signatureMontage({ ...base, facecamMonteur: reglagesMonteurVides() }).habillage).toBe(s1.habillage);
  });

  it("temps : un déplacement est gardé dans la prise et ramené au montage d'après les passages gardés", () => {
    const gardes = [
      { debutSec: 0, finSec: 10 },
      { debutSec: 15, finSec: 40 },
    ];
    expect(priseVersMonteeGardes(5, gardes)).toBe(5);
    expect(priseVersMonteeGardes(12, gardes)).toBe(10);
    expect(priseVersMonteeGardes(20, gardes)).toBe(15);
    expect(ajustementsAuMontage([{ cle: "a", debutPriseSec: 20 }, { cle: "b", retiree: true }], (s) => priseVersMonteeGardes(s, gardes))).toEqual([{ cle: "a", debutSec: 15 }, { cle: "b", retiree: true }]);
    expect(lireInstant("0:32")).toBe(32);
    expect(lireInstant("1:05,5")).toBe(65.5);
    expect(lireInstant("45")).toBe(45);
    expect(lireInstant("demain")).toBeNull();
  });
});

describe("2 · nouveau format : durée annoncée et progression honnêtes", () => {
  const plan = (debut: number, fin: number) => ({ debutSec: debut, finSec: fin, priseDebutSec: debut, priseFinSec: fin + 10, cadre: { x: 1200, y: 0, largeur: 1215, hauteur: 2160 } });
  function etat(o: { passeLarge?: { statut: "soumis" | "termine"; progression?: number }; cadrage?: number } = {}): EtatChaine {
    const plans = [plan(0, 60), plan(60, 120)] as unknown as NonNullable<EtatChaine["plans"]>;
    return {
      version: "reprise-formats-1",
      travaux: { passe: { id: "p", statut: "termine", essais: 0, resultat: { fichierCle: "image.mp4", bande: { x: 1200, largeur: 1216 } } } },
      plans,
      sauts: [],
      declinaisons: {
        version: "1",
        ratios: ["1:1"],
        imposes: ["1:1"],
        source: { largeur: 3840, hauteur: 2160 },
        plans: { "1:1": plans.map((p) => ({ ...p, ratio: "1:1", cadre: { x: 840, y: 0, largeur: 2160, hauteur: 2160 } })) as never },
        cadrages: o.cadrage !== undefined ? { "1:1": { id: "c", statut: "soumis", progression: o.cadrage, essais: 0 } } : {},
        ...(o.passeLarge ? { passeLarge: { id: "ver-passe-formats", essais: 0, ...o.passeLarge } } : {}),
        repriseHabillage: { dureeSec: 120, mots: [], coupesSec: [] },
      },
    } as EtatChaine;
  }

  it("un format qui sort de la bande traitée annonce la passe image : ≈ 10 à 20 min pour 2 min, jamais 3 s", () => {
    const e = estimationNouveauFormat(etat());
    expect(e.passeElargie).toBe(true);
    expect(e.passeSec).toBe(DUREES_NOUVEAU_FORMAT.passeParSecPrise * 130);
    expect(e.totalSec / 60).toBeGreaterThanOrEqual(10);
    expect(e.totalSec / 60).toBeLessThanOrEqual(20);
    // Passe élargie déjà faite : seuls cadrage et habillage restent.
    expect(estimationNouveauFormat(etat({ passeLarge: { statut: "termine" } })).passeElargie).toBe(false);
  });

  it("la progression suit la vraie passe (40 % de la passe → bien plus que 1 %) et le temps restant baisse", () => {
    const e = estimationNouveauFormat(etat());
    const debut = progressionNouveauFormat(etat({ passeLarge: { statut: "soumis", progression: 0 } }), e);
    const milieu = progressionNouveauFormat(etat({ passeLarge: { statut: "soumis", progression: 40 } }), e);
    const apres = progressionNouveauFormat(etat({ passeLarge: { statut: "termine" }, cadrage: 50 }), e);
    expect(debut.progression).toBe(0);
    expect(debut.resteSec).toBe(e.totalSec);
    expect(milieu.progression).toBe(Math.round((40 * e.passeSec) / e.totalSec));
    expect(milieu.progression).toBeGreaterThan(20);
    expect(milieu.resteSec).toBeLessThan(debut.resteSec);
    expect(apres.progression).toBeGreaterThan(milieu.progression);
    expect(apres.resteSec).toBeLessThan(milieu.resteSec);
  });
});
