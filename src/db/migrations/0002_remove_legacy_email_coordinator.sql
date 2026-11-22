-- One-time security migration.
-- The previous application version promoted this email address to coordinator
-- automatically. Remove that implicit privilege. Any legitimate responder or
-- coordinator must be re-authorized through an explicit administrator process.
UPDATE users
SET role = 'citizen'
WHERE lower(email) = 'souravsviswajith@gmail.com'
  AND role = 'coordinator';
