// 플레이어 도트. 머리/몸/다리를 조합해 방향별 프레임을 만든다.

const HEAD_DOWN = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....kssssssk....',
  '....ksKssKsk....',
  '....kSssssSk....',
  '.....kkkkkk.....',
];

const HEAD_UP = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....kShhhhSk....',
  '.....kkkkkk.....',
];

const HEAD_RIGHT = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhhk...',
  '....khhhsssk....',
  '....khhssKsk....',
  '....khSsssssk...',
  '.....kkkkkk.....',
];

const BODY_DOWN = [
  '....kpyppypk....',
  '...ksppppppsk...',
  '...kSppppppSk...',
  '....kPPPPPPk....',
];

const BODY_UP = [
  '....kpPppPpk....',
  '...ksppppppsk...',
  '...kSppppppSk...',
  '....kPPPPPPk....',
];

const BODY_RIGHT = [
  '.....kpypPk.....',
  '.....kppssk.....',
  '.....kpPSSk.....',
  '.....kPPPPk.....',
];

const LEGS_FRONT_IDLE = [
  '....kPk..kPk....',
  '....kKk..kKk....',
  '................',
  '................',
];
const LEGS_FRONT_A = [
  '....kPk..kKk....',
  '....kKk.........',
  '................',
  '................',
];
const LEGS_FRONT_B = [
  '....kKk..kPk....',
  '.........kKk....',
  '................',
  '................',
];

const LEGS_SIDE_IDLE = [
  '......kPPk......',
  '......kKKKk.....',
  '................',
  '................',
];
const LEGS_SIDE_A = [
  '.....kPk.kPk....',
  '....kKk...kKk...',
  '................',
  '................',
];

const compose = (...parts) => parts.flat();

// 프레임 0 = 서 있기, 1~2 = 걷기 (프레임 스왑)
export const PLAYER_DOWN = [
  compose(HEAD_DOWN, BODY_DOWN, LEGS_FRONT_IDLE),
  compose(HEAD_DOWN, BODY_DOWN, LEGS_FRONT_A),
  compose(HEAD_DOWN, BODY_DOWN, LEGS_FRONT_B),
];

export const PLAYER_UP = [
  compose(HEAD_UP, BODY_UP, LEGS_FRONT_IDLE),
  compose(HEAD_UP, BODY_UP, LEGS_FRONT_A),
  compose(HEAD_UP, BODY_UP, LEGS_FRONT_B),
];

// 왼쪽은 런타임에 좌우 반전
export const PLAYER_RIGHT = [
  compose(HEAD_RIGHT, BODY_RIGHT, LEGS_SIDE_IDLE),
  compose(HEAD_RIGHT, BODY_RIGHT, LEGS_SIDE_A),
  compose(HEAD_RIGHT, BODY_RIGHT, LEGS_SIDE_IDLE),
];

// 발밑 그림자 (바닥 그늘 색, 반투명 대신 팔레트 색 사용)
export const SHADOW = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....nnnnnnnn....',
  '.....nnnnnn.....',
  '................',
];
