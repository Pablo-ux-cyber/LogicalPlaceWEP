import { useEffect, useRef, useState, useMemo } from 'react';
import { CandleData, TimeFrame } from '@/types/chart';
import { createChart } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TradingViewIndicatorProps {
  candleData: CandleData[];
  weeklyData?: CandleData[];
  timeframe: TimeFrame;
  onTimeframeChange?: (timeframe: TimeFrame) => void;
}

interface BBSettings {
  length: number;
  multiplier: number;
}

// Индикатор Logical Place with Exit Points
export default function TradingViewIndicator({
  candleData,
  weeklyData,
  timeframe,
  onTimeframeChange
}: TradingViewIndicatorProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const dailyBBSeriesRef = useRef<any>(null);
  const weeklyBBSeriesRef = useRef<any>(null);
  
  // Настройки Bollinger Bands - как в PineScript коде
  const [bbSettings, setBbSettings] = useState<BBSettings>({
    length: 20,     // BB Length из PineScript
    multiplier: 2.0 // BB Multiplier из PineScript
  });
  
  // Обработка изменений параметров индикатора
  const handleLengthChange = (value: number[]) => {
    setBbSettings(prev => ({ ...prev, length: value[0] }));
  };
  
  const handleMultiplierChange = (value: number[]) => {
    setBbSettings(prev => ({ ...prev, multiplier: value[0] }));
  };
  
  // Рассчитываем Bollinger Bands - точно как в PineScript коде
  const calculateBollingerBands = useMemo(() => {
    if (!candleData || candleData.length === 0) {
      return { 
        dailyBB: [], 
        weeklyBB: [], 
        entrySignals: [] 
      };
    }
    
    const { length, multiplier } = bbSettings;
    
    // Проверяем, достаточно ли данных
    if (candleData.length < length) {
      return { 
        dailyBB: [], 
        weeklyBB: [], 
        entrySignals: [] 
      };
    }
    
    // Рассчитываем дневной BB
    const dailyBB: any[] = [];
    const weeklyBB: any[] = [];
    const entrySignals: any[] = [];
    
    // Для дневных данных
    for (let i = length - 1; i < candleData.length; i++) {
      // Собираем данные за период
      const periodData = candleData.slice(i - length + 1, i + 1);
      
      // Расчет SMA (простое скользящее среднее)
      const sum = periodData.reduce((acc, candle) => acc + candle.close, 0);
      const daily_sma = sum / length;
      
      // Расчет стандартного отклонения
      const squaredDiffs = periodData.map(candle => Math.pow(candle.close - daily_sma, 2));
      const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / length;
      const daily_std = Math.sqrt(variance);
      
      // Расчет нижней полосы Боллинджера (daily_sma - mult * daily_std)
      const bb_lower_d = daily_sma - (multiplier * daily_std);
      
      dailyBB.push({
        time: candleData[i].time,
        value: bb_lower_d
      });
    }
    
    // Для недельных данных (если они предоставлены) или используем дневные как запасной вариант
    const dataToUseForWeekly = weeklyData && weeklyData.length >= length ? weeklyData : candleData;
    
    // Последние length элементов из недельных данных для расчета BB
    for (let i = length - 1; i < dataToUseForWeekly.length; i++) {
      // Собираем данные за период
      const periodData = dataToUseForWeekly.slice(i - length + 1, i + 1);
      
      // Расчет SMA (простое скользящее среднее)
      const sum = periodData.reduce((acc, candle) => acc + candle.close, 0);
      const weekly_sma = sum / length;
      
      // Расчет стандартного отклонения
      const squaredDiffs = periodData.map(candle => Math.pow(candle.close - weekly_sma, 2));
      const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / length;
      const weekly_std = Math.sqrt(variance);
      
      // Расчет нижней полосы Боллинджера (weekly_sma - mult * weekly_std)
      const bb_lower_w = weekly_sma - (multiplier * weekly_std);
      
      weeklyBB.push({
        time: dataToUseForWeekly[i].time,
        value: bb_lower_w
      });
    }
    
    // Рассчитываем сигналы входа - точно как в PineScript 
    // entry_condition = source <= bb_lower_d and source <= bb_lower_w
    for (let i = length - 1; i < candleData.length; i++) {
      const source = candleData[i].close;
      
      // Находим соответствующие значения BB для текущей свечи
      const dailyBBValue = dailyBB.find(bb => bb.time === candleData[i].time)?.value;
      const weeklyBBValue = weeklyBB.find(bb => bb.time === candleData[i].time)?.value;
      
      if (dailyBBValue && weeklyBBValue) {
        // Проверяем условие входа: цена ниже обоих уровней
        const isEntrySignal = source <= dailyBBValue && source <= weeklyBBValue;
        
        if (isEntrySignal) {
          entrySignals.push({
            time: candleData[i].time,
            value: candleData[i].low * 0.98 // Немного ниже цены для визуализации
          });
        }
      }
    }
    
    return { dailyBB, weeklyBB, entrySignals };
  }, [candleData, weeklyData, bbSettings]);
  
  // Инициализация графика
  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      // Создаем график
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { color: '#1E1E2E' },
          textColor: '#DDD6FE',
        },
        grid: {
          vertLines: { color: '#2E2E3E' },
          horzLines: { color: '#2E2E3E' },
        },
        timeScale: {
          borderColor: '#2E2E3E',
          timeVisible: true,
        },
        crosshair: {
          mode: 0,
        },
      });
      
      // Создаем серии для свечей и индикаторов
      const candleSeries = chart.addSeries({
        type: 'Candlestick',
        upColor: '#4CAF50',
        downColor: '#EF4444',
        borderUpColor: '#4CAF50',
        borderDownColor: '#EF4444',
        wickUpColor: '#4CAF50',
        wickDownColor: '#EF4444',
      });
      
      // Создаем серию для дневного Bollinger Band
      const dailyBBSeries = chart.addSeries({
        type: 'Line',
        color: '#3B82F6', // Blue как в PineScript
        lineWidth: 2,
        name: 'Daily Lower Band',
      });
      
      // Создаем серию для недельного Bollinger Band
      const weeklyBBSeries = chart.addSeries({
        type: 'Line',
        color: '#EF4444', // Red как в PineScript
        lineWidth: 1,
        name: 'Weekly Lower Band',
      });
      
      // Добавляем серию для сигналов
      const signalSeries = chart.addSeries({
        type: 'Line',
        color: '#F59E0B', // Orange как в PineScript
        lineWidth: 1,
        name: 'Buy Signals',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      
      // Сохраняем ссылки
      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      dailyBBSeriesRef.current = dailyBBSeries;
      weeklyBBSeriesRef.current = weeklyBBSeries;
      
      // Обозначаем сигнальную серию
      const signalSeriesRef = signalSeries;
      
      // Адаптация размера при изменении окна
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
      };
    }
  }, []);
  
  // Обновление данных на графике при изменении данных или настроек
  useEffect(() => {
    if (
      chartRef.current && 
      candleSeriesRef.current && 
      dailyBBSeriesRef.current && 
      weeklyBBSeriesRef.current
    ) {
      // Обновляем данные свечей
      if (candleData && candleData.length > 0) {
        const formattedCandleData = candleData.map((candle) => ({
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        
        candleSeriesRef.current.setData(formattedCandleData);
      }
      
      // Получаем рассчитанные значения Bollinger Bands
      const { dailyBB, weeklyBB, entrySignals } = calculateBollingerBands;
      
      // Обновляем данные индикаторов
      dailyBBSeriesRef.current.setData(dailyBB);
      weeklyBBSeriesRef.current.setData(weeklyBB);
      
      // Добавляем маркеры для сигналов
      const markers = entrySignals.map(signal => ({
        time: signal.time,
        position: 'belowBar',
        color: '#F59E0B',
        shape: 'circle',
        size: 1,
      }));
      
      // Если данные изменились, подгоняем масштаб
      if (candleData && candleData.length > 0) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [candleData, weeklyData, calculateBollingerBands]);
  
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Logical Place with Exit Points Indicator
        </h2>
        
        <div className="flex items-center gap-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">BB Length:</span>
            <Slider
              defaultValue={[bbSettings.length]}
              min={5}
              max={50}
              step={1}
              className="w-32"
              onValueChange={handleLengthChange}
            />
            <span className="text-sm min-w-[24px]">{bbSettings.length}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">BB Multiplier:</span>
            <Slider
              defaultValue={[bbSettings.multiplier]}
              min={0.1}
              max={5.0}
              step={0.1}
              className="w-32"
              onValueChange={handleMultiplierChange}
            />
            <span className="text-sm min-w-[36px]">{bbSettings.multiplier.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pb-2">
          <span className="text-sm flex gap-2 items-center">
            <span className="inline-block w-3 h-0.5 bg-blue-500"></span>
            Daily Lower Band
          </span>
          <span className="text-sm flex gap-2 items-center ml-4">
            <span className="inline-block w-3 h-0.5 bg-red-500"></span>
            Weekly Lower Band
          </span>
          <span className="text-sm flex gap-2 items-center ml-4">
            <span className="text-orange-500">○</span>
            Entry Signal
          </span>
        </div>
      </div>

      <div className="w-full h-[500px] rounded-lg border overflow-hidden" ref={chartContainerRef} />
      
      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Entry Condition:</strong> Price must be below both Daily and Weekly Lower Bollinger Bands.
        </p>
      </div>
    </div>
  );
}