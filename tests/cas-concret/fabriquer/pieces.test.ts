/**
 * M8 : pièces pures de la chaîne (graphe, entrées, fins regroupées, texte reformulé, rang des mots, écrans de la brique,
 * bruitages) et le chemin de la reformulation de bout en bout.
 */
import { describe, expect, it } from "vitest";
import { controlerProprietes, proprietesEcrans } from "@/briques/ecrans-motion";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { poserBruitages } from "@/moteurs/montage-cas-concret/bruitages";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { contenuEcran, ecransCales, etapesCasConcret, lireEntreesCasConcret, regrouperFins, reporterTexteDit } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { motsLus, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { doubles, SONS_VALIDES } from "./doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const fiche = (): FicheEcrans => ficheParGabarit(trouverCas("recrutement-apporteurs")!, FIXE);
const ZONE = { haut: 14, droite: 18, bas: 30, gauche: 6 };

describe("M8 · graphe et entrées", () => {
  it("huit étapes avec les libellés du plan ; l'écriture sautée quand une fiche est fournie", () => {
    const tout = etapesCasConcret({ entrees: { casConcret: { reseaux: ["facebook"] } } });
    expect(tout.map((e) => e.nom)).toEqual(["L'écriture", "La relecture", "Les vrais écrans", "La voix", "Le calage", "Les écrans", "Les finitions", "La vérification"]);
    expect(tout[1].dependDe).toEqual(["ecriture"]);
    const sans = etapesCasConcret({ entrees: { casConcret: { ficheCle: "studio/dev/fiche.json" } } });
    expect(sans.map((e) => e.cle)).toEqual(["fiche", "captures", "voix", "calage", "ecrans", "montage", "controle"]);
    expect(sans[0].dependDe).toEqual([]);
  });

  it("lecture tolérante de `entrees.casConcret`", () => {
    // X4 : sans action de Will, la suite « sans le mot ».
    expect(lireEntreesCasConcret(undefined)).toEqual({ porte: "porte-a", avecMot: false, motSur: [], reseaux: [], essai: false });
    const e = lireEntreesCasConcret({ casConcret: { casId: " recrutement-apporteurs ", mot: "IA", avecMot: false, reseaux: ["tiktok", "myspace", "tiktok"], essai: true, codeSuivi: "cc-x-123456", porte: "b" } });
    expect(e).toMatchObject({ casId: "recrutement-apporteurs", mot: "IA", avecMot: false, reseaux: ["tiktok"], essai: true, codeSuivi: "cc-x-123456", porte: "porte-b" });
    // X6 : les comptes où le mot est branché, gardés seulement parmi les réseaux de la vidéo.
    expect(lireEntreesCasConcret({ casConcret: { reseaux: ["facebook", "tiktok"], motSur: ["facebook", "instagram", "x"] } }).motSur).toEqual(["facebook"]);
  });
});

describe("M8 · fins regroupées", () => {
  const demande = { reseaux: ["facebook", "instagram", "tiktok", "linkedin"] as const, mot: "IA", motDit: "I.A.", avecMot: false, table: TABLE_FINS_DIAGNOSTIC };

  it("aujourd'hui : trois fichiers au plus — Instagram et TikTok partagent leur fin, Facebook et LinkedIn ont chacun la leur", () => {
    const brut = planDesFins({ ...demande, reseaux: [...demande.reseaux], offre: "integration", nature: "automatisation" });
    expect(brut.fins).toHaveLength(4);
    const plan = regrouperFins(brut);
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["instagram", "tiktok"], ["linkedin"]]);
    expect(plan.fins.map((f) => f.id)).toEqual(["fin-facebook", "fin-instagram-tiktok", "fin-linkedin"]);
    expect(plan.reduites).toEqual(brut.reduites);
  });

  it("mot branché sur les deux comptes : Facebook et Instagram ont chacun leur fin au mot (X7 : l'abonnement sur Instagram), TikTok et LinkedIn la leur", () => {
    const plan = regrouperFins(planDesFins({ ...demande, avecMot: true, motSur: ["facebook", "instagram"], reseaux: [...demande.reseaux], offre: "formation" }));
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["instagram"], ["tiktok"], ["linkedin"]]);
  });
});

describe("M8 · texte dit après reformulation", () => {
  it("une phrase reformulée sur deux écrans : chaque écran garde ses mots hors du milieu, les autres sont inchangés", () => {
    const f = fiche();
    const t = f.ecrans.map((e) => e.texteDit).join(" ");
    const avant = "envoyer le contrat, courir après la signature.";
    const apres = "envoyer le contrat, relancer la signature.";
    const r = reporterTexteDit(f, t.replace(avant, apres))!;
    expect(r).not.toBeNull();
    expect(r.ecrans.map((e) => e.texteDit).join(" ")).toBe(t.replace(avant, apres));
    const i = f.ecrans.findIndex((e) => e.texteDit === avant);
    expect(r.ecrans[i].texteDit).toBe(apres);
    r.ecrans.forEach((e, k) => {
      if (k !== i) expect(e.texteDit).toBe(f.ecrans[k].texteDit);
      for (const ev of e.evenements) expect(ev.surMot).toBeLessThan(e.texteDit.split(/\s+/).length);
    });
  });

  it("même texte : la fiche est rendue telle quelle ; un écran vidé : refus", () => {
    const f = fiche();
    const t = f.ecrans.map((e) => e.texteDit).join(" ");
    expect(reporterTexteDit(f, t)).toBe(f);
    expect(reporterTexteDit(f, t.replace(f.ecrans[1].texteDit, ""))).toBeNull();
  });

  it("le rang d'un événement compté sans les morceaux sans lettre (« : »), comme le calage", () => {
    const e = fiche().ecrans.find((x) => x.texteDit.includes(" : ") && x.evenements.length)!;
    const lus = e.texteDit.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
    expect(motsLus(e.texteDit)).toEqual(lus);
    for (const ev of e.evenements) expect(ev.surMot).toBeLessThan(lus.length);
  });
});

describe("M8 · écrans de la brique", () => {
  it("les écrans du corps simulé passent les contrôles de la brique", () => {
    const f = fiche();
    let debut = 0;
    const corrige = f.ecrans.map((e) => ({ ...e, debutMs: debut, finMs: (debut += 2000) })) as EcranCorps[];
    const captures = Object.fromEntries(corrige.filter((e) => e.type === "etape" && e.visuel.sorte === "ecran").map((e) => [e.id, { cle: `cap-${e.id}.jpg` }]));
    const ecrans = ecransCales(corrige, [], null, captures);
    const caps = Object.fromEntries(Object.values(captures).map((c) => [c.cle, { src: "https://x/y", cle: c.cle, sorte: "image" as const, largeur: 1080, hauteur: 1920 }]));
    const props = proprietesEcrans({ ecrans, captures: caps, zoneProtegee: ZONE });
    expect(props.flatMap((p) => controlerProprietes(p))).toEqual([]);
    expect((ecrans[0] as { lignes: string[] }).lignes.join(" ")).toMatch(/\*[^*]+\*/);
  });

  it("fin « diagnostic » : « Faites votre *diagnostic gratuit* », « en quelques minutes », puis la bulle du lien et la signature", () => {
    const plan = planDesFins({ reseaux: ["facebook"], offre: "integration", nature: "automatisation", mot: "IA", motDit: "I.A.", avecMot: false, table: TABLE_FINS_DIAGNOSTIC });
    const fin = plan.fins[0];
    const [diagnostic, lien] = fin.ecrans.map((e) => contenuEcran(e, fin, {}));
    expect(diagnostic).toEqual({ type: "promesse", invite: "Faites votre", cadeau: "*diagnostic gratuit*", ligne: "en quelques minutes" });
    expect(lien).toEqual({ type: "lien", titre: "Le lien est en commentaire", lien: "Diagnostic gratuit · lien en commentaire", signature: "Axion-*IA*" });
  });

  it("fin au mot : l'appel au mot, puis « Je vous envoie » et « *la structure* complète »", () => {
    const plan = planDesFins({ reseaux: ["facebook"], offre: "integration", nature: "automatisation", mot: "IA", motDit: "I.A.", avecMot: true, motSur: ["facebook"], table: TABLE_FINS_DIAGNOSTIC });
    const fin = plan.fins[0];
    const [mot, promesse] = fin.ecrans.map((e) => contenuEcran(e, fin, {}));
    expect(mot).toEqual({ type: "appel-mot", invite: "Écrivez", mot: "IA", suite: "en *commentaire*" });
    expect(promesse).toEqual({ type: "promesse", invite: "Je vous envoie", cadeau: "*la structure*", ligne: "complète" });
  });
});

describe("M8 · bruitages", () => {
  const f = fiche();
  let debut = 0;
  const corps = f.ecrans.map((e) => ({ ...e, debutMs: debut, finMs: (debut += 2000) })) as EcranCorps[];
  const captures = Object.fromEntries(corps.filter((e) => e.type === "etape" && e.visuel.sorte === "ecran").map((e) => [e.id, { cle: `cap-${e.id}.jpg` }]));
  const cales = ecransCales(corps, [], null, captures);
  const dureeSec = debut / 1000 + 2.1;

  it("aucun son validé : rien n'est posé", () => {
    expect(poserBruitages({ ecrans: corps, cales, mots: [], dureeSec, valides: [] })).toEqual([]);
  });

  it("un souffle avant chaque changement d'écran, un papier par tâche, un tic par chiffre, la clôture 1,5 s avant la fin", () => {
    const b = poserBruitages({ ecrans: corps, cales, mots: [], dureeSec, valides: SONS_VALIDES });
    const de = (d: string) => b.filter((x) => x.declencheur === d);
    expect(de("illustration-forte").length).toBeGreaterThanOrEqual(corps.length - 1 - de("chiffre").length - de("impact").length);
    const taches = corps.filter((e) => e.type === "liste-avant").reduce((n, e) => n + (e.type === "liste-avant" ? e.taches.length : 0), 0);
    expect(de("document").length).toBeGreaterThan(0);
    expect(de("document").length).toBeLessThanOrEqual(taches);
    expect(b.filter((x) => x.debutSec > dureeSec - 1)).toEqual([]);
    expect(b.at(-1)).toMatchObject({ declencheur: "impact", debutSec: +(dureeSec - 1.5).toFixed(3) });
    expect(new Set(b.map((x) => x.gainDb)).size).toBe(1);
    for (let i = 1; i < b.length; i++) expect(b[i].debutSec - b[i - 1].debutSec).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });

  it("un seul son validé : seulement lui", () => {
    const b = poserBruitages({ ecrans: corps, cales, mots: [], dureeSec, valides: SONS_VALIDES.filter((s) => s.declencheur === "illustration-forte") });
    expect(b.length).toBe(corps.length - 1);
    expect(b.every((x) => x.elementId === "son-illustration-forte")).toBe(true);
  });
});

describe("M8 · reformulation", () => {
  it("corps rejeté : reformulation par le rôle borné, relecture, texte reporté, vidéo faite", async () => {
    const d = doubles({ lecturesFautives: [1] });
    const cr = await fabriquerCasConcret(d.options);
    expect(d.roles).toContain("reformulation-cas-concret");
    expect(cr.voix.lecturesCorps).toBe(2);
    expect(cr.voix.reformulations).toHaveLength(1);
    // Deux lectures du corps, puis une par fin : Facebook et Instagram (au mot) partagent la leur, TikTok, LinkedIn.
    expect(d.lus).toHaveLength(5);
    expect(cr.prises.filter((p) => p.prise === "corps")).toHaveLength(2);
    expect(cr.fins).toHaveLength(3);
  });
});
