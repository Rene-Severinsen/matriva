alter table house_documents
  drop constraint if exists house_documents_type_valid,
  drop constraint if exists house_documents_detected_type_valid;

update house_documents
set document_type = 'improvement_document'
where document_type = 'renovation_documentation';

update house_documents
set detected_document_type = 'improvement_document'
where detected_document_type = 'renovation_documentation';

alter table house_documents
  add constraint house_documents_type_valid check (document_type is null or document_type in (
    'condition_report','energy_label','bbr_notice','purchase_agreement','manual',
    'warranty','invoice','receipt','insurance_policy','service_agreement',
    'improvement_document','other'
  )),
  add constraint house_documents_detected_type_valid check (detected_document_type is null or detected_document_type in (
    'condition_report','energy_label','bbr_notice','purchase_agreement','manual',
    'warranty','invoice','receipt','insurance_policy','service_agreement',
    'improvement_document','other'
  ));
