/**
 * FINS PAR RÉSEAU (décision du propriétaire, 12/10/2026) : aucune vidéo ne part sur TikTok ni sur YouTube Shorts avec la
 * fin « Écrivez MOT en commentaire. Je vous l'envoie. ». Doubles seulement, aucun appel payant.
 *
 *  - réseaux cochés → sorties : un ou deux verticaux ;
 *  - la fin au mot est refusée pour TikTok et Shorts (garde-fou en code, même si la table change) ;
 *  - vidéo TikTok (14/10) : l'appel au mot n'est ni dit ni écrit ; UNE demande de la banque à sa place, puis `axion-ia.com` ;
 *  - voix : le corps lu UNE fois pour deux variantes, la phrase de fin à part ; repli à deux voix avec surcoût annoncé ;
 *  - scènes communes reprises du vertical : seule la dernière scène (et la composition) est refaite.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS, type FinTable } from "../../../src/briques/fins";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { partFilV2 } from "../../../src/briques/tableau-scene/v2/animation";
import { mots } from "../../../src/domaine/controles-script/texte";
import { estimerFabrication, fabriquerTableau, finDeLaSortie, FIN_SANS_APPEL_LIENS, type EvenementFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { descriptionSortie, sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { ficheDeVariante, planVoixSorties, trouverAppel } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { appelsValides, estFinAuMot, finDuTableau, finEtAppelDuTableau, reseauDeLaSortie } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

const APPEL = "Écrivez CINQ en commentaire. Je vous l'envoie.";
/** Fins telles que les services les rendent (table réelle, mot saisi « CINQ »). */
const finsReelles = (table: readonly FinTable[] = TABLE_FINS) => (appelId: string | null, sortie: IdSortie) => finEtAppelDuTableau(reseauDeLaSortie(sortie, {}, ["vertical", "vertical-liens"]), appelId, table, { mot: "CINQ" });
const ficheAvecAppel = (): FicheTableau => ({ ...ficheFormation(), appelId: "fin-if-mot-envoi" });
/** Demande de TikTok et Shorts de la fiche « formation » (méthode en étapes, 14/10) : « enregistrez ». */
const DEMANDE = "Enregistrez cette vidéo pour la retrouver le jour venu.";
const FIN_TIKTOK = { id: "fin-ty-enregistrement", ecran: "Enregistrez pour la retrouver", dit: DEMANDE, type: "enregistrement", objectif: "ENREGISTRER" };

describe("réseaux cochés → sorties", () => {
  it("« verticaux » couvre les deux groupes : deux verticaux ; un seul groupe coché : un seul vertical", () => {
    expect(sortiesDesReseaux(["verticaux"])).toEqual(["vertical", "vertical-liens"]);
    expect(sortiesDesReseaux(["reels-stories"])).toEqual(["vertical"]);
    expect(sortiesDesReseaux(["instagram", "facebook"])).toEqual(["vertical"]);
    expect(sortiesDesReseaux(["tiktok"])).toEqual(["vertical-liens"]);
    // T5 (décision 1 du 18/10) : LinkedIn en 4:5 sans la fin au mot (avant : le carré).
    expect(sortiesDesReseaux(["youtube-shorts", "linkedin"])).toEqual(["vertical-liens", "portrait-linkedin"]);
    expect(sortiesDesReseaux(["instagram", "tiktok"])).toEqual(["vertical", "vertical-liens"]);
  });

  it("chaque vertical dit ses réseaux exacts ; mêmes dimensions ; le vertical seul garde tous les réseaux d'avant", () => {
    const deux: IdSortie[] = ["vertical", "vertical-liens"];
    expect(descriptionSortie("vertical", deux).reseaux.map((r) => r.libelle)).toEqual(["Reels Instagram", "Reels Facebook", "Stories Instagram et Facebook"]);
    expect(descriptionSortie("vertical-liens", deux).reseaux.map((r) => r.libelle)).toEqual(["TikTok", "YouTube Shorts"]);
    expect(descriptionSortie("vertical-liens", deux)).toMatchObject({ largeur: 1080, hauteur: 1920, ratio: "9:16" });
    expect(descriptionSortie("vertical", ["vertical"]).reseaux).toHaveLength(5);
    expect(descriptionSortie("vertical", ["vertical"]).libelle).toBe("Vertical 9:16");
  });
});

describe("fin au mot refusée pour TikTok et Shorts", () => {
  it("table réelle : TikTok et Shorts n'ont aucune fin validée → sans appel, avec l'alerte ; Instagram garde la fin au mot", () => {
    for (const r of ["tiktok", "youtube-shorts"] as const) {
      expect(finDuTableau(r, "fin-if-mot-envoi", TABLE_FINS, { mot: "cinq" })).toEqual({ absente: FIN_SANS_APPEL_LIENS });
      expect(finDuTableau(r, "fin-ty-mot-envoi", TABLE_FINS, { mot: "cinq" })).toEqual({ absente: FIN_SANS_APPEL_LIENS });
      expect(appelsValides(r)).toEqual([]);
    }
    expect(finDuTableau("instagram", "fin-if-mot-envoi", TABLE_FINS, { mot: "cinq" })).toEqual({ id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire" });
    expect(finDuTableau("youtube", "fin-if-mot-envoi", TABLE_FINS, { mot: "cinq" })).toEqual({ id: "fin-ty-mot-envoi", ecran: "Écrivez CINQ en commentaire" });
    expect(FIN_SANS_APPEL_LIENS).toMatch(/^Fin sans appel pour TikTok et Shorts : phrase à valider/);
  });

  it("garde-fou EN CODE : même si la table rend la fin au mot permise sur TikTok, elle est refusée avec un message clair", () => {
    const trafiquee = TABLE_FINS.map((f) => (f.id === "fin-ty-mot-envoi" ? { ...f, reseaux: undefined } : f));
    const r = finDuTableau("tiktok", "fin-ty-mot-envoi", trafiquee, { mot: "cinq" });
    expect(r).toHaveProperty("absente");
    expect((r as { absente: string }).absente).toMatch(/jamais utilisée sur TikTok ni sur YouTube Shorts/);
    expect(appelsValides("tiktok", trafiquee)).toEqual([]);
    expect(estFinAuMot(TABLE_FINS.find((f) => f.id === "fin-ty-mot-envoi")!)).toBe(true);
    // Le moteur refuse aussi, quoi que rendent les services.
    expect(finDeLaSortie("vertical-liens", { id: "fin-ty-mot-envoi", ecran: "Écrivez CINQ en commentaire", type: "commentaire", mot: "CINQ" })).toEqual({ absente: FIN_SANS_APPEL_LIENS });
    expect(finDeLaSortie("vertical-liens", { id: "x", ecran: "Commentez CINQ" })).toEqual({ absente: FIN_SANS_APPEL_LIENS });
    expect(finDeLaSortie("vertical", { id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire" })).toEqual({ id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire" });
  });

  it("la fin sans promesse d'envoi, une fois validée, est choisie pour TikTok et Shorts (et dite)", () => {
    const validee = TABLE_FINS.map((f) => (f.id === "fin-ty-lien-profil" ? { ...f, validee: true } : f));
    expect(finEtAppelDuTableau("tiktok", "fin-if-mot-envoi", validee, { mot: "cinq" })).toEqual({ id: "fin-ty-lien-profil", ecran: "Le lien est dans mon profil", dit: "Le lien est dans mon profil.", type: "lien" });
    expect(finEtAppelDuTableau("youtube-shorts", null, validee)).toMatchObject({ id: "fin-ty-lien-profil" });
    // Jamais pour Instagram (autre groupe), ni pour YouTube (réseaux de la ligne).
    expect(finDuTableau("youtube", "fin-ty-lien-profil", validee)).toHaveProperty("absente");
  });
});

describe("variante de fiche et plan des voix (purs)", () => {
  const fiche = ficheAvecAppel();

  it("l'appel est trouvé à la fin de la dernière scène, mot pour mot", () => {
    const a = trouverAppel(fiche, APPEL)!;
    expect(a).toMatchObject({ scene: fiche.scenes.length - 1, enFin: true, texte: APPEL });
    expect(trouverAppel(fiche)).toMatchObject({ enFin: true, texte: APPEL });
  });

  it("la fiche sans appel : l'appel n'est ni dit ni écrit, les ancres restent dans le texte", () => {
    const v = ficheDeVariante(fiche, trouverAppel(fiche, APPEL));
    const derniere = v.scenes.at(-1)!;
    expect(derniere.texteDit).not.toMatch(/commentaire|envoie/i);
    expect(derniere.texteDit.endsWith("tient sur une page.")).toBe(true);
    expect(JSON.stringify(derniere.elements)).not.toMatch(/commentaire/i);
    expect(derniere.ecrans?.at(-1)).toMatchObject({ moment: "appel" });
    expect(derniere.ecrans?.at(-1)).not.toHaveProperty("motCommentaire");
    const n = mots(derniere.texteDit).length;
    for (const e of derniere.elements) if ("ancre" in e) expect(e.ancre).toBeLessThan(n);
    // Les autres scènes ne changent pas.
    expect(v.scenes.slice(0, -1)).toEqual(fiche.scenes.slice(0, -1));
  });

  it("deux variantes : le corps lu UNE fois, la phrase d'appel à part ; le vertical de TikTok réutilise le corps seul", () => {
    const plan = planVoixSorties(fiche, [
      { id: "vertical", fin: { id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire", dit: APPEL, type: "commentaire", mot: "CINQ" } },
      { id: "vertical-liens", fin: { absente: FIN_SANS_APPEL_LIENS } },
    ]);
    expect(plan.mode).toBe("raccord");
    if (plan.mode !== "raccord") return;
    expect(plan.lectures.map((l) => [l.role, l.texte.slice(-30)])).toEqual([
      ["corps", "cinq jours tient sur une page."],
      ["fin", APPEL.slice(-30)],
    ]);
    expect(plan.variantes).toEqual([expect.objectContaining({ id: "principale", base: "corps", fin: "fin-1", sorties: ["vertical"] }), expect.objectContaining({ id: "vertical-liens", base: "corps", sorties: ["vertical-liens"] })]);
    expect(plan.variantes[1].fin).toBeUndefined();
  });

  it("une seule sortie qui dit l'appel de la fiche : la voix unique d'avant", () => {
    expect(planVoixSorties(fiche, [{ id: "vertical" }, { id: "portrait" }]).mode).toBe("unique");
  });

  it("LinkedIn (14/10) : le carré ne dit jamais l'appel au mot ; il réutilise le corps seul, comme TikTok", () => {
    const plan = planVoixSorties(fiche, [
      { id: "vertical", fin: { id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire", dit: APPEL, type: "commentaire", mot: "CINQ" } },
      { id: "carre", fin: { id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire", dit: APPEL, type: "commentaire", mot: "CINQ" } },
    ]);
    expect(plan.mode).toBe("raccord");
    if (plan.mode !== "raccord") return;
    expect(plan.variantes.map((v) => v.sorties)).toEqual([["vertical"], ["carre"]]);
    expect(plan.variantes[1].fin).toBeUndefined();
  });

  it("estimation : le raccord ne coûte que la demande de TikTok en plus, annoncée ; le repli annonce son surcoût", () => {
    const sorties = [
      { id: "vertical" as const, fin: { id: "fin-if-mot-envoi", ecran: "Écrivez CINQ en commentaire", dit: APPEL } },
      { id: "vertical-liens" as const, fin: { absente: FIN_SANS_APPEL_LIENS } },
    ];
    const unique = estimerFabrication(fiche, 0.03);
    const raccord = estimerFabrication(fiche, 0.03, [], { sorties });
    // 14/10 : la demande de TikTok et Shorts est lue à part (seul surcoût), et le surcoût est annoncé.
    expect(raccord.caracteres).toBeLessThanOrEqual(unique.caracteres + DEMANDE.length);
    expect(raccord.phraseSurcout).toMatch(/phrases de fin lues à part/);
    // L'appel n'est plus à la fin : une voix complète par fin, surcoût annoncé AVANT tout appel.
    const s = fiche.scenes.at(-1)!;
    const deplacee: FicheTableau = { ...fiche, scenes: [...fiche.scenes.slice(0, -1), { ...s, texteDit: `${s.texteDit} À bientôt.` }] };
    const repli = estimerFabrication(deplacee, 0.03, [], { sorties });
    expect(repli.surcoutCentimes).toBeGreaterThan(0);
    expect(repli.centimes).toBeGreaterThan(estimerFabrication(deplacee, 0.03).centimes);
    expect(repli.phraseSurcout).toMatch(/surcoût/);
    expect(repli.lectures?.map((l) => l.role)).toEqual(["complete", "complete"]);
  });
});

describe("écran de fin sans appel (mise en page « blocs/2 »)", () => {
  it("l'écran d'appel ne montre que axion-ia.com, sans mot à commenter ; avec une fin validée, sa phrase au-dessus", () => {
    const fiche = ficheDeVariante(ficheAvecAppel(), trouverAppel(ficheAvecAppel(), APPEL));
    const ecran = mettreEnPage(fiche, { appel: { site: true } }).styleV2!.ecrans.at(-1)!;
    expect(ecran.gabarit).toBe("appel-site");
    const textes = ecran.textes.filter((t) => !t.horsContenu).map((t) => t.texte);
    expect(textes).toEqual(["axion-ia.com"]);
    expect(ecran.textes.some((t) => /commentaire|CINQ/i.test(t.texte))).toBe(false);
    // Pas de seconde signature en grand après la voix.
    expect(ecran.textes.some((t) => t.id === "signature-fin")).toBe(false);
    const avec = mettreEnPage(ficheDeVariante(ficheAvecAppel(), trouverAppel(ficheAvecAppel(), APPEL), "Le lien est dans mon profil."), { appel: { site: true, phrase: "Le lien est dans mon profil" } }).styleV2!.ecrans.at(-1)!;
    expect(avec.textes.filter((t) => !t.horsContenu).map((t) => t.texte).join(" ")).toMatch(/^LE LIEN EST DANS MON PROFIL axion-ia\.com$/);
  });

  it("fil de progression : continu au raccord, plein à la fin de la voix", () => {
    const depart = { ms: 50_000, part: 50_000 / 60_000 };
    expect(partFilV2(25_000, 57_000, depart)).toBeCloseTo(25_000 / 60_000, 6);
    expect(partFilV2(50_000, 57_000, depart)).toBeCloseTo(depart.part, 6);
    expect(partFilV2(57_000, 57_000, depart)).toBe(1);
    expect(partFilV2(30_000, 60_000)).toBe(0.5);
  });
});

describe("fabrication à deux verticaux (doubles, aucun appel payant)", async () => {
  const fiche = ficheAvecAppel();
  const d = doubles(fiche);
  const traces: EvenementFabrication[] = [];
  const lectures: string[] = [];
  const voix = d.outils.voix.voix();
  const r = await fabriquerTableau({
    ...d.outils,
    contexte: contexteFormation(),
    sorties: ["vertical", "vertical-liens"],
    choisirFin: finsReelles(),
    voix: { ...d.outils.voix, voix: () => ({ ...voix, lire: (demande) => (lectures.push(demande.texte), voix.lire(demande)) }) },
    tracer: async (e) => {
      traces.push(e);
    },
  });
  const scenes = d.scenesSoumises().map((s) => (s.parametres as { proprietes: ProprietesTableauScene }).proprietes);
  const recettes = d.soumises.filter((x) => x.operation === "nettoyage-audio");

  it("deux fichiers verticaux, identiques sauf la fin, chacun avec ses réseaux exacts", () => {
    expect(r.sorties.map((s) => [s.format, s.largeur, s.hauteur])).toEqual([
      ["vertical", 1080, 1920],
      ["vertical-liens", 1080, 1920],
    ]);
    expect(r.sorties[0].reseaux).toEqual(["Reels Instagram", "Reels Facebook", "Stories Instagram et Facebook"]);
    expect(r.sorties[1].reseaux).toEqual(["TikTok", "YouTube Shorts"]);
    expect(r.sorties[0].cles.video).not.toBe(r.sorties[1].cles.video);
    expect(d.compositionsSoumises()).toHaveLength(2);
  });

  it("le corps n'est lu qu'UNE fois ; la phrase d'appel à part ; la demande du TikTok à part", () => {
    expect(lectures).toHaveLength(3);
    expect(lectures.filter((t) => t.includes("Vous avez essayé"))).toHaveLength(1);
    expect(lectures[1]).toBe(APPEL);
    expect(lectures[2]).toBe(DEMANDE);
    // Deux recettes : chacune raccorde sa fin au corps (deux entrées).
    expect(recettes).toHaveLength(2);
    expect(recettes[0].entrees.audio2).toBeDefined();
    expect(recettes[1].entrees.audio2).toBeDefined();
    const morceaux = (recettes[0].parametres as { morceaux: { source: number; silence?: boolean }[] }).morceaux;
    expect(morceaux.some((m) => m.source === 1)).toBe(true);
  });

  it("vidéo TikTok : l'appel au mot n'est ni dit ni écrit ; UNE demande, écrite en grand au-dessus du site ; aucune alerte", () => {
    const tiktok = r.sorties[1];
    expect(tiktok.fin).toEqual(FIN_TIKTOK);
    expect(tiktok.alertes ?? []).toEqual([]);
    expect(r.alertes?.some((a) => a.message === FIN_SANS_APPEL_LIENS) ?? false).toBe(false);
    const compo = d.compositionsSoumises()[1];
    expect(JSON.stringify(compo.parametres)).not.toMatch(/commentaire|envoie/i);
    const derniere = scenes.filter((p) => p.scene.id === fiche.scenes.at(-1)!.id);
    expect(derniere).toHaveLength(2);
    const ecranTikTok = derniere[1].v2!.ecrans.at(-1)!;
    expect(ecranTikTok.gabarit).toBe("appel-site");
    expect(ecranTikTok.textes.some((t) => /CINQ|commentaire/i.test(t.texte))).toBe(false);
    expect(ecranTikTok.textes.filter((t) => !t.horsContenu).map((t) => t.texte).join(" ")).toMatch(/^ENREGISTREZ POUR LA RETROUVER axion-ia\.com$/i);
    expect(derniere[1].v2!.mots?.some((m) => /commentaire|envoie/i.test(m.mot))).toBe(false);
    expect(derniere[1].v2!.mots?.map((m) => m.mot).join(" ")).toMatch(/Enregistrez cette vidéo pour la retrouver le jour venu\.$/);
    // L'Instagram garde la fin au mot (dite et écrite).
    expect(derniere[0].v2!.ecrans.at(-1)!.textes.some((t) => t.texte === "CINQ")).toBe(true);
    expect(derniere[0].v2!.mots?.some((m) => /commentaire/i.test(m.mot))).toBe(true);
  });

  it("le TikTok finit 2,5 s après son dernier mot, puis 0,4 s de fondu", () => {
    const derniere = scenes.filter((p) => p.scene.id === fiche.scenes.at(-1)!.id)[1];
    expect(derniere.v2!.finVideoMs - derniere.v2!.finVoixMs).toBe(2_900);
  });

  it("les scènes communes ne sont rendues qu'une fois : seule la dernière scène du TikTok est rendue en plus", () => {
    const n = fiche.scenes.length;
    expect(scenes).toHaveLength(n + 1);
    expect(r.sorties[1].scenes.rendues).toEqual([fiche.scenes.at(-1)!.id]);
    expect(r.sorties[1].scenes.reprises).toHaveLength(n - 1);
    for (const s of fiche.scenes.slice(0, -1)) expect(r.sorties[1].cles.scenes[s.id]).toBe(r.sorties[0].cles.scenes[s.id]);
    expect(r.sorties[1].cles.scenes[fiche.scenes.at(-1)!.id]).not.toBe(r.sorties[0].cles.scenes[fiche.scenes.at(-1)!.id]);
    // Le fil de la dernière scène du TikTok repart d'où il en était.
    const derniere = scenes.at(-1)!;
    expect(derniere.v2!.filDepart?.ms).toBe(derniere.scene.debutMs);
  });

  it("traçabilité : un événement « voix » par lecture, avec son coût exact", () => {
    const morceaux = traces.filter((t) => t.type === "voix" && t.cle.startsWith("voix-morceau:"));
    expect(morceaux.map((t) => t.donnees.morceau)).toEqual(["corps", "fin", "fin"]);
    for (const t of morceaux) expect(typeof t.donnees.coutCentimes).toBe("number");
    expect(r.coutVoixCentimes).toBe(morceaux.reduce((s, t) => s + (t.donnees.coutCentimes as number), 0));
  });

  it("une relance reprend tout : aucune voix relue, aucune scène rendue", async () => {
    const avant = lectures.length;
    const scenesAvant = d.scenesSoumises().length;
    const r2 = await fabriquerTableau({ ...d.outils, contexte: contexteFormation(), sorties: ["vertical", "vertical-liens"], choisirFin: finsReelles(), voix: { ...d.outils.voix, voix: () => ({ ...voix, lire: (demande) => (lectures.push(demande.texte), voix.lire(demande)) }) } });
    expect(lectures.length).toBe(avant);
    expect(d.scenesSoumises().length).toBe(scenesAvant);
    expect(r2.coutCentimes).toBe(0);
  });
});

describe("fins identiques sur toutes les sorties : rien ne change", async () => {
  it("vertical seul (Instagram) : une voix complète, comme avant", async () => {
    const d = doubles(ficheAvecAppel());
    const r = await fabriquerTableau({ ...d.outils, contexte: contexteFormation(), sorties: ["vertical"], choisirFin: finsReelles() });
    expect(d.lectures()).toBe(1);
    expect(r.sorties.map((s) => s.format)).toEqual(["vertical"]);
    expect(r.sorties[0].reseaux).toHaveLength(5);
    expect(d.journal.valeur?.lectures).toBeUndefined();
  });

  it("vertical de TikTok seul : le corps et sa demande, sans l'appel au mot", async () => {
    const d = doubles(ficheAvecAppel());
    const r = await fabriquerTableau({ ...d.outils, contexte: contexteFormation(), sorties: ["vertical-liens"], choisirFin: finsReelles() });
    expect(d.lectures()).toBe(2);
    expect(r.sorties[0].fin).toEqual(FIN_TIKTOK);
    expect(JSON.stringify(d.compositionsSoumises()[0].parametres)).not.toMatch(/commentaire|envoie/i);
  });
});

describe("repli : l'appel n'est pas à la fin de la dernière scène", async () => {
  const base = ficheAvecAppel();
  const s = base.scenes.at(-1)!;
  // « Je vous l'envoie. » suivi d'une autre phrase : le corps ne peut pas être isolé.
  const fiche: FicheTableau = { ...base, scenes: [...base.scenes.slice(0, -1), { ...s, texteDit: s.texteDit.replace("Je vous l'envoie.", "Je vous l'envoie. Bonne semaine.") }] };
  const contexte = { ...contexteFormation(), texteScript: fiche.scenes.map((x) => x.texteDit).join(" ") };
  const d = doubles(fiche);
  const avancement: string[] = [];
  const reservations: number[] = [];
  const r = await fabriquerTableau({
    ...d.outils,
    contexte,
    sorties: ["vertical", "vertical-liens"],
    choisirFin: finsReelles(),
    avancement: (l) => avancement.push(l),
    budget: { ...d.outils.budget, verifierEtReserver: async (e) => void reservations.push(e.centimes) },
  });

  it("deux voix complètes, surcoût annoncé avant la première lecture ; l'appel retiré du TikTok, la phrase suivante gardée", () => {
    expect(d.lectures()).toBe(2);
    expect(r.estimation.surcoutCentimes).toBeGreaterThan(0);
    expect(avancement.findIndex((l) => /surcoût/.test(l))).toBeGreaterThanOrEqual(0);
    expect(reservations.reduce((a, b) => a + b, 0)).toBe(r.estimation.centimes);
    expect(r.sorties[1].fin).toEqual(FIN_TIKTOK);
    const recettes = d.soumises.filter((x) => x.operation === "nettoyage-audio");
    expect(recettes.every((x) => !x.entrees.audio2)).toBe(true);
  });
});
