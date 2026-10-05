-- Sign-in moves from passwords to emailed magic links (Resend).
--
-- PasswordToken becomes LoginToken: INVITE stays (an admin adds someone and
-- they get a link), RESET becomes SIGN_IN (any later sign-in). Renamed in
-- place rather than dropped and recreated, so nothing else has to move.

ALTER TYPE "PasswordTokenPurpose" RENAME TO "LoginTokenPurpose";
ALTER TYPE "LoginTokenPurpose" RENAME VALUE 'RESET' TO 'SIGN_IN';

ALTER TABLE "PasswordToken" RENAME TO "LoginToken";
ALTER TABLE "LoginToken" RENAME CONSTRAINT "PasswordToken_pkey" TO "LoginToken_pkey";
ALTER TABLE "LoginToken" RENAME CONSTRAINT "PasswordToken_userId_fkey" TO "LoginToken_userId_fkey";
ALTER INDEX "PasswordToken_tokenHash_key" RENAME TO "LoginToken_tokenHash_key";
ALTER INDEX "PasswordToken_userId_idx" RENAME TO "LoginToken_userId_idx";
ALTER INDEX "PasswordToken_expiresAt_idx" RENAME TO "LoginToken_expiresAt_idx";

-- Links issued under the old flow pointed at /set-password, which is gone.
DELETE FROM "LoginToken";

-- No passwords any more.
ALTER TABLE "User" DROP COLUMN "passwordHash";
