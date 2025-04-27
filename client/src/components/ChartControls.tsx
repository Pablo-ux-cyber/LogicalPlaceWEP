import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, ChartCandlestick, LineChart, BarChart3, Filter } from 'lucide-react';
import { TimeFrame } from '@/types/chart';

interface ChartControlsProps {
  currentTimeframe: TimeFrame;
  onTimeframeChange: (timeframe: TimeFrame) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

const ChartControls = ({
  currentTimeframe,
  onTimeframeChange,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: ChartControlsProps) => {
  const timeframes: TimeFrame[] = ['1w'];
  
  return (
    <div className="flex flex-wrap items-center p-2 border-b border-chart-grid text-sm">
      <div className="flex space-x-1 mr-4">
        {/* Time Interval Selector */}
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {timeframes.map((timeframe, index) => {
            const isFirst = index === 0;
            const isLast = index === timeframes.length - 1;
            const isActive = timeframe === currentTimeframe;
            
            return (
              <button
                key={timeframe}
                type="button"
                onClick={() => onTimeframeChange(timeframe)}
                className={`
                  px-3 py-1.5 font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : 'bg-chart-grid text-chart-text hover:bg-chart-grid/80'} 
                  ${isFirst ? 'rounded-l-lg' : ''}
                  ${isLast ? 'rounded-r-lg' : ''}
                `}
              >
                {timeframe}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Chart Type Selector */}
      <div className="flex space-x-3 mr-4">
        <button className="flex items-center justify-center w-8 h-8 rounded bg-chart-grid/50 hover:bg-chart-grid" title="ChartCandlestick Chart">
          <ChartCandlestick className="h-4 w-4" />
        </button>
        <button className="flex items-center justify-center w-8 h-8 rounded hover:bg-chart-grid/50" title="Line Chart">
          <LineChart className="h-4 w-4" />
        </button>
        <button className="flex items-center justify-center w-8 h-8 rounded hover:bg-chart-grid/50" title="Bar Chart">
          <BarChart3 className="h-4 w-4" />
        </button>
      </div>
      
      {/* Indicators Button */}
      <button className="px-3 py-1.5 bg-chart-grid text-chart-text rounded hover:bg-chart-grid/80 mr-4 flex items-center">
        <Filter className="h-4 w-4 mr-1" />
        Indicators
      </button>
      
      {/* Zoom Controls */}
      <div className="flex space-x-1">
        <button 
          onClick={onZoomIn}
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-chart-grid/50" 
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button 
          onClick={onZoomOut}
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-chart-grid/50" 
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button 
          onClick={onResetZoom}
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-chart-grid/50" 
          title="Reset Zoom"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ChartControls;
