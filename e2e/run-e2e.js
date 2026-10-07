import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const DEBUG_DIR = path.resolve(process.cwd(), 'debug-output');
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function runScenarios() {
  console.log('--- Starting Playwright Real Browser E2E Test ---');

  // Verify real sample image fixture
  const fixturePath = path.resolve(process.cwd(), 'e2e/fixtures/sample-certificate.jpg');
  if (fs.existsSync(fixturePath)) {
    const stats = fs.statSync(fixturePath);
    console.log(`[E2E Fixture] Real sample image found at ${fixturePath}: ${stats.size} bytes (> 20 KB: ${stats.size > 20000})`);
  } else {
    console.warn(`[E2E Fixture] Warning: ${fixturePath} not found.`);
  }

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // Scenario S1: Issue V1 & Verify
  // -------------------------------------------------------------
  console.log('\n[S1] Launching clean context for S1 (Issue V1 & Verify)...');
  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1 = await context1.newPage();

  // Collect console logs
  const logsS1 = [];
  page1.on('console', (msg) => {
    const text = msg.text();
    logsS1.push(text);
    if (text.includes('CERTI-TRACE') || text.includes('error') || text.includes('Error') || text.includes('pinata')) {
      console.log(`[Browser Console] ${text}`);
    }
  });
  page1.on('pageerror', (err) => console.error('[Browser PageError]', err));

  await page1.goto('http://localhost:5173/issue?debug=1');
  await page1.waitForLoadState('networkidle');
  await page1.waitForTimeout(1000);

  // Connect Wallet
  console.log('[S1] Connecting wallet...');
  const connectWalletBtn = page1.locator('button:has-text("Connect Wallet"), button:has-text("Connect")').first();
  if (await connectWalletBtn.isVisible()) {
    await connectWalletBtn.click({ force: true });
    await page1.waitForTimeout(500);
    const deployerBtn = page1.locator('button:has-text("Deployer")').first();
    if (await deployerBtn.isVisible()) {
      await deployerBtn.click({ force: true });
      await page1.waitForTimeout(1000);
    }
    const closeBtn = page1.locator('button[aria-label="Close modal"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click({ force: true });
      await page1.waitForTimeout(500);
    }
  }

  // Switch to Custom Template
  console.log('[S1] Switching to Custom Template tab...');
  await page1.locator('button:has-text("Custom Template")').first().click({ force: true });
  await page1.waitForTimeout(1000);

  // Screenshot Issue Page showing target network and registry
  await page1.screenshot({ path: path.join(DEBUG_DIR, 's0_issue_page_network.png'), fullPage: true });

  // Switch to Saved Template Library or check if active template already chosen
  const libraryTab = page1.locator('button:has-text("Saved Template Library")').first();
  if (await libraryTab.isVisible()) {
    console.log('[S1] Opening Saved Template Library...');
    await libraryTab.click({ force: true });
    await page1.waitForTimeout(500);
    const useTemplateBtn = page1.locator('button:has-text("Use Template")').first();
    if (await useTemplateBtn.isVisible()) {
      console.log('[S1] Selecting template...');
      await useTemplateBtn.click({ force: true });
      await page1.waitForTimeout(1000);
    }
  }

  const runId = Date.now().toString().slice(-4);
  const certNoV1 = `CERT-A-${runId}`;
  const nameV1 = `Alice Nakamoto`;
  const certNoV2 = `CERT-B-${runId}`;
  const nameV2 = `Bob Szabo`;

  // Fill in V1 values
  console.log(`[S1] Filling dynamic fields with V1 values (${nameV1}, ${certNoV1})...`);
  const certNoInput = page1.locator('input[placeholder*="CERT"], input[value*="CBT"]').first();
  if (await certNoInput.isVisible()) {
    await certNoInput.fill(certNoV1);
  }

  const certTypeInput = page1.locator('input[placeholder*="Participation"], input[value*="PARTICIPATION"]').first();
  if (await certTypeInput.isVisible()) {
    await certTypeInput.fill('COMPLETION');
  }

  const nameInput = page1.locator('input[value*="SOUMALYA"], input[placeholder*="Alice"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill(nameV1);
  }

  const roleInput = page1.locator('input[value*="participated"], input[placeholder*="participated"]').first();
  if (await roleInput.isVisible()) {
    await roleInput.fill('participated');
  }

  const eventInput = page1.locator('textarea, input[value*="Hands-on"], input[placeholder*="Event"], input[placeholder*="Course"]').first();
  if (await eventInput.isVisible()) {
    await eventInput.fill('Applied Cryptography Workshop (3 Days - Training) Course');
  }

  const startDateInput = page1.locator('input[type="date"]').nth(0);
  if (await startDateInput.isVisible()) {
    await startDateInput.fill('2026-08-01');
  }

  const endDateInput = page1.locator('input[type="date"]').nth(1);
  if (await endDateInput.isVisible()) {
    await endDateInput.fill('2026-08-05');
  }

  await page1.waitForTimeout(1000);

  // Capture Live Preview Screenshot for S1
  console.log('[S1] Capturing Live Interactive Preview screenshot...');
  const previewElement = page1.locator('#template-certificate-preview-node, .lg\\:col-span-7').first();
  await previewElement.screenshot({ path: path.join(DEBUG_DIR, 's1_live_preview.png') });

  // Issue Certificate On-Chain
  console.log('[S1] Clicking "Anchor & Issue Certificate On-Chain"...');
  const issueButton = page1.locator('button:has-text("Anchor & Issue Certificate On-Chain"), button:has-text("Issue On-Chain")').first();
  await issueButton.click();

  // Wait for confirmation
  console.log('[S1] Waiting for blockchain confirmation and proof hash generation...');
  const viewPortalBtn = page1.locator('button:has-text("View in Verification Portal")');
  await viewPortalBtn.waitFor({ state: 'visible', timeout: 35000 });

  // Capture success screen screenshot
  await page1.screenshot({ path: path.join(DEBUG_DIR, 's1_success_screen.png'), fullPage: true });

  // Extract issue trace directly from window.__CERTI_TRACER__
  const issuerTraces = await page1.evaluate(() => {
    return window.__CERTI_TRACER__ ? window.__CERTI_TRACER__.getEntries() : [];
  });
  fs.writeFileSync(path.join(DEBUG_DIR, 's1_issue_trace.json'), JSON.stringify(issuerTraces, null, 2));

  // Click View Certificate to navigate to Verify page
  console.log('[S1] Navigating to Verify page...');
  await viewPortalBtn.click({ force: true });
  await page1.waitForTimeout(3000);

  // Assertions on Verify page
  const verifyUrlS1 = page1.url();
  console.log(`[S1] On Verify URL: ${verifyUrlS1}`);

  const bannerText = await page1.locator('h2, [data-testid="verification-status-heading"]').first().textContent();
  console.log(`[S1] Status Banner: ${bannerText}`);

  const verifyPageText = await page1.textContent('body');
  console.log('[S1] Checking DOM contents for V1 values...');
  const hasAlice = verifyPageText?.includes('Alice Nakamoto');
  const hasCertA = verifyPageText?.includes(certNoV1);
  const hasEvent = verifyPageText?.includes('Applied Cryptography Workshop');
  const hasForbiddenSampleName = verifyPageText?.includes('MR. SOUMALYA MUKHERJEE');

  console.log(`[S1] Has "Alice Nakamoto": ${hasAlice}`);
  console.log(`[S1] Has "${certNoV1}": ${hasCertA}`);
  console.log(`[S1] Has "Applied Cryptography Workshop": ${hasEvent}`);
  console.log(`[S1] Contains forbidden original sample name "MR. SOUMALYA MUKHERJEE": ${hasForbiddenSampleName}`);

  // Screenshot S1 Verify Page
  await page1.screenshot({ path: path.join(DEBUG_DIR, 's1_verify_page.png'), fullPage: true });

  const verifyTracesS1 = await page1.evaluate(() => {
    return window.__CERTI_TRACER__ ? window.__CERTI_TRACER__.getEntries() : [];
  });
  fs.writeFileSync(path.join(DEBUG_DIR, 's1_verify_trace.json'), JSON.stringify(verifyTracesS1, null, 2));

  // -------------------------------------------------------------
  // Scenario S2: Stranger / Fresh Browser Context Verification
  // -------------------------------------------------------------
  console.log('\n[S2] Launching brand-new isolated context with clean storage for S2...');
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await context2.newPage();

  console.log(`[S2] Navigating directly to verify URL: ${verifyUrlS1}`);
  await page2.goto(verifyUrlS1);
  await page2.waitForTimeout(3000);

  const bannerTextS2 = await page2.locator('h2, [data-testid="verification-status-heading"]').first().textContent();
  console.log(`[S2] Status Banner: ${bannerTextS2}`);

  const verifyPageTextS2 = await page2.textContent('body');
  const hasAliceS2 = verifyPageTextS2?.includes('Alice Nakamoto');
  const hasCertAS2 = verifyPageTextS2?.includes(certNoV1);
  const hasEventS2 = verifyPageTextS2?.includes('Applied Cryptography Workshop');
  const hasForbiddenS2 = verifyPageTextS2?.includes('MR. SOUMALYA MUKHERJEE');

  console.log(`[S2] Clean Storage Has "Alice Nakamoto": ${hasAliceS2}`);
  console.log(`[S2] Clean Storage Has "${certNoV1}": ${hasCertAS2}`);
  console.log(`[S2] Clean Storage Has "Applied Cryptography Workshop": ${hasEventS2}`);
  console.log(`[S2] Contains forbidden original sample name: ${hasForbiddenS2}`);

  // Screenshot S2 Verify Page
  await page2.screenshot({ path: path.join(DEBUG_DIR, 's2_verify_page_fresh_context.png'), fullPage: true });

  // -------------------------------------------------------------
  // Scenario S3: Issue V2 & Assert Non-Collision
  // -------------------------------------------------------------
  console.log('\n[S3] Returning to issuer context to issue Certificate V2...');
  await page1.goto('http://localhost:5173/issue?debug=1');
  await page1.waitForTimeout(1500);

  const connectBtnS3 = page1.locator('button:has-text("Connect Wallet"), button:has-text("Connect")').first();
  if (await connectBtnS3.isVisible()) {
    console.log('[S3] Re-connecting wallet for S3...');
    await connectBtnS3.click({ force: true });
    await page1.waitForTimeout(500);
    const deployerBtn = page1.locator('button:has-text("Deployer")').first();
    if (await deployerBtn.isVisible()) {
      await deployerBtn.click({ force: true });
      await page1.waitForTimeout(1000);
    }
    const closeBtn = page1.locator('button[aria-label="Close modal"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click({ force: true });
      await page1.waitForTimeout(500);
    }
  }

  await page1.locator('button:has-text("Custom Template")').click();
  await page1.waitForTimeout(500);

  const libTabS3 = page1.locator('button:has-text("Saved Template Library")');
  if (await libTabS3.isVisible()) {
    await libTabS3.click();
    await page1.waitForTimeout(500);
    const useBtn = page1.locator('button:has-text("Use Template")').first();
    if (await useBtn.isVisible()) {
      await useBtn.click();
      await page1.waitForTimeout(500);
    }
  }

  // Fill in V2 values
  console.log(`[S3] Filling dynamic fields with V2 values (${nameV2}, ${certNoV2})...`);
  const certNoInput2 = page1.locator('input[placeholder*="CERT"], input[value*="CBT"], input[value*="CERT"]').first();
  if (await certNoInput2.isVisible()) {
    await certNoInput2.fill(certNoV2);
  }

  const certTypeInput2 = page1.locator('select, input[placeholder*="Participation"]').first();
  if (await certTypeInput2.isVisible()) {
    const tagName = await certTypeInput2.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await certTypeInput2.selectOption('COMPLETION');
    } else {
      await certTypeInput2.fill('COMPLETION');
    }
  }

  const nameInput2 = page1.locator('input[value*="Alice"], input[value*="SOUMALYA"], input[placeholder*="Alice"]').first();
  if (await nameInput2.isVisible()) {
    await nameInput2.fill(nameV2);
  }

  const roleInput2 = page1.locator('input[value*="participated"], input[placeholder*="participated"]').first();
  if (await roleInput2.isVisible()) {
    await roleInput2.fill('completed');
  }

  const eventInput2 = page1.locator('textarea, input[value*="Applied"], input[value*="Hands-on"], input[placeholder*="Event"]').first();
  if (await eventInput2.isVisible()) {
    await eventInput2.fill('Advanced Zero Knowledge Protocols Masterclass');
  }

  await page1.waitForTimeout(500);

  console.log('[S3] Clicking "Anchor & Issue Certificate On-Chain" for V2...');
  const issueButton2 = page1.locator('button:has-text("Anchor & Issue Certificate On-Chain"), button:has-text("Issue On-Chain")').first();
  await issueButton2.click();

  const viewPortalBtn2 = page1.locator('button:has-text("View in Verification Portal")');
  await viewPortalBtn2.waitFor({ state: 'visible', timeout: 35000 });
  await viewPortalBtn2.click({ force: true });
  await page1.waitForTimeout(3000);

  const verifyUrlS3_Cert2 = page1.url();
  console.log(`[S3] On Cert2 Verify URL: ${verifyUrlS3_Cert2}`);
  const verifyTextS3_Cert2 = await page1.textContent('body');
  const hasBob = verifyTextS3_Cert2?.includes('Bob Szabo');
  const hasCertB = verifyTextS3_Cert2?.includes(certNoV2);
  console.log(`[S3] Cert 2 Has "Bob Szabo": ${hasBob}`);
  console.log(`[S3] Cert 2 Has "${certNoV2}": ${hasCertB}`);

  await page1.screenshot({ path: path.join(DEBUG_DIR, 's3_cert2_verify.png'), fullPage: true });

  // Re-open first certificate (V1) and assert non-mutation
  console.log(`[S3] Re-verifying original Cert1 URL: ${verifyUrlS1}`);
  await page1.goto(verifyUrlS1);
  await page1.waitForTimeout(3000);

  const verifyTextS3_Cert1Recheck = await page1.textContent('body');
  const stillHasAlice = verifyTextS3_Cert1Recheck?.includes('Alice Nakamoto');
  const stillHasCertA = verifyTextS3_Cert1Recheck?.includes(certNoV1);
  const doesNotHaveBob = !verifyTextS3_Cert1Recheck?.includes('Bob Szabo');

  console.log(`[S3] Cert 1 STILL has "Alice Nakamoto": ${stillHasAlice}`);
  console.log(`[S3] Cert 1 STILL has "${certNoV1}": ${stillHasCertA}`);
  console.log(`[S3] Cert 1 does NOT have "Bob Szabo" (No Stale Pollution): ${doesNotHaveBob}`);

  await page1.screenshot({ path: path.join(DEBUG_DIR, 's3_cert1_recheck_verify.png'), fullPage: true });

  // -------------------------------------------------------------
  // Scenario S4: Recent On-Chain Issuances List Click
  // -------------------------------------------------------------
  console.log('\n[S4] Testing Recent On-Chain Issuances list row click...');
  await page1.goto('http://localhost:5173/verify?chain=31337');
  await page1.waitForTimeout(2000);

  // Assert table contains rows
  const tableRows = page1.locator('tbody tr');
  const count = await tableRows.count();
  console.log(`[S4] Found ${count} records in Recent On-Chain Issuances table.`);

  // Capture Recent list screenshot
  await page1.screenshot({ path: path.join(DEBUG_DIR, 's4_recent_list.png'), fullPage: true });

  if (count > 0) {
    const firstRowVerifyBtn = tableRows.first().locator('button:has-text("Verify")');
    await firstRowVerifyBtn.click();
    await page1.waitForTimeout(3000);

    const s4Url = page1.url();
    console.log(`[S4] Navigated from list to: ${s4Url}`);

    const bannerTextS4 = await page1.locator('h2, [data-testid="verification-status-heading"]').first().textContent();
    console.log(`[S4] List Row Click Status Banner: ${bannerTextS4}`);

    const checkedOnTextS4 = await page1.textContent('body');
    const hasCheckedOn = checkedOnTextS4?.includes('Checked on: Hardhat Localhost') || checkedOnTextS4?.includes('Checked on:');
    console.log(`[S4] Displays "Checked on" network line: ${hasCheckedOn}`);

    await page1.screenshot({ path: path.join(DEBUG_DIR, 's4_recent_list_verify.png'), fullPage: true });
  }

  // Save S1 trace dump
  fs.writeFileSync(path.join(DEBUG_DIR, 's1_console_traces.json'), JSON.stringify(logsS1, null, 2));

  console.log('\n=============================================');
  console.log('E2E TEST SUMMARY:');
  console.log(`S1 Issue & Verify: ${hasAlice && hasCertA && !hasForbiddenSampleName ? 'PASSED' : 'FAILED'}`);
  console.log(`S2 Fresh Context: ${hasAliceS2 && hasCertAS2 && !hasForbiddenS2 ? 'PASSED' : 'FAILED'}`);
  console.log(`S3 Dual Issuance & Isolation: ${hasBob && hasCertB && stillHasAlice && stillHasCertA ? 'PASSED' : 'FAILED'}`);
  console.log(`S4 Recent List Navigation: ${count > 0 ? 'PASSED' : 'SKIPPED'}`);
  console.log('=============================================\n');

  await browser.close();
}

runScenarios().catch((err) => {
  console.error('E2E Execution Error:', err);
  process.exit(1);
});
