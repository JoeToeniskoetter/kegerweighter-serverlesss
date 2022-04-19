type KegSizeInfo = {
  [key: string]: {
    beers: number;
    tare: number;
    full: number;
    net_weight: number;
  };
};

export const kegSizeInfo: KegSizeInfo = {
  "1/4 Barrel": { beers: 82, tare: 22, full: 87, net_weight: 65 },
  "1/2 Barrel": { beers: 165, tare: 31, full: 165, net_weight: 134 },
  "1/6 Barrel": { beers: 55, tare: 16.5, full: 58, net_weight: 41.5 },
  "Cornelious Keg": { beers: 53, tare: 9, full: 55, net_weight: 46 },
  "Pony Keg": { beers: 82, tare: 22, full: 87, net_weight: 65 },
  "50 Litre": { beers: 140, tare: 28, full: 130, net_weight: 102 },
};

export type Keg = {
  acceptNextReading: boolean;
  online: boolean;
  beerType: string;
  location: string;
  kegSize:
    | "1/2 Barrel"
    | "1/4 Barrel"
    | "1/6 Barrel"
    | "Pony Keg"
    | "Cornelious Keg"
    | "50 litre";
  firstNotificationPerc: number;
  secondNotificationPerc: number;
  subscribed: boolean;
  userId: string;
  data: {
    customTare: number;
    beersLeft: number;
    percLeft: number;
    weight: number;
    temp: number;
    beersToday: number;
    beersDaily: BeersDrankDataPoint;
    beersDailyArray: number[];
    beersThisWeek: number;
    beersWeeklyArray: number[];
    beersWeekly: BeersDrankDataPoint;
    beersThisMonth: number;
    beersMonthly: BeersDrankDataPoint;
    beersMonthlyArray: number[];
    firstNotificationSent: boolean;
    secondNotificationSent: boolean;
  };
  potentialNewKeg: boolean;
  createdAt: number;
};

export type BeersDrankDataPoint = {
  [key: string]: number;
};

export type User = {
  fcmToken: string[];
  id: string;
};

export type Device = {
  calibrationFactor: number;
  deviceId: string;
  firmwareVersion: string;
  offset: number;
};

export type DevicesMetaData = {
  latestFirmwareVersion: string;
  updatedAt: string;
  firmwareLink: string;
};

export type ResetKegInput = {
  id: string;
  clearData: boolean;
};
