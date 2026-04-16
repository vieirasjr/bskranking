import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Zap, Flame, Award } from 'lucide-react';
import { supabase } from '../supabase';

interface PointEvent {
  id: string;
  playerName: string;
  points: number;
  locationId: string;
  locationName?: string;
  avatarUrl?: string;
}

const PHRASES = [
  '{name} acabou de marcar {pts}!',
  'Bela cesta de {name} ({pts})!',
  '{name} está on fire com {pts}!',
  'Mais {pts} na conta de {name}!',
  '{name} não perdoa: {pts}!',
  'Ponto para {name}! ({pts})',
];

const ICONS = [Trophy, Star, Zap, Flame, Award];

export function GlobalPointsListener({ currentLocationId }: { currentLocationId?: string }) {
  const [events, setEvents] = useState<PointEvent[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('global-points')
      .on('broadcast', { event: 'point_scored' }, ({ payload }) => {
        // If we are in a specific tenant, ignore points from other tenants
        if (currentLocationId && payload.locationId !== currentLocationId) {
          return;
        }

        const newEvent = {
          id: Math.random().toString(36).substring(7),
          playerName: payload.playerName,
          points: payload.points,
          locationId: payload.locationId,
          locationName: payload.locationName,
          avatarUrl: payload.avatarUrl,
        };

        setEvents((prev) => [...prev, newEvent]);

        // Remove after 4 seconds
        setTimeout(() => {
          setEvents((prev) => prev.filter((e) => e.id !== newEvent.id));
        }, 4000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLocationId]);

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {events.map((ev, i) => {
          const phraseTemplate = PHRASES[Math.floor(Math.random() * PHRASES.length)];
          const ptsStr = ev.points === 1 ? '1 ponto' : `${ev.points} pontos`;
          const text = phraseTemplate.replace('{name}', ev.playerName).replace('{pts}', ptsStr);
          const Icon = ICONS[Math.floor(Math.random() * ICONS.length)];
          
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(249,115,22,0.4)] flex items-center gap-3"
            >
              {ev.avatarUrl ? (
                <img src={ev.avatarUrl} alt={ev.playerName} className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-white/30" />
              ) : (
                <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-black text-sm md:text-base leading-tight tracking-wide">
                  {text}
                </span>
                {!currentLocationId && ev.locationName && (
                  <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider">
                    📍 {ev.locationName}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
