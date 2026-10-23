import { describe, expect, it } from "vitest";
import { formatAvocat } from "@/formats/avocat";
import { accrochesSimulees, noterScriptSync } from "@/fournisseurs/simulation/script";
import type { BlocScript } from "./types";
import { contientMotConcret, noterAccroche, noterScriptDetaille, parleAuSpectateur, typeAccroche } from "./notation-script";

const CTX = { adresse: "vous" as const, sujet: "Contester un PV de stationnement", motsParSeconde: 4.4, zones: { vert: [25, 40] as [number, number], orange: [40, 50] as [number, number] } };
const bloc = (blocRecette: string, ...textes: string[]): BlocScript => ({ id: blocRecette, blocRecette, segments: textes.map((texte, i) => ({ id: `${blocRecette}-${i}`, texte })) });

const BON: BlocScript[] = [
  bloc("accroche", "Vous recevez un PV de stationnement ? Ne le payez pas tout de suite."),
  bloc("promesse", "Je vous explique comment le contester en trois étapes."),
  bloc("coeur", "D'abord, regardez la date.", "Ensuite, vérifiez la plaque.", "Enfin, demandez la photo.", "Une erreur, et le PV tombe.", "C'est votre droit, pas une faveur."),
  bloc("preuve", "L'an dernier, un client a récupéré 135 € et trois points grâce à ce détail."),
  bloc("appel", "Gardez cette vidéo, elle vous servira le jour où le PV arrive dans votre boîte aux lettres."),
  bloc("boucle", "Et surtout, ne payez jamais un PV de stationnement tout de suite."),
];

describe("note d'un script et de ses accroches (B.9 bis, v3.2)", () => {
  it("accroche : bonus si elle parle au spectateur (selon tu / vous) et si elle contient un mot concret du sujet", () => {
    const concrete = noterAccroche("Vous recevez un PV de stationnement ?", CTX);
    const vague = noterAccroche("Il y a une chose que tout le monde ignore sur ce sujet.", CTX);
    expect(concrete.parleAuSpectateur).toBe(true);
    expect(concrete.motConcret).toBe(true);
    expect(vague.parleAuSpectateur).toBe(false);
    expect(vague.motConcret).toBe(false);
    expect(concrete.note - vague.note).toBeGreaterThanOrEqual(20);
    // Le tutoiement est reconnu quand la vidéo est en « tu », et l'inverse ne compte pas.
    expect(parleAuSpectateur("Tu reçois un PV ?", "tu")).toBe(true);
    expect(parleAuSpectateur("Tu reçois un PV ?", "vous")).toBe(false);
    expect(parleAuSpectateur("Évitez ce piège.", "vous")).toBe(true);
    expect(parleAuSpectateur("Évite ce piège.", "tu")).toBe(true);
  });

  it("accroche : « parle au spectateur » compte aussi dans la promesse si elle arrive avant 5 s", () => {
    expect(noterAccroche("Un PV de stationnement sur deux est contestable.", CTX, "Je vous explique comment.").parleAuSpectateur).toBe(true);
  });

  it("accroche trop longue, introduction ou formule générale : note réduite", () => {
    const courte = noterAccroche("Vous recevez un PV de stationnement ?", CTX).note;
    expect(noterAccroche("Bonjour à tous, aujourd'hui je vais vous parler des PV de stationnement.", CTX).note).toBeLessThan(courte - 15);
    expect(noterAccroche("Vous recevez un PV de stationnement et vous ne savez pas du tout comment faire pour le contester devant le tribunal ?", CTX).note).toBeLessThan(courte);
    expect(contientMotConcret("Neuf personnes sur dix se trompent sur ce point", CTX.sujet)).toBe(false);
    expect(contientMotConcret("Le PV de 135 € que tout le monde paie", CTX.sujet)).toBe(true);
  });

  it("types d'accroche reconnus (apprentissage)", () => {
    expect(typeAccroche("67 000 € récupérés grâce à un détail")).toBe("chiffre-choc");
    expect(typeAccroche("L'erreur que tout le monde fait au contrôle")).toBe("erreur-commune");
    expect(typeAccroche("Surtout, ne le payez pas.")).toBe("contre-intuitif");
    expect(typeAccroche("Peut-on refuser une mutation ?")).toBe("question");
  });

  it("critères notés : un bon script dépasse 80 sur chacun, sans bandeau « à renforcer »", () => {
    const n = noterScriptDetaille(BON, formatAvocat.recetteScript.criteres.map((c) => c.id), CTX);
    for (const [id, v] of Object.entries(n.criteres)) expect(v, id).toBeGreaterThanOrEqual(80);
    expect(n.aRenforcer).toEqual([]);
  });

  it("preuve absente, plusieurs appels, boucle absente : notes faibles et bandeau « à renforcer » sous 70 (jamais bloquant)", () => {
    const faible = BON.filter((b) => b.blocRecette !== "preuve" && b.blocRecette !== "boucle").map((b) => (b.blocRecette === "appel" ? bloc("appel", "Abonnez-vous, commentez et partagez cette vidéo.") : b));
    const n = noterScriptDetaille(faible, formatAvocat.recetteScript.criteres.map((c) => c.id), CTX);
    expect(n.criteres.preuve).toBeLessThan(40);
    expect(n.criteres.boucle).toBeLessThan(40);
    expect(n.criteres.appel).toBeLessThan(70);
    expect(n.aRenforcer[0]).toBe("preuve");
    const note = noterScriptSync(faible, formatAvocat.recetteScript, 30, "vous", CTX.sujet);
    expect(note.criteres.preuve).toBeLessThan(40);
  });

  it("densité : une phrase au-delà de 5,5 mots/s est signalée et pèse sur la clarté", () => {
    const n = noterScriptDetaille(BON, ["clarte"], { ...CTX, motsParSeconde: 6.5 });
    expect(n.phrasesDenses.length).toBeGreaterThan(0);
    expect(n.criteres.clarte).toBeLessThan(noterScriptDetaille(BON, ["clarte"], CTX).criteres.clarte);
  });

  it("durée par zones : vert 25-40 s (pleine note), orange 40-50 s, faible au-delà", () => {
    const texte = (mots: number) => [bloc("coeur", Array.from({ length: mots }, () => "mot").join(" ") + ".")];
    const duree = (s: number) => noterScriptDetaille(texte(Math.round(s * 4.4)), ["duree"], CTX).criteres.duree;
    expect(duree(30)).toBe(100);
    expect(duree(45)).toBe(70);
    expect(duree(60)).toBe(40);
  });

  it("accroches proposées : notées, triées, la justification dit pourquoi ; en tu et en vous", () => {
    const vous = accrochesSimulees("Contester un PV de stationnement", 5, "vous");
    expect(vous).toHaveLength(5);
    for (let i = 1; i < vous.length; i++) expect(vous[i - 1].note).toBeGreaterThanOrEqual(vous[i].note);
    expect(new Set(vous.map((a) => a.type)).size).toBe(5);
    expect(vous[0].justification).toMatch(/spectateur/);
    const tu = accrochesSimulees("Contester un PV de stationnement", 5, "tu");
    expect(tu.some((a) => /\b(fais|évite)\b/i.test(a.texte))).toBe(true);
  });
});
