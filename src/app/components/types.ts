export type RegionStatus = "free" | "moderate" | "full" | "offline";

export interface Region {
  id: string;
  name: string;
  count: number;
  capacity: number;
  status: RegionStatus;
  camId: string;
  camOnline: boolean;
  lastUpdated: string;
  locationNotes: string;
}
