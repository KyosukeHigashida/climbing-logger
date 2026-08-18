import type { AttemptResult } from "../types/domain";

type AttemptButtonsProps = {
  disabled?: boolean;
  onAttempt: (result: AttemptResult) => void;
};

export function AttemptButtons({ disabled = false, onAttempt }: AttemptButtonsProps) {
  return (
    <div className="attempt-buttons">
      <button className="attempt-button fail" disabled={disabled} onClick={() => onAttempt("fail")}>
        FAIL
      </button>
      <button className="attempt-button send" disabled={disabled} onClick={() => onAttempt("send")}>
        SEND
      </button>
    </div>
  );
}
