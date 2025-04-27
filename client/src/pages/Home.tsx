import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import BitcoinChart from '@/components/BitcoinChart';
import ChartControls from '@/components/ChartControls';
import CryptoSelector from '@/components/CryptoSelector';
import SignalSettings from '@/components/SignalSettings';
import { TimeFrame, CryptoSymbol, CryptoChartData, CryptoCurrency } from '@/types/chart';
import { formatPrice } from '@/lib/utils';
import { fetchCryptoData, fetchTopCryptos } from '@/lib/api';

export default function Home() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('1w');
  const [cryptoSymbol, setCryptoSymbol] = useState<CryptoSymbol>('BTC');
  
  // Fetch data based on the selected timeframe and crypto
  const { 
    data: chartData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<CryptoChartData>({ 
    queryKey: [`/api/crypto/${cryptoSymbol}/${timeframe}`],
    staleTime: 60000, // 1 minute
  });
  
  // Calculate price change
  const calculatePriceChange = () => {
    if (!chartData?.candles || chartData.candles.length === 0) {
      return { price: "0.00", change: "0.00", isPositive: true };
    }
    
    const latestCandle = chartData.candles[chartData.candles.length - 1];
    const price = formatPrice(latestCandle.close);
    
    const changeValue = latestCandle.close - latestCandle.open;
    const changePercent = (changeValue / latestCandle.open) * 100;
    const isPositive = changePercent >= 0;
    
    return {
      price,
      change: changePercent.toFixed(2),
      isPositive
    };
  };
  
  const priceInfo = calculatePriceChange();
  
  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: TimeFrame) => {
    setTimeframe(newTimeframe);
  };

  // Handle crypto symbol change
  const handleCryptoChange = (newSymbol: CryptoSymbol) => {
    setCryptoSymbol(newSymbol);
  };
  
  // Zoom control handlers
  const handleZoomIn = () => {
    console.log('Zoom in requested');
  };
  
  const handleZoomOut = () => {
    console.log('Zoom out requested');
  };
  
  const handleResetZoom = () => {
    console.log('Reset zoom requested');
  };

  // Fetch top cryptocurrencies data
  const { data: cryptoList, isLoading: isLoadingCryptos } = useQuery({
    queryKey: ['/api/crypto/top'],
    queryFn: () => fetchTopCryptos(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Get the selected cryptocurrency's details
  const selectedCrypto = cryptoList?.find(crypto => crypto.id === cryptoSymbol);
  
  return (
    <div className="flex flex-col h-screen bg-chart-bg text-chart-text">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-chart-grid">
        <div className="flex items-center">
          {selectedCrypto?.imageUrl && (
            <img src={selectedCrypto.imageUrl} alt={selectedCrypto.name} className="w-8 h-8 mr-2" />
          )}
          <h1 className="text-xl font-bold">{cryptoSymbol}/USDT</h1>
          <span className="ml-2 text-gray-400">{selectedCrypto?.name || cryptoSymbol}</span>
        </div>
        
        {/* Crypto Currency Selector */}
        <div className="flex items-center mx-4">
          <CryptoSelector
            selectedCrypto={cryptoSymbol}
            onSelect={handleCryptoChange}
          />
        </div>
        
        <div className="flex items-center">
          <span className={`text-2xl font-semibold ${priceInfo.isPositive ? 'text-chart-upCandle' : 'text-chart-downCandle'}`}>
            {priceInfo.price}
          </span>
          <span className={`ml-2 px-2 py-1 rounded text-sm ${
            priceInfo.isPositive 
              ? 'bg-chart-upCandle/10 text-chart-upCandle' 
              : 'bg-chart-downCandle/10 text-chart-downCandle'
          }`}>
            {priceInfo.isPositive ? '+' : ''}{priceInfo.change}%
          </span>
        </div>
      </header>

      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <ChartControls
          currentTimeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
        <SignalSettings />
      </div>

      {/* Main Chart Area */}
      <BitcoinChart
        candleData={chartData?.candles || []}
        volumeData={chartData?.volumes || []}
        isLoading={isLoading}
        error={error as Error}
        onRetry={refetch}
      />
    </div>
  );
}