const fs = require('fs');
const path = require('path');

const monstersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/monsters.json'), 'utf8'));
const npcsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/npcs.json'), 'utf8'));

class GameWorld {
  constructor() {
    this.players = new Map();
    this.monsters = new Map();
    this.monsterIdCounter = 0;
    this.npcs = npcsData.npcs;

    this.spawnMonsters();
  }

  spawnMonsters() {
    const spawnCounts = {
      'slime_green': 15,
      'slime_blue': 12,
      'wolf_gray': 10,
      'goblin_scout': 8,
      'skeleton_warrior': 8,
      'dark_mage': 6,
      'crystal_golem': 5,
      'vampire_lord': 4,
      'ancient_guardian': 3,
      'fire_dragon': 1,
      'shadow_assassin': 5,
      'abyss_demon': 1
    };

    const zoneAreas = {
      'forest_of_words': { x: [200, 1800], y: [200, 1800] },
      'dark_plains': { x: [2000, 3800], y: [200, 1800] },
      'crystal_cave': { x: [200, 1800], y: [2000, 3800] },
      'ancient_ruins': { x: [2000, 3800], y: [2000, 3800] },
      'dragon_peak': { x: [4000, 5000], y: [200, 1200] },
      'shadow_realm': { x: [4000, 5000], y: [1400, 2800] },
      'abyss_gate': { x: [4000, 5000], y: [3000, 4000] }
    };

    for (const monsterTemplate of monstersData.monsters) {
      const count = spawnCounts[monsterTemplate.id] || 3;
      const area = zoneAreas[monsterTemplate.zone];
      if (!area) continue;

      for (let i = 0; i < count; i++) {
        const id = `${monsterTemplate.id}_${this.monsterIdCounter++}`;
        const x = area.x[0] + Math.random() * (area.x[1] - area.x[0]);
        const y = area.y[0] + Math.random() * (area.y[1] - area.y[0]);

        this.monsters.set(id, {
          instanceId: id,
          ...monsterTemplate,
          currentHp: monsterTemplate.hp,
          x, y,
          spawnX: x,
          spawnY: y,
          targetPlayerId: null,
          isDead: false,
          deadAt: null,
          moveTimer: 0,
          moveTargetX: x,
          moveTargetY: y
        });
      }
    }

    console.log(`Spawned ${this.monsters.size} monsters`);
  }

  respawnMonster(monster) {
    monster.currentHp = monster.hp;
    monster.isDead = false;
    monster.deadAt = null;
    monster.targetPlayerId = null;
    monster.x = monster.spawnX + (Math.random() - 0.5) * 100;
    monster.y = monster.spawnY + (Math.random() - 0.5) * 100;
  }

  update(deltaTime) {
    const now = Date.now();

    for (const [id, monster] of this.monsters) {
      if (monster.isDead) {
        if (now - monster.deadAt > (monster.respawnTime || 30) * 1000) {
          this.respawnMonster(monster);
        }
        continue;
      }

      monster.moveTimer -= deltaTime;
      if (monster.moveTimer <= 0) {
        monster.moveTimer = 3000 + Math.random() * 5000;
        monster.moveTargetX = monster.spawnX + (Math.random() - 0.5) * 200;
        monster.moveTargetY = monster.spawnY + (Math.random() - 0.5) * 200;
      }

      const dx = monster.moveTargetX - monster.x;
      const dy = monster.moveTargetY - monster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const speed = 0.5;
        monster.x += (dx / dist) * speed * deltaTime * 0.05;
        monster.y += (dy / dist) * speed * deltaTime * 0.05;
      }
    }
  }

  getVisibleEntities(playerX, playerY, viewRange = 600) {
    const visibleMonsters = [];
    const visiblePlayers = [];
    const visibleNpcs = [];

    for (const [id, monster] of this.monsters) {
      if (monster.isDead) continue;
      const dx = monster.x - playerX;
      const dy = monster.y - playerY;
      if (Math.abs(dx) < viewRange && Math.abs(dy) < viewRange) {
        visibleMonsters.push({
          instanceId: monster.instanceId,
          id: monster.id,
          name: monster.name,
          level: monster.level,
          currentHp: monster.currentHp,
          hp: monster.hp,
          x: monster.x,
          y: monster.y,
          spriteColor: monster.spriteColor,
          spriteType: monster.spriteType,
          isBoss: monster.isBoss || false
        });
      }
    }

    for (const [socketId, player] of this.players) {
      const dx = player.x - playerX;
      const dy = player.y - playerY;
      if (Math.abs(dx) < viewRange && Math.abs(dy) < viewRange) {
        visiblePlayers.push({
          id: socketId,
          name: player.name,
          level: player.level,
          class: player.class,
          hp: player.hp,
          maxHp: player.maxHp,
          x: player.x,
          y: player.y
        });
      }
    }

    for (const npc of this.npcs) {
      const dx = npc.x - playerX;
      const dy = npc.y - playerY;
      if (Math.abs(dx) < viewRange && Math.abs(dy) < viewRange) {
        visibleNpcs.push(npc);
      }
    }

    return { monsters: visibleMonsters, players: visiblePlayers, npcs: visibleNpcs };
  }

  addPlayer(socketId, characterData) {
    this.players.set(socketId, { ...characterData, socketId });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getMonster(instanceId) {
    return this.monsters.get(instanceId);
  }
}

module.exports = GameWorld;
