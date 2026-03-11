const fs = require('fs');
const path = require('path');

const wordsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/words.json'), 'utf8'));
const allWords = wordsData.words;
const CONSTANTS = require('../../shared/constants');

class Combat {
  constructor() {
    this.activeCombats = new Map();
    this.combos = new Map(); // playerId -> { count, lastTime }
  }

  generateQuiz(playerId, monsterData) {
    const difficulty = monsterData.wordDifficulty || 1;
    const filteredWords = allWords.filter(w => w.difficulty === difficulty);
    if (filteredWords.length < 4) {
      // Fallback to all words if not enough for 4 choices
      filteredWords.push(...allWords.filter(w => !filteredWords.includes(w)));
    }
    if (filteredWords.length === 0) return null;

    const correctWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
    const isKoreanToEnglish = Math.random() > 0.5;

    // Generate 3 wrong answers (4-choice quiz)
    const wrongCandidates = filteredWords.filter(w => w.id !== correctWord.id);
    const wrongWords = [];
    const used = new Set([correctWord.id]);

    // Try same difficulty first, then fallback
    for (let i = 0; i < 3 && wrongCandidates.length > 0; i++) {
      let pool = wrongCandidates.filter(w => !used.has(w.id));
      if (pool.length === 0) pool = allWords.filter(w => !used.has(w.id));
      if (pool.length === 0) break;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      wrongWords.push(pick);
      used.add(pick.id);
    }

    // Build choices array with correct answer at random position
    const choices = [];
    const correctIndex = Math.floor(Math.random() * (wrongWords.length + 1));

    for (let i = 0, wi = 0; i <= wrongWords.length; i++) {
      if (i === correctIndex) {
        choices.push(isKoreanToEnglish ? correctWord.english : correctWord.korean);
      } else {
        const w = wrongWords[wi++];
        choices.push(isKoreanToEnglish ? w.english : w.korean);
      }
    }

    const question = isKoreanToEnglish ? correctWord.korean : correctWord.english;

    const timeLimits = { 1: 12000, 2: 10000, 3: 8000, 4: 6000, 5: 5000 };
    const timeLimit = timeLimits[difficulty] || 10000;

    // Check for player buff that adds time
    const playerCombo = this.combos.get(playerId);
    const bonusTime = 0; // Can be modified by skills

    const quiz = {
      wordId: correctWord.id,
      question,
      choices,
      correctIndex,
      isKoreanToEnglish,
      difficulty,
      timeLimit: timeLimit + bonusTime,
      createdAt: Date.now(),
      monsterId: monsterData.id
    };

    this.activeCombats.set(playerId, quiz);
    return {
      question: quiz.question,
      choices: quiz.choices,
      isKoreanToEnglish: quiz.isKoreanToEnglish,
      timeLimit: quiz.timeLimit,
      difficulty: quiz.difficulty,
      choiceCount: choices.length
    };
  }

  processAnswer(playerId, answerIndex) {
    const quiz = this.activeCombats.get(playerId);
    if (!quiz) return { valid: false, error: 'no_active_quiz' };

    this.activeCombats.delete(playerId);

    const elapsed = Date.now() - quiz.createdAt;
    if (elapsed > quiz.timeLimit) {
      this.resetCombo(playerId);
      return {
        valid: true,
        correct: false,
        reason: 'timeout',
        wordId: quiz.wordId,
        correctAnswer: quiz.choices[quiz.correctIndex],
        question: quiz.question,
        combo: 0
      };
    }

    const isCorrect = answerIndex === quiz.correctIndex;

    if (isCorrect) {
      this.incrementCombo(playerId);
    } else {
      this.resetCombo(playerId);
    }

    const comboData = this.combos.get(playerId) || { count: 0 };

    return {
      valid: true,
      correct: isCorrect,
      wordId: quiz.wordId,
      correctAnswer: quiz.choices[quiz.correctIndex],
      selectedAnswer: answerIndex >= 0 && answerIndex < quiz.choices.length ? quiz.choices[answerIndex] : null,
      question: quiz.question,
      elapsed,
      combo: comboData.count,
      comboMultiplier: this.getComboMultiplier(comboData.count)
    };
  }

  incrementCombo(playerId) {
    const data = this.combos.get(playerId) || { count: 0, lastTime: 0, maxCombo: 0 };
    data.count++;
    data.lastTime = Date.now();
    if (data.count > data.maxCombo) data.maxCombo = data.count;
    this.combos.set(playerId, data);
  }

  resetCombo(playerId) {
    const data = this.combos.get(playerId);
    if (data) {
      data.count = 0;
      this.combos.set(playerId, data);
    }
  }

  getCombo(playerId) {
    return this.combos.get(playerId) || { count: 0, maxCombo: 0 };
  }

  getComboMultiplier(comboCount) {
    const mults = CONSTANTS.COMBO_MULTIPLIERS || [1, 1, 1.1, 1.2, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3];
    return mults[Math.min(comboCount, mults.length - 1)];
  }

  calculateDamage(attackerAtk, defenderDef, isCorrect, comboMultiplier = 1, buffMultiplier = 1) {
    if (!isCorrect) return 0;
    const baseDamage = Math.max(1, attackerAtk - defenderDef * 0.5);
    const variance = 0.85 + Math.random() * 0.3;
    return Math.floor(baseDamage * variance * comboMultiplier * buffMultiplier);
  }

  calculateRewards(monsterData, playerLevel, isCorrect, comboMultiplier = 1, expMultiplier = 1) {
    if (!isCorrect) return { exp: 0, gold: 0, drops: [] };

    const levelDiff = monsterData.level - playerLevel;
    let expMod = 1;
    if (levelDiff > 5) expMod = 1.5;
    else if (levelDiff > 0) expMod = 1.2;
    else if (levelDiff < -5) expMod = 0.5;
    else if (levelDiff < -10) expMod = 0.1;

    const exp = Math.floor(monsterData.exp * expMod * comboMultiplier * expMultiplier);
    const goldMin = monsterData.gold[0];
    const goldMax = monsterData.gold[1];
    const gold = Math.floor((goldMin + Math.random() * (goldMax - goldMin + 1)) * comboMultiplier);

    const drops = [];
    if (monsterData.drops) {
      for (const drop of monsterData.drops) {
        // Combo increases drop rate slightly
        const adjustedRate = drop.rate * (1 + (comboMultiplier - 1) * 0.5);
        if (Math.random() < adjustedRate) {
          drops.push(drop.itemId);
        }
      }
    }

    return { exp, gold, drops };
  }

  cancelCombat(playerId) {
    this.activeCombats.delete(playerId);
  }

  cleanupPlayer(playerId) {
    this.activeCombats.delete(playerId);
    this.combos.delete(playerId);
  }
}

module.exports = new Combat();
