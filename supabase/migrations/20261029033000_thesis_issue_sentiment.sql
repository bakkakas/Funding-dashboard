-- Nullable preserves old issues without inventing a positive/negative classification.
alter table public.research_thesis_items add column sentiment text;
alter table public.research_thesis_items add constraint thesis_issue_sentiment
 check (sentiment is null or (kind = 'issue' and sentiment in ('positive','negative')));
notify pgrst, 'reload schema';
