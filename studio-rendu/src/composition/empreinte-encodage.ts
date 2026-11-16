/**
 * Empreinte d'encodage (G11-01) : « ces deux vidéos se recollent-elles sans réencoder, oui/non, pourquoi ».
 * Fonctions PURES sur une sortie `ffprobe -show_streams -show_format -print_format json` : aucun `spawn`, aucun
 * accès disque, aucun import `@/…`. Ne lève jamais : un champ manquant rend le fichier « non recollable ».
 * La GOP fermée ne se lit pas dans `-show_streams` : si `closed_gop` manque, on le dit « non vérifié », sans l'inventer.
 */

export type FluxSonde = {
  codec_type?: string; codec_name?: string; profile?: string; pix_fmt?: string;
  width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; time_base?: string;
  color_space?: string; color_transfer?: string; color_primaries?: string; color_range?: string; field_order?: string;
  sample_rate?: string | number; channels?: number; channel_layout?: string; closed_gop?: number | string;
  [autre: string]: unknown;
};
export type SondeFfprobe = { streams?: FluxSonde[]; format?: Record<string, unknown> };
export type ResultatRecollage = { recollable: boolean; raisons: string[] };

const CHAMPS_VIDEO = ["codec_name", "profile", "pix_fmt", "width", "height", "r_frame_rate", "time_base",
  "color_space", "color_transfer", "color_primaries", "color_range", "field_order"] as const;
const CHAMPS_AUDIO = ["codec_name", "sample_rate", "channels", "channel_layout"] as const;

function flux(sonde: unknown, type: "video" | "audio"): FluxSonde | undefined {
  const s = (sonde as SondeFfprobe | null | undefined)?.streams;
  if (!Array.isArray(s)) return undefined;
  return s.find((f) => f && typeof f === "object" && f.codec_type === type);
}
const present = (v: unknown) => v !== undefined && v !== null && v !== "";
const texte = (v: unknown) => (present(v) ? String(v) : "?");

/** Chaîne stable décrivant l'encodage ; les champs absents s'écrivent « ? ». L'ordre des flux est sans effet. */
export function empreinteEncodage(sonde: SondeFfprobe): string {
  const v = flux(sonde, "video");
  const a = flux(sonde, "audio");
  const pv = CHAMPS_VIDEO.map((c) => `${c}=${texte(v?.[c])}`).join(",");
  const pa = a ? CHAMPS_AUDIO.map((c) => `${c}=${texte(a[c])}`).join(",") : "absent";
  return `video[${v ? pv : "absent"}];audio[${pa}]`;
}

/** Cadence lisible : « 30/1 » → « 30 », « 30000/1001 » → « 29.97 ». */
function cadence(r: unknown): string {
  const m = /^(\d+)\/(\d+)$/.exec(String(r ?? ""));
  if (!m || Number(m[2]) === 0) return texte(r);
  return String(Math.round((Number(m[1]) / Number(m[2])) * 100) / 100);
}

/** Champs manquants et conditions de base d'un fichier seul (h264, cadence constante, progressif, audio AAC si présent). */
function problemesDeBase(sonde: unknown, nom: string): string[] {
  const v = flux(sonde, "video");
  if (!v) return [`${nom} : aucune vidéo lisible`];
  const p: string[] = [];
  const manquants = CHAMPS_VIDEO.filter((c) => !present(v[c]));
  if (!present(v.avg_frame_rate)) manquants.push("avg_frame_rate" as never);
  if (manquants.length) p.push(`${nom} : informations manquantes (${manquants.join(", ")})`);
  if (present(v.codec_name) && v.codec_name !== "h264") p.push(`${nom} : vidéo en ${v.codec_name}, pas en h264`);
  if (present(v.r_frame_rate) && present(v.avg_frame_rate) && v.r_frame_rate !== v.avg_frame_rate)
    p.push(`${nom} : cadence variable`);
  if (present(v.field_order) && v.field_order !== "progressive") p.push(`${nom} : image entrelacée`);
  const a = flux(sonde, "audio");
  if (a) {
    const am = CHAMPS_AUDIO.filter((c) => !present(a[c]));
    if (am.length) p.push(`${nom} : audio, informations manquantes (${am.join(", ")})`);
    if (present(a.codec_name) && a.codec_name !== "aac") p.push(`${nom} : audio en ${a.codec_name}, pas en AAC`);
  }
  return p;
}

function nonVerifie(sonde: unknown, nom: string): string[] {
  const v = flux(sonde, "video");
  return v && !present(v.closed_gop) ? [`Non vérifié : GOP fermée de ${nom} (ffprobe ne l'indique pas)`] : [];
}

/** Un fichier : conditions de base. Deux fichiers : mêmes empreintes, une raison en français par différence. */
export function recollable(a: SondeFfprobe, b?: SondeFfprobe): ResultatRecollage {
  try {
    const nomA = b === undefined ? "fichier" : "premier fichier";
    const raisons = problemesDeBase(a, nomA);
    const notes = nonVerifie(a, nomA);
    if (b !== undefined) {
      raisons.push(...problemesDeBase(b, "second fichier"));
      notes.push(...nonVerifie(b, "second fichier"));
      const va = flux(a, "video"), vb = flux(b, "video");
      if (va && vb) {
        if (va.codec_name !== vb.codec_name) raisons.push(`codec vidéo ${texte(va.codec_name)} contre ${texte(vb.codec_name)}`);
        if (va.profile !== vb.profile) raisons.push(`profil ${texte(va.profile)} contre ${texte(vb.profile)}`);
        if (va.pix_fmt !== vb.pix_fmt) raisons.push(`format de pixels ${texte(va.pix_fmt)} contre ${texte(vb.pix_fmt)}`);
        if (va.width !== vb.width || va.height !== vb.height)
          raisons.push(`taille ${texte(va.width)}×${texte(va.height)} contre ${texte(vb.width)}×${texte(vb.height)}`);
        if (va.r_frame_rate !== vb.r_frame_rate) raisons.push(`cadence ${cadence(va.r_frame_rate)} contre ${cadence(vb.r_frame_rate)} i/s`);
        if (va.time_base !== vb.time_base) raisons.push(`base de temps ${texte(va.time_base)} contre ${texte(vb.time_base)}`);
        for (const [c, n] of [["color_space", "espace couleur"], ["color_transfer", "transfert couleur"],
          ["color_primaries", "primaires couleur"], ["color_range", "plage couleur"], ["field_order", "ordre des trames"]] as const)
          if (va[c] !== vb[c]) raisons.push(`${n} ${texte(va[c])} contre ${texte(vb[c])}`);
      }
      const aa = flux(a, "audio"), ab = flux(b, "audio");
      if (!!aa !== !!ab) raisons.push(`audio présent d'un seul côté (${aa ? "premier" : "second"} fichier seulement)`);
      else if (aa && ab) {
        if (aa.codec_name !== ab.codec_name) raisons.push(`codec audio ${texte(aa.codec_name)} contre ${texte(ab.codec_name)}`);
        if (String(aa.sample_rate) !== String(ab.sample_rate)) raisons.push(`échantillonnage audio ${texte(aa.sample_rate)} contre ${texte(ab.sample_rate)} Hz`);
        if (aa.channels !== ab.channels) raisons.push(`canaux audio ${texte(aa.channels)} contre ${texte(ab.channels)}`);
        if (aa.channel_layout !== ab.channel_layout) raisons.push(`disposition audio ${texte(aa.channel_layout)} contre ${texte(ab.channel_layout)}`);
      }
    }
    const unique = [...new Set(raisons)];
    return { recollable: unique.length === 0, raisons: [...unique, ...notes] };
  } catch {
    return { recollable: false, raisons: ["sortie ffprobe illisible"] };
  }
}
