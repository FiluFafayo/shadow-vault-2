// Shadow Vault — level data and tuning.
// The playfield is a 32 x 20 tile grid (tile = 40 px, canvas 1280 x 800).
// Map legend: '#' wall, '.' floor, 'C' crate, 'O' pillar, 'P' plant,
// 'S' player start, 'E' exit, '1'..'4' artifacts (gems to steal).
// Crates, pillars and plants are cover: they block movement and sight.
// Guards patrol the waypoint loops listed per level (tile coordinates).

export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const VIEW_WIDTH = COLS * TILE;
export const VIEW_HEIGHT = ROWS * TILE;

export const PLAYER_WALK_SPEED = 155;
export const PLAYER_SNEAK_SPEED = 88;
export const GUARD_PATROL_SPEED = 58;
export const GUARD_SUSPICIOUS_SPEED = 86;
export const GUARD_CHASE_SPEED = 138;

export const CONE_RANGE = 235;
export const CONE_HALF_ANGLE = 0.61; // ~35 degrees each side
export const DETECT_RATE_CLOSE = 62; // detection points per second, point blank
export const DETECT_RATE_FAR = 20; // detection points per second, cone edge
export const DETECT_DECAY = 26;
export const SNEAK_DETECT_FACTOR = 0.45;
export const ALARM_COOLDOWN_SECONDS = 5;

export const NOISE_WALK_RADIUS = 95;
export const NOISE_SNEAK_RADIUS = 32;

export const LEVELS = [
  {
    name: 'The Moonlit Gallery',
    parSeconds: 150,
    map: [
      '################################',
      '#S.............................#',
      '#...C......1.......C......2....#',
      '#..............................#',
      '#.....P.........#####..........#',
      '#..............#...#...........#',
      '#..O...........#.3.#......O....#',
      '#..............#...............#',
      '#.....C.........#####.....C....#',
      '#..............................#',
      '#..........C........C..........#',
      '#..............................#',
      '#..P.............O.........P...#',
      '#..............................#',
      '#.....C......C......C......C...#',
      '#..............................#',
      '#..........O.........O.........#',
      '#..........................E...#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { patrol: [[7, 3], [24, 3]], pause: 1.2 },
      { patrol: [[15, 11], [15, 17], [24, 17], [24, 11]], pause: 0.8 },
      { patrol: [[25, 13], [6, 13]], pause: 1.0 },
    ],
  },
  {
    name: 'The Vault Wing',
    parSeconds: 180,
    map: [
      '################################',
      '#S......C..........C...........#',
      '#...........1..........2.......#',
      '#..P...........................#',
      '#...........######.............#',
      '#..C........#....#.......C.....#',
      '#...........#.3..#......O......#',
      '#...........#...........O......#',
      '#...........######.......C.....#',
      '#..............................#',
      '#....O..........C..............#',
      '#..............................#',
      '#...........##########.........#',
      '#..C........#........#....P....#',
      '#...........#...4....#....C....#',
      '#...........#.............C....#',
      '#...........##########.........#',
      '#..............................#',
      '#..P...........O...........E...#',
      '################################',
    ],
    guards: [
      { patrol: [[6, 2], [23, 2], [23, 9], [6, 9]], pause: 0.9 },
      { patrol: [[15, 11], [24, 11]], pause: 1.0 },
      { patrol: [[27, 11], [27, 17], [10, 17], [10, 11]], pause: 0.7 },
      { patrol: [[9, 17], [22, 17]], pause: 1.4 },
    ],
  },
  {
    name: 'The Crown Chamber',
    parSeconds: 210,
    map: [
      '################################',
      '#S...C.......C.......C.........#',
      '#...........1..................#',
      '#..P...........................#',
      '#.......#######....#######.....#',
      '#.......#.....#...#.....#......#',
      '#..O....#.2...#...#.3...#..O...#',
      '#.......#.....#...#.....#......#',
      '#.......###.###....###.###.....#',
      '#..............................#',
      '#..C........C.......C..........#',
      '#..............................#',
      '#........###############.......#',
      '#..P.....#.............#...P...#',
      '#..O.....#......4......#...O...#',
      '#..O.....#.................O...#',
      '#........###############.......#',
      '#..............................#',
      '#..C........C.......C......E...#',
      '################################',
    ],
    guards: [
      { patrol: [[5, 2], [26, 2]], pause: 0.8 },
      { patrol: [[10, 6], [13, 6]], pause: 0.6 },
      { patrol: [[19, 6], [22, 6]], pause: 0.6 },
      { patrol: [[27, 11], [6, 11]], pause: 1.1 },
      { patrol: [[9, 17], [22, 17]], pause: 0.7 },
    ],
  },
];

/** Parse one level map into walls, cover, artifacts, start and exit (pixel coords). */
export function parseLevel(level) {
  const walls = [];
  const cover = [];
  const artifacts = [];
  let start = null;
  let exit = null;
  for (let row = 0; row < ROWS; row += 1) {
    const line = level.map[row];
    for (let col = 0; col < COLS; col += 1) {
      const ch = line[col];
      const x = col * TILE;
      const y = row * TILE;
      if (ch === '#') walls.push({ x, y, w: TILE, h: TILE });
      else if (ch === 'C') cover.push({ x, y, w: TILE, h: TILE, kind: 'crate' });
      else if (ch === 'O') cover.push({ x, y, w: TILE, h: TILE, kind: 'pillar' });
      else if (ch === 'P') cover.push({ x, y, w: TILE, h: TILE, kind: 'plant' });
      else if (ch === 'S') start = { x: x + TILE / 2, y: y + TILE / 2 };
      else if (ch === 'E') exit = { x: x + TILE / 2, y: y + TILE / 2, w: TILE, h: TILE };
      else if (ch >= '1' && ch <= '9') artifacts.push({ x: x + TILE / 2, y: y + TILE / 2, id: ch, taken: false });
    }
  }
  return { walls, cover, artifacts, start, exit };
}
