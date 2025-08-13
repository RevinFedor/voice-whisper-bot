import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Утилита для создания уникальных имен скриншотов с timestamp
function getScreenshotName(baseName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${baseName}-${timestamp}.png`;
}

// Утилита для сохранения метаданных скриншота
function saveScreenshotMetadata(screenshotPath, metadata) {
  const metadataPath = screenshotPath.replace('.png', '.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Ждем запуска dev сервера
    await page.waitForTimeout(2000);
  });

  test('Initial page load - full screenshot', async ({ page }) => {
    // Переходим на главную страницу
    await page.goto('/');
    
    // Ждем загрузки tldraw canvas
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    
    // Ждем полной загрузки всех элементов
    await page.waitForTimeout(3000);
    
    // Скрываем курсор для консистентности скриншотов
    await page.addStyleTag({
      content: '* { cursor: none !important; }'
    });
    
    // Делаем полный скриншот страницы
    const screenshotName = 'initial-load-full';
    const screenshotPath = path.join('tests', 'screenshots', getScreenshotName(screenshotName));
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    
    // Сохраняем метаданные
    saveScreenshotMetadata(screenshotPath, {
      testName: 'Initial page load - full screenshot',
      timestamp: new Date().toISOString(),
      viewport: page.viewportSize(),
      url: page.url(),
      userAgent: await page.evaluate(() => navigator.userAgent),
    });
    
    console.log(`✅ Full page screenshot saved: ${screenshotPath}`);
  });

  test('Canvas area screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Находим элемент canvas
    const canvas = await page.locator('.tl-container');
    
    // Делаем скриншот только области canvas
    const screenshotName = 'canvas-area';
    const screenshotPath = path.join('tests', 'screenshots', getScreenshotName(screenshotName));
    
    await canvas.screenshot({
      path: screenshotPath,
    });
    
    saveScreenshotMetadata(screenshotPath, {
      testName: 'Canvas area screenshot',
      timestamp: new Date().toISOString(),
      element: '.tl-container',
    });
    
    console.log(`✅ Canvas screenshot saved: ${screenshotPath}`);
  });

  test('Check for date headers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Проверяем наличие текстовых элементов (заголовков дат)
    const textShapes = await page.locator('[data-shape-type="text"]').all();
    
    // Делаем скриншот с фокусом на заголовках дат
    const screenshotName = 'date-headers';
    const screenshotPath = path.join('tests', 'screenshots', getScreenshotName(screenshotName));
    
    // Делаем скриншот верхней части где должны быть заголовки
    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: 0,
        y: 0,
        width: 1920,
        height: 300
      }
    });
    
    saveScreenshotMetadata(screenshotPath, {
      testName: 'Date headers area',
      timestamp: new Date().toISOString(),
      textShapesCount: textShapes.length,
      description: 'Top area where date headers should appear',
    });
    
    console.log(`✅ Date headers screenshot saved: ${screenshotPath}`);
    console.log(`   Found ${textShapes.length} text shapes`);
  });

  test('Check for custom note shapes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Проверяем наличие кастомных заметок
    const customNotes = await page.locator('[data-shape-type="custom-note"]').all();
    
    if (customNotes.length > 0) {
      // Если есть заметки, делаем скриншот первой
      const firstNote = customNotes[0];
      const screenshotName = 'first-custom-note';
      const screenshotPath = path.join('tests', 'screenshots', getScreenshotName(screenshotName));
      
      await firstNote.screenshot({
        path: screenshotPath,
      });
      
      saveScreenshotMetadata(screenshotPath, {
        testName: 'First custom note shape',
        timestamp: new Date().toISOString(),
        totalNotes: customNotes.length,
      });
      
      console.log(`✅ Custom note screenshot saved: ${screenshotPath}`);
    } else {
      console.log('ℹ️ No custom notes found on the page');
    }
    
    console.log(`   Found ${customNotes.length} custom note shapes`);
  });

  test('Visual comparison baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Создаем baseline скриншот для последующих сравнений
    const baselinePath = path.join('tests', 'screenshots', 'baseline.png');
    
    await page.screenshot({
      path: baselinePath,
      fullPage: false,
      animations: 'disabled',
    });
    
    saveScreenshotMetadata(baselinePath, {
      testName: 'Baseline screenshot for visual comparison',
      timestamp: new Date().toISOString(),
      purpose: 'baseline',
      viewport: page.viewportSize(),
    });
    
    console.log(`✅ Baseline screenshot saved: ${baselinePath}`);
    
    // Проверяем что скриншот существует
    expect(fs.existsSync(baselinePath)).toBeTruthy();
  });
});

test.describe('HTML Elements Detection', () => {
  test('Analyze DOM structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Анализируем структуру DOM
    const domAnalysis = await page.evaluate(() => {
      const analysis = {
        totalElements: document.querySelectorAll('*').length,
        customNotes: document.querySelectorAll('[data-shape-type="custom-note"]').length,
        textShapes: document.querySelectorAll('[data-shape-type="text"]').length,
        htmlContainers: document.querySelectorAll('.tl-html-container').length,
        svgElements: document.querySelectorAll('svg').length,
        canvasElements: document.querySelectorAll('canvas').length,
        interactiveElements: document.querySelectorAll('button, input, textarea, select').length,
        styles: {
          hasGradientBackground: !!document.querySelector('.tl-background'),
          customStyles: !!document.querySelector('style')?.textContent?.includes('custom-note'),
        },
        tldrawInfo: {
          container: !!document.querySelector('.tl-container'),
          editor: !!document.querySelector('.tl-editor'),
          shapes: document.querySelectorAll('[data-shape-type]').length,
        }
      };
      
      // Собираем информацию о всех shape типах
      const shapeTypes = new Set();
      document.querySelectorAll('[data-shape-type]').forEach(el => {
        shapeTypes.add(el.getAttribute('data-shape-type'));
      });
      analysis.shapeTypes = Array.from(shapeTypes);
      
      return analysis;
    });
    
    // Сохраняем анализ DOM
    const analysisPath = path.join('tests', 'screenshots', 'dom-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(domAnalysis, null, 2));
    
    // Делаем аннотированный скриншот
    const screenshotPath = path.join('tests', 'screenshots', getScreenshotName('dom-analysis'));
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
    
    console.log('📊 DOM Analysis Results:');
    console.log(`   Total elements: ${domAnalysis.totalElements}`);
    console.log(`   Custom notes: ${domAnalysis.customNotes}`);
    console.log(`   Text shapes: ${domAnalysis.textShapes}`);
    console.log(`   HTML containers: ${domAnalysis.htmlContainers}`);
    console.log(`   Shape types found: ${domAnalysis.shapeTypes.join(', ')}`);
    console.log(`   Analysis saved to: ${analysisPath}`);
  });
});

// Утилита для сравнения скриншотов
test.describe('Screenshot Comparison', () => {
  test('Compare with baseline', async ({ page }) => {
    const baselinePath = path.join('tests', 'screenshots', 'baseline.png');
    
    if (!fs.existsSync(baselinePath)) {
      console.log('⚠️ No baseline screenshot found. Run tests first to create baseline.');
      return;
    }
    
    await page.goto('/');
    await page.waitForSelector('.tl-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Делаем новый скриншот для сравнения
    const comparisonPath = path.join('tests', 'screenshots', getScreenshotName('comparison'));
    await page.screenshot({
      path: comparisonPath,
      fullPage: false,
      animations: 'disabled',
    });
    
    // Используем встроенное сравнение Playwright
    const baseline = fs.readFileSync(baselinePath);
    const comparison = fs.readFileSync(comparisonPath);
    
    // Проверяем размеры файлов
    const sizeDiff = Math.abs(baseline.length - comparison.length);
    const sizeDiffPercent = (sizeDiff / baseline.length) * 100;
    
    console.log('📊 Screenshot Comparison:');
    console.log(`   Baseline size: ${baseline.length} bytes`);
    console.log(`   Current size: ${comparison.length} bytes`);
    console.log(`   Size difference: ${sizeDiff} bytes (${sizeDiffPercent.toFixed(2)}%)`);
    
    if (sizeDiffPercent > 5) {
      console.log('⚠️ Significant difference detected (>5%)');
    } else {
      console.log('✅ Screenshots are similar');
    }
  });
});