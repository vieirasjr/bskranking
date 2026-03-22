/**
 * Verifica se o usuário está dentro do raio do local dos jogos.
 * Coordenadas fixas: quadra em -15.839174, -48.014438
 * Raio permitido: 50 metros
 */

import { useState, useEffect, useCallback } from 'react';

const VENUE_LAT = -15.839174;
const VENUE_LNG = -48.014438;
const RADIUS_METERS = 50;

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface LocationCheckResult {
  isWithinRadius: boolean | null;
  isLoading: boolean;
  error: string | null;
  distance: number | null;
  retry: () => void;
}

export function useLocationCheck(enabled: boolean): LocationCheckResult {
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkLocation = useCallback(() => {
    if (!enabled) {
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
          VENUE_LAT,
          VENUE_LNG
        );
        setDistance(Math.round(dist));
        setIsWithinRadius(dist <= RADIUS_METERS);
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
  }, [enabled, retryCount]);

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { isWithinRadius, isLoading, error, distance, retry };
}
