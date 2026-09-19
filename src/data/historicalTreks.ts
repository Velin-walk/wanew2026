import historicalTreksData from '../../historical_treks.json';

export interface HistoricalTrekItem {
  hike_number: string;
  title: string;
  approx_distance?: string;
  hike_date?: string;
  expected_duration?: string;
  difficulty?: string;
  team_leader?: string;
  category?: string;
}

export const HISTORICAL_TREKS: HistoricalTrekItem[] = historicalTreksData as HistoricalTrekItem[];
