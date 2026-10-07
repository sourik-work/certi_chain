import { test, expect } from '@playwright/test';
import path from 'path';

const DEBUG_DIR = path.resolve(process.cwd(), 'debug-output');

test.describe('End-to-End Custom Template Credential Lifecycle', () => {
  test('S1, S2, and S3: Issue V1, Verify in Clean Context, and Issue V2 without Stale Pollution', async ({ browser }) => {
    // -------------------------------------------------------------
    // Scenario S1: Issue V1 & Verify
    // -------------------------------------------------------------
    const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1 = await context1.newPage();

    await page1.goto('http://localhost:5173/issue?debug=1');
    await page1.waitForLoadState('networkidle');

    // Connect Wallet if needed
    const connectBtn = page1.locator('button:has-text("Connect")').first();
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await page1.waitForTimeout(500);
      const deployerBtn = page1.locator('text=Deployer & Authorized Issuer, text=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266').first();
      if (await deployerBtn.isVisible()) {
        await deployerBtn.click();
        await page1.waitForSelector('text=Connect to CertiChain', { state: 'detached', timeout: 5000 }).catch(() => {});
        await page1.waitForTimeout(1000);
      }
    }

    // Switch to Custom Template
    await page1.locator('button:has-text("Custom Template")').click();
    await page1.waitForTimeout(500);

    const libraryTab = page1.locator('button:has-text("Saved Template Library")');
    if (await libraryTab.isVisible()) {
      await libraryTab.click();
      await page1.waitForTimeout(500);
    }

    const useTemplateBtn = page1.locator('button:has-text("Use Template")').first();
    if (await useTemplateBtn.isVisible()) {
      await useTemplateBtn.click();
      await page1.waitForTimeout(500);
    }

    // Fill V1 Values
    const certNoInput = page1.locator('input[placeholder*="CERT"], input[value*="CBT"]').first();
    if (await certNoInput.isVisible()) {
      await certNoInput.fill('CERT-A-1001');
    }

    const certTypeInput = page1.locator('input[placeholder*="Participation"], input[value*="PARTICIPATION"]').first();
    if (await certTypeInput.isVisible()) {
      await certTypeInput.fill('COMPLETION');
    }

    const nameInput = page1.locator('input[value*="SOUMALYA"], input[placeholder*="Alice"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Alice Nakamoto');
    }

    const roleInput = page1.locator('input[value*="participated"], input[placeholder*="participated"]').first();
    if (await roleInput.isVisible()) {
      await roleInput.fill('participated');
    }

    const eventInput = page1.locator('input[value*="Hands-on"], input[placeholder*="Event"], input[placeholder*="Course"]').first();
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

    // Live Preview Assertions
    const previewText = await page1.locator('#template-certificate-preview-node').textContent();
    expect(previewText).toContain('Alice Nakamoto');
    expect(previewText).toContain('CERT-A-1001');
    expect(previewText).toContain('COMPLETION');

    // Issue on-chain
    const issueButton = page1.locator('button:has-text("Anchor & Issue Certificate On-Chain")');
    await issueButton.click();

    await page1.waitForSelector('text=Credential Issued!, text=Confirmed on Blockchain, button:has-text("View Certificate")', {
      timeout: 30000,
    });

    const viewCertBtn = page1.locator('button:has-text("View Certificate")').first();
    await viewCertBtn.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(2000);

    const verifyUrlS1 = page1.url();
    const verifyPageText = await page1.textContent('body');

    expect(verifyPageText).toContain('Alice Nakamoto');
    expect(verifyPageText).toContain('CERT-A-1001');
    expect(verifyPageText).toContain('Applied Cryptography Workshop');
    expect(verifyPageText).not.toContain('MR. SOUMALYA MUKHERJEE');

    // -------------------------------------------------------------
    // Scenario S2: Fresh Browser Context Verification
    // -------------------------------------------------------------
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();

    await page2.goto(verifyUrlS1);
    await page2.waitForLoadState('networkidle');
    await page2.waitForTimeout(3000);

    const verifyPageTextS2 = await page2.textContent('body');
    expect(verifyPageTextS2).toContain('Alice Nakamoto');
    expect(verifyPageTextS2).toContain('CERT-A-1001');
    expect(verifyPageTextS2).not.toContain('MR. SOUMALYA MUKHERJEE');

    // -------------------------------------------------------------
    // Scenario S3: Issue V2 and check isolation
    // -------------------------------------------------------------
    await page1.goto('http://localhost:5173/issue?debug=1');
    await page1.waitForLoadState('networkidle');
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

    const certNoInput2 = page1.locator('input[placeholder*="CERT"], input[value*="CBT"], input[value*="CERT"]').first();
    if (await certNoInput2.isVisible()) {
      await certNoInput2.fill('CERT-B-2002');
    }

    const nameInput2 = page1.locator('input[value*="Alice"], input[value*="SOUMALYA"], input[placeholder*="Alice"]').first();
    if (await nameInput2.isVisible()) {
      await nameInput2.fill('Bob Szabo');
    }

    await page1.waitForTimeout(500);

    const issueButton2 = page1.locator('button:has-text("Anchor & Issue Certificate On-Chain")');
    await issueButton2.click();

    await page1.waitForSelector('text=Credential Issued!, text=Confirmed on Blockchain, button:has-text("View Certificate")', {
      timeout: 30000,
    });

    const viewCertBtn2 = page1.locator('button:has-text("View Certificate")').first();
    await viewCertBtn2.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(2000);

    const verifyTextS3_Cert2 = await page1.textContent('body');
    expect(verifyTextS3_Cert2).toContain('Bob Szabo');
    expect(verifyTextS3_Cert2).toContain('CERT-B-2002');

    // Re-verify cert 1
    await page1.goto(verifyUrlS1);
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(2000);

    const verifyTextS3_Cert1Recheck = await page1.textContent('body');
    expect(verifyTextS3_Cert1Recheck).toContain('Alice Nakamoto');
    expect(verifyTextS3_Cert1Recheck).toContain('CERT-A-1001');
    expect(verifyTextS3_Cert1Recheck).not.toContain('Bob Szabo');
  });
});
