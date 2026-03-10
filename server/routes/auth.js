const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'runeword_secret';
const CONSTANTS = require('../../shared/constants');

router.post('/register', (req, res) => {
  try {
    const { username, password, characterName, characterClass } = req.body;
    if (!username || !password || !characterName) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }
    if (username.length < 3 || password.length < 4) {
      return res.status(400).json({ error: '아이디 3자, 비밀번호 4자 이상 입력해주세요.' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });

    const existingChar = db.prepare('SELECT id FROM characters WHERE name = ?').get(characterName);
    if (existingChar) return res.status(400).json({ error: '이미 존재하는 캐릭터명입니다.' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userResult = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    const userId = userResult.lastInsertRowid;

    const classData = CONSTANTS.CLASSES[characterClass] || CONSTANTS.CLASSES.WARRIOR;
    db.prepare(`
      INSERT INTO characters (user_id, name, class, hp, max_hp, mp, max_mp, atk, def, speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, characterName, characterClass || 'WARRIOR',
      classData.baseHP, classData.baseHP, classData.baseMP, classData.baseMP,
      classData.baseATK, classData.baseDEF, classData.baseSpeed);

    const charId = db.prepare('SELECT id FROM characters WHERE user_id = ?').get(userId).id;
    db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(charId, 'potion_hp_small', 10);
    db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(charId, 'potion_mp_small', 5);
    db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(charId, 'sword_wooden', 1);

    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, userId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' });
    }

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(user.id);
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, userId: user.id, character });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
