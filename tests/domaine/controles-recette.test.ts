/** Lot A3 : contrôles de recette C96 à C99 (ALERTES) et C95 (positionnement) sur un script fautif et deux témoins. */
import { describe, expect, it } from "vitest";
import { codesLeves, controlerVersion, NIVEAUX, type EntreeControle } from "@/domaine/controles-script";
import { phrasesDe } from "@/domaine/lecture";
import { bloc, seg } from "../helpers/g3";
import { versionV4 } from "../helpers/v4";

/** Le texte découpé en phrases : la 1re est l'accroche, la dernière l'appel (sauf `sansAppel`), le reste est le corps. */
function script(texte: string, options: { sansAppel?: boolean; auteur?: "machine" | "will"; boucle?: boolean; adresse?: "tu" | "vous"; motCle?: string } = {}) {
  return versionV4(options.auteur ?? "machine", (e: EntreeControle) => {
    const ph = phrasesDe(texte);
    const premiere = ph[0];
    const appel = options.sansAppel ? undefined : ph.at(-1);
    const corps = ph.slice(1, options.sansAppel ? undefined : -1);
    e.ouverture = [bloc("accroche", seg("t0", premiere, { nature: "fait", marqueurs: [] }))];
    e.corps = [bloc("coeur", ...corps.map((t, i) => seg(`t${i + 1}`, t, { nature: "fait", marqueurs: [] })))];
    e.fin = appel ? [bloc("appel", seg("tf", appel, { nature: "fait", marqueurs: [] }))] : [];
    e.horodatageReel = undefined;
    e.debit = 2.75;
    e.boucle = options.boucle ?? false;
    e.adresse = options.adresse ?? "vous";
    if (options.motCle) e.motCle = options.motCle;
  });
}
const RECETTE_CODES = ["C95", "C96", "C97", "C98", "C99"];
const leves = (e: EntreeControle) => codesLeves(controlerVersion(e)).filter((c) => RECETTE_CODES.includes(c));

const FAUTIF =
  "Votre collaboratrice s'absente lundi, et ses dossiers s'arrêtent avec elle. Ses clients appellent et personne ne sait où en est leur dossier. " +
  "Un. Listez les dossiers de chaque collaborateur. Deux. Cochez les dossiers sans remplaçant. Trois. Écrivez trois lignes en tête de chaque dossier coché. " +
  "Un dossier connu d'une seule personne s'arrête avec elle, lundi.";

const TEMOIN_A =
  "Un client appelle. Le seul qui connaît son dossier est en congé. Alors on fouille sa boîte mail. On rappelle le client pour lui reposer ses questions. Et il le sent. " +
  "Chez vous, qui saurait reprendre ce dossier sans appeler un collègue en vacances ? Un dossier peut se reprendre sans personne pour l'expliquer. " +
  "À chaque mail, à chaque appel, une automatisation écrit trois lignes dans la fiche du client. Où en est le dossier. Ce qui a été promis. La prochaine étape. " +
  "Prenons un cabinet comptable. Avant, le remplaçant cherchait partout. Maintenant, il lit trois lignes et rappelle le client, sans lui reposer de question. " +
  "Ces fiches, on les met en place pour vous, de bout en bout. Réservez un appel de diagnostic.";

const TEMOIN_B =
  "Le classeur le plus précieux de votre entreprise, c'est la tête de votre assistante. Le jour où elle tombe malade, vous ne savez plus quel devis attend une réponse. Les clients relancent. Vous improvisez. " +
  "Combien de vos clients dépendent d'une seule mémoire ? Ce qu'elle sait peut rester dans l'entreprise, même quand elle s'absente. " +
  "Chaque devis, chaque relance, chaque promesse faite au téléphone est noté automatiquement dans un tableau partagé. Qui, quoi, pour quand. Elle n'a rien à écrire en plus. " +
  "Prenons un artisan. Son assistante s'absente une semaine. Il ouvre le tableau, voit les devis en attente et rappelle les bons clients. " +
  "Ce tableau, on l'installe et on le fait tourner pour vous. Écrivez DOSSIER en commentaire.";

describe("contrôles de recette (C96 à C99) et positionnement (C95)", () => {
  it("niveaux : alertes côté machine, information côté Will ; C95 reste bloquant", () => {
    for (const c of ["C96", "C97", "C98", "C99"]) expect(NIVEAUX[c], c).toEqual({ machine: "alerte", will: "info" });
    expect(NIVEAUX.C95.machine).toBe("bloquant");
  });
  it("le script fautif lève C95, C96, C97 et C98", () => {
    expect(leves(script(FAUTIF, { sansAppel: true }))).toEqual(expect.arrayContaining(["C95", "C96", "C97", "C98"]));
  });
  it("les tutoriels, l'absence de question et l'absence de rupture sont des alertes (jamais bloquantes)", () => {
    const r = controlerVersion(script(FAUTIF, { sansAppel: true }));
    for (const c of ["C96", "C97", "C98", "C99"]) {
      const v = r.violations.find((x) => x.controle === c);
      expect(v?.niveau, c).toBe("alerte");
      expect(v?.bloquant, c).toBe(false);
    }
  });
  it("le témoin A ne lève rien", () => expect(leves(script(TEMOIN_A))).toEqual([]));
  it("le témoin B ne lève rien", () => expect(leves(script(TEMOIN_B))).toEqual([]));
  it("C98 est ignoré pour une vidéo en boucle", () => {
    expect(leves(script(FAUTIF, { sansAppel: true, boucle: true }))).not.toContain("C98");
  });
  it("un texte écrit par Will reste au barème Will : la violation existe côté machine, elle n'est pas bloquante côté Will", () => {
    const m = controlerVersion(script(FAUTIF, { sansAppel: true, auteur: "machine" }));
    const w = controlerVersion(script(FAUTIF, { sansAppel: true, auteur: "will" }));
    for (const c of ["C95", "C96", "C97", "C98"]) {
      expect(m.violations.some((v) => v.controle === c), `${c} côté machine`).toBe(true);
      const v = w.violations.find((x) => x.controle === c);
      expect(v, `${c} côté Will`).toBeDefined();
      expect(v!.bloquant, c).toBe(false);
    }
    expect(w.violations.find((x) => x.controle === "C96")?.niveau).toBe("info");
  });
  it("C97 relève aussi plus de deux questions", () => {
    const t = TEMOIN_A.replace("Et il le sent.", "Et il le sent ? Vraiment ? Vous le savez ?");
    expect(leves(script(t))).toContain("C97");
  });
  it("C96 : des questions et une inversion ne font pas un tutoriel ; trois impératifs qui ne se suivent pas non plus", () => {
    const t = "Un client attend. Savez-vous combien de devis dorment ? Avez-vous déjà perdu un client ? Voulez-vous le voir ? Alors on s'en occupe pour vous. Réservez un appel.";
    expect(leves(script(t))).not.toContain("C96");
    const eloigne = "Un client attend. Imaginez lundi matin. Votre assistante est absente. Envoyez-la à votre DAF. Chez vous, qui reprend ses dossiers ? Alors on s'en occupe pour vous. Réservez un appel.";
    expect(leves(script(eloigne))).not.toContain("C96");
    const suite = "Un client attend. Listez les dossiers. Cochez ce qui manque. Écrivez trois lignes. Chez vous, qui reprend ses dossiers ? Alors on s'en occupe pour vous. Réservez un appel.";
    expect(leves(script(suite))).toContain("C96");
  });
  it("C98 : les racines du mot-clé ne comptent pas comme une redite", () => {
    const t = "Vos devis d'électricien dorment dans une boîte mail. Un client attend. Chez vous, qui relance ? Un devis d'électricien dort dans la boîte mail. Réservez un appel.";
    expect(leves(script(t, { motCle: "devis d'électricien" }))).not.toContain("C98");
    expect(leves(script(t))).toContain("C98");
  });
  it("C99 : « c'est coûteux pour vous » n'est pas une rupture ; apostrophe typographique reconnue", () => {
    const faux = "Un client attend. Chez vous, qui répond ? C'est coûteux pour vous. Réservez un appel.";
    expect(leves(script(faux))).toContain("C99");
    const vrai = "Un client attend. Chez vous, qui répond ? Ces fiches, on les met en place pour vous. Réservez un appel.";
    expect(leves(script(vrai))).not.toContain("C99");
    const typo = "Un client attend. Chez vous, qui répond ? Ce tableau, on l’installe pour vous. Réservez un appel.";
    expect(leves(script(typo))).not.toContain("C99");
  });
  it("en « tu » : la question en « tu » compte, la rupture « pour toi » compte, une suite d'impératifs sans -ez est un tutoriel", () => {
    const ok = "Un client attend ta réponse. Sais-tu qui reprend tes dossiers ? Ces fiches, on les met en place pour toi. Réserve un appel.";
    expect(leves(script(ok, { adresse: "tu" }))).toEqual([]);
    const tuto = "Un client attend ta réponse. Liste les dossiers. Coche ce qui manque. Écris trois lignes. Sais-tu qui reprend tes dossiers ? On s'en occupe pour toi. Réserve un appel.";
    expect(leves(script(tuto, { adresse: "tu" }))).toContain("C96");
    expect(leves(script(tuto, { adresse: "vous" }))).not.toContain("C96");
  });
  it("C97 contrôle le moment : la question doit tomber dans les premiers 40 % du texte dit", () => {
    const tard = "Un client attend sa réponse. Le seul qui connaît son dossier est en congé. Alors on fouille sa boîte mail. On rappelle le client pour lui reposer ses questions. Et il le sent. Les relances partent en retard. Les devis dorment dans la boîte. Chez vous, qui reprend ses dossiers ? Ces fiches, on les met en place pour vous. Réservez un appel.";
    const t = controlerVersion(script(tard)).violations.find((v) => v.controle === "C97");
    expect(t?.niveau).toBe("alerte");
    expect(t?.message).toMatch(/40 %/);
    const tot = "Un client attend sa réponse. Chez vous, qui reprend ses dossiers ? Le seul qui connaît son dossier est en congé. Alors on fouille sa boîte mail. On rappelle le client pour lui reposer ses questions. Et il le sent. Ces fiches, on les met en place pour vous. Réservez un appel.";
    expect(leves(script(tot))).not.toContain("C97");
  });
});
