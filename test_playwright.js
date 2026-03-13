const { chromium } = require('playwright');

async function registerAndEnterGame(page) {
  const username = `test_${Date.now().toString().slice(-6)}`;
  const charname = `War${Date.now().toString().slice(-4)}`;

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  console.log('   Page loaded.');

  console.log('2. Registering a new account...');
  await page.evaluate(() => showLoginTab('register'));
  await page.waitForSelector('#reg-username', { state: 'visible' });
  await page.fill('#reg-username', username);
  await page.fill('#reg-password', 'test1234');
  await page.fill('#reg-charname', charname);
  await page.selectOption('#reg-class', 'WARRIOR');
  await page.click('.btn-register');
  console.log(`   Registered ${username} / ${charname}.`);

  console.log('3. Waiting for the game canvas...');
  await page.waitForSelector('canvas', { state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    return typeof player !== 'undefined' && player && Array.isArray(worldState?.monsters);
  }, { timeout: 10000 });
  await page.waitForTimeout(1500);
  console.log('   Canvas is visible.');
}

async function waitForQuiz(page, maxPresses = 8) {
  for (let i = 0; i < maxPresses; i++) {
    console.log(`4.${i + 1} Pressing Space...`);
    await page.keyboard.press('Space');
    const quizVisible = await page.waitForFunction(() => {
      const panel = document.getElementById('quiz-panel');
      return !!(quizActive || (panel && getComputedStyle(panel).display !== 'none'));
    }, { timeout: 900 }).then(() => true).catch(() => false);

    const snapshot = await page.evaluate(() => ({
      selectedMonster,
      quizActive,
      playerHp: player?.hp ?? null,
      nearest: worldState.monsters.reduce((best, m) => {
        const d = Math.hypot(m.x - player.x, m.y - player.y);
        return !best || d < best.distance
          ? { id: m.instanceId, name: m.name, hp: m.currentHp, distance: Math.round(d) }
          : best;
      }, null)
    }));
    console.log(`   State: ${JSON.stringify(snapshot)}`);

    if (quizVisible || snapshot.quizActive) {
      console.log('   Quiz appeared.');
      return true;
    }

    await page.waitForTimeout(250);
  }

  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await registerAndEnterGame(page);

  console.log('4. Taking initial game screenshot...');
  await page.screenshot({ path: 'D:/iwruneword/screenshot_new1.png', fullPage: false });
  console.log('   Saved to screenshot_new1.png');

  const quizVisible = await waitForQuiz(page);
  if (!quizVisible) {
    throw new Error('Quiz did not appear after repeated Space attacks.');
  }

  console.log('5. Taking quiz screenshot...');
  await page.screenshot({ path: 'D:/iwruneword/screenshot_quiz.png', fullPage: false });
  console.log('   Saved to screenshot_quiz.png');

  console.log('6. Clicking the first quiz choice...');
  await page.click('#quiz-choice-0');
  await page.waitForTimeout(1300);

  console.log('7. Taking result screenshot...');
  await page.screenshot({ path: 'D:/iwruneword/screenshot_result.png', fullPage: false });
  console.log('   Saved to screenshot_result.png');

  const result = await page.evaluate(() => ({
    resultDisplay: getComputedStyle(document.getElementById('quiz-result')).display,
    resultText: document.getElementById('quiz-result').textContent.replace(/\s+/g, ' ').trim(),
    player: {
      hp: player?.hp ?? null,
      exp: player?.exp ?? null,
      gold: player?.gold ?? null,
      level: player?.level ?? null
    }
  }));
  console.log(`8. Result snapshot: ${JSON.stringify(result)}`);

  console.log('\nDone.');
  await browser.close();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
