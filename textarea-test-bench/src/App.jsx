import React, { useState, useEffect, useRef } from 'react';
import ControlledTextarea from './solutions/ControlledTextarea';
import ContentEditableEditor from './solutions/ContentEditableEditor';
import HybridEditor from './solutions/HybridEditor';
import OptimizedLargeText from './solutions/OptimizedLargeText';
import FixedCursorTextarea from './solutions/FixedCursorTextarea';
import FinalTextareaSolution from './solutions/FinalTextareaSolution';
import PerformanceMonitor from './components/PerformanceMonitor';
import { generateTestText } from './utils/testData';

const SOLUTIONS = {
  controlled: {
    name: 'Controlled Textarea с фиксом скролла',
    description: 'useLayoutEffect + сохранение scrollTop и позиции курсора',
    component: ControlledTextarea
  },
  fixedcursor: {
    name: 'Фикс позиции курсора 0 при первом клике',
    description: 'Решение проблемы сброса курсора на позицию 0 при первом взаимодействии',
    component: FixedCursorTextarea
  },
  contenteditable: {
    name: 'ContentEditable решение',
    description: 'div с contentEditable="true" и управлением состояния',
    component: ContentEditableEditor
  },
  hybrid: {
    name: 'Hybrid View/Edit режим',
    description: 'Переключение между режимом просмотра и редактирования',
    component: HybridEditor
  },
  optimized: {
    name: 'Оптимизированный для больших текстов',
    description: 'С debounce и requestAnimationFrame для 5000+ символов',
    component: OptimizedLargeText
  },
  final: {
    name: '🎯 ФИНАЛЬНОЕ РЕШЕНИЕ (рекомендуется)',
    description: 'Все фиксы: скролл, курсор 0, Enter, большие тексты. Готово для production',
    component: FinalTextareaSolution
  }
};

function App() {
  const [selectedSolution, setSelectedSolution] = useState('final');
  const [text, setText] = useState(generateTestText(5000));
  const [metrics, setMetrics] = useState({
    fps: 60,
    inputLag: 0,
    memoryUsage: 0,
    scrollStability: 100,
    renderTime: 0
  });
  
  const startTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  // FPS мониторинг
  useEffect(() => {
    let animationId;
    
    const calculateFPS = () => {
      frameCountRef.current++;
      const now = Date.now();
      const delta = now - lastFrameTimeRef.current;
      
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        setMetrics(prev => ({ ...prev, fps: Math.min(fps, 60) }));
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
      
      animationId = requestAnimationFrame(calculateFPS);
    };
    
    animationId = requestAnimationFrame(calculateFPS);
    
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Memory usage мониторинг
  useEffect(() => {
    const checkMemory = () => {
      if (performance.memory) {
        const usedMemory = Math.round(performance.memory.usedJSHeapSize / 1048576);
        setMetrics(prev => ({ ...prev, memoryUsage: usedMemory }));
      }
    };
    
    const interval = setInterval(checkMemory, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTextChange = (newText) => {
    const startTime = performance.now();
    setText(newText);
    const endTime = performance.now();
    const lag = Math.round(endTime - startTime);
    setMetrics(prev => ({ ...prev, inputLag: lag }));
  };

  const loadTestText = (size) => {
    const startTime = performance.now();
    const newText = generateTestText(size);
    setText(newText);
    const endTime = performance.now();
    setMetrics(prev => ({ 
      ...prev, 
      renderTime: Math.round(endTime - startTime) 
    }));
  };

  const CurrentSolution = SOLUTIONS[selectedSolution].component;

  return (
    <div className="container">
      <div className="header">
        <h1>🧪 Textarea Scroll Test Bench</h1>
        <p style={{ marginTop: '10px', color: '#888' }}>
          Тестирование решений для проблемы скролла в textarea с большими текстами
        </p>
      </div>

      <div className="control-panel">
        <div>
          <label style={{ marginRight: '10px', fontSize: '14px' }}>Решение:</label>
          <select 
            value={selectedSolution} 
            onChange={(e) => setSelectedSolution(e.target.value)}
            style={{
              background: '#0a0a0a',
              color: '#e0e0e0',
              border: '1px solid #333',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            {Object.entries(SOLUTIONS).map(([key, solution]) => (
              <option key={key} value={key}>{solution.name}</option>
            ))}
          </select>
        </div>

        <div className="button-group">
          <button onClick={() => loadTestText(1000)}>1K символов</button>
          <button onClick={() => loadTestText(3000)}>3K символов</button>
          <button onClick={() => loadTestText(5000)}>5K символов</button>
          <button onClick={() => loadTestText(10000)}>10K символов</button>
          <button className="secondary" onClick={() => setText('')}>Очистить</button>
        </div>
      </div>

      <PerformanceMonitor metrics={metrics} />

      <div className="editor-container">
        <div className="solution-title">{SOLUTIONS[selectedSolution].name}</div>
        <div className="solution-description">{SOLUTIONS[selectedSolution].description}</div>
        
        <CurrentSolution 
          value={text} 
          onChange={handleTextChange}
        />

        <div className="info-panel">
          <div>Символов: {text.length}</div>
          <div>Строк: {text.split('\n').length}</div>
          <div>Слов: {text.split(/\s+/).filter(w => w).length}</div>
        </div>
      </div>
    </div>
  );
}

export default App;