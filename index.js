// const dns = require("node:dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const reviewsCollection = db.collection('all-reviews');
        const favoritesCollection = db.collection('all-favorites');

        //---------     API Endpoint     ---------\\
        app.get('/all-properties', async (req, res) => {                // All Properties
            try {
                const { search, propertyType, sort } = req.query;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 6;
                const skip = (page - 1) * limit;

                const query = { status: "approved" };

                if (search) {
                    query.location = { $regex: search, $options: "i" };
                }

                if (propertyType) {
                    query.propertyType = propertyType;
                }

                let sortOptions = {};
                if (sort === "price-asc") {
                    sortOptions.rentPrice = 1;
                } else if (sort === "price-desc") {
                    sortOptions.rentPrice = -1;
                }

                const totalItems = await propertiesCollection.countDocuments(query);

                const properties = await propertiesCollection
                    .find(query)
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                const totalPages = Math.ceil(totalItems / limit);

                res.json({
                    properties,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems,
                        limit
                    }
                });
            } catch (error) {
                console.error("Error fetching properties:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        app.get('/featured-properties', async (req, res) => {          // Featured Properties
            const result = await propertiesCollection.find({ status: "approved" })
                .limit(6)
                .toArray();

            res.json(result);
        });

        app.get("/all-properties/:id", async (req, res) => {            // Get Property by id
            const { id } = req.params;

            const result = await propertiesCollection.findOne({
                _id: new ObjectId(id)
            });

            res.json(result);
        });

        app.get("/all-reviews/:id", async (req, res) => {            // Get Reviews by property id
            const { id } = req.params;

            const result = await reviewsCollection.find({
                propertyId: id
            }).toArray();;

            res.json(result);
        });

        app.post('/all-reviews', async (req, res) => {            // ADD 1 Review
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        });


        app.get("/home-reviews", async (req, res) => {            // Get 4 good  tenant Reviews
            const result = await reviewsCollection
                .find({
                    rating: 5,
                    role: "Tenant"
                })
                .limit(4)
                .toArray();

            res.json(result);
        });


        app.post('/all-favorites', async (req, res) => {            // Add to Favorites 
            const favoritesData = req.body;
            const result = await favoritesCollection.insertOne(favoritesData);
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