/**
 * Les quatre défauts de la vidéo blog `v-275dc041c303` (cas `articles-blog`), corrigés À LA SOURCE pour tous les cas :
 *  (a) écran vide ~2 s : le premier élément d'un écran « titre » posé sur le 6e mot ;
 *  (b) « 75 SUR. » : l'unité d'un fait « 75 sur 100 » réduite à la liaison ;
 *  (c) carte blanche : l'objet `liste-taches` d'une étape sans textes ;
 *  (d) « RECRUTEMENT · CAS RÉEL » sur la fin d'une vidéo blog : l'étiquette absente prenait celle des propriétés par
 *      défaut de la composition (l'accroche d'exemple de la v4).
 * Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { proprietesEcrans, textesEcran, type ProprietesEcran } from "@/briques/ecrans-motion";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { verifierCas, type FaitCas } from "@/formats/cas-concret/cas";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { ETIQUETTE_POSTURE, surTitreDuCas } from "@/formats/cas-concret/recette";
import { completerFiche, uniteDuFait } from "@/moteurs/montage-cas-concret/champs-du-cas";
import { ECRAN_VIDE_MAX_MS, avecPointFinal, contenuEcran, ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import type { Ecran, EcranCorps } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { planTitre } from "../../../studio-rendu/compositions/cas-concret/plans/Titre";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";

const ZONE = { haut: 14, droite: 18, bas: 30, gauche: 6 };
const FIXE = { videoId: "v-275dc041c303", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const blog = trouverCas("articles-blog")!;
const recrutement = trouverCas("recrutement-apporteurs")!;
const commun = { marque: "axion-ia.com", avanceMs: 0 };

/** Fusion que fait Remotion : propriétés par défaut de la composition, puis celles envoyées. */
const commeRemotion = (p: ProprietesEcran) => ({ ...exempleEcran("accroche"), ...JSON.parse(JSON.stringify(p)) }) as ProprietesEcran;

describe("(a) un écran n'est jamais vide plus d'un court instant", () => {
  // Écran 4 de la vidéo blog : « Et maintenant ? » posé sur « Alors » (6e mot), soit ~2 s après le début de l'écran.
  const titre = { ...commun, id: "e04", type: "titre", fond: "ivoire", eclair: true, texteDit: "Des heures, pour chaque article. Alors on a tout automatisé.", lignes: ["Et maintenant ?", "Tout tourne seul"], orange: ["seul"], evenements: [{ cible: "titre-1", surMot: 5, avanceMs: 0 }, { cible: "titre-2", surMot: 8, avanceMs: 0 }], debutMs: 10_000, finMs: 13_400 } as EcranCorps;
  const evenements = [
    { ecranId: "e04", cible: "titre-1", debutMs: 11_950 },
    { ecranId: "e04", cible: "titre-2", debutMs: 12_700 },
  ];

  it("le premier élément prévu tard entre au début de l'écran ; la suite garde son mot", () => {
    const [c] = ecransCales([titre], evenements, null, {});
    expect(c.evenements.find((e) => e.cible === "titre-1")!.ms).toBe(10_000);
    expect(c.evenements.find((e) => e.cible === "titre-2")!.ms).toBe(12_700);
  });

  it("à l'image : « Et maintenant ? » est visible avant la fin du court instant permis", () => {
    const [p] = proprietesEcrans({ ecrans: ecransCales([titre], evenements, null, {}), captures: {}, zoneProtegee: ZONE }) as Extract<ProprietesEcran, { type: "titre" }>[];
    const image = Math.round((ECRAN_VIDE_MAX_MS / 1000) * p.fps);
    const plan = planTitre(p, image);
    expect(Math.max(...plan.lignes[0].mots.map((m) => m.opacite))).toBeGreaterThan(0.5);
  });

  it("un premier élément qui arrive tôt n'est pas déplacé (la v4 : aucun « titre-1 » posé)", () => {
    const [c] = ecransCales([titre], [{ ecranId: "e04", cible: "titre-1", debutMs: 10_300 }], null, {});
    expect(c.evenements[1]).toEqual({ cible: "titre-1", ms: 10_300 });
  });
});

describe("(b) l'unité d'un fait « X sur Y » porte Y", () => {
  const fait = (enonce: string, valeurs: number[]): FaitCas => ({ id: "f", enonce, valeurs, source: "code", preuve: "p" });

  it("« Sous 75 sur 100, l'article est réécrit. » → 75 « sur 100 », affiché « 75 SUR 100. »", () => {
    const f = blog.faits.find((x) => x.id === "reecrit-sous-75")!;
    expect(uniteDuFait(f, 75)).toEqual({ valeur: 75, unite: "sur 100" });
    expect(avecPointFinal("Sous soixante-quinze, il est réécrit.", "sur 100")).toBe("sur 100.");
  });

  it("la fiche complétée de l'écran 8 porte l'unité entière", () => {
    const lue = { ecrans: [{ type: "chiffre", fond: "ivoire", texteDit: "Sous soixante-quinze, il est réécrit.", evenements: [{ cible: "unite", surMot: 1 }], faitId: "reecrit-sous-75", variante: "simple" }] };
    const { brute } = completerFiche(lue, { ...FIXE, cas: blog });
    expect((brute as { ecrans: { valeur: number; unite: string }[] }).ecrans[0]).toMatchObject({ valeur: 75, unite: "sur 100" });
  });

  it("deux valeurs liées par « à » ; unités simples inchangées ; un mot outil n'est jamais une unité", () => {
    expect(uniteDuFait(fait("L'IA écrit 900 à 1300 mots par article.", [900, 1300]), 900)).toEqual({ valeur: 900, unite: "à 1300 mots" });
    expect(uniteDuFait(fait("L'IA écrit 900 à 1300 mots par article.", [900, 1300]), 1300)).toEqual({ valeur: 1300, unite: "mots" });
    expect(uniteDuFait(fait("Un nouveau sujet est choisi toutes les 15 minutes.", [15]))).toEqual({ valeur: 15, unite: "minutes" });
    expect(uniteDuFait(fait("Une note sur 100 est calculée sur 13 critères.", [100, 13]), 100)).toBeUndefined();
    expect(uniteDuFait(fait("Une note sur 100 est calculée sur 13 critères.", [100, 13]), 13)).toEqual({ valeur: 13, unite: "critères" });
  });
});

describe("(c) une liste de tâches n'est jamais une carte blanche", () => {
  // Écran 5 de la vidéo blog : étape « Le sujet », objet `liste-taches` sans textes.
  const lue = { ecrans: [{ type: "etape", fond: "sombre", texteDit: "Toutes les quinze minutes, un nouveau sujet est choisi.", evenements: [{ cible: "objet", surMot: 4 }], titre: "Le sujet", ligne: "Tiré d'une réserve de sujets", visuel: { sorte: "objet", objet: "liste-taches" } }] };

  it("la fiche complétée porte des tâches tirées du cas et de l'étape, et le note", () => {
    const { brute, notes } = completerFiche(lue, { ...FIXE, cas: blog });
    const visuel = (brute as { ecrans: { visuel: { textes?: string[] } }[] }).ecrans[0].visuel;
    expect(visuel.textes).toEqual(["Trouver un sujet", "Tiré d'une réserve de sujets"]);
    expect(visuel.textes!.every((t) => t.length <= 40)).toBe(true);
    expect(notes.join(" ")).toMatch(/liste-taches/);
    // La fiche lue n'est jamais modifiée.
    expect((lue.ecrans[0].visuel as { textes?: string[] }).textes).toBeUndefined();
  });

  it("des textes donnés par l'écriture sont gardés tels quels", () => {
    const avec = structuredClone(lue);
    (avec.ecrans[0].visuel as { textes?: string[] }).textes = ["Choisir le sujet"];
    const { brute } = completerFiche(avec, { ...FIXE, cas: blog });
    expect((brute as { ecrans: { visuel: { textes?: string[] } }[] }).ecrans[0].visuel.textes).toEqual(["Choisir le sujet"]);
  });

  it("même sans passer par l'écriture (fiche fournie), l'objet rendu porte la ligne de l'écran", () => {
    const e = { ...commun, id: "e05", type: "etape", fond: "sombre", texteDit: "Toutes les quinze minutes, un nouveau sujet est choisi.", evenements: [], numero: 1, total: 5, titre: "Le sujet", ligne: "Tiré d'une réserve de sujets.", visuel: { sorte: "objet", objet: "liste-taches" }, puces: [] } as EcranCorps;
    expect(contenuEcran(e, null, {})).toMatchObject({ visuel: { objet: "liste-taches", textes: ["Tiré d'une réserve de sujets"] } });
  });
});

describe("(d) le sur-titre de la fin vient du cas de la vidéo", () => {
  it("chaque cas du catalogue a un thème court, valide ; « Recrutement » reste celui du recrutement", () => {
    for (const cas of CATALOGUE) {
      expect(cas.theme, cas.id).toBeTruthy();
      expect(cas.theme!.split(/\s+/).length, cas.id).toBeLessThanOrEqual(2);
      expect(verifierCas(cas).ok, cas.id).toBe(true);
    }
    expect(surTitreDuCas(recrutement)).toBe("Recrutement · cas réel");
    expect(surTitreDuCas(blog)).toBe("Blog · cas réel");
    expect(surTitreDuCas({ posture: "offre" })).toBe(ETIQUETTE_POSTURE.offre);
  });

  const fin = planDesFins({ reseaux: ["facebook"], offre: "integration", nature: "automatisation", mot: "BLOG", avecMot: false, table: TABLE_FINS_DIAGNOSTIC }).fins[0];
  const cales = (surTitre: string) => {
    let t = 50_000;
    const ecrans = fin.ecrans.map((e) => ({ ...e, debutMs: t, finMs: (t += 3000) })) as Ecran[];
    return proprietesEcrans({ ecrans: ecransCales(ecrans, [], fin, {}, [], surTitre), captures: {}, zoneProtegee: ZONE });
  };

  it("vidéo blog : l'écran du lien porte « Blog · cas réel », même fusionné aux propriétés par défaut de la composition", () => {
    const lien = cales(surTitreDuCas(blog)).find((p) => p.type === "lien")!;
    expect(textesEcran(lien).titre).toBe("Le lien est en commentaire");
    expect(textesEcran(commeRemotion(lien)).etiquette).toBe("Blog · cas réel");
  });

  it("vidéo recrutement (v4) : le même sur-titre qu'avant, « Recrutement · cas réel »", () => {
    const lien = cales(surTitreDuCas(recrutement)).find((p) => p.type === "lien")!;
    expect(textesEcran(commeRemotion(lien)).etiquette).toBe(textesEcran(exempleEcran("accroche")).etiquette);
  });

  it("l'appel au mot et la preuve portent aussi le sur-titre du cas", () => {
    const preuve = { ...commun, id: "e09", type: "preuve", fond: "sombre", texteDit: "Et tout est vérifié.", evenements: [], titre: "Tout *vérifié*", puces: ["Doublons", "Plagiat"] } as EcranCorps;
    expect(contenuEcran(preuve, null, {}, [], "Blog · cas réel")).toMatchObject({ etiquette: "Blog · cas réel" });
    const avecMot = planDesFins({ reseaux: ["facebook"], offre: "integration", nature: "automatisation", mot: "BLOG", avecMot: true, motSur: ["facebook"], table: TABLE_FINS_DIAGNOSTIC }).fins[0];
    const appel = avecMot.ecrans.find((e) => e.type === "appel-mot")!;
    expect(contenuEcran(appel, avecMot, {}, [], "Blog · cas réel")).toMatchObject({ type: "appel-mot", etiquette: "Blog · cas réel" });
  });
});
