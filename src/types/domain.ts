export type Gym = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Grade = {
  id: string;
  gymId: string;
  label: string;
  order: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  initialGymId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Climb = {
  id: string;
  sessionId: string;
  grade: string;
  gymId?: string | null;
  gradeId?: string | null;
  name: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AttemptResult = "fail" | "send";

export type Attempt = {
  id: string;
  sessionId: string;
  climbId: string;
  /**
   * ISO 8601 timestamp for when the try is considered finished as a training event.
   */
  timestamp: string;
  result: AttemptResult;
  createdAt: string;
  updatedAt?: string;
};
