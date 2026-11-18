/**
 * FIX-CC-SIGLE-SOUS-TITRES · essai réel du 17/11 : les sous-titres écrivaient « DANS LE C.R.M ». Le texte DIT épelle le sigle
 * pour la voix (« C.R.M. »), le texte ÉCRIT dit « CRM » (R22). La voix, elle, reçoit exactement le même texte qu'avant.
 */
import { describe, expect, it } from "vitest";
import { siglesEcrits } from "@/moteurs/montage-cas-concret/sigles-sous-titres";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { doubles } from "./doubles";

describe("siglesEcrits : les points d'un sigle épelé disparaissent", () => {
  it("a) « C.R.M. » devient « CRM », le point de fin de phrase est gardé une fois", () => {
    expect(siglesEcrits("La fiche arrive dans le C.R.M.")).toBe("La fiche arrive dans le CRM.");
    expect(siglesEcrits("Le C.R.M. reçoit la fiche.")).toBe("Le CRM reçoit la fiche.");
    expect(siglesEcrits("Le C.R.M. Puis la suite.")).toBe("Le CRM. Puis la suite.");
    expect(siglesEcrits("l'I.A. est là")).toBe("l'IA est là");
    expect(siglesEcrits("R.G.P.D., C.R.M. et I.A.")).toBe("RGPD, CRM et IA.");
  });

  it("b) rien d'autre ne change", () => {
    for (const t of ["M. Dupont", "3.5", "etc.", "Prix : 10 €.", "Bonjour M. Dupont. A.", "dossier.A.B", "Aucun sigle ici"]) expect(siglesEcrits(t)).toBe(t);
  });
});

describe("c) chaîne branchée sur les doubles", () => {
  it("les sous-titres écrivent « CRM » ; la voix reçoit toujours « C.R.M. »", async () => {
    const d = doubles();
    d.options.scriptValide = { ...SCRIPT_V4_RECRUTEMENT, ecrans: SCRIPT_V4_RECRUTEMENT.ecrans.map((e, i) => (i === 1 ? { ...e, texteDit: `${e.texteDit.trim()} La fiche arrive dans le C.R.M.` } : e)) };
    const r = await fabriquerCasConcret(d.options);
    const affiches = (r.sousTitres ?? []).flatMap((s) => s.mots.map((m) => m.mot));
    expect(affiches.some((m) => /C\.R\.M/u.test(m))).toBe(false);
    expect(affiches.some((m) => /^CRM/iu.test(m))).toBe(true);
    expect(d.lus.join(" ")).toContain("C.R.M.");
  });
});
