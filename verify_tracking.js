const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017"; // Assuming local or env if we read it
const dotenv = require("dotenv");
dotenv.config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017");
  try {
    await client.connect();
    const db = client.db("rent-ease");
    
    console.log("--- Tracking Sessions ---");
    const sessions = await db.collection("tracking-sessions").find().toArray();
    console.log(JSON.stringify(sessions, null, 2));

    console.log("\n--- Tracking Activities ---");
    const activities = await db.collection("tracking-activities").find().toArray();
    console.log(JSON.stringify(activities, null, 2));

  } finally {
    await client.close();
  }
}

run().catch(console.error);
