export type StopState = "CAPTCHA_DETECTED" | "QUEUE_DETECTED" | "HUMAN_CHECK_REQUIRED" | "LOGIN_REQUIRED" | null;

const stopStatePatterns: Array<[StopState, RegExp]> = [
  ["CAPTCHA_DETECTED", /captcha|verify you are human|i am not a robot/i],
  ["QUEUE_DETECTED", /waiting room|line to enter|high traffic queue/i],
  ["HUMAN_CHECK_REQUIRED", /human verification|security check|unusual activity|prove.*human/i],
  ["LOGIN_REQUIRED", /authentication required|sign in to continue|log in to continue|two-factor|verification code/i]
];

export function detectStopState(text: string): StopState {
  for (const [state, pattern] of stopStatePatterns) {
    if (pattern.test(text)) {
      return state;
    }
  }

  return null;
}
