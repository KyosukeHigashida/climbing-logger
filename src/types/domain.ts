export type Gym = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Grade = {
  id: string;
  gymId?: string | null;
  boardId?: string | null;
  label: string;
  order: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type WallAngle = {
  id: string;
  gymId?: string | null;
  boardId?: string | null;
  angle: number;
  order: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Board = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  initialGymId?: string | null;
  sessionRpe?: number | null;
  performance?: number | null;
  memo?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Climb = {
  id: string;
  sessionId: string;
  grade: string;
  gymId?: string | null;
  gradeId?: string | null;
  wallAnglePresetId?: string | null;
  wallAngle?: number;
  wallType?: "gym" | "board";
  wallBoardId?: string | null;
  wallLabel?: string | null;
  name: string | null;
  memo?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AttemptResult = "fail" | "send";
export type AttemptEffort = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type EffortRating = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Attempt = {
  id: string;
  sessionId: string;
  climbId: string;
  /**
   * Legacy end timestamp retained for timestamp-only backups and old UI compatibility.
   */
  timestamp?: string;
  /**
   * New interval model. Legacy attempts have startedAt null and endedAt copied from timestamp.
   */
  startedAt: string | null;
  endedAt: string | null;
  result: AttemptResult | null;
  effort?: AttemptEffort;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type StrengthSet = {
  id: string;
  sessionId: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  weight?: number | null;
  reps?: number | null;
  workDurationSeconds?: number | null;
  effort?: EffortRating | null;
  memo?: string | null;
  createdAt: string;
  updatedAt?: string;
};
