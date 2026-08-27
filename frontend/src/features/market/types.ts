export type MarketItem = {
  code: string
  name: string
  effect: string | null
  costCoins: number | null
  width: number
  height: number
  category:
    | 'residential'
    | 'nature'
    | 'public'
    | 'commercial'
    | 'industry'
    | 'road'
    | 'expansion'
}
