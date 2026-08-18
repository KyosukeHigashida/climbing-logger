import { type FormEvent, useState } from "react";

type ClimbFormProps = {
  initialGrade?: string;
  initialName?: string | null;
  onCancel: () => void;
  onSubmit: (grade: string, name: string | null) => Promise<void>;
  submitLabel?: string;
};

export function ClimbForm({
  initialGrade = "",
  initialName = "",
  onCancel,
  onSubmit,
  submitLabel = "START CLIMB",
}: ClimbFormProps) {
  const [grade, setGrade] = useState(initialGrade);
  const [name, setName] = useState(initialName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grade.trim()) {
      setError("Grade is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(grade.trim(), name);
      setGrade("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save climb.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="climb-form" onSubmit={handleSubmit}>
      <label>
        Grade
        <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="2Q" />
      </label>
      <label>
        Name / number
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Yellow #12" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
