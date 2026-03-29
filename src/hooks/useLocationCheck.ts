import { useState, useEffect, useCallback } from 'react';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface VenueCoords {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface LocationCheckResult {
  isWithinRadius: boolean | null;
  isLoading: boolean;
  error: string | null;
  distance: number | null;
  retry: () => void;
}

export function useLocationCheck(enabled: boolean, venue?: VenueCoords): LocationCheckResult {
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkLocation = useCallback(() => {
    if (!enabled || !venue) {
      setIsLoading(false);
      setIsWithinRadius(true);
      setError(null);
      setDistance(null);
      return;
    }

    if (!navigator.geolocation) {
      setIsLoading(false);
      setError('Seu navegador não suporta geolocalização.');
      setIsWithinRadius(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = haversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          venue.lat,
          venue.lng
        );
        setDistance(Math.round(dist));
        setIsWithinRadius(dist <= venue.radiusMeters);
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        if (err.code === 1) {
          setError('Permissão de localização negada. Ative para entrar na fila.');
        } else if (err.code === 2) {
          setError('Posição indisponível. Verifique o GPS e tente novamente.');
        } else {
          setError('Não foi possível obter sua localização.');
        }
        setIsWithinRadius(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, venue?.lat, venue?.lng, venue?.radiusMeters, retryCount]);

  useEffect(() => { checkLocation(); }, [checkLocation]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { isWithinRadius, isLoading, error, distance, retry };
}
