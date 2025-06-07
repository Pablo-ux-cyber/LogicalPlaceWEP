import { useEffect, useRef, useState } from 'react';
import { CandleData, VolumeData, IndicatorValue } from '@/types/chart';
import { formatPrice } from '@/lib/utils';

interface BitcoinChartProps {
  candleData: CandleData[];
  volumeData: VolumeData[];
  indicatorData?: IndicatorValue[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

interface ViewState {
  startIndex: number;
  endIndex: number;
  scale: number;
}

const BitcoinChart = ({ candleData, volumeData, indicatorData = [], isLoading, error, onRetry }: BitcoinChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for zooming and panning
  const [viewState, setViewState] = useState<ViewState>({
    startIndex: 0,
    endIndex: 0,
    scale: 1
  });
  
  // Toggles for indicators
  const [showBBDaily, setShowBBDaily] = useState(true);
  const [showBBWeekly, setShowBBWeekly] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  
  // Function to navigate to signals
  const goToSignals = () => {
    if (!indicatorData.length) {
      console.log('No indicator data available');
      return;
    }
    
    const signalIndexes = indicatorData
      .map((indicator, index) => indicator.entrySignal ? index : -1)
      .filter(index => index !== -1);
    
    console.log(`Found ${signalIndexes.length} signals in data:`, signalIndexes);
    
    if (signalIndexes.length > 0) {
      // Go to the first signal
      const signalIndex = signalIndexes[0];
      const range = 50; // Show 50 candles around the signal
      
      console.log(`Navigating to signal at index ${signalIndex}`);
      
      setViewState({
        startIndex: Math.max(0, signalIndex - range / 2),
        endIndex: Math.min(candleData.length - 1, signalIndex + range / 2),
        scale: 1
      });
    } else {
      console.log('No signals found in indicator data');
    }
  };

  // Function to navigate to March 2025 signal specifically
  const goToMarch2025Signal = () => {
    if (!indicatorData.length) return;
    
    // Find the March 2025 signal (timestamp 1743379200)
    const march2025Index = indicatorData.findIndex(indicator => 
      indicator.time === 1743379200 && indicator.entrySignal
    );
    
    if (march2025Index !== -1) {
      console.log(`Navigating to March 2025 signal at index ${march2025Index}`);
      const range = 50;
      
      setViewState({
        startIndex: Math.max(0, march2025Index - range / 2),
        endIndex: Math.min(candleData.length - 1, march2025Index + range / 2),
        scale: 1
      });
    } else {
      console.log('March 2025 signal not found');
    }
  };

  // Initialize view state when data changes
  useEffect(() => {
    if (candleData.length > 0) {
      const initialRange = Math.min(200, candleData.length);
      setViewState({
        startIndex: Math.max(0, candleData.length - initialRange),
        endIndex: candleData.length - 1,
        scale: 1
      });
    }
  }, [candleData.length]);

  // Draw chart
  useEffect(() => {
    if (isLoading || error || !candleData.length || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * pixelRatio;
    canvas.height = canvas.clientHeight * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);
    
    // Background
    ctx.fillStyle = '#151924';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // Calculate chart area
    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = canvas.clientWidth - margin.left - margin.right;
    const chartHeight = canvas.clientHeight - margin.top - margin.bottom;
    
    // Get visible data
    const visibleData = candleData.slice(viewState.startIndex, viewState.endIndex + 1);
    const visibleIndicators = indicatorData.slice(viewState.startIndex, viewState.endIndex + 1);
    
    if (visibleData.length === 0) return;
    
    // Find min/max values
    const maxPrice = Math.max(...visibleData.map(c => c.high));
    const minPrice = Math.min(...visibleData.map(c => c.low));
    const pricePadding = (maxPrice - minPrice) * 0.1;
    
    // Scale functions
    const xScale = (i: number) => margin.left + (i / Math.max(1, visibleData.length - 1)) * chartWidth;
    const yScale = (price: number) => margin.top + chartHeight - ((price - minPrice + pricePadding) / ((maxPrice - minPrice) + pricePadding * 2)) * chartHeight;
    
    // Draw grid
    ctx.strokeStyle = '#232632';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
      
      // Price labels
      const price = maxPrice - (i / 5) * (maxPrice - minPrice);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPrice(price), canvas.clientWidth - 5, y + 4);
    }
    
    // Draw Bollinger Bands if indicators are available
    if (visibleIndicators.length > 0) {
      // Daily BB
      if (showBBDaily) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 102, 255, 0.8)';
        ctx.lineWidth = 2;
        
        visibleIndicators.forEach((indicator, i) => {
          const x = xScale(i);
          const y = yScale(indicator.bbLowerDaily);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
      }
      
      // Weekly BB
      if (showBBWeekly) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        
        visibleIndicators.forEach((indicator, i) => {
          const x = xScale(i);
          const y = yScale(indicator.bbLowerWeekly);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.fillText('BB Weekly', canvas.clientWidth - 70, 25);
      }
    }
    
    // Calculate candle width
    const candleWidth = Math.min((chartWidth / visibleData.length) * 0.8, 15);
    
    // Draw candles
    visibleData.forEach((candle, i) => {
      const x = xScale(i);
      const openY = yScale(candle.open);
      const closeY = yScale(candle.close);
      const highY = yScale(candle.high);
      const lowY = yScale(candle.low);
      
      // Determine candle color
      const isUp = candle.close >= candle.open;
      ctx.strokeStyle = isUp ? '#26a69a' : '#ef5350';
      ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
      
      // Draw wick
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw candle body
      const candleHeight = Math.abs(closeY - openY);
      const y = Math.min(openY, closeY);
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, Math.max(candleHeight, 1));
      
      // Draw buy signals
      if (showSignals && i < visibleIndicators.length) {
        const indicator = visibleIndicators[i];
        if (indicator && indicator.entrySignal) {
          console.log(`Drawing signal at index ${i}, time: ${indicator.time}`);
          const signalY = lowY + 30;
          
          // Large bright background circle
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.beginPath();
          ctx.arc(x, signalY, 15, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw large bright signal cross
          ctx.strokeStyle = 'rgb(255, 255, 0)';
          ctx.lineWidth = 4;
          
          const crossSize = 12;
          
          // Horizontal line
          ctx.beginPath();
          ctx.moveTo(x - crossSize, signalY);
          ctx.lineTo(x + crossSize, signalY);
          ctx.stroke();
          
          // Vertical line
          ctx.beginPath();
          ctx.moveTo(x, signalY - crossSize);
          ctx.lineTo(x, signalY + crossSize);
          ctx.stroke();
          
          ctx.lineWidth = 1;
        }
      }
    });
    
  }, [candleData, indicatorData, viewState, showBBDaily, showBBWeekly, showSignals, isLoading, error]);

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 1.25 : 0.8;
    const currentRange = viewState.endIndex - viewState.startIndex + 1;
    const newRange = Math.round(currentRange * zoomFactor);
    const maxRange = candleData.length;
    const minRange = 10;
    
    const clampedRange = Math.max(minRange, Math.min(maxRange, newRange));
    
    // Keep the same center point
    const center = (viewState.startIndex + viewState.endIndex) / 2;
    const halfRange = clampedRange / 2;
    
    let newStart = Math.round(center - halfRange);
    let newEnd = Math.round(center + halfRange - 1);
    
    // Adjust if out of bounds
    if (newStart < 0) {
      newStart = 0;
      newEnd = clampedRange - 1;
    } else if (newEnd >= candleData.length) {
      newEnd = candleData.length - 1;
      newStart = Math.max(0, newEnd - clampedRange + 1);
    }
    
    setViewState({
      startIndex: newStart,
      endIndex: newEnd,
      scale: viewState.scale * (1 / zoomFactor)
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chart-bg">
        <div className="text-chart-text">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chart-bg text-chart-text">
        <div className="mb-4">Error loading chart data: {error.message}</div>
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-chart-bg">
      {/* Chart Controls */}
      <div className="absolute top-2 left-2 z-10 bg-black/50 rounded p-2 text-xs text-white">
        <label className="flex items-center mb-1">
          <input
            type="checkbox"
            checked={showBBDaily}
            onChange={(e) => setShowBBDaily(e.target.checked)}
            className="mr-1"
          />
          Daily BB
        </label>
        <label className="flex items-center mb-1">
          <input
            type="checkbox"
            checked={showBBWeekly}
            onChange={(e) => setShowBBWeekly(e.target.checked)}
            className="mr-1"
          />
          Weekly BB
        </label>
        <label className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={showSignals}
            onChange={(e) => setShowSignals(e.target.checked)}
            className="mr-1"
          />
          Buy Signals
        </label>
        <button
          onClick={goToSignals}
          className="w-full px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded mb-1"
        >
          Find Signals ({indicatorData.filter(ind => ind.entrySignal).length})
        </button>
        <button
          onClick={goToMarch2025Signal}
          className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
        >
          March 31, 2025
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default BitcoinChart;