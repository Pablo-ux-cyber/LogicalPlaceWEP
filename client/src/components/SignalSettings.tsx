import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';

export default function SignalSettings() {
  const { toast } = useToast();
  const [open, setOpen] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  
  // Функция для запуска проверки сигналов
  const checkSignals = async () => {
    try {
      setChecking(true);
      const response = await axios.get('/api/signals/check');
      toast({
        title: 'Проверка сигналов запущена',
        description: 'Результаты будут отправлены в Telegram',
        variant: 'default',
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось запустить проверку сигналов',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };
  
  // Функция для тестирования отправки в Telegram
  const testTelegramMessage = async () => {
    try {
      setTesting(true);
      const response = await axios.get('/api/telegram/test');
      
      if (response.data.success) {
        toast({
          title: 'Тест успешен!',
          description: 'Тестовое сообщение отправлено в группу @logicalplace',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось отправить тестовое сообщение',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к Telegram',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3Z"/>
            <path d="M19 17v2a3 3 0 0 1-6 0v-2"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
          Сигналы
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Настройки сигналов</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div>
            <h4 className="mb-2 text-sm font-medium">Проверка сигналов</h4>
            <p className="text-sm text-gray-500">
              При запуске проверки будут проанализированы все доступные криптовалюты из отфильтрованного списка топ-100 (без стейблкоинов и обернутых токенов) на недельном таймфрейме
            </p>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="mb-2 text-sm font-medium">Подписка на Telegram-бота</h4>
            <p className="text-sm text-gray-500">
              Сигналы проверяются каждый день в 08:00 UTC и отправляются подписчикам бота при обнаружении.
            </p>
            <div className="mt-2">
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText("https://t.me/your_bot_username");
                  toast({
                    title: 'Ссылка скопирована',
                    description: 'Откройте Telegram и перейдите по скопированной ссылке',
                    variant: 'default',
                  });
                }}
              >
                Скопировать ссылку на бота
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Button 
              onClick={checkSignals} 
              disabled={checking || testing}
              className="w-full"
            >
              {checking ? "Проверка..." : "Запустить проверку сигналов вручную"}
            </Button>
            
            <Button 
              onClick={testTelegramMessage} 
              disabled={testing || checking}
              variant="outline"
              className="w-full"
            >
              {testing ? "Отправка..." : "Отправить тестовое сообщение в Telegram"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}