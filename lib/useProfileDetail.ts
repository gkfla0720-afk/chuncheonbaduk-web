'use client';

import { useState } from 'react';
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

  const openProfileDetail = async (profile: Profile) => {
    setSelectedProfile(profile);
    setIsLoadingStats(true);
    setIsLoadingHistory(true);
    try {
      const [stats, history] = await Promise.all([
        fetchProfileStats(profile.id),
        fetchProfileMatchHistory(profile.id),
      ]);
      setProfileStats(stats);
      setMatchHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
      setIsLoadingHistory(false);
    }
  };

  const closeProfileDetail = () => setSelectedProfile(null);

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