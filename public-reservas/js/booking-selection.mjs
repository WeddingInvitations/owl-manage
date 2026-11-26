// One save action, using the existing server-validated reservation for each athlete.
// Keep individual outcomes so a failed reservation never hides successful ones.
export async function saveBookingSelection(athleteIds, { book, onResult = () => {}, shouldContinue = () => true }) {
  const outcomes = [];
  for (const athleteId of new Set(athleteIds)) {
    if (!shouldContinue()) break;
    let outcome;
    try {
      outcome = { athleteId, result: await book(athleteId) };
    } catch (error) {
      outcome = { athleteId, error };
    }
    outcomes.push(outcome);
    await onResult(outcome, outcomes.length);
  }
  return outcomes;
}