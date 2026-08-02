alter table house_documents
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists document_type text,
  add column if not exists document_date date,
  add column if not exists related_party text,
  add column if not exists amount_minor integer,
  add column if not exists currency text not null default 'DKK',
  add column if not exists expires_at date,
  add column if not exists is_important boolean not null default false,
  add column if not exists note text,
  add column if not exists analysis_status text not null default 'not_requested',
  add column if not exists analysis_version text,
  add column if not exists analysis_requested_at timestamptz,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists analysis_error_code text,
  add column if not exists detected_document_type text,
  add column if not exists extracted_metadata jsonb not null default '{}'::jsonb;

alter table house_documents
  drop constraint if exists house_documents_category_valid,
  add constraint house_documents_category_valid check (category is null or category in (
    'reports','official','manuals_warranties','invoices_receipts','improvements','insurance','agreements','other'
  )),
  drop constraint if exists house_documents_type_valid,
  add constraint house_documents_type_valid check (document_type is null or document_type in (
    'condition_report','energy_label','bbr_notice','purchase_agreement','manual','warranty','invoice','receipt',
    'insurance_policy','service_agreement','renovation_documentation','other'
  )),
  drop constraint if exists house_documents_detected_type_valid,
  add constraint house_documents_detected_type_valid check (detected_document_type is null or detected_document_type in (
    'condition_report','energy_label','bbr_notice','purchase_agreement','manual','warranty','invoice','receipt',
    'insurance_policy','service_agreement','renovation_documentation','other'
  )),
  drop constraint if exists house_documents_amount_valid,
  add constraint house_documents_amount_valid check (amount_minor is null or amount_minor >= 0),
  drop constraint if exists house_documents_currency_valid,
  add constraint house_documents_currency_valid check (currency = 'DKK'),
  drop constraint if exists house_documents_analysis_status_valid,
  add constraint house_documents_analysis_status_valid check (analysis_status in ('not_requested','queued','running','completed','failed'));
