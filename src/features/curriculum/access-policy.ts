export function canAccessDrill(input: {
  drillConceptId: string;
  masteredConceptIds: readonly string[];
}): boolean {
  return input.masteredConceptIds.includes(input.drillConceptId);
}
