// 바닥/벽/소품 도트. 문자 = data/palette.json 의 key, '.' = 투명.

// 체크무늬 밝은 칸. 기계·물건이 눈에 들어오도록 바닥은 차분한 중간 톤에 대비를 낮게. 얼룩 점은 불규칙하게.
export const FLOOR_LIGHT = [
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaeaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaeaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaAaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
];

export const FLOOR_DARK = [
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAeAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAeAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
];

// 금 간 밝은 칸
export const FLOOR_LIGHT_CRACK = [
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaeaaaaaaaaaa',
  'aaaaaaeaaaaaaaaa',
  'aaaaaaeeaaaaaaaa',
  'aaaaaaaaeaaaaaaa',
  'aaaaaaaaeaaaaaaa',
  'aaaaaaaeaeaaaaaa',
  'aaaaaaaaaaeaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaeaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
];

// 기름 얼룩 진 짙은 칸
export const FLOOR_DARK_OIL = [
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAeeeAAAAAAA',
  'AAAAAeeeeeAAAAAA',
  'AAAAAeeeeeAAAAAA',
  'AAAAAAeeeAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
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

// 가게 앞 길 (보도블록): 바닥처럼 차분하게, 이음매만
export const STREET = [
  'AAAAAAAeAAAAAAAA',
  'AAAAAAAeAAAAAAAA',
  'AAAAAAAeAAAAAAAA',
  'AAAAAAAeAAAAAAAA',
  'AAAAAAAeAAAAAAAA',
  'eeeeeeeeeeeeeeee',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAeAAAA',
  'AAAAAAAAAAAeAAAA',
  'eeeeeeeeeeeeeeee',
  'AAAAAeAAAAAAAAAA',
  'AAAAAeAAAAAAAAAA',
  'AAAAAeAAAAAAAAAA',
  'AAAAAeAAAAAAAAAA',
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
