/**
 * FIX-CC-FIN-NON-CHOISIE (17/11, Williams) : le Studio ne dit et n'écrit jamais une phrase que l'utilisateur n'a pas écrite
 * ou choisie. Sans « Avec le mot » coché et branché, plus aucune fin : la vidéo s'arrête sur la question du script ; l'écran
 * « Relire et valider le script » montre tout ce qui sera dit et écrit. Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { suiteDeFins } from "@/briques/fins";
import type { ReseauCas } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { fournisseurVoixSimulation } from "@/fournisseurs/simulation/autres";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { FIN_AUCUNE, planDesFins, RAISON_MOT_NON_BRANCHE } from "@/moteurs/montage-cas-concret/fins";
import { CONSIGNE_SANS_FIN, textesDePublication } from "@/moteurs/montage-cas-concret/publication";
import { lignesDesEcrans, rangDeLigne } from "@/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";
import { phraseDeFin } from "@/services/cas-concret-vue";
import { doubles } from "../fabriquer/doubles";

const CAS = trouverCas("contact-vers-crm")!;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const demande = (o: { reseaux: ReseauCas[]; avecMot: boolean; motSur?: ReseauCas[] }) => ({ ...o, offre: CAS.offre, ...(CAS.nature ? { nature: CAS.nature } : {}), mot: CAS.mot, ...(CAS.motDit ? { motDit: CAS.motDit } : {}), table: TABLE_FINS_DIAGNOSTIC });
const FRAGMENTS_INTERDITS = /diagnostic|lien|commentaire|quelques minutes/i;

describe("FIX-CC-FIN-NON-CHOISIE · a) sans « Avec le mot » : fin vide", () => {
  it.each([[["facebook"]], [["tiktok"]], [["linkedin"]], [TOUS]] as [ReseauCas[]][])("réseaux %j : chaque fin n'a ni ligne ni écran", (reseaux) => {
    const plan = planDesFins(demande({ reseaux, avecMot: false }));
    expect(plan.sansFin).toEqual([]);
    expect(plan.fins.length).toBeGreaterThan(0);
    for (const f of plan.fins) {
      expect(f.appels).toEqual([]);
      expect(f.ecrans).toEqual([]);
    }
    expect(plan.fins.flatMap((f) => f.reseaux).sort()).toEqual([...reseaux].sort());
    expect(JSON.stringify(plan)).not.toContain("fin-fb-lien-commentaire");
  });

  it("les réseaux sans fin sont regroupés : un seul fichier", () => {
    expect(regrouperFins(planDesFins(demande({ reseaux: TOUS, avecMot: false }))).fins).toHaveLength(1);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · b) « Avec le mot » coché et branché : la fin au mot reste, mot pour mot", () => {
  const plan = planDesFins(demande({ reseaux: TOUS, avecMot: true, motSur: ["facebook"] }));
  const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;

  it("Facebook garde ses deux lignes et ses deux écrans, identiques à la table", () => {
    expect(de("facebook").appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    const direct = suiteDeFins("facebook", ["fin-if-mot", "fin-if-envoi-structure"], { mot: CAS.mot, ...(CAS.motDit ? { motDit: CAS.motDit } : {}) }, TABLE_FINS_DIAGNOSTIC);
    expect(de("facebook").appels).toEqual(direct);
    expect(de("facebook").ecrans.map((e) => e.type)).toEqual(["appel-mot", "promesse"]);
    expect(de("facebook").ecrans.map((e) => e.texteDit).join(" ")).toBe(direct.map((a) => a.dit).join(" "));
  });

  it("TikTok, LinkedIn et Instagram (mot non branché) : fin vide, plus de repli sur le diagnostic", () => {
    for (const r of ["tiktok", "linkedin", "instagram"] as const) {
      expect(de(r).appels, r).toEqual([]);
      expect(de(r).ecrans, r).toEqual([]);
    }
    expect(JSON.stringify(plan)).not.toMatch(/diagnostic-gratuit|lien-profil|lien-commentaire/);
  });

  it("la raison du repli reste dite, pour Instagram", () => {
    expect(plan.reduites).toEqual([{ reseaux: ["instagram"], raison: RAISON_MOT_NON_BRANCHE }]);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · c) la fabrication d'une fin vide : le corps seul", () => {
  it("aucune voix de fin lue, aucun écran de fin, la dernière image est la question, aucun mot de fin dans les sous-titres", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    const cr = await fabriquerCasConcret(d.options);
    // Le corps seul est lu : une lecture payée, jamais le diagnostic ni le lien.
    expect(d.lus).toHaveLength(1);
    expect(d.lus[0]).not.toMatch(FRAGMENTS_INTERDITS);
    expect(cr.prises).toHaveLength(1);
    expect(cr.plan.fins).toHaveLength(1);
    expect(cr.plan.fins[0].ecrans).toEqual([]);
    // Aucun écran de fin (f01, f02…) : ni au plan, ni parmi les écrans rendus.
    expect(cr.fins).toHaveLength(1);
    expect(cr.ecrans.rendus.join(" ")).not.toMatch(/\bf0\d/);
    const dernier = cr.fiche.ecrans[cr.fiche.ecrans.length - 1];
    expect(dernier.type).toBe("question");
    // Aucun contrôle bloquant : la voix finit à 2,0 s au moins de la fin du fichier (le « ? » seul n'est pas un mot).
    expect(cr.rapport.lignes.filter((l) => l.bloquant && l.etat === "echoue")).toEqual([]);
    // Un seul assemblage : celui du corps seul (même traitement final de la recette, sans phrase de fin).
    expect(d.assemblages).toHaveLength(1);
    const morceaux = (d.assemblages[0].recette?.parametres.morceaux ?? []) as { source?: number }[];
    expect(morceaux.every((m) => (m.source ?? 0) === 0)).toBe(true);
    // Les sous-titres ne disent que le corps.
    for (const c of d.compositionsSoumises()) {
      const segments = ((c.parametres as { texte: { sousTitres?: { segments: { texte?: string; mots?: { mot?: string }[] }[] } } }).texte.sousTitres?.segments ?? []).map((s) => JSON.stringify(s)).join(" ");
      expect(segments).not.toMatch(FRAGMENTS_INTERDITS);
    }
    expect(cr.sousTitres?.map((s) => JSON.stringify(s)).join(" ") ?? "").not.toMatch(FRAGMENTS_INTERDITS);
  });

  it("4 réseaux sans choix : un seul fichier, un seul assemblage, toujours aucune lecture de fin", async () => {
    const d = doubles({ casId: "contact-vers-crm", avecMot: false });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(1);
    expect(cr.fins[0].reseaux.sort()).toEqual([...TOUS].sort());
    expect(d.lus).toHaveLength(1);
    expect(d.assemblages).toHaveLength(1);
  });

  it("la fin au mot choisie garde sa lecture de fin et ses écrans (Facebook), la fin vide n'en a pas (TikTok)", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook", "tiktok"], avecMot: true, motSur: ["facebook"] });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(2);
    expect(d.lus).toHaveLength(2); // le corps, la fin au mot
    expect(d.lus.some((t) => /diagnostic|lien/i.test(t))).toBe(false);
    expect(d.assemblages).toHaveLength(2);
    const fb = cr.plan.fins.find((f) => f.reseaux.includes("facebook"))!;
    const tt = cr.plan.fins.find((f) => f.reseaux.includes("tiktok"))!;
    expect(fb.ecrans.length).toBeGreaterThan(0);
    expect(tt.ecrans).toEqual([]);
  });

  it("heures de mots estimées (voix sans heures) + fin vide : le son du corps entier, le corps calé, la réserve dite", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    d.options.outils.voix.voix = () => ({
      ...fournisseurVoixSimulation,
      async lire(demande) {
        return { ...(await fournisseurVoixSimulation.lire(demande)), mots: [] };
      },
    });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.reservesVoix).toContain("Voix sans heures des mots : sous-titres approximatifs, son gardé entier.");
    // Une seule lecture payée (le corps), un seul assemblage : un seul morceau, le son du corps entier, jamais une fin.
    expect(cr.prises).toHaveLength(1);
    const finals = d.assemblages.filter((a) => a.recette);
    expect(finals).toHaveLength(1);
    expect(finals[0].morceaux).toHaveLength(1);
    expect(finals[0].morceaux[0].deSec).toBe(0);
    expect(finals[0].morceaux[0].aSec).toBeGreaterThan(0);
    // Les écrans du corps sont calés, dans l'ordre, sans trou ni recouvrement, et aucun écran de fin.
    const e = cr.fiche.ecrans;
    expect(cr.plan.fins[0].ecrans).toEqual([]);
    for (let i = 0; i < e.length; i++) {
      expect(e[i].finMs!).toBeGreaterThan(e[i].debutMs!);
      if (i > 0) expect(e[i].debutMs!).toBeGreaterThanOrEqual(e[i - 1].finMs! - 1);
    }
    expect(cr.rapport.lignes.filter((l) => l.bloquant && l.etat === "echoue")).toEqual([]);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · d) l'estimation ne compte plus la voix d'une fin", () => {
  it("avecMot: false : la voix estimée est celle du corps seul, et jamais celle d'un diagnostic de plus", () => {
    const voixDe = (reseaux: ReseauCas[]) => estimerDepuisCas(CAS, reseaux, false, { voix: { fournisseur: "heygen" } }).lignes.filter((l) => /voix/i.test(l.etape));
    const un = voixDe(["facebook"]);
    const quatre = voixDe(TOUS);
    // Plus de fin par réseau : le prix de la voix ne dépend plus du nombre de réseaux.
    expect(quatre).toEqual(un);
    // Avant (master du 17/11, 4 réseaux) : 2 790 caractères lus, 81 centimes ; une fin de plus par groupe de réseaux.
    expect(quatre[0].quantite).toBeLessThan(2790);
    expect(quatre[0].total.centimes).toBeLessThan(81);
  });

  it("avecMot: false, UN réseau : le prix annoncé ne monte pas (master du 17/11 : voix 2 452 caractères, 69 c ; total 1,84 €)", () => {
    const e = estimerDepuisCas(CAS, ["facebook"], false, { voix: { fournisseur: "heygen" } });
    const voix = e.lignes.filter((l) => /voix/i.test(l.etape));
    expect(voix[0].quantite).toBeLessThanOrEqual(2452);
    expect(voix[0].total.centimes).toBeLessThanOrEqual(69);
    expect(e.total.centimes).toBeLessThanOrEqual(184);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · e) l'écran « Relire et valider le script » montre la fin", () => {
  const apercu = apercuDesEcrans(ficheParGabarit(CAS, FIXE).ecrans);

  it("sans choix : une dernière ligne verrouillée, groupe « Fin », texte FIN_AUCUNE", () => {
    expect(FIN_AUCUNE).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
    const lignes = lignesDesEcrans(apercu, [{ reseaux: "facebook-instagram-tiktok-linkedin", dit: FIN_AUCUNE, ecrits: [] }]);
    const derniere = lignes[lignes.length - 1];
    expect(lignes).toHaveLength(apercu.length + 1);
    expect(derniere).toMatchObject({ id: "f-facebook-instagram-tiktok-linkedin", dit: FIN_AUCUNE, groupe: "Fin", verrouille: true });
    expect(derniere.ecrits).toEqual([]);
    expect(rangDeLigne(derniere.id)).toBeNull();
  });

  it("avec la fin au mot : sa phrase dite et ses textes écrits, mot pour mot", () => {
    const [fin] = planDesFins(demande({ reseaux: ["facebook"], avecMot: true, motSur: ["facebook"] })).fins;
    const ecrits = apercuDesEcrans(fin.ecrans).flatMap((e) => e.affiches);
    const dit = fin.ecrans.map((e) => e.texteDit.trim()).join(" ");
    const derniere = lignesDesEcrans(apercu, [{ reseaux: "facebook", dit, ecrits }]).at(-1)!;
    expect(derniere).toMatchObject({ dit, groupe: "Fin", verrouille: true });
    expect(dit).toBe("Écrivez C.R.M. en commentaire. Je vous envoie la structure complète.");
    expect(derniere.ecrits?.map((x) => x.texte)).toEqual(ecrits);
    expect(ecrits.length).toBeGreaterThan(0);
    expect(derniere.ecrits?.every((x) => x.modifiable === false)).toBe(true);
  });

  it("sans fins passées : les lignes d'avant, inchangées", () => {
    expect(lignesDesEcrans(apercu)).toHaveLength(apercu.length);
    expect(lignesDesEcrans(apercu).every((l) => l.groupe !== "Fin")).toBe(true);
  });

  it("« Vos fichiers » écrit FIN_AUCUNE pour une fin vide", () => {
    expect(phraseDeFin([])).toBe(FIN_AUCUNE);
    expect(phraseDeFin(["rendez-vous", "lien"])).toBe("Fin : diagnostic et lien");
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · f) les textes de publication d'une fin vide", () => {
  const fiche = ficheParGabarit(CAS, FIXE);
  const plan = planDesFins(demande({ reseaux: TOUS, avecMot: false }));
  const textes = textesDePublication(fiche, plan, { facebook: "https://x/fb", instagram: "https://x/ig", tiktok: "https://x/tt", linkedin: "https://x/li" }, { mot: CAS.mot });

  it("un texte par réseau, sans lien ni premier commentaire, sans phrase d'appel", () => {
    expect(textes.map((t) => t.reseau).sort()).toEqual([...TOUS].sort());
    for (const t of textes) {
      expect(t.ouPoserLeLien, t.reseau).toBe("aucun");
      expect(t.premierCommentaire, t.reseau).toBeUndefined();
      expect(t.consigneLien, t.reseau).toBe(CONSIGNE_SANS_FIN);
      expect(t.texte, t.reseau).not.toMatch(FRAGMENTS_INTERDITS);
      expect(t.texte, t.reseau).not.toContain("https://");
      expect(t.texte.length, t.reseau).toBeGreaterThan(0);
    }
  });
});
