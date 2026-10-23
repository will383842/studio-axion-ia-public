/**
 * Les 12 illustrations maison I01…I12 : de petites SCÈNES composées autour des objets d'un cabinet, jamais de personne
 * ni de visage, jamais de texte.
 * Composition commune : un plan de fond pâle à motif discret (points ou quadrillage crème), l'objet principal avec son
 * épaisseur ou sa face d'ombre en aplat, des objets de premier plan, une ombre portée au sol et quelques étincelles.
 * Traits : contour `TRAIT`, détails `FIN`, matière (bois, reflets, plis) `MICRO`.
 * Propriété d'Axion-IA (dessinées dans ce dépôt) ; couleurs : `palette.ts`, par défaut celles de la charte.
 */
import { Cadre, FIN, MICRO, type ProprietesIllustration } from "./Cadre";
import { Etincelle, FondArche, FondDisque, Ombre } from "./Decor";

/** Point à `rayon` du centre, `angle` en degrés depuis midi, sens horaire. */
function polaire(cx: number, cy: number, rayon: number, angle: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [cx + rayon * Math.sin(a), cy - rayon * Math.cos(a)];
}

/** I01 — bureau : écran avec tableau de bord, loupe au premier plan, tasse fumante. */
export function I01({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={94} r={82} />
        <Etincelle x={34} y={38} r={8} couleur={p.orange} />
        <Etincelle x={170} y={28} r={5} couleur={p.encre} />
        {/* Plateau en bois : dessus orange veiné, chant en encre, pieds. */}
        <path d="M30 168V190M170 168V190" />
        <rect x="12" y="148" width="176" height="14" rx="4" fill={p.orange} />
        <path d="M26 155H62M86 154H112M136 156H174" stroke={p.pale} strokeWidth={MICRO} />
        <rect x="18" y="162" width="164" height="7" rx="2" fill={p.encre} stroke="none" />
        {/* Écran : pied, coque d'encre, dalle papier avec reflet. */}
        <rect x="84" y="122" width="16" height="22" fill={p.pale} />
        <rect x="62" y="142" width="60" height="7" rx="3.5" fill={p.papier} />
        <rect x="26" y="30" width="132" height="96" rx="10" fill={p.encre} />
        <rect x="35" y="39" width="114" height="74" rx="3" fill={p.papier} stroke="none" />
        <path d="M104 39H126L92 113H70Z" fill={p.creme} stroke="none" />
        <circle cx="92" cy="120" r="2" fill={p.pale} stroke="none" />
        <path d="M46 54H80" strokeWidth={FIN} />
        <rect x="46" y="64" width="34" height="8" rx="4" fill={p.pale} stroke="none" />
        <rect x="46" y="78" width="24" height="8" rx="4" fill={p.pale} stroke="none" />
        <rect x="46" y="92" width="30" height="8" rx="4" fill={p.orange} stroke="none" />
        <path d="M96 104H140" strokeWidth={MICRO} />
        <rect x="100" y="84" width="9" height="20" rx="2" fill={p.pale} strokeWidth={MICRO} />
        <rect x="114" y="72" width="9" height="32" rx="2" fill={p.orange} strokeWidth={MICRO} />
        <rect x="128" y="58" width="9" height="46" rx="2" fill={p.orange} strokeWidth={MICRO} />
        {/* Tasse fumante. */}
        <path d="M27 112C23 106 31 102 27 96M38 112C34 106 42 102 38 96" strokeWidth={FIN} />
        <path d="M46 128C57 128 57 144 46 144" />
        <rect x="18" y="120" width="28" height="28" rx="6" fill={p.papier} />
        <path d="M18 130H46" stroke={p.orange} strokeWidth="6" strokeLinecap="butt" />
        <rect x="18" y="120" width="28" height="28" rx="6" />
        {/* Loupe au premier plan. */}
        <path d="M160 132L184 156" strokeWidth="16" />
        <path d="M166 138L183 155" stroke={p.orange} strokeWidth="7" />
        <circle cx="142" cy="112" r="28" fill={p.papier} />
        <circle cx="142" cy="112" r="21" stroke={p.orange} strokeWidth={FIN} />
        <path d="M127 107A16 16 0 0 1 138 96" stroke={p.pale} strokeWidth="5" />
      </>
    )} />
  );
}

/** I02 — panneau directionnel en bois au bout d'un chemin en pointillés. */
export function I02({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondArche p={p} x={22} y={14} l={156} h={156} />
        <circle cx="136" cy="50" r="13" fill={p.papier} stroke="none" />
        <Etincelle x={42} y={44} r={7} couleur={p.orange} />
        <Etincelle x={170} y={124} r={5} couleur={p.encre} />
        <Ombre cx={100} cy={178} rx={44} couleur={p.pale} />
        <path d="M18 196C46 186 66 190 84 180" strokeWidth={FIN} strokeDasharray="0.5 9" />
        {/* Poteau veiné et socle. */}
        <rect x="93" y="40" width="14" height="136" rx="3" fill={p.orange} />
        <path d="M100 96V118M100 140V164" stroke={p.pale} strokeWidth={MICRO} />
        <rect x="90" y="32" width="20" height="10" rx="5" fill={p.encre} stroke="none" />
        <rect x="80" y="170" width="40" height="10" rx="4" fill={p.encre} stroke="none" />
        {/* Panneau vers la droite : chant d'encre, face papier, chevrons. */}
        <path d="M50 52H150L172 72L150 92H50Z" fill={p.encre} stroke="none" transform="translate(0 7)" />
        <path d="M50 52H150L172 72L150 92H50Z" fill={p.papier} />
        <path d="M118 62L128 72L118 82M134 62L144 72L134 82" stroke={p.orange} strokeWidth="5" />
        <path d="M64 72H102" strokeWidth={FIN} />
        <circle cx="100" cy="60" r="2.5" fill={p.encre} stroke="none" />
        {/* Panneau vers la gauche : face orange, pointillés papier. */}
        <path d="M150 106H52L30 126L52 146H150Z" fill={p.encre} stroke="none" transform="translate(0 7)" />
        <path d="M150 106H52L30 126L52 146H150Z" fill={p.orange} />
        <path d="M60 126H136" stroke={p.papier} strokeWidth={FIN} strokeDasharray="8 9" />
        <circle cx="100" cy="114" r="2.5" fill={p.encre} stroke="none" />
      </>
    )} />
  );
}

/** I03 — chronomètre de trois quarts : boîtier épais, couronne et poussoirs, cadran gradué, compteur. */
export function I03({ taille, ...c }: ProprietesIllustration) {
  const graduations = Array.from({ length: 12 }, (_, i) => {
    const [x1, y1] = polaire(100, 112, i % 3 === 0 ? 37 : 41, i * 30);
    const [x2, y2] = polaire(100, 112, 46, i * 30);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }).join("");
  const [ax, ay] = polaire(100, 112, 46, 80);
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={92} r={80} />
        <Etincelle x={168} y={40} r={8} couleur={p.orange} />
        <Etincelle x={30} y={50} r={5} couleur={p.encre} />
        <path d="M14 96H32M10 114H28M16 132H32" strokeWidth={FIN} />
        <Ombre cx={106} cy={184} rx={56} couleur={p.pale} />
        {/* Poussoirs latéraux (tige + capuchon), puis couronne au sommet. */}
        <g transform="rotate(44 100 112)">
          <rect x="94" y="40" width="12" height="14" fill={p.pale} />
          <rect x="90" y="32" width="20" height="10" rx="4" fill={p.encre} stroke="none" />
        </g>
        <g transform="rotate(-44 100 112)">
          <rect x="95" y="42" width="10" height="12" fill={p.pale} />
        </g>
        <rect x="92" y="34" width="16" height="16" fill={p.pale} />
        <rect x="82" y="22" width="36" height="14" rx="6" fill={p.orange} />
        {/* Boîtier : épaisseur d'encre décalée, carrure orange, cadran papier. */}
        <circle cx="106" cy="117" r="62" fill={p.encre} stroke="none" />
        <circle cx="100" cy="112" r="62" fill={p.orange} />
        <circle cx="100" cy="112" r="50" fill={p.papier} />
        <path d={`M100 112L100 66A46 46 0 0 1 ${ax.toFixed(1)} ${ay.toFixed(1)}Z`} fill={p.pale} stroke="none" />
        <path d={graduations} strokeWidth={FIN} />
        <path d="M66 96A38 38 0 0 1 82 76" stroke={p.creme} strokeWidth="5" />
        <circle cx="100" cy="138" r="10" fill={p.creme} strokeWidth={FIN} />
        <path d="M100 138L106 132" strokeWidth={MICRO} />
        <path d={`M100 112L${ax.toFixed(1)} ${ay.toFixed(1)}`} stroke={p.orange} strokeWidth="5" />
        <path d="M100 112L100 84" strokeWidth="5" />
        <circle cx="100" cy="112" r="6" fill={p.encre} stroke="none" />
        <circle cx="100" cy="112" r="2" fill={p.orange} stroke="none" />
      </>
    )} />
  );
}

/** I04 — enveloppe qui s'ouvre : rabat levé, lettre pliée qui sort, cachet. */
export function I04({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={92} r={80} />
        <Etincelle x={164} y={46} r={8} couleur={p.orange} />
        <Etincelle x={34} y={56} r={6} couleur={p.encre} />
        <Etincelle x={150} y={24} r={4} couleur={p.encre} />
        <Ombre cx={102} cy={186} rx={72} couleur={p.pale} />
        {/* Dos (intérieur orange) et rabat levé. */}
        <rect x="26" y="96" width="148" height="84" rx="8" fill={p.orange} />
        <path d="M28 100L92 24Q100 16 108 24L172 100Z" fill={p.pale} />
        <path d="M78 52L100 30L122 52" stroke={p.creme} strokeWidth={MICRO} />
        {/* Lettre pliée : pli horizontal, en-tête, lignes. */}
        <rect x="46" y="60" width="108" height="94" rx="5" fill={p.papier} />
        <path d="M48 104H152" stroke={p.pale} strokeWidth={FIN} />
        <rect x="58" y="70" width="38" height="9" rx="4.5" fill={p.orange} stroke="none" />
        <path d="M58 88H140M58 97H124" strokeWidth={FIN} />
        <path d="M58 114H136M58 124H110" strokeWidth={MICRO} />
        {/* Poche avant et cachet. */}
        <path d="M26 104L100 148L174 104V172Q174 180 166 180H34Q26 180 26 172Z" fill={p.papier} />
        <path d="M32 174L82 138M168 174L118 138" strokeWidth={FIN} />
        <circle cx="100" cy="148" r="12" fill={p.orange} />
        <Etincelle x={100} y={148} r={6} couleur={p.papier} />
      </>
    )} />
  );
}

/** I05 — agenda à spirale : feuillets superposés, en-tête, jours, coin plié, marque-page. */
export function I05({ taille, ...c }: ProprietesIllustration) {
  const cases = [0, 1, 2].flatMap((j) => [0, 1, 2, 3].map((i) => ({ x: 44 + i * 27, y: 78 + j * 24, i, j })));
  const page = "M42 36H150Q160 36 160 46V138L134 166H42Q32 166 32 156V46Q32 36 42 36Z";
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={96} r={82} />
        <Etincelle x={176} y={36} r={8} couleur={p.orange} />
        <Etincelle x={20} y={84} r={5} couleur={p.encre} />
        <Ombre cx={104} cy={186} rx={66} couleur={p.pale} />
        {/* Marque-page qui dépasse, épaisseur et feuillet du dessous. */}
        <path d="M112 150V186L119 179L126 186V150Z" fill={p.orange} />
        <rect x="42" y="44" width="128" height="130" rx="10" fill={p.encre} stroke="none" />
        <rect x="38" y="40" width="128" height="130" rx="10" fill={p.pale} />
        {/* Feuillet du dessus. */}
        <path d={page} fill={p.papier} />
        <path d="M32 64V46Q32 36 42 36H150Q160 36 160 46V64Z" fill={p.orange} />
        {cases.map((k) => (
          <rect key={`${k.i}-${k.j}`} x={k.x} y={k.y} width="20" height="16" rx="4" fill={k.i === 2 && k.j === 0 ? p.orange : p.pale} stroke={k.i === 2 && k.j === 0 ? p.encre : "none"} strokeWidth={FIN} />
        ))}
        <path d="M49 110L53 114L60 107" strokeWidth={FIN} />
        <path d="M160 138L136 142L134 166Z" fill={p.pale} />
        <path d={page} />
        {/* Spirale. */}
        {[50, 70, 90, 110, 130, 150].map((x) => (
          <g key={x}>
            <circle cx={x - 8} cy="50" r="2.5" fill={p.encre} stroke="none" />
            <path d={`M${x - 8} 50V30`} strokeWidth="5" />
          </g>
        ))}
      </>
    )} />
  );
}

/** I06 — dossier ouvert de face : dos à onglet bien visible, feuilles et trombone, rabat avant incliné, étiquette. */
export function I06({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={94} r={82} />
        <Etincelle x={172} y={34} r={8} couleur={p.orange} />
        <Etincelle x={26} y={40} r={5} couleur={p.encre} />
        <Ombre cx={100} cy={184} rx={74} couleur={p.pale} />
        {/* Dos du dossier avec son onglet. */}
        <path d="M14 50Q14 38 26 38H60Q68 38 72 45L80 60H150Q162 60 162 72V176H14Z" fill={p.encre} />
        <rect x="28" y="46" width="30" height="6" rx="3" fill={p.orange} stroke="none" />
        {/* Feuilles et trombone. */}
        <rect x="34" y="52" width="104" height="96" rx="4" fill={p.pale} transform="rotate(-6 86 100)" />
        <rect x="46" y="58" width="104" height="92" rx="4" fill={p.papier} transform="rotate(4 98 104)" />
        <path d="M60 78H122M59 92H134M58 106H108" strokeWidth={FIN} transform="rotate(4 98 104)" />
        <path d="M132 48V66Q132 72 126 72Q120 72 120 66V54Q120 50 124 50Q128 50 128 54V64" strokeWidth={FIN} />
        {/* Rabat avant : parallélogramme penché vers l'avant (le dossier s'ouvre). */}
        <path d="M40 114Q42 106 50 106H180Q189 106 187 114L167 169Q165 176 157 176H22Q13 176 15 168Z" fill={p.orange} />
        <path d="M50 116H176" stroke={p.pale} strokeWidth={MICRO} />
        <rect x="32" y="144" width="52" height="18" rx="5" fill={p.papier} strokeWidth={FIN} />
        <path d="M41 153H72" strokeWidth={MICRO} />
      </>
    )} />
  );
}

/** I07 — avion en papier entre deux nuages, trajectoire en pointillés, ombre au sol. */
export function I07({ taille, ...c }: ProprietesIllustration) {
  const nuage = (x: number, y: number, k: number) => `M${x} ${y}a${10 * k} ${10 * k} 0 0 1 ${4 * k} ${-19 * k}a${14 * k} ${14 * k} 0 0 1 ${26 * k} ${-6 * k}a${11 * k} ${11 * k} 0 0 1 ${20 * k} ${8 * k}a${8.5 * k} ${8.5 * k} 0 0 1 ${0} ${17 * k}Z`;
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={94} r={82} />
        <Etincelle x={30} y={40} r={7} couleur={p.orange} />
        <Etincelle x={176} y={110} r={5} couleur={p.encre} />
        <path d={nuage(118, 76, 1.1)} fill={p.papier} strokeWidth={FIN} />
        <Ombre cx={112} cy={186} rx={42} ry={5} couleur={p.pale} />
        <path d="M10 178C26 146 56 172 60 148C64 128 78 126 86 124" strokeWidth="4" strokeDasharray="0.5 10" />
        {/* Avion : aile proche papier (pli marqué), aile lointaine orange, quille pâle. */}
        <path d="M178 30L84 112L100 172Z" fill={p.orange} />
        <path d="M84 112L100 172L124 138Z" fill={p.pale} />
        <path d="M178 30L22 92L84 112Z" fill={p.papier} />
        <path d="M174 34L54 98" stroke={p.pale} strokeWidth={FIN} />
        <path d={nuage(122, 186, 1.2)} fill={p.papier} strokeWidth={FIN} />
      </>
    )} />
  );
}

/** I08 — trois bulles de discussion sur trois plans, chacune avec son épaisseur. */
export function I08({ taille, ...c }: ProprietesIllustration) {
  const fond = "M36 24H96Q114 24 114 42V64Q114 82 96 82H62L44 98V82H36Q18 82 18 64V42Q18 24 36 24Z";
  const milieu = "M100 56H162Q182 56 182 76V102Q182 122 162 122H158V142L138 122H100Q80 122 80 102V76Q80 56 100 56Z";
  const devant = "M46 116H112Q130 116 130 134V152Q130 170 112 170H64L44 188V170Q26 168 26 150V134Q26 116 46 116Z";
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={100} r={82} />
        <Etincelle x={170} y={30} r={8} couleur={p.orange} />
        <Etincelle x={170} y={170} r={5} couleur={p.encre} />
        <path d={fond} fill={p.encre} stroke="none" transform="translate(5 5)" />
        <path d={fond} fill={p.papier} />
        <path d="M34 46H96M34 60H78" strokeWidth={FIN} />
        <path d={milieu} fill={p.encre} stroke="none" transform="translate(6 6)" />
        <path d={milieu} fill={p.orange} />
        <circle cx="108" cy="89" r="7" fill={p.papier} stroke="none" />
        <circle cx="131" cy="89" r="7" fill={p.papier} stroke="none" />
        <circle cx="154" cy="89" r="7" fill={p.papier} stroke="none" />
        <path d={devant} fill={p.orange} stroke="none" transform="translate(6 6)" />
        <path d={devant} fill={p.encre} />
        <path d="M58 156C46 148 44 138 51 135C55 133 58 136 58 139C58 136 61 133 65 135C72 138 70 148 58 156Z" fill={p.orange} stroke="none" />
        <path d="M80 136H112M80 150H102" stroke={p.papier} strokeWidth={FIN} />
      </>
    )} />
  );
}

/** I09 — cible sur chevalet, fléchette plantée au centre (empennage à trois ailettes, vu de profil). */
export function I09({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={92} r={80} />
        <Etincelle x={30} y={36} r={7} couleur={p.orange} />
        <Etincelle x={176} y={150} r={5} couleur={p.encre} />
        <Ombre cx={100} cy={186} rx={58} couleur={p.pale} />
        {/* Chevalet. */}
        <path d="M100 130L106 186" strokeWidth={FIN} />
        <path d="M84 124L60 186M116 124L140 186" />
        {/* Cible : épaisseur, anneaux, mouche. */}
        <circle cx="105" cy="101" r="62" fill={p.encre} stroke="none" />
        <circle cx="100" cy="96" r="62" fill={p.papier} />
        <circle cx="100" cy="96" r="48" fill={p.orange} strokeWidth={FIN} />
        <circle cx="100" cy="96" r="33" fill={p.papier} strokeWidth={FIN} />
        <circle cx="100" cy="96" r="18" fill={p.orange} strokeWidth={FIN} />
        <circle cx="100" cy="96" r="7" fill={p.encre} stroke="none" />
        <path d="M60 64A52 52 0 0 1 80 50" stroke={p.pale} strokeWidth="5" />
        <path d="M84 104L74 110M88 114L82 122M82 92L72 90" strokeWidth={FIN} />
        {/* Fléchette : fût, corps cannelé, empennage balayé vers l'arrière. */}
        <g transform="translate(102 94) rotate(-45)">
          <path d="M0 0H76" strokeWidth="4" />
          <rect x="12" y="-6" width="28" height="12" rx="5" fill={p.encre} stroke="none" />
          <path d="M20 -6V6M28 -6V6" stroke={p.orange} strokeWidth={MICRO} />
          <path d="M48 0L58 -20L82 -22L80 0Z" fill={p.orange} />
          <path d="M48 0L58 20L82 22L80 0Z" fill={p.pale} />
          <path d="M46 0H84" strokeWidth="5" />
        </g>
      </>
    )} />
  );
}

/** I10 — sablier à montants de bois : verre avec reflets, sable qui s'écoule, ombre au sol. */
export function I10({ taille, ...c }: ProprietesIllustration) {
  const verre = "M64 44V58C64 82 92 92 100 100C108 92 136 82 136 58V44ZM64 156V142C64 118 92 108 100 100C108 108 136 118 136 142V156Z";
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={96} r={82} />
        <Etincelle x={172} y={44} r={8} couleur={p.orange} />
        <Etincelle x={26} y={122} r={5} couleur={p.encre} />
        <Ombre cx={102} cy={186} rx={62} couleur={p.pale} />
        <path d={verre} fill={p.papier} />
        <path d="M70 60Q100 66 130 60C126 76 110 84 100 92C90 84 74 76 70 60Z" fill={p.orange} stroke="none" />
        <path d="M100 92V140" stroke={p.orange} strokeWidth="3" />
        <path d="M68 154Q84 136 100 132Q116 136 132 154Z" fill={p.orange} stroke="none" />
        <path d="M74 50C74 64 80 74 90 82M76 150C76 138 82 128 90 122" stroke={p.pale} strokeWidth="4" />
        <path d={verre} />
        {/* Montants de bois (devant le verre), puis traverses veinées. */}
        <rect x="44" y="40" width="10" height="120" rx="3" fill={p.pale} />
        <rect x="146" y="40" width="10" height="120" rx="3" fill={p.pale} />
        <rect x="34" y="22" width="132" height="20" rx="7" fill={p.orange} />
        <path d="M48 32H82M102 30H124M138 33H154" stroke={p.pale} strokeWidth={MICRO} />
        <rect x="34" y="158" width="132" height="20" rx="7" fill={p.orange} />
        <path d="M46 168H74M96 170H126M140 167H156" stroke={p.pale} strokeWidth={MICRO} />
      </>
    )} />
  );
}

/** I11 — pile de factures : trois feuilles décalées, en-tête, lignes, trombone, tampon de validation. */
export function I11({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondDisque p={p} cy={94} r={82} />
        <Etincelle x={176} y={40} r={8} couleur={p.orange} />
        <Etincelle x={22} y={130} r={5} couleur={p.encre} />
        <Ombre cx={104} cy={186} rx={64} couleur={p.pale} />
        <rect x="48" y="38" width="114" height="136" rx="6" fill={p.pale} transform="rotate(6 105 106)" />
        <rect x="42" y="34" width="114" height="136" rx="6" fill={p.papier} transform="rotate(-3 99 102)" />
        <rect x="40" y="28" width="116" height="144" rx="6" fill={p.papier} />
        <rect x="52" y="42" width="34" height="24" rx="5" fill={p.orange} stroke="none" />
        <path d="M118 46H144M126 56H144" strokeWidth={FIN} />
        {[82, 96, 110].map((y) => (
          <g key={y}>
            <rect x="52" y={y - 3} width="58" height="7" rx="3.5" fill={p.pale} stroke="none" />
            <path d={`M126 ${y}H144`} strokeWidth={FIN} />
          </g>
        ))}
        <path d="M52 124H144" strokeWidth={MICRO} />
        <rect x="112" y="130" width="32" height="10" rx="5" fill={p.orange} stroke="none" />
        <path d="M50 160H146" stroke={p.pale} strokeWidth={FIN} strokeDasharray="0.5 7" />
        {/* Tampon de validation (sans texte) et trombone. */}
        <g transform="rotate(-14 76 146)">
          <circle cx="76" cy="146" r="17" stroke={p.orange} strokeWidth="4" />
          <circle cx="76" cy="146" r="11" stroke={p.orange} strokeWidth={MICRO} />
          <path d="M70 146L75 151L83 141" stroke={p.orange} strokeWidth={FIN} />
        </g>
        <path d="M66 16V42Q66 50 74 50Q82 50 82 42V24Q82 19 77 19Q72 19 72 24V38" strokeWidth={FIN} />
      </>
    )} />
  );
}

/** I12 — salle de réunion de face : tableau au mur, trois dossiers de chaises, table en bois, ordinateur et tasse. */
export function I12({ taille, ...c }: ProprietesIllustration) {
  return (
    <Cadre taille={taille} couleurs={c} enfants={(p) => (
      <>
        <FondArche p={p} x={18} y={10} l={164} h={140} />
        <Etincelle x={164} y={40} r={6} couleur={p.orange} />
        {/* Tableau mural avec courbe. */}
        <rect x="54" y="30" width="92" height="50" rx="4" fill={p.papier} />
        <path d="M64 68L82 54L98 62L120 42L136 48" stroke={p.orange} strokeWidth="5" />
        <path d="M60 86H140" strokeWidth={FIN} />
        <Ombre cx={100} cy={192} rx={84} ry={5} couleur={p.pale} />
        {/* Dossiers des chaises, derrière la table. */}
        {[58, 100, 142].map((x) => (
          <g key={x}>
            <rect x={x - 16} y="94" width="32" height="40" rx="11" fill={p.orange} />
            <path d={`M${x - 8} 104H${x + 8}`} stroke={p.pale} strokeWidth={MICRO} />
          </g>
        ))}
        {/* Table : dessus papier en perspective, chant de bois, pieds. */}
        <path d="M32 158V190M168 158V190" />
        <path d="M40 122H160L184 146H16Z" fill={p.papier} />
        <path d="M16 146H184V154Q184 160 178 160H22Q16 160 16 154Z" fill={p.orange} />
        <path d="M30 153H66M92 152H124M144 154H172" stroke={p.pale} strokeWidth={MICRO} />
        {/* Ordinateur (dos de l'écran), feuille, tasse. */}
        <path d="M66 104H104L108 134H62Z" fill={p.pale} />
        <circle cx="85" cy="118" r="3" fill={p.papier} stroke="none" />
        <path d="M56 136H114" />
        <path d="M30 142L52 132L74 140L52 150Z" fill={p.papier} strokeWidth={FIN} transform="translate(0 -4)" />
        <path d="M142 124C150 124 150 134 142 134" strokeWidth={FIN} />
        <rect x="126" y="118" width="16" height="20" rx="4" fill={p.papier} strokeWidth={FIN} />
        <path d="M120 140H148" strokeWidth={FIN} />
      </>
    )} />
  );
}
