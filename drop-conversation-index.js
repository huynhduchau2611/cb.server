// Script to drop the old unique index on conversations collection
// Run this in MongoDB shell: mongo <database_name> drop-conversation-index.js
// Or use: mongosh <database_name> --file drop-conversation-index.js

try {
  // Drop the old unique index if it exists
  db.conversations.dropIndex("users_1_job_1");
  print("Successfully dropped index users_1_job_1");
} catch (e) {
  if (e.message.includes("index not found")) {
    print("Index users_1_job_1 does not exist, skipping...");
  } else {
    print("Error dropping index:", e.message);
  }
}

// List all indexes to verify
print("\nCurrent indexes on conversations collection:");
db.conversations.getIndexes().forEach(function(index) {
  print("  - " + index.name + ": " + JSON.stringify(index.key));
});
