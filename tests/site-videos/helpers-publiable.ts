/** Une vidéo prête dont tous les contrôles passent, et de quoi fabriquer des MP4 de test. Les `vi.mock` sont ceux du fichier de test. */
const enc = new TextEncoder();

function atome(type: string, corps: number): Uint8Array {
  const o = new Uint8Array(8 + corps);
  new DataView(o.buffer).setUint32(0, o.length);
  o.set(enc.encode(type), 4);
  return o;
}

/** Octets d'un faux MP4 : `moov` avant `mdat` (lecture immédiate) ou après. */
export function mp4Test(moovAvant: boolean): Uint8Array {
  const parties = moovAvant ? [atome("ftyp", 12), atome("moov", 200), atome("mdat", 2000)] : [atome("ftyp", 12), atome("mdat", 2000), atome("moov", 200)];
  const o = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parties) {
    o.set(p, i);
    i += p.length;
  }
  return o;
}

export const REGLAGES_TOUT_FAUX = { certifexempleCertificationObtenue: false, avisPublies: false };

/** Autorise le générateur de la vidéo, remplit la page, coche les cases : la vidéo passe tous les contrôles. */
export async function preparerVideoPublicable(videoId = "v-01", options: { formatId?: string; miniatureId?: string } = {}): Promise<void> {
  const { depots } = await import("@/donnees/memoire");
  const site = await import("@/services/site-videos");
  const pub = await import("@/services/publications");
  const video = (await depots().videos.obtenir(videoId))!;
  await site.definirSiteGenerateur(options.formatId ?? video.formatId, true);
  await depots().miniatures.modifier(options.miniatureId ?? `${videoId}-mini-1`, { ratio: "16:9" });
  await pub.obtenirKit(videoId);
  await site.modifierPasseport(videoId, {
    titreWeb: `Sujet de la vidéo ${videoId}`,
    aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun outil à payer."],
    questions: [
      { question: "Faut-il un logiciel ?", reponse: "Non, un modèle suffit." },
      { question: "Combien de temps ?", reponse: "Dix minutes." },
    ],
    rubrique: "Automatisation",
    motsCles: ["devis"],
  });
  for (const k of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, k, true);
  await site.cocherSurLeSite(videoId, true);
  await site.cocherAucunClient(videoId, true);
}
