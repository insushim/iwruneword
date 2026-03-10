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

      const equipped = db.prepare('SELECT item_id FROM inventory WHERE character_id = ? AND equipped = 1').all(character.id);
      let bonusAtk = 0, bonusDef = 0, bonusHp = 0, bonusMp = 0;
      for (const eq of equipped) {
        const item = itemsMap[eq.item_id];
        if (item && item.stats) {
          bonusAtk += item.stats.atk || 0;
          bonusDef += item.stats.def || 0;
          bonusHp += item.stats.hp || 0;
          bonusMp += item.stats.mp || 0;
        }
      }

      const playerState = {
        id: character.id,
        name: character.name,
        class: character.class,
        level: character.level,
        exp: character.exp,
        hp: character.hp,
        maxHp: character.max_hp + bonusHp,
        mp: character.mp,
        maxMp: character.max_mp + bonusMp,
        atk: character.atk + bonusAtk,
        def: character.def + bonusDef,
        speed: character.speed,
        gold: character.gold,
        zone: character.zone,
        x: character.x,
        y: character.y,
        wordsCorrect: character.words_correct,
        wordsWrong: character.words_wrong,
        monstersKilled: character.monsters_killed
      };

      this.world.addPlayer(socket.id, playerState);
      socket.emit('auth_success', { player: playerState });
      this.sendInventory(socket);

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

    const monster = this.world.getMonster(monsterInstanceId);
    if (!monster || monster.isDead) {
      socket.emit('attack_error', { error: '대상을 찾을 수 없습니다.' });
      return;
    }

    const dx = monster.x - player.x;
    const dy = monster.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 100) {
      socket.emit('attack_error', { error: '너무 멀리 있습니다.' });
      return;
    }

    const quiz = Combat.generateQuiz(socket.id, monster);
    if (!quiz) {
      socket.emit('attack_error', { error: '퀴즈 생성 실패' });
      return;
    }

    socket.emit('quiz_show', {
      ...quiz,
      monsterInstanceId,
      monsterName: monster.name
    });
  }

  handleQuizAnswer(socket, { answerIndex, monsterInstanceId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const result = Combat.processAnswer(socket.id, answerIndex);
    if (!result.valid) return;

    const monster = this.world.getMonster(monsterInstanceId);
    if (!monster || monster.isDead) return;

    if (result.correct) {
      const damage = Combat.calculateDamage(player.atk, monster.def, true);
      monster.currentHp -= damage;

      let rewards = null;
      let monsterDied = false;

      if (monster.currentHp <= 0) {
        monster.isDead = true;
        monster.deadAt = Date.now();
        monsterDied = true;

        rewards = Combat.calculateRewards(monster, player.level, true);

        player.exp += rewards.exp;
        player.gold += rewards.gold;

        let leveledUp = false;
        while (player.level < 99 && player.exp >= CONSTANTS.EXP_TABLE[player.level - 1]) {
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

        for (const dropItemId of rewards.drops) {
          const existing = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, dropItemId);
          const itemInfo = itemsMap[dropItemId];
          if (existing && itemInfo && itemInfo.stackable) {
            db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
          } else {
            db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)').run(socket.characterId, dropItemId);
          }
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
          damage,
          monsterDied: true,
          rewards,
          leveledUp,
          playerState: {
            level: player.level,
            exp: player.exp,
            hp: player.hp,
            maxHp: player.maxHp,
            mp: player.mp,
            maxMp: player.maxMp,
            atk: player.atk,
            def: player.def,
            gold: player.gold
          },
          correctAnswer: result.correctAnswer,
          question: result.question
        });

        if (leveledUp) {
          this.io.emit('system_message', { message: `${player.name}님이 레벨 ${player.level}을(를) 달성했습니다!` });
        }
      } else {
        player.wordsCorrect = (player.wordsCorrect || 0) + 1;
        db.prepare('UPDATE characters SET words_correct = ? WHERE id = ?').run(player.wordsCorrect, socket.characterId);

        socket.emit('quiz_result', {
          correct: true,
          damage,
          monsterDied: false,
          monsterHp: monster.currentHp,
          monsterMaxHp: monster.hp,
          correctAnswer: result.correctAnswer,
          question: result.question
        });
      }
    } else {
      player.wordsWrong = (player.wordsWrong || 0) + 1;
      db.prepare('UPDATE characters SET words_wrong = ? WHERE id = ?').run(player.wordsWrong, socket.characterId);

      socket.emit('quiz_result', {
        correct: false,
        damage: 0,
        correctAnswer: result.correctAnswer,
        selectedAnswer: result.selectedAnswer,
        question: result.question,
        reason: result.reason || 'wrong'
      });
    }

    db.prepare('INSERT INTO word_history (character_id, word_id, correct) VALUES (?, ?, ?)').run(
      socket.characterId, result.wordId, result.correct ? 1 : 0
    );
  }

  handleUseItem(socket, { itemId }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;

    const invItem = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0 AND quantity > 0').get(socket.characterId, itemId);
    if (!invItem) return;

    const item = itemsMap[itemId];
    if (!item || item.type !== 'consumable') return;

    if (item.effect.hp) {
      player.hp = Math.min(player.maxHp, player.hp + item.effect.hp);
    }
    if (item.effect.mp) {
      player.mp = Math.min(player.maxMp, player.mp + item.effect.mp);
    }

    if (invItem.quantity <= 1) {
      db.prepare('DELETE FROM inventory WHERE id = ?').run(invItem.id);
    } else {
      db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(invItem.id);
    }

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
    if (player.gold < totalCost) {
      socket.emit('shop_error', { error: '골드가 부족합니다.' });
      return;
    }

    player.gold -= totalCost;

    const existing = db.prepare('SELECT * FROM inventory WHERE character_id = ? AND item_id = ? AND equipped = 0').get(socket.characterId, itemId);
    if (existing && item.stackable) {
      db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    } else {
      db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(socket.characterId, itemId, quantity);
    }

    db.prepare('UPDATE characters SET gold = ? WHERE id = ?').run(player.gold, socket.characterId);
    socket.emit('buy_success', { itemId, quantity, gold: player.gold });
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
      socket.emit('equip_error', { error: `레벨 ${item.requiredLevel} 이상 필요합니다.` });
      return;
    }

    if (invItem.equipped) {
      db.prepare('UPDATE inventory SET equipped = 0 WHERE id = ?').run(inventoryId);
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

    const equipped = db.prepare('SELECT item_id FROM inventory WHERE character_id = ? AND equipped = 1').all(socket.characterId);
    for (const eq of equipped) {
      const item = itemsMap[eq.item_id];
      if (item && item.stats) {
        baseAtk += item.stats.atk || 0;
        baseDef += item.stats.def || 0;
        baseMaxHp += item.stats.hp || 0;
        baseMaxMp += item.stats.mp || 0;
      }
    }

    player.atk = baseAtk;
    player.def = baseDef;
    player.maxHp = baseMaxHp;
    player.maxMp = baseMaxMp;
    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);

    socket.emit('stats_update', {
      atk: player.atk,
      def: player.def,
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp
    });
  }

  handleChat(socket, { message }) {
    const player = this.world.players.get(socket.id);
    if (!player) return;
    if (!message || message.trim().length === 0) return;

    const chatMsg = {
      name: player.name,
      level: player.level,
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
      npcId: npc.id,
      name: npc.name,
      type: npc.type,
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
      details: itemsMap[inv.item_id] || null
    }));
    socket.emit('inventory_update', { items: inventoryWithDetails });
  }

  handleDisconnect(socket) {
    const player = this.world.players.get(socket.id);
    if (player && socket.characterId) {
      db.prepare('UPDATE characters SET hp=?, mp=?, gold=?, x=?, y=?, level=?, exp=? WHERE id=?').run(
        player.hp, player.mp, player.gold, player.x, player.y, player.level, player.exp, socket.characterId
      );
      Combat.cancelCombat(socket.id);
      this.world.removePlayer(socket.id);
      console.log(`${player.name} disconnected`);
    }
  }

  gameLoop() {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    this.world.update(delta);
  }

  broadcastState() {
    for (const [socketId, player] of this.world.players) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const visible = this.world.getVisibleEntities(player.x, player.y);
      socket.emit('world_state', {
        monsters: visible.monsters,
        players: visible.players.filter(p => p.id !== socketId),
        npcs: visible.npcs
      });
    }
  }
}

module.exports = SocketHandler;
