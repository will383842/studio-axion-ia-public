/**
 * T-EXT-31 : mixage, mesure du son et vignette du tutoriel d'outil, avec doubles. Le service de rendu est un double qui
 * enregistre les demandes : aucune vraie opération, 0 €.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerMoteurTutorielOutil, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { ResultatFabrication } from "@/moteurs/types";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 18, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

interface Options {
  finitions?: boolean;
  lufs?: number | null;
  mixageEnEchec?: boolean;
}

/** Les doubles du tutoriel, plus des mesures pour `mesure-son` et un échec possible du mixage. */
function outils(j: Journal, o: Options = {}): OutilsTutoriel {
  const base = outilsDoubles(j);
  const service: ServiceRendu = {
    soumettre: (d) => base.rendu.service().soumettre(d),
    async etat(id): Promise<EtatRendu> {
      const e = await base.rendu.service().etat(id);
      const d = j.rendus.find((x) => x.idRendu === id);
      if (d?.operation === "mixage" && o.mixageEnEchec && e.statut === "termine") return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "mixage refusé" } as never };
      if (d?.operation === "mesure-son" && e.statut === "termine") return { ...e, mesures: o.lufs === null ? {} : { lufs: o.lufs ?? -14.1, creteVraieDbtp: -2.3 } };
      return e;
    },
  };
  return { ...base, rendu: { ...base.rendu, service: () => service }, ...(o.finitions ? { finitions: { actif: true as const } } : {}) };
}

async function mener(o: OutilsTutoriel, c: CommandeFabrication, travail?: Travail) {
  const moteur = creerMoteurTutorielOutil({ outils: une(o) });
  let t = travail ?? (await moteur.lancer(c, { travailId: "t-fin", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
  let resultat: ResultatFabrication | undefined;
  for (let i = 0; i < 600; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { moteur, travail: t, resultat: resultat! };
}

/** Demandes de la fiche : sans le nettoyage de la voix (sous-machine voix, hors périmètre). */
const demandes = (j: Journal) => j.rendus.filter((d) => d.operation !== "nettoyage-audio");
const ops = (j: Journal) => demandes(j).map((d) => d.operation);
const messages = (r: ResultatFabrication, i = 0) => r.sorties[i].rapportQualite.alertes.map((a) => a.message);

describe("tutoriel d'outil : finitions (T-EXT-31)", () => {
  it("1. éteint : seules les compositions partent ; le rapport cesse de mentir", async () => {
    const j = journalVide();
    const { resultat, travail } = await mener(outils(j), commandeTutoriel());
    expect(travail.statut).toBe("termine");
    expect(ops(j)).toEqual(["composition", "composition"]);
    const compo = demandes(j)[0];
    expect(Object.keys(compo.entrees)).toEqual(["audio"]);
    expect(compo.entrees.audio).toContain("brut.mp3");
    const rq = resultat.sorties[0].rapportQualite;
    expect(rq.verifie.son).toBe(false);
    expect(rq.verifie.droits).toBe(false);
    expect(messages(resultat).some((m) => m.includes("non mesuré"))).toBe(true);
    // AUTORISATION PERMANENTE (b) : avant ESS-6, une clé « …/tutoriel-4x5.jpg » était inventée alors qu'aucune vignette n'existe ; la valeur exacte est maintenant "" (aucune vignette).
    expect(resultat.sorties[0].vignetteCle).toBe("");
    expect(messages(resultat)).toContain("Vignette non produite");
  });

  it("2. allumé : mixage une fois, puis rendu, mesure, vignette par format", async () => {
    const j = journalVide();
    const { resultat, travail } = await mener(outils(j, { finitions: true }), commandeTutoriel());
    expect(travail.statut).toBe("termine");
    expect(ops(j)).toEqual(["mixage", "composition", "mesure-son", "miniature", "composition", "mesure-son", "miniature"]);
    const mixage = demandes(j)[0];
    expect(Object.keys(mixage.entrees)).toEqual(["voix"]);
    expect(mixage.file).toBe("longue");
    expect(mixage.sortie.cle).toMatch(/tutoriel-voix-mixee\.wav$/);
    expect(mixage.parametres).toMatchObject({ lufs: -14, creteVraieMaxDbtp: -1.5 });
    // La composition reçoit le WAV mixé, pas la voix brute.
    expect(demandes(j)[1].entrees.audio).toContain("tutoriel-voix-mixee.wav");
    expect(demandes(j)[4].entrees.audio).toContain("tutoriel-voix-mixee.wav");
    expect(demandes(j)[2].file).toBe("courte");
    expect(demandes(j)[2].entrees.media).toContain("tutoriel-4x5.mp4");
    expect(demandes(j)[3].entrees.video).toContain("tutoriel-4x5.mp4");
    expect(demandes(j)[3].parametres).toMatchObject({ gabarit: "image-video-v3" });
    expect("couverture" in demandes(j)[3].parametres).toBe(false);
    const rq = resultat.sorties[0].rapportQualite;
    expect(rq.niveauSonoreLufs).toBe(-14.1);
    expect(rq.verifie.son).toBe(true);
    expect(resultat.sorties[0].vignetteCle).toMatch(/tutoriel-4x5\.jpg$/);
    expect(messages(resultat)).not.toContain("Vignette non produite");
  });

  it("3. brique son coupée : pas de mixage, mais mesure et vignette", async () => {
    const j = journalVide();
    const c = commandeTutoriel({ briques: { ...commandeTutoriel().briques, son: false } });
    await mener(outils(j, { finitions: true }), c);
    expect(ops(j)).not.toContain("mixage");
    expect(ops(j)).toEqual(["composition", "mesure-son", "miniature", "composition", "mesure-son", "miniature"]);
    expect(demandes(j)[0].entrees.audio).toContain("brut.mp3");
  });

  it("4. mixage en échec définitif : vidéo livrée avec la voix brute et une réserve", async () => {
    const j = journalVide();
    const { travail, resultat } = await mener(outils(j, { finitions: true, mixageEnEchec: true }), commandeTutoriel());
    expect(travail.statut).toBe("termine");
    expect(ops(j).filter((o) => o === "mixage")).toHaveLength(1);
    expect(demandes(j).find((d) => d.operation === "composition")!.entrees.audio).toContain("brut.mp3");
    expect(messages(resultat).some((m) => m.includes("chaîne son"))).toBe(true);
  });

  it("5. mesure hors tolérance (−11) : alerte « attention », note baissée", async () => {
    const j = journalVide();
    const { resultat } = await mener(outils(j, { finitions: true, lufs: -11 }), commandeTutoriel());
    const rq = resultat.sorties[0].rapportQualite;
    expect(rq.niveauSonoreLufs).toBe(-11);
    expect(rq.verifie.son).toBe(false);
    const a = rq.alertes.find((x) => x.message.includes("niveau mesuré"));
    expect(a?.gravite).toBe("attention");
    // QUAL-4 : 62 = 100 − 8 (composition non vérifiée) − 3 × 10 (le niveau sonore hors tolérance et deux remarques de plan en « attention »).
    expect(rq.note).toBe(62);
    expect(resultat.noteQualite.globale).toBe(62);
  });

  it("6. reprise : un mixage fini ou une vignette faite n'est pas relancé", async () => {
    const j = journalVide();
    const o = outils(j, { finitions: true });
    const c = commandeTutoriel();
    const moteur = creerMoteurTutorielOutil({ outils: une(o) });
    let t = await moteur.lancer(c, { travailId: "t-fin", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    for (let i = 0; i < 600; i++) {
      t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
      if (t.statut === "termine") break;
    }
    expect(t.statut).toBe("termine");
    const avant = demandes(j).length;
    // Même état, étapes de rendu à refaire : rien n'est soumis de nouveau.
    const rejoue: Travail = { ...t, statut: "en_cours", etapes: t.etapes.map((e) => (e.cle === "montage" || e.cle === "exports" ? { ...e, statut: "en_attente" as const } : e)) };
    await moteur.avancer(rejoue, c, T0 + 900_000);
    expect(demandes(j).length).toBe(avant);
  });

  it("7. vidéo muette (aucune distribution) : pas de mixage ; mesure et vignette faites", async () => {
    const j = journalVide();
    const c = commandeTutoriel({ distribution: [] });
    const { resultat } = await mener(outils(j, { finitions: true }), c);
    expect(ops(j)).not.toContain("mixage");
    expect(ops(j)).toContain("mesure-son");
    expect(ops(j)).toContain("miniature");
    const rq = resultat.sorties[0].rapportQualite;
    expect(rq.verifie.son).toBe(false);
    expect(rq.alertes.find((a) => a.message.includes("sans voix"))?.gravite).toBe("info");
    // QUAL-4 : seules les remarques de plan (« Plan · … ») sont « attention » ; jamais 100 sans contrôle de composition passé.
    expect(rq.alertes.filter((a) => a.gravite === "attention").every((a) => a.message.startsWith("Plan · "))).toBe(true);
    expect(rq.note).toBe(72);
  });

  it("7b. vidéo muette : même note allumé et éteint", async () => {
    const c = commandeTutoriel({ distribution: [] });
    const allume = await mener(outils(journalVide(), { finitions: true }), c);
    const eteint = await mener(outils(journalVide()), c);
    expect(allume.resultat.sorties[0].rapportQualite.note).toBe(eteint.resultat.sorties[0].rapportQualite.note);
  });

  it("réexport : refait mixage, mesure et vignette du seul format", async () => {
    const j = journalVide();
    const o = outils(j, { finitions: true });
    const c = commandeTutoriel();
    const premier = await mener(o, c);
    const avant = demandes(j).length;
    const projetMontage = premier.resultat.projetMontage;
    const re = await premier.moteur.reexporter!({ commande: c, contexte: { travailId: "t-re", versionId: "ver-2", titre: "Tuto", maintenant: T0 }, cible: { ratio: "9:16" }, parent: { projetMontage } } as never);
    await mener(o, c, re);
    expect(demandes(j).slice(avant).map((d) => d.operation)).toEqual(["mixage", "composition", "mesure-son", "miniature"]);
  });
});
