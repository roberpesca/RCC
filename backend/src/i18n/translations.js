// Central bilingual dictionary for everything the backend renders as text. Spanish is
// the default language; English is the alternative. All dynamic/coaching text is
// resolved at request time from neutral keys (workout_key, program_id, phase key)
// rather than persisted, so switching languages relights the whole app instantly
// without needing to regenerate any plan.

export const SUPPORTED_LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

export function resolveLang(value) {
  return SUPPORTED_LANGS.includes(value) ? value : DEFAULT_LANG;
}

export function getLang(req) {
  return resolveLang(req.header('x-lang') || req.query.lang);
}

export const PHASES = {
  base: { es: 'Base', en: 'Base' },
  build: { es: 'Desarrollo', en: 'Build' },
  peak: { es: 'Pico', en: 'Peak' },
  taper: { es: 'Reducción', en: 'Taper' },
  sharpen: { es: 'Afinado', en: 'Sharpen' },
};

export const PROGRAMS_TEXT = {
  ftp_builder: {
    es: { name: 'Constructor de FTP', tagline: 'Sube tu potencia umbral', description: 'Una progresión clásica de base, desarrollo y pico centrada en sweet spot y umbral para llevar tu FTP lo más alto posible.' },
    en: { name: 'FTP Builder', tagline: 'Raise your threshold power', description: 'A classic base-build-peak progression centered on sweet spot and threshold work to drive your FTP up as high as possible.' },
  },
  weight_loss_base: {
    es: { name: 'Base Aeróbica y Ligereza', tagline: 'Construye motor mientras adelgazas', description: 'Programa de alto volumen, mayormente Zona 2, que maximiza la quema de calorías y las adaptaciones aeróbicas mientras mantiene un coste de recuperación bajo para sostener un déficit calórico.' },
    en: { name: 'Lean & Aerobic Base', tagline: 'Build a big engine while leaning out', description: 'High-volume, mostly Zone 2 program that maximizes calorie burn and fat-burning aerobic adaptations while keeping recovery cost low enough to sustain a calorie deficit.' },
  },
  ftp_weight_combo: {
    es: { name: 'Combo FTP + Pérdida de Peso', tagline: 'Hazte más rápido y más ligero a la vez', description: 'Combina intensidad para subir el FTP (sweet spot / umbral, 2x/semana) con suficiente volumen aeróbico estable para sostener un déficit calórico y proteger la masa muscular. Recomendado si ambos objetivos te importan.' },
    en: { name: 'FTP + Weight Loss Combo', tagline: 'Get faster and leaner at the same time', description: 'Balances FTP-building intensity (sweet spot / threshold, 2x/week) with enough steady aerobic volume to run a sustainable calorie deficit and protect lean mass. Recommended if both goals matter to you.' },
  },
  gran_fondo_endurance: {
    es: { name: 'Preparación Gran Fondo / Cicloturista', tagline: 'Completa la distancia con comodidad', description: 'Construye horas de sillín y resistencia en la alimentación para un evento largo, con salidas largas semanales que progresan hacia tu distancia objetivo.' },
    en: { name: 'Gran Fondo / Century Prep', tagline: 'Go the distance comfortably', description: 'Builds time-in-the-saddle and fueling resilience for a long event, with weekly long rides progressing toward your target distance.' },
  },
  climbing_specialist: {
    es: { name: 'Especialista en Escalada', tagline: 'Construye potencia sostenida en subida', description: 'Enfatiza repeticiones sostenidas por debajo del umbral y al umbral en subida, para mejorar tu relación peso-potencia.' },
    en: { name: 'Climbing Specialist', tagline: 'Build sustained climbing power', description: 'Emphasizes sustained sub-threshold and threshold climbing repeats to improve your power-to-weight ratio.' },
  },
  race_crit_prep: {
    es: { name: 'Preparación para Carreras', tagline: 'Afina tu punta de velocidad para competir', description: 'Desarrolla VO2max y capacidad anaeróbica más ataques de simulación de carrera para criteriums y ciclismo en ruta.' },
    en: { name: 'Race / Crit Prep', tagline: 'Sharpen your top end for racing', description: 'Develops VO2max and anaerobic capacity plus race-simulation surges for criteriums and road racing.' },
  },
};

export const WORKOUTS_TEXT = {
  rest: {
    es: {
      title: 'Día de descanso', description: 'Descanso completo, o movilidad y estiramientos suaves. Sin entrenamiento estructurado.',
      purpose: 'La adaptación (más fuerza, más FTP) ocurre mientras descansas, no mientras entrenas. Saltarte los descansos frena el progreso.',
      coachTip: 'Prioriza el sueño e hidrátate bien. Un paseo suave o estiramientos están bien si te apetece moverte.',
      indoorTip: 'No aplica — es un día sin rodillo.',
      outdoorTip: 'No aplica — es un día sin bici.',
    },
    en: {
      title: 'Rest Day', description: 'Full rest, or gentle mobility/stretching. No structured riding.',
      purpose: 'The adaptation (more strength, higher FTP) happens while you rest, not while you train. Skipping rest days stalls progress.',
      coachTip: 'Prioritize sleep and hydration. A gentle walk or stretching is fine if you feel like moving.',
      indoorTip: 'Not applicable — no trainer today.',
      outdoorTip: 'Not applicable — no bike today.',
    },
  },
  recovery_spin: {
    es: {
      title: 'Rodillo de recuperación', description: 'Pedaleo muy suave para favorecer el riego sanguíneo y la recuperación. Mantenlo ridículamente fácil — si se siente como ejercicio, ve más despacio.',
      purpose: 'Aumenta el flujo sanguíneo a las piernas para acelerar la recuperación tras un día duro, sin añadir fatiga nueva.',
      coachTip: 'Si tienes que esforzarte para mantener el ritmo, vas demasiado rápido. Cadencia suave y sin mirar la potencia.',
      indoorTip: 'Rodillo con resistencia mínima, sin modo ERG. Perfecto para ver una serie mientras pedaleas.',
      outdoorTip: 'Busca una ruta llana y tranquila, sin grupos ni semáforos que te obliguen a acelerar.',
    },
    en: {
      title: 'Recovery Spin', description: 'Very easy spin to promote blood flow and recovery. Keep it embarrassingly easy — if it feels like exercise, slow down.',
      purpose: 'Boosts blood flow to your legs to speed up recovery from a hard day, without adding any new fatigue.',
      coachTip: 'If you have to work to hold the pace, you\'re going too hard. Easy cadence, and don\'t watch the power number.',
      indoorTip: 'Trainer at minimal resistance, no ERG mode. Great excuse to watch something while you spin.',
      outdoorTip: 'Find a flat, quiet route — avoid group rides or traffic lights that force you to surge.',
    },
  },
  endurance_z2: {
    es: {
      title: 'Resistencia (Zona 2)', description: 'Salida aeróbica constante. Ritmo conversacional todo el rato — esto construye tu base aeróbica y quema grasa de forma eficiente.',
      purpose: 'Construye tu motor aeróbico y mejora la capacidad de quemar grasa como combustible — la base de todo lo demás.',
      coachTip: 'Debes poder mantener una conversación sin quedarte sin aliento. Si respiras fuerte, baja el ritmo.',
      indoorTip: 'Ideal en modo ERG a potencia constante; ponte una serie o película larga.',
      outdoorTip: 'Terreno llano u ondulado, evitando repechos que te empujen fuera de zona.',
    },
    en: {
      title: 'Endurance (Zone 2)', description: 'Steady aerobic ride. Conversational pace throughout — this builds your aerobic base and burns fat efficiently.',
      purpose: 'Builds your aerobic engine and improves your ability to burn fat as fuel — the foundation everything else is built on.',
      coachTip: "You should be able to hold a conversation without gasping. If you're breathing hard, ease off.",
      indoorTip: 'Great in ERG mode at a steady wattage — queue up a long show or movie.',
      outdoorTip: 'Flat to rolling terrain, avoiding climbs that push you out of zone.',
    },
  },
  long_endurance: {
    es: {
      title: 'Salida larga de resistencia', description: 'La salida clave del fin de semana. Zona 2 constante con el último tercio en la parte alta de la zona para practicar la alimentación y la resistencia a la fatiga.',
      purpose: 'Entrena a tu cuerpo a usar grasa eficientemente durante horas y practica la estrategia de alimentación para eventos largos.',
      coachTip: 'Empieza conservador. Prueba tu plan de alimentación real (geles, bebida) igual que lo harías en un evento.',
      indoorTip: 'Mejor al aire libre si es posible; si es en rodillo, divide la sesión en bloques con entretenimiento variado.',
      outdoorTip: 'Ruta con algo de desnivel ondulado. Aprovecha para practicar el reparto de esfuerzo y la alimentación.',
    },
    en: {
      title: 'Long Endurance Ride', description: 'The cornerstone weekend ride. Steady Z2 with the last third of the ride at the upper end of the zone to practice fueling and fatigue resistance.',
      purpose: 'Trains your body to efficiently burn fat for hours and lets you rehearse your fueling strategy for long events.',
      coachTip: 'Start conservative. Practice your real fueling plan (gels, drink mix) exactly as you would on event day.',
      indoorTip: "Best done outdoors if possible; if it's on the trainer, split it into blocks with varied entertainment.",
      outdoorTip: 'A route with some rolling terrain. Use it to practice pacing and fueling.',
    },
  },
  tempo: {
    es: {
      title: 'Tempo', description: 'Esfuerzo sostenido "moderadamente duro", cómodamente incómodo. Construye resistencia muscular.',
      purpose: 'Cierra la brecha entre resistencia y umbral, mejorando tu capacidad de sostener un ritmo fuerte durante más tiempo.',
      coachTip: 'Debe sentirse sostenible pero exigente — como el ritmo de un pelotón trabajando en carretera.',
      indoorTip: 'Modo ERG funciona bien aquí para mantener la potencia exacta sin pensar.',
      outdoorTip: 'Busca un falso llano largo o un tramo con viento en contra constante.',
    },
    en: {
      title: 'Tempo', description: 'Sustained "moderately hard" effort, comfortably uncomfortable. Builds muscular endurance.',
      purpose: 'Bridges the gap between endurance and threshold, improving your ability to sustain a strong pace for longer.',
      coachTip: 'Should feel sustainable but demanding — like a paceline working together on the road.',
      indoorTip: 'ERG mode works well here to hold the exact wattage without thinking about it.',
      outdoorTip: 'Look for a long false flat or a stretch with steady headwind.',
    },
  },
  sweet_spot: {
    es: {
      title: 'Intervalos Sweet Spot', description: 'El punto medio eficiente entre tempo y umbral — grandes ganancias de forma física sin el coste de recuperación completo del umbral.',
      purpose: 'Máxima ganancia de FTP por minuto de esfuerzo — el punto dulce entre intensidad y capacidad de recuperación.',
      coachTip: 'Duro pero repetible. Si no pudieras hacer un tercer bloque, vas demasiado fuerte.',
      indoorTip: 'Uno de los mejores entrenamientos para hacer en rodillo con ERG — máxima precisión.',
      outdoorTip: 'Una subida larga y constante o un tramo llano sin cruces es ideal.',
    },
    en: {
      title: 'Sweet Spot Intervals', description: 'The efficient middle ground between tempo and threshold — big fitness gains without the full threshold recovery cost.',
      purpose: 'Maximum FTP gain per minute of effort — the sweet spot between intensity and recoverability.',
      coachTip: "Hard but repeatable. If you couldn't do a third block, you're going too hard.",
      indoorTip: 'One of the best sessions to do on the trainer with ERG mode — maximum precision.',
      outdoorTip: 'A long, steady climb or an uninterrupted flat stretch works great.',
    },
  },
  threshold: {
    es: {
      title: 'Intervalos al Umbral (FTP)', description: '2x20 al umbral — el clásico constructor de FTP. El esfuerzo debe sentirse "duro pero sostenible" durante todo el intervalo.',
      purpose: 'Entrena directamente tu FTP — el motor detrás de tu ritmo sostenible en subidas y contrarreloj.',
      coachTip: 'Reparte el esfuerzo: no salgas fuerte y te quedes sin gasolina en el minuto 15.',
      indoorTip: 'ERG mode ideal, aunque puedes apagarlo si te cuesta reaccionar a los cambios de potencia.',
      outdoorTip: 'Una subida larga y constante (15-20 min) es el escenario perfecto para este entreno.',
    },
    en: {
      title: 'Threshold (FTP) Intervals', description: '2x20 at threshold — the classic FTP-builder. Effort should feel "hard but sustainable" for the full interval.',
      purpose: 'Directly trains your FTP — the engine behind your sustainable pace on climbs and time trials.',
      coachTip: "Pace it evenly: don't go out hard and run out of gas by minute 15.",
      indoorTip: "ERG mode is ideal, though you can turn it off if you struggle to react to power changes.",
      outdoorTip: 'A long, steady climb (15-20 min) is the perfect setting for this session.',
    },
  },
  over_unders: {
    es: {
      title: 'Over-Unders', description: 'Alternando justo por encima / justo por debajo del umbral. Entrena tu capacidad de aclarar lactato mientras sigues trabajando duro — ideal para arrancadas de carrera y repechos.',
      purpose: 'Enseña a tu cuerpo a limpiar el lactato mientras sigues pedaleando fuerte — clave para ataques y repechos en carrera.',
      coachTip: 'No dejes que el "under" se convierta en recuperación completa — sigue siendo un esfuerzo notable.',
      indoorTip: 'Mejor con ERG desactivado, ya que necesitas reaccionar tú mismo a cada cambio.',
      outdoorTip: 'El terreno ondulado natural hace este entreno casi solo — aprovecha los repechos cortos.',
    },
    en: {
      title: 'Over-Unders', description: 'Alternating just-above / just-below threshold. Trains your ability to clear lactate while still working hard — great for race-pace surges and climbing repeats.',
      purpose: 'Teaches your body to clear lactate while still pedaling hard — key for race attacks and short punchy climbs.',
      coachTip: "Don't let the \"under\" become full recovery — it should still feel like a real effort.",
      indoorTip: "Best with ERG mode off, since you need to react to each change yourself.",
      outdoorTip: 'Naturally rolling terrain does this workout almost by itself — use the short rises.',
    },
  },
  vo2max: {
    es: {
      title: 'Intervalos VO2max', description: '5x3min a un ritmo muy duro, de "aguantar como sea". El mejor entrenamiento individual para subir tu techo.',
      purpose: 'Sube tu techo aeróbico (VO2max), el límite superior que determina cuánta potencia puedes sostener en todo lo demás.',
      coachTip: 'Los últimos 30 segundos de cada intervalo deben doler de verdad. Si terminas fresco, sube la potencia la próxima vez.',
      indoorTip: 'ERG puede sentirse brutal en estos esfuerzos cortos — muchos prefieren resistencia manual aquí.',
      outdoorTip: 'Busca una subida corta y empinada (3 min) para repetir varias veces con seguridad.',
    },
    en: {
      title: 'VO2max Intervals', description: '5x3min at a very hard, "can just hold on" pace. The single best workout for raising your ceiling.',
      purpose: 'Raises your aerobic ceiling (VO2max) — the upper limit that determines how much power you can sustain everywhere else.',
      coachTip: 'The last 30 seconds of each interval should genuinely hurt. If you finish fresh, push harder next time.',
      indoorTip: 'ERG can feel brutal for these short efforts — many riders prefer manual resistance here.',
      outdoorTip: 'Find a short, steep climb (3 min) you can safely repeat several times.',
    },
  },
  anaerobic_repeats: {
    es: {
      title: 'Repeticiones Anaeróbicas / Sprints', description: 'Esfuerzos cortos y muy duros para tener chispa en los ataques y llegadas.',
      purpose: 'Desarrolla potencia neuromuscular explosiva para ataques, sprints y arrancadas — la "chispa" que el trabajo aeróbico no entrena.',
      coachTip: 'Esfuerzo máximo desde el primer segundo. La recuperación entre sprints debe ser casi completa.',
      indoorTip: 'Desactiva el ERG — necesitas poder disparar la potencia instantáneamente.',
      outdoorTip: 'Elige una calle segura, sin tráfico ni cruces, para poder ir a tope sin distracciones.',
    },
    en: {
      title: 'Anaerobic / Sprint Repeats', description: 'Short, very hard efforts for race-winning punch and climbing attacks.',
      purpose: 'Builds explosive neuromuscular power for attacks, sprints and surges — the "punch" aerobic work alone can\'t train.',
      coachTip: 'Maximal effort from the very first second. Recovery between sprints should be nearly complete.',
      indoorTip: "Turn ERG mode off — you need to be able to spike power instantly.",
      outdoorTip: 'Pick a safe stretch of road with no traffic or junctions so you can go all-out without distractions.',
    },
  },
  climbing_repeats: {
    es: {
      title: 'Repeticiones de Escalada', description: 'Repeticiones sentado a potencia sostenida simulando una subida larga. Enfoque en fuerza a cadencia baja.',
      purpose: 'Construye fuerza muscular específica de escalada, entrenando tus piernas a producir potencia a cadencia baja.',
      coachTip: 'Mantente sentado la mayor parte del tiempo, con la espalda relajada — es fuerza, no un sprint.',
      indoorTip: 'Sube la resistencia o usa el simulador de pendiente; sal del modo ERG para controlar tú la cadencia baja.',
      outdoorTip: 'Una subida real de 10-15 minutos es, con diferencia, lo mejor para esta sesión.',
    },
    en: {
      title: 'Climbing Repeats', description: 'Seated sustained-power repeats simulating a long climb. Low cadence strength focus.',
      purpose: 'Builds climbing-specific muscular strength, training your legs to produce power at a low cadence.',
      coachTip: 'Stay seated most of the time with a relaxed upper body — this is strength work, not a sprint.',
      indoorTip: 'Raise resistance or use incline simulation; come out of ERG mode so you control the low cadence yourself.',
      outdoorTip: 'A real 10-15 minute climb is, by far, the best setting for this session.',
    },
  },
  ftp_test: {
    es: {
      title: 'Test de FTP (rampa o 20 min)', description: 'Reevalúa tu FTP: esfuerzo máximo de 20 minutos x 0,95, o un test de rampa si lo prefieres. Actualiza tu FTP después para que el plan siga adaptándose a ti.',
      purpose: 'Mide tu FTP actual para que todo el plan (zonas, TSS, cargas) siga reflejando tu forma real.',
      coachTip: 'Duerme bien la noche anterior y llega descansado — un mal día de test infravalora todo tu plan.',
      indoorTip: 'Entorno controlado, sin semáforos ni tráfico — ideal para un test limpio y repetible.',
      outdoorTip: 'Si lo haces fuera, busca una carretera llana o una subida larga sin paradas ni cruces.',
    },
    en: {
      title: 'FTP Test (Ramp or 20-min)', description: 'Reassess your FTP: 20-minute all-out effort x 0.95, or a ramp test if you prefer. Update your FTP afterward so the plan keeps adapting to the real you.',
      purpose: 'Measures your current FTP so the whole plan (zones, TSS, loads) keeps reflecting your real fitness.',
      coachTip: 'Sleep well the night before and arrive rested — a bad test day undersells your entire plan.',
      indoorTip: 'A controlled environment with no traffic lights or traffic — ideal for a clean, repeatable test.',
      outdoorTip: 'If doing it outside, find a flat road or a long climb with no stops or junctions.',
    },
  },
};

export const SEGMENT_NOTES = {
  warmup: { es: 'Calentamiento', en: 'Warm up' },
  cooldown: { es: 'Enfriamiento', en: 'Cool down' },
  steady: { es: 'Z2 constante', en: 'Steady Z2' },
  upper_z2: { es: 'Z2 alta', en: 'Z2 upper end' },
  recover: { es: 'Recuperar', en: 'Recover' },
  tempo: { es: 'Tempo', en: 'Tempo' },
  sweet_spot: { es: 'Sweet spot', en: 'Sweet spot' },
  threshold: { es: 'Umbral', en: 'Threshold' },
  over: { es: 'Por encima', en: 'Over' },
  under: { es: 'Por debajo', en: 'Under' },
  prime: { es: 'Activación', en: 'Prime' },
  vo2max: { es: 'VO2max', en: 'VO2max' },
  sprint: { es: 'Sprint', en: 'Sprint' },
  climb: { es: 'Subida (cadencia baja 60-70rpm)', en: 'Climb (low cadence 60-70rpm)' },
  opener: { es: 'Activación', en: 'Opener' },
  max_effort: { es: 'Esfuerzo máximo sostenible', en: 'Max sustainable effort' },
};

export const DAY_TYPES = {
  rest: { es: 'Día de descanso', en: 'Rest day' },
  easy: { es: 'Día suave', en: 'Easy day' },
  moderate: { es: 'Día moderado', en: 'Moderate day' },
  hard: { es: 'Día duro', en: 'Hard day' },
  long: { es: 'Día largo', en: 'Long day' },
};

export function pick(dict, lang, fallback) {
  return dict?.[lang] ?? dict?.[DEFAULT_LANG] ?? fallback ?? '';
}

export function tProgram(id, lang) {
  return pick(PROGRAMS_TEXT[id], lang, { name: id, tagline: '', description: '' });
}

export function tPhase(key, lang) {
  return pick(PHASES[key], lang, key);
}

export function tWorkout(key, lang) {
  return pick(WORKOUTS_TEXT[key], lang, { title: key, description: '', purpose: '', coachTip: '', indoorTip: '', outdoorTip: '' });
}

export const MEAL_SLOTS = {
  breakfast: { es: 'Desayuno', en: 'Breakfast' },
  lunch: { es: 'Comida', en: 'Lunch' },
  snack: { es: 'Merienda', en: 'Snack' },
  dinner: { es: 'Cena', en: 'Dinner' },
};

export function tMealSlot(key, lang) {
  return pick(MEAL_SLOTS[key], lang, key);
}

const MENU_UI = {
  menuWord: { es: 'Menú', en: 'Menu' },
};

export function tMenuUI(key, lang) {
  return pick(MENU_UI[key], lang, key);
}

// Compares an athlete's actual target calories for the day against a menu template's
// reference calories and returns a plain-language portion-adjustment note. These are
// suggested home-cooked menus, not gram-precise meal prep, so we nudge rather than
// pretend false precision.
export function tMenuScaleHint(lang, factor) {
  const pct = Math.round((factor - 1) * 100);
  if (pct > 8) {
    return pick(
      { es: `Aumenta un poco las raciones (~${pct}% más) para llegar a tu objetivo de hoy.`, en: `Bump portions up a bit (~${pct}% more) to hit today's target.` },
      lang
    );
  }
  if (pct < -8) {
    const abs = Math.abs(pct);
    return pick(
      { es: `Recorta un poco las raciones (~${abs}% menos) para ajustarte a tu objetivo de hoy.`, en: `Trim portions a bit (~${abs}% less) to match today's target.` },
      lang
    );
  }
  return pick(
    { es: 'Estas raciones ya se ajustan bien a tu objetivo de hoy.', en: "These portions already match today's target well." },
    lang
  );
}

export function tSegmentNote(key, lang) {
  return pick(SEGMENT_NOTES[key], lang, key);
}

export function tDayType(key, lang) {
  return pick(DAY_TYPES[key], lang, key);
}

// --- Fueling guidance (nutrition/engine.js) --------------------------------------
const FUELING = {
  restDay: {
    es: 'No necesitas fuel especial — día de descanso.',
    en: 'No fueling needed — rest day.',
  },
  restAfter: {
    es: 'Comidas normales y equilibradas; prioriza la proteína.',
    en: 'Normal balanced meals; prioritize protein.',
  },
  preIntense: {
    es: '1-4g de carbohidratos/kg en las 1-4h previas, bajo en grasa/fibra para que siente bien. Un plátano o tostada con miel 30-60min antes funciona bien.',
    en: '1-4g carbs/kg in the 1-4h before, low fat/fiber to sit well. A banana or toast with honey 30-60min out works well.',
  },
  preEasy: {
    es: 'Carbohidratos ligeros si no buscas rodar en ayunas; si no, comida normal 2-3h antes.',
    en: 'Light carbs if fasted riding isn\'t the goal; otherwise normal meal 2-3h prior.',
  },
  duringWaterOnly: {
    es: 'Solo agua, o electrolitos si hace calor o es largo.',
    en: 'Water only, or electrolytes if hot/long.',
  },
  duringModerate: {
    es: '30-60g de carbohidratos/hora (geles, bebida deportiva).',
    en: '30-60g carbs/hour (gels, sports drink).',
  },
  duringLong: {
    es: '60-90g de carbohidratos/hora usando varias fuentes transportables (glucosa+fructosa), más electrolitos.',
    en: '60-90g carbs/hour using multiple transportable carb sources (glucose+fructose), plus electrolytes.',
  },
  postIntense: {
    es: '20-25g de proteína de calidad + 1-1,2g de carbohidratos/kg en las 2h siguientes para arrancar la recuperación.',
    en: '20-25g high-quality protein + 1-1.2g carbs/kg within ~2h to kickstart recovery.',
  },
  postEasy: {
    es: 'La siguiente comida normal con una fuente de proteína es suficiente.',
    en: 'Normal next meal with a protein source is sufficient.',
  },
};

export function tFueling(lang, { isRest, minutes, intense }) {
  if (isRest) {
    return { pre: pick(FUELING.restDay, lang), during: '—', post: pick(FUELING.restAfter, lang) };
  }
  const pre = intense ? pick(FUELING.preIntense, lang) : pick(FUELING.preEasy, lang);
  let during = pick(FUELING.duringWaterOnly, lang);
  if (minutes > 60 && minutes <= 120) during = pick(FUELING.duringModerate, lang);
  if (minutes > 120) during = pick(FUELING.duringLong, lang);
  const post = intense || minutes > 90 ? pick(FUELING.postIntense, lang) : pick(FUELING.postEasy, lang);
  return { pre, during, post };
}

// --- Adaptation reasons (training/adapt.js) --------------------------------------
export function tAdaptReason(lang, kind, params = {}) {
  const pct = params.pct;
  const table = {
    onTarget: { es: 'en línea con el objetivo — sin cambios', en: 'on target — no change' },
    lowCompliance: {
      es: `cumplimiento bajo (${pct}%) la semana pasada — reduciendo el volumen`,
      en: `low compliance (${pct}%) last week — cutting volume back`,
    },
    partialCompliance: {
      es: `cumplimiento parcial (${pct}%) la semana pasada — recortando volumen ligeramente`,
      en: `partial compliance (${pct}%) last week — trimming volume slightly`,
    },
    strongCompliance: {
      es: `buen cumplimiento (${pct}%) y buena forma — pequeña sobrecarga extra`,
      en: `strong compliance (${pct}%) and good form — small extra overload`,
    },
    fatigueCap: {
      es: '; la forma está muy fatigada (TSB < -25) — limitando la carga sin importar el cumplimiento',
      en: '; form is very fatigued (TSB < -25) — capping load regardless of compliance',
    },
  };
  return pick(table[kind], lang, '');
}

export function tAdaptMessage(lang, kind, params = {}) {
  const table = {
    noCompletedWeek: { es: 'Aún no hay una semana completada para adaptar.', en: 'No completed week yet to adapt from.' },
    planComplete: { es: 'Plan completado — no queda ninguna semana futura.', en: 'Plan complete — no upcoming week to adapt.' },
    alreadyAdapted: { es: `La semana ${params.week} ya fue adaptada.`, en: `Week ${params.week} already adapted.` },
  };
  return pick(table[kind], lang, '');
}

// --- Import errors (import/routes.js) --------------------------------------------
const IMPORT_ERRORS = {
  fileTooLarge: {
    es: 'El archivo es demasiado grande. Para archivos grandes de Strava, descomprímelo tú mismo y sube solo activities.csv.',
    en: 'File is too large. For big Strava archives, unzip it yourself and upload just activities.csv instead.',
  },
  noFile: {
    es: 'No se subió ningún archivo (se esperaba el campo "file").',
    en: 'No file uploaded (expected field name "file").',
  },
  csvNotFoundInZip: {
    es: 'No se encontró activities.csv dentro de ese ZIP. Asegúrate de subir el archivo completo de exportación de Strava.',
    en: 'Could not find activities.csv inside that ZIP. Make sure you uploaded the full Strava export archive.',
  },
  noTrackPoints: {
    es: 'No se pudo leer ningún punto de recorrido en ese archivo — ¿es una exportación GPX o TCX válida?',
    en: 'Could not read any track points from that file — is it a valid GPX or TCX export?',
  },
  csvParsePrefix: { es: 'No se pudo procesar ese CSV: ', en: 'Could not parse that CSV: ' },
  zipReadPrefix: { es: 'No se pudo leer ese ZIP: ', en: 'Could not read that ZIP: ' },
  filePrefix: { es: 'No se pudo procesar ese archivo: ', en: 'Could not parse that file: ' },
};

export function tImportError(lang, kind) {
  return pick(IMPORT_ERRORS[kind], lang, '');
}

// --- System/auth messages (index.js, middleware/auth.js) --------------------------
const SYSTEM = {
  internalError: { es: 'Error interno del servidor', en: 'Internal server error' },
  unauthorized: { es: 'No autorizado', en: 'Unauthorized' },
};

export function tSystem(lang, kind) {
  return pick(SYSTEM[kind], lang, '');
}

// --- Auth messages (auth/routes.js) -----------------------------------------------
const AUTH_TEXT = {
  invalidSignupCode: { es: 'Código de invitación incorrecto.', en: 'Invalid invite code.' },
  invalidEmail: { es: 'Introduce un correo electrónico válido.', en: 'Enter a valid email address.' },
  passwordTooShort: { es: 'La contraseña debe tener al menos 8 caracteres.', en: 'Password must be at least 8 characters.' },
  emailTaken: { es: 'Ya existe una cuenta con ese correo.', en: 'An account with that email already exists.' },
  invalidCredentials: { es: 'Correo o contraseña incorrectos.', en: 'Incorrect email or password.' },
};

export function tAuth(lang, kind) {
  return pick(AUTH_TEXT[kind], lang, '');
}

// --- Nutrition adaptive calorie messages (nutrition/engine.js) --------------------
export function tNutritionAdaptive(lang, kind, params = {}) {
  const table = {
    needsMoreData: {
      es: 'Registra tu peso durante ~2 semanas para desbloquear el ajuste calórico adaptativo.',
      en: 'Log weigh-ins for ~2 weeks to unlock adaptive calorie adjustment.',
    },
    notEnoughData: { es: 'Aún no hay suficientes datos.', en: 'Not enough data yet.' },
    notWeightFocused: {
      es: 'El objetivo no está centrado en el peso — no se aplica ajuste calórico.',
      en: 'Goal is not weight-focused — no calorie adjustment applied.',
    },
    onTarget: {
      es: 'La tendencia de peso va en línea con el objetivo — sin cambios.',
      en: 'Weight trend is tracking the goal rate — no change.',
    },
    behind: {
      es: `La tendencia de peso (${params.actual} kg/sem) va por detrás del objetivo de ${params.goal} kg/sem — recortando ~100 kcal/día.`,
      en: `Weight trend (${params.actual} kg/wk) is behind the ${params.goal} kg/wk goal — trimming ~100 kcal/day.`,
    },
    ahead: {
      es: `Perdiendo más rápido que el objetivo de ${params.goal} kg/sem (${params.actual} kg/sem) — añadiendo ~100 kcal/día para proteger el rendimiento y el músculo.`,
      en: `Losing faster than the ${params.goal} kg/wk target (${params.actual} kg/wk) — adding ~100 kcal/day back to protect performance and muscle.`,
    },
  };
  return pick(table[kind], lang, '');
}
