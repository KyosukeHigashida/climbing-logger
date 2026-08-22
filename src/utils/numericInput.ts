type NumericInputOptions = {
  label: string;
  integer?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
};

export function parseOptionalNumericInput(value: string, options: NumericInputOptions): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    if (options.required) {
      throw new Error(`${options.label} is required.`);
    }
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${options.label} must be a number.`);
  }
  if (options.integer && !Number.isInteger(parsed)) {
    throw new Error(`${options.label} must be a whole number.`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${options.label} must be ${options.min} or greater.`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${options.label} must be ${options.max} or less.`);
  }
  return Object.is(parsed, -0) ? 0 : parsed;
}

export function getOptionalNumericInputError(value: string, options: NumericInputOptions): string | null {
  try {
    parseOptionalNumericInput(value, options);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : `${options.label} is invalid.`;
  }
}
