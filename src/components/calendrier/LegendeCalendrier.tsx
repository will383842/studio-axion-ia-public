import { Icone } from "@/components/ui/Icone";
import { RESEAUX } from "@/reseaux";
import { RESEAUX_HORS_VIDEO } from "@/reseaux/hors-video";
import { MonogrammeReseau, styleReseau } from "./CarteEntreeCalendrier";
import { ETATS_CALENDRIER, PastilleStatutPlan } from "./PastilleStatutPlan";

/**
 * Légende du calendrier (maquette validée) : réseaux, états, verrou, créneau attendu. Le sens ne repose jamais sur la
 * couleur seule : chaque repère est écrit. Composant d'affichage, sans état ni appel.
 */
export function LegendeCalendrier() {
  return (
    <section aria-label="Légende" data-legende className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-doux">
      <b className="text-texte">Légende</b>
      {[...RESEAUX, ...RESEAUX_HORS_VIDEO].map((r) => (
        <span key={r.id} className="inline-flex items-center gap-1" style={styleReseau(r.id)}>
          <MonogrammeReseau reseau={r.id} taille="sm" />
          {r.nom}
        </span>
      ))}
      {ETATS_CALENDRIER.map((e) => (
        <PastilleStatutPlan key={e} etat={e} />
      ))}
      <span className="inline-flex items-center gap-1">
        <Icone nom="cadenas" size={12} />
        déjà partie ou passée
      </span>
      <span>Case en pointillé coloré = créneau attendu, encore vide</span>
    </section>
  );
}
