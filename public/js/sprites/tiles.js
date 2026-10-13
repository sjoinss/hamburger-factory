// 바닥/벽/소품 도트. 문자 = data/palette.json 의 key, '.' = 투명.

// 체크무늬 밝은 칸. 얼룩 점 위치는 일부러 불규칙하게.
export const FLOOR_LIGHT = [
  'ffffffffffffffff',
  'ffffffffffffffff',
  'fffffffffffnffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffnfffffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'fffffffffffffFff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'fffffFffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
];

export const FLOOR_DARK = [
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFnFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFnFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFnFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFnFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
];

// 금 간 밝은 칸
export const FLOOR_LIGHT_CRACK = [
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'fffffnffffffffff',
  'ffffffnfffffffff',
  'ffffffnnffffffff',
  'ffffffffnfffffff',
  'ffffffffnfffffff',
  'fffffffnfnffffff',
  'fffffffnffnfffff',
  'ffffffffffffnfff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffffffffffffffff',
  'ffnfffffffffffff',
  'ffffffffffffffff',
];

// 기름 얼룩 진 짙은 칸
export const FLOOR_DARK_OIL = [
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFnnnFFFFFFF',
  'FFFFFnndnnFFFFFF',
  'FFFFnnddddnFFFFF',
  'FFFFFnddddnnFFFF',
  'FFFFFnnddnnFFFFF',
  'FFFFFFnnnnFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFnFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
];

// 철판 벽. 이음매와 리벳 위치를 칸마다 다르게.
export const WALL = [
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  'w3wwwwwwwwwwww3w',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'KKKKKKKKKKKKKKKK',
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  'ww3wwwwwwwwww3ww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'KKKKKKKKKKKKKKKK',
];

// 녹물이 흘러내린 벽
export const WALL_RUST = [
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  'w3wwwwwwwwwwwr3w',
  'wwwwwwwwwwwwwrww',
  'wwwwwwwwwwwwwrww',
  'wwwwwwwwwwwwdrww',
  'wwwwwwwwwwwwwdww',
  'KKKKKKKKKKKKKKKK',
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwrww',
  'w3wwwwwwwwwwwdww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwww3www',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'KKKKKKKKKKKKKKKK',
];

// 재료 상자 (나무 판자 + 철 모서리)
export const CRATE = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.k2bbbbbbbbbb2k.',
  '.kbbbbbbbbbbbBk.',
  '.kBBBBBBBBBBBBk.',
  '.kddddddddddddk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbdbbbbBk.',
  '.kBBBBBBBBBBBBk.',
  '.kddddddddddddk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbBbbbbbbbBk.',
  '.k2BBBBBBBBBB2k.',
  '.kkkkkkkkkkkkkk.',
  '..KKKKKKKKKKKKKK',
  '................',
];

// 가게 앞 길 (보도블록): 칸마다 이음매, 군데군데 금
export const STREET = [
  '2222222122222222',
  '3333333133333333',
  '2222222122222222',
  '2222222122222222',
  '2222222122222222',
  '1111111111111111',
  '2222222222212222',
  '3333333333313333',
  '2222222222212222',
  '2222n22222212222',
  '22222n2222212222',
  '1111111111111111',
  '2222212222222222',
  '3333313333333333',
  '2222212222222222',
  '2222212222222222',
];

// 출고구 뒤 창구: 벽 안에 유리창 (손님이 들여다보는 곳)
export const WINDOW = [
  'WWWWWWWWWWWWWWWW',
  'wKKKKKKKKKKKKKKw',
  'wK3pppppppppp3Kw',
  'wKp3ppppppppppKw',
  'wKpp3pppppppppKw',
  'wKppppppppppppKw',
  'wKppppppppp3ppKw',
  'wKpppppppppp3pKw',
  'wKKKKKKKKKKKKKKw',
  'wwwwwwwwwwwwwwww',
  'w2222222222222ww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'KKKKKKKKKKKKKKKK',
];
