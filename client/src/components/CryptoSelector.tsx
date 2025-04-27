import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTopCryptos } from '@/lib/api';
import { CryptoSymbol, CryptoCurrency } from '@/types/chart';
import { cn } from '@/lib/utils';
import { ChevronDown, Search, XCircle } from 'lucide-react';

interface CryptoSelectorProps {
  selectedCrypto: CryptoSymbol;
  onSelect: (symbol: CryptoSymbol) => void;
}

export default function CryptoSelector({ selectedCrypto, onSelect }: CryptoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH', 'SOL', 'XRP']);

  // Fetch top cryptocurrencies
  const { data: cryptoList, isLoading, error } = useQuery({
    queryKey: ['/api/crypto/top'],
    queryFn: () => fetchTopCryptos(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the selected crypto's details
  const selectedCryptoDetails = cryptoList?.find(c => c.id === selectedCrypto);

  // Filter cryptos by search term
  const filteredCryptos = cryptoList?.filter(crypto => 
    crypto.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    crypto.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.crypto-selector-container')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative crypto-selector-container z-50">
      {/* Selected Crypto Display */}
      <button
        className="flex items-center space-x-2 p-2 rounded-md border border-chart-grid bg-chart-bg text-chart-text hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCryptoDetails ? (
          <>
            {selectedCryptoDetails.imageUrl && (
              <img 
                src={selectedCryptoDetails.imageUrl} 
                alt={selectedCryptoDetails.name} 
                className="w-6 h-6 mr-2"
              />
            )}
            <span className="font-semibold">{selectedCryptoDetails.id}</span>
            <span className="text-gray-400 hidden md:inline">{selectedCryptoDetails.name}</span>
          </>
        ) : (
          <span className="font-semibold">{selectedCrypto}</span>
        )}
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen ? "rotate-180" : "")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute mt-1 w-80 max-h-96 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-lg z-50">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-700 flex items-center bg-gray-800">
            <Search className="w-4 h-4 mr-2 text-gray-300" />
            <input
              type="text"
              placeholder="Search cryptocurrency..."
              className="w-full bg-transparent border-none outline-none text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <XCircle 
                className="w-4 h-4 text-gray-300 cursor-pointer hover:text-white" 
                onClick={() => setSearchTerm('')}
              />
            )}
          </div>

          {/* Favorite Coins Section */}
          {!searchTerm && (
            <div className="p-2 border-b border-gray-700 bg-gray-800">
              <h3 className="text-xs text-gray-300 mb-2 font-semibold">Popular Cryptocurrencies</h3>
              <div className="flex flex-wrap gap-1">
                {favorites.map(symbol => {
                  const crypto = cryptoList?.find(c => c.id === symbol);
                  return (
                    <button
                      key={symbol}
                      className={cn(
                        "px-2 py-1 text-xs rounded-full font-medium",
                        selectedCrypto === symbol
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-white hover:bg-gray-600"
                      )}
                      onClick={() => {
                        onSelect(symbol);
                        setIsOpen(false);
                      }}
                    >
                      {symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of Cryptos */}
          <div className="p-2 bg-gray-900">
            {isLoading ? (
              <div className="text-center py-4 text-white">Loading cryptocurrencies...</div>
            ) : error ? (
              <div className="text-center py-4 text-red-400">Error loading cryptocurrencies</div>
            ) : filteredCryptos.length === 0 ? (
              <div className="text-center py-4 text-white">No cryptocurrencies found</div>
            ) : (
              <div className="space-y-1">
                {filteredCryptos.map((crypto) => (
                  <button
                    key={crypto.id}
                    className={cn(
                      "flex items-center w-full p-2 rounded-md hover:bg-gray-700 transition-colors",
                      selectedCrypto === crypto.id ? "bg-gray-700" : "bg-gray-800"
                    )}
                    onClick={() => {
                      onSelect(crypto.id);
                      setIsOpen(false);
                    }}
                  >
                    {crypto.imageUrl && (
                      <img 
                        src={crypto.imageUrl} 
                        alt={crypto.name} 
                        className="w-6 h-6 mr-2"
                      />
                    )}
                    <div className="flex flex-col flex-grow text-left">
                      <div className="flex justify-between">
                        <span className="font-semibold text-white">{crypto.id}</span>
                        <span className="text-right text-white">${crypto.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-300">{crypto.name}</span>
                        <span className="text-xs text-gray-300">#{crypto.rank}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}