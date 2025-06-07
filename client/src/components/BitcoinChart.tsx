import { useEffect, useRef, useState, useMemo } from 'react';
import { CandleData, VolumeData } from '@/types/chart';
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

interface Point {
  x: number;
  y: number;
}

interface SelectionArea {
  start: Point | null;
  end: Point | null;
  active: boolean;
}

interface IndicatorValue {
  time: number;
  bbLowerDaily: number;
  bbLowerWeekly: number;
  entrySignal: boolean;
}

const BitcoinChart = ({ candleData, volumeData, indicatorData, isLoading, error, onRetry }: BitcoinChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
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
  
  // Mouse position tracking for crosshair
  const [mousePosition, setMousePosition] = useState<{x: number, y: number} | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragStartViewState, setDragStartViewState] = useState<ViewState | null>(null);
  
  // Area selection for zooming (как в TradingView)
  const [selectionArea, setSelectionArea] = useState<SelectionArea>({
    start: null,
    end: null,
    active: false
  });
  
  // State for mouse modes (Pan, Selection, Crosshair)
  const [interactionMode, setInteractionMode] = useState<'pan' | 'selection' | 'crosshair'>('crosshair');
  
  // Keyboard state tracking
  const [isShiftKeyDown, setIsShiftKeyDown] = useState(false);
  
  // Calculate Bollinger Bands indicators exactly as in PineScript code (fallback if not provided)
  const calculatedIndicators = useMemo(() => {
    if (!candleData.length) return [];
    
    const length = 20; // BB Length from PineScript
    const mult = 2.0;  // BB Multiplier from PineScript
    const result: IndicatorValue[] = [];
    
    console.log("Calculating indicators for", candleData.length, "candles");
    
    // Calculate SMA 
    const calculateSMA = (values: number[], period: number): number => {
      if (values.length < period) return values.reduce((sum, val) => sum + val, 0) / values.length;
      
      const periodValues = values.slice(values.length - period);
      return periodValues.reduce((sum, val) => sum + val, 0) / period;
    };
    
    // Calculate standard deviation
    const calculateStdDev = (values: number[], period: number, sma: number): number => {
      if (values.length < period) {
        const variance = values.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / values.length;
        return Math.sqrt(variance);
      }
      
      const periodValues = values.slice(values.length - period);
      const variance = periodValues.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
      return Math.sqrt(variance);
    };
    
    // Находим, к какой неделе относится текущая свеча
    // TradingView определяет неделю от понедельника до воскресенья
    const getWeekStart = (date: Date): Date => {
      const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(date);
      monday.setDate(date.getDate() - daysToMonday);
      monday.setHours(0, 0, 0, 0);
      return monday;
    };
    
    // Реализация совместимая с TradingView - формируем недельные свечи так же, как в TradingView
    const getWeeklyCandles = (dailyCandles: CandleData[]): CandleData[] => {
      // TradingView определяет неделю с воскресенья по субботу (в зависимости от настроек)
      // Мы будем использовать их подход
      
      const weeklyCandles: CandleData[] = [];
      
      // Для точного соответствия TradingView, нам нужно:
      // 1. Сгруппировать свечи по неделям, используя ту же логику что и в TradingView
      // 2. Для каждой недели создать одну свечу
      
      // Сначала определим начало недели как понедельник (как в большинстве графиков TradingView)
      const WEEK_START_DAY = 1; // 0=Воскресенье, 1=Понедельник
      
      // Сортируем свечи по времени для правильного порядка
      const sortedCandles = [...dailyCandles].sort((a, b) => a.time - b.time);
      
      // Группируем свечи по неделям
      let weekStart = -1;
      for (let i = 0; i < sortedCandles.length; i++) {
        const date = new Date(sortedCandles[i].time * 1000);
        const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
        
        // Если это начало новой недели или первая свеча
        if (dayOfWeek === WEEK_START_DAY || i === 0) {
          if (weekStart !== -1) {
            // Завершаем предыдущую неделю
            const weekCandles = sortedCandles.slice(weekStart, i);
            
            // Формируем недельную свечу (OHLC)
            weeklyCandles.push({
              time: weekCandles[0].time,
              open: weekCandles[0].open,
              high: Math.max(...weekCandles.map(c => c.high)),
              low: Math.min(...weekCandles.map(c => c.low)),
              close: weekCandles[weekCandles.length - 1].close
            });
          }
          
          weekStart = i;
        }
      }
      
      // Добавляем последнюю неделю
      if (weekStart !== -1 && weekStart < sortedCandles.length) {
        const weekCandles = sortedCandles.slice(weekStart);
        
        weeklyCandles.push({
          time: weekCandles[0].time,
          open: weekCandles[0].open,
          high: Math.max(...weekCandles.map(c => c.high)),
          low: Math.min(...weekCandles.map(c => c.low)),
          close: weekCandles[weekCandles.length - 1].close
        });
      }
      
      // Логируем недельные данные для отладки
      console.log("Created weekly candles:", weeklyCandles.length);
      if (weeklyCandles.length > 0) {
        const firstWeek = new Date(weeklyCandles[0].time * 1000).toLocaleDateString();
        const lastWeek = new Date(weeklyCandles[weeklyCandles.length-1].time * 1000).toLocaleDateString();
        console.log(`Weekly range: ${firstWeek} to ${lastWeek}`);
      }
      
      return weeklyCandles;
    };
    
    const weeklyCandles = getWeeklyCandles(candleData);
    console.log("Weekly candles:", weeklyCandles.length);
    
    // Count how many real signals we generate - for debugging
    let signalCount = 0;
    
    // Calculate indicators for each candle
    for (let i = 0; i < candleData.length; i++) {
      const candle = candleData[i];
      const candleDate = new Date(candle.time * 1000);
      
      // Check if this is a date we're interested in
      const isSpecificDate = 
        (candleDate.getFullYear() === 2022 && (candleDate.getMonth() === 10 || candleDate.getMonth() === 5)) || 
        (candleDate.getFullYear() === 2025 && candleDate.getMonth() === 2);
      
      // Skip calculation if we don't have enough historical data
      if (i < length) {
        result.push({
          time: candle.time,
          bbLowerDaily: candle.close, // Default value, won't generate signals
          bbLowerWeekly: candle.close,
          entrySignal: false
        });
        continue;
      }
      
      // Daily calculation - exactly as in PineScript
      // Get last 'length' (20) close prices including current
      const closePrices = candleData.slice(Math.max(0, i - length + 1), i + 1).map(c => c.close);
      const dailySMA = calculateSMA(closePrices, length);
      const dailyStdDev = calculateStdDev(closePrices, length, dailySMA);
      const bbLowerDaily = dailySMA - mult * dailyStdDev;
      
      // Weekly Bollinger Band - точная реализация как в PineScript
      // В TradingView request.security работает так:
      // - Берет недельный таймфрейм ("W")
      // - Для каждой недели вычисляет SMA и StdDev
      // - Затем возвращает значение для недели, к которой относится текущая свеча
      
      // Найдем начало недели для текущей свечи
      const weekStart = getWeekStart(candleDate);
      
      // В PineScript ta.sma и ta.stdev вычисляются для недельного таймфрейма
      // Найдем все недельные свечи до текущей даты (включительно)
      const weeksUpToNow = weeklyCandles.filter(w => 
        new Date(w.time * 1000) <= weekStart
      );
      
      // Рассчитаем BB для недельного таймфрейма, как в PineScript
      let bbLowerWeekly = candle.close; // Значение по умолчанию
      
      // В PineScript, если у нас недостаточно данных (length=20), TradingView все равно проводит расчет
      // с доступными данными, но в нашем случае мы проверим, есть ли минимум необходимых данных
      if (weeksUpToNow.length > 0) {
        // Берем последние length недель (или все доступные, если недель меньше)
        const recentWeeks = weeksUpToNow.slice(-length);
        
        // Рассчитываем SMA и StdDev точно как в PineScript
        const weeklyClosePrices = recentWeeks.map(w => w.close);
        const weeklySMA = calculateSMA(weeklyClosePrices, Math.min(length, weeklyClosePrices.length));
        const weeklyStdDev = calculateStdDev(weeklyClosePrices, Math.min(length, weeklyClosePrices.length), weeklySMA);
        
        // Нижняя полоса BB как в PineScript: sma - mult * stdev
        bbLowerWeekly = weeklySMA - mult * weeklyStdDev;
        
        // Добавим дополнительные логи для диагностики
        if (isSpecificDate) {
          console.log(`[WEEKLY DATA] Week of ${candleDate.toLocaleDateString()} has ${recentWeeks.length} weeks of data. SMA: ${weeklySMA.toFixed(2)}, StdDev: ${weeklyStdDev.toFixed(2)}`);
        }
      }
      
      // Анализ PineScript алгоритма
      // В TradingView PineScript период для BB часто измеряется в барах, а не календарных днях
      // Для дневного BB: 20 дней, для недельного BB: 20 недель
      
      // Внесем коррекцию в соответствии с PineScript - применим более точную логику
      // PineScript использует смещение для отображения линий (displacement часто равен по умолчанию 0)
      // Проверим цену относительно обеих полос как в оригинальном PineScript
      const entrySignal = candle.close <= bbLowerDaily && candle.close <= bbLowerWeekly;
      
      // Для выявления проблемы с расчетами выведем подробную информацию
      if (isSpecificDate) {
        const formattedDate = candleDate.toLocaleDateString('ru-RU');
        console.log(`[DEBUG] ${formattedDate} - Price: ${candle.close.toFixed(2)}, Daily BB: ${bbLowerDaily.toFixed(2)}, Weekly BB: ${bbLowerWeekly.toFixed(2)}, Signal: ${entrySignal}`);
        
        // Добавим полную информацию о дате и расчетах для каждой интересующей даты
        const weekStartDate = getWeekStart(candleDate).toLocaleDateString('ru-RU');
        
        // Дополнительная отладка для дат, которые упомянул пользователь
        if (candleDate.getFullYear() === 2022 && candleDate.getMonth() === 10) {
          console.log(`[IMPORTANT] Ноябрь 2022 (неделя ${weekStartDate}) - Сигнал должен быть, проверяем расчеты:`);
          console.log(`Daily: Цена ${candle.close.toFixed(2)} <= BB Daily ${bbLowerDaily.toFixed(2)}? ${candle.close <= bbLowerDaily}`);
          console.log(`Weekly: Цена ${candle.close.toFixed(2)} <= BB Weekly ${bbLowerWeekly.toFixed(2)}? ${candle.close <= bbLowerWeekly}`);
        }
        if (candleDate.getFullYear() === 2022 && candleDate.getMonth() === 5) {
          console.log(`[IMPORTANT] Июнь 2022 (неделя ${weekStartDate}) - Сигнал должен быть, проверяем расчеты:`);
          console.log(`Daily: Цена ${candle.close.toFixed(2)} <= BB Daily ${bbLowerDaily.toFixed(2)}? ${candle.close <= bbLowerDaily}`);
          console.log(`Weekly: Цена ${candle.close.toFixed(2)} <= BB Weekly ${bbLowerWeekly.toFixed(2)}? ${candle.close <= bbLowerWeekly}`);
        }
        if (candleDate.getFullYear() === 2025 && candleDate.getMonth() === 2) {
          console.log(`[IMPORTANT] Март 2025 (неделя ${weekStartDate}) - Сигнал должен быть, проверяем расчеты:`);
          console.log(`Daily: Цена ${candle.close.toFixed(2)} <= BB Daily ${bbLowerDaily.toFixed(2)}? ${candle.close <= bbLowerDaily}`);
          console.log(`Weekly: Цена ${candle.close.toFixed(2)} <= BB Weekly ${bbLowerWeekly.toFixed(2)}? ${candle.close <= bbLowerWeekly}`);
        }
      }
      
      if (entrySignal) {
        signalCount++;
      }
      
      result.push({
        time: candle.time,
        bbLowerDaily,
        bbLowerWeekly,
        entrySignal
      });
    }
    
    console.log("Generated", signalCount, "real signals out of", candleData.length, "candles");
    console.log("Sample indicator values:", result.length > 0 ? result[result.length-1] : "none");
    
    return result;
  }, [candleData]);
  
  // Initialize view state
  useEffect(() => {
    if (candleData.length > 0) {
      setViewState({
        startIndex: 0,
        endIndex: candleData.length - 1,
        scale: 1
      });
    }
  }, [candleData]);
  
  // Zoom in/out handlers
  const handleZoomIn = () => {
    setViewState(prev => {
      const range = prev.endIndex - prev.startIndex;
      const newRange = Math.max(Math.floor(range * 0.7), 20); // Don't zoom in too much
      const midPoint = Math.floor(prev.startIndex + range / 2);
      
      return {
        startIndex: Math.max(0, midPoint - Math.floor(newRange / 2)),
        endIndex: Math.min(candleData.length - 1, midPoint + Math.floor(newRange / 2)),
        scale: prev.scale * 1.3
      };
    });
  };
  
  const handleZoomOut = () => {
    setViewState(prev => {
      const range = prev.endIndex - prev.startIndex;
      const newRange = Math.min(Math.floor(range * 1.5), candleData.length - 1);
      const midPoint = Math.floor(prev.startIndex + range / 2);
      
      return {
        startIndex: Math.max(0, midPoint - Math.floor(newRange / 2)),
        endIndex: Math.min(candleData.length - 1, midPoint + Math.floor(newRange / 2)),
        scale: Math.max(prev.scale * 0.7, 0.5)
      };
    });
  };
  
  const handleResetZoom = () => {
    setViewState({
      startIndex: 0,
      endIndex: candleData.length - 1,
      scale: 1
    });
  };
  
  // Pan handlers
  const handlePanLeft = () => {
    setViewState(prev => {
      const range = prev.endIndex - prev.startIndex;
      const panAmount = Math.max(1, Math.floor(range * 0.1));
      
      if (prev.startIndex - panAmount < 0) {
        return {
          ...prev,
          startIndex: 0,
          endIndex: Math.min(range, candleData.length - 1)
        };
      }
      
      return {
        ...prev,
        startIndex: prev.startIndex - panAmount,
        endIndex: prev.endIndex - panAmount
      };
    });
  };
  
  const handlePanRight = () => {
    setViewState(prev => {
      const range = prev.endIndex - prev.startIndex;
      const panAmount = Math.max(1, Math.floor(range * 0.1));
      
      if (prev.endIndex + panAmount >= candleData.length) {
        return {
          ...prev,
          startIndex: Math.max(0, candleData.length - 1 - range),
          endIndex: candleData.length - 1
        };
      }
      
      return {
        ...prev,
        startIndex: prev.startIndex + panAmount,
        endIndex: prev.endIndex + panAmount
      };
    });
  };

  // Обновляем состояние при перемещении влево/вправо

  // Keyboard events for interaction mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyDown(true);
        setInteractionMode('selection'); // Shift key turns on area selection mode
      } else if (e.key === 'Alt') {
        setInteractionMode('pan'); // Alt key turns on panning mode
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyDown(false);
        setInteractionMode('crosshair'); // Back to crosshair mode
      } else if (e.key === 'Alt') {
        setInteractionMode('crosshair'); // Back to crosshair mode
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Draw candlestick chart on canvas
  useEffect(() => {
    if (isLoading || error || !candleData.length || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size with higher resolution for better quality
    // Use device pixel ratio for sharper rendering on high DPI screens
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * pixelRatio;
    canvas.height = canvas.clientHeight * pixelRatio;
    
    // Scale the context to ensure correct drawing
    ctx.scale(pixelRatio, pixelRatio);
    
    // Background
    ctx.fillStyle = '#151924';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // Calculate chart area
    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = canvas.clientWidth - margin.left - margin.right;
    const chartHeight = canvas.clientHeight - margin.top - margin.bottom;
    
    // Get visible data based on current view state
    const visibleData = candleData.slice(viewState.startIndex, viewState.endIndex + 1);
    const visibleVolumeData = volumeData.slice(viewState.startIndex, viewState.endIndex + 1);
    
    // Find min/max values for visible data
    const maxPrice = Math.max(...visibleData.map(c => c.high));
    const minPrice = Math.min(...visibleData.map(c => c.low));
    const pricePadding = (maxPrice - minPrice) * 0.1;
    
    // Scale functions
    const xScale = (i: number) => margin.left + (i / (visibleData.length - 1)) * chartWidth;
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
    
    // Vertical grid lines
    const skipFactor = Math.ceil(visibleData.length / 10);
    for (let i = 0; i < visibleData.length; i += skipFactor) {
      const x = xScale(i);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
      
      // Date labels for some points
      if (i % (skipFactor * 2) === 0) {
        const date = new Date(visibleData[i].time * 1000);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(date.toLocaleDateString(), x, canvas.clientHeight - 5);
      }
    }
    
    // Calculate candle width based on zoom level
    const candleWidth = Math.min(
      (chartWidth / visibleData.length) * 0.8,
      15
    );
    
    // Draw candles
    // Draw Bollinger Bands
    if ((showBBDaily || showBBWeekly) && indicatorData.length > 0) {
      // Get visible indicator data
      const visibleIndicators = indicatorData.slice(viewState.startIndex, viewState.endIndex + 1);
      
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
        ctx.setLineDash([8, 4]); // Dashed line for weekly
        
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
        ctx.setLineDash([]); // Reset line style
        
        // Label for the Weekly BB
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.fillText('BB Weekly', canvas.clientWidth - 70, 25);
      }
    }
    
    // Draw candles
    visibleData.forEach((candle, i) => {
      const x = xScale(i);
      const openY = yScale(candle.open);
      const closeY = yScale(candle.close);
      const highY = yScale(candle.high);
      const lowY = yScale(candle.low);
      
      // Determine if up or down candle
      const isUp = candle.close >= candle.open;
      ctx.strokeStyle = isUp ? '#26a69a' : '#ef5350';
      ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
      
      // Draw wick (high-low line)
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw candle body
      const candleHeight = Math.abs(closeY - openY);
      const y = Math.min(openY, closeY);
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, Math.max(candleHeight, 1));
      
      // Draw entry signals
      if (showSignals && i + viewState.startIndex < indicatorData.length) {
        const indicator = indicatorData[i + viewState.startIndex];
        if (indicator.entrySignal) {
          // Draw TradingView style signal - small orange cross with subtle halo
          // Position below the low price, not at the top of the chart 
          const signalY = lowY + 20; // Position below the candle, like in TradingView
          
          // First draw background glow
          ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
          ctx.beginPath();
          ctx.arc(x, signalY, 10, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw signal cross (+) like in TradingView - small, clean orange plus sign
          ctx.strokeStyle = 'rgb(255, 165, 0)'; // Pure orange for better visibility
          ctx.lineWidth = 2;
          
          // Draw + (вместо X)
          const crossSize = 6; // Размер крестика
          
          // Горизонтальная линия крестика +
          ctx.beginPath();
          ctx.moveTo(x - crossSize, signalY);
          ctx.lineTo(x + crossSize, signalY);
          ctx.stroke();
          
          // Вертикальная линия крестика +
          ctx.beginPath();
          ctx.moveTo(x, signalY - crossSize);
          ctx.lineTo(x, signalY + crossSize);
          ctx.stroke();
          
          // Reset lineWidth
          ctx.lineWidth = 1;
          
          // Убираем текст "BUY" по запросу пользователя
        }
      }
    });
    
    // Draw tooltip
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'; // Hide tooltip initially
    }
    
    // Отрисовка перекрестия (crosshair) как в TradingView
    if (mousePosition && interactionMode === 'crosshair' && !isDragging) {
      const { x, y } = mousePosition;
      const margin = { top: 20, right: 60, bottom: 30, left: 10 };
      const chartWidth = canvas.clientWidth - margin.left - margin.right;
      const chartHeight = canvas.clientHeight - margin.top - margin.bottom;
      
      // Отрисовываем перекрестие только в области графика
      if (x > margin.left && x < canvas.clientWidth - margin.right && 
          y > margin.top && y < margin.top + chartHeight) {
        
        // Горизонтальная линия
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(canvas.clientWidth - margin.right, y);
        ctx.stroke();
        
        // Вертикальная линия
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + chartHeight);
        ctx.stroke();
        
        // Сбрасываем стиль линии
        ctx.setLineDash([]);
        
        // Отрисовка метки с ценой (справа, как в TradingView)
        const maxPrice = Math.max(...visibleData.map(c => c.high));
        const minPrice = Math.min(...visibleData.map(c => c.low));
        const pricePadding = (maxPrice - minPrice) * 0.1;
        const priceRange = (maxPrice - minPrice) + pricePadding * 2;
        const relativeY = (y - margin.top) / chartHeight;
        const price = maxPrice - relativeY * priceRange + pricePadding;
        
        // Фон для метки цены - справа, улучшенный стиль
        ctx.fillStyle = 'rgba(40, 44, 52, 0.95)';
        ctx.fillRect(canvas.clientWidth - margin.right + 2, y - 10, 55, 20);
        
        // Текст цены
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPrice(price), canvas.clientWidth - margin.right + 5, y);
        
        // Отрисовка даты внизу графика (как в TradingView)
        // Определяем, над какой свечой находится курсор
        const candleIndex = Math.floor((x - margin.left) / chartWidth * visibleData.length);
        if (candleIndex >= 0 && candleIndex < visibleData.length) {
          const candle = visibleData[candleIndex];
          const date = new Date(candle.time * 1000);
          const formattedDate = date.toLocaleDateString('ru-RU');
          
          // Фон для даты
          ctx.fillStyle = 'rgba(40, 44, 52, 0.95)';
          ctx.fillRect(x - 40, canvas.clientHeight - margin.bottom + 2, 80, 20);
          
          // Текст даты
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(formattedDate, x, canvas.clientHeight - margin.bottom + 12);
        }
      }
    }
    
    
    // Отрисовка выделенной области для масштабирования (как в TradingView)
    if (selectionArea.active && selectionArea.start && selectionArea.end) {
      const { start, end } = selectionArea;
      
      // Рисуем прямоугольник выделения
      ctx.fillStyle = 'rgba(100, 150, 250, 0.2)';
      ctx.fillRect(
        start.x, 
        start.y, 
        end.x - start.x, 
        end.y - start.y
      );
      
      // Рамка выделения
      ctx.strokeStyle = 'rgba(100, 150, 250, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        start.x, 
        start.y, 
        end.x - start.x, 
        end.y - start.y
      );
    }
    
    // Отображение текущего режима взаимодействия
    ctx.fillStyle = 'rgba(50, 50, 60, 0.7)';
    ctx.fillRect(10, 10, 120, 25);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    let modeText = '';
    switch (interactionMode) {
      case 'crosshair':
        modeText = '🎯 Crosshair Mode';
        break;
      case 'pan':
        modeText = '✋ Pan Mode (Alt)';
        break;
      case 'selection':
        modeText = '📏 Selection (Shift)';
        break;
    }
    
    ctx.fillText(modeText, 15, 22);
    
  }, [candleData, volumeData, viewState, showBBDaily, showBBWeekly, showSignals, indicatorData, 
      isLoading, error, mousePosition, isDragging, interactionMode, selectionArea]);
  
  // Mouse interaction for panning and selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (interactionMode === 'selection') {
      // Start area selection (like in TradingView)
      setSelectionArea({
        start: { x: mouseX, y: mouseY },
        end: { x: mouseX, y: mouseY },
        active: true
      });
    } else {
      // Normal panning behavior
      setIsDragging(true);
      setDragStart(e.clientX);
      setDragStartViewState({ ...viewState });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Calculate mouse position relative to canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Update mouse position for crosshair
    setMousePosition({ x: mouseX, y: mouseY });
    
    // Handle selection area (если в режиме выделения области)
    if (interactionMode === 'selection' && selectionArea.active && selectionArea.start) {
      setSelectionArea({
        ...selectionArea,
        end: { x: mouseX, y: mouseY }
      });
    }
    
    // Update tooltip with hovered candle data
    if (tooltipRef.current && candleData.length > 0 && !isDragging && interactionMode === 'crosshair') {
      const visibleData = candleData.slice(viewState.startIndex, viewState.endIndex + 1);
      const margin = { top: 20, right: 60, bottom: 30, left: 10 };
      const chartWidth = canvasRef.current.clientWidth - margin.left - margin.right;
      
      // Find which candle the mouse is over
      const candleIndex = Math.floor((mouseX - margin.left) / chartWidth * visibleData.length);
      if (candleIndex >= 0 && candleIndex < visibleData.length) {
        const candle = visibleData[candleIndex];
        setHoveredCandle(candle);
        
        // Display tooltip
        const tooltip = tooltipRef.current;
        tooltip.style.display = 'block';
        tooltip.style.left = `${mouseX + 10}px`;
        tooltip.style.top = `${mouseY - 100}px`;
        
        // Format date
        const date = new Date(candle.time * 1000);
        const formattedDate = date.toLocaleDateString('ru-RU');
        
        // Build tooltip content
        tooltip.innerHTML = `
          <div class="font-semibold mb-1">${formattedDate}</div>
          <div class="grid grid-cols-2 gap-x-2 text-xs">
            <div>Open:</div><div>${formatPrice(candle.open)}</div>
            <div>High:</div><div>${formatPrice(candle.high)}</div>
            <div>Low:</div><div>${formatPrice(candle.low)}</div>
            <div>Close:</div><div class="${candle.close >= candle.open ? 'text-green-500' : 'text-red-500'}">${formatPrice(candle.close)}</div>
          </div>
        `;
      } else {
        tooltipRef.current.style.display = 'none';
      }
    }
    
    // Handle dragging for chart panning in 'pan' mode или при обычном перетаскивании
    if ((isDragging && dragStartViewState) && (interactionMode === 'pan' || interactionMode === 'crosshair')) {
      const dragDistance = e.clientX - dragStart;
      const range = dragStartViewState.endIndex - dragStartViewState.startIndex;
      const panAmount = Math.floor((dragDistance / canvasRef.current.clientWidth) * range);
      
      if (panAmount === 0) return;
      
      let newStart = dragStartViewState.startIndex - panAmount;
      let newEnd = dragStartViewState.endIndex - panAmount;
      
      // Bound checks
      if (newStart < 0) {
        newStart = 0;
        newEnd = range;
      }
      
      if (newEnd >= candleData.length) {
        newEnd = candleData.length - 1;
        newStart = Math.max(0, newEnd - range);
      }
      
      setViewState({
        ...dragStartViewState,
        startIndex: newStart,
        endIndex: newEnd
      });
    }
  };
  
  const handleMouseUp = () => {
    // Если было активно выделение области, выполняем масштабирование
    if (interactionMode === 'selection' && selectionArea.active && selectionArea.start && selectionArea.end) {
      // Проверяем, что выделенная область имеет ненулевой размер
      const width = Math.abs(selectionArea.end.x - selectionArea.start.x);
      const height = Math.abs(selectionArea.end.y - selectionArea.start.y);
      
      if (width > 10 && height > 10) {
        // Выполняем масштабирование к выделенной области
        performZoomToSelection(selectionArea);
      }
      
      // Сбрасываем выделение после обработки
      setSelectionArea({
        start: null,
        end: null,
        active: false
      });
    }
    
    setIsDragging(false);
    setDragStartViewState(null);
  };
  
  // Функция масштабирования к выбранной области
  const performZoomToSelection = (area: SelectionArea) => {
    if (!area.start || !area.end || !canvasRef.current) return;
    
    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = canvasRef.current.clientWidth - margin.left - margin.right;
    
    // Определяем границы выделения в координатах канваса
    const minX = Math.min(area.start.x, area.end.x);
    const maxX = Math.max(area.start.x, area.end.x);
    
    // Преобразуем координаты экрана в индексы свечей
    const visibleData = candleData.slice(viewState.startIndex, viewState.endIndex + 1);
    const startPct = Math.max(0, (minX - margin.left) / chartWidth);
    const endPct = Math.min(1, (maxX - margin.left) / chartWidth);
    
    // Вычисляем новые индексы для отображения
    const rangeSize = viewState.endIndex - viewState.startIndex;
    const newStartOffset = Math.floor(startPct * rangeSize);
    const newEndOffset = Math.ceil(endPct * rangeSize);
    
    const newStartIndex = viewState.startIndex + newStartOffset;
    const newEndIndex = viewState.startIndex + newEndOffset;
    
    // Применяем новый диапазон просмотра
    setViewState({
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      scale: viewState.scale * (rangeSize / (newEndOffset - newStartOffset))
    });
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
    setDragStartViewState(null);
    
    // Сбрасываем режим выделения при выходе мыши за пределы графика
    if (selectionArea.active) {
      setSelectionArea({
        start: null, 
        end: null, 
        active: false
      });
    }
  };
  
  // Mouse wheel for zooming - точно как в TradingView
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    // Определяем, является ли это жестом на трекпаде (например, на Mac)
    // wheelDeltaX !== 0 обычно означает горизонтальный жест на трекпаде
    const isTrackpadPan = e.deltaX !== 0;
    
    if (isTrackpadPan || e.ctrlKey) {
      // Это жест панорамирования двумя пальцами на трекпаде или с зажатым Ctrl
      // Реализуем перемещение графика как в TradingView (без изменения масштаба)
      const currentRange = viewState.endIndex - viewState.startIndex;
      const moveAmount = Math.round(currentRange * (e.deltaX > 0 ? 0.05 : -0.05));
      
      if (moveAmount === 0) return;
      
      let newStartIndex = viewState.startIndex + moveAmount;
      let newEndIndex = viewState.endIndex + moveAmount;
      
      // Проверка границ
      if (newStartIndex < 0) {
        newStartIndex = 0;
        newEndIndex = currentRange;
      }
      
      if (newEndIndex >= candleData.length) {
        newEndIndex = candleData.length - 1;
        newStartIndex = Math.max(0, newEndIndex - currentRange);
      }
      
      setViewState({
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        scale: viewState.scale
      });
      
      return;
    }
    
    // Получаем позицию мыши относительно холста для зума вокруг точки
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const canvasWidth = rect.width;
    
    // Вычисляем относительную позицию мыши (0-1) в текущем видимом диапазоне
    const margin = { left: 10, right: 60 };
    const chartWidth = canvasWidth - margin.left - margin.right;
    const relativePosition = (mouseX - margin.left) / chartWidth;
    
    // Рассчитываем текущий диапазон видимых свечей
    const currentRange = viewState.endIndex - viewState.startIndex;
    
    // Определяем величину масштабирования - точно как в TradingView
    // При прокрутке колеса график сужается/расширяется по ширине
    const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25; // Уменьшаем на 20% или увеличиваем на 25%
    
    // Рассчитываем новый диапазон
    const newRange = Math.max(10, Math.min(Math.round(currentRange * zoomFactor), candleData.length));
    
    if (newRange === currentRange) return; // Ничего не меняем, если диапазон не изменился
    
    // Вычисляем центр масштабирования на основе положения курсора
    const currentCenter = viewState.startIndex + relativePosition * currentRange;
    
    // Вычисляем новый startIndex, сохраняя положение курсора неподвижным
    let newStartIndex = Math.round(currentCenter - relativePosition * newRange);
    
    // Убедимся, что не выходим за границы
    newStartIndex = Math.max(0, Math.min(newStartIndex, candleData.length - newRange));
    
    // Устанавливаем новое состояние просмотра
    setViewState({
      startIndex: newStartIndex,
      endIndex: Math.min(newStartIndex + newRange, candleData.length - 1),
      scale: viewState.scale * (e.deltaY < 0 ? 1.25 : 0.8) // Обновляем масштаб
    });
    
    console.log("Zoom: ", e.deltaY < 0 ? "in" : "out", "New range:", newRange);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Загрузка данных...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 rounded-lg p-4">
        <div className="text-center mb-4">
          <div className="text-red-500 text-4xl mb-2">⚠️</div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Ошибка загрузки данных</h3>
          <p className="text-gray-300 mb-4">{error.message}</p>
          <button 
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md shadow text-white transition"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-2">
          <button 
            onClick={handlePanLeft}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            ← Назад
          </button>
          <button 
            onClick={handlePanRight}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Вперед →
          </button>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleZoomIn}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Zoom +
          </button>
          <button 
            onClick={handleZoomOut}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Zoom -
          </button>
          <button 
            onClick={handleResetZoom}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Reset
          </button>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={showBBDaily} 
              onChange={e => setShowBBDaily(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            <span className="ml-2 text-sm font-medium text-gray-300">BB Daily</span>
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={showBBWeekly} 
              onChange={e => setShowBBWeekly(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-red-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            <span className="ml-2 text-sm font-medium text-gray-300">BB Weekly</span>
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={showSignals} 
              onChange={e => setShowSignals(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-orange-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            <span className="ml-2 text-sm font-medium text-gray-300">Signals</span>
          </label>
        </div>
      </div>
      <div className="relative flex-grow bg-slate-900 rounded-lg">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />
        <div ref={tooltipRef} className="absolute hidden bg-gray-800 text-white p-2 rounded shadow-lg text-xs pointer-events-none z-10"></div>
      </div>
    </div>
  );
};

export default BitcoinChart;