/**
 * V4-2 · mission E : une fin par réseau (décision de Will du 14/10, « c'est la fin qu'il fallait faire attention »).
 * Une fabrication pour les quatre réseaux produit une sortie par groupe de réseaux de même fin, chacune avec la fin de
 * la banque pour CE réseau ; chaque sortie passe SÉPARÉMENT le contrôle de la fin de la voix ; un lien suivi par réseau.
 * Doubles seulement, aucun appel réel (voix simulée : les sons sont fabriqués ici).
 *
 * Écart avec les références v10 (`docs/formats/v4-reference/PUBLIER.md`), DIT et non corrigé : la banque validée
 * (`src/briques/fins/banque.ts`, à ne pas modifier) a remplacé le 12/10 « Le lien vous attend en premier commentaire » et
 * « Le lien est dans la bio » par « Le lien est en commentaire. » (Facebook), « Le lien est en premier commentaire. »
 * (LinkedIn) et « Le lien est dans mon profil. » (Instagram, TikTok). Facebook et LinkedIn ne disent donc pas
 * exactement la même phrase : trois sorties et non deux, tant que Will n'a pas tranché.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ErreurFabricationCasConcret, fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "../fabriquer/doubles";

/** WAV PCM 16 bits mono. */
function wav(x: Float32Array, frequence: number): Uint8Array {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(frequence, 24);
  b.writeUInt32LE(frequence * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return new Uint8Array(b);
}
/** Voix dite jusqu'au bout : 150 s qui s'éteignent doucement (0,3 s), puis 1 s de silence. */
function voixEntiere(): Uint8Array {
  const f = 8000;
  const x = new Float32Array(151 * f);
  for (let i = 0; i < 150 * f; i++) x[i] = 0.3 * Math.min(1, (150 - i / f) / 0.3) * Math.sin((2 * Math.PI * 200 * i) / f);
  return wav(x, f);
}
const COUPEE = new Uint8Array(readFileSync(join(__dirname, "sons/v4-fin-coupee.wav")));
const derniereFin = (texte: string) => texte.trim().split(/(?<=[.!?])\s+/).at(-1);

describe("V4-2 · une sortie par groupe de réseaux, chacune avec SA fin", () => {
  it("4 réseaux → Facebook « en commentaire », LinkedIn « en premier commentaire », Instagram et TikTok ensemble « dans mon profil »", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    const parReseaux = Object.fromEntries(cr.plan.fins.map((f) => [f.reseaux.join("+"), f.ecrans.map((e) => e.texteDit).join(" ")]));
    expect(Object.keys(parReseaux).sort()).toEqual(["facebook", "instagram+tiktok", "linkedin"]);
    expect(derniereFin(parReseaux.facebook)).toBe("Le lien est en commentaire.");
    expect(derniereFin(parReseaux.linkedin)).toBe("Le lien est en premier commentaire.");
    expect(derniereFin(parReseaux["instagram+tiktok"])).toBe("Le lien est dans mon profil.");
    // Le lien d'Instagram et de TikTok n'est jamais annoncé en commentaire (non cliquable là-bas), et inversement.
    expect(parReseaux["instagram+tiktok"]).not.toMatch(/commentaire/);
    for (const r of ["facebook", "linkedin"]) expect(parReseaux[r]).not.toMatch(/profil|bio/);
    // Une composition complète par sortie, et le texte de chaque sortie finit par SA fin.
    expect(cr.fins.map((f) => f.reseaux.join("+")).sort()).toEqual(["facebook", "instagram+tiktok", "linkedin"]);
    // Le texte dit de chaque composition, lu dans ses sous-titres (mot par mot).
    type Segments = { texte: { sousTitres: { segments: { mots: { mot: string }[] }[] } } };
    const dits = d.compositionsSoumises().map((c) => (c.parametres as Segments).texte.sousTitres.segments.flatMap((s) => s.mots.map((m) => m.mot)).join(" "));
    expect(dits).toHaveLength(3);
    expect(dits.filter((t) => t.endsWith("Le lien est dans mon profil."))).toHaveLength(1);
    expect(dits.filter((t) => t.endsWith("Le lien est en premier commentaire."))).toHaveLength(1);
    expect(dits.filter((t) => t.endsWith("Le lien est en commentaire."))).toHaveLength(1);
  });

  it("un réseau seul n'a que sa fin (Instagram : le profil)", async () => {
    const d = doubles({ reseaux: ["instagram"] });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(1);
    expect(derniereFin(cr.plan.fins[0].ecrans.map((e) => e.texteDit).join(" "))).toBe("Le lien est dans mon profil.");
  });

  it("liens suivis : un par réseau, `utm_source` du réseau, `utm_medium=video`, une campagne par réseau (code de version, ADR 0002)", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(Object.keys(cr.liens).sort()).toEqual(["facebook", "instagram", "linkedin", "tiktok"]);
    const campagnes = new Set<string>();
    for (const [r, lien] of Object.entries(cr.liens)) {
      const u = new URL(lien);
      expect(u.searchParams.get("utm_source")).toBe(r);
      expect(u.searchParams.get("utm_medium")).toBe("video");
      campagnes.add(u.searchParams.get("utm_campaign")!);
      // ADR 0002 : `utm_campaign` = code de version du réseau (« <numéro>-CC-<réseau> »), pas une campagne commune.
      expect(u.searchParams.get("utm_campaign")).toMatch(/^\d{4}-CC-[A-Z]{2}$/);
    }
    // Une campagne par réseau, toutes du même numéro de version.
    expect(campagnes.size).toBe(4);
    expect(new Set([...campagnes].map((c) => c.split("-")[0])).size).toBe(1);
  });

  it("`utm_content` = l'activité du PUBLIC VISÉ du cas (sa cible), non l'identifiant du cas", async () => {
    const d = doubles();
    // « recrutement-apporteurs » parle à un dirigeant (client) : son identifiant contient « apporteur », pas son public.
    expect(d.options.cas.id).toContain("apporteur");
    const cr = await fabriquerCasConcret(d.options);
    for (const lien of Object.values(cr.liens)) expect(new URL(lien).searchParams.get("utm_content")).toBe("clients");

    const formateurs = doubles();
    formateurs.options.cas = { ...formateurs.options.cas, cible: "Un formateur indépendant qui prépare ses sessions le soir." };
    const crF = await fabriquerCasConcret(formateurs.options);
    for (const lien of Object.values(crF.liens)) expect(new URL(lien).searchParams.get("utm_content")).toBe("formateurs");
  });
});

describe("V4-2 · le contrôle de la fin de la voix, sortie par sortie", () => {
  it("toutes les sorties dites jusqu'au bout : la fabrication passe", async () => {
    const d = doubles();
    const entiere = voixEntiere();
    d.options.outils.voix.lireSon = async (cle) => (d.assemblages.some((a) => a.sortieCle === cle) ? entiere : null);
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(3);
  });

  it("la voix coupée sur la SEULE sortie LinkedIn : cette sortie est refusée, nommée, à l'étape voix ; rien n'est rendu", async () => {
    const d = doubles();
    const entiere = voixEntiere();
    // Les assemblages de la recette suivent l'ordre du plan : Facebook, Instagram + TikTok, LinkedIn (les copies WAV des
    // sons bruts, faites avant pour mesurer leurs blancs, ne comptent pas).
    d.options.outils.voix.lireSon = async (cle) => {
      const i = d.assemblages.filter((a) => a.recette).findIndex((a) => a.sortieCle === cle);
      return i < 0 ? null : i === 2 ? COUPEE : entiere;
    };
    const err = await fabriquerCasConcret(d.options).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
    const e = err as ErreurFabricationCasConcret;
    expect(e.etape).toBe("voix");
    expect(e.raisons).toHaveLength(1);
    expect(e.raisons[0]).toMatch(/^Voix de la fin pour LinkedIn · .*coupée net.*Relancez la voix\.$/);
    expect(e.raisons[0]).not.toMatch(/Facebook|Instagram|TikTok/);
    expect(d.ecransSoumis()).toHaveLength(0);
  });
});
