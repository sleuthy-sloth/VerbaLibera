CREATE FUNCTION prevent_mastery_assessment_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."result" <> 'PASS'
    AND EXISTS (
      SELECT 1
      FROM "ConceptMastery" AS mastery
      WHERE mastery."assessmentId" = OLD."id"
        AND mastery."userId" = OLD."userId"
        AND mastery."conceptBlockId" = OLD."conceptBlockId"
    ) THEN
    RAISE EXCEPTION
      'ConceptAssessment with a referenced ConceptMastery must remain PASS';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConceptAssessment_referenced_by_mastery_must_remain_passing"
BEFORE UPDATE OF "result" ON "ConceptAssessment"
FOR EACH ROW
EXECUTE FUNCTION prevent_mastery_assessment_demotion();
