const fs = require('fs');
const path = require('path');

const wordsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/words.json'), 'utf8'));
const allWords = wordsData.words;

class Combat {
  constructor() {
    this.activeCombats = new Map();
  }

  generateQuiz(playerId, monsterData) {
    const difficulty = monsterData.wordDifficulty || 1;
    const filteredWords = allWords.filter(w => w.difficulty === difficulty);
    if (filteredWords.length === 0) return null;

    const correctWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
    const isKoreanToEnglish = Math.random() > 0.5;

    let wrongWord;
    const wrongCandidates = filteredWords.filter(w => w.id !== correctWord.id);
    if (wrongCandidates.length > 0) {
      wrongWord = wrongCandidates[Math.floor(Math.random() * wrongCandidates.length)];
    } else {
      const fallback = allWords.filter(w => w.id !== correctWord.id);
      wrongWord = fallback[Math.floor(Math.random() * fallback.length)];
    }

    let question, choices, correctIndex;

    if (isKoreanToEnglish) {
      question = correctWord.korean;
      const correct = correctWord.english;
      const wrong = wrongWord.english;
      if (Math.random() > 0.5) {
        choices = [correct, wrong];
        correctIndex = 0;
      } else {
        choices = [wrong, correct];
        correctIndex = 1;
      }
    } else {
      question = correctWord.english;
      const correct = correctWord.korean;
      const wrong = wrongWord.korean;
      if (Math.random() > 0.5) {
        choices = [correct, wrong];
        correctIndex = 0;
      } else {
        choices = [wrong, correct];
        correctIndex = 1;
      }
    }

    const timeLimits = { 1: 10000, 2: 8000, 3: 6000, 4: 5000, 5: 4000 };
    const timeLimit = timeLimits[difficulty] || 8000;

    const quiz = {
      wordId: correctWord.id,
      question,
      choices,
      correctIndex,
      isKoreanToEnglish,
      difficulty,
      timeLimit,
      createdAt: Date.now(),
      monsterId: monsterData.id
    };

    this.activeCombats.set(playerId, quiz);
    return {
      question: quiz.question,
      choices: quiz.choices,
      isKoreanToEnglish: quiz.isKoreanToEnglish,
      timeLimit: quiz.timeLimit,
      difficulty: quiz.difficulty
    };
  }

  processAnswer(playerId, answerIndex) {
    const quiz = this.activeCombats.get(playerId);
    if (!quiz) return { valid: false, error: 'no_active_quiz' };

    this.activeCombats.delete(playerId);

    const elapsed = Date.now() - quiz.createdAt;
    if (elapsed > quiz.timeLimit) {
      return { valid: true, correct: false, reason: 'timeout', wordId: quiz.wordId };
    }

    const isCorrect = answerIndex === quiz.correctIndex;
    return {
      valid: true,
      correct: isCorrect,
      wordId: quiz.wordId,
      correctAnswer: quiz.choices[quiz.correctIndex],
      selectedAnswer: quiz.choices[answerIndex],
      question: quiz.question,
      elapsed
    };
  }

  calculateDamage(attackerAtk, defenderDef, isCorrect) {
    if (!isCorrect) return 0;
    const baseDamage = Math.max(1, attackerAtk - defenderDef * 0.5);
    const variance = 0.85 + Math.random() * 0.3;
    return Math.floor(baseDamage * variance);
  }

  calculateRewards(monsterData, playerLevel, isCorrect) {
    if (!isCorrect) return { exp: 0, gold: 0, drops: [] };

    const levelDiff = monsterData.level - playerLevel;
    let expMultiplier = 1;
    if (levelDiff > 5) expMultiplier = 1.5;
    else if (levelDiff > 0) expMultiplier = 1.2;
    else if (levelDiff < -5) expMultiplier = 0.5;
    else if (levelDiff < -10) expMultiplier = 0.1;

    const exp = Math.floor(monsterData.exp * expMultiplier);
    const goldMin = monsterData.gold[0];
    const goldMax = monsterData.gold[1];
    const gold = Math.floor(goldMin + Math.random() * (goldMax - goldMin + 1));

    const drops = [];
    if (monsterData.drops) {
      for (const drop of monsterData.drops) {
        if (Math.random() < drop.rate) {
          drops.push(drop.itemId);
        }
      }
    }

    return { exp, gold, drops };
  }

  cancelCombat(playerId) {
    this.activeCombats.delete(playerId);
  }
}

module.exports = new Combat();
