// const dns = require("node:dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');

const cors = require('cors');
const dotenv = require('dotenv');

const app = express();
app.use(cors());
dotenv.config();

const uri = process.env.MONGODB_URI;

const PORT = process.env.PORT || 5000;
app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        await client.connect();                              //   <--- !

        //---------   DB & COLLECTIONS   ---------\\
        const db = client.db('rent-ease');
        const propertiesCollection = db.collection('all-properties');

        //---------     API Endpoint     ---------\\
        app.get('/all-properties', async (req, res) => {                // All Properties
            const result = await propertiesCollection.find().toArray();
            res.json(result);
        });


        //----------------------------------------//
        await client.db("admin").command({ ping: 1 });      //   <--- !
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send(`Rent Ease Server is running...`)
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
});