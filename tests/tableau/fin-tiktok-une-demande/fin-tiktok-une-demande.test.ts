/**
 * FIN DE TIKTOK ET SHORTS, UNE SEULE DEMANDE (décision de Will du 14/10/2026) : le vertical « liens » ne finit plus sur
 * l'adresse du site sans rien dire. Il dit UNE demande courte, tirée de la banque commune (base 7), choisie selon le type
 * de la vidéo : méthode en étapes → « enregistrez » ; problème ou question → la question ; guide ou mot proposé → « le lien
 * est dans mon profil ». Jamais de promesse d'envoi, jamais plus de 12 mots dits, jamais deux demandes.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANQUE_APPELS, appelDeLaBanque } from "../../../src/briques/fins/banque";
import { OBJECTIFS_FIN_LIENS, choisirFinLiens, controlerFinLiens, finsLiensDeLaBanque, type IndicesFiche } from "../../../src/briques/fins/fin-liens";
import { estimerFabrication, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { finDeLaSortie, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { indicesDeLaFiche, planVoixSorties, SITE_FIN } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { fiche: FicheTableau };
const sorties = sortiesDesReseaux(["verticaux"]);
const choisirFin = choisirFinTableau({}, { sorties, mot: "REPONSES" });
const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

/** Le témoin « réponses types » : méthode en quatre étapes, avec le mot REPONSES. */
const reponsesTypes = temoin.fiche;
/** Le même, sans numéros d'étapes (« Un. », « Deux. »…) : le mot reste proposé. */
const sansEtapes = (f: FicheTableau): FicheTableau => ({ ...f, scenes: f.scenes.map((s) => ({ ...s, texteDit: s.texteDit.replace(/^(Un|Deux|Trois|Quatre)\. /, "") })) });
/** Une fiche qui part d'une question (structure « question de l'abonné »), sans étapes ; le mot des Reels reste. */
const avecQuestion = (): FicheTableau => ({ ...sansEtapes(temoin.fiche), structure: "question-abonne" });
const avecMot = () => sansEtapes(reponsesTypes);

/** La fin de TikTok et Shorts d'une fiche, comme la relecture et la fabrication la prennent. */
const finLiens = (f: FicheTableau) => finDeLaSortie("vertical-liens", choisirFin(f.appelId ?? null, "vertical-liens"), f);

describe("codes de la banque permis sur TikTok et Shorts", () => {
  it("public clients : la question, « enregistrez », « envoyez-la », « le lien est dans mon profil » ; rien d'autre", () => {
    expect(finsLiensDeLaBanque().map((a) => a.code)).toEqual(["fin-ty-question-tache", "fin-ty-question", "fin-ty-enregistrement", "fin-ty-envoi", "fin-ty-lien-profil"]);
    // Ni rendez-vous, ni « Abonnez-vous, le lien du guide… » (deux demandes, « abonnez-vous »).
    expect(finsLiensDeLaBanque().map((a) => a.code)).not.toContain("fin-ty-abonnement-lien");
    expect(finsLiensDeLaBanque().map((a) => a.code)).not.toContain("fin-ty-rdv-profil");
  });

  it("chaque fin permise : phrases de la base 7 au caractère près, une demande, ≤ 12 mots dits, ≤ 8 à l'écran, sans promesse d'envoi", () => {
    for (const p of ["public.clients", "public.apporteurs", "public.formateurs"] as const) {
      for (const a of finsLiensDeLaBanque(p)) {
        expect(BANQUE_APPELS).toContain(a);
        expect(OBJECTIFS_FIN_LIENS).toContain(a.objectif);
        expect(controlerFinLiens(a)).toEqual([]);
        expect(mots(a.dit)).toBeLessThanOrEqual(12);
        expect(mots(a.ecran)).toBeLessThanOrEqual(8);
      }
    }
  });

  it("les contrôles refusent une promesse d'envoi, deux demandes, « abonnez-vous », un mot à commenter", () => {
    expect(controlerFinLiens(appelDeLaBanque("fin-if-mot-envoi")!)).not.toEqual([]);
    expect(controlerFinLiens(appelDeLaBanque("fin-ty-abonnement-lien")!).join(" ")).toMatch(/abonnez|demandes/);
    expect(controlerFinLiens({ dit: "Enregistrez cette vidéo et envoyez-la à un collègue.", ecran: "Enregistrez" }).join(" ")).toMatch(/2 demandes/);
    expect(controlerFinLiens({ dit: "Le lien est dans mon profil, on vous envoie le guide.", ecran: "Lien" }).join(" ")).toMatch(/envoi/);
  });
});

describe("règle de choix, pure", () => {
  const rien: IndicesFiche = { etapes: false, mot: false, question: false, probleme: false };
  it("méthode en étapes → ENREGISTRER, même avec un mot", () => {
    expect(choisirFinLiens({ ...rien, etapes: true, mot: true })).toMatchObject({ objectif: "ENREGISTRER", code: "fin-ty-enregistrement" });
  });
  it("mot ou guide proposé → LIEN_PROFIL (« Le lien est dans mon profil. »)", () => {
    expect(choisirFinLiens({ ...rien, mot: true })).toMatchObject({ objectif: "LIEN_PROFIL", dit: "Le lien est dans mon profil." });
  });
  it("question et mot : la question d'abord (le mot des Reels est presque toujours là)", () => {
    expect(choisirFinLiens({ ...rien, question: true, mot: true })).toMatchObject({ objectif: "QUESTION" });
  });
  it("question ou problème → QUESTION ; sans question validée → ENREGISTRER", () => {
    expect(choisirFinLiens({ ...rien, question: true })).toMatchObject({ objectif: "QUESTION", code: "fin-ty-question-tache" });
    expect(choisirFinLiens({ ...rien, probleme: true })).toMatchObject({ objectif: "QUESTION" });
  });
  it("le réglage de la fiche force le choix", () => {
    expect(choisirFinLiens({ ...rien, etapes: true }, { force: "PARTAGER" })).toMatchObject({ objectif: "PARTAGER", code: "fin-ty-envoi" });
  });
  it("jamais deux demandes, jamais de promesse d'envoi, quels que soient le type et le réglage", () => {
    for (let n = 0; n < 16; n++) {
      const indices = { etapes: !!(n & 1), mot: !!(n & 2), question: !!(n & 4), probleme: !!(n & 8) };
      for (const force of [undefined, ...OBJECTIFS_FIN_LIENS]) {
        for (const p of ["public.clients", "public.apporteurs", "public.formateurs"] as const) {
          const f = choisirFinLiens(indices, { public: p, ...(force ? { force } : {}) });
          expect(f).not.toBeNull();
          expect(controlerFinLiens(f!)).toEqual([]);
        }
      }
    }
  });
});

describe("la fin de TikTok et Shorts d'une vraie fiche", () => {
  it("le témoin « réponses types » (étapes Un, Deux, Trois, Quatre ; mot REPONSES) → ENREGISTRER", () => {
    expect(indicesDeLaFiche(reponsesTypes)).toMatchObject({ etapes: true, mot: true });
    expect(finLiens(reponsesTypes)).toEqual({ id: "fin-ty-enregistrement", objectif: "ENREGISTRER", type: "enregistrement", dit: "Enregistrez cette vidéo pour la retrouver le jour venu.", ecran: "Enregistrez pour la retrouver" });
  });
  it("une fiche qui part d'une question (avec le mot des Reels) → QUESTION", () => {
    expect(finLiens(avecQuestion())).toMatchObject({ id: "fin-ty-question-tache", objectif: "QUESTION", dit: "Et chez vous, quelle tâche revient tous les jours ?" });
  });
  it("une fiche avec un mot à commenter, sans étapes → LIEN_PROFIL", () => {
    expect(finLiens(avecMot())).toMatchObject({ id: "fin-ty-lien-profil", objectif: "LIEN_PROFIL", dit: "Le lien est dans mon profil." });
  });
  it("le réglage de la fiche (entrées de la fabrication) force le choix", () => {
    const forcee = choisirFinTableau({}, { sorties, mot: "REPONSES", finLiens: "QUESTION" });
    expect(finDeLaSortie("vertical-liens", forcee(reponsesTypes.appelId ?? null, "vertical-liens"), reponsesTypes)).toMatchObject({ objectif: "QUESTION" });
    // Les Reels gardent leur fin au mot.
    expect(forcee(reponsesTypes.appelId ?? null, "vertical")).toMatchObject({ id: "fin-if-mot-envoi" });
  });
});

describe("branchée dans la variante « vertical-liens »", () => {
  const fins = (f: FicheTableau) => (id: (typeof sorties)[number]) => finDeLaSortie(id, choisirFin(f.appelId ?? null, id), f);

  for (const [nom, f, dit] of [
    ["réponses types", reponsesTypes, "Enregistrez cette vidéo pour la retrouver le jour venu."],
    ["question", avecQuestion(), "Et chez vous, quelle tâche revient tous les jours ?"],
    ["mot", avecMot(), "Le lien est dans mon profil."],
  ] as const) {
    it(`${nom} : la dernière scène dit la phrase, l'écrit en grand, puis le site ; une seule demande`, () => {
      const [reels, liens] = sortiesRelues(f, sorties, fins(f));
      expect(reels.fiche).toEqual(f);
      const derniere = liens.fiche.scenes.at(-1)!;
      expect(derniere.texteDit.endsWith(dit)).toBe(true);
      // Aucune autre demande : ni mot à commenter, ni promesse d'envoi, ni seconde phrase d'appel.
      const texte = derniere.texteDit;
      expect(texte).not.toMatch(/en commentaire|Je vous l.envoie|Écrivez/);
      expect(liens.fiche.scenes.flatMap((s) => s.ecrans ?? []).some((e) => e.motCommentaire)).toBe(false);
      const fin = fins(f)("vertical-liens")!;
      expect("ecran" in fin && liens.appel).toEqual({ site: true, phrase: "ecran" in fin ? fin.ecran : "" });
      expect(mots(dit)).toBeLessThanOrEqual(12);
      expect(SITE_FIN).toBe("axion-ia.com");
    });

    it(`${nom} : la phrase est lue à part, avec le surcoût annoncé`, () => {
      const plan = planVoixSorties(f, sorties.map((id) => ({ id, fin: fins(f)(id) })));
      expect(plan.mode).toBe("raccord");
      if (plan.mode !== "raccord") return;
      expect(plan.lectures.filter((l) => l.role === "fin").map((l) => l.texte)).toContain(dit);
      const liens = plan.variantes.find((v) => v.sorties.includes("vertical-liens"))!;
      expect(plan.lectures.find((l) => l.id === liens.fin)?.texte).toBe(dit);
      const e = estimerFabrication(f, 0.03, [], { sorties: sorties.map((id) => ({ id, fin: choisirFin(f.appelId ?? null, id) })) });
      expect(e.phraseSurcout).toMatch(/phrases de fin lues à part/);
    });
  }
});

describe("traçabilité : code de fin et objectif de la sortie TikTok et Shorts", () => {
  it("la vidéo de chaque sortie porte le code de sa fin ; TikTok et Shorts, son objectif", async () => {
    const d = doubles(reponsesTypes);
    const traces: { type: string; donnees: Record<string, unknown> }[] = [];
    const contexte = { aujourdhui: "2026-10-14", sourcesChiffres: [], preuves: [], matieres: [...new Set(reponsesTypes.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))].map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" })), texteScript: reponsesTypes.scenes.map((s) => s.texteDit).join(" ") };
    const fab = await fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin, dejaVu: { coche: true, le: "2026-10-14" }, tracer: async (e) => void traces.push(e as never) });
    const liens = fab.sorties.find((s) => s.format === "vertical-liens")!;
    expect(liens.fin).toMatchObject({ id: "fin-ty-enregistrement", objectif: "ENREGISTRER" });
    const videos = traces.filter((t) => t.type === "fichier" && t.donnees.role === "video");
    expect(videos.find((t) => t.donnees.formatSortie === "vertical-liens")?.donnees).toMatchObject({ codeFin: "fin-ty-enregistrement", objectifFin: "ENREGISTRER" });
    expect(videos.find((t) => t.donnees.formatSortie === "vertical")?.donnees).toMatchObject({ codeFin: "fin-if-mot-envoi" });
  }, 60_000);
});
