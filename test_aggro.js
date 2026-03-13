const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('[1] Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const username = `test_aggro_${Date.now().toString().slice(-6)}`;
  const charname = `Aggro${Date.now().toString().slice(-4)}`;

  console.log('[2] Switching to register tab ...');
  await page.evaluate(() => showLoginTab('register'));
  await page.waitForSelector('#register-fields.show', { timeout: 3000 });

  console.log(`[3] Registering: ${username} / test1234 / ${charname} / WARRIOR`);
  await page.fill('#reg-username', username);
  await page.fill('#reg-password', 'test1234');
  await page.fill('#reg-charname', charname);
  await page.selectOption('#reg-class', 'WARRIOR');

  console.log('[4] Clicking register ...');
  await page.click('.btn-register');

  console.log('[5] Waiting for game load ...');
  await page.waitForSelector('#game-canvas', { state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    return typeof player !== 'undefined' && player && Array.isArray(worldState?.monsters);
  }, { timeout: 10000 });
  await page.waitForTimeout(1500);

  const initialState = await page.evaluate(() => ({
    x: Math.round(player.x),
    y: Math.round(player.y),
    hp: player.hp,
    maxHp: player.maxHp
  }));
  console.log(`[6] Initial state: ${JSON.stringify(initialState)}`);

  console.log('[7] Starting combat near the spawn point ...');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }

  const movedState = await page.evaluate(() => ({
    x: Math.round(player.x),
    y: Math.round(player.y),
    hp: player.hp,
    maxHp: player.maxHp
  }));
  console.log(`[8] Position after moving: ${JSON.stringify(movedState)}`);

  console.log('[9] Waiting 5 seconds for combat damage to land ...');
  await page.waitForTimeout(5000);

  console.log('[10] Taking screenshot ...');
  await page.screenshot({ path: 'D:/iwruneword/screenshot_attacked.png', fullPage: false });
  console.log('[10b] Screenshot saved to D:/iwruneword/screenshot_attacked.png');

  const hpText = await page.evaluate(() => document.getElementById('hp-text')?.textContent || 'N/A');
  console.log(`\n========== HP VALUE ==========`);
  console.log(`HP: ${hpText}`);
  console.log(`==============================\n`);

  const chatText = await page.evaluate(() => document.getElementById('chat-messages')?.innerText || 'No chat messages');
  console.log(`========== CHAT MESSAGES ==========`);
  console.log(chatText);
  console.log(`===================================\n`);

  const finalState = await page.evaluate(() => ({
    hp: player.hp,
    maxHp: player.maxHp,
    x: Math.round(player.x),
    y: Math.round(player.y)
  }));
  console.log(`[11] Final player state: ${JSON.stringify(finalState)}`);

  if (finalState.hp < finalState.maxHp) {
    console.log(`\n*** CONFIRMED: Player took combat damage. Lost ${finalState.maxHp - finalState.hp} HP ***`);
  } else {
    throw new Error('Player did not take damage during the combat smoke window.');
  }

  await browser.close();
  console.log('\nDone.');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
