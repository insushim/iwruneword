const CONSTANTS = {
  TILE_SIZE: 32,
  MAP_WIDTH: 1200,
  MAP_HEIGHT: 900,
  CHUNK_SIZE: 16,
  WORLD_WIDTH: 38400,
  WORLD_HEIGHT: 28800,

  CLASSES: {
    WARRIOR: { id: 1, name: '워리어', nameEn: 'Warrior', baseHP: 200, baseMP: 50, baseATK: 15, baseDEF: 12, baseSpeed: 3, color: '#dd4444', icon: '⚔️' },
    MAGE: { id: 2, name: '메이지', nameEn: 'Mage', baseHP: 100, baseMP: 200, baseATK: 20, baseDEF: 5, baseSpeed: 3.5, color: '#4488dd', icon: '🔮' },
    ROGUE: { id: 3, name: '로그', nameEn: 'Rogue', baseHP: 130, baseMP: 80, baseATK: 18, baseDEF: 8, baseSpeed: 5, color: '#44dd44', icon: '🗡️' },
    HEALER: { id: 4, name: '힐러', nameEn: 'Healer', baseHP: 120, baseMP: 180, baseATK: 8, baseDEF: 7, baseSpeed: 3.2, color: '#dddd44', icon: '✨' },
    ARCHER: { id: 5, name: '아처', nameEn: 'Archer', baseHP: 110, baseMP: 100, baseATK: 22, baseDEF: 6, baseSpeed: 4.2, color: '#88dd44', icon: '🏹' }
  },

  SKILLS: {
    WARRIOR: [
      { id: 'power_strike', name: '강타', icon: '💥', level: 1, cooldown: 5000, mpCost: 10, desc: '다음 공격 데미지 1.5배', type: 'buff', effect: { dmgMult: 1.5, duration: 10000 } },
      { id: 'shield_wall', name: '방패의 벽', icon: '🛡️', level: 5, cooldown: 15000, mpCost: 20, desc: '방어력 50% 상승 (12초)', type: 'buff', effect: { defMult: 1.5, duration: 12000 } },
      { id: 'war_cry', name: '전투 함성', icon: '📯', level: 15, cooldown: 30000, mpCost: 30, desc: '공격력 30% 상승 (15초)', type: 'buff', effect: { atkMult: 1.3, duration: 15000 } },
      { id: 'berserker', name: '광전사', icon: '🔥', level: 25, cooldown: 60000, mpCost: 50, desc: '데미지 2배, 방어-50% (20초)', type: 'buff', effect: { dmgMult: 2, defMult: 0.5, duration: 20000 } }
    ],
    MAGE: [
      { id: 'mana_shield', name: '마나 실드', icon: '🔷', level: 1, cooldown: 10000, mpCost: 30, desc: 'MP로 피해 흡수 (10초)', type: 'buff', effect: { manaShield: true, duration: 10000 } },
      { id: 'arcane_focus', name: '집중', icon: '🎯', level: 5, cooldown: 12000, mpCost: 15, desc: '퀴즈 시간 +3초 (1회)', type: 'buff', effect: { timeBonus: 3000, charges: 1 } },
      { id: 'elemental_burst', name: '원소 폭발', icon: '💫', level: 15, cooldown: 25000, mpCost: 40, desc: '3회 데미지 2배', type: 'buff', effect: { dmgMult: 2, charges: 3 } },
      { id: 'time_warp', name: '시간 왜곡', icon: '⏳', level: 25, cooldown: 90000, mpCost: 80, desc: '모든 쿨다운 초기화', type: 'instant', effect: { resetCooldowns: true } }
    ],
    ROGUE: [
      { id: 'quick_strike', name: '속공', icon: '⚡', level: 1, cooldown: 4000, mpCost: 8, desc: '추가 공격 기회 (1회)', type: 'buff', effect: { extraAttack: true, charges: 1 } },
      { id: 'evasion', name: '회피', icon: '💨', level: 5, cooldown: 20000, mpCost: 20, desc: '오답 1회 무효화', type: 'buff', effect: { evadeWrong: 1 } },
      { id: 'critical_eye', name: '급소 포착', icon: '👁️', level: 15, cooldown: 25000, mpCost: 25, desc: '3회 크리티컬 (3배)', type: 'buff', effect: { dmgMult: 3, charges: 3 } },
      { id: 'shadow_step', name: '그림자 질주', icon: '🌀', level: 25, cooldown: 45000, mpCost: 35, desc: '이동속도 3배 (10초)', type: 'buff', effect: { speedMult: 3, duration: 10000 } }
    ],
    HEALER: [
      { id: 'heal', name: '치유', icon: '💚', level: 1, cooldown: 5000, mpCost: 15, desc: 'HP 25% 즉시 회복', type: 'instant', effect: { healPct: 0.25 } },
      { id: 'bless', name: '축복', icon: '🌟', level: 5, cooldown: 20000, mpCost: 25, desc: '경험치 50% 추가 (30초)', type: 'buff', effect: { expMult: 1.5, duration: 30000 } },
      { id: 'purify', name: '정화', icon: '✨', level: 15, cooldown: 25000, mpCost: 30, desc: '디버프 제거 + HP 30%', type: 'instant', effect: { cleanse: true, healPct: 0.3 } },
      { id: 'divine_shield', name: '신성 보호막', icon: '🔆', level: 25, cooldown: 120000, mpCost: 60, desc: '무적 5초', type: 'buff', effect: { invincible: true, duration: 5000 } }
    ],
    ARCHER: [
      { id: 'rapid_shot', name: '속사', icon: '🏹', level: 1, cooldown: 4000, mpCost: 8, desc: '2회 연속 공격 (1.2배)', type: 'buff', effect: { dmgMult: 1.2, charges: 2 } },
      { id: 'hawk_eye', name: '매의 눈', icon: '🦅', level: 5, cooldown: 15000, mpCost: 15, desc: '크리티컬 확률 증가 (10초)', type: 'buff', effect: { dmgMult: 2, duration: 10000 } },
      { id: 'arrow_rain', name: '화살비', icon: '🌧️', level: 15, cooldown: 25000, mpCost: 30, desc: '3회 데미지 1.8배', type: 'buff', effect: { dmgMult: 1.8, charges: 3 } },
      { id: 'wind_walk', name: '바람 걸음', icon: '💨', level: 25, cooldown: 40000, mpCost: 35, desc: '이동속도 2.5배 (12초)', type: 'buff', effect: { speedMult: 2.5, duration: 12000 } }
    ]
  },

  ACHIEVEMENTS: [
    { id: 'first_blood', name: '첫 전투', desc: '첫 몬스터 처치', icon: '⚔️', cond: { monstersKilled: 1 }, reward: { gold: 30 } },
    { id: 'hunter_10', name: '사냥꾼', desc: '몬스터 10마리 처치', icon: '🏹', cond: { monstersKilled: 10 }, reward: { gold: 100 } },
    { id: 'hunter_100', name: '학살자', desc: '몬스터 100마리 처치', icon: '💀', cond: { monstersKilled: 100 }, reward: { gold: 500 } },
    { id: 'word_10', name: '단어 학습자', desc: '10개 단어 정답', icon: '📖', cond: { wordsCorrect: 10 }, reward: { gold: 50 } },
    { id: 'word_100', name: '단어 수집가', desc: '100개 단어 정답', icon: '📚', cond: { wordsCorrect: 100 }, reward: { gold: 300 } },
    { id: 'word_500', name: '단어 박사', desc: '500개 단어 정답', icon: '🎓', cond: { wordsCorrect: 500 }, reward: { gold: 1000 } },
    { id: 'combo_5', name: '콤보 마스터', desc: '5연속 정답', icon: '🔥', cond: { maxCombo: 5 }, reward: { gold: 100 } },
    { id: 'combo_10', name: '콤보 킹', desc: '10연속 정답', icon: '👑', cond: { maxCombo: 10 }, reward: { gold: 300 } },
    { id: 'combo_20', name: '콤보 레전드', desc: '20연속 정답', icon: '🏆', cond: { maxCombo: 20 }, reward: { gold: 1000 } },
    { id: 'boss_kill', name: '보스 슬레이어', desc: '보스 몬스터 처치', icon: '🐉', cond: { bossKilled: 1 }, reward: { gold: 500 } },
    { id: 'level_10', name: '성장하는 모험가', desc: '레벨 10 달성', icon: '⬆️', cond: { level: 10 }, reward: { gold: 200 } },
    { id: 'level_25', name: '숙련된 전사', desc: '레벨 25 달성', icon: '🌟', cond: { level: 25 }, reward: { gold: 500 } },
    { id: 'level_50', name: '전설의 영웅', desc: '레벨 50 달성', icon: '💎', cond: { level: 50 }, reward: { gold: 2000 } },
    { id: 'rich_1k', name: '돈벌이', desc: '골드 1,000 보유', icon: '💰', cond: { gold: 1000 }, reward: { gold: 0 } },
    { id: 'rich_10k', name: '부자', desc: '골드 10,000 보유', icon: '💎', cond: { gold: 10000 }, reward: { gold: 0 } },
    { id: 'perfect_10', name: '완벽주의자', desc: '정답률 100% (10문제 이상)', icon: '✅', cond: { perfectRate: 10 }, reward: { gold: 500 } }
  ],

  CRAFTING_RECIPES: [
    { id: 'craft_iron_sword', name: '철검 제작', materials: [{ id: 'slime_jelly', qty: 5 }, { id: 'wolf_fang', qty: 3 }], result: 'sword_iron', levelReq: 3 },
    { id: 'craft_steel_sword', name: '강철검 제작', materials: [{ id: 'bone_fragment', qty: 8 }, { id: 'goblin_ear', qty: 5 }], result: 'sword_steel', levelReq: 8 },
    { id: 'craft_blood_sword', name: '피의 장검 제작', materials: [{ id: 'blood_vial', qty: 5 }, { id: 'dark_essence', qty: 8 }], result: 'sword_blood', levelReq: 20 },
    { id: 'craft_crystal_armor', name: '수정 갑옷 제작', materials: [{ id: 'crystal_shard', qty: 15 }], result: 'armor_crystal', levelReq: 15 },
    { id: 'craft_ancient_armor', name: '고대 갑옷 제작', materials: [{ id: 'ancient_rune', qty: 5 }, { id: 'crystal_shard', qty: 10 }], result: 'armor_ancient', levelReq: 30 },
    { id: 'craft_guardian_ring', name: '수호자 반지 제작', materials: [{ id: 'ancient_rune', qty: 3 }, { id: 'dragon_scale', qty: 2 }], result: 'ring_guardian', levelReq: 30 }
  ],

  WORD_DIFFICULTY: {
    EASY: { level: 1, minPlayerLevel: 1, timeLimit: 12000, choices: 4 },
    NORMAL: { level: 2, minPlayerLevel: 5, timeLimit: 10000, choices: 4 },
    HARD: { level: 3, minPlayerLevel: 15, timeLimit: 8000, choices: 4 },
    EXPERT: { level: 4, minPlayerLevel: 30, timeLimit: 6000, choices: 4 },
    MASTER: { level: 5, minPlayerLevel: 50, timeLimit: 5000, choices: 4 }
  },

  ZONES: {
    STARTING_VILLAGE: { id: 'starting_village', name: '여명의 마을', levelRange: [1, 5], safeZone: true, biome: 'village' },
    FOREST_OF_WORDS: { id: 'forest_of_words', name: '단어의 숲', levelRange: [1, 10], safeZone: false, biome: 'forest' },
    DARK_PLAINS: { id: 'dark_plains', name: '어둠의 평원', levelRange: [8, 20], safeZone: false, biome: 'darkland' },
    CRYSTAL_CAVE: { id: 'crystal_cave', name: '수정 동굴', levelRange: [15, 30], safeZone: false, biome: 'cave' },
    ANCIENT_RUINS: { id: 'ancient_ruins', name: '고대 유적', levelRange: [25, 45], safeZone: false, biome: 'ruins' },
    DRAGON_PEAK: { id: 'dragon_peak', name: '용의 봉우리', levelRange: [40, 60], safeZone: false, biome: 'volcanic' },
    SHADOW_REALM: { id: 'shadow_realm', name: '그림자 영역', levelRange: [50, 80], safeZone: false, biome: 'shadow' },
    ABYSS_GATE: { id: 'abyss_gate', name: '심연의 문', levelRange: [70, 99], safeZone: false, biome: 'abyss' },
    FROZEN_LAKE: { id: 'frozen_lake', name: '얼어붙은 호수', levelRange: [12, 25], safeZone: false, biome: 'ice' },
    ENCHANTED_GARDEN: { id: 'enchanted_garden', name: '마법의 정원', levelRange: [18, 35], safeZone: false, biome: 'garden' },
    DEMON_WASTELAND: { id: 'demon_wasteland', name: '마왕의 황무지', levelRange: [60, 99], safeZone: false, biome: 'wasteland' }
  },

  // Steeper EXP curve: slime(15exp) -> ~13 kills for lv1->2, scales harder
  EXP_TABLE: Array.from({ length: 99 }, (_, i) => Math.floor(200 * (i + 1) * Math.pow(1.12, i))),

  ITEM_GRADES: {
    COMMON: { id: 0, name: '일반', color: '#AAAAAA' },
    UNCOMMON: { id: 1, name: '고급', color: '#00CC44' },
    RARE: { id: 2, name: '희귀', color: '#0099FF' },
    EPIC: { id: 3, name: '영웅', color: '#AA44FF' },
    LEGENDARY: { id: 4, name: '전설', color: '#FF8800' },
    MYTHIC: { id: 5, name: '신화', color: '#FF2255' }
  },

  SERVER_TICK_RATE: 20,
  CLIENT_LERP: 0.15,
  COMBAT_RANGE: 80,
  MAGIC_RANGE: 160,
  MONSTER_AGGRO_RANGE: 150,
  MONSTER_DEAGGRO_RANGE: 250,

  DROP_RATES: {
    COMMON: 0.5,
    UNCOMMON: 0.25,
    RARE: 0.08,
    EPIC: 0.02,
    LEGENDARY: 0.005,
    MYTHIC: 0.001
  },

  COMBO_MULTIPLIERS: [1, 1, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0, 2.3, 2.6, 3.0],

  WEATHER_TYPES: ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'],
  WEATHER_CHANGE_INTERVAL: 300000,
  DAY_CYCLE_DURATION: 600000,

  ENHANCEMENT_SUCCESS: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  ENHANCEMENT_BONUS: [0, 0.05, 0.1, 0.18, 0.28, 0.4, 0.55, 0.75, 1.0, 1.5],
  ENHANCEMENT_DESTROY_THRESHOLD: 7, // +7 이상 실패 시 파괴 가능
  ENHANCEMENT_COST: [100, 300, 800, 2000, 5000, 10000, 25000, 50000, 100000, 200000],

  // Death penalty
  DEATH_EXP_PENALTY: 0.03, // 사망 시 현재 레벨 필요 경험치의 3% 손실

  // Boss timer system
  WORLD_BOSS_SPAWN_INTERVAL: 1800000, // 30분마다 월드보스 스폰 체크
  WORLD_BOSS_ANNOUNCE_BEFORE: 60000, // 1분 전 예고

  // Auto-potion
  AUTO_POTION_COOLDOWN: 3000, // 자동 물약 쿨다운 3초
  AUTO_POTION_THRESHOLD: 0.3, // HP 30% 이하 시 자동 사용

  // Terrain collision zones (impassable areas - mountains, deep water, cliffs)
  COLLISION_ZONES: [
    // Mountain ranges between zones
    { x1: 12200, y1: 0, x2: 13000, y2: 9000, type: 'mountain' },
    { x1: 25000, y1: 0, x2: 25600, y2: 6000, type: 'mountain' },
    { x1: 12200, y1: 9500, x2: 13000, y2: 19000, type: 'mountain' },
    { x1: 25000, y1: 6500, x2: 25600, y2: 14400, type: 'cliff' },
    // Deep water
    { x1: 2000, y1: 19200, x2: 4000, y2: 20000, type: 'water' },
    { x1: 15000, y1: 19200, x2: 17000, y2: 20000, type: 'water' },
  ]
};

if (typeof module !== 'undefined') module.exports = CONSTANTS;
