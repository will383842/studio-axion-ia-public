/**
 * LOT K — brique « effet réaliste par IA » (PURE) : demande, bon endroit, consigne vidéo anglaise, fabrication avec le
 * double Higgsfield (aucun appel réel), contrôle du retour, enchaînements (vitre brisée, repli 3D), devis et carte.
 */
import { describe, expect, it } from "vitest";
import type { MotMonteur } from "@/briques/monteur/ancrage";
import { estimerOption, phraseCarte, optionsPayantesDemandees } from "@/briques/options-payantes";
import { creerHiggsfieldSimule } from "@/fournisseurs/higgsfield/simulation";
import {
  choisirBonEndroit,
  consigneVideo,
  controlerRetourEffet,
  creditsEffet,
  decouperEffet,
  estDemandeEffetRealiste,
  fabriquerEffetRealiste,
  lireDemandeEffet,
  modeleEffet,
  momentDeLEffet,
  momentImpose,
  phrasesDe,
  planAvecEffets,
  plansLargesPendant,
  REGLES_PRESERVATION,
  segmentsGardes,
  selonEffetsRealistes,
  type DependancesEffet,
  type EffetRealistePrepare,
} from ".";

/** Transcription : 4 phrases, une coupe (mots 12-14 retirés), « téléphone » dit dans la 3e phrase. */
function transcription(): MotMonteur[] {
  const phrases = [
    "Bonjour, voici trois erreurs à éviter absolument.", // accroche (clé)
    "La première, c'est de tout faire seul sans méthode.",
    "Euh pardon",
    "Regardez mon téléphone, tout passe par lui aujourd'hui pour vos clients.",
    "Abonnez-vous pour la suite, le lien est dessous.", // conclusion (clé)
  ];
  const mots: MotMonteur[] = [];
  let t = 0.5;
  let monte = 0.5;
  let index = 0;
  phrases.forEach((p, k) => {
    const coupe = k === 2;
    for (const mot of p.split(" ")) {
      mots.push({ index: index++, mot, debutPriseSec: +t.toFixed(3), finPriseSec: +(t + 0.32).toFixed(3), monteeSec: coupe ? null : +monte.toFixed(3) });
      t += 0.4;
      if (!coupe) monte += 0.4;
    }
    t += 0.5; // pause entre phrases
    if (!coupe) monte += 0.5;
  });
  return mots;
}

const EFFET: EffetRealistePrepare = {
  id: "pas-effet-1",
  consigne: "mets un téléphone dans ma main et jette-le sur l'écran",
  description: "Un téléphone apparaît dans votre main, puis vous le jetez vers l'écran (la vitre se brise à l'impact).",
  consigneVideo: `A smartphone appears in the open hand. ${REGLES_PRESERVATION}`,
  ancre: "bon-endroit",
  debutMot: 20,
  debutPriseSec: 12,
  finPriseSec: 17,
  debutSec: 10.2,
  finSec: 15.2,
  dureeSec: 5,
  modele: "flux_3_video_edit",
  objet: "telephone",
  finitSurEcran: true,
  impactSec: 14.7,
  phrase: "Regardez mon téléphone",
  raisonMoment: "Vous parlez de l'objet à ce moment",
};

function deps(o: Partial<DependancesEffet> = {}, h = creerHiggsfieldSimule()): DependancesEffet & { appels: string[] } {
  const appels: string[] = [];
  return {
    appels,
    higgsfield: h,
    extrairePassage: async () => (appels.push("extraire"), new Uint8Array([1, 2])),
    deposerPassage: async (_p, _o, r) => (appels.push(`deposer:${r.conversion.filtreVideo.split(",")[0]}:${r.fonduSec}:${r.accorderCouleurs}`), "r2/effet.mp4"),
    mesurer: async () => (appels.push("mesurer"), { ecartBoucheMs: 20, ressemblanceVisage: 0.96, visageTrouvePct: 100, ecartRaccordAvant: 2, ecartRaccordApres: 3 }),
    attendre: async () => {},
    ...o,
  };
}

describe("lot K · la demande de Will", () => {
  it.each([
    ["Mets un téléphone dans ma main et jette-le sur l'écran", true],
    ["Rajoute au bon endroit un téléphone dans ma main et jette-le sur l'écran", true],
    ["Fais apparaître le logo Axion dans ma main, en réaliste", true],
    ["Une tasse de café sur le bureau, en réaliste", true],
    ["Pose une tasse de café sur le bureau", true],
    ["Mets un téléphone en 3D dans ma main", false],
    ["Fais apparaître un logo 3D dans ma main quand je dis « voilà »", false],
    ["Fais l'effet de la main en ultra réaliste", false],
    ["Pas d'effet réaliste avec le téléphone", false],
    ["Zoome quand je dis « gratuit »", false],
  ])("« %s » → %s", (message, attendu) => {
    expect(estDemandeEffetRealiste(message)).toBe(attendu);
  });

  it("l'option payante est repérée par la brique J ; « ultra réaliste » reste l'option I2", () => {
    expect(optionsPayantesDemandees("mets un téléphone dans ma main et jette-le sur l'écran")).toEqual(["effet-realiste-ia"]);
    expect(optionsPayantesDemandees("fais l'effet de la main en ultra réaliste")).toEqual(["effets-main-ultra"]);
    expect(optionsPayantesDemandees("Mets un téléphone en 3D dans ma main")).toEqual([]);
  });

  it("lit l'objet, la main, le lancer vers l'écran, le bruitage et la durée", () => {
    expect(lireDemandeEffet("Mets un téléphone dans ma main et jette-le sur l'écran pendant 6 secondes")).toMatchObject({ objet: "telephone", dansLaMain: true, finitSurEcran: true, dureeSec: 6, sonSuggere: "verre" });
    expect(lireDemandeEffet("Une tasse de café sur le bureau, en réaliste")).toMatchObject({ objet: "tasse", dansLeDecor: true, finitSurEcran: false });
  });
});

describe("lot K · le bon endroit", () => {
  const mots = transcription();

  it("morceaux sans coupe et phrases clés (accroche, conclusion, chiffres)", () => {
    expect(segmentsGardes(mots)).toHaveLength(2);
    const p = phrasesDe(mots);
    expect(p[0].cle).toBe(true);
    expect(p[p.length - 1].cle).toBe(true);
    expect(p.filter((x) => x.cle)).toHaveLength(2);
  });

  it("choisit le moment où Will parle de l'objet, au début de sa phrase, hors des phrases clés et sans coupe", () => {
    const m = choisirBonEndroit(mots, { dureeSec: 5, objet: "telephone" })!;
    const telephone = mots.find((x) => x.mot === "téléphone,")!;
    expect(m.debutPriseSec).toBeLessThanOrEqual(telephone.debutPriseSec);
    expect(m.finPriseSec).toBeGreaterThan(telephone.debutPriseSec);
    // Raccourci pour finir avant la conclusion (phrase clé), 3 s au moins.
    expect(m.dureeSec).toBeGreaterThanOrEqual(3);
    expect(m.dureeSec).toBeLessThanOrEqual(5);
    expect(m.raison).toMatch(/vous parlez de l'objet/i);
    // Jamais à cheval sur la coupe (mots retirés) ni dans la conclusion.
    const coupe = mots.filter((x) => x.monteeSec === null);
    expect(coupe.some((x) => x.debutPriseSec >= m.debutPriseSec && x.debutPriseSec < m.finPriseSec)).toBe(false);
    const conclusion = mots.find((x) => x.mot === "Abonnez-vous")!;
    expect(m.finPriseSec).toBeLessThanOrEqual(conclusion.debutPriseSec + 0.05);
    expect(m.phrase).toMatch(/téléphone/);
  });

  it("plan trop serré pour voir la main : un autre moment est préféré", () => {
    const telephone = mots.find((x) => x.mot === "téléphone,")!;
    const serre = (s: number) => (Math.abs(s - telephone.debutPriseSec) < 4 ? 0 : 1);
    const m = choisirBonEndroit(mots, { dureeSec: 4, objet: "telephone", largeurPlan: serre })!;
    expect(Math.abs(m.debutPriseSec - telephone.debutPriseSec)).toBeGreaterThan(2);
  });

  it("un moment occupé par un autre effet fort est écarté", () => {
    const libre = choisirBonEndroit(mots, { dureeSec: 5, objet: "telephone" })!;
    const m = choisirBonEndroit(mots, { dureeSec: 5, objet: "telephone", occupes: [{ debutSec: libre.debutSec - 1, finSec: libre.finSec + 1 }] })!;
    expect(m.finSec <= libre.debutSec - 1 + 1e-6 || m.debutSec >= libre.finSec + 1 - 1e-6).toBe(true);
  });

  it("le choix de Claude est gardé s'il respecte les règles, sinon remplacé (et signalé)", () => {
    const telephone = mots.find((x) => x.mot === "téléphone,")!;
    const regardez = mots.find((x) => x.mot === "Regardez")!;
    const garde = momentDeLEffet(mots, { dureeSec: 5, objet: "telephone", ancre: "bon-endroit", motClaude: regardez.index, raisonClaude: "Vous montrez votre téléphone" })!;
    expect(garde.debutMot).toBe(regardez.index);
    expect(garde.raison).toBe("Vous montrez votre téléphone");
    expect(garde.ajuste).toBe(false);
    // Claude propose l'accroche (phrase clé) : refusé, le code choisit.
    const refuse = momentDeLEffet(mots, { dureeSec: 5, objet: "telephone", ancre: "bon-endroit", motClaude: 2, raisonClaude: "Début" })!;
    expect(refuse.ajuste).toBe(true);
    expect(refuse.debutPriseSec).toBeGreaterThan(mots[8].debutPriseSec);
    expect(telephone).toBeTruthy();
  });

  it("« plutôt à 0:12 » : l'instant de Will est respecté (recalé dans son morceau)", () => {
    const m = momentImpose(mots, { instantSec: 12 }, { dureeSec: 5, objet: "telephone" })!;
    // Recalé pour garder ses 5 s dans le morceau sans coupe (la fin de la vidéo est proche).
    expect(Math.abs(m.debutSec - 12)).toBeLessThan(1.5);
    expect(m.dureeSec).toBe(5);
    expect(m.raison).toMatch(/0:12/);
  });

  it("vidéo trop courte (moins de 3 s sans coupe) : aucun moment", () => {
    expect(choisirBonEndroit(mots.slice(0, 3), { dureeSec: 5, objet: "telephone" })).toBeNull();
  });
});

describe("lot K · consigne vers Higgsfield (anglais)", () => {
  it("garde le visage, les lèvres, la voix et le décor ; décrit l'action physique et l'impact", () => {
    const demande = lireDemandeEffet("Mets un téléphone dans ma main et jette-le sur l'écran");
    const c = consigneVideo({ demande, avecReference: false });
    expect(c).toMatch(/smartphone/);
    expect(c).toMatch(/palm facing up/);
    expect(c).toMatch(/throws it straight toward the camera/);
    expect(c).toMatch(/hits the camera lens/);
    expect(c).toContain(REGLES_PRESERVATION);
    expect(c).toMatch(/lip movements/);
  });

  it("la consigne de Claude est reprise, les règles toujours ajoutées ; une consigne en français est écartée", () => {
    const demande = lireDemandeEffet("logo Axion dans ma main, en réaliste");
    const claude = "The orange Axion logo from the reference image materializes in the person's open palm with a soft glow.";
    expect(consigneVideo({ claude, demande, avecReference: true })).toBe(`${claude} ${REGLES_PRESERVATION}`);
    const fr = consigneVideo({ claude: "Le logo apparaît dans la main avec une lueur douce et dorée", demande, avecReference: true });
    expect(fr).toMatch(/reference image/);
  });

  it("modèle : Kling Omni Edit avec image de référence, FLUX 3 Video Edit sans ; découpe ≤ 15 s", () => {
    expect(modeleEffet(true)).toBe("kling_video_edit");
    expect(modeleEffet(false)).toBe("flux_3_video_edit");
    expect(decouperEffet(0, 8, "kling_video_edit")).toHaveLength(1);
    expect(decouperEffet(0, 20, "flux_3_video_edit")).toHaveLength(2);
    expect(creditsEffet({ debutPriseSec: 0, finPriseSec: 5, modele: "kling_video_edit" })).toBe(10);
  });
});

describe("lot K · devis et carte (brique J)", () => {
  it("« Effet réaliste par IA — option payante, environ X € pris sur vos crédits Higgsfield. »", () => {
    const c = { videoId: "v", versionId: "ver", dureeSec: 5, passagesSec: [5], modele: "kling_video_edit" as const };
    expect(estimerOption("effet-realiste-ia", c)).toBe(50); // 10 crédits × 5 c
    expect(estimerOption("effet-realiste-ia", { ...c, dureeSec: 8, passagesSec: [8] }, { prixCreditHiggsfieldCentimes: 12, tauxUsdEur: 0.92 })).toBe(192);
    expect(phraseCarte({ montantCentimes: 192, outil: "higgsfield", optionId: "effet-realiste-ia" })).toBe("Effet réaliste par IA — option payante, environ 2 € pris sur vos crédits Higgsfield.");
    // Les autres options gardent la phrase du lot J.
    expect(phraseCarte({ montantCentimes: 600, outil: "higgsfield", optionId: "decor-ia" })).toBe("Option payante — environ 6 € pris sur vos crédits Higgsfield.");
  });
});

describe("lot K · fabrication (double Higgsfield, aucun appel réel)", () => {
  it("succès : extraction, envoi FLUX, retour à 25 i/s, couleurs accordées, fondu, contrôle ; dépense comptée", async () => {
    const h = creerHiggsfieldSimule();
    const d = deps({}, h);
    const r = await fabriquerEffetRealiste(EFFET, d);
    expect(r.resultat.statut).toBe("reussi");
    expect(h.lancements).toHaveLength(1);
    expect(h.lancements[0]).toMatchObject({ modele: "flux_3_video_edit", dureeSec: 5 });
    expect(h.lancements[0].consigne).toContain(REGLES_PRESERVATION);
    expect(h.lancements[0].imageReferenceMediaId).toBeUndefined();
    expect(d.appels).toEqual(["extraire", "deposer:fps=25:0.2:true", "mesurer"]);
    if (r.resultat.statut === "reussi") expect(r.resultat.morceau).toMatchObject({ source: "effet", debutSec: 12, finSec: 17, fichierCle: "r2/effet.mp4", fonduSec: 0.2 });
    expect(r.lignes[0]).toMatchObject({ etape: "Effet réaliste par IA", fournisseur: "simulation", quantite: 5 });
  });

  it("Kling Omni Edit avec l'image de référence (logo Axion, objet de Mes images)", async () => {
    const h = creerHiggsfieldSimule();
    const r = await fabriquerEffetRealiste({ ...EFFET, modele: "kling_video_edit", imageReferenceCle: "mes-images/logo.png" }, deps({ imageReference: async () => ({ nom: "logo.png", type: "image/png", octets: new Uint8Array([9]) }) }, h));
    expect(r.resultat.statut).toBe("reussi");
    expect(h.lancements[0]).toMatchObject({ modele: "kling_video_edit", imageReferenceMediaId: "sim-media-1" });
  });

  it("Kling sans image lisible : FLUX (moins cher que le devis, jamais de dépassement)", async () => {
    const h = creerHiggsfieldSimule();
    await fabriquerEffetRealiste({ ...EFFET, modele: "kling_video_edit" }, deps({ imageReference: async () => null }, h));
    expect(h.lancements[0].modele).toBe("flux_3_video_edit");
  });

  it("refus du modèle → « Effet non réussi — Réessayer », aucun nouvel essai automatique", async () => {
    const h = creerHiggsfieldSimule({ lancementsEnEchec: [0], echec: "refus" });
    const r = await fabriquerEffetRealiste(EFFET, deps({}, h));
    expect(r.resultat).toMatchObject({ statut: "rate", raison: "refus", message: "Effet non réussi — Réessayer" });
    expect(h.lancements).toHaveLength(1);
  });

  it("lèvres décalées, visage absent, durée ou raccord de couleur : refusé", async () => {
    const lev = await fabriquerEffetRealiste(EFFET, deps({ mesurer: async () => ({ ecartBoucheMs: 160, ressemblanceVisage: 0.96, visageTrouvePct: 100 }) }));
    expect(lev.resultat).toMatchObject({ statut: "rate", raison: "levres" });
    const vis = await fabriquerEffetRealiste(EFFET, deps({ mesurer: async () => ({ ecartBoucheMs: 10, ressemblanceVisage: 0.96, visageTrouvePct: 40 }) }));
    expect(vis.resultat).toMatchObject({ statut: "rate", raison: "visage" });
    const dur = await fabriquerEffetRealiste(EFFET, deps({}, creerHiggsfieldSimule({ decalageDureeSec: 0.6 })));
    expect(dur.resultat).toMatchObject({ statut: "rate", raison: "duree" });
    expect(controlerRetourEffet({ dureeSourceSec: 5, dureeSortieSec: 5, mesures: { ecartBoucheMs: 0, ressemblanceVisage: 0.99, visageTrouvePct: 100, ecartRaccordApres: 11 } })).toEqual({ ok: false, raison: "raccord" });
  });

  it("demande invalide (durée hors 3-8 s, consigne vide) : rien n'est envoyé", async () => {
    const h = creerHiggsfieldSimule();
    const r = await fabriquerEffetRealiste({ ...EFFET, finPriseSec: 25 }, deps({}, h));
    expect(r.resultat).toMatchObject({ statut: "non-lance", raison: "duree" });
    const v = await fabriquerEffetRealiste({ ...EFFET, consigneVideo: " " }, deps({}, h));
    expect(v.resultat).toMatchObject({ statut: "non-lance", raison: "consigne-vide" });
    expect(h.medias).toHaveLength(0);
    expect(h.lancements).toHaveLength(0);
  });

  it("une panne d'une dépendance ne lève jamais (repli)", async () => {
    const r = await fabriquerEffetRealiste(EFFET, deps({ extrairePassage: async () => Promise.reject(new Error("panne")) }));
    expect(r.resultat).toMatchObject({ statut: "non-lance", raison: "panne" });
  });
});

describe("lot K · enchaînements et place dans la piste", () => {
  const vitre = { id: "vitre", conditionEffetRealiste: { effetId: "e1", si: "reussi" } };
  const objet3D = { id: "objet", conditionEffetRealiste: { effetId: "e1", si: "rate" } };
  const libre = { id: "zoom" };

  it("vitre brisée seulement si l'effet a réussi ; objet 3D (repli gratuit) seulement s'il a raté", () => {
    expect(selonEffetsRealistes([vitre, objet3D, libre], [{ id: "e1", statut: "reussi" }]).map((p) => p.id)).toEqual(["vitre", "zoom"]);
    expect(selonEffetsRealistes([vitre, objet3D, libre], [{ id: "e1", statut: "rate" }]).map((p) => p.id)).toEqual(["objet", "zoom"]);
    // Sans résultat (pas d'étape, pas d'accord) : prudence, le repli.
    expect(selonEffetsRealistes([vitre, objet3D, libre], undefined).map((p) => p.id)).toEqual(["objet", "zoom"]);
  });

  it("le morceau entre dans le plan du cadrage, avec ou sans décor ; la fenêtre d'extraction prime", () => {
    const fenetre = { x: 1312, y: 0, largeur: 1214, hauteur: 2160 };
    const morceau = { id: "e1", debutSec: 12, finSec: 17, fichierCle: "r2/effet.mp4", fonduSec: 0.2, fenetre };
    const seul = planAvecEffets(undefined, [morceau], { ...fenetre, x: 1300 })!;
    expect(seul).toMatchObject({ effets: true, decorApplique: false, fenetre, morceaux: [{ source: "effet", debutSec: 12, finSec: 17 }] });
    const decor = { decorApplique: true, fenetre, morceaux: [{ index: 0, debutSec: 0, finSec: 14, source: "decor", fichierCle: "d0" }, { index: 1, debutSec: 14, finSec: 30, source: "decor", fichierCle: "d1" }] };
    expect((planAvecEffets(decor, [morceau], fenetre)!.morceaux as { source: string }[]).map((m) => m.source)).toEqual(["effet"]);
    expect(planAvecEffets(decor, [], fenetre)).toBe(decor);
  });

  it("pendant l'effet, le plan montre toute la fenêtre (la main et l'objet se voient)", () => {
    const fenetre = { x: 1312, y: 0, largeur: 1214, hauteur: 2160 };
    const plans = [
      { priseDebutSec: 0, priseFinSec: 10, cadre: { x: 1500, y: 300, largeur: 800, hauteur: 1422 } },
      { priseDebutSec: 10, priseFinSec: 20, cadre: { x: 1500, y: 300, largeur: 800, hauteur: 1422 } },
    ];
    const r = plansLargesPendant(plans, [{ debutSec: 12, finSec: 17 }], fenetre);
    expect(r[0].cadre.largeur).toBe(800);
    expect(r[1].cadre).toEqual(fenetre);
  });
});
