const fs = require('fs');
const path = require('path');
const CONSTANTS = require('../../shared/constants');

const monstersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/monsters.json'), 'utf8'));
const npcsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/npcs.json'), 'utf8'));

class GameWorld {
  constructor() {
    this.players = new Map();
    this.monsters = new Map();
    this.monsterIdCounter = 0;
    this.npcs = npcsData.npcs;

    // Retaliatory aggro tracking: monsterId -> Set of playerIds who attacked
    this.monsterAttackers = new Map();

    // Weather system
    this.weather = 'clear';
    this.weatherTimer = 0;
    this.weatherChangeInterval = CONSTANTS.WEATHER_CHANGE_INTERVAL || 300000;

    // World events
    this.worldEventTimer = 0;
    this.worldEventInterval = 600000;
    this.activeWorldEvent = null;

    // Player buffs tracking
    this.playerBuffs = new Map();
    this.playerSkillCooldowns = new Map();

    // Boss timer system
    this.worldBossTimers = new Map(); // bossId -> {nextSpawn, announced, active}
    this.worldBossKills = []; // recent kill log for announcements
    this.bossAnnouncements = []; // pending announcements to broadcast

    // Ground drops system (items/gold on the ground)
    this.groundDrops = new Map();
    this.groundDropIdCounter = 0;
    this.GROUND_DROP_DESPAWN = 60000; // 60 seconds

    // Dungeon instances
    this.dungeonInstances = new Map();
    this.dungeonIdCounter = 0;

    this.spawnMonsters();
    this.initWorldBossTimers();
  }

  spawnMonsters() {
    const starterSpawn = CONSTANTS.SPAWN_POINTS?.NEW_CHARACTER || { x: 4500, y: 3600 };

    // Zone areas for 38400x28800 map
    const zoneAreas = {
      'forest_of_words': { x: [600, 12000], y: [600, 9000] },
      'dark_plains':     { x: [13200, 24750], y: [600, 9000] },
      'dragon_peak':     { x: [25800, 37800], y: [600, 6000] },
      'shadow_realm':    { x: [25800, 37800], y: [6600, 14400] },
      'crystal_cave':    { x: [600, 12000], y: [10200, 18750] },
      'ancient_ruins':   { x: [13200, 24750], y: [10200, 18750] },
      'frozen_lake':     { x: [600, 12000], y: [19800, 28200] },
      'enchanted_garden':{ x: [13200, 24750], y: [19800, 28200] },
      'abyss_gate':      { x: [25800, 37800], y: [15000, 21750] },
      'demon_wasteland': { x: [25800, 37800], y: [22500, 28200] }
    };

    // Hunting grounds - dense spawn sub-zones with fast respawn
    const huntingGrounds = [
      { name: '슬라임 계곡', zone: 'forest_of_words', area: { x: [3750, 7200], y: [1800, 4500] },
        monsters: ['slime_green', 'slime_blue'], counts: { slime_green: 8, slime_blue: 5 }, respawnMult: 0.5 },
      { name: '늑대 소굴', zone: 'forest_of_words', area: { x: [7800, 11100], y: [5250, 8250] },
        monsters: ['wolf_gray', 'goblin_scout'], counts: { wolf_gray: 5, goblin_scout: 4 }, respawnMult: 0.6 },
      { name: '해골 묘지', zone: 'dark_plains', area: { x: [15750, 20250], y: [2250, 6000] },
        monsters: ['skeleton_warrior', 'dark_mage'], counts: { skeleton_warrior: 6, dark_mage: 4 }, respawnMult: 0.5 },
      { name: '수정 광산', zone: 'crystal_cave', area: { x: [3000, 7500], y: [12000, 15750] },
        monsters: ['crystal_golem', 'ice_elemental'], counts: { crystal_golem: 4, ice_elemental: 5 }, respawnMult: 0.6 },
      { name: '정원 사냥터', zone: 'enchanted_garden', area: { x: [15750, 21000], y: [21750, 25500] },
        monsters: ['garden_sprite', 'thorn_golem'], counts: { garden_sprite: 6, thorn_golem: 3 }, respawnMult: 0.5 },
      { name: '얼음 호수변', zone: 'frozen_lake', area: { x: [3750, 8700], y: [21750, 26250] },
        monsters: ['ice_elemental', 'frost_wolf'], counts: { ice_elemental: 5, frost_wolf: 4 }, respawnMult: 0.5 },
      { name: '뱀파이어 은신처', zone: 'ancient_ruins', area: { x: [17250, 22200], y: [13200, 17250] },
        monsters: ['vampire_lord', 'ancient_guardian'], counts: { vampire_lord: 3, ancient_guardian: 2 }, respawnMult: 0.7 },
      { name: '드래곤 둥지', zone: 'dragon_peak', area: { x: [30000, 35250], y: [1200, 4800] },
        monsters: ['fire_dragon'], counts: { fire_dragon: 2 }, respawnMult: 0.8 },
      { name: '악마의 터', zone: 'demon_wasteland', area: { x: [27750, 35250], y: [23700, 27300] },
        monsters: ['doom_knight', 'shadow_assassin'], counts: { doom_knight: 4, shadow_assassin: 4 }, respawnMult: 0.6 },
      { name: '심연 입구', zone: 'abyss_gate', area: { x: [29250, 36000], y: [16200, 20700] },
        monsters: ['abyss_demon', 'shadow_assassin'], counts: { abyss_demon: 2, shadow_assassin: 3 }, respawnMult: 0.8 }
    ];

    // Regular zone spawns (spread across entire zone)
    const regularSpawns = {
      'slime_green': 4, 'slime_blue': 3, 'wolf_gray': 3,
      'goblin_scout': 3, 'skeleton_warrior': 3, 'dark_mage': 2,
      'crystal_golem': 2, 'vampire_lord': 1, 'ancient_guardian': 1,
      'fire_dragon': 1, 'shadow_assassin': 2, 'abyss_demon': 1,
      'ice_elemental': 3, 'frost_wolf': 2, 'garden_sprite': 3,
      'thorn_golem': 2, 'doom_knight': 1
    };

    const monsterTemplateMap = {};
    for (const mt of monstersData.monsters) monsterTemplateMap[mt.id] = mt;

    // Spawn regular zone monsters
    for (const monsterTemplate of monstersData.monsters) {
      const count = regularSpawns[monsterTemplate.id] || 3;
      const area = zoneAreas[monsterTemplate.zone];
      if (!area) continue;
      for (let i = 0; i < count; i++) {
        this._spawnOne(monsterTemplate, area);
      }
    }

    // Spawn hunting ground monsters (dense clusters)
    for (const hg of huntingGrounds) {
      for (const monsterId of hg.monsters) {
        const template = monsterTemplateMap[monsterId];
        if (!template) continue;
        const count = hg.counts[monsterId] || 3;
        for (let i = 0; i < count; i++) {
          const m = this._spawnOne(template, hg.area);
          m.huntingGround = hg.name;
          m.respawnMult = hg.respawnMult;
        }
      }
    }

    // Guarantee a few beginner monsters close to the new character spawn.
    const starterArea = {
      x: [starterSpawn.x - 70, starterSpawn.x + 70],
      y: [starterSpawn.y - 70, starterSpawn.y + 70]
    };
    for (const monsterId of ['slime_green', 'slime_green', 'slime_blue']) {
      const template = monsterTemplateMap[monsterId];
      if (!template) continue;
      const m = this._spawnOne(template, starterArea);
      m.huntingGround = 'starter_camp';
      m.respawnMult = 0.5;
    }

    console.log(`Spawned ${this.monsters.size} monsters (incl. hunting grounds)`);
  }

  // Village safe zone - monsters cannot spawn or enter here
  static VILLAGE_BOUNDS = { x1: 1700, y1: 1700, x2: 3100, y2: 3100 };

  static isInVillage(x, y) {
    const v = GameWorld.VILLAGE_BOUNDS;
    return x >= v.x1 && x <= v.x2 && y >= v.y1 && y <= v.y2;
  }

  _spawnOne(template, area) {
    const id = `${template.id}_${this.monsterIdCounter++}`;
    // Retry spawn position if it lands in village
    let x, y, attempts = 0;
    do {
      x = area.x[0] + Math.random() * (area.x[1] - area.x[0]);
      y = area.y[0] + Math.random() * (area.y[1] - area.y[0]);
      attempts++;
    } while (GameWorld.isInVillage(x, y) && attempts < 20);
    // If still in village after 20 attempts, push outside
    if (GameWorld.isInVillage(x, y)) {
      x = GameWorld.VILLAGE_BOUNDS.x2 + 200 + Math.random() * 300;
    }
    const monster = {
      instanceId: id,
      ...template,
      currentHp: template.hp,
      x, y, spawnX: x, spawnY: y,
      targetPlayerId: null,
      isDead: false, deadAt: null,
      moveTimer: 0,
      moveTargetX: x, moveTargetY: y,
      lastAttackTime: 0,
      attackCooldown: template.isBoss ? 2000 : 3000,
      huntingGround: null,
      respawnMult: 1
    };
    this.monsters.set(id, monster);
    return monster;
  }

  respawnMonster(monster) {
    monster.currentHp = monster.hp;
    monster.isDead = false;
    monster.deadAt = null;
    monster.targetPlayerId = null;
    monster.awaitingQuiz = false;
    monster.awaitingQuizPlayerId = null;
    let rx = monster.spawnX + (Math.random() - 0.5) * 100;
    let ry = monster.spawnY + (Math.random() - 0.5) * 100;
    if (GameWorld.isInVillage(rx, ry)) {
      rx = GameWorld.VILLAGE_BOUNDS.x2 + 200 + Math.random() * 300;
      ry = monster.spawnY;
    }
    monster.x = rx;
    monster.y = ry;
    // Clear retaliatory aggro
    this.monsterAttackers.delete(monster.instanceId);
  }

  // Called when a player attacks a monster (for retaliatory aggro)
  registerAttacker(monsterInstanceId, playerId) {
    if (!this.monsterAttackers.has(monsterInstanceId)) {
      this.monsterAttackers.set(monsterInstanceId, new Set());
    }
    this.monsterAttackers.get(monsterInstanceId).add(playerId);
  }

  update(deltaTime) {
    const now = Date.now();
    const deaggroRange = CONSTANTS.MONSTER_DEAGGRO_RANGE || 250;
    const attackRange = 50;

    this.pendingAttacks = [];

    for (const [id, monster] of this.monsters) {
      if (monster.isDead) {
        const respawnTime = (monster.respawnTime || 30) * (monster.respawnMult || 1);
        if (now - monster.deadAt > respawnTime * 1000) {
          this.respawnMonster(monster);
        }
        continue;
      }

      // Monster is awaiting quiz answer - freeze it in place
      if (monster.awaitingQuiz) continue;

      const monsterAggroRange = monster.aggroRange || 150;
      const monsterSpeed = monster.moveSpeed || 0.5;

      // --- Aggressive: chases players on sight ---
      if (monster.aggroType === 'aggressive') {
        if (monster.targetPlayerId) {
          const target = this.players.get(monster.targetPlayerId);
          if (!target || target.hp <= 0) {
            monster.targetPlayerId = null;
          } else {
            const d = Math.hypot(target.x - monster.x, target.y - monster.y);
            if (d > deaggroRange) monster.targetPlayerId = null;
          }
        }

        if (!monster.targetPlayerId) {
          let closestDist = monsterAggroRange;
          let closestId = null;
          for (const [pid, p] of this.players) {
            if (p.hp <= 0) continue;
            const d = Math.hypot(p.x - monster.x, p.y - monster.y);
            if (d < closestDist) { closestDist = d; closestId = pid; }
          }
          if (closestId) monster.targetPlayerId = closestId;
        }

        if (monster.targetPlayerId) {
          const target = this.players.get(monster.targetPlayerId);
          if (target) {
            const dx = target.x - monster.x;
            const dy = target.y - monster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > attackRange) {
              const newX = monster.x + (dx / dist) * monsterSpeed * deltaTime * 0.06;
              const newY = monster.y + (dy / dist) * monsterSpeed * deltaTime * 0.06;
              // Don't chase into village - deaggro instead
              if (GameWorld.isInVillage(newX, newY)) {
                monster.targetPlayerId = null;
              } else {
                monster.x = newX;
                monster.y = newY;
              }
            } else {
              // Don't attack players inside village
              if (!GameWorld.isInVillage(target.x, target.y)) {
                if (now - monster.lastAttackTime >= monster.attackCooldown) {
                  monster.lastAttackTime = now;
                  const defReduction = Math.min(0.7, target.def / (target.def + 100));
                  const dmg = Math.max(1, Math.floor(monster.atk * (1 - defReduction)));
                  this.pendingAttacks.push({
                    playerId: monster.targetPlayerId,
                    monsterId: monster.instanceId,
                    monsterName: monster.name,
                    damage: dmg
                  });
                }
              } else {
                monster.targetPlayerId = null;
              }
            }
            continue;
          }
        }
      }

      // --- Retaliatory/Passive: chases players who attacked it ---
      if (monster.aggroType === 'retaliatory' || monster.aggroType === 'passive') {
        const attackers = this.monsterAttackers.get(monster.instanceId);
        if (attackers && attackers.size > 0) {
          // Validate current target
          if (monster.targetPlayerId) {
            const target = this.players.get(monster.targetPlayerId);
            if (!target || target.hp <= 0) {
              monster.targetPlayerId = null;
              attackers.delete(monster.targetPlayerId);
            } else {
              const d = Math.hypot(target.x - monster.x, target.y - monster.y);
              if (d > deaggroRange) {
                monster.targetPlayerId = null;
                attackers.delete(monster.targetPlayerId);
              }
            }
          }

          // Find closest attacker
          if (!monster.targetPlayerId) {
            let closestDist = deaggroRange;
            let closestId = null;
            for (const pid of attackers) {
              const p = this.players.get(pid);
              if (!p || p.hp <= 0) { attackers.delete(pid); continue; }
              const d = Math.hypot(p.x - monster.x, p.y - monster.y);
              if (d < closestDist) { closestDist = d; closestId = pid; }
            }
            if (closestId) monster.targetPlayerId = closestId;
          }

          // Chase & attack
          if (monster.targetPlayerId) {
            const target = this.players.get(monster.targetPlayerId);
            if (target) {
              const dx = target.x - monster.x;
              const dy = target.y - monster.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > attackRange) {
                const newX = monster.x + (dx / dist) * monsterSpeed * deltaTime * 0.06;
                const newY = monster.y + (dy / dist) * monsterSpeed * deltaTime * 0.06;
                if (GameWorld.isInVillage(newX, newY)) {
                  monster.targetPlayerId = null;
                } else {
                  monster.x = newX;
                  monster.y = newY;
                }
              } else {
                if (GameWorld.isInVillage(target.x, target.y)) {
                  monster.targetPlayerId = null;
                } else if (now - monster.lastAttackTime >= monster.attackCooldown) {
                  monster.lastAttackTime = now;
                  const defReduction = Math.min(0.7, target.def / (target.def + 100));
                  const dmg = Math.max(1, Math.floor(monster.atk * (1 - defReduction)));
                  this.pendingAttacks.push({
                    playerId: monster.targetPlayerId,
                    monsterId: monster.instanceId,
                    monsterName: monster.name,
                    damage: dmg
                  });
                }
              }
              continue;
            }
          }
        }
      }

      // --- Idle wander (passive, or no target) ---
      monster.moveTimer -= deltaTime;
      if (monster.moveTimer <= 0) {
        monster.moveTimer = 3000 + Math.random() * 5000;
        let mtx = monster.spawnX + (Math.random() - 0.5) * 200;
        let mty = monster.spawnY + (Math.random() - 0.5) * 200;
        // Don't wander into village
        if (!GameWorld.isInVillage(mtx, mty)) {
          monster.moveTargetX = mtx;
          monster.moveTargetY = mty;
        }
      }

      const dx = monster.moveTargetX - monster.x;
      const dy = monster.moveTargetY - monster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const wanderSpeed = monsterSpeed * 0.4;
        const newX = monster.x + (dx / dist) * wanderSpeed * deltaTime * 0.05;
        const newY = monster.y + (dy / dist) * wanderSpeed * deltaTime * 0.05;
        // Block entry into village
        if (!GameWorld.isInVillage(newX, newY)) {
          monster.x = newX;
          monster.y = newY;
        }
      }
    }

    // Weather update
    this.weatherTimer += deltaTime;
    if (this.weatherTimer >= this.weatherChangeInterval) {
      this.weatherTimer = 0;
      this.changeWeather();
    }

    // World events
    this.worldEventTimer += deltaTime;
    if (this.worldEventTimer >= this.worldEventInterval) {
      this.worldEventTimer = 0;
      this.triggerWorldEvent();
    }

    // Clean expired buffs
    for (const [pid, buffs] of this.playerBuffs) {
      this.playerBuffs.set(pid, buffs.filter(b => b.endTime > now));
    }

    // World boss timers
    this.updateWorldBossTimers(now);

    // Cleanup expired ground drops
    this.cleanupGroundDrops();
  }

  changeWeather() {
    const types = CONSTANTS.WEATHER_TYPES || ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
    const weights = [35, 20, 18, 5, 12, 10];
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let newWeather = types[0];
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { newWeather = types[i]; break; }
    }
    this.weather = newWeather;
    return newWeather;
  }

  triggerWorldEvent() {
    const events = [
      { type: 'boss_rage', message: '보스 몬스터들이 분노합니다! 경험치 2배!', duration: 60000 },
      { type: 'word_festival', message: '단어 축제! 콤보 보너스 2배!', duration: 120000 },
      { type: 'gold_rush', message: '골드 러시! 골드 드롭 3배!', duration: 90000 },
      { type: 'monster_surge', message: '몬스터 대이동! 리스폰 속도 증가!', duration: 60000 }
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    this.activeWorldEvent = { ...event, startTime: Date.now(), endTime: Date.now() + event.duration };
    return event;
  }

  isWorldEventActive(type) {
    if (!this.activeWorldEvent) return false;
    if (this.activeWorldEvent.endTime < Date.now()) { this.activeWorldEvent = null; return false; }
    return !type || this.activeWorldEvent.type === type;
  }

  // Buff management
  addBuff(playerId, buff) {
    if (!this.playerBuffs.has(playerId)) this.playerBuffs.set(playerId, []);
    const buffs = this.playerBuffs.get(playerId);
    const filtered = buffs.filter(b => b.id !== buff.id);
    filtered.push(buff);
    this.playerBuffs.set(playerId, filtered);
  }

  getBuffs(playerId) {
    return (this.playerBuffs.get(playerId) || []).filter(b => b.endTime > Date.now());
  }

  getBuffMultiplier(playerId, statType) {
    const buffs = this.getBuffs(playerId);
    let mult = 1;
    for (const buff of buffs) {
      if (buff.effect) {
        if (statType === 'dmg' && buff.effect.dmgMult) mult *= buff.effect.dmgMult;
        if (statType === 'def' && buff.effect.defMult) mult *= buff.effect.defMult;
        if (statType === 'atk' && buff.effect.atkMult) mult *= buff.effect.atkMult;
        if (statType === 'exp' && buff.effect.expMult) mult *= buff.effect.expMult;
        if (statType === 'speed' && buff.effect.speedMult) mult *= buff.effect.speedMult;
      }
    }
    return mult;
  }

  hasBuffEffect(playerId, effectName) {
    const buffs = this.getBuffs(playerId);
    return buffs.some(b => b.effect && b.effect[effectName]);
  }

  consumeBuffCharge(playerId, effectName) {
    const buffs = this.getBuffs(playerId);
    for (const buff of buffs) {
      if (buff.effect && buff.effect[effectName] && buff.effect.charges) {
        buff.effect.charges--;
        if (buff.effect.charges <= 0) {
          const all = this.playerBuffs.get(playerId) || [];
          this.playerBuffs.set(playerId, all.filter(b => b !== buff));
        }
        return true;
      }
    }
    return false;
  }

  // Skill cooldowns
  setSkillCooldown(playerId, skillId, duration) {
    if (!this.playerSkillCooldowns.has(playerId)) this.playerSkillCooldowns.set(playerId, {});
    this.playerSkillCooldowns.get(playerId)[skillId] = Date.now() + duration;
  }

  isSkillOnCooldown(playerId, skillId) {
    const cds = this.playerSkillCooldowns.get(playerId);
    if (!cds || !cds[skillId]) return false;
    return Date.now() < cds[skillId];
  }

  resetAllCooldowns(playerId) {
    this.playerSkillCooldowns.set(playerId, {});
  }

  initWorldBossTimers() {
    // Find all world bosses from monster templates
    for (const mt of monstersData.monsters) {
      if (mt.isWorldBoss) {
        const spawnDelay = (mt.respawnTime || 3600) * 1000;
        // First spawn: random between 5-15 min after server start
        const firstSpawn = Date.now() + (300000 + Math.random() * 600000);
        this.worldBossTimers.set(mt.id, {
          templateId: mt.id,
          name: mt.name,
          nextSpawn: firstSpawn,
          announced: false,
          active: false,
          instanceId: null,
          respawnDelay: spawnDelay
        });
        console.log(`World Boss Timer: ${mt.name} - first spawn in ${Math.floor((firstSpawn - Date.now()) / 1000)}s`);
      }
    }
  }

  updateWorldBossTimers(now) {
    const announceTime = CONSTANTS.WORLD_BOSS_ANNOUNCE_BEFORE || 60000;

    for (const [bossId, timer] of this.worldBossTimers) {
      // If boss is active (alive), skip timer
      if (timer.active && timer.instanceId) {
        const monster = this.monsters.get(timer.instanceId);
        if (monster && !monster.isDead) continue;
        // Boss was killed - set next spawn timer
        if (monster && monster.isDead) {
          timer.active = false;
          timer.announced = false;
          timer.nextSpawn = now + timer.respawnDelay;
          timer.instanceId = null;
        }
        continue;
      }

      // Pre-announcement (1 min before spawn)
      if (!timer.announced && now >= timer.nextSpawn - announceTime) {
        timer.announced = true;
        const secsLeft = Math.ceil((timer.nextSpawn - now) / 1000);
        this.bossAnnouncements.push({
          type: 'boss_warning',
          message: `[월드보스] ${timer.name}이(가) ${secsLeft}초 후 출현합니다! 전투 준비를 하세요!`,
          bossId: bossId
        });
      }

      // Spawn time
      if (now >= timer.nextSpawn && !timer.active) {
        this.spawnWorldBoss(bossId, timer);
      }
    }
  }

  spawnWorldBoss(bossId, timer) {
    const template = monstersData.monsters.find(m => m.id === bossId);
    if (!template) return;

    // Zone areas for spawn (38400x28800 map)
    const zoneAreas = {
      'forest_of_words': { x: [4500, 9000], y: [3000, 6750] },
      'dark_plains':     { x: [16500, 21000], y: [3000, 6750] },
      'crystal_cave':    { x: [4500, 9000], y: [12750, 16500] },
      'ancient_ruins':   { x: [16500, 21000], y: [12750, 16500] },
      'dragon_peak':     { x: [28500, 34500], y: [2250, 5250] },
      'shadow_realm':    { x: [28500, 34500], y: [8250, 12750] },
      'abyss_gate':      { x: [30000, 34500], y: [16500, 20250] },
      'demon_wasteland': { x: [28500, 34500], y: [24000, 27000] },
      'frozen_lake':     { x: [4500, 9000], y: [22500, 26250] },
      'enchanted_garden':{ x: [16500, 21000], y: [22500, 26250] }
    };

    const area = zoneAreas[template.zone] || { x: [5000, 10000], y: [5000, 10000] };
    const monster = this._spawnOne(template, area);
    monster.isWorldBoss = true;

    timer.active = true;
    timer.instanceId = monster.instanceId;

    this.bossAnnouncements.push({
      type: 'boss_spawn',
      message: `[월드보스] ${timer.name}이(가) 출현했습니다! 위치: ${this.getZoneName(template.zone)}`,
      bossId: bossId,
      zone: template.zone
    });
  }

  getZoneName(zoneId) {
    const names = {
      'forest_of_words': '단어의 숲', 'dark_plains': '어둠의 평원',
      'crystal_cave': '수정 동굴', 'ancient_ruins': '고대 유적',
      'dragon_peak': '용의 봉우리', 'shadow_realm': '그림자 영역',
      'abyss_gate': '심연의 문', 'demon_wasteland': '마왕의 황무지',
      'frozen_lake': '얼어붙은 호수', 'enchanted_garden': '마법의 정원'
    };
    return names[zoneId] || zoneId;
  }

  // Get remaining time for next world boss spawn
  getWorldBossStatus() {
    const now = Date.now();
    const status = [];
    for (const [bossId, timer] of this.worldBossTimers) {
      if (timer.active) {
        const monster = timer.instanceId ? this.monsters.get(timer.instanceId) : null;
        status.push({ id: bossId, name: timer.name, active: true, hp: monster?.currentHp, maxHp: monster?.hp, zone: monster?.zone });
      } else {
        const remaining = Math.max(0, timer.nextSpawn - now);
        status.push({ id: bossId, name: timer.name, active: false, remaining });
      }
    }
    return status;
  }

  // Ground drops system
  addGroundDrop(x, y, items, gold, monsterName) {
    const id = `drop_${this.groundDropIdCounter++}`;
    const drop = {
      id,
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      items: items || [], // [{itemId, name, grade}]
      gold: gold || 0,
      monsterName: monsterName || '',
      createdAt: Date.now(),
      pickedUp: false
    };
    this.groundDrops.set(id, drop);
    // If gold and items are separate, also drop gold bag separately
    if (gold > 0 && items.length > 0) {
      const goldDrop = {
        id: `drop_${this.groundDropIdCounter++}`,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        items: [],
        gold: gold,
        monsterName: '',
        createdAt: Date.now(),
        pickedUp: false
      };
      this.groundDrops.set(goldDrop.id, goldDrop);
      drop.gold = 0; // items drop has no gold
    }
    return drop;
  }

  pickupGroundDrop(dropId) {
    const drop = this.groundDrops.get(dropId);
    if (!drop || drop.pickedUp) return null;
    drop.pickedUp = true;
    this.groundDrops.delete(dropId);
    return drop;
  }

  cleanupGroundDrops() {
    const now = Date.now();
    for (const [id, drop] of this.groundDrops) {
      if (now - drop.createdAt > this.GROUND_DROP_DESPAWN) {
        this.groundDrops.delete(id);
      }
    }
  }

  // Dungeon system
  createDungeon(type, playerLevel) {
    const dungeonId = `dungeon_${this.dungeonIdCounter++}`;
    const dungeonDefs = {
      goblin_cave: { name: '고블린 동굴', minLevel: 5, monsters: ['goblin_scout', 'slime_blue'], boss: 'wolf_gray', waves: 3, reward: { exp: 500, gold: 200 } },
      skeleton_crypt: { name: '해골 납골당', minLevel: 15, monsters: ['skeleton_warrior', 'dark_mage'], boss: 'crystal_golem', waves: 4, reward: { exp: 2000, gold: 800 } },
      dragon_lair: { name: '드래곤의 은신처', minLevel: 35, monsters: ['vampire_lord', 'ancient_guardian'], boss: 'fire_dragon', waves: 5, reward: { exp: 8000, gold: 3000 } },
      abyss_depths: { name: '심연의 깊은 곳', minLevel: 60, monsters: ['shadow_assassin', 'doom_knight'], boss: 'abyss_demon', waves: 6, reward: { exp: 20000, gold: 8000 } }
    };
    const def = dungeonDefs[type];
    if (!def || playerLevel < def.minLevel) return null;
    const instance = {
      id: dungeonId, type, ...def,
      currentWave: 0,
      monstersAlive: 0,
      completed: false,
      createdAt: Date.now(),
      playerId: null
    };
    this.dungeonInstances.set(dungeonId, instance);
    return instance;
  }

  getDungeonList(playerLevel) {
    const list = [
      { type: 'goblin_cave', name: '고블린 동굴', minLevel: 5, desc: 'Lv.5+ | 3웨이브 | 보상: EXP 500, 골드 200' },
      { type: 'skeleton_crypt', name: '해골 납골당', minLevel: 15, desc: 'Lv.15+ | 4웨이브 | 보상: EXP 2000, 골드 800' },
      { type: 'dragon_lair', name: '드래곤의 은신처', minLevel: 35, desc: 'Lv.35+ | 5웨이브 | 보상: EXP 8000, 골드 3000' },
      { type: 'abyss_depths', name: '심연의 깊은 곳', minLevel: 60, desc: 'Lv.60+ | 6웨이브 | 보상: EXP 20000, 골드 8000' }
    ];
    return list.map(d => ({ ...d, available: playerLevel >= d.minLevel }));
  }

  getVisibleEntities(playerX, playerY, viewRange = 700) {
    const visibleMonsters = [];
    const visiblePlayers = [];
    const visibleNpcs = [];
    const visibleDrops = [];

    for (const [id, monster] of this.monsters) {
      if (monster.isDead) continue;
      if (Math.abs(monster.x - playerX) < viewRange && Math.abs(monster.y - playerY) < viewRange) {
        visibleMonsters.push({
          instanceId: monster.instanceId, id: monster.id,
          name: monster.name, level: monster.level,
          currentHp: monster.currentHp, hp: monster.hp,
          x: monster.x, y: monster.y,
          spriteColor: monster.spriteColor, spriteType: monster.spriteType,
          isBoss: monster.isBoss || false,
          isWorldBoss: monster.isWorldBoss || false,
          awaitingQuiz: monster.awaitingQuiz || false
        });
      }
    }

    for (const [socketId, player] of this.players) {
      if (Math.abs(player.x - playerX) < viewRange && Math.abs(player.y - playerY) < viewRange) {
        visiblePlayers.push({
          id: socketId, name: player.name, level: player.level,
          class: player.class, hp: player.hp, maxHp: player.maxHp,
          x: player.x, y: player.y, direction: player.direction || 'down'
        });
      }
    }

    for (const npc of this.npcs) {
      if (Math.abs(npc.x - playerX) < viewRange && Math.abs(npc.y - playerY) < viewRange) {
        visibleNpcs.push(npc);
      }
    }

    // Ground drops
    for (const [id, drop] of this.groundDrops) {
      if (Math.abs(drop.x - playerX) < viewRange && Math.abs(drop.y - playerY) < viewRange) {
        visibleDrops.push({
          id: drop.id, x: drop.x, y: drop.y,
          items: drop.items, gold: drop.gold,
          age: Date.now() - drop.createdAt
        });
      }
    }

    return { monsters: visibleMonsters, players: visiblePlayers, npcs: visibleNpcs, drops: visibleDrops };
  }

  addPlayer(socketId, characterData) {
    this.players.set(socketId, { ...characterData, socketId });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.playerBuffs.delete(socketId);
    this.playerSkillCooldowns.delete(socketId);
  }

  getMonster(instanceId) {
    return this.monsters.get(instanceId);
  }
}

module.exports = GameWorld;
