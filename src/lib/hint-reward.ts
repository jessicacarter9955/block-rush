export type HintReward = 'completed' | 'cancelled' | 'unavailable';
export type RewardedAdProvider = () => Promise<HintReward>;
let provider: RewardedAdProvider | undefined;
/** Register the platform SDK adapter. Only its earned-reward callback may return completed. */
export function setHintAdProvider(value: RewardedAdProvider | undefined) { provider = value; }
export async function requestHintReward(): Promise<HintReward> {
  if (!provider) return 'unavailable';
  try { return await provider(); } catch { return 'unavailable'; }
}
export function scoreFontSize(text:string,maxSize:number,width:number):number {
  return Math.min(maxSize,(width-24)/(Math.max(1,text.length)*1.05));
}
