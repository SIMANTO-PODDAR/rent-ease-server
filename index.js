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
        // await client.connect();                              //   <--- !

        //---------   DB & COLLECTIONS   ---------\\
        const db = client.db('rent-ease');

        const propertiesCollection = db.collection('all-properties');
        const reviewsCollection = db.collection('all-reviews');
        const favoritesCollection = db.collection('all-favorites');
        const bookingsCollection = db.collection('all-bookings');

        //---------     API Endpoint     ---------\\

        //---------     Bookings     ---------\\
        app.post('/all-bookings', async (req, res) => {                // ADD 1 booking
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.json(result);
        });

        app.patch("/all-bookings/:bookingId", async (req, res) => {    // Update Booking
            const { bookingId } = req.params;
            const Data = req.body;

            // console.log(Data);
            const result = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                { $set: Data },
            );
            res.json(result);
        });

        app.get('/tenant-bookings/:tenantId', async (req, res) => {       // Get booking data by tenantId
            const { tenantId } = req.params;

            const result = await bookingsCollection.find({
                tenantId: tenantId
            }).toArray();

            res.json(result);
        });

        app.get('/owner-bookings/:ownerId', async (req, res) => {       // Get booking data by ownerId
            const { ownerId } = req.params;

            const result = await bookingsCollection.find({
                ownerId: ownerId,
                paymentStatus: "Paid"
            }).toArray();

            res.json(result);
        });


        //---------     Property     ---------\\
        app.post('/all-properties', async (req, res) => {           // ADD 1 Property
            const propertyData = req.body;
            const result = await propertiesCollection.insertOne(propertyData);
            res.json(result);
        });

        app.patch("/all-properties/:propertyId", async (req, res) => {   // Update Property Data
            const { propertyId } = req.params;
            const propertyData = req.body;

            const result = await propertiesCollection.updateOne(
                { _id: new ObjectId(propertyId) },
                { $set: propertyData },
            );
            res.json(result);
        });

        app.get('/all-properties', async (req, res) => {            // All Properties
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

        app.get('/featured-properties', async (req, res) => {       // Featured Properties
            const result = await propertiesCollection.find({ status: "approved" })
                .limit(6)
                .toArray();

            res.json(result);
        });

        app.get("/all-properties/:id", async (req, res) => {        // Get Property by Property id
            const { id } = req.params;

            const result = await propertiesCollection.findOne({
                _id: new ObjectId(id)
            });

            res.json(result);
        });

        app.get("/owner-properties/:ownerId", async (req, res) => {        // Get Properties by ownerId
            const { ownerId } = req.params;

            const result = await propertiesCollection.find({
                "owner.id": ownerId
            }).toArray();

            res.json(result);
        });


        //---------     Review     ---------\\
        app.get("/all-reviews/:id", async (req, res) => {           // Get Reviews by property id
            const { id } = req.params;

            const result = await reviewsCollection.find({
                propertyId: id
            }).toArray();;

            res.json(result);
        });

        app.post('/all-reviews', async (req, res) => {              // ADD 1 Review
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        });

        app.get("/home-reviews", async (req, res) => {              // Get 4 good  tenant Reviews
            const result = await reviewsCollection
                .find({
                    rating: 5,
                    role: "Tenant"
                })
                .limit(4)
                .toArray();

            res.json(result);
        });



        //---------     Favorites     ---------\\
        app.post('/all-favorites', async (req, res) => {            // Add to Favorites 
            const favoritesData = req.body;
            const result = await favoritesCollection.insertOne(favoritesData);
            res.json(result);
        });

        app.get("/all-favorites/:id", async (req, res) => {         // Get favorites property by userId
            const { id } = req.params;

            const result = await favoritesCollection.find({
                userId: id
            }).toArray();;

            res.json(result);
        });

        app.delete("/all-favorites/:itemId", async (req, res) => {      // Delete 1 Favorite i by i Id
            const { itemId } = req.params;

            const result = await favoritesCollection.deleteOne({
                _id: new ObjectId(itemId)
            });

            res.json(result);
        });


        //----------------------------------------//
        // await client.db("admin").command({ ping: 1 });      //   <--- !
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