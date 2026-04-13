ALTER TABLE feature_requests DROP CONSTRAINT IF EXISTS feature_requests_source_check;
ALTER TABLE feature_requests ADD CONSTRAINT feature_requests_source_check
  CHECK (source IN ('chatbot', 'sdf_generation', 'sdf_regeneration'));
