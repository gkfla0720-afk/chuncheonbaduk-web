'use client';

import { useRef, useState } from 'react';
import { Profile } from '../types';
import { fetchProfileMatchHistory, MatchHistoryEntry } from './matchHistory';
import { fetchProfileStats } from './profileStats';

const EMPTY_PROFILE_STATS = { wins: 0, losses: 0, attendanceRate: 0, joinedAt: '', tier: '' };

export function useProfileDetail() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileStats, setProfileStats] = useState(EMPTY_PROFILE_STATS);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const requestIdRef = useRef(0);

  const openProfileDetail = async (profile: Profile) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSelectedProfile(profile);
    setIsLoadingStats(true);
    setIsLoadingHistory(true);
    try {
      const [stats, history] = await Promise.all([
        fetchProfileStats(profile.id),
        fetchProfileMatchHistory(profile.id),
      ]);
      if (requestId !== requestIdRef.current) return;
      setProfileStats(stats);
      setMatchHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setIsLoadingStats(false);
      setIsLoadingHistory(false);
    }
  };

  const closeProfileDetail = () => {
    requestIdRef.current += 1;
    setSelectedProfile(null);
    setIsLoadingStats(false);
    setIsLoadingHistory(false);
  };

  return {
    selectedProfile,
    profileStats,
    isLoadingStats,
    matchHistory,
    isLoadingHistory,
    openProfileDetail,
    closeProfileDetail,
  };
}