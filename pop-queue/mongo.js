
const mongodb = require('mongodb');
let MongoClient = mongodb.MongoClient;

// Connection URL


async function mongoClient(url, dbName) {
  let client = new MongoClient(url);
  await client.connect();
  console.log('Connected successfully to server');
  return client.db(dbName);
}

const objectId = mongodb.ObjectId;

module.exports = {
  mongoClient,
  objectId,
}