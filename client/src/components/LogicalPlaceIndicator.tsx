import { useState, useMemo } from 'react';
import { CandleData, TimeFrame } from '@/types/chart';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface LogicalPlaceIndicatorProps {
  candleData: CandleData[];
  weeklyData?: CandleData[];
  timeframe: TimeFrame;
  onTimeframeChange?: (timeframe: TimeFrame) => void;
}

interface BBSettings {
  length: number;
  multiplier: number;
}

interface IndicatorData {
  time: number;
  price: number;
  dailyBB: number;
  weeklyBB: number;
  isSignal: boolean;
}

// Индикатор Logical Place with Exit Points
export default function LogicalPlaceIndicator({
  candleData,
  weeklyData,
  timeframe,
  onTimeframeChange
}: LogicalPlaceIndicatorProps) {
  
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
  const indicatorResults = useMemo(() => {
    if (!candleData || candleData.length === 0) {
      return {
        indicatorData: [] as IndicatorData[],
        signalCount: 0
      };
    }
    
    const { length, multiplier } = bbSettings;
    
    // Проверяем, достаточно ли данных
    if (candleData.length < length) {
      return {
        indicatorData: [] as IndicatorData[],
        signalCount: 0
      };
    }
    
    const result: IndicatorData[] = [];
    let signalCount = 0;
    
    // Для дневных данных
    const dailyBBMap = new Map<number, number>();
    
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
      
      dailyBBMap.set(candleData[i].time, bb_lower_d);
    }
    
    // Для недельных данных (если они предоставлены) или используем дневные как запасной вариант
    const dataToUseForWeekly = weeklyData && weeklyData.length >= length ? weeklyData : candleData;
    const weeklyBBMap = new Map<number, number>();
    
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
      
      weeklyBBMap.set(dataToUseForWeekly[i].time, bb_lower_w);
    }
    
    // Рассчитываем сигналы входа - точно как в PineScript 
    // entry_condition = source <= bb_lower_d and source <= bb_lower_w
    for (let i = candleData.length - 10; i < candleData.length; i++) {
      if (i < length - 1) continue;
      
      const time = candleData[i].time;
      const price = candleData[i].close;
      const dailyBB = dailyBBMap.get(time) || 0;
      const weeklyBB = weeklyBBMap.get(time) || 0;
      
      // Проверяем условие входа: цена ниже обоих уровней
      const isSignal = price <= dailyBB && price <= weeklyBB;
      
      if (isSignal) {
        signalCount++;
      }
      
      result.push({
        time,
        price,
        dailyBB,
        weeklyBB,
        isSignal
      });
    }
    
    return {
      indicatorData: result,
      signalCount
    };
  }, [candleData, weeklyData, bbSettings]);
  
  // Форматирование даты для отображения
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };
  
  // Форматирование цены для отображения
  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="p-4">
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
          
          <div className="flex items-center gap-2 pb-4">
            <span className="text-sm flex gap-1 items-center">
              <span className="inline-block w-3 h-0.5 bg-blue-500"></span>
              <span>Daily Lower Band</span>
            </span>
            <span className="text-sm flex gap-1 items-center ml-4">
              <span className="inline-block w-3 h-0.5 bg-red-500"></span>
              <span>Weekly Lower Band</span>
            </span>
            <span className="text-sm flex gap-1 items-center ml-4">
              <span className="text-orange-500">⚠</span>
              <span>Entry Signal</span>
            </span>
          </div>
        </div>

        <Separator className="my-2" />
        
        <div className="text-sm mb-2">
          <p className="font-medium">Последние данные индикатора:</p>
          <p className="mt-1">
            <strong>Entry Condition:</strong> Price must be below both Daily and Weekly Lower Bollinger Bands
          </p>
          <p className="mt-1 text-orange-500 font-semibold">
            {indicatorResults.signalCount > 0 
              ? `Найдено ${indicatorResults.signalCount} сигналов на покупку!` 
              : "На текущий момент нет сигналов на покупку"}
          </p>
        </div>
        
        <Table>
          <TableCaption>Последние 10 результатов расчета индикатора</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Daily BB</TableHead>
              <TableHead>Weekly BB</TableHead>
              <TableHead>Сигнал</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicatorResults.indicatorData.slice(0).reverse().map((data) => (
              <TableRow key={data.time}>
                <TableCell>{formatTimestamp(data.time)}</TableCell>
                <TableCell>{formatPrice(data.price)}</TableCell>
                <TableCell>{formatPrice(data.dailyBB)}</TableCell>
                <TableCell>{formatPrice(data.weeklyBB)}</TableCell>
                <TableCell>
                  {data.isSignal 
                    ? <span className="text-orange-500 font-bold">✓</span> 
                    : <span className="text-gray-400">-</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}