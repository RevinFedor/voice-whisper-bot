import fs from 'fs';
import path from 'path';

// Утилита для генерации HTML отчета со скриншотами
export function generateScreenshotReport() {
  const screenshotsDir = path.join('tests', 'screenshots');
  
  if (!fs.existsSync(screenshotsDir)) {
    console.log('No screenshots directory found');
    return;
  }
  
  // Получаем все скриншоты
  const screenshots = fs.readdirSync(screenshotsDir)
    .filter(file => file.endsWith('.png'))
    .map(file => {
      const filePath = path.join(screenshotsDir, file);
      const stats = fs.statSync(filePath);
      
      // Пытаемся загрузить метаданные
      const metadataPath = filePath.replace('.png', '.json');
      let metadata = {};
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      }
      
      return {
        name: file,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        metadata
      };
    })
    .sort((a, b) => b.created - a.created);
  
  // Генерируем HTML отчет
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screenshot Report - ${new Date().toLocaleString('ru-RU')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
    }
    
    .header {
      background: linear-gradient(135deg, #2a4 0%, #4a9eff 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    
    h1 {
      color: white;
      font-size: 32px;
      margin-bottom: 10px;
    }
    
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 20px;
    }
    
    .stat {
      background: rgba(255,255,255,0.1);
      padding: 10px 20px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }
    
    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: white;
    }
    
    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    
    .screenshot-card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .screenshot-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(74, 158, 255, 0.3);
      border-color: #4a9eff;
    }
    
    .screenshot-image {
      width: 100%;
      height: 250px;
      object-fit: cover;
      border-bottom: 1px solid #333;
      cursor: pointer;
    }
    
    .screenshot-info {
      padding: 15px;
    }
    
    .screenshot-name {
      font-size: 14px;
      font-weight: bold;
      color: #4a9eff;
      margin-bottom: 8px;
      word-break: break-all;
    }
    
    .screenshot-meta {
      font-size: 12px;
      color: #888;
      line-height: 1.6;
    }
    
    .metadata {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #333;
    }
    
    .metadata-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 11px;
    }
    
    .metadata-label {
      color: #666;
    }
    
    .metadata-value {
      color: #4a9eff;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      padding: 20px;
      cursor: pointer;
    }
    
    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-image {
      max-width: 95%;
      max-height: 95%;
      object-fit: contain;
      border: 2px solid #4a9eff;
      border-radius: 8px;
    }
    
    .baseline-badge {
      display: inline-block;
      background: #2a4;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      margin-left: 10px;
    }
    
    .no-screenshots {
      text-align: center;
      padding: 100px 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Screenshot Test Report</h1>
    <div>Generated: ${new Date().toLocaleString('ru-RU')}</div>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Screenshots</div>
        <div class="stat-value">${screenshots.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Size</div>
        <div class="stat-value">${(screenshots.reduce((sum, s) => sum + s.size, 0) / 1024 / 1024).toFixed(2)} MB</div>
      </div>
      <div class="stat">
        <div class="stat-label">Latest</div>
        <div class="stat-value">${screenshots[0]?.created.toLocaleTimeString('ru-RU') || 'N/A'}</div>
      </div>
    </div>
  </div>
  
  ${screenshots.length === 0 ? `
    <div class="no-screenshots">
      <h2>No screenshots found</h2>
      <p>Run the tests to generate screenshots</p>
    </div>
  ` : `
    <div class="screenshots-grid">
      ${screenshots.map(screenshot => `
        <div class="screenshot-card">
          <img 
            src="../../${screenshot.path}" 
            alt="${screenshot.name}"
            class="screenshot-image"
            onclick="openModal('../../${screenshot.path}')"
          />
          <div class="screenshot-info">
            <div class="screenshot-name">
              ${screenshot.name}
              ${screenshot.name.includes('baseline') ? '<span class="baseline-badge">Baseline</span>' : ''}
            </div>
            <div class="screenshot-meta">
              <div>Size: ${(screenshot.size / 1024).toFixed(2)} KB</div>
              <div>Created: ${screenshot.created.toLocaleString('ru-RU')}</div>
            </div>
            ${screenshot.metadata && Object.keys(screenshot.metadata).length > 0 ? `
              <div class="metadata">
                ${screenshot.metadata.testName ? `
                  <div class="metadata-item">
                    <span class="metadata-label">Test:</span>
                    <span class="metadata-value">${screenshot.metadata.testName}</span>
                  </div>
                ` : ''}
                ${screenshot.metadata.viewport ? `
                  <div class="metadata-item">
                    <span class="metadata-label">Viewport:</span>
                    <span class="metadata-value">${screenshot.metadata.viewport.width}x${screenshot.metadata.viewport.height}</span>
                  </div>
                ` : ''}
                ${screenshot.metadata.textShapesCount !== undefined ? `
                  <div class="metadata-item">
                    <span class="metadata-label">Text Shapes:</span>
                    <span class="metadata-value">${screenshot.metadata.textShapesCount}</span>
                  </div>
                ` : ''}
                ${screenshot.metadata.totalNotes !== undefined ? `
                  <div class="metadata-item">
                    <span class="metadata-label">Total Notes:</span>
                    <span class="metadata-value">${screenshot.metadata.totalNotes}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `}
  
  <div class="modal" id="modal" onclick="closeModal()">
    <img id="modalImage" class="modal-image" />
  </div>
  
  <script>
    function openModal(src) {
      document.getElementById('modalImage').src = src;
      document.getElementById('modal').classList.add('active');
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  </script>
</body>
</html>
  `;
  
  // Сохраняем HTML отчет
  const reportPath = path.join('tests', 'screenshots', 'report.html');
  fs.writeFileSync(reportPath, html);
  
  console.log(`\n📊 Screenshot report generated: ${reportPath}`);
  console.log(`   Total screenshots: ${screenshots.length}`);
  console.log(`   Open in browser: file://${path.resolve(reportPath)}`);
  
  return reportPath;
}

// Запускаем генерацию отчета если скрипт вызван напрямую
if (process.argv[1] === new URL(import.meta.url).pathname) {
  generateScreenshotReport();
}