/**
 * M2 · Plan des fins, liens suivis, textes de publication du cas concret. X6 : une seule demande par fin, le mot là où il
 * est branché (`motSur`), jamais « Réservez » ni « rendez-vous ».
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { OFFRES, schemaCas } from "@/formats/cas-concret/cas";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { schemaEcranFin, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { codeVersionCasConcret, liensSuivis, motValide, planDesFins, RAISON_MOT_NON_BRANCHE, RAISON_SUITE_REDUITE } from "@/moteurs/montage-cas-concret/fins";
import { INDICATION_FACEBOOK, textesDePublication } from "@/moteurs/montage-cas-concret/publication";
import type { ReseauCas } from "@/formats/cas-concret";

const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const INTERDITS = ["machine", "machines", "Villeexemple", "aucun gain garanti"];
/** Le mot coché et branché sur Facebook et Instagram. */
const base = { mot: recrutementApporteurs.mot, motDit: recrutementApporteurs.motDit, avecMot: true, motSur: ["facebook", "instagram"] as ReseauCas[], table: TABLE_FINS_DIAGNOSTIC };
/** Aujourd'hui : rien n'est branché. */
const aujourdhui = { ...base, avecMot: false, motSur: [] as ReseauCas[] };
const DIAGNOSTIC = "Faites votre diagnostic gratuit en quelques minutes.";

const commun = { fond: "sombre" as const, marque: "axion-ia.com", avanceMs: 0, evenements: [] };
const fiche: Pick<FicheEcrans, "ecrans"> = {
  ecrans: [
    { ...commun, id: "e01", type: "accroche", texteDit: "On recrute en quinze minutes.", etiquette: "Cas concret", lignes: ["On recrute", "en 15 minutes"], motOrange: "15" },
    { ...commun, id: "e02", type: "liste-avant", texteDit: "Avant, c'était ça.", taches: ["Trier les candidatures", "Relancer"], total: "Plus d'une heure" },
    { ...commun, id: "e03", type: "resultat", texteDit: "Des heures gagnées.", titre: "Résultat", avant: { libelle: "Avant", valeur: 60 }, maintenant: { libelle: "Maintenant", valeur: 15 }, ligne: "Des heures gagnées, à chaque recrutement" },
    { ...commun, id: "e04", type: "question", texteDit: "Quelle tâche pourrait tourner toute seule ?", lignes: ["Et dans votre", "entreprise ?"], question: "Quelle tâche pourrait tourner toute seule dans votre entreprise ?" },
  ],
};

describe("M2 · plan des fins", () => {
  it("aujourd'hui, 4 réseaux : exactement les phrases du tableau de l'Usine, dites et écrites", () => {
    for (const plan of [planDesFins({ ...aujourdhui, reseaux: TOUS, offre: "integration", nature: "automatisation" }), planDesFins({ ...base, motSur: [], reseaux: TOUS, offre: "integration", nature: "automatisation" })]) {
      const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;
      expect(de("instagram").appels.map((a) => a.dit)).toEqual([DIAGNOSTIC, "Le lien est dans mon profil."]);
      expect(de("facebook").appels.map((a) => a.dit)).toEqual([DIAGNOSTIC, "Le lien est en commentaire."]);
      expect(de("tiktok").appels.map((a) => a.dit)).toEqual([DIAGNOSTIC, "Le lien est dans mon profil."]);
      expect(de("linkedin").appels.map((a) => a.dit)).toEqual([DIAGNOSTIC, "Le lien est en premier commentaire."]);
      expect(TOUS.map((r) => de(r).appels[1].ecran)).toEqual(["Diagnostic gratuit · lien en commentaire", "Diagnostic gratuit · lien dans le profil", "Diagnostic gratuit · lien dans le profil", "Diagnostic gratuit · lien en commentaire"]);
      expect(plan.fins.flatMap((f) => f.appels.map((a) => a.type))).not.toContain("commentaire");
    }
  });

  it("deux écrans : « diagnostic » (titre, « en quelques minutes ») puis « lien » (bulle) ; aucun appel au mot ni promesse", () => {
    const [fin] = planDesFins({ ...aujourdhui, reseaux: ["facebook"], offre: "integration", nature: "automatisation" }).fins;
    expect(fin.ecrans.map((e) => [e.id, e.type])).toEqual([["f01", "diagnostic"], ["f02", "lien"]]);
    expect(fin.ecrans[0]).toMatchObject({ titre: "Faites votre diagnostic gratuit", ligne: "en quelques minutes", texteDit: DIAGNOSTIC });
    expect(fin.ecrans[1]).toMatchObject({ bulle: "Diagnostic gratuit · lien en commentaire", texteDit: "Le lien est en commentaire." });
    for (const e of fin.ecrans) expect(schemaEcranFin.safeParse(e).success, e.id).toBe(true);
  });

  it("mot branché sur Facebook et Instagram : la fin au mot, sans lien ; TikTok et LinkedIn gardent le diagnostic", () => {
    const plan = planDesFins({ ...base, reseaux: TOUS, offre: "integration", nature: "automatisation" });
    const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;
    // X7 : Instagram a sa propre fin au mot (l'abonnement est obligatoire), en une phrase et un écran.
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["instagram"], ["tiktok"], ["linkedin"]]);
    expect(de("facebook").appels.map((a) => a.dit)).toEqual(["Écrivez I.A. en commentaire.", "Je vous envoie la structure complète."]);
    expect(de("facebook").ecrans.map((e) => e.type)).toEqual(["appel-mot", "promesse"]);
    expect(de("instagram").appels.map((a) => a.dit)).toEqual(["Abonnez-vous et écrivez I.A. en commentaire : je vous l'envoie."]);
    expect(de("instagram").ecrans.map((e) => e.type)).toEqual(["appel-mot"]);
    for (const r of ["facebook", "instagram"] as const) expect(de(r).appels.map((a) => a.type)).not.toContain("lien");
    expect(de("tiktok").appels[0].dit).toBe(DIAGNOSTIC);
    expect(de("linkedin").appels[0].dit).toBe(DIAGNOSTIC);
    expect(plan.reduites).toEqual([]);
  });

  it("mot branché sur Instagram seulement : Instagram au mot, Facebook le diagnostic avec sa raison", () => {
    const plan = planDesFins({ ...base, motSur: ["instagram"], reseaux: TOUS, offre: "integration", nature: "automatisation" });
    const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;
    expect(de("instagram").appels.map((a) => a.id)).toEqual(["fin-ig-mot-abonnement"]);
    expect(de("facebook").appels.map((a) => a.id)).toEqual(["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
    expect(plan.reduites).toEqual([{ reseaux: ["facebook"], raison: RAISON_MOT_NON_BRANCHE }]);
  });

  it("mot branché mais « Avec le mot » décoché : le diagnostic partout", () => {
    const plan = planDesFins({ ...base, avecMot: false, reseaux: TOUS, offre: "integration", nature: "automatisation" });
    expect(plan.fins.flatMap((f) => f.appels.map((a) => a.type))).not.toContain("commentaire");
  });

  it("deux réseaux à la même suite partagent une fin", () => {
    const plan = planDesFins({ ...base, reseaux: ["facebook", "linkedin", "facebook"], offre: "audit", avecMot: false });
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["linkedin"]]);
    const deux = planDesFins({ ...base, reseaux: ["tiktok", "tiktok"], offre: "audit" });
    expect(deux.fins).toHaveLength(1);
  });

  it("une ligne de la fin au mot non validée : le diagnostic, avec sa raison", () => {
    const table = TABLE_FINS_DIAGNOSTIC.map((f) => (f.id === "fin-if-envoi-structure" ? { ...f, validee: false } : f));
    const plan = planDesFins({ ...base, table, reseaux: ["facebook"], offre: "formation" });
    expect(plan.fins[0].appels.map((a) => a.id)).toEqual(["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
    expect(plan.reduites).toEqual([{ reseaux: ["facebook"], raison: RAISON_SUITE_REDUITE }]);
    expect(RAISON_SUITE_REDUITE).toBe("La fin au mot n'est pas encore validée : la fin propose le diagnostic.");
  });

  it("aucune fin ne dit « réservez » ni « rendez-vous », pour aucune offre, avec ou sans mot", () => {
    for (const offre of OFFRES)
      for (const motSur of [[], ["instagram"], ["facebook", "instagram"]] as ReseauCas[][]) {
        const plan = planDesFins({ ...base, motSur, reseaux: TOUS, offre });
        for (const f of plan.fins) for (const a of f.appels) expect(`${a.dit} ${a.ecran}`, `${offre} ${a.id}`).not.toMatch(/r[ée]servez|rendez-vous/i);
        for (const r of plan.reduites) expect(r.raison).not.toMatch(/rendez-vous/i);
      }
  });

  it("sansFin vide pour les 4 offres, avec ou sans le mot", () => {
    for (const offre of OFFRES)
      for (const avecMot of [true, false]) expect(planDesFins({ ...base, reseaux: TOUS, offre, avecMot }).sansFin, `${offre} ${avecMot}`).toEqual([]);
  });

  it("avecMot: false → aucune ligne « mot » ni « cadeau »", () => {
    for (const offre of OFFRES) {
      const plan = planDesFins({ ...base, reseaux: TOUS, offre, avecMot: false });
      const types = plan.fins.flatMap((f) => f.appels.map((a) => a.type));
      expect(types, offre).not.toContain("commentaire");
      expect(types, offre).not.toContain("cadeau");
      expect(plan.reduites, offre).toEqual([]);
    }
  });

  it("une table sans lien → sansFin avec une raison", () => {
    const table = TABLE_FINS_DIAGNOSTIC.filter((f) => f.type !== "lien");
    const plan = planDesFins({ ...base, reseaux: ["tiktok"], offre: "integration", nature: "automatisation", table });
    expect(plan.fins).toEqual([]);
    expect(plan.sansFin).toHaveLength(1);
    expect(plan.sansFin[0].reseaux).toEqual(["tiktok"]);
    expect(plan.sansFin[0].raison).toMatch(/\S/);
  });

  it("le dit du cas témoin contient « I.A. », l'écran « IA »", () => {
    const [fin] = planDesFins({ ...base, reseaux: ["instagram"], offre: "integration", nature: "automatisation" }).fins;
    const mot = fin.appels.find((a) => a.type === "commentaire")!;
    expect(mot.dit).toContain("I.A.");
    expect(mot.ecran).toContain("IA");
    const ecran = fin.ecrans[0];
    expect(ecran.type === "appel-mot" && ecran.mot).toBe("IA");
    expect(ecran.texteDit).toContain("I.A.");
  });

  it("un mot invalide sur une suite qui en demande un → sansFin, pas d'exception", () => {
    const plan = planDesFins({ ...base, motSur: ["facebook"], mot: "a b", reseaux: ["facebook", "tiktok"], offre: "integration", nature: "automatisation" });
    expect(plan.sansFin.map((s) => s.reseaux)).toEqual([["facebook"]]);
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["tiktok"]]);
  });

  it("motValide : 2 à 24 lettres ou chiffres", () => {
    expect(motValide("IA")).toBe(true);
    expect(motValide("Équipe2")).toBe(true);
    expect(motValide("A")).toBe(false);
    expect(motValide("a".repeat(25))).toBe(false);
    expect(motValide("deux mots")).toBe(false);
    expect(motValide("ia!")).toBe(false);
  });
});

describe("M2 · liens suivis", () => {
  it("chaque lien commence par la page Diagnostic suivie, source = réseau, campagne = code de version, contenu = activité", () => {
    const liens = liensSuivis(TOUS, 42, "apporteurs");
    expect(Object.keys(liens).sort()).toEqual([...TOUS].sort());
    for (const r of TOUS) {
      expect(liens[r].startsWith("https://axion-ia.com/fr/diagnostic?utm_source=")).toBe(true);
      const u = new URL(liens[r]);
      expect(u.searchParams.get("utm_source")).toBe(r);
      expect(u.searchParams.get("utm_campaign")).toBe(codeVersionCasConcret(42, r));
      expect(u.searchParams.get("utm_content")).toBe("apporteurs");
    }
  });
});

describe("M2 · textes de publication", () => {
  const mot = recrutementApporteurs.mot;
  const plan = planDesFins({ ...aujourdhui, reseaux: TOUS, offre: "integration", nature: "automatisation" });
  const liens = liensSuivis(TOUS, 42);
  const textes = textesDePublication(fiche, plan, liens);
  const de = (r: ReseauCas) => textes.find((t) => t.reseau === r)!;

  it("un texte par réseau, avec promesse, avant, résultat et question", () => {
    expect(textes.map((t) => t.reseau).sort()).toEqual([...TOUS].sort());
    for (const t of textes) {
      expect(t.texte).toContain("On recrute en 15 minutes.");
      expect(t.texte).toContain("Avant : trier les candidatures, relancer (plus d'une heure).");
      expect(t.texte).toContain("Des heures gagnées, à chaque recrutement.");
      expect(t.texte).toContain("Quelle tâche pourrait tourner toute seule dans votre entreprise ?");
    }
  });

  it("la ligne d'appel dit le diagnostic puis le lien du réseau ; ni « Réservez » ni « rendez-vous »", () => {
    expect(de("facebook").texte.split("\n\n").at(-1)).toBe(`${DIAGNOSTIC} Le lien est en commentaire.`);
    expect(de("instagram").texte.split("\n\n").at(-1)).toBe(`${DIAGNOSTIC} Le lien est dans mon profil.`);
    for (const t of textes) expect([t.texte, t.premierCommentaire ?? "", t.consigneLien].join("\n"), t.reseau).not.toMatch(/r[ée]servez|rendez-vous/i);
  });

  it("où poser le lien : premier commentaire (Facebook, LinkedIn) ou profil (Instagram, TikTok)", () => {
    expect(de("facebook").ouPoserLeLien).toBe("premier-commentaire");
    expect(de("facebook").premierCommentaire).toBe(`Votre diagnostic gratuit, en quelques minutes : ${liens.facebook}`);
    expect(de("linkedin").premierCommentaire).toBe(`Votre diagnostic gratuit, en quelques minutes : ${liens.linkedin}`);
    for (const r of ["instagram", "tiktok"] as const) {
      expect(de(r).ouPoserLeLien).toBe("profil");
      expect(de(r).premierCommentaire).toBeUndefined();
      expect(de(r).consigneLien).toMatch(/profil/);
    }
  });

  it("Facebook : l'indication « à poser à la main » ; pas ailleurs", () => {
    expect(INDICATION_FACEBOOK).toBe("À poser à la main : Buffer ne pose pas de premier commentaire sous un Reel Facebook.");
    expect(de("facebook").consigneLien).toContain(INDICATION_FACEBOOK);
    for (const r of ["instagram", "tiktok", "linkedin"] as const) expect(de(r).consigneLien).not.toContain(INDICATION_FACEBOOK);
  });

  it("aucun mot sans mot branché : ni ligne du mot, ni proposition sur LinkedIn", () => {
    for (const t of textes) expect(t.texte, t.reseau).not.toContain("Écrivez");
  });

  describe("mot branché sur Instagram", () => {
    const p = planDesFins({ ...base, motSur: ["instagram"], reseaux: TOUS, offre: "integration", nature: "automatisation" });
    const t = textesDePublication(fiche, p, liens, { mot });
    const de2 = (r: ReseauCas) => t.find((x) => x.reseau === r)!;

    it("Instagram : la ligne du mot, aucun lien annoncé ; Facebook garde le diagnostic", () => {
      // X7 : la phrase d'Instagram, telle qu'elle est dite (le mot écrit « IA » dans le texte).
      expect(de2("instagram").texte.split("\n\n").at(-1)).toBe("Abonnez-vous et écrivez IA en commentaire : je vous l'envoie.");
      expect(de2("instagram").ouPoserLeLien).toBe("aucun");
      expect(de2("instagram").premierCommentaire).toBeUndefined();
      expect(de2("facebook").texte).not.toContain("Écrivez");
      expect(de2("tiktok").texte).not.toContain("Écrivez");
    });

    it("LinkedIn : le diagnostic, puis en dernière ligne la proposition du mot ; jamais « Commentez »", () => {
      const l = de2("linkedin").texte;
      expect(l).not.toMatch(/commentez/i);
      expect(l.split("\n\n").at(-1)).toBe("Écrivez IA si vous voulez la structure complète : je vous l'envoie.");
      expect(l).toContain(DIAGNOSTIC);
    });
  });

  it("aucun texte ne contient un mot interdit", () => {
    for (const offre of OFFRES) {
      const p = planDesFins({ ...base, reseaux: TOUS, offre });
      for (const t of textesDePublication(fiche, p, liens, { mot })) {
        const tout = [t.texte, t.premierCommentaire ?? "", t.consigneLien].join("\n").toLowerCase();
        for (const interdit of INTERDITS) expect(tout, `${offre} ${t.reseau}`).not.toContain(interdit.toLowerCase());
      }
    }
  });

  it("un réseau sans lien fourni n'a pas de texte", () => {
    expect(textesDePublication(fiche, plan, { tiktok: liens.tiktok }).map((t) => t.reseau)).toEqual(["tiktok"]);
  });

  it("le cas témoin reste valide (garde du test)", () => {
    expect(schemaCas.safeParse(recrutementApporteurs).success).toBe(true);
  });
});
