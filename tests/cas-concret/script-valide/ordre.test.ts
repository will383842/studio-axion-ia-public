/**
 * V4-3 · ORDRE RÉEL DU FONCTIONNEMENT. Le cas dit où vient la partie humaine dans la suite de ses étapes
 * (`resteHumainApresEtape`) ; la règle R23 refuse une fiche (écrite par Claude ou validée) qui montre les étapes dans un
 * autre ordre que le cas, ou qui dit la partie humaine ailleurs qu'à sa place (constat de Will du 14/10 : dans l'essai,
 * la visio venait après le contrat, alors qu'elle a lieu avant la signature).
 */
import { describe, expect, it } from "vitest";
import { schemaCas, verifierCas } from "@/formats/cas-concret/cas";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit, variableEcriture, CONSIGNE_ECRITURE } from "@/moteurs/montage-cas-concret/ecriture";
import { recettePour } from "@/formats/cas-concret/recette";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { etapesMontrees, regleOrdreDuFonctionnement, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const recrutement = trouverCas("recrutement-apporteurs")!;
const contexte = (fiche: FicheEcrans, cas = recrutement) => ({ cas, texteScript: texteDuCorps(fiche) });
const renumeroter = (f: FicheEcrans): FicheEcrans => ({ ...f, ecrans: f.ecrans.map((e, i) => ({ ...e, id: `e${String(i + 1).padStart(2, "0")}` })) });

describe("V4-3 · place de la partie humaine dans le cas", () => {
  it("chaque cas du catalogue dit après quelle étape vient sa partie humaine", () => {
    for (const cas of CATALOGUE) {
      expect(cas.resteHumainApresEtape, cas.id).toBeGreaterThanOrEqual(1);
      expect(cas.resteHumainApresEtape, cas.id).toBeLessThanOrEqual(cas.etapes.length);
    }
  });

  it("recrutement : la visio vient après l'étape 5 (le rappel), avant le contrat", () => {
    expect(recrutement.resteHumainApresEtape).toBe(5);
    expect(recrutement.etapes[4].titre).toBe("Le rappel");
    expect(recrutement.etapes[5].titre).toBe("Le contrat");
  });

  it("le schéma refuse une place hors des étapes du cas", () => {
    const r = verifierCas({ ...recrutement, resteHumainApresEtape: 7 });
    expect(r.ok).toBe(false);
    expect(schemaCas.safeParse({ ...recrutement, resteHumainApresEtape: 0 }).success).toBe(false);
  });
});

describe("V4-3 · R23 : l'ordre du fonctionnement", () => {
  it("le gabarit des 7 cas montre les étapes dans l'ordre du cas, la partie humaine à sa place", () => {
    for (const cas of CATALOGUE) {
      const f = ficheParGabarit(cas, FIXE);
      expect(regleOrdreDuFonctionnement(f, contexte(f, cas)), cas.id).toEqual([]);
      const v = validerFicheEcrans(f, contexte(f, cas));
      expect(v.ok ? [] : v.problemes.map((p) => p.message), cas.id).toEqual([]);
    }
  });

  it("recrutement (gabarit) : la partie humaine est dite après le rappel et avant le contrat", () => {
    const f = ficheParGabarit(recrutement, FIXE);
    const m = etapesMontrees(f, recrutement);
    const rappel = m.etapes.find((x) => x.rang === 5)!.ecran;
    const contrat = m.etapes.find((x) => x.rang === 6)!.ecran;
    expect(m.resteHumain).toBeGreaterThan(rappel);
    expect(m.resteHumain).toBeLessThan(contrat);
  });

  it("la partie humaine dite après le contrat est refusée, avec la place attendue", () => {
    const f = ficheParGabarit(recrutement, FIXE);
    const m = etapesMontrees(f, recrutement);
    const ecrans = [...f.ecrans];
    const [reste] = ecrans.splice(m.resteHumain!, 1);
    const contrat = ecrans.findIndex((e) => e.type === "etape" && e.titre === "Le contrat");
    ecrans.splice(contrat + 1, 0, reste);
    const deplacee = renumeroter({ ...f, ecrans });
    const r = regleOrdreDuFonctionnement(deplacee, contexte(deplacee));
    expect(r).toHaveLength(1);
    expect(r[0].detail).toContain("après l'étape 5 « Le rappel »");
    expect(r[0].detail).toContain("avant l'étape 6 « Le contrat »");
    const v = validerFicheEcrans(deplacee, contexte(deplacee));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problemes.some((p) => p.message.includes("ordre du fonctionnement"))).toBe(true);
  });

  it("deux étapes inversées sont refusées", () => {
    const f = ficheParGabarit(recrutement, FIXE);
    const ecrans = [...f.ecrans];
    const i = ecrans.findIndex((e) => e.type === "etape" && e.titre === "Les e-mails");
    const j = ecrans.findIndex((e) => e.type === "etape" && e.titre === "Le rendez-vous");
    [ecrans[i], ecrans[j]] = [ecrans[j], ecrans[i]];
    const inversee = renumeroter({ ...f, ecrans });
    const r = regleOrdreDuFonctionnement(inversee, contexte(inversee));
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].detail).toContain("« Les e-mails »");
  });

  it("la partie humaine absente du texte dit est refusée (elle se dit à sa place, mot pour mot)", () => {
    const f = ficheParGabarit(recrutement, FIXE);
    const m = etapesMontrees(f, recrutement);
    const sans = renumeroter({ ...f, ecrans: f.ecrans.filter((_, i) => i !== m.resteHumain) });
    expect(regleOrdreDuFonctionnement(sans, contexte(sans)).map((x) => x.detail).join(" ")).toContain("n'est pas dite");
  });

  it("l'écriture reçoit la place de la partie humaine et la règle", () => {
    expect(variableEcriture(recrutement, recettePour(recrutement))).toContain("<reste_humain_apres_etape>5 · Le rappel</reste_humain_apres_etape>");
    expect(CONSIGNE_ECRITURE).toContain("R23");
  });
});
