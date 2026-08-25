-- Seed deterministic candidate mappings from exact normalized names across different RDL sources.
-- Exact-name equality is evidence for a possible match only; it is never promoted to equivalence automatically.
INSERT INTO rdl.cross_rdl_mapping (
  source_entity_id, target_entity_id, mapping_type, provenance_method, confidence, status, evidence
)
SELECT
  a.entity_id,
  b.entity_id,
  'possible_match',
  'exact_name_rule',
  0.8500,
  'candidate',
  jsonb_build_object(
    'rule', 'same entity type and exact case-insensitive trimmed name across different RDL sources',
    'normalized_name', lower(btrim(a.name)),
    'generated_by', 'RDL-010'
  )
FROM rdl.rdl_entity a
JOIN rdl.rdl_package pa ON pa.package_id=a.package_id
JOIN rdl.rdl_release ra ON ra.release_id=pa.release_id
JOIN rdl.rdl_source sa ON sa.source_id=ra.source_id
JOIN rdl.rdl_entity b
  ON b.entity_type_code=a.entity_type_code
 AND lower(btrim(b.name))=lower(btrim(a.name))
 AND b.entity_id>a.entity_id
JOIN rdl.rdl_package pb ON pb.package_id=b.package_id
JOIN rdl.rdl_release rb ON rb.release_id=pb.release_id
JOIN rdl.rdl_source sb ON sb.source_id=rb.source_id
WHERE sa.source_id<>sb.source_id
  AND btrim(a.name)<>''
ON CONFLICT (source_entity_id, target_entity_id, mapping_type, provenance_method)
DO UPDATE SET
  confidence=EXCLUDED.confidence,
  evidence=EXCLUDED.evidence;
