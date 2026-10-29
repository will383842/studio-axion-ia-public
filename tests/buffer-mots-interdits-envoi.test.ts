/** Mots interdits à l'envoi vers Buffer : chaque mot seul est refusé (texte du post et premier commentaire). */
import { describe, expect, it } from "vitest";
import { entreeCreerPost, ErreurBuffer, PHRASES_BUFFER } from "@/fournisseurs/publication/buffer";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { CANAUX } from "./helpers/r1-buffer";

const VIDEO = "https://compte.r2.cloudflarestorage.com/seau/v.mp4?X-Amz-Expires=604800";
const INSTANT = Date.parse("2026-10-03T10:00:00.000Z");
const base = { reseau: "instagram" as const, texte: "Bonjour", date: "2026-10-05T07:00:00.000Z", fichierCle: VIDEO, canalId: CANAUX.instagram };
const J = (...p: string[]) => p.join("");

const MOTS = [J("cert", "ifié"), J("cert", "ifiée"), J("cert", "ifiés"), J("cert", "ification"), J("Quali", "opi"), J("CERT", "IFIÉ"), J("cert", "ifie"), J("QUALI", "OPI"), J("Cert", "ification")];

function refus(d: Partial<Parameters<typeof entreeCreerPost>[0]>) {
  try {
    entreeCreerPost({ ...base, ...d }, INSTANT);
  } catch (e) {
    return e as ErreurBuffer;
  }
  return null;
}

describe("texte du post", () => {
  it.each(MOTS)("%s seul : refusé avec un message clair", (mot) => {
    const e = refus({ texte: `Une formation ${mot} pour vous` });
    expect(e).toBeInstanceOf(ErreurBuffer);
    expect(e?.message).toBe(PHRASES_BUFFER.motInterditTexte);
  });
  it("texte propre accepté", () => {
    expect(refus({ texte: "Trois gestes simples pour gagner du temps." })).toBeNull();
  });
  it("un mot voisin n'est pas refusé", () => {
    expect(motsInterditsEnvoi("un certain jour")).toEqual([]);
  });
});

describe("premier commentaire", () => {
  it.each(MOTS)("%s seul : refusé avec un message clair", (mot) => {
    const e = refus({ premierCommentaire: `Voir ${mot}.` });
    expect(e).toBeInstanceOf(ErreurBuffer);
    expect(e?.message).toBe(PHRASES_BUFFER.motInterditCommentaire);
  });
  it("commentaire propre accepté", () => {
    expect(refus({ premierCommentaire: "Le lien : axion-ia.com" })).toBeNull();
  });
});

describe("autres interdits toujours actifs", () => {
  it("le nom de ville interdit dans le commentaire reste refusé", () => {
    expect(refus({ premierCommentaire: "Formation à Villeexemple" })).toBeInstanceOf(ErreurBuffer);
  });
  it("Aucun gain garanti reste refusé", () => {
    expect(refus({ premierCommentaire: "Aucun gain garanti" })?.message).toBe(PHRASES_BUFFER.commentaireInterdit);
  });
});
