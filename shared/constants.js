const CONSTANTS = {
  TILE_SIZE: 32,
  MAP_WIDTH: 100,
  MAP_HEIGHT: 100,
  CHUNK_SIZE: 16,

  CLASSES: {
    WARRIOR: { id: 1, name: '워리어', nameEn: 'Warrior', baseHP: 200, baseMP: 50, baseATK: 15, baseDEF: 12, baseSpeed: 3 },
    MAGE: { id: 2, name: '메이지', nameEn: 'Mage', baseHP: 100, baseMP: 200, baseATK: 20, baseDEF: 5, baseSpeed: 3.5 },
    ROGUE: { id: 3, name: '로그', nameEn: 'Rogue', baseHP: 130, baseMP: 80, baseATK: 18, baseDEF: 8, baseSpeed: 5 },
    HEALER: { id: 4, name: '힐러', nameEn: 'Healer', baseHP: 120, baseMP: 180, baseATK: 8, baseDEF: 7, baseSpeed: 3.2 }
  },

  WORD_DIFFICULTY: {
    EASY: { level: 1, minPlayerLevel: 1, timeLimit: 10000 },
    NORMAL: { level: 2, minPlayerLevel: 5, timeLimit: 8000 },
    HARD: { level: 3, minPlayerLevel: 15, timeLimit: 6000 },
    EXPERT: { level: 4, minPlayerLevel: 30, timeLimit: 5000 },
    MASTER: { level: 5, minPlayerLevel: 50, timeLimit: 4000 }
  },

  ZONES: {
    STARTING_VILLAGE: { id: 'starting_village', name: '여명의 마을', levelRange: [1, 5], safeZone: true },
    FOREST_OF_WORDS: { id: 'forest_of_words', name: '단어의 숲', levelRange: [1, 10], safeZone: false },
    DARK_PLAINS: { id: 'dark_plains', name: '어둠의 평원', levelRange: [8, 20], safeZone: false },
    CRYSTAL_CAVE: { id: 'crystal_cave', name: '수정 동굴', levelRange: [15, 30], safeZone: false },
    ANCIENT_RUINS: { id: 'ancient_ruins', name: '고대 유적', levelRange: [25, 45], safeZone: false },
    DRAGON_PEAK: { id: 'dragon_peak', name: '용의 봉우리', levelRange: [40, 60], safeZone: false },
    SHADOW_REALM: { id: 'shadow_realm', name: '그림자 영역', levelRange: [50, 80], safeZone: false },
    ABYSS_GATE: { id: 'abyss_gate', name: '심연의 문', levelRange: [70, 99], safeZone: false }
  },

  EXP_TABLE: Array.from({ length: 99 }, (_, i) => Math.floor(100 * Math.pow(1.15, i))),

  ITEM_GRADES: {
    COMMON: { id: 0, name: '일반', color: '#CCCCCC' },
    UNCOMMON: { id: 1, name: '고급', color: '#00FF00' },
    RARE: { id: 2, name: '희귀', color: '#0088FF' },
    EPIC: { id: 3, name: '영웅', color: '#AA00FF' },
    LEGENDARY: { id: 4, name: '전설', color: '#FF8800' },
    MYTHIC: { id: 5, name: '신화', color: '#FF0044' }
  },

  SERVER_TICK_RATE: 20,
  CLIENT_LERP: 0.1,

  COMBAT_RANGE: 48,
  MAGIC_RANGE: 160,
  MONSTER_AGGRO_RANGE: 120,
  MONSTER_DEAGGRO_RANGE: 200,

  DROP_RATES: {
    COMMON: 0.5,
    UNCOMMON: 0.25,
    RARE: 0.08,
    EPIC: 0.02,
    LEGENDARY: 0.005,
    MYTHIC: 0.001
  }
};

if (typeof module !== 'undefined') module.exports = CONSTANTS;
