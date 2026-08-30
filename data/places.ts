import type { Place } from "@/models/travel";

export const places: Place[] = [
  { id: "pvg-t2", cityId: "shanghai", name: "浦东 T2", latitude: 31.1443, longitude: 121.8083, category: "airport" },
  { id: "shanghai-disney", cityId: "shanghai", name: "上海迪士尼", latitude: 31.1433, longitude: 121.6578, category: "attraction" },
  { id: "the-bund", cityId: "shanghai", name: "外滩", latitude: 31.24, longitude: 121.49, category: "attraction" },
  { id: "oriental-pearl", cityId: "shanghai", name: "东方明珠", latitude: 31.2397, longitude: 121.4998, category: "attraction" },
  { id: "shanghai-south", cityId: "shanghai", name: "上海南站", latitude: 31.154, longitude: 121.429, category: "station" },
  { id: "hangzhou-station", cityId: "hangzhou", name: "杭州站", latitude: 30.243482, longitude: 120.18286, category: "station" },
  { id: "hangzhou-east", cityId: "hangzhou", name: "杭州东站", latitude: 30.291, longitude: 120.212, category: "station" },
  { id: "hangzhou-south", cityId: "hangzhou", name: "杭州南站", latitude: 30.1665, longitude: 120.2936, category: "station" },
];
