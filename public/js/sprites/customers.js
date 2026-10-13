// 손님 도트. 머리(H)·옷(C/D) 자리를 문자로 비워 두고, 렌더에서 손님마다 팔레트 색으로 바꿔 끼운다.

const HEAD = [
  '................',
  '.....kkkkkk.....',
  '....kHHHHHHk....',
  '....kHHHHHHk....',
  '....kssssssk....',
];
const FACE_IDLE = [
  '....ksKssKsk....',
  '....kSssssSk....',
  '.....kkkkkk.....',
];
const FACE_HAPPY = [
  '....ksKssKsk....',
  '....kSsKKsSk....',
  '.....kkkkkk.....',
];
const FACE_SAD = [
  '....kskssksk....',
  '....kSsKKsSk....',
  '.....kkkkkk.....',
];
const BODY = [
  '....kCCCCCCk....',
  '...ksCCCCCCsk...',
  '...kSCCCCCCSk...',
  '....kDDDDDDk....',
];
// 기쁠 때: 두 팔을 번쩍
const BODY_HAPPY = [
  '..ks.CCCCCC.sk..',
  '...kkCCCCCCkk...',
  '....kCCCCCCk....',
  '....kDDDDDDk....',
];
const LEGS = [
  '....kKk..kKk....',
  '....kKk..kKk....',
  '................',
  '................',
];

// 0 = 기다림, 1 = 기쁨, 2 = 실망 (고개를 한 칸 숙인다)
export const CUSTOMER = [
  [...HEAD, ...FACE_IDLE, ...BODY, ...LEGS],
  [...HEAD, ...FACE_HAPPY, ...BODY_HAPPY, ...LEGS],
  ['................', ...HEAD, ...FACE_SAD, ...BODY, ...LEGS.slice(0, 3)],
];

/** 머리색 (H) 후보, 옷색 (C 밝은 면, D 어두운 면) 후보. 모두 팔레트 key. */
export const HAIR_COLORS = ['h', 'k', 'B', 'o'];
export const SHIRT_COLORS = [['t', 'R'], ['g', 'G'], ['o', 'r'], ['W', 'w'], ['y', 'B']];

// 숫자 3x5 (말풍선 수량용)
export const DIGITS = {
  0: ['KKK', 'K.K', 'K.K', 'K.K', 'KKK'],
  1: ['.K.', 'KK.', '.K.', '.K.', 'KKK'],
  2: ['KKK', '..K', 'KKK', 'K..', 'KKK'],
  3: ['KKK', '..K', '.KK', '..K', 'KKK'],
  4: ['K.K', 'K.K', 'KKK', '..K', '..K'],
  5: ['KKK', 'K..', 'KKK', '..K', 'KKK'],
  6: ['KKK', 'K..', 'KKK', 'K.K', 'KKK'],
  7: ['KKK', '..K', '.K.', '.K.', '.K.'],
  8: ['KKK', 'K.K', 'KKK', 'K.K', 'KKK'],
  9: ['KKK', 'K.K', 'KKK', '..K', 'KKK'],
  x: ['...', 'K.K', '.K.', 'K.K', '...'],
};
