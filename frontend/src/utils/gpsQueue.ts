// Offline-first GPS queue using localStorage
const QUEUE_KEY = 'zamtel_gps_queue';

export interface GpsQueueItem {
  id: string;
  deviceId: string;
  notes: string;
  reportedStatus: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  timestamp: string;
}

export function getQueue(): GpsQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToQueue(item: GpsQueueItem): void {
  const q = getQueue();
  q.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function removeFromQueue(id: string): void {
  const q = getQueue().filter(i => i.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function syncQueue(submitFn: (item: GpsQueueItem) => Promise<void>): Promise<number> {
  if (!isOnline()) return 0;
  const q = getQueue();
  let synced = 0;
  for (const item of q) {
    try {
      await submitFn(item);
      removeFromQueue(item.id);
      synced++;
    } catch (err) {
      console.error('Failed to sync GPS queue item:', item.id, err);
    }
  }
  return synced;
}
