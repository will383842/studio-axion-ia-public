/**
 * RACCORDS DU 11/10 (moteur) : réseaux cochés → formats de sortie dédoublonnés, transmis par le moteur à la chaîne
 * (une voix pour toutes, prix inchangé) ; fin de chaque sortie dans son groupe de réseaux, avec le mot à commenter ;
 * traçabilité écrite par la chaîne (version du code, voix et recette, heure de début des étapes, fichiers, contrôles,
 * lien vers la trace du script). Doubles seulement : aucun appel.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "../../../src/moteurs/types";
import { TABLE_FINS } from "../../../src/briques/fins";
import { lireEntreesTableau } from "../../../src/moteurs/montage-tableau/etapes";
import { fabriquerTableau, versionDuCode, type EvenementFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { finDuTableau, reseauDeLaSortie } from "../../../src/services/tableau-fin";
import { copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";
import { banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 11, 9, 0, 0);

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 300; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

describe("réseaux → formats de sortie", () => {
  it("chaque réseau a son format ; doublons retirés, ordre de la table ; aucun réseau connu : le vertical", () => {
    // « verticaux » couvre Reels et stories ET TikTok et Shorts : deux verticaux (12/10), identiques sauf la fin.
    expect(sortiesDesReseaux(["linkedin", "verticaux", "verticaux", "youtube", "fil-instagram-facebook"])).toEqual(["vertical", "vertical-liens", "portrait", "portrait-linkedin", "horizontal"]); // T5 : LinkedIn en 4:5 (avant : carré)
    expect(sortiesDesReseaux(["youtube", "youtube"])).toEqual(["horizontal"]);
    expect(sortiesDesReseaux([])).toEqual(["vertical"]);
    expect(sortiesDesReseaux(["inconnu"])).toEqual(["vertical"]);
  });

  it("les entrées de la vidéo portent les sorties (lecture tolérante), le mot et la trace du script", () => {
    expect(lireEntreesTableau({ tableau: { ficheScenesCle: "c", sorties: ["carre", "carre", "rond", 3], mot: " GUIDE ", traceScriptId: "tst-1" } } as never)).toEqual({ ficheScenesCle: "c", sorties: ["carre"], mot: "GUIDE", traceScriptId: "tst-1" });
    expect(lireEntreesTableau({ tableau: { ficheScenesCle: "c", sorties: ["rond"] } } as never)).toEqual({ ficheScenesCle: "c" });
  });

  it("le moteur transmet les sorties à la chaîne : une vidéo par format, une seule voix, prix inchangé", async () => {
    const b = banc(ficheDemonstration);
    const simple = b.commande(ficheDemonstration);
    const c = { ...simple, entrees: { tableau: { ...(simple.entrees.tableau as object), sorties: ["vertical", "carre", "carre"] } } };
    expect((await b.moteur.estimer(c)).lignes).toEqual((await b.moteur.estimer(simple)).lignes);
    const t = await b.moteur.lancer(c, { travailId: "t-sorties", versionId: "ver-sorties", titre: "Essai", maintenant: T0 });
    const fin = await jusquAuBout(b.moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
    expect(b.d.compositionsSoumises()).toHaveLength(2);
    const r = fin.resultat!;
    expect(r.sorties.map((s) => [s.ratio, s.resolution])).toEqual([
      ["9:16", "1080x1920"],
      ["1:1", "1080x1080"],
    ]);
    expect(new Set(r.sorties.map((s) => s.fichierCle)).size).toBe(2);
    const projet = r.projetMontage.tableau as { sorties: { format: string; reseaux: string[] }[] };
    expect(projet.sorties.map((s) => s.format)).toEqual(["vertical", "carre"]);
    expect(projet.sorties[1].reseaux).toContain("LinkedIn");
    expect(r.lignesReelles.filter((l) => l.etape === "Voix")).toHaveLength(1);
  });
});

describe("fin de chaque sortie, avec le mot à commenter", () => {
  it("une fin choisie dans un groupe est rendue dans le groupe de la sortie, mot rempli", () => {
    // LinkedIn (14/10) : aucun appel à commenter dit dans la vidéo.
    expect(finDuTableau("linkedin", "fin-if-mot-envoi", TABLE_FINS, { mot: "guide" })).toEqual({ absente: expect.stringMatching(/^Aucun appel à commenter n'est dit dans une vidéo LinkedIn/) });
    expect(finDuTableau("youtube", "fin-if-mot-envoi", TABLE_FINS, { mot: "guide" })).toEqual({ id: "fin-ty-mot-envoi", ecran: "Écrivez GUIDE en commentaire" });
    // L'appel de diagnostic n'est pas validé : aucune fin, dit clairement.
    expect(finDuTableau("linkedin", "fin-if-diagnostic", TABLE_FINS)).toHaveProperty("absente");
  });

  it("le réseau de la fin d'une sortie est l'un de ceux qu'elle sert", () => {
    expect(reseauDeLaSortie("vertical", { reseaux: ["instagram"] })).toBe("instagram");
    expect(reseauDeLaSortie("carre", { reseaux: ["instagram"] })).toBe("linkedin");
    expect(reseauDeLaSortie("horizontal", {})).toBe("youtube");
    expect(reseauDeLaSortie("portrait", { reseaux: ["tiktok"] })).toBe("instagram");
  });

  it("la chaîne demande la fin pour chaque sortie et dessine le mot à l'écran de chacune", async () => {
    const fiche = { ...copie(ficheDemonstration), appelId: "fin-if-mot-envoi" };
    const d = doubles(fiche);
    const demandes: [string | null, string][] = [];
    const r = await fabriquerTableau({
      ...d.outils,
      sorties: ["vertical", "carre"],
      choisirFin: (appelId, sortie) => (demandes.push([appelId, sortie]), finDuTableau(reseauDeLaSortie(sortie, {}), appelId, TABLE_FINS, { mot: "guide" })),
    });
    expect(demandes).toEqual([
      ["fin-if-mot-envoi", "vertical"],
      ["fin-if-mot-envoi", "carre"],
    ]);
    expect(r.sorties.map((s) => s.fin)).toEqual([{ id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire" }, { absente: expect.stringMatching(/LinkedIn/) }]);
    // L'écran de fin du vertical écrit la phrase avec le mot ; le carré de LinkedIn n'en a pas (14/10).
    const finsRendues = d.scenesSoumises().filter((x) => (x.parametres as { proprietes: { scene: { id: string } } }).proprietes.scene.id === "fin");
    expect(finsRendues).toHaveLength(1);
    for (const f of finsRendues) expect(JSON.stringify(f.parametres)).toMatch(/"texte":"[^"]*GUIDE[^"]*"/);
  });
});

describe("traçabilité écrite par la chaîne", () => {
  async function fabriquerEnTracant(extra: Partial<Parameters<typeof fabriquerTableau>[0]> = {}) {
    const d = doubles(copie(ficheDemonstration));
    const evenements: EvenementFabrication[] = [];
    let t = T0;
    const r = await fabriquerTableau({ ...d.outils, sorties: ["vertical", "portrait"], horloge: () => (t += 1000), versionCode: "abc1234", traceScriptId: "tst-42", tracer: async (e) => void evenements.push(e), ...extra });
    return { d, r, evenements };
  }

  it("la trace de la voix garde son vrai débit (mots par minute), sans rien refuser", async () => {
    const { r, evenements } = await fabriquerEnTracant();
    expect(r.dureeSec).toBeGreaterThan(0);
    const voix = evenements.filter((e) => e.type === "voix")[0].donnees as { motsParSeconde?: number; motsParMinute?: number };
    expect(voix.motsParSeconde).toBeGreaterThan(0);
    expect(Number.isInteger(voix.motsParMinute)).toBe(true);
    expect(voix.motsParMinute).toBe(Math.round((voix.motsParSeconde as number) * 60));
  });

  it("version du code, voix et réglages de la recette, heure de début de chaque étape, fichiers, contrôles, lien du script", async () => {
    const { r, evenements } = await fabriquerEnTracant();
    const de = (type: string) => evenements.filter((e) => e.type === type);
    expect(de("code")).toEqual([expect.objectContaining({ donnees: expect.objectContaining({ commit: "abc1234", chaine: "fabrication-tableau/1" }) })]);
    expect(de("script")[0].donnees).toMatchObject({ traceScriptId: "tst-42", lien: "/tableau/traces/tst-42" });
    const voix = de("voix")[0].donnees;
    expect(voix).toMatchObject({ idVoix: "voix-williams", reglages: { vitesse: 1 }, recetteAppliquee: true, recette: { id: "voix-tableau/3" } });
    // Chaque étape faite, avec son heure de début (date de l'événement et `debut`).
    const etapes = de("etape").map((e) => e.donnees as { etape: string; debut: string; sortie?: string });
    for (const nom of ["fiche", "script", "voix", "calage", "mise-en-page", "fin", "scenes", "composition", "controles"]) expect(etapes.some((e) => e.etape === nom), nom).toBe(true);
    for (const e of de("etape")) expect(e.date).toBe((e.donnees as { debut: string }).debut);
    expect(etapes.filter((e) => e.etape === "composition").map((e) => e.sortie ?? "vertical")).toEqual(["vertical", "portrait"]);
    // Chaque fichier : format et empreinte ; la vidéo de chaque sortie.
    const videos = de("fichier").filter((e) => e.donnees.role === "video");
    expect(videos.map((e) => [e.donnees.formatSortie, e.donnees.format])).toEqual([
      ["vertical", "9:16"],
      ["portrait", "4:5"],
    ]);
    for (const f of de("fichier")) expect(f.donnees.empreinte, String(f.donnees.chemin)).toMatch(/^([a-z]+-)?[0-9a-f]{32}$/);
    expect(de("fichier").some((e) => e.donnees.role === "voix")).toBe(true);
    // Verdict des contrôles de chaque sortie.
    expect(de("controle").map((e) => [e.donnees.formatSortie, e.donnees.verdict])).toEqual(r.sorties.map((s) => [s.format, s.controles.verdict]));
    // Jamais de montant : le coût reste compté une seule fois (reconstruction depuis le journal).
    expect(evenements.every((e) => e.centimes === undefined)).toBe(true);
    // Clés uniques (un fait = un événement).
    expect(new Set(evenements.map((e) => e.cle)).size).toBe(evenements.length);
  });

  it("une trace qui ne s'écrit pas n'arrête pas la fabrication ; sans commit connu : « inconnu »", async () => {
    const { r } = await fabriquerEnTracant({ tracer: async () => Promise.reject(new Error("base indisponible")) });
    expect(r.sorties).toHaveLength(2);
    expect(versionDuCode({})).toBe("inconnu");
    expect(versionDuCode({ GIT_COMMIT: " 9f8e7d " })).toBe("9f8e7d");
  });
});
