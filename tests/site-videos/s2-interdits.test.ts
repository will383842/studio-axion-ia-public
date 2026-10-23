/** S2.1 — mots interdits lus dans la liste unique : SITE-01 (communs) et SITE-02 (écrivain du générateur). */
import { describe, expect, it } from "vitest";
import { controlerAvantSite } from "@/domaine/site-videos/controles";
import { entreeOk, passeportOk } from "./helpers-controles";

const echecs = (r: ReturnType<typeof controlerAvantSite>, code: string) => r.controles.filter((c) => c.code === code && !c.ok);

describe("S2.1 interdits", () => {
  it("texte propre : tous les contrôles sont verts et la vidéo est publiable", () => {
    const r = controlerAvantSite(entreeOk());
    expect(r.controles.filter((c) => !c.ok && c.gravite === "bloquant")).toEqual([]);
    expect(r.publiable).toBe(true);
    const codes = new Set(r.controles.map((c) => c.code));
    expect(codes.has("SITE-01")).toBe(true);
    expect(codes.has("SITE-02")).toBe(true);
  });

  it("« Villeexemple » dans la transcription → SITE-01 en échec, le message nomme la transcription", () => {
    const r = controlerAvantSite(entreeOk({ passeport: passeportOk({ transcription: "Nous aidons les artisans de Villeexemple à chiffrer vite." }) }));
    const e = echecs(r, "SITE-01");
    expect(e).toHaveLength(1);
    expect(e[0].gravite).toBe("bloquant");
    expect(e[0].champ).toBe("transcription");
    expect(e[0].message.toLowerCase()).toContain("transcription");
    expect(e[0].message).toContain("Villeexemple");
    expect(r.publiable).toBe(false);
  });

  it("« Aucun gain garanti » dans le résumé → échec", () => {
    const r = controlerAvantSite(entreeOk({ passeport: passeportOk({ resume: "Aucun gain garanti, mais une méthode claire pour vos devis." }) }));
    const e = echecs(r, "SITE-01");
    expect(e).toHaveLength(1);
    expect(e[0].champ).toBe("resume");
    expect(e[0].message.toLowerCase()).toContain("résumé");
  });

  it("« certifiée Certifexemple » dans un chapitre → échec", () => {
    const p = passeportOk();
    p.chapitres = [p.chapitres[0], { ...p.chapitres[1], libelle: "Formation certifiée Certifexemple" }];
    const r = controlerAvantSite(entreeOk({ passeport: p }));
    expect(echecs(r, "SITE-01").length).toBeGreaterThan(0);
    expect(r.publiable).toBe(false);
  });

  it("chaque champ est contrôlé séparément : titre, À retenir, question, réponse, mot-clé, rubrique", () => {
    const base = passeportOk();
    const cas: [Partial<ReturnType<typeof passeportOk>>, string][] = [
      [{ titreWeb: "Devis à Villeexemple" }, "titreWeb"],
      [{ aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun gain garanti."] }, "aRetenir"],
      [{ questions: [{ question: "Où ? À Villeexemple ?", reponse: "Oui." }, base.questions[1]] }, "questions"],
      [{ questions: [base.questions[0], { question: "Combien ?", reponse: "Aucun gain garanti." }] }, "questions"],
      [{ motsCles: ["devis", "villeexemple"] }, "motsCles"],
      [{ rubrique: "Villeexemple" }, "rubrique"],
    ];
    for (const [surcharge, champ] of cas) {
      const e = echecs(controlerAvantSite(entreeOk({ passeport: { ...base, ...surcharge } })), "SITE-01");
      expect(e.map((x) => x.champ), champ).toContain(champ);
    }
  });

  it("SITE-02 : les interdits de l'écrivain du générateur, sans doublon avec SITE-01", () => {
    const p = passeportOk({ resume: "Une machine à devis qui travaille pour vous, rapidement." });
    const cas = controlerAvantSite(entreeOk({ formatId: "cas-concret", ecrivain: "cas-concret", passeport: p }));
    const e = echecs(cas, "SITE-02");
    expect(e).toHaveLength(1);
    expect(e[0].champ).toBe("resume");
    expect(echecs(cas, "SITE-01")).toEqual([]);
    expect(cas.publiable).toBe(false);
    // Le tableau a ses propres interdits (« notre équipe »).
    const tab = controlerAvantSite(entreeOk({ formatId: "tableau-anime", ecrivain: "tableau", passeport: passeportOk({ resume: "Notre équipe vous montre le geste en dix minutes, sans outil compliqué." }) }));
    expect(echecs(tab, "SITE-02")).toHaveLength(1);
  });

  it("SITE-02 est ignoré quand le générateur n'a pas d'écrivain", () => {
    const p = passeportOk({ resume: "Une machine à devis qui travaille pour vous, rapidement." });
    expect(echecs(controlerAvantSite(entreeOk({ ecrivain: null, passeport: p })), "SITE-02")).toEqual([]);
    // « machine » n'est un interdit ni de l'écrivain « écrire » ni commun.
    expect(echecs(controlerAvantSite(entreeOk({ ecrivain: "ecrire", passeport: p })), "SITE-02")).toEqual([]);
  });
});
