// Ship roles and the class triangle. Interceptors beat Battleships, Battleships beat
// Explorers, Explorers beat Interceptors. Survey ships are the miners and haulers; Carriers launch fighters.
export const ROLES_INFO = {
  interceptor: {
    name: 'Interceptor',
    short: 'INT',
    color: '#ff8a5a',
    icon: '▲',
    desc: 'Fast and agile. Strong against Battleships, weak against Explorers.',
  },
  explorer: {
    name: 'Explorer',
    short: 'EXP',
    color: '#7ad0ff',
    icon: '◆',
    desc: 'Balanced and far-ranging. Strong against Interceptors, weak against Battleships.',
  },
  battleship: {
    name: 'Battleship',
    short: 'BAT',
    color: '#ff5a5a',
    icon: '■',
    desc: 'Heavy armor and firepower. Strong against Explorers, weak against Interceptors.',
  },
  survey: {
    name: 'Survey',
    short: 'SRV',
    color: '#ffd27a',
    icon: '●',
    desc: 'Miners and haulers: +50% mining yield, but they fight poorly (-20% damage).',
  },
  carrier: {
    name: 'Carrier',
    short: 'CAR',
    color: '#c8a0ff',
    icon: '✚',
    desc: 'Launch fighters. Outside the triangle.',
  },
};
export const BEATS = { interceptor: 'battleship', battleship: 'explorer', explorer: 'interceptor' };
export const COUNTER = { dmg: 1.15, taken: 0.9, survey: 0.8, surveyMining: 50 };
const OVERRIDE = { 735: 'explorer', 716: 'battleship' }; // the Halo Surveyor is a scout, the Tempest a destroyer
export function roleOf(hull, weapons) {
  if (!hull) return 'explorer';
  if (hull.role) return hull.role;
  if (OVERRIDE[hull.id]) return OVERRIDE[hull.id];
  // Explicit roles and legacy hull overrides take precedence over inferred roles.
  if (weapons && (hull.weapons || []).some(([id]) => weapons[id] && weapons[id].type === 'bay'))
    return 'carrier';
  const durability = (hull.shield || 0) + (hull.armor || 0);
  if ((hull.cargo || 0) >= 45 && hull.cargo >= (hull.strength || 0) * 0.9) return 'survey';
  if ((hull.speed || 0) >= 450) return 'interceptor';
  if (durability >= 1900 && (hull.speed || 0) <= 430) return 'battleship';
  return 'explorer';
}
// Counter bonuses and survey penalties compose multiplicatively, not additively.
export function roleMult(attackerRole, targetRole) {
  if (!attackerRole || !targetRole) return 1;
  let multiplier = 1;
  if (BEATS[attackerRole] === targetRole) multiplier *= COUNTER.dmg;
  if (BEATS[targetRole] === attackerRole) multiplier *= COUNTER.taken;
  if (attackerRole === 'survey') multiplier *= COUNTER.survey;
  return multiplier;
}
