-- Runs once, when the db volume is first initialised. Integration tests
-- (npm run test:integration) use this database so dev data is never touched.
CREATE DATABASE project_design_test OWNER design;
