-- Secret/service-role API keys bypass RLS, but PostgreSQL still requires
-- explicit object privileges. Grant the server-side role access to app data.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Keep future tables and sequences created by migrations accessible to the
-- trusted Edge Functions as well.
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
