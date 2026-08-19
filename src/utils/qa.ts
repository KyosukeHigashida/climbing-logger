export type QAItem = {
  id: string;
  question: string;
  answer: string;
};

export const qaItems: QAItem[] = [
  {
    id: "session",
    question: "What is a session?",
    answer:
      "Session は、クライミングやトレーニングの一連の活動をひとまとまりとして記録する単位です。",
  },
];
