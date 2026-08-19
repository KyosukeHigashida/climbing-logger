export type GradePresetId = "kyu-dan" | "q-d" | "v-grade" | "empty";
export type AnglePresetId = "fixed-10" | "fixed-5" | "board-5" | "empty";

export const gradePresets: Record<GradePresetId, { name: string; labels: string[] }> = {
  "kyu-dan": {
    name: "級 / 段",
    labels: ["10級", "9級", "8級", "7級", "6級", "5級", "4級", "3級", "2級", "1級", "初段", "二段", "三段"],
  },
  "q-d": {
    name: "Q / D",
    labels: ["10Q", "9Q", "8Q", "7Q", "6Q", "5Q", "4Q", "3Q", "2Q", "1Q", "1D", "2D", "3D"],
  },
  "v-grade": {
    name: "V Grade",
    labels: ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12"],
  },
  empty: {
    name: "Empty",
    labels: [],
  },
};

export const anglePresets: Record<AnglePresetId, { name: string; angles: number[] }> = {
  "fixed-10": {
    name: "90-140° / 10°",
    angles: [90, 100, 110, 120, 130, 140],
  },
  "fixed-5": {
    name: "90-140° / 5°",
    angles: Array.from({ length: 11 }, (_, index) => 90 + index * 5),
  },
  "board-5": {
    name: "Board 20-70° / 5°",
    angles: Array.from({ length: 11 }, (_, index) => 20 + index * 5),
  },
  empty: {
    name: "Empty",
    angles: [],
  },
};
