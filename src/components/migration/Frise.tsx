export type EtatJalon = "fait" | "en-cours" | "a-venir";
export interface Jalon {
  titre: string;
  date: string;
  note?: string;
  etat: EtatJalon;
}

export const JALONS: Omit<Jalon, "etat">[] = [
  { titre: "Instagram et Facebook", date: "ven. 6/11" },
  { titre: "LinkedIn page et profil", date: "dim. 8/11" },
  { titre: "TikTok", date: "mar. 10/11", note: "Aucun post à reprendre" },
  { titre: "Résiliation de Buffer", date: "mer. 18/11", note: "Par vous, dans Buffer" },
  { titre: "Prélèvement évité", date: "ven. 20/11" },
];
const JOURS_JALONS = ["2026-11-06", "2026-11-08", "2026-11-10", "2026-11-18", "2026-11-20"];

/** États déduits de la date du jour : passé = fait, premier à venir = en cours. */
export function jalonsPour(maintenant: Date): Jalon[] {
  const auj = maintenant.toISOString().slice(0, 10);
  const premier = JOURS_JALONS.findIndex((j) => j >= auj);
  return JALONS.map((j, i) => ({ ...j, etat: JOURS_JALONS[i] < auj ? "fait" : i === premier ? "en-cours" : "a-venir" }));
}

const LIBELLE: Record<EtatJalon, string> = { fait: "Fait", "en-cours": "En cours", "a-venir": "À venir" };

export function Frise({ jalons }: { jalons: Jalon[] }) {
  return (
    <section aria-labelledby="mig-frise" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
      <h2 id="mig-frise" className="text-lg text-texte">Bascule réseau par réseau</h2>
      <ol className="mt-3 grid gap-2">
        {jalons.map((j) => (
          <li key={j.titre} className="flex items-start gap-3 text-base sm:text-sm">
            <span aria-hidden className={`mt-1 size-3 shrink-0 rounded-full ${j.etat === "fait" ? "bg-sauge" : j.etat === "en-cours" ? "bg-orange" : "bg-trait-fort"}`} />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-texte">{j.titre}</span> · {j.date}
              {j.note && <span className="block text-texte-doux">{j.note}</span>}
            </span>
            <span className="shrink-0 text-texte-doux">{LIBELLE[j.etat]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
