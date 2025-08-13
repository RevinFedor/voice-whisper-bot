import React from 'react';

const PerformanceMonitor = ({ metrics }) => {
  const getFPSColor = (fps) => {
    if (fps >= 50) return '#10b981';
    if (fps >= 30) return '#f59e0b';
    return '#ef4444';
  };

  const getLagColor = (lag) => {
    if (lag <= 16) return '#10b981';
    if (lag <= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-label">FPS</div>
        <div className="metric-value" style={{ color: getFPSColor(metrics.fps) }}>
          {metrics.fps}
        </div>
      </div>
      
      <div className="metric">
        <div className="metric-label">Input Lag (ms)</div>
        <div className="metric-value" style={{ color: getLagColor(metrics.inputLag) }}>
          {metrics.inputLag}
        </div>
      </div>
      
      <div className="metric">
        <div className="metric-label">Memory (MB)</div>
        <div className="metric-value">
          {metrics.memoryUsage}
        </div>
      </div>
      
      <div className="metric">
        <div className="metric-label">Scroll Stability</div>
        <div className="metric-value">
          {metrics.scrollStability}%
        </div>
      </div>
      
      <div className="metric">
        <div className="metric-label">Render Time (ms)</div>
        <div className="metric-value">
          {metrics.renderTime}
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;