-- Run once after deploying refresh-token hashing (invalidates all existing sessions).
DELETE FROM refresh_tokens;
