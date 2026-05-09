export type FocusHouse = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  totalSeconds: number;
  color: string;
};

export const FOCUS_HOUSES: FocusHouse[] = [
  {
    id: "house-1",
    label: "North",
    left: 120,
    top: 150,
    width: 168,
    height: 144,
    totalSeconds: 925,
    color: "rgba(251, 191, 36, 0.38)",
  },
  {
    id: "house-2",
    label: "River",
    left: 720,
    top: 220,
    width: 208,
    height: 168,
    totalSeconds: 1260,
    color: "rgba(255, 255, 255, 0.24)",
  },
  {
    id: "house-3",
    label: "Brick",
    left: 240,
    top: 610,
    width: 224,
    height: 168,
    totalSeconds: 755,
    color: "rgba(248, 113, 113, 0.42)",
  },
  {
    id: "house-4",
    label: "Garden",
    left: 760,
    top: 700,
    width: 176,
    height: 200,
    totalSeconds: 1835,
    color: "rgba(190, 24, 93, 0.4)",
  },
  {
    id: "house-5",
    label: "Stone",
    left: 160,
    top: 1090,
    width: 200,
    height: 176,
    totalSeconds: 990,
    color: "rgba(15, 23, 42, 0.28)",
  },
  {
    id: "house-6",
    label: "South",
    left: 690,
    top: 1180,
    width: 232,
    height: 152,
    totalSeconds: 1510,
    color: "rgba(253, 186, 116, 0.35)",
  },
];
