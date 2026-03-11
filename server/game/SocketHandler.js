const jwt = require('jsonwebtoken');
const db = require('../db/database');
const GameWorld = require('./GameWorld');
const Combat = require('./Combat');
const fs = require('fs');
const path = require('path');

const itemsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/items.json'), 'utf8'));
const itemsMap = {};
itemsData.items.forEach(item => { itemsMap[item.id] = item; });

const CONSTANTS = require('../../shared/constants');
const JWT_SECRET = process.env.JWT_SECRET || 'runeword_secret';

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.world = new GameWorld();

    this.lastTick = Date.now();
    setInterval(() => this.gameLoop(), 1000 / CONSTANTS.SERVER_TICK_RATE);
    setInterval(() => this.broadcastState(), 100);

    // Weather broadcast
    setInterval(() => this.broadcastWeather(), 5000);

    // World event check
    setInterval(() => this.checkWorldEvents(), 10000);

    io.on('connection', (socket) => this.handleConnection(socket));
  }

  handleConnection(socket) {
    console.log(`Client connected: ${socket.id}`);

    socket.on('authenticate', (data) => this.handleAuth(socket, data));
    socket.on('player_move', (data) => this.handleMove(socket, data));
    socket.on('attack_monster', (data) => this.handleAttack(socket, data));
    socket.on('quiz_answer', (data) => this.handleQuizAnswer(socket, data));
    socket.on('use_item', (data) => this.handleUseItem(socket, data));
    socket.on('buy_item', (data) => this.handleBuyItem(socket, data));
    socket.on('sell_item', (data) => this.handleSellItem(socket, data));
    socket.on('equip_item', (data) => this.handleEquipItem(socket, data));
    socket.on('chat_message', (data) => this.handleChat(socket, data));
    socket.on('interact_npc', (data) => this.handleNpcInteract(socket, data));
    socket.on('request_inventory', () => this.sendInventory(socket));
    socket.on('heal_request', () => this.handleHeal(socket));
    socket.on('use_skill', (data) => this.handleSkill(socket, data));
    socket.on('craft_item', (data) => this.handleCraft(socket, data));
    socket.on('stop_attack', () => this.handleStopAttack(socket));
    socket.on('enhance_item', (data) => this.handleEnhance(socket, data));
    socket.on('request_boss_status', () => this.handleBossStatus(socket));
    socket.on('pickup_drop', (data) => this.handlePickupDrop(socket, data));
    socket.on('enter_dungeon', (data) => this.handleEnterDungeon(socket, data));
    socket.on('request_dungeon_list', () => this.handleDungeonList(socket));
    socket.on('dungeon_complete', (data) => this.handleDungeonComplete(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  handleAuth(socket, { token }) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(decoded.userId);
      if (!character) {
        socket.emit('auth_error', { error: '캐릭터를 찾을 수 없습니다.' });
        return;
      }

      socket.userId = decoded.userId;
      socket.characterId = character.id;
      socket.characterName = character.name;

      const equipped = db.prepare('SELECT item_id, enhancement_level FROM inventory WHERE character_id = ? AND equipped = 1').all(character.id);
      let bonusAtk = 0, bonusDef = 0, bonusHp = 0, bonusMp = 0;
      for (const eq of equipped) {
        const item = itemsMap[eq.item_id];
        if (item && item.stats) {
          const enhLevel = eq.enhancement_level || 0;
          const enhBonus = CONSTANTS.ENHANCEMENT_BONUS[enhLevel] || 0;
          bonusAtk += Math.floor((item.stats.atk || 0) * (1 + enhBonus));
          bonusDef += Math.floor((item.stats.def || 0) * (1 + enhBonus));
          bonusHp += Math.floor((item.stats.hp || 0) * (1 + enhBonus));
          bonusMp += Math.floor((item.stats.mp || 0) * (1 + enhBonus));
        }
      }

      const playerState = {
        id: character.id, name: character.name, class: character.class,
        level: character.level, exp: character.exp,
        hp: character.hp, maxHp: character.max_hp + bonusHp,
        mp: character.mp, maxMp: character.max_mp + bonusMp,
        atk: character.atk + bonusAtk, def: character.def + bonusDef,
        speed: character.speed, gold: character.gold,
        zone: character.zone, x: character.x, y: character.y,
        wordsCorrect: character.words_correct, wordsWrong: character.words_wrong,
        monstersKilled: character.monsters_killed
      };

      this.world.addPlayer(socket.id, playerState);
      socket.emit('auth_success', { player: playerState });
      socket.emit('weather_change', { weather: this.world.weather });
      this.sendInventory(socket);

      // Check & send unlocked achievements
      this.checkAchievements(socket, playerState);

      console.log(`${character.name} (Lv.${character.level}) logged in`);
    } catch (err) {
      socket.emit('auth_error', { error: '인증 실패' });
    }
  }

  handleMove(socket, { x, y, direction }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;
    player.x = x;
    player.y = y;
    player.direction = direction;
  }

  handleAttack(socket, { monsterInstanceId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;
    if (player.hp <= 0) return;

    const monster = this.world.getMonster(monsterInstanceId);
    if (!monster || monster.isDead) {
      socket.emit('attack_error', { error: '대상을 찾을 수 없습니다.' });
      return;
    }

    // If monster is awaiting quiz from this player, don't allow more attacks
    if (monster.awaitingQuiz && monster.awaitingQuizPlayerId === socket.id) {
      socket.emit('attack_error', { error: '퀴즈에 답해야 합니다.' });
      return;
    }

    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    if (dist > 120) {
      socket.emit('attack_error', { error: '너무 멀리 있습니다.' });
      return;
    }

    // Register attacker so passive/retaliatory monsters fight back
    this.world.registerAttacker(monsterInstanceId, socket.id);

    // Calculate damage: playerAtk * (1 - monsterDef/(monsterDef+100)) with +/-20% randomness
    const dmgBuffMult = this.world.getBuffMultiplier(socket.id, 'dmg');
    const atkBuffMult = this.world.getBuffMultiplier(socket.id, 'atk');
    const effectiveAtk = player.atk * atkBuffMult;
    const defReduction = monster.def / (monster.def + 100);
    const baseDamage = effectiveAtk * (1 - defReduction);
    const randomness = 0.8 + Math.random() * 0.4; // +/-20%
    let damage = Math.floor(baseDamage * randomness * dmgBuffMult);
    damage = Math.max(1, damage); // minimum 1 damage

    // Consume buff charges if applicable
    this.world.consumeBuffCharge(socket.id, 'dmgMult');

    monster.currentHp -= damage;

    if (monster.currentHp <= 0) {
      // Monster HP depleted - don't kill yet, trigger quiz phase
      monster.currentHp = 0;
      monster.awaitingQuiz = true;
      monster.awaitingQuizPlayerId = socket.id;

      const quiz = Combat.generateQuiz(socket.id, monster);
      if (!quiz) {
        // Fallback: if quiz generation fails, just kill the monster
        monster.awaitingQuiz = false;
        monster.awaitingQuizPlayerId = null;
        monster.isDead = true;
        monster.deadAt = Date.now();
        socket.emit('attack_hit', {
          monsterInstanceId, damage,
          monsterHp: 0, monsterMaxHp: monster.hp,
          monsterDied: true
        });
        return;
      }

      // Send the attack hit result first
      socket.emit('attack_hit', {
        monsterInstanceId, damage,
        monsterHp: 0, monsterMaxHp: monster.hp,
        monsterDied: false
      });

      // Then send the quiz
      socket.emit('monster_ready_quiz', {
        ...quiz,
        monsterInstanceId,
        monsterName: monster.name
      });
    } else {
      // Monster still alive - just send attack result
      socket.emit('attack_hit', {
        monsterInstanceId, damage,
        monsterHp: monster.currentHp, monsterMaxHp: monster.hp,
        monsterDied: false
      });
    }
  }

  handleStopAttack(socket) {
    // Client sends this when player moves away or deselects monster
    // Cancel any pending quiz for this player
    Combat.cancelCombat(socket.id);

    // Clear awaitingQuiz flag on any monster this player was fighting
    for (const [id, monster] of this.world.monsters) {
      if (monster.awaitingQuiz && monster.awaitingQuizPlayerId === socket.id) {
        monster.awaitingQuiz = false;
        monster.awaitingQuizPlayerId = null;
        // Revive monster at 30% HP since player abandoned the quiz
        monster.currentHp = Math.max(1, Math.floor(monster.hp * 0.3));
      }
    }
  }

  handleQuizAnswer(socket, { answerIndex, monsterInstanceId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const result = Combat.processAnswer(socket.id, answerIndex);
    if (!result.valid) return;

    const monster = this.world.getMonster(monsterInstanceId);
    if (!monster) return;

    // Clear the awaiting quiz flag
    monster.awaitingQuiz = false;
    monster.awaitingQuizPlayerId = null;

    if (result.correct) {
      // Correct answer: monster dies, give rewards
      const comboMult = result.comboMultiplier || 1;

      monster.currentHp = 0;
      monster.isDead = true;
      monster.deadAt = Date.now();

      const expBuffMult = this.world.getBuffMultiplier(socket.id, 'exp');
      const worldExpMult = this.world.isWorldEventActive('boss_rage') ? 2 : 1;
      const goldMult = this.world.isWorldEventActive('gold_rush') ? 3 : 1;

      const rewards = Combat.calculateRewards(monster, player.level, true, comboMult, expBuffMult * worldExpMult);
      rewards.gold = Math.floor(rewards.gold * goldMult);

      player.exp += rewards.exp;
      // Gold goes to ground drop, not directly to player
      // player.gold += rewards.gold;

      // Level up: max 1 level per kill to prevent insane jumps
      let leveledUp = false;
      if (player.level < 99 && player.exp >= CONSTANTS.EXP_TABLE[player.level - 1]) {
        player.exp -= CONSTANTS.EXP_TABLE[player.level - 1];
        player.level++;
        leveledUp = true;

        const classData = CONSTANTS.CLASSES[player.class] || CONSTANTS.CLASSES.WARRIOR;
        player.maxHp += Math.floor(classData.baseHP * 0.1);
        player.maxMp += Math.floor(classData.baseMP * 0.1);
        player.atk += Math.floor(classData.baseATK * 0.08);
        player.def += Math.floor(classData.baseDEF * 0.08);
        player.hp = player.maxHp;
        player.mp = player.maxMp;
      }

      // Drop items and gold on the ground (Lineage-style)
      const dropItems = rewards.drops.map(itemId => {
        const info = itemsMap[itemId];
        return { itemId, name: info ? info.name : itemId, grade: info ? (info.grade || 0) : 0 };
      });
      if (dropItems.length > 0 || rewards.gold > 0) {
        this.world.addGroundDrop(monster.x, monster.y, dropItems, rewards.gold, monster.name);
      }

      player.wordsCorrect = (player.wordsCorrect || 0) + 1;
      player.monstersKilled = (player.monstersKilled || 0) + 1;

      db.prepare(`UPDATE characters SET level=?, exp=?, hp=?, max_hp=?, mp=?, max_mp=?,
        atk=?, def=?, gold=?, words_correct=?, monsters_killed=?, x=?, y=?
        WHERE id=?`).run(
        player.level, player.exp, player.hp, player.maxHp, player.mp, player.maxMp,
        player.atk, player.def, player.gold,
        player.wordsCorrect, player.monstersKilled,
        player.x, player.y, socket.characterId
      );

      socket.emit('quiz_result', {
        correct: true,
        monsterInstanceId,
        monsterDied: true, rewards, leveledUp,
        combo: result.combo,
        playerState: {
          level: player.level, exp: player.exp,
          hp: player.hp, maxHp: player.maxHp,
          mp: player.mp, maxMp: player.maxMp,
          atk: player.atk, def: player.def, gold: player.gold
        },
        correctAnswer: result.correctAnswer,
        question: result.question
      });

      if (leveledUp) {
        this.io.emit('system_message', { message: `🎉 ${player.name}님이 레벨 ${player.level}을(를) 달성했습니다!` });
      }

      // Boss kill announcement
      if (monster.isBoss || monster.isWorldBoss) {
        const bossType = monster.isWorldBoss ? '월드보스' : '보스';
        this.io.emit('system_message', { message: `🐉 ${player.name}님이 ${bossType} [${monster.name}]을(를) 처치했습니다!` });
        this.io.emit('boss_killed', { bossName: monster.name, killerName: player.name, isWorldBoss: !!monster.isWorldBoss });
      }

      this.checkAchievements(socket, player);
    } else {
      // Wrong answer: monster revives at 30% HP, continues fighting
      monster.currentHp = Math.max(1, Math.floor(monster.hp * 0.3));
      monster.isDead = false;
      monster.deadAt = null;

      player.wordsWrong = (player.wordsWrong || 0) + 1;
      db.prepare('UPDATE characters SET words_wrong = ? WHERE id = ?').run(player.wordsWrong, socket.characterId);

      socket.emit('quiz_result', {
        correct: false,
        monsterInstanceId,
        monsterDied: false,
        monsterHp: monster.currentHp,
        monsterMaxHp: monster.hp,
        correctAnswer: result.correctAnswer,
        selectedAnswer: result.selectedAnswer,
        question: result.question, combo: 0,
        reason: result.reason || 'wrong'
      });
    }

    db.prepare('INSERT INTO word_history (character_id, word_id, correct) VALUES (?, ?, ?)').run(
      socket.characterId, result.wordId, result.correct ? 1 : 0
    );
  }

  handleSkill(socket, { skillId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const classSkills = CONSTANTS.SKILLS[player.class] || [];
    const skill = classSkills.find(s => s.id === skillId);
    if (!skill) return socket.emit('skill_error', { error: '스킬을 찾을 수 없습니다.' });
    if (player.level < skill.level) return socket.emit('skill_error', { error: `레벨 ${skill.level} 필요` });
    if (this.world.isSkillOnCooldown(socket.id, skillId)) return socket.emit('skill_error', { error: '쿨다운 중입니다.' });
    if (player.mp < (skill.mpCost || 0)) return socket.emit('skill_error', { error: 'MP가 부족합니다.' });

    // Consume MP
    player.mp -= skill.mpCost || 0;
    db.prepare('UPDATE characters SET mp = ? WHERE id = ?').run(player.mp, socket.characterId);

    // Set cooldown
    this.world.setSkillCooldown(socket.id, skillId, skill.cooldown);

    const response = { skillId, cooldown: skill.cooldown, mp: player.mp };

    // Apply skill effect
    if (skill.effect) {
      if (skill.type === 'instant') {
        // Instant effects
        if (skill.effect.healPct) {
          const healAmount = Math.floor(player.maxHp * skill.effect.healPct);
          player.hp = Math.min(player.maxHp, player.hp + healAmount);
          db.prepare('UPDATE characters SET hp = ? WHERE id = ?').run(player.hp, socket.characterId);
          response.healed = healAmount;
        }
        if (skill.effect.resetCooldowns) {
          this.world.resetAllCooldowns(socket.id);
          // Re-set this skill's cooldown though
          this.world.setSkillCooldown(socket.id, skillId, skill.cooldown);
        }
        if (skill.effect.cleanse) {
          // Remove debuffs (buffs with negative effects)
          const buffs = this.world.getBuffs(socket.id);
          this.world.playerBuffs.set(socket.id, buffs.filter(b => {
            return !(b.effect && (b.effect.defMult < 1));
          }));
        }
      }

      if (skill.type === 'buff' && skill.effect.duration) {
        const buff = {
          id: skillId,
          name: skill.name,
          icon: skill.icon,
          effect: { ...skill.effect },
          endTime: Date.now() + skill.effect.duration
        };
        this.world.addBuff(socket.id, buff);
        response.buff = { duration: skill.effect.duration };
        response.buffName = skill.name;
        response.buffIcon = skill.icon;
      } else if (skill.type === 'buff' && skill.effect.charges) {
        const buff = {
          id: skillId,
          name: skill.name,
          icon: skill.icon,
          effect: { ...skill.effect },
          endTime: Date.now() + 60000 // charges last 60s max
        };
        this.world.addBuff(socket.id, buff);
        response.buff = { duration: 60000 };
        response.buffName = skill.name;
        response.buffIcon = skill.icon;
      }
    }

    socket.emit('skill_used', response);
  }

  handleCraft(socket, { recipeId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const recipes = CONSTANTS.CRAFTING_RECIPES || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return socket.emit('craft_result', { success: false, error: '레시피를 찾을 수 없습니다.' });
    if (player.level < (recipe.levelReq || 1)) return socket.emit('craft_result', { success: false, error: `레벨 ${recipe.levelReq} 필요` });

    // Check materials
    for (const mat of recipe.materials) {
      const inv = db.prepare('SELECT SUM(quantity) as total FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, mat.id);
      if (!inv || inv.total < mat.qty) {
        const itemName = itemsMap[mat.id]?.name || mat.id;
        return socket.emit('craft_result', { success: false, error: `${itemName}이(가) 부족합니다. (${inv?.total || 0}/${mat.qty})` });
      }
    }

    // Consume materials
    for (const mat of recipe.materials) {
      let remaining = mat.qty;
      const items = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0 ORDER BY quantity ASC').all(socket.characterId, mat.id);
      for (const inv of items) {
        if (remaining <= 0) break;
        if (inv.quantity <= remaining) {
          remaining -= inv.quantity;
          db.prepare('DELETE FROM inventory WHERE id = ?').run(inv.id);
        } else {
          db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(remaining, inv.id);
          remaining = 0;
        }
      }
    }

    // Give result item
    const resultItem = itemsMap[recipe.result];
    const existing = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, recipe.result);
    if (existing && resultItem && resultItem.stackable) {
      db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)').run(socket.characterId, recipe.result);
    }

    socket.emit('craft_result', { success: true, itemName: resultItem?.name || recipe.name });
    this.sendInventory(socket);
  }

  handleEnhance(socket, { inventoryId, scrollId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    // Get the equipment to enhance
    const invItem = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ? AND equipped = 0').get(inventoryId, socket.characterId);
    if (!invItem) return socket.emit('enhance_result', { success: false, error: '아이템을 찾을 수 없습니다.' });

    const item = itemsMap[invItem.item_id];
    if (!item || item.type !== 'equipment') return socket.emit('enhance_result', { success: false, error: '장비만 강화할 수 있습니다.' });

    const currentLevel = invItem.enhancement_level || 0;
    if (currentLevel >= 10) return socket.emit('enhance_result', { success: false, error: '최대 강화 단계입니다. (+10)' });

    // Check enhancement cost (gold)
    const cost = (CONSTANTS.ENHANCEMENT_COST || [])[currentLevel] || 1000;
    if (player.gold < cost) return socket.emit('enhance_result', { success: false, error: `골드가 부족합니다. (${cost}G 필요)` });

    // Check scroll (optional)
    let scrollType = 'normal';
    let scrollInv = null;
    if (scrollId) {
      scrollInv = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ? AND equipped = 0 AND quantity > 0').get(scrollId, socket.characterId);
      if (scrollInv) {
        const scrollItem = itemsMap[scrollInv.item_id];
        if (scrollItem && scrollItem.effect && scrollItem.effect.enhance) {
          scrollType = scrollItem.effect.enhance;
        }
      }
    }

    // Consume gold
    player.gold -= cost;

    // Consume scroll if used
    if (scrollInv) {
      if (scrollInv.quantity <= 1) db.prepare('DELETE FROM inventory WHERE id = ?').run(scrollInv.id);
      else db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(scrollInv.id);
    }

    // Calculate success rate
    let successRate = CONSTANTS.ENHANCEMENT_SUCCESS[currentLevel] || 0.5;
    if (scrollType === 'blessed') successRate = Math.min(1.0, successRate + 0.1);
    // Cursed scrolls: same rate but destroy on fail

    const roll = Math.random();
    const success = roll < successRate;

    if (success) {
      const newLevel = currentLevel + 1;
      db.prepare('UPDATE inventory SET enhancement_level = ? WHERE id = ?').run(newLevel, invItem.id);
      db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);

      // Announce high-level enhancements
      if (newLevel >= 7) {
        this.io.emit('system_message', { message: `🔥 ${player.name}님이 ${item.name}을(를) +${newLevel} 강화에 성공했습니다!` });
      }

      socket.emit('enhance_result', {
        success: true, newLevel, itemName: item.name, gold: player.gold,
        message: `${item.name} +${newLevel} 강화 성공!`
      });
    } else {
      // Fail: check destruction (cursed scroll or +7 above)
      const destroyThreshold = CONSTANTS.ENHANCEMENT_DESTROY_THRESHOLD || 7;
      const canDestroy = (scrollType === 'cursed') || (currentLevel >= destroyThreshold);
      const destroyed = canDestroy && Math.random() < 0.3; // 30% destruction on eligible fail

      if (destroyed) {
        db.prepare('DELETE FROM inventory WHERE id = ?').run(invItem.id);
        db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);

        this.io.emit('system_message', { message: `💔 ${player.name}님의 ${item.name} +${currentLevel}이(가) 강화 실패로 파괴되었습니다...` });

        socket.emit('enhance_result', {
          success: false, destroyed: true, itemName: item.name, gold: player.gold,
          message: `${item.name} +${currentLevel} 강화 실패! 아이템이 파괴되었습니다!`
        });
      } else {
        // Downgrade by 1 on fail (min 0)
        const newLevel = Math.max(0, currentLevel - 1);
        db.prepare('UPDATE inventory SET enhancement_level = ? WHERE id = ?').run(newLevel, invItem.id);
        db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);

        socket.emit('enhance_result', {
          success: false, destroyed: false, newLevel, itemName: item.name, gold: player.gold,
          message: `${item.name} 강화 실패! +${currentLevel} → +${newLevel}`
        });
      }
    }

    this.sendInventory(socket);
  }

  handleBossStatus(socket) {
    const status = this.world.getWorldBossStatus();
    socket.emit('boss_status', { bosses: status });
  }

  handleUseItem(socket, { itemId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const invItem = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0 AND quantity > 0').get(socket.characterId, itemId);
    if (!invItem) return;

    const item = itemsMap[itemId];
    if (!item || item.type !== 'consumable') return;

    // Enhancement scrolls are handled via enhance_item, not use_item
    if (item.effect.enhance) {
      return socket.emit('item_used_error', { error: '강화 주문서는 강화 창에서 사용하세요.' });
    }

    if (item.effect.hp) player.hp = Math.min(player.maxHp, player.hp + item.effect.hp);
    if (item.effect.mp) player.mp = Math.min(player.maxMp, player.mp + item.effect.mp);

    // Buff scrolls
    if (item.effect.buff) {
      const buff = {
        id: 'scroll_' + item.effect.buff,
        name: item.name,
        icon: '📜',
        effect: {},
        endTime: Date.now() + (item.effect.duration || 300000)
      };
      if (item.effect.buff === 'exp') buff.effect.expMult = item.effect.mult || 1.5;
      if (item.effect.buff === 'atk') buff.effect.atkMult = item.effect.mult || 1.3;
      this.world.addBuff(socket.id, buff);
      socket.emit('buff_applied', { name: item.name, duration: item.effect.duration || 300000 });
    }

    if (invItem.quantity <= 1) db.prepare('DELETE FROM inventory WHERE id = ?').run(invItem.id);
    else db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(invItem.id);

    db.prepare('UPDATE characters SET hp = ?, mp = ? WHERE id = ?').run(player.hp, player.mp, socket.characterId);
    socket.emit('item_used', { itemId, hp: player.hp, mp: player.mp, maxHp: player.maxHp, maxMp: player.maxMp });
    this.sendInventory(socket);
  }

  handleBuyItem(socket, { itemId, quantity = 1 }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const item = itemsMap[itemId];
    if (!item) return;

    const totalCost = item.price * quantity;
    if (player.gold < totalCost) return socket.emit('shop_error', { error: '골드가 부족합니다.' });

    player.gold -= totalCost;

    const existing = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, itemId);
    if (existing && item.stackable) db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    else db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(socket.characterId, itemId, quantity);

    db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);
    socket.emit('buy_success', { itemId, itemName: item.name, quantity, gold: player.gold });
    this.sendInventory(socket);
  }

  handleSellItem(socket, { inventoryId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const invItem = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ? AND equipped = 0').get(inventoryId, socket.characterId);
    if (!invItem) return;

    const item = itemsMap[invItem.item_id];
    if (!item) return;

    const sellPrice = Math.floor(item.price * 0.3);
    player.gold += sellPrice * invItem.quantity;

    db.prepare('DELETE FROM inventory WHERE id = ?').run(inventoryId);
    db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);

    socket.emit('sell_success', { gold: player.gold, earned: sellPrice * invItem.quantity });
    this.sendInventory(socket);
  }

  handleEquipItem(socket, { inventoryId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const invItem = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ?').get(inventoryId, socket.characterId);
    if (!invItem) return;

    const item = itemsMap[invItem.item_id];
    if (!item || item.type !== 'equipment') return;
    if (item.requiredLevel && player.level < item.requiredLevel) {
      return socket.emit('equip_error', { error: `레벨 ${item.requiredLevel} 이상 필요합니다.` });
    }

    if (invItem.equipped) {
      db.prepare('UPDATE inventory SET equipped = 0 WHERE id = ?').run(inventoryId);
      socket.emit('equip_notify', { itemName: item.name, equipped: false });
    } else {
      if (item.slot) {
        for (const eq of db.prepare('SELECT * FROM inventory WHERE character_id = ? AND equipped = 1').all(socket.characterId)) {
          const eqItem = itemsMap[eq.item_id];
          if (eqItem && eqItem.slot === item.slot && eq.id !== inventoryId) {
            db.prepare('UPDATE inventory SET equipped = 0 WHERE id = ?').run(eq.id);
          }
        }
      }
      db.prepare('UPDATE inventory SET equipped = 1 WHERE id = ?').run(inventoryId);
      socket.emit('equip_notify', { itemName: item.name, equipped: true });
    }

    this.recalculateStats(socket);
    this.sendInventory(socket);
  }

  recalculateStats(socket) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(socket.characterId);
    const classData = CONSTANTS.CLASSES[character.class] || CONSTANTS.CLASSES.WARRIOR;

    let baseAtk = classData.baseATK + Math.floor(classData.baseATK * 0.08 * (character.level - 1));
    let baseDef = classData.baseDEF + Math.floor(classData.baseDEF * 0.08 * (character.level - 1));
    let baseMaxHp = classData.baseHP + Math.floor(classData.baseHP * 0.1 * (character.level - 1));
    let baseMaxMp = classData.baseMP + Math.floor(classData.baseMP * 0.1 * (character.level - 1));

    const equipped = db.prepare('SELECT item_id, enhancement_level FROM inventory WHERE character_id = ? AND equipped = 1').all(socket.characterId);
    for (const eq of equipped) {
      const item = itemsMap[eq.item_id];
      if (item && item.stats) {
        const enhLevel = eq.enhancement_level || 0;
        const enhBonus = CONSTANTS.ENHANCEMENT_BONUS[enhLevel] || 0;
        baseAtk += Math.floor((item.stats.atk || 0) * (1 + enhBonus));
        baseDef += Math.floor((item.stats.def || 0) * (1 + enhBonus));
        baseMaxHp += Math.floor((item.stats.hp || 0) * (1 + enhBonus));
        baseMaxMp += Math.floor((item.stats.mp || 0) * (1 + enhBonus));
      }
    }

    player.atk = baseAtk;
    player.def = baseDef;
    player.maxHp = baseMaxHp;
    player.maxMp = baseMaxMp;
    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);

    socket.emit('stats_update', {
      atk: player.atk, def: player.def,
      hp: player.hp, maxHp: player.maxHp,
      mp: player.mp, maxMp: player.maxMp
    });
  }

  handleChat(socket, { message }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;
    if (!message || message.trim().length === 0) return;

    const chatMsg = {
      name: player.name, level: player.level,
      message: message.trim().substring(0, 200),
      timestamp: Date.now()
    };

    db.prepare('INSERT INTO chat_log (character_name, message) VALUES (?, ?)').run(chatMsg.name, chatMsg.message);
    this.io.emit('chat_message', chatMsg);
  }

  handleNpcInteract(socket, { npcId }) {
    const npc = this.world.npcs.find(n => n.id === npcId);
    if (!npc) return;

    socket.emit('npc_dialog', {
      npcId: npc.id, name: npc.name, type: npc.type,
      dialog: npc.dialog || [],
      shopItems: npc.shopItems ? npc.shopItems.map(id => itemsMap[id]).filter(Boolean) : []
    });
  }

  handleHeal(socket) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    player.hp = player.maxHp;
    player.mp = player.maxMp;

    db.prepare('UPDATE characters SET hp = ?, mp = ? WHERE id = ?').run(player.hp, player.mp, socket.characterId);
    socket.emit('healed', { hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp });
  }

  sendInventory(socket) {
    const items = db.prepare('SELECT * FROM inventory WHERE character_id = ?').all(socket.characterId);
    const inventoryWithDetails = items.map(inv => ({
      ...inv,
      enhancement_level: inv.enhancement_level || 0,
      details: itemsMap[inv.item_id] || null
    }));
    socket.emit('inventory_update', { items: inventoryWithDetails });
  }

  // Achievement system
  checkAchievements(socket, player) {
    const achList = CONSTANTS.ACHIEVEMENTS || [];
    for (const ach of achList) {
      // Check if already unlocked (simple check - could use DB for persistence)
      let unlocked = false;
      const c = ach.cond;
      if (c.monstersKilled && (player.monstersKilled || 0) >= c.monstersKilled) unlocked = true;
      if (c.wordsCorrect && (player.wordsCorrect || 0) >= c.wordsCorrect) unlocked = true;
      if (c.level && player.level >= c.level) unlocked = true;
      if (c.gold && player.gold >= c.gold) unlocked = true;
      if (c.maxCombo) {
        const comboData = Combat.getCombo(socket.id);
        if (comboData.maxCombo >= c.maxCombo) unlocked = true;
      }
      if (c.bossKilled) {
        // Simplified: check if monstersKilled > some threshold
        if ((player.monstersKilled || 0) >= 1) unlocked = true; // simplified
      }

      if (unlocked) {
        // Check DB if already awarded (use a simple approach)
        const existing = db.prepare("SELECT 1 FROM word_history WHERE character_id = ? AND word_id = ? AND correct = 99").get(socket.characterId, ach.id.hashCode ? 0 : ach.id.length * 1000 + ach.id.charCodeAt(0));
        if (!existing) {
          // Mark as awarded using a hack (store in word_history with special correct value)
          // In a real game, you'd have an achievements table
          try {
            db.prepare("INSERT INTO word_history (character_id, word_id, correct) VALUES (?, ?, 99)").run(
              socket.characterId, ach.id.length * 1000 + ach.id.charCodeAt(0)
            );
          } catch (e) { /* ignore duplicates */ }

          // Apply rewards
          if (ach.reward) {
            if (ach.reward.gold) {
              player.gold += ach.reward.gold;
              db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);
            }
            if (ach.reward.exp) {
              player.exp += ach.reward.exp;
              db.prepare('UPDATE characters SET exp = ? WHERE id = ?').run(player.exp, socket.characterId);
            }
          }

          socket.emit('achievement_unlock', {
            id: ach.id, name: ach.name, desc: ach.desc,
            icon: ach.icon, reward: ach.reward
          });
        }
      }
    }
  }

  handleDisconnect(socket) {
    const player = this.world.players.get(socket.id);
    if (player && socket.characterId) {
      db.prepare('UPDATE characters SET hp=?, mp=?, gold=?, x=?, y=?, level=?, exp=? WHERE id=?').run(
        player.hp, player.mp, player.gold, player.x, player.y, player.level, player.exp, socket.characterId
      );
      Combat.cancelCombat(socket.id);
      Combat.combos.delete(socket.id);

      // Clear awaitingQuiz flags on any monster this player was fighting
      for (const [id, monster] of this.world.monsters) {
        if (monster.awaitingQuiz && monster.awaitingQuizPlayerId === socket.id) {
          monster.awaitingQuiz = false;
          monster.awaitingQuizPlayerId = null;
          monster.currentHp = Math.max(1, Math.floor(monster.hp * 0.3));
        }
      }

      this.world.removePlayer(socket.id);
      console.log(`${player.name} disconnected`);
    }
  }

  gameLoop() {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    this.world.update(delta);

    // Process monster attacks on players
    if (this.world.pendingAttacks && this.world.pendingAttacks.length > 0) {
      for (const atk of this.world.pendingAttacks) {
        const player = this.world.players.get(atk.playerId);
        const socket = this.io.sockets.sockets.get(atk.playerId);
        if (!player || !socket || player.hp <= 0) continue;

        // Check invincibility buff
        if (this.world.hasBuffEffect(atk.playerId, 'invincible')) continue;

        // Check mana shield
        if (this.world.hasBuffEffect(atk.playerId, 'manaShield')) {
          const mpCost = Math.floor(atk.damage * 1.5);
          if (player.mp >= mpCost) {
            player.mp -= mpCost;
            socket.emit('monster_attack', {
              damage: 0, absorbed: atk.damage,
              monsterName: atk.monsterName,
              hp: player.hp, maxHp: player.maxHp,
              mp: player.mp, maxMp: player.maxMp
            });
            continue;
          }
        }

        player.hp = Math.max(0, player.hp - atk.damage);

        // Auto-potion system: use HP potions when HP drops below threshold
        if (player.hp > 0 && player.hp < player.maxHp * (CONSTANTS.AUTO_POTION_THRESHOLD || 0.3)) {
          const now2 = Date.now();
          if (!player._lastAutoPotion || now2 - player._lastAutoPotion > (CONSTANTS.AUTO_POTION_COOLDOWN || 3000)) {
            // Find best HP potion in inventory
            const potions = db.prepare("SELECT * FROM inventory WHERE character_id = ? AND item_id LIKE 'potion_hp%' AND equipped = 0 AND quantity > 0 ORDER BY item_id DESC").all(socket.characterId);
            if (potions.length > 0) {
              const pot = potions[0];
              const potItem = itemsMap[pot.item_id];
              if (potItem && potItem.effect && potItem.effect.hp) {
                player.hp = Math.min(player.maxHp, player.hp + potItem.effect.hp);
                if (pot.quantity <= 1) db.prepare('DELETE FROM inventory WHERE id = ?').run(pot.id);
                else db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(pot.id);
                player._lastAutoPotion = now2;
                socket.emit('auto_potion_used', { itemId: pot.item_id, itemName: potItem.name, hp: player.hp, maxHp: player.maxHp });
              }
            }
          }
        }

        socket.emit('monster_attack', {
          damage: atk.damage,
          monsterName: atk.monsterName,
          monsterId: atk.monsterId,
          hp: player.hp, maxHp: player.maxHp,
          mp: player.mp, maxMp: player.maxMp
        });

        // Save HP periodically (not every tick - done on disconnect/quiz)
        if (player.hp <= 0) {
          // Player died - respawn at village with half HP + EXP penalty
          player.hp = Math.floor(player.maxHp * 0.5);
          player.x = 2400; player.y = 2400;

          // Death penalty: lose % of current level's required EXP
          const expPenalty = Math.floor((CONSTANTS.EXP_TABLE[player.level - 1] || 200) * (CONSTANTS.DEATH_EXP_PENALTY || 0.03));
          const prevExp = player.exp;
          player.exp = Math.max(0, player.exp - expPenalty);

          db.prepare('UPDATE characters SET hp=?, x=?, y=?, exp=? WHERE id=?').run(
            player.hp, player.x, player.y, player.exp, socket.characterId
          );
          socket.emit('player_died', {
            message: `${atk.monsterName}에게 쓰러졌습니다! 마을로 귀환합니다.`,
            hp: player.hp, maxHp: player.maxHp,
            x: player.x, y: player.y,
            expLost: expPenalty,
            exp: player.exp
          });
        }
      }
      this.world.pendingAttacks = [];
    }
  }

  broadcastState() {
    for (const [socketId, player] of this.world.players) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const visible = this.world.getVisibleEntities(player.x, player.y);
      socket.emit('world_state', {
        monsters: visible.monsters,
        players: visible.players.filter(p => p.id !== socketId),
        npcs: visible.npcs,
        drops: visible.drops || []
      });
    }
  }

  broadcastWeather() {
    const prevWeather = this._lastBroadcastedWeather;
    if (prevWeather !== this.world.weather) {
      this._lastBroadcastedWeather = this.world.weather;
      this.io.emit('weather_change', { weather: this.world.weather });
      if (this.world.weather !== 'clear') {
        this.io.emit('system_message', { message: `🌤 날씨가 변했습니다: ${this.getWeatherName(this.world.weather)}` });
      }
    }
  }

  getWeatherName(w) {
    const names = { clear: '맑음', cloudy: '흐림', rain: '비', storm: '폭풍', snow: '눈', fog: '안개' };
    return names[w] || w;
  }

  checkWorldEvents() {
    if (this.world.activeWorldEvent && this.world.activeWorldEvent.endTime > Date.now()) {
      // Event is active, already broadcasted
    } else if (this.world.activeWorldEvent && this.world.activeWorldEvent.endTime <= Date.now()) {
      this.io.emit('system_message', { message: '월드 이벤트가 종료되었습니다.' });
      this.world.activeWorldEvent = null;
    }

    // Check if a new event was triggered by GameWorld.update
    if (this.world.activeWorldEvent && !this.world.activeWorldEvent.broadcasted) {
      this.world.activeWorldEvent.broadcasted = true;
      this.io.emit('world_event', { message: this.world.activeWorldEvent.message });
      this.io.emit('system_message', { message: `🎉 ${this.world.activeWorldEvent.message}` });
    }

    // Boss announcements
    if (this.world.bossAnnouncements && this.world.bossAnnouncements.length > 0) {
      for (const ann of this.world.bossAnnouncements) {
        this.io.emit('system_message', { message: ann.message });
        if (ann.type === 'boss_spawn') {
          this.io.emit('boss_spawn', { bossId: ann.bossId, zone: ann.zone, message: ann.message });
        } else if (ann.type === 'boss_warning') {
          this.io.emit('boss_warning', { bossId: ann.bossId, message: ann.message });
        }
      }
      this.world.bossAnnouncements = [];
    }

    // Broadcast boss status periodically
    this._bossStatusTimer = (this._bossStatusTimer || 0) + 1;
    if (this._bossStatusTimer >= 3) { // every ~30 seconds
      this._bossStatusTimer = 0;
      const status = this.world.getWorldBossStatus();
      if (status.length > 0) {
        this.io.emit('boss_status', { bosses: status });
      }
    }
  }

  handlePickupDrop(socket, { dropId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const drop = this.world.groundDrops.get(dropId);
    if (!drop) return;

    // Range check (must be within 60px)
    const dist = Math.hypot(drop.x - player.x, drop.y - player.y);
    if (dist > 80) return socket.emit('pickup_error', { error: '너무 멀리 있습니다.' });

    const pickedUp = this.world.pickupGroundDrop(dropId);
    if (!pickedUp) return;

    // Add gold
    if (pickedUp.gold > 0) {
      player.gold += pickedUp.gold;
      db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);
      socket.emit('gold_pickup', { gold: pickedUp.gold, totalGold: player.gold });
    }

    // Add items to inventory
    for (const dropItem of pickedUp.items) {
      const existing = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, dropItem.itemId);
      const itemInfo = itemsMap[dropItem.itemId];
      if (existing && itemInfo && itemInfo.stackable !== false) {
        db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)').run(socket.characterId, dropItem.itemId);
      }
    }

    if (pickedUp.items.length > 0) {
      this.sendInventory(socket);
      const names = pickedUp.items.map(i => i.name).join(', ');
      socket.emit('item_pickup', { items: pickedUp.items, message: `${names} 획득!` });
    }

    socket.emit('pickup_success', { dropId });
  }

  handleEnterDungeon(socket, { dungeonType }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const dungeon = this.world.createDungeon(dungeonType, player.level);
    if (!dungeon) return socket.emit('dungeon_error', { error: '레벨이 부족하거나 유효하지 않은 던전입니다.' });

    dungeon.playerId = socket.id;
    socket.emit('dungeon_enter', {
      dungeonId: dungeon.id, name: dungeon.name,
      waves: dungeon.waves, reward: dungeon.reward,
      monsters: dungeon.monsters, boss: dungeon.boss
    });
  }

  handleDungeonList(socket) {
    const player = this.world.players.get(socket.id);
    if (!player) return;
    socket.emit('dungeon_list', { dungeons: this.world.getDungeonList(player.level) });
  }

  handleDungeonComplete(socket, { dungeonType }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const rewards = {
      goblin_cave: { exp: 200, gold: 150 },
      skeleton_crypt: { exp: 600, gold: 400 },
      dragon_lair: { exp: 2000, gold: 1200 },
      abyss_depths: { exp: 6000, gold: 3500 }
    };
    const reward = rewards[dungeonType];
    if (!reward) return;

    // Give EXP
    player.exp += reward.exp;
    const expNeeded = CONSTANTS.EXP_TABLE[player.level] || (player.level * 100);
    while (player.exp >= expNeeded && player.level < 100) {
      player.exp -= expNeeded;
      player.level++;
      const hpUp = 20 + player.level * 3;
      const mpUp = 10 + player.level * 2;
      player.maxHp += hpUp;
      player.maxMp += mpUp;
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      player.atk += 2;
      player.def += 1;
      socket.emit('level_up', { level: player.level, maxHp: player.maxHp, maxMp: player.maxMp });
      this.io.emit('system_message', { message: `🎉 ${player.name}님이 레벨 ${player.level}을 달성했습니다!` });
    }

    // Give gold
    player.gold += reward.gold;

    // Save to DB
    db.prepare('UPDATE characters SET level=?, exp=?, hp=?, mp=?, max_hp=?, max_mp=?, atk=?, def=?, gold=? WHERE id=?')
      .run(player.level, player.exp, player.hp, player.mp, player.maxHp, player.maxMp, player.atk, player.def, player.gold, socket.characterId);

    socket.emit('dungeon_reward', { exp: reward.exp, gold: reward.gold });
    socket.emit('stats_update', {
      level: player.level, exp: player.exp, hp: player.hp, mp: player.mp,
      maxHp: player.maxHp, maxMp: player.maxMp, atk: player.atk, def: player.def, gold: player.gold
    });
  }
}

module.exports = SocketHandler;
